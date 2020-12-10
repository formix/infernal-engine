
module.exports = class RuleContext {

    engine = null;
    inputFacts = []
    outputContext = "/";
    run = async () => {};

    constructor(engine, runnable, outputContext) {
        this.engine = engine || this.engine;
        this.outputContext = outputContext || this.outputContext;
        this.run = runnable || this.run;
    }

    async execute() {
        let params = [];
        this.inputFacts.forEach(inputFact => {
            params.push(this.engine.get(inputFact));
        });
        let outputFacts = await this.run.apply(null, params);
        if (outputFacts) {
            for (let outputFactKey in outputFacts) {
                if (!outputFacts.hasOwnProperty(outputFactKey)) continue;
                let outputFact = outputFactKey.startsWith("/") 
                    ? outputFactKey 
                    : this.outputContext + outputFactKey;
                await this.engine.set(outputFact, outputFacts[outputFactKey], true);
            }
        }
    }
}

