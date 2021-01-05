
const infernalUtils = require("./infernalUtils");
const RuleContext = require("./RuleContext");
const util = require("util");
const Fact = require("./Fact");


/**
 * This is the inference engine class.
 */
class InfernalEngine {

    _busy = false;
    _facts = new Map();
    _rules = new Map();
    _relations = new Map();
    _agenda = new Map();
    _changes = new Set();
    _trace = null;
    _maxGen = 50;

    /**
     * Create a new InfernalEngine instance. 
     * @param {Number} [maxGen=50] The maximum number of agenda generation
     *                        when executing inference. 
     * @param {Function=} trace A tracing function that will be called with a trace
     *                          object parameter.
     */
    constructor(maxGen, trace) {
        this._maxGen = maxGen || 50;
        this._trace = trace;
    }

    /**
     * Returns the fact value for a given path.
     * @param {String} path The full path to the desired fact.
     * @return {Promise<*>} The fact value.
     */
    async peek(path) {
        let factpath = path.startsWith("/") ? path : `/${path}`;
        let compiledpath = infernalUtils.compilePath(factpath);
        return this._facts.get(compiledpath);
    }

    /**
     * Asserts a new fact or update an existing fact for the given path with
     * the provided value. Asserting a fact with an undefined value will 
     * retract the fact if it exists.
     * @param {String} path The full path to the desired fact.
     * @param {*} value The fact value to set, must be a scalar.
     */
    async assert(path, value) {
        let factpath = path.startsWith("/") ? path : `/${path}`;
        let compiledpath = infernalUtils.compilePath(factpath);
        var oldValue = this._facts.get(compiledpath);

        if (!(value instanceof Array) && infernalUtils.equals(oldValue, value)) {
            // GTFO if the value is not an array and the received scalar value does not change
            // the fact value.
            return;
        }

        let action = "assert";
        if (value !== undefined) {
            this._facts.set(compiledpath, value);
        }
        else {
            if (!this._facts.has(compiledpath)) {
                // the fact does not exist.
                if (this._trace) {
                    this._trace({
                        action: "retract",
                        warning: `Cannot retract undefined fact '${compiledpath}'.`
                    });
                }
                return;
            }
            action = "retract";
            this._facts.delete(compiledpath);
            this._relations.delete(compiledpath);
        }

        if (this._trace) {
            this._trace({
                action: action,
                fact: compiledpath,
                oldValue: oldValue,
                newValue: value
            });
        }

        // If the path do not reference a meta-fact
        if (!compiledpath.startsWith("/$")) {
            this._changes.add(compiledpath);
            _addToAgenda.call(this, compiledpath);
            if (!this._busy) {
                await _infer.call(this);
            }
        }
    }

    /**
     * Asserts all recieved facts.
     * @param {Array<Fact>} facts A list of facts to assert at in one go.
     */
    async assertAll(facts) {
        if (!(facts instanceof Array)) {
            throw new Error("The 'facts' parameter must be an Array.");
        }
        if (facts.length === 0) {
            return;
        }
        this._busy = true;
        try {
            for (const fact of facts) {
                if (!(fact instanceof Fact)) {
                    throw new Error("The asserted array must contains objects of type Fact only.");
                }
                await this.assert(fact.path, fact.value);
            }
        }
        finally {
            this.busy = false;
        }
        await _infer.call(this);
    }

    /**
     * Retracts a fact or multiple facts recursively if the path ends with '/*'.
     * @param {String} path The path to the fact to retract.
     */
    async retract(path) {
        if (!path.endsWith("/*")) {
            await this.assert(path, undefined);
            return;
        }

        let factpath = path.startsWith("/") ? path : `/${path}`;
        let compiledPath = infernalUtils.compilePath(factpath);
        let pathPrefix = compiledPath.substr(0, compiledPath.length - 1);
        for (const [factPath, _] of this._facts) {
            if (!factPath.startsWith(pathPrefix)) continue;
            await this.assert(factPath, undefined);
        }
    }

    /**
     * Add a rule to the engine's ruleset and launche the inference.
     * @param {String} path The path where to save the rule at.
     * @param {Function} rule The rule to add. Must be async.
     */
    async defRule(path, rule) {
        if (!util.types.isAsyncFunction(rule)) {
            throw new Error("The rule parameter must be an async function.");
        }
        
        let rulepath = path.startsWith("/") ? path : `/${path}`;
        let compiledRulepath = infernalUtils.compilePath(rulepath);
        let context = infernalUtils.getContext(compiledRulepath);

        if (this._rules.has(compiledRulepath)) {
            throw new Error(`Can not define the rule '${compiledRulepath}' because it ` +
                "already exist. Call 'undefRule' or change the rule path.");
        }

        let ruleContext = new RuleContext(this, rule, compiledRulepath)
        let parameters = infernalUtils.parseParameters(rule);
        for (const param of parameters) {
            let factpath = param.startsWith("/") ? param : context + param;
            let compiledFactpath = infernalUtils.compilePath(factpath);
            if (!this._relations.has(compiledFactpath))
                this._relations.set(compiledFactpath, new Set());
            this._relations.get(compiledFactpath).add(compiledRulepath);
            ruleContext.facts.push(compiledFactpath);
        }
        
        this._rules.set(compiledRulepath, ruleContext);
        if (this._trace) {
            this._trace({
                action: "defRule", 
                rule: compiledRulepath,
                inputFacts: ruleContext.facts.slice()
            });
        }

        this._agenda.set(compiledRulepath, ruleContext);
        if (this._trace) {
            this._trace({
                action: "addToAgenda",
                rule: path
            });
        }

        if (!this._busy) {
            await _infer.call(this);
        }
    }

