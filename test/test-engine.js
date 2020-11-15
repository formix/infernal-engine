const InfernalEngine = require("../lib/index");
const assert = require("assert");


describe("InfernalEngine", async() => {

    describe("#set", async () => {
        let engine = new InfernalEngine();
        it("setting the value 'i' shall add a new fact '/i' in the engine.", async () => {
            let engine = new InfernalEngine();
            await engine.set("i", 5, false);
            assert.deepStrictEqual(engine._facts.has("/i"), true);
            assert.deepStrictEqual(engine._changes.size, 1);
        });
        it("setting the value '/i' shall change the xisting fact '/i' in the engine.", async () => {
            let engine = new InfernalEngine();
            await engine.set("/i", 0, false);
            assert.deepStrictEqual(engine._facts.get("/i"), 0);
            assert.deepStrictEqual(engine._changes.size, 1);
        });
    });

    describe("#get", () => {
        it("shall get an existing fact from the engine.", async () => {
            let engine = new InfernalEngine();
            await engine.set("i", 7, false);
            let i = await engine.get("i");
            assert.deepStrictEqual(i, 7);
            let i2 = await engine.get("/i");
            assert.deepStrictEqual(i2, 7);
        });
    });


    describe("#addRule", () => {
        it("shall add a rule and interpret the parameters correctly.", async () => {
            let engine = new InfernalEngine();
            engine.addRule("rule1", async (i) => {});
            assert.deepStrictEqual(engine._rules.has("/rule1"), true,
                "The rule '/rule1' was not added to the internal ruleset.");
            assert.deepStrictEqual(engine._relations.get("/i").has("/rule1"), true,
                "The relation between the fact '/i' and the rule '/rule1' was not properly established.");

            engine.addRule("s/rule", async (i) => {});
            assert.deepStrictEqual(engine._rules.has("/s/rule"), true,
            "The rule '/s/rule' was not added to the internal ruleset.");
            assert.deepStrictEqual(engine._relations.get("/s/i").has("/s/rule"), true,
            "The relation between the fact '/s/i' and the rule '/s/rule' was not properly established.");


            // engine.addRule("rule2", async (i, a, b) => {}); // multiple local facts
            // engine.addRule("rule3", async (x /*@ /another/path */) => {}); // one different path fact
            // engine.addRule("rule4", async (x /*@ /another/path */, y /*@ /some/other/path */) => {}); // two different path fact
            // engine.addRule("sub/rule", async (x /*@ ../x */) => {}); // parent path
        });
    });
});