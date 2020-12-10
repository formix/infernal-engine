
const utils = require("./utils");
const Fact = require("./fact");
const RuleContext = require("./RuleContext");


class InfernalEngine {

    _facts = new Map();
    _rules = new Map();
    _relations = new Map();
    _inferenceDepth = 50;
    _agenda = new Map();
    _changes = new Set();


    constructor(inferenceDepth) {
        if (inferenceDepth) this._inferenceDepth = inferenceDepth;
    }

    /**
     * Return the fact's value.
     * 
     * @param {String} path The full path to the desired fact.
     * 
     * @returns {Promise<*>} The fact value.
     */
    get(path) {
        let factpath = path.startsWith("/") ? path : `/${path}`;
        let compiledpath = utils.compilePath(factpath);
        return this._facts.get(compiledpath);
    }

    /**
     * Sets the fact to the given value.
     * 
     * @param {String} path The full path to the desired fact.
     * @param {*} value The fact value to set, must be a scalar.
     * @param {Boolean} doNotInfer Do not launch inference after changing the internal state.
     */
    async set(path, value, doNotInfer) {
        let factpath = path.startsWith("/") ? path : `/${path}`;
        let compiledpath = utils.compilePath(factpath);
        var oldValue = this._facts.get(compiledpath);

        // Nothing to do if both values are equals, except if it is an array.
        // When setting an array, we consider the value changed without actually
        // comparing the arrays content assuming that executing the matching
        // rule is faster.
        if (!(value instanceof Array) && utils.equals(oldValue, value)) return;

        // TODO: Change to a Map! (key == path, value = oldValue)
        this._changes.add({
            path: compiledpath, 
            oldValue: oldValue, 
            newValue: value
        });
        this._facts.set(compiledpath, value);

        // if (this._trace && !this._infering) {
        //     process.nextTick((function() {
        //         this._trace({
        //             action: "set",
        //             fact: compiledpath,
        //             oldValue: oldValue,
        //             newValue: value
        //         });
        //     }).bind(this));
        // }

        _addToAgenda.call(this, compiledpath);
        if (!doNotInfer) {
            await this.infer();
        }
    }

    /**
     * Sets all the facts then start the inference.
     * 
     * @param {Array.<Fact>} facts the array facts to set in the inference engine.
     */
    async setall(facts) {
        let me = this;
        facts.forEach(fact => me.set(fact.Path, fact.Value, true))
        await this.infer();
    }


    /**
     * Add a rule to the engine's ruleset.
     * 
     * @param {String} path The path where to save the rule at.
     * @param {Function} rule The rule to add. Must be async.
     */
    addRule(path, rule) {
        let rulepath = path.startsWith("/") ? path : `/${path}`;
        let compiledRulepath = utils.compilePath(rulepath);
        let context = utils.getContext(compiledRulepath);
        this._rules.set(compiledRulepath, new RuleContext(this, rule, context));
    
        let parameters = utils.parseParameters(rule);
        for (const param of parameters) {
            let factpath = param.startsWith("/") ? param : context + param;
            let compiledFactpath = utils.compilePath(factpath);
            if (!this._relations.has(compiledFactpath))
                this._relations.set(compiledFactpath, new Set());
            this._relations.get(compiledFactpath).add(compiledRulepath);
            this._rules.get(compiledRulepath).inputFacts.push(compiledFactpath);
        }
    
        // if (this._trace) {
        //     this._trace({action: "addRule", rule: compiledRulepath});
        // }
    }

    /**
     * Execute inference and return a promise.
     * 
     * @returns {Promise} A promise.
     */
    async infer() {
        let depth = 0;
        while (depth < this._inferenceDepth && this._agenda.size > 0) {
            let currentAgenda = this._agenda;
            this._agenda = new Map();
            for (const [_, rulectx] of currentAgenda) {
                await rulectx.execute();
            }
            depth++;
        }
        if (depth == this._inferenceDepth) {
            throw new Error("Inference not completed because maximum depth " +
                `reached (${this._inferenceDepth}). Please review for infinite loop or set the ` +
                "inferenceDepth property to a higher value.");
        }
    }

    /**
     * Import the given Javascript object into the engine. Scalar values as facts, functions as 
     * rules. Once the object is imported, launches the inference on all rules if specified.
     * 
     * @param {String}  path       The path where the object will be imported.
     * @param {Object}  obj        The object to import.
     * @param {Boolean} doNotInfer Optional, default false. Tell if the inference has to be 
     *                             launched or not after importing the object.
     * @param {Number}  _level     The current level of importation. Used to control when to 
     *                             trigger the inference. Shall not be set by the caller.
     */
    async import(path, obj, doNotInfer, _level) {
        if (typeof path === "object") {
            await this.import("/", path);
            return;
        }

        let targetPath = path;
        if (path.endsWith("/")) targetPath = path.substring(0, path.length-1);
        if (typeof _level === "undefined") _level = 0;

        // if (typeof this._trace === "function") {
        //     process.nextTick((function() {
        //         this._trace({action: "import", object: obj});
        //     }).bind(this));
        // }

        // Set an object that needs to be handled like scalar value.
        if (obj instanceof Date || obj instanceof Array) {
            await this.set(targetPath, obj, true);
            return;
        }

        const objtype = typeof obj;

        // Handle rules as they come by.
        if (objtype === "function") {
            this.addRule(targetPath, obj);
            return;
        }

        // Set scalar value
        if (objtype !== "object") {
            await this.set(targetPath, obj, true);
            return;
        }

        // Drill down into the object to add other facts and rules.
        for (let member in obj) {
            await this.import(`${targetPath}/${member}`, obj[member], true, _level + 1);
        }

        if (_level === 0) {
            if (doNotInfer) this.clear();
            else await this.infer();
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
    export(path) {
        let targetPath = typeof path === "undefined" ? "/" : path;
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
     * Clear the agenda and any changes from a previous inference.
     */
    clear() {
        this._agenda.clear();
        this._changes.clear();
    }
}



// Private

function _addToAgenda(factName) {
    if (this._relations.has(factName)) {
        let rules = this._relations.get(factName);
        rules.forEach(ruleName => {
            this._agenda.set(ruleName, this._rules.get(ruleName));
            // if (this._trace) {
            //     let localRule = ruleName;
            //     process.nextTick((function() {
            //         this._trace({
            //             action: "addToAgenda",
            //             rule: localRule
            //         });
            //     }).bind(this));
            // }
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



module.exports = InfernalEngine;
