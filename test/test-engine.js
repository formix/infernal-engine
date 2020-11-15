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
            let i = engine.get("i");
            assert.deepStrictEqual(i, 7);
            let i2 = engine.get("/i");
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


            // engine.addRule("sub/rule", async (x /*@ ../rootx */) => {}); // parent path
        });

        it("shall add multiple fact-rule relations given multiple parameters.", async () => {
            let engine = new InfernalEngine();
            engine.addRule("rule", async (i, a, b) => {}); // multiple local facts
            assert.deepStrictEqual(engine._relations.get("/i").has("/rule"), true,
                "The relation between the fact '/i' and the rule '/rule' was not properly established.");
            assert.deepStrictEqual(engine._relations.get("/a").has("/rule"), true,
                "The relation between the fact '/a' and the rule '/rule' was not properly established.");
            assert.deepStrictEqual(engine._relations.get("/b").has("/rule"), true,
                "The relation between the fact '/b' and the rule '/rule' was not properly established.");
        });

        it("shall add a rule referenceing a fact with a specified path", async () => {
            let engine = new InfernalEngine();
            engine.addRule("rule", async (/*@ /another/path */ x) => {});
            assert.deepStrictEqual(engine._relations.get("/another/path").has("/rule"), true,
                "The relation between the fact '/another/path' and the rule '/rule' was not properly established.");
        });

        it("shall add a rule referenceing a fact with a specified path for multiple parameters", async () => {
            let engine = new InfernalEngine();
            engine.addRule("rule", async (/*@ /another/path */ x, /*@ /some/other/path */ y) => {});
            assert.deepStrictEqual(engine._relations.get("/another/path").has("/rule"), true,
                "The relation between the fact '/another/path' and the rule '/rule' was not properly established.");
            assert.deepStrictEqual(engine._relations.get("/some/other/path").has("/rule"), true,
                "The relation between the fact '/some/other/path' and the rule '/rule' was not properly established.");
        });

        it("shall add a rule referenceing a fact with a specified complex path", async () => {
            let engine = new InfernalEngine();
            engine.addRule("/a/another/path/rule", async (/*@ ../.././some/./fact */ x) => {});
            assert.deepStrictEqual(engine._relations.get("/a/some/fact").has("/a/another/path/rule"), true,
                "The relation between the fact '/a/some/fact' and the rule '/a/another/path/rule' was not properly established.");
        });

    });

    describe("#infer", () => {

        it("shall count up or down to 5.", async () => {
            let engine = new InfernalEngine();
            engine.addRule("count5", async (i) => {
                if (i < 5) {
                    return { "i": i + 1 };
                } else if (i > 5) {
                    return { "i": i - 1 };
                }
            });
            await engine.set("i", 9);
            assert.deepStrictEqual(engine.get("i"), 5);
        });

    });
});