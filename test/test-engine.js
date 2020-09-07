var assert = require("assert");
var InfernalEngine = require("../lib/index.js");

/* jshint ignore:start */


describe("InfernalEngine", function() {

    describe("#get", function() {
        
        it("should get the fact value 'Hello world!' inside 'hello/world'", 
        function(done) {
            var engine = new InfernalEngine();
            engine.setFacts ({
                hello: {
                    world: "Hello world!"
                }
            });
            assert.equal(engine.get("hello/world"), "Hello world!")
            done();
        });


        it("should get the fact with the parent folder notation at " +
           "'/root/parent/child1/../child2/value'",
        function(done) {
            var engine = new InfernalEngine();
            engine.setFacts({
                root: {
                    parent: {
                        child1: {
                            value: "child1"
                        },
                        child2: {
                            value: "child2"
                        }
                    }
                }
            });
            assert.equal("child2", engine.get("/root/parent/child1/" +
                "../child2/value"));
            done();
        });

    });


    describe("#addRule", function() {
        
        it("should add a relation between fact 'i' and rule 'increment'", 
        function(done) {
            var engine = new InfernalEngine();
            engine.addRule(increment);
            assert(engine._relations["/i"]["/increment"]);
            done();
        });

        it("should add a rule that uses relative path correctly",
        function(done) {
            var engine = new InfernalEngine();
            engine.addRule("/units/convert_lbs_to_kg", function(next, lbs) {
                return next(null, {
                    kg: lbs / 2.2
                });
            });
            engine.set("/units/lbs", 110);
            engine.infer(function(err) {
                assert.ifError(err);
                var kg = Math.round(engine.get("/units/kg"));
                assert.equal(kg, 50);
                done();
            });
        });

    });


    describe("#set", function() {

        it("should create a fact at '/company/department/employees/count'", 
        function(done) {
            var engine = new InfernalEngine();
            engine.set("company/department/employees/count", 10);
            assert.equal(10, 
                engine.getFacts().company.department.employees.count);
            done();
        });

        it("should add a rule named 'increment' to the agenda", 
        function(done) {
            var engine = new InfernalEngine();
            engine.addRule(increment); 
            engine.set("i", 1);
            assert(engine._agenda["/increment"]);
            done();
        });


        it("should not add the increment rule to the agenda when dates are " +
           "the same",
        function(done) {
            var engine = new InfernalEngine();
            engine.setFacts({
                date: new Date(2016, 0, 1),
                i: 1
            });
            engine.addRule("increment_new_date", function(end) {
                var date = this.get("date");
                var i = this.get("i") || 0;
                if (date.getFullYear() > 2015) {
                    i++;
                }
                this.set("i", i);
            }); 
            engine.set("/date", new Date(2016, 0, 1));
            assert(!engine._agenda["/increment_new_date"], 
                "Increment rule found in the agenda");
            done();
        });
    });


    describe("#infer", function() {

        it("should set the fact 'i' to 5", function(done) {
            var engine = new InfernalEngine();
            engine.addRule(increment); 
            engine.set("i", 1);
            engine.infer(function() {
                assert.equal(engine.get("i"), 5);
                done();
            });
        });

    });


    describe("#set (with callback)", function() {

        it("should execute the callback after the set is done.", function(done) {
            var engine = new InfernalEngine();
            engine.addRule(increment); 
            engine.set("i", 1, function(err, changes) {
                assert.equal(changes["/i"], 5);
                done();
            });
        });

    });


    describe("#getFacts", function() {
    
        it("should return a copy of internal facts", function(done) {
            var engine = new InfernalEngine();
            engine.set("/first/object/name", "original");
            engine.set("/first/object/value", 1);
            
            var facts = engine.getFacts();
            facts.first.object.name = "modified";
            facts.first.object.value = 2;
            
            assert.equal(engine.get("/first/object/name"), "original");
            assert.equal(engine.get("/first/object/value"), 1);

            done();
        });


        it("should return arrays as array, not as objects", function(done) {
           
            var engine = new InfernalEngine();
            engine.setFacts({
                arr: ["a", "b", "c"]
            })
            var data = engine.getFacts();
            assert(data.arr instanceof Array, 
                "The arr property should be an array.");
            done();
        });
    
    });


    describe("#setFacts", function() {
    
        it("should set multiple facts from an object", function(done) {
            var obj = {
                my: {
                    first: {
                        fact: "factName",
                        value: 10
                    },
                    second: new Date(2016, 0, 23)
                }
            };

            var engine = new InfernalEngine();
            engine.setFacts(obj);
            assert.equal(engine.get("/my/first/fact"), "factName");
            assert.equal(engine.get("/my/first/value"), 10);
            assert.equal(engine.get("my/second").getTime(), 
                (new Date(2016, 0, 23)).getTime());

            done();
        });
    
    });


    describe("#load", function() {

        it("should load a model and infer properly", function(done) {
            var engine = new InfernalEngine();
            engine.load({
                sub: {
                    i: 0,
                    increment: increment
                }
            });

            engine.set("/sub/i", 1);
            engine.infer(function(err) {
                assert.ifError(err);
                assert.equal(engine.get("/sub/i"), 5);
                done();
            });
        });


        it("should not make an object from an array", function(done) {
            
            var engine = new InfernalEngine();
            engine.load({
                arr: ['A', 'B', 'C']
            });

            assert(engine.get("/arr") instanceof Array, 
                "The fact 'arr' should be an array.");

            done();
        });

    });


    describe("#getDiff", function() {
    
        var engine = new InfernalEngine();
        engine.load({
            a: 15,
            b: {
                c: "test",
                d: 30,
                r1: function(next, /*@ d */ d) {
                    let c = null;
                    if (d > 100) {
                        return next(null, {c:"TEST"})
                    } else {
                        return next(null, {c:"test"})
                    }
                },
                r2: function(next, /*@ /a */ a) {
                    if (a > 50) {
                        return next(null, {msg:"a is greater than 50"})
                    }
                    return next();
                }
            },
            r3: function(next, /*@ a */ a) {
                return next(null, { "b/d": a * 2 });
            }
        });


        it("should return the set of modified facts", function(next, ) {
            engine.set("a", 40);
            engine.infer(function(err) {
                assert.ifError(err);
                var diff = engine.getDiff();
                assert.equal(
                    JSON.stringify(diff), 
                    '{"b":{"d":80}}');
                return next();
            });
        });


        it("should return the set of modified facts, including the new one",
        function(done) {
            engine.set("a", 60);
            engine.infer(function(err) {
                assert.ifError(err);
                var diff = engine.getDiff();
                assert.equal(
                    JSON.stringify(diff),
                    '{"b":{"msg":"a is greater than 50","d":120,"c":"TEST"}}');
                done();
            });
        });
    
    });


    describe("#startTracing", function() {

        it("should set the fact 'i' to 5 and trace execution", function(done) {
            var engine = new InfernalEngine();

            var logs = [];
            engine.startTracing(function(data) {
                logs.push(JSON.stringify(data));
                //console.log(JSON.stringify(data));
            });

            var expectedLogs = [
                '{"action":"addRule","rule":"/increment"}',
                '{"action":"set","fact":"/i","newValue":1}',
                '{"action":"addToAgenda","rule":"/increment"}',
                '{"action":"infer"}',
                '{"action":"set","fromRule":"/increment","fact":"/i","oldValue":1,"newValue":2}',
                '{"action":"addToAgenda","rule":"/increment"}',
                '{"action":"set","fromRule":"/increment","fact":"/i","oldValue":2,"newValue":3}',
                '{"action":"addToAgenda","rule":"/increment"}',
                '{"action":"set","fromRule":"/increment","fact":"/i","oldValue":3,"newValue":4}',
                '{"action":"addToAgenda","rule":"/increment"}',
                '{"action":"set","fromRule":"/increment","fact":"/i","oldValue":4,"newValue":5}',
                '{"action":"addToAgenda","rule":"/increment"}'
            ];

            engine.addRule(increment); 
            engine.set("i", 1);
			
            engine.infer(function() {
                assert.equal(logs.length, expectedLogs.length);
                for (var i = 0; i < logs.length; i++) {
                    assert.equal(logs[i], expectedLogs[i]);
                }   
                done();
            });
        });


        it("should not cause a problem to start tracing before loading a model",
        function(done) {
            var engine = new InfernalEngine();
            
            var logs = [];
            engine.startTracing(function(data) {
                logs.push(JSON.stringify(data));
            });

            engine.load({
                test: 'a'
            });

            done();
        });

    });



    describe("#notify", function() {
    
        it("should add the validate rule in the agenda", function(done) {
            
            var engine = new InfernalEngine();
            engine.load({
                size: {
                    value: "",
                    options: ["", "Small", "Medium", "Large"],
                    validate: function(next, 
                            /*@ value */    value, 
                            /*@ options */  options) {
                        var index = options.indexOf(value);
                        if (index === -1) {
                            return next("Invalid Option");
                        }
                        return next();
                    }
                }
            });

            engine.get("/size/options")[0] = "Tiny";
            engine.notify("/size/options");

            engine.infer(function(err) {
                assert.equal(err, "Invalid Option");
                done();
            });
            
        });


        it("should add the validate rule in the agenda during inference", 
        function(done) {
            
            var engine = new InfernalEngine();
            engine.load({
                size: {
                    value: "",
                    options: ["", "Small", "Medium", "Large"],
                    validate: function(next, 
                            /*@ value */    value, 
                            /*@ options */  options) {
                        var index = options.indexOf(value);
                        if (index === -1) {
                            return next("Invalid Option");
                        }
                        return next();
                    }
                },

                newValueTrigger: function(done,
                            /*@ newValue */      newValue,
                            /*@ /size/options */ options) {
                    options[0] = newValue;
                    engine.notify("/size/options");
                    done();
                }
            });

            engine.set("newValue", "Tiny");

            engine.infer(function(err) {
                assert.equal(err, "Invalid Option");
                done();
            });
            
        });
        
    
    });

});



function increment(next, /*@ i*/ i) {
    if (i < 5) {
        i++;
    }
    return next(null, {
        i: i
    });
}


function tolerance(oldValue, newValue, decimals) {
    var mult = Math.pow(10, decimals);
    var oldVal = oldValue * mult;
    var newVal = newValue * mult;
    return Math.abs(oldVal - newVal) >= 1;
}




/* jshint ignore:end */