    /**
     * Undefine a rule at the given path or a group of rules if the path ends with '/*'.
     * @param {String} path The path to the rule to be undefined.
     */
    async undefRule(path) {
        let rulepath = path.startsWith("/") ? path : `/${path}`;
        let compiledRulepath = infernalUtils.compilePath(rulepath);

        if (!compiledRulepath.endsWith("/*")) {
            _deleteRule.call(this, compiledRulepath);
            return;
        }

        let pathPrefix = compiledRulepath.substr(0, compiledRulepath.length - 1);
        for (const [path, _] of this._rules) {
            if (!path.startsWith(pathPrefix)) continue;
            _deleteRule.call(this, path);
        }
    }

    /**
     * Import the given Javascript object into the engine. Scalar values and arrays as facts,
     * functions as rules. Launches the inference on any new rules and any existing rules
     * triggered by importing the object facts. Infers only when eveything have been imported.
     * @param {Object}  obj     The object to import.
     * @param {String}  context The path where the object will be imported.
     */
    async import(obj, context) {
        if (this._trace) {
            this._trace({
                action: "import", 
                object: obj
            });
        }
        let superBusy = this._busy; // true when called while infering.
        this._busy = true;
        try {
            await _import.call(this, obj, context || "");
            if (!superBusy) {
                // not already infering, start the inference.
                await _infer.call(this);
            }
        }
        finally {
            if (!superBusy) {
                // Not already infering, reset the busy state.
                this._busy = false;
            }
        }
    }

    /**
     * Export internal facts from the given optional path as a JSON object. Do not export rules.
     * @param {String} [context="/"] The context to export as an object.
     * @return {object} a JSON object representation of the engine internal state.
     */
    async export(context) {
        let targetContext = context || "/";
        if (!targetContext.startsWith("/")) {
            targetContext = `/${targetContext}`;
        }
        let obj = {};
        for (const [key, value] of this._facts) {
            if (key.startsWith(targetContext)) {
                let subkeys = key
                    .substring(targetContext.length)
                    .replace(/\//g, " ")
                    .trim()
                    .split(" ");
                _deepSet(obj, subkeys, value);
            }
        }
        return obj;
    }


    /**
     * Exports all changed facts since the last call to exportChanges or
     * [reset]{@link InfernalEngine#reset} as a Javascript object. Reset the change tracker.
     * @return a JSON object containing the cumulative changes since last call.
     */
    async exportChanges() {
        let obj = {};
        for (const key of this._changes) {
            let subkeys = key
                .replace(/\//g, " ")
                .trim()
                .split(" ");
            _deepSet(obj, subkeys, this._facts.get(key));
        }
        this._changes.clear();
        return obj;
    }

    /**
     * Resets the change tracker.
     */
    async reset() {
        this._changes.clear();
    }

    /**
     * Create a new Fact with the given path and value.
     * @param {string} path Mandatory path of the fact.
     * @param {any} value Value of the fact, can be 'undefined' to retract the given fact.
     */
    static fact(path, value) {
        return new Fact(path, value);
    }

}



// Private


function _deleteRule(path) {
    if (this._trace) {
        this._trace({
            action: "undefRule", 
            rule: path
        });
    }
    this._rules.delete(path);

    // TODO: Target relations using the rule's parameter instead of looping blindly.
    for (const [_, rules] of this._relations) {
        rules.delete(path);
    }
}

 // Execute inference and return a promise. At the begining of the inference, sets the 
 // '/$/maxGen' fact to make it available to rules that would be interested in this value.
 // Upon each loop, the engine sets the '/$/gen' value indicating the agenda generation the
 // inference is currently at.
async function _infer() {
    if (this._trace) {
        this._trace({
            action: "infer",
            maxGen: this._maxGen
        });
    }

    this._busy = true;
    let gen = 0;
    this._facts.set("/$/maxGen", this._maxGen); //metafacts do not trigger rules

    try {
        while (gen < this._maxGen && this._agenda.size > 0) {
            gen++;
            this._facts.set("/$/gen", gen); // metafacts do not trigger rules
            if (this._trace) {
                this._trace({
                    action: "executeAgenda",
                    gen: gen,
                    ruleCount: this._agenda.size
                });
            }
            let currentAgenda = this._agenda;
            this._agenda = new Map();
            for (const [_, rulectx] of currentAgenda) {
                await rulectx.execute();
            }
        }
    }
    finally {
        this._busy = false;
    }

    if (gen == this._maxGen) {
        throw new Error("Inference not completed because maximum depth " +
            `reached (${this._maxGen}). Please review for infinite loop or set the ` +
            "maxDepth property to a larger value.");
    }
}


async function _import(obj, context) {
    let targetContext = context;
    if (context.endsWith("/")) {
        targetContext = context.substring(0, context.length-1);
    }

    // Set an object that needs to be handled like scalar value.
    if (obj instanceof Date || obj instanceof Array) {
        return await this.assert(targetContext, obj);
    }

    const objtype = typeof obj;

    // Handle rules as they come by.
    if (objtype === "function") {
        return await this.defRule(targetContext, obj);
    }

    // Set scalar value
    if (objtype !== "object") {
        return await this.assert(targetContext, obj);
    }

    // Drill down into the object to add other facts and rules.
    for (let member in obj) {
        await _import.call(this,
            obj[member],
            `${targetContext}/${member}`);
    }
}

function _addToAgenda(factName) {
    if (this._relations.has(factName)) {
        let rules = this._relations.get(factName);
        rules.forEach(ruleName => {
            this._agenda.set(ruleName, this._rules.get(ruleName));
            if (this._trace) {
                this._trace({
                    action: "addToAgenda",
                    rule: ruleName
                });
            }
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