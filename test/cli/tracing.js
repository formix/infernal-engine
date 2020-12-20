//const InfernalEngine = require("infernal-engine");
const InfernalEngine = require("../../lib/index");
const model = require("../models/critterModel");

(async () => {
    let engine = new InfernalEngine(null, 
        msg => console.log("-> ", JSON.stringify(msg)));
    
    console.log("Importing the critterModel:");
    await engine.import(model);
    
    console.log("Initial facts:")
    let initialModel = await engine.export();
    console.log(JSON.stringify(initialModel, null, "  "));
    
    console.log("Importing two facts to be asserted:");
    await engine.import({
        sound: "croaks",
        eats: "flies"
    })
    
    console.log("Inferred facts:")
    let inferredModel = await engine.export();
    console.log(JSON.stringify(inferredModel, null, "  "));
})();
