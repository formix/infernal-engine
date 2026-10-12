const InfernalEngine = require("../lib/index");
const assert = require("assert");


describe("InfernalEngine", async() => {

    describe("#assert", async () => {
        let engine = new InfernalEngine();
        it("asserting the value 'i' shall add a new fact '/i' in the engine.", async () => {
            let engine = new InfernalEngine();
            await engine.assert("i", 5);
            assert.deepStrictEqual(engine._facts.has("/i"), true);
            assert.deepStrictEqual(engine._changes.size, 1);
        });
        it("asserting the value '/i' shall change the xisting fact '/i' in the engine.", async () => {
            let engine = new InfernalEngine();
            await engine.assert("/i", 0);
            assert.deepStrictEqual(engine._facts.get("/i"), 0);
            assert.deepStrictEqual(engine._changes.size, 1);
        });
    });

    describe("#assertAll", async () => {
        let engine = new InfernalEngine();
        it("asserting '/a', '/b' and '/c/d' all at once shall create the matching model.'", async () => {
            let engine = new InfernalEngine();
            await engine.assertAll([
                InfernalEngine.fact("a", 1),
                InfernalEngine.fact("/b", 2),
                InfernalEngine.fact("/c/d", 3)
            ]);
            let model = await engine.export();
            delete model.$;
            assert.deepStrictEqual(model, {
                a:1, b:2, c: { d: 3 }
            });
        });
    });    

    describe("#peek", () => {
        it("shall get an existing fact from the engine.", async () => {
            let engine = new InfernalEngine();
            await engine.assert("i", 7, true);
            let i = await engine.peek("i");
            assert.deepStrictEqual(i, 7);
            let i2 = await engine.peek("/i");
            assert.deepStrictEqual(i2, 7);
        });
    });

    describe("#retract", () => {
        it("shall retract a single fact from the engine.", async () => {
            let engine = new InfernalEngine();
            await engine.assert("i", 7, true);
            assert.deepStrictEqual(await engine.peek("i"), 7);
            await engine.retract("i");
            assert.deepStrictEqual(await engine.peek("i"), undefined);
        });

        it("shall retract all facts from the given path prefix.", async () => {
            let engine = new InfernalEngine();
            let model = {
                a: "a",
                b: 1,
                c: true,
                d: {
                    x: "23",
                    y: 42,
                    z: 5.5
                },
            };
            await engine.import(model);
            await engine.retract("/d/*");
            let expectedFacts = {
                a: "a",
                b: 1,
                c: true
            };
            let actualFacts = await engine.export();
            delete actualFacts.$;
            assert.deepStrictEqual(actualFacts, expectedFacts);
        });

    });

    describe("#def", () => {
        it("shall add a rule and interpret the parameters correctly.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule1", async function(i) {});
            assert.deepStrictEqual(engine._rules.has("/rule1"), true,
                "The rule '/rule1' was not added to the internal ruleset.");
            assert.deepStrictEqual(engine._relations.get("/i").has("/rule1"), true,
                "The relation between the fact '/i' and the rule '/rule1' was not properly established.");

            await engine.def("s/rule", async function(i) {});
            assert.deepStrictEqual(engine._rules.has("/s/rule"), true,
                "The rule '/s/rule' was not added to the internal ruleset.");
            assert.deepStrictEqual(engine._relations.get("/s/i").has("/s/rule"), true,
                "The relation between the fact '/s/i' and the rule '/s/rule' was not properly established.");
        });

        it("shall add multiple fact-rule relations given multiple parameters.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async function(i, a, b) {}); // multiple local facts
            assert.deepStrictEqual(engine._relations.get("/i").has("/rule"), true,
                "The relation between the fact '/i' and the rule '/rule' was not properly established.");
            assert.deepStrictEqual(engine._relations.get("/a").has("/rule"), true,
                "The relation between the fact '/a' and the rule '/rule' was not properly established.");
            assert.deepStrictEqual(engine._relations.get("/b").has("/rule"), true,
                "The relation between the fact '/b' and the rule '/rule' was not properly established.");
        });

        it("shall add a rule referencing a fact with a specified path", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async function(/*@ /another/path */ x) {});
            assert.deepStrictEqual(engine._relations.get("/another/path").has("/rule"), true,
                "The relation between the fact '/another/path' and the rule '/rule' was not properly established.");
        });

        it("shall add a rule referencing a fact with a specified path for multiple parameters", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async function(/*@ /another/path */ x, /*@ /some/other/path */ y) {});
            assert.deepStrictEqual(engine._relations.get("/another/path").has("/rule"), true,
                "The relation between the fact '/another/path' and the rule '/rule' was not properly established.");
            assert.deepStrictEqual(engine._relations.get("/some/other/path").has("/rule"), true,
                "The relation between the fact '/some/other/path' and the rule '/rule' was not properly established.");
        });

        it("shall add a rule referencing a fact with a specified complex path", async () => {
            let engine = new InfernalEngine();
            await engine.def("/a/another/path/rule", async function(/*@ ../.././some/./fact */ x) {});
            assert.deepStrictEqual(engine._relations.get("/a/some/fact").has("/a/another/path/rule"), true,
                "The relation between the fact '/a/some/fact' and the rule '/a/another/path/rule' was not properly established.");
        });

    });

    describe("#def with lambda functions", () => {

        function relatedRules(engine, factPath) {
            let rules = engine._relations.get(factPath);
            return rules ? [...rules] : [];
        }

        it("shall parse a single parameter lambda without parenthesis.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async i => {});
            assert.deepStrictEqual(engine._rules.get("/rule").facts, ["/i"]);
            assert.deepStrictEqual(relatedRules(engine, "/i"), ["/rule"]);
        });

        it("shall parse a single parameter lambda with an expression body containing parenthesis.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async i => ({ j: Math.max(i, 0) }));
            assert.deepStrictEqual(engine._rules.get("/rule").facts, ["/i"]);
        });

        it("shall parse a single parameter lambda with parenthesis.", async () => {
            let engine = new InfernalEngine();
            await engine.def("s/rule", async (i) => {});
            assert.deepStrictEqual(engine._rules.get("/s/rule").facts, ["/s/i"]);
            assert.deepStrictEqual(relatedRules(engine, "/s/i"), ["/s/rule"]);
        });

        it("shall parse a lambda with multiple parameters.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async (i, a, b) => {});
            assert.deepStrictEqual(engine._rules.get("/rule").facts, ["/i", "/a", "/b"]);
        });

        it("shall parse a lambda with parameters spanning multiple lines.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async (
                i,
                a
            ) => {});
            assert.deepStrictEqual(engine._rules.get("/rule").facts, ["/i", "/a"]);
        });

        it("shall parse a lambda without any parameter.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async () => {});
            assert.deepStrictEqual(engine._rules.has("/rule"), true);
            assert.deepStrictEqual(engine._rules.get("/rule").facts, []);
        });

        it("shall parse a lambda without spaces around the arrow.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async(i,a)=>{});
            assert.deepStrictEqual(engine._rules.get("/rule").facts, ["/i", "/a"]);
        });

        it("shall parse attribute comments in a lambda with parenthesis.", async () => {
            let engine = new InfernalEngine();
            await engine.def("/a/b/rule", async (/*@ /another/path */ x, /*@ ../some/fact */ y, z) => {});
            assert.deepStrictEqual(engine._rules.get("/a/b/rule").facts,
                ["/another/path", "/a/some/fact", "/a/b/z"]);
        });

        it("shall parse an attribute comment in a single parameter lambda without parenthesis.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async /*@ /another/path */ x => {});
            assert.deepStrictEqual(engine._rules.get("/rule").facts, ["/another/path"]);
        });

        it("shall infer using a single parameter lambda rule without parenthesis.", async () => {
            let engine = new InfernalEngine();
            await engine.def("count5", async i => {
                if (typeof i !== "undefined" && i < 5) {
                    return { "i": i + 1 };
                }
            });
            await engine.assert("i", 1);
            assert.deepStrictEqual(await engine.peek("i"), 5);
        });

        it("shall infer using an expression bodied lambda rule.", async () => {
            let engine = new InfernalEngine();
            await engine.def("double", async (/*@ /input */ x) => ({ "/output": x * 2 }));
            await engine.assert("/input", 21);
            assert.deepStrictEqual(await engine.peek("/output"), 42);
        });

        it("shall import a model containing lambda rules.", async () => {
            let engine = new InfernalEngine();
            await engine.import({
                celsius: 100,
                toFahrenheit: async celsius => ({ fahrenheit: celsius * 9 / 5 + 32 })
            });
            assert.deepStrictEqual(await engine.peek("fahrenheit"), 212);
        });

        it("shall still reject a non async lambda.", async () => {
            let engine = new InfernalEngine();
            await assert.rejects(engine.def("rule", i => {}),
                /The rule parameter must be an async function/);
        });

    });

    describe("#def with regular functions (non regression)", () => {

        it("shall parse a function with a single parameter.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async function(i) {});
            assert.deepStrictEqual(engine._rules.get("/rule").facts, ["/i"]);
        });

        it("shall parse a named function with multiple parameters.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async function myRule(i, a, b) { return Math.max(a, b); });
            assert.deepStrictEqual(engine._rules.get("/rule").facts, ["/i", "/a", "/b"]);
        });

        it("shall parse a function without any parameter.", async () => {
            let engine = new InfernalEngine();
            await engine.def("rule", async function() {});
            assert.deepStrictEqual(engine._rules.get("/rule").facts, []);
        });

        it("shall parse a function with parameters spanning multiple lines and attribute comments.", async () => {
            let engine = new InfernalEngine();
            await engine.def("/a/b/rule", async function(
                /*@ /another/path */ x,
                /*@ ../some/fact */ y,
                z) {});
            assert.deepStrictEqual(engine._rules.get("/a/b/rule").facts,
                ["/another/path", "/a/some/fact", "/a/b/z"]);
        });

        it("shall parse an object method shorthand rule.", async () => {
            let engine = new InfernalEngine();
            let model = { async rule(i, a) {} };
            await engine.def("rule", model.rule);
            assert.deepStrictEqual(engine._rules.get("/rule").facts, ["/i", "/a"]);
        });

        it("shall infer using a regular function rule.", async () => {
            let engine = new InfernalEngine();
            await engine.def("count5", async function(i) {
                if (typeof i !== "undefined" && i < 5) {
                    return { "i": i + 1 };
                }
            });
            await engine.assert("i", 1);
            assert.deepStrictEqual(await engine.peek("i"), 5);
        });

        it("shall still reject a non async function.", async () => {
            let engine = new InfernalEngine();
            await assert.rejects(engine.def("rule", function(i) {}),
                /The rule parameter must be an async function/);
        });

    });

    describe("#undef", () => {

        it("shall not count up to 5 once the rule is undefined.", async () => {
            let engine = new InfernalEngine();
            await engine.def("count5", async function(i) {
                if (typeof i !== "undefined" && i < 5) {
                    return { "i": i + 1 };
                }
            });
            await engine.undef("count5");
            await engine.assert("i", 1);
            let final_i = await engine.peek("i");
            assert.deepStrictEqual(final_i, 1);
        });

        it("shall undefine all rules from the carModel", async () => {
            let engine = new InfernalEngine();
            let carModel = require("./models/carModel");
            await engine.import(carModel);
            await engine.undef("/speed/*");
            engine.reset();
            await engine.assert("/speed/input", "invalid number");
            let changes = await engine.exportChanges();
            assert.deepStrictEqual(changes, {
                speed: { 
                    input: "invalid number"
                }
            });
        });

    });

    describe("#infer", () => {

        it("shall count up to 5.", async () => {
            let engine = new InfernalEngine();
            await engine.def("count5", async (i) => {
                if (typeof i !== "undefined" && i < 5) {
                    return { "i": i + 1 };
                }
            });
            await engine.assert("i", 1);
            let final_i = await engine.peek("i");
            assert.deepStrictEqual(final_i, 5);
        });

        it("#assert.", async function() {
            let engine = new InfernalEngine();
            await engine.def("count5", async function(i) {
                if (typeof i !== "undefined" && i < 7) {
                    return {
                        "#assert": {
                            path: "i",
                            value: i + 1
                        }
                    };
                }
            });
            await engine.assert("i", 4);
            let final_i = await engine.peek("i");
            assert.deepStrictEqual(final_i, 7);
        });

        it("#retract.", async () => {
            let engine = new InfernalEngine();
            await engine.def("count7", async function(i) {
                if (typeof i !== "undefined" && i < 7) {
                    return {
                        "#assert": {
                            path: "i",
                            value: i + 1
                        }
                    };
                }
            });
            await engine.def("retract_i", async function(i) {
                return {
                    "#retract": {
                        path: "i"
                    }
                }
            });
            await engine.assert("i", 4);
            let final_i = await engine.peek("i");
            assert.deepStrictEqual(final_i, undefined);
        });

        it("#def", async () => {
            let engine = new InfernalEngine();
            await engine.def("count5", async function(i, added) {
                if (typeof i === "undefined") return;
                if (i < 7) {
                    return {
                        "#assert": {
                            path: "i",
                            value: i + 1
                        }
                    };
                }
                else if (i < 14) {
                    return {
                        "#def": {
                            path: "mult2",
                            value: async function(i) {
                                return {
                                    "j": i * 2
                                }
                            }
                        }
                    }
                }
            });
            await engine.assert("i", 4);
            let final_j = await engine.peek("j");
            assert.deepStrictEqual(final_j, 14);
        });

        it("#undef.", async () => {
            let engine = new InfernalEngine();
            await engine.import({
                count7: async function(i) {
                    if (typeof i !== "undefined" && i < 7) {
                        return {
                            "#assert": {
                                path: "i",
                                value: i + 1
                            }
                        };
                    }
                },
                undef: async function(i) {
                    return {
                        "#undef": {
                            path: "count7"
                        }
                    }
                }
            });
            await engine.assert("i", 4);
            let final_i = await engine.peek("i");
            assert.deepStrictEqual(final_i, 4);
        });

        it("#import", async () => {
            let engine = new InfernalEngine();
            await engine.def("addCarModel", async function() {
                let carModel = require("./models/carModel");
                return {
                    "#import": {
                        path: "car",
                        value: carModel
                    }
                }
            });
            let carModelExported = await engine.export("/car");
            delete carModelExported.$;
            assert.deepStrictEqual(carModelExported, {
                    name: "Minivan",
                    speed: {
                      input: "0",
                      limit: 140,
                      value: 0
                    }
            });
        });

    });


    describe("#import", () => {

        it("shall load and infer the animal is agreen frog.", async () => {
            let engine = new InfernalEngine();
            let critterModel = require("./models/critterModel");
            await engine.import(critterModel);
            await engine.import({
                eats: "flies",
                sound: "croaks"
            });
            assert.deepStrictEqual(await engine.peek("species"), "frog");
            assert.deepStrictEqual(await engine.peek("color"), "green");
        });

        it("shall load and infer the animal is a green frog inside the submodel.", async () => {
            let engine = new InfernalEngine();
            let critterModel = require("./models/critterModel");
            await engine.import(critterModel, "/the/critter/model");
            await engine.assert("/the/critter/model/eats", "flies");
            await engine.assert("/the/critter/model/sound", "croaks");
            assert.deepStrictEqual(await engine.peek("/the/critter/model/species"), "frog");
            assert.deepStrictEqual(await engine.peek("/the/critter/model/color"), "green");
        });

    });


    describe("#export", () => {

        it("shall export the same model as the one imported.", async () => {
            let engine = new InfernalEngine();
            let model = {
                a: "a",
                b: 1,
                c: true,
                d: {
                    x: "23",
                    y: 42,
                    z: 5.5
                }
            }
            await engine.import(model);
            let model2 = await engine.export();
            delete model2.$; // we don't want to deal with meta facts
            assert.deepStrictEqual(model2, model);
        });

        it("shall export the same submodel as the one imported.", async () => {
            let engine = new InfernalEngine();
            let model = {
                a: "a",
                b: 1,
                c: true,
                d: {
                    x: "23",
                    y: 42,
                    z: false
                }
            }
            await engine.import(model);
            let model2 = await engine.export("/d");
            assert.deepStrictEqual(model2, model.d);
        });

    });


    describe("#exportChanges", () => {

        it("shall export what changed during inference.", async () => {
            let engine = new InfernalEngine();
            let carModel = require("./models/carModel");
            await engine.import(carModel);
            engine.reset();
            await engine.assert("/speed/input", "50");
            let changes = await engine.exportChanges();
            assert.deepStrictEqual(changes, {
                speed: { 
                    input: "50",
                    value: 50
                }
            });
        });

        it("shall add a message at the root of the model.", async () => {
            let engine = new InfernalEngine();
            let carModel = require("./models/carModel");
            await engine.import(carModel);
            engine.reset();
            await engine.assert("/speed/input", "invalid number");
            let changes = await engine.exportChanges();
            assert.deepStrictEqual(changes, {
                message: "Error: 'invalid number' is not a valid integer.",
                speed: { 
                    input: "invalid number"
                }
            });
        });

        it("shall do the conversion and add a message at the root of the model.", async () => {
            let engine = new InfernalEngine();
            let carModel = require("./models/carModel");
            await engine.import(carModel);
            engine.reset();
            await engine.assert("/speed/input", "200");
            let changes = await engine.exportChanges();
            assert.deepStrictEqual(changes, {
                message: "WARN: The speed input can not exceed the speed limit of 140.",
                speed: { 
                    input: "200",
                    value: 140
                }
            });
        });
    });
});