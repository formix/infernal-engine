var assert = require("assert");
var InfernalEngine = require("../lib/core.js");

/* jshint ignore:start */

describe("Testing engine construction with an initial state", function() {

    it("shall create a fact named " +
       "'product.properties.size' having the value 55", function(done) {
        var engine = new InfernalEngine();
        engine.setState({
            product: {
                properties: {
                    size: 55
                }
            }
        });

        assert.equal(engine.facts["product.properties.size"], 55);
        done();
    });

    
    describe("and calling inference without any rule", function() {

        it("shall work properly.", function(done) {
            var engine = new InfernalEngine();
            engine.setState({
                product: {
                    properties: {
                        size: 66
                    }
                }
            });

            engine.infer(function(err, report) {
                assert.ifError(err);
                var state = engine.getState();
                assert.equal(state.product.properties.size, 66);
                done();
            });

        });

    });

});




describe("Testing a simple incrementation rule", function() {

    var engine = new InfernalEngine();
    engine.addRule("increment", function(self, done) {
        var i = self.get("i");
        if (i < 5) {
            i++;
        }
        self.set("i", i);
        done();
    });

 
    describe("the engine", function() {

        it("shall contain a rule named 'increment'", function(done) {
            assert.equal(typeof(engine.rules["increment"]), "function");
            done();
        });

        
        it("shall contain a relation between the fact 'i' and the rule " +
            "'increment'", function(done) {
                assert.equal(engine.relations["i"]["increment"], true);
                done();
        });

    });


    describe("by setting a value to the fact 'i'", function() {
        it("shall add one planned rule named 'increment'", function(done) {
            engine.set("i", 0);
            assert.equal(typeof(engine.planning["increment"]), "function");
            done();
        });
    })


    describe("by executing engine.infer()", function() {

        it("shall set the fact value to 5", function(done) {
        	
        	var eventFired = false;
        	engine.on("step", function(info) {
        		eventFired = true;
        	});
        	
            engine.infer(function(err, report) {
                assert.ifError(err);
                assert.equal(engine.get("i"), 5);
                assert.ok(eventFired);
                done();
            });
        });

    });

});

/* jshint ignore:end */
