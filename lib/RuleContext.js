/**
 * This class is not exposed. Put a rule into its context to streamling rule execution.
 */
module.exports = class RuleContext {

    engine = null;
    rule = null;
    context = null;
    facts = [];

    /**
     * Create an instance of the rule context with the engine, rule and context.
     * 
     * @param {*} engine The parent InfernalEngine
     * @param {*} rule  The rule to execute.
     * @param {*} context The context of the rule.
     */
    constructor(engine, rule, context) {
        this.engine = engine || this.engine;
        this.context = context || this.context;
        this.rule = rule;
    }

    /**
     * Execute the rule within its context, passing in fact parameters and returning the 
     * resulting object to their respective contextualized facts.
     */
    async execute(path) {
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
            for (let key in result) {
                if (!result.hasOwnProperty(key)) continue;

                if (!key.startsWith("#")) {
                    let path = key.startsWith("/") ? key : this.context + key;
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

