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
            engine.addRule("/units/convert_lbs_to_kg", function(done) {
                var lbs = this.get("lbs");
                this.set("kg", lbs / 2.2);
                done();
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


    describe("#getFacts", function() {
    
        it("should return a copy of the internal facts", function(done) {
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

    });

});



function increment(done) {
    var i = this.get("i");
    if (i < 5) {
        i++;
    }
    this.set("i", i);
    done();
}


function tolerance(oldValue, newValue, decimals) {
    var mult = Math.pow(10, decimals);
    var oldVal = oldValue * mult;
    var newVal = newValue * mult;
    return Math.abs(oldVal - newVal) >= 1;
}




/* jshint ignore:end */
