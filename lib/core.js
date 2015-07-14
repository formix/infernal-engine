"use strict";

var events = require("events");
var util = require("util");

/***** Private *****/

function isEmpty(obj) {
	for ( var key in obj) {
		if (obj.hasOwnProperty(key)) {
			return false;
		}
	}
	return true;
}

function clone(source) {
	var newClone = {};
	for ( var prop in source) {
		if (source.hasOwnProperty(prop)) {
			newClone[prop] = source[prop];
		}
	}
	return newClone;
}

function infer(engine, info, callback) {

    if (engine._traces) {
        var traceId = engine._traces.length;
        engine._traces.push({
            id: traceId,
            type: "engine-inference",
            target: "engine",
            data: {
                inferenceStep: info.step,
                stopRequested: info.stop
            }
        });
    }

	if (isEmpty(engine.agenda)) {
		callback(null, info);
		return;
	} else if (info.step > 0) {
		engine.emit("step", info);
		if (info.stop) {
			return;
		}
	}

	var current = engine.agenda;
	engine.agenda = {};

	var currentRules = [];
	for ( var ruleName in current) {
		if (current.hasOwnProperty(ruleName)) {
			currentRules.push({
				name : ruleName,
				exec : current[ruleName]
			});
		}
	}

	info.step++;
	process.nextTick(function() {
		execRules(engine, currentRules, info, callback);
	});

}

function execRules(engine, currentRules, info, callback) {  // jshint ignore:line

	if (currentRules.length === 0) {
		infer(engine, info, callback);
		return;
	}

	var rule = currentRules.pop();

    if (engine._traces) {
        var traceId = engine._traces.length;
        engine._traces.push({
            id: traceId,
            type: "rule-execution",
            target: rule.name
        });
    }

	process.nextTick(function() {
		rule.exec(engine, function(data) {
			if (data) {
                var result = {
					rule : rule.name,
					step : info.step,
					data : data
                };
				info.results.push(result);
                if (engine._traces) {
                    var traceId = engine._traces.length;
                    engine._traces.push({
                        id: traceId,
                        type: "rule-execution-done",
                        target: rule.name,
                        data: {
                            result: result
                        }
                    });
                }
			}
			execRules(engine, currentRules, info, callback);
		});
	});
}

function isObject(value) {
	if ((value === null) || (value === undefined)) {
		return false;
	}
	if ((value instanceof Date) || (value instanceof Array)) {
		return false;
	}
	return (value instanceof Object);
}

function updateFacts(facts, namespace, state, engine) {
	var separator = ".";
	if (namespace === "") {
		separator = "";
	}
	for ( var key in state) {
		if (state.hasOwnProperty(key)) {
			var factName = namespace + separator + key;
			if (!isObject(state[key])) {
				if (!(state[key] instanceof Function)) {
					if (engine !== undefined) {
						engine.set(factName, state[key]);
					} else {
						facts[factName] = state[key];
					}
				}
			} else {
				updateFacts(facts, factName, state[key], engine);
			}
		}
	}
}

function assign(obj, keyStack, value) {
	var key = keyStack.pop();
	if (keyStack.length === 0) {
		obj[key] = value;
	} else {
		if (obj[key] === undefined) {
			obj[key] = {};
		}
		assign(obj[key], keyStack, value);
	}
}

function createFacts(state, facts) {
	for ( var factName in facts) {
		if (facts.hasOwnProperty(factName)) {
			var keys = factName.split(".").reverse();
			assign(state, keys, facts[factName]);
		}
	}
}

function addCompil(engine, compil, namespace) {
	var ruleName;
	var newRuleName;
	var factName;
    var newFactNAme

    if (engine._traces) {
        var traceId = engine._traces.length;
        engine._traces.push({
            id: traceId,
            type: "compilation-add",
            target: "engine",
            data: {
                namespace: namespace
            }
        });
    }

	var separator = ".";
	if (namespace === "") {
		separator = "";
	}

	for (ruleName in compil.rules) {
		if (compil.rules.hasOwnProperty(ruleName)) {
			newRuleName = namespace + separator + ruleName;
			engine.rules[newRuleName] = compil.rules[ruleName];
		}
	}

	for (var i = 0; i < compil.initRules.length; i++) {
		ruleName = compil.initRules[i];
		newRuleName = namespace + separator + ruleName;
		engine.agenda[newRuleName] = engine.rules[ruleName];
	}

	for (factName in compil.relations) {
		if (compil.relations.hasOwnProperty(factName)) {
			var relatedRules = compil.relations[factName];
            newFactName = namespace + separator + factName;
			engine.relations[newFactName] = {};
			for (ruleName in relatedRules) {
				if (relatedRules.hasOwnProperty(ruleName)) {
					newRuleName = namespace + separator + ruleName;
					engine.relations[newFactName][newRuleName] = true;
				}
			}
		}
	}

	for (factName in compil.facts) {
		if (compil.facts.hasOwnProperty(factName)) {
            newFactName = namespace + separator + factName;
			engine.set(newFactName, compil.facts[factName]);
		}
	}

}


