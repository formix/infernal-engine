
import utils from "./utils";


export { InfernalEngine };


class InfernalEngine {

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
     * Sets the fact to the given value. If the value is an array, explodes it into as
     * many indexed facts.
     * 
     * @param {String} path The full path to the desired fact.
     * @param {*} value  The fact value to set.
     */
    set(path, value) {
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
    
            // Auto infer...
            // if (callback) {
            //     this.infer((function(err) {
            //         if (err) {
            //             callback(err);
            //             return;
            //         }
            //         callback(null, this.getChanges());
            //     }).bind(this));
            // }
        }
    
        return this;
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
     * arrays as exploded arrays.
     * 
     * @param {Object} obj The object to import.
     * @param {String} path The path where the object will be imported.
     */
    import(obj, path) {
    }

    /**
     * Export all the internal facts as a JSON object. Do not include rules. Exploded arrays are
     * merged back into arrays.
     * 
     * @returns {object} a JSON object representation of the engine internal state.
     */
    export() {
    }
}





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