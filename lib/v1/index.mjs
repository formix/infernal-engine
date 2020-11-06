
import utils from "./utils.mjs";
import Fact from "./fact.mjs"


export class InfernalEngine {

    _facts = new Map();
    _rules = new Map();
    _relations = new Map();
    _changes = new Map();
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
     * @returns {*} The fact value.
     */
    get(path) {
        let factpath = path.startsWith("/") ? path : `/${path}`;
        var fact = utils.digPath.call(this, this._facts, factpath);
        if (fact === undefined) {
            return undefined;
        }
        return fact.data[fact.name];
    }

    /**
     * Sets the fact to the given value.
     * 
     * @param {String} path The full path to the desired fact.
     * @param {*} value The fact value to set.
     * @param {Boolean} doNotInfer Do not launch inference after changing the internal state.
     * 
     * @returns {Promise} A promise that resolve after the inference is done.
     */
    async set(path, value, doNotInfer) {
        let factpath = path.startsWith("/") ? path : `/${path}`;
        var oldValue = this.get(factpath);
        if (!utils.equals(oldValue, value)) {
            var fact = utils.digPath.call(this, this._facts, factpath, true);
            
            if (this._changes) {
                this._changes.set(fact.fullName, value);
            }
    
            var oldValue = fact.data[fact.name];
            fact.data[fact.name] = value;
            
            if ((typeof this._trace === "function") && !this._infering) {
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
     * @param {Function} rule The rule to add.
     * 
     * @returns {InfernalEngine} The current InfernalEngine for method chaining.
     */
    addRule(path, rule) {
        let rulepath = path.startsWith("/") ? path : `/${path}`;;
        this._rules.set(rulepath, {
            run: rule,
            inputFacts: []
        });
    
        let parameters = utils.parseParameters(rule);
        let context = utils.getContext("/", rulepath);
        for (const param of parameters) {
            let factpath = utils.getFullName(context, param);
            if (!this._relations.has(factpath)) {
                this._relations.set(factpath, new Map());
            }
            this._relations.get(factpath).set(rulepath, true);
            this._rules.get(rulepath).inputFacts.push(factpath);
        }
    
        if (typeof this._trace === "function") {
            this._trace({action: "addRule", rule: rulepath});
        }
    
        return this;    
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
    if (this._relations[factName] !== undefined) {
        var rules = this._relations[factName];
        for (var ruleName in rules) {
            if (rules.hasOwnProperty(ruleName) && 
                    (typeof this._agenda[ruleName] === "undefined")) {
                this._agenda[ruleName] = new EngineProxy(this, ruleName);
                if (typeof this._trace === "function") {
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