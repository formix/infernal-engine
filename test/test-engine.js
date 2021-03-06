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