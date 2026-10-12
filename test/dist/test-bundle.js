const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Smoke tests for the webpack bundle. Run "npm run dist" first, then
// "npm run test:dist".
const bundlePath = path.join(__dirname, "../../dist/infernal-engine.js");

async function countTo5(InfernalEngine) {
    let engine = new InfernalEngine();
    await engine.def("count5", async i => {
        if (typeof i !== "undefined" && i < 5) {
            return { "i": i + 1 };
        }
    });
    await engine.assert("i", 1);
    return await engine.peek("i");
}

describe("dist/infernal-engine.js", () => {

    it("shall load as a CommonJS module.", async () => {
        const InfernalEngine = require(bundlePath);
        assert.deepStrictEqual(await countTo5(InfernalEngine), 5);
    });

    it("shall expose the InfernalEngine global when loaded with a script tag.", async () => {
        const window = {};
        vm.createContext(window);
        vm.runInContext(fs.readFileSync(bundlePath, "utf8"), window);
        assert.deepStrictEqual(typeof window.InfernalEngine, "function");
        assert.deepStrictEqual(await countTo5(window.InfernalEngine), 5);
    });

});
