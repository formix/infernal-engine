var assert = require("assert");
var InfernalEngine = require("../lib/core.js");

/* jshint ignore:start */

describe("Testing engine construction with an initial state", function() {

    it("shall create a fact named " +
       "'product.properties.size' having the value 55", function(done) {
        var engine = new InfernalEngine();
        engine.setFacts({
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
            engine.setFacts({
                product: {
                    properties: {
                        size: 66
                    }
                }
            });

            engine.infer(function(err, report) {
                assert.ifError(err);
                var facts = engine.getFacts();
                assert.equal(facts.product.properties.size, 66);
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
            assert.equal(typeof(engine.agenda["increment"]), "function");
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


describe("Testing a dual rule entity with an array", function() {
	
	var engine = new InfernalEngine();
	engine.addRule("checkCategory", function(self, done) {
		var categories = self.get("categories");
		var category = self.get("category");
		if (categories.indexOf(category) === -1) {
			if (category === null) {
				done({
					level: "warning",
					message: "Please select a category in " + JSON.stringify(categories)
				});
			} else {
				done({
					level: "error",
					message: "The selected category \"" + category + 
						"\" is not in the valid category list: " + 
						JSON.stringify(categories)
				});
			}
			return;
		}
		done();
	});
	
	var initialFacts = {
			categories: ["compact", "mid-size", "minivan", "suv", "pickup"],
			category: null
	};
	
	engine.setFacts(initialFacts);
	
	
	it("should return a warning asking to select a valid category", function(done) {
		engine.infer(function(err, info) {
			assert.ifError(err);
			assert.equal(info.results.length, 1);
			assert.equal(info.results[0].data.level, "warning");
			done();
		});
	});
	

	it("should return an error telling that category is invalid", function(done) {
		engine.reset(initialFacts);
		engine.set("category", "asdasd");
		engine.infer(function(err, info) {
			assert.ifError(err);
			assert.equal(info.results.length, 1);
			assert.equal(info.results[0].data.level, "error");
			done();
		});
	});
	
	
	it("should terminate with an empty result set", function(done) {
		engine.reset(initialFacts);
		engine.set("category", "compact");
		engine.infer(function(err, info) {
			assert.ifError(err);
			assert.equal(info.results.length, 0);
			done();
		});
	});

	describe("and changing the valid categories array", function() {
		it("should return an error telling that the category is invalid", function(done) {
			engine.reset(initialFacts);
			engine.set("category", "compact");
			engine.infer(function(err, info) {
				engine.set("categories", ["mid-size", "minivan", "suv", "pickup"]);
				engine.infer(function(err, info) {
					assert.ifError(err);
					assert.equal(info.results.length, 1);
					assert.equal(info.results[0].data.level, "error");
					done();
				});
			});
		});
	});
	
});


describe("Finding zeros of 'x^2 - 6x + 8 = 0'", function() {
    it("it should be 2 and 4", function(done) {

        var engine = new InfernalEngine();

        var fs = require("fs");
        if (fs.existsSync("zeros.txt")) {
            fs.unlinkSync("zeros.txt");
        }

        engine.on("trace", function(message) {
            fs.appendFileSync("zeros.txt", message + "\n");
        });

        engine.addRule("next_x1", function(self, done) {
            var x = self.get("x1");
            var x1 = (6 * x - 8) / x;
            if (tolerance(x, x1, 4)) {
                self.set("x1", x1);
            }
            done();
        });
        engine.addRule("next_x2", function(self, done) {
            var x = self.get("x2");
            var x2 = (Math.pow(x, 2) + 8) / 6;
            if (tolerance(x, x2, 4)) {
                self.set("x2", x2);
            }
            done();
        });
        engine.addRule("initialize", function(self, done) {
            var initialValue = self.get("initialValue");
            self.set("x1", initialValue);
            self.set("x2", initialValue);
            done();
        });
        
        engine.set("initialValue", 1);

        engine.infer(function(err) {
            assert.ifError(err);

            var x1 = Math.round(engine.get("x1"));
            var x2 = Math.round(engine.get("x2"));

            fs.appendFileSync("zeros.txt", "\n");
            fs.appendFileSync("zeros.txt", "********** RESULTS **********\n");
            fs.appendFileSync("zeros.txt", "*** x1 = " + x1 + " ***\n");
            fs.appendFileSync("zeros.txt", "*** x2 = " + x2 + " ***\n");

            assert.equal(x1, 4);
            assert.equal(x2, 2);

            done();
        });

    });
});


describe("Socrates is a human", function() {

    it("he should be mortal", function(done) {

        var engine = new InfernalEngine();

        engine.on("trace", function(message) {
//            fs.appendFileSync("socrates.txt", message + "\n");
            console.log(message);
        });

        engine.addRule("humanMortal", function(self, done) {
            if (self.get("*.isHuman")) {
                self.set("*.isMortal", true);
            }
            done();
        });

        engine.set("socrates.isHuman", true);

        engine.infer(function(err) {
            assert(engine.get("socrates.isMortal"));
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
