const infernalUtils = require("./infernalUtils");

/**
 * This class is not exposed. Put a rule into its context to streamline rule execution.
 */
class RuleContext {

    engine = null;
    rule = null;
    path = null;
    facts = [];

    /**
     * Creates an instance of the rule context with the engine, the rule and its path.
     * 
     * @param {InfernalEngine} engine The parent InfernalEngine
     * @param {Function} rule  The rule to execute.
     * @param {String} path The path of the rule.
     */
    constructor(engine, rule, path) {
        this.engine = engine || this.engine;
        this.path = path || this.path;
        this.rule = rule;
    }

    /**
     * Execute the rule within its context returning the 
     * resulting object to their respective contextualized facts.
     */
    async execute() {
        let params = [];
        this.facts.forEach(inputFact => {
            params.push(this.engine._facts.get(inputFact));
        });

        if(this.engine._trace) {
            this.engine._trace({
                action: "execute",
                rule: path,
                inputs: params
            });
        }

        let result = await this.rule.apply(null, params);
        if (result) {
            let context = infernalUtils.getContext(this.path);
            for (let key in result) {
                if (!result.hasOwnProperty(key)) continue;

                if (!key.startsWith("#")) {
                    let path = key.startsWith("/") ? key : context + key;
                    let value = result[key];
                    let valueType = typeof value;
                    if (valueType === "object") {
                        await this.engine.import(value, path);
                    } 
                    else if (valueType === "function") {
                        await this.engine.defRule(path, value);
                    }
                    else {
                        await this.engine.assert(path, value);
                    }
                    continue;
                }

                let action = result[key];
                switch (key) {

                    case "#assert":
                        await this.engine.assert(action.path, action.value);
                        break;
                        
                    case "#retract":
                        await this.engine.retract(action.path);
                        break;

                    case "#defRule":
                        await this.engine.defRule(action.path, action.value);
                        break;

                    case "#undefRule":
                        await this.engine.undefRule(action.path);
                        break;

                    case "#import":
                        await this.engine.import(action.value, action.path);
                        break;

                    default:
                        throw new Error(`Invalid action: '${key}'.`);
                }
            }
        }
    }
}

module.exports = RuleContext;