var assert = require("assert");
var InfernalEngine = require("../lib/index.js");

/* jshint ignore:start */


describe("InfernalEngine", function() {

    describe("#get", function() {
        
        it("should get the fact value 'Hello world!' inside 'hello/world'", 
        function(done) {
            var engine = new InfernalEngine();
            engine.facts = {
                hello: {
                    world: "Hello world!"
                }
            };
            assert.equal(engine.get("hello/world"), "Hello world!")
            done();
        });


        it("should get the fact with the parent folder notation at " +
           "'/root/parent/child1/../child2/value'",
        function(done) {
            var engine = new InfernalEngine();
            engine.facts = {
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
            };
            assert.equal("child2", engine.get("/root/parent/child1/../child2/value"));
            done();
        });

    });


    describe("#set", function() {

        it("should create a fact at 'company/department/employees/count'", 
        function(done) {
            var engine = new InfernalEngine();
            engine.set("company/department/employees/count", 10);
            assert.equal(10, engine.facts.company.department.employees.count);
            done();
        });

    });


    describe("#addRule", function() {
        
        it("should add a relation between fact 'i' and rule 'increment'", 
        function(done) {
            var engine = new InfernalEngine();
            engine.addRule(increment);
            assert(engine.relations["i"]["increment"]);
            done();
        });

    });


    describe("#set('i', 1)", function() {

        it("should add a rule named 'increment' to the agenda", 
        function(done) {
            var engine = new InfernalEngine();
            engine.addRule(increment); 
            engine.set("i", 1);
            assert(engine.agenda["increment"]);
            done();
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
