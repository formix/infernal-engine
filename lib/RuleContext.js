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
        this.engine._trace({
            action: "execute",
            rule: path,
            inputs: params
        });
        let outputFacts = await this.rule.apply(null, params);
        if (outputFacts) {
            for (let outputFactKey in outputFacts) {
                if (!outputFacts.hasOwnProperty(outputFactKey)) continue;
                let outputFact = outputFactKey.startsWith("/") 
                    ? outputFactKey 
                    : this.context + outputFactKey;
                await this.engine.assert(outputFact, outputFacts[outputFactKey]);
                // TODO: add #assert, #defRule, #undefRule and #import, default to #assert(key,value)
                // If the key starts with #, expects the value to be {path: "path", value: obj}
            }
        }
    }
}