/***** exports *****/

function Engine(compil) {
	
	this.facts = {};     // Map between fact names and fact values
	this.rules = {};     // Map between rule names and rules (function)
	this.relations = {}; // Map between fact names and all related rules
	this.agenda = {};    // Rules to be executed by the next call to infer()

    this._traces = null; // Traces of the last inference.

    
    this.enableTracing = function() {
        if (!this._traces) {
            this._traces = [];
        }
    };


    this.disableTracing = function() {
        this._traces = null;
    };


    this.isTracingEnabled = function() {
        if (this._traces) {
            return true;
        }
        return false;
    };


    this.resetTracing = function() {
        if (this._traces) {
            this._traces = [];
        }
    };

    this.getTraces = function() {
        if (this._traces) {
            return this._traces;
        }
    };

	
	this.addRule = function(ruleName, rule) {
		var ruleContent = rule.toString();
		var regex = /self\.get\(["'](.*)["']\)/gm;
		var match = regex.exec(ruleContent);
		var factName;
		this.rules[ruleName] = rule;
        var relatedFacts = [];  // for tracing purpose only
		while (match) {
			factName = match[1];
            relatedFacts.push(factName); // for tracing purpose only
			if (this.relations[factName] === undefined) {
				this.relations[factName] = {};
			}
			this.relations[factName][ruleName] = true;
			match = regex.exec(ruleContent);
		}
        if (this._traces) {
            var traceId = this._traces.length;
            this._traces.push({
                id: traceId,
                type: "rule-add",
                target: ruleName,
                data: {
                    relatedFacts: relatedFacts
                }
            });
        }
	};

	/**
	 * Adds a set of rules to the engine.
	 */
	this.addRules = function(ruleSet, namespace) {
		var prefix = "";
		
		if (namespace) {
			prefix = namespace + ".";
		}
		for ( var ruleName in ruleSet) {
			if (ruleSet.hasOwnProperty(ruleName)) {
				this.addRule(prefix + ruleName, ruleSet[ruleName]);
			}
		}
	};

	this.addCompil = function(compil, namespace) {
		if (namespace === undefined) {
			namespace = "";
		}
		addCompil(this, compil, namespace);
	};

	this.get = function(factName) {
		var value = this.facts[factName];
		if (value instanceof Array) {
			// array facts are intransitive!
			var array = [];
			for (var i = 0; i < value.length; i++) {
				array.push(value[i]);
			}
			return array;
		} else {
			return value;
		}
	};

	this.set = function(factName, value) {
		if (this.facts[factName] !== value) {
            var initialValue = this.facts[factName]; // for tracing purpose only
			
            this.facts[factName] = value;

			if (this.relations[factName] !== undefined) {
				var rules = this.relations[factName];
                var plannedRules = []; // for tracing purpose only
				for ( var ruleName in rules) {
					if (rules.hasOwnProperty(ruleName)) {
                        if (!this.agenda[ruleName]) {  
                            // for tracing purpose only
                            // Trace added if rule is seen for the first time
                            plannedRules.push(ruleName);
                        }
						this.agenda[ruleName] = this.rules[ruleName];
					}
                }

                if (this._traces) {
                    var traceId = this._traces.length;
                    this._traces.push({
                        id: traceId,
                        type: "fact-update",
                        target: factName,
                        data: {
                            from: initialValue,
                            to: value,
                            plannedRules: plannedRules
                        }
                    });
                }
			}
		}
	};

	this.infer = function(callback) {
		this.resetTracing();
        var engine = this;
		process.nextTick(function() {
			infer(engine, {
				step : 0,
				results : [],
				stop : false
			}, callback);
		});
	};

	this.getFacts = function() {
		var obj = {};
		createFacts(obj, this.facts);
		return obj;
	};

	this.setFacts = function(obj) {
		updateFacts(null, "", obj, this);
	};
	
	
	this.reset = function(newFacts) {
        if (this._traces) {
            var traceId = this._traces.length;
            this._traces.push({
                id: traceId,
                type: "engine-reset",
                target: "engine",
                data: {
                    newFacts: (newFacts !== undefined)
                }
            });
        }
		this.facts = {};
		this.agenda = {};
		if (newFacts) {
			this.setFacts(newFacts);
		}
	};
	
	
	// initialize the engine with the compilation unit if provided
	if (compil === undefined) {
		// default empty compilation unit.
		compil = {
			facts : {},
			rules : {},
			relations : {},
			initRules : []
		};
	}

	addCompil(this, compil, "");	
}

util.inherits(Engine, events.EventEmitter);

module.exports = Engine;

