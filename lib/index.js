
const utils = require("./utils");
const Fact = require("./fact");


class InfernalEngine {

    _facts = new Map();
    _rules = new Map();
    _relations = new Map();
    _changes = new Set();
    _timeout = 5000;

    constructor(timeout) {
        if (timeout) {
            this._timeout = timeout;
        }
    }

    /**
     * Return the fact value.
     * 
     * @param {String} path The full path to the desired fact.
     * 
     * @returns {Promise<*>} The fact value.
     */
    async get(path) {
        let factpath = path.startsWith("/") ? path : `/${path}`;
        return Promise.resolve(this._facts.get(factpath));
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
        var oldValue = this._facts.get(factpath);
        if (!utils.equals(oldValue, value)) {
            this._changes.add(factpath);
            this._facts.set(factpath, value);

            if (this._trace && !this._infering) {
                process.nextTick((function() {
                    this._trace({
                        action: "set",
                        fact: factpath,
                        oldValue: oldValue,
                        newValue: value
                    });
                }).bind(this));
            }

            _addToAgenda.call(this, factpath);

            if (!doNotInfer) {
                await this.infer();
            }
        }
        return Promise.resolve();
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
        let rulepath = path.startsWith("/") ? path : `/${path}`;;
        this._rules.set(rulepath, {
            run: rule,
            inputFacts: []
        });
    
        let parameters = utils.parseParameters(rule);
        let context = utils.popName(rulepath);
        for (const param of parameters) {
            let factpath = context + param;
            if (!this._relations.has(factpath)) {
                this._relations.set(factpath, new Set());
            }
            this._relations.get(factpath).add(rulepath);
            this._rules.get(rulepath).inputFacts.push(factpath);
        }
    
        if (this._trace) {
            this._trace({action: "addRule", rule: rulepath});
        }
    }

    /**
     * Execute inference and return a promise.
     * 
     * @returns {Promise} A promise.
     */
    async infer() {
    }

    /**
     * Import the given object into the engine. Scalar values as facts, functions as rules and
     * arrays as exploded arrays. Once the object is imperted, launches the inference if desired.
     * 
     * @param {Object} obj The object to import.
     * @param {String} path The path where the object will be imported.
     * @param {Boolean} doInfer Tell if the inference has to be launched after importing the object.
     */
    async import(obj, path, doInfer) {
        if (typeof this._trace === "function") {
            process.nextTick((function() {
                this._trace({action: "load"});
            }).bind(this));
        }
        _applyFacts.call(this, path, obj, true);
        await this.infer();
    }

    /**
     * Export all the internal facts as a JSON object that does not include rules.
     * 
     * @returns {object} a JSON object representation of the engine internal state.
     */
    export() {
    }
}



// Private

function _addToAgenda(factName) {
    if (this._relations.has(factName)) {
        var rules = this._relations.get(factName);
        for (var ruleName in rules) {
            this._agenda.set(ruleName, new EngineProxy(this, ruleName));
            if (this._trace) {
                let localRule = ruleName;
                process.nextTick((function() {
                    this._trace({
                        action: "addToAgenda",
                        rule: localRule
                    });
                }).bind(this));
            }
        }
    }
}

// has to be split into "import rules" and "import facts".
function _applyFacts(context, source, loading) {
    var sourceType = typeof source;
    if ((sourceType === "object") && (source instanceof Date)) {
        sourceType = "date";
    }
    
    if ((sourceType === "object") && (source instanceof Array)) {
        sourceType = "array";
    }
    
    if (sourceType === "function") {
        if (!loading) {
            return;
        } else {
            this.addRule(context, source);
        }

    } else if (sourceType === "object") {
        for (var property in source) {
            _applyFacts.call(this, context + "/" + property, source[property], loading);
        }

    } else {
        this.set(context, source);
    }
}



module.exports = InfernalEngine;
