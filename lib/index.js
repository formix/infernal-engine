
const utils = require("./utils");
const RuleContext = require("./RuleContext");

module.exports = class InfernalEngine {

    _busy = false;
    _facts = new Map();
    _rules = new Map();
    _relations = new Map();
    _agenda = new Map();
    _changes = new Set();
    _logger = null;
    _maxDepth = 50;


    constructor(maxDepth, logger) {
        if (maxDepth) this._maxDepth = maxDepth;
        this._logger = logger || { log: () => {} };
    }

    /**
     * Return the fact's value.
     * 
     * @param {String} path The full path to the desired fact.
     * 
     * @returns {Promise<*>} The fact value.
     */
    async get(path) {
        let factpath = path.startsWith("/") ? path : `/${path}`;
        let compiledpath = utils.compilePath(factpath);
        return this._facts.get(compiledpath);
    }

    /**
     * Sets the fact to the given value.
     * 
     * @param {String} path The full path to the desired fact.
     * @param {*} value The fact value to set, must be a scalar.
     */
    async set(path, value) {
        let factpath = path.startsWith("/") ? path : `/${path}`;
        let compiledpath = utils.compilePath(factpath);
        var prevValue = this._facts.get(compiledpath);

        // Nothing to do if both values are equals, except if it is an array.
        // When setting an array, we consider the value changed without actually
        // comparing the arrays content assuming that executing the matching
        // rule is faster.
        if (!(value instanceof Array) && utils.equals(prevValue, value)) {
            return;
        }

        this._changes.add(compiledpath);
        this._facts.set(compiledpath, value);
        this._logger.log("debug", {
            action: "set",
            fact: compiledpath,
            prevValue: prevValue,
            newValue: value
        });
        _addToAgenda.call(this, compiledpath);
        if (!this._busy) {
            await this.infer(true);
        }
    }

    /**
     * Add a rule to the engine's ruleset.
     * 
     * @param {String} path The path where to save the rule at.
     * @param {Function} rule The rule to add. Must be async.
     */
    async addRule(path, rule) {
        let rulepath = path.startsWith("/") ? path : `/${path}`;
        let compiledRulepath = utils.compilePath(rulepath);
        let context = utils.getContext(compiledRulepath);

        let ruleContext = new RuleContext(this, rule, context)
        let parameters = utils.parseParameters(rule);
        for (const param of parameters) {
            let factpath = param.startsWith("/") ? param : context + param;
            let compiledFactpath = utils.compilePath(factpath);
            if (!this._relations.has(compiledFactpath))
                this._relations.set(compiledFactpath, new Set());
            this._relations.get(compiledFactpath).add(compiledRulepath);
            ruleContext.inputFacts.push(compiledFactpath);
        }
        this._rules.set(compiledRulepath, ruleContext);

        this._logger.log("debug", {
            action: "addRule", 
            rule: compiledRulepath
        });

        this._agenda.set(compiledRulepath, ruleContext);
        if (!this._busy) {
            await this.infer(true);
        }
    }

    /**
     * Execute inference and return a promise. At the begining of the inference, sets the 
     * '/_maxDepth' fact to make it available to rules that would be interested in this value.
     * Upon each loop, the engine sets the '/_depth' value indicating the agenda generation the
     * inference is currently at.
     */
    async infer() {
        this._logger.log("debug", {
            action: "infer"
        });

        this._busy = true;
        let depth = 0;
        this._facts.set("/$/maxDepth", this._maxDepth); //metafacts do not trigger rules

        try {
            while (depth < this._maxDepth && this._agenda.size > 0) {
                depth++;
                this._facts.set("/$/depth", depth); // metafacts do not trigger rules
                this._logger.log("debug", {
                    action: "executeAgenda",
                    depth: depth
                });
                let currentAgenda = this._agenda;
                this._agenda = new Map();
                for (const [path, rulectx] of currentAgenda) {
                    this._logger.log("debug", {
                        action: "executeRule",
                        path: path
                    });
                    await rulectx.execute();
                }
            }
        }
        finally {
            this._busy = false;
        }

        if (depth == this._maxDepth) {
            throw new Error("Inference not completed because maximum depth " +
                `reached (${this._maxDepth}). Please review for infinite loop or set the ` +
                "inferenceDepth property to a higher value.");
        }
    }

    /**
     * Import the given Javascript object into the engine. Scalar values and arrays as facts,
     * functions as rules. Once the object is imported, launches the inference on all rules if
     * specified.
     * 
     * @param {String}  path    The path where the object will be imported.
     * @param {Object}  obj     The object to import.
     */
    async import(path, obj) {
        this._busy = true;
        try {
            await _import.call(this, path, obj);
            await this.infer();
        }
        finally {
            this._busy = false;
        }
    }

    /**
     * Export internal facts from the given optional path as a JSON object that does not include 
     * rules.
     * 
     * @param {String} path Optional, default "/". The path to export as an object.
     * 
     * @returns {object} a JSON object representation of the engine internal state.
     */
    async export(path) {
        let targetPath = path || "/";
        if (!targetPath.startsWith("/")) {
            targetPath = `/${targetPath}`;
        }
        let obj = {};
        for (const [key, value] of this._facts) {
            if (key.startsWith(targetPath)) {
                let subkeys = key
                    .substring(targetPath.length)
                    .replace("/", " ")
                    .trim()
                    .split(" ");
                _deepSet(obj, subkeys, value);
            }
        }
        return obj;
    }


    /**
     * Exports the set of changes from the last inference.
     * 
     * @returns a JSON object containing the cumulative changes.
     */
    async exportChanges() {
        let obj = {};
        for (const key of this._changes) {
            let subkeys = key
                .replace("/", " ")
                .trim()
                .split(" ");
            _deepSet(obj, subkeys, this._facts.get(key));
        }
        this._changes.clear();
        return obj;
    }

    /**
     * Clear changes.
     */
    async clear() {
        this._changes.clear();
    }
}



// Private

async function _import(path, obj) {
    if (typeof path === "object") {
        return await _import.call(this, "/", path);
    }

    let targetPath = path;
    if (path.endsWith("/")) {
        targetPath = path.substring(0, path.length-1);
    }

    this._logger.log("debug", {
        action: "import", 
        object: obj
    });

    // Set an object that needs to be handled like scalar value.
    if (obj instanceof Date || obj instanceof Array) {
        return await this.set(targetPath, obj);
    }

    const objtype = typeof obj;

    // Handle rules as they come by.
    if (objtype === "function") {
        return await this.addRule(targetPath, obj);
    }

    // Set scalar value
    if (objtype !== "object") {
        return await this.set(targetPath, obj);
    }

    // Drill down into the object to add other facts and rules.
    for (let member in obj) {
        await _import.call(this, 
            `${targetPath}/${member}`, 
            obj[member]);
    }
}

function _addToAgenda(factName) {
    if (this._relations.has(factName)) {
        let rules = this._relations.get(factName);
        rules.forEach(ruleName => {
            this._agenda.set(ruleName, this._rules.get(ruleName));
            this._logger.log("debug", {
                action: "addToAgenda",
                rule: ruleName
            });
        });
    }
}

function _deepSet(target, keys, value) {
    let key = keys[0];
    if (keys.length === 1) {
        target[key] = value;
        return;
    }
    if (typeof target[key] === "undefined") {
        target[key] = {};
    }
    _deepSet(target[key], keys.slice(1), value)
}
