var assert = require("assert");
var InfernalEngine = require("../lib/index.js");


describe("EngineProxy", function() {

    describe("#trace", function() {

        it("should trace a message during inference", function(done) {
            
            var engine = new InfernalEngine();
            engine.load({
               
                testTrace: function(next) {
                    var msg = this.get("msg");
                    this.trace(msg);
                    return next();
                }

            });
            
            engine.startTracing(function(trace) {
                if (trace.action === "trace") {
                    assert.equal("/testTrace", trace.rule);
                    assert.equal("Hello World!", trace.message);
                    done();
                }
            });
            
            engine.set("msg", "Hello World!");

            engine.infer(function(err) {
                assert.ifError(err);
            });

        });

    });

});
