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
            engine.addRule("increment", function(done) {
                var i = this.get("i");
                if (i < 5) {
                    i++;
                }
                this.set("i", i);
            });
            assert(engine.relations["i"]["increment"]);
            done();
        });

    });

});




function tolerance(oldValue, newValue, decimals) {
    var mult = Math.pow(10, decimals);
    var oldVal = oldValue * mult;
    var newVal = newValue * mult;
    return Math.abs(oldVal - newVal) >= 1;
}




/* jshint ignore:end */
