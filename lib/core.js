"use strict";

var events = require("events");
var util = require("util");
var EngineWrapper = require("./engine-wrapper");

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
            currentRules.push(current[ruleName]);
        }
    }

    info.step++;

    engine.trace(function() { return "********** STEP " + info.step + " **********"; });

    process.nextTick(function() {
        execRules(engine, currentRules, info, callback);
    });

}

function execRules(engine, currentRules, info, callback) {  // jshint ignore:line

    if (currentRules.length === 0) {
        infer(engine, info, callback);
        return;
    }

    var ruledef = currentRules.pop();

    process.nextTick(function() {
        engine.trace(function() { 
            var ruleName = ruledef.name;
            if (ruledef.context !== "") {
                ruleName += "|" + ruledef.context;
            }
            return "(ER) Executing rule '" + ruleName + "'"; 
        });
        var wrapper = new EngineWrapper(engine, ruledef)
        wrapper.exec(function(data) {
            if (data) {
                var result = {
                    rule : ruledef.name,
                    context: ruledef.context,
                    step : info.step,
                    data : data
                };
                info.results.push(result);
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

    this.facts = {};        // Map between fact names and fact values
    this.rules = {};        // Map between rule names and rules (function)
    this.relations = {};    // Map between fact names and all related rules
    this.wildRelations = [] // Array of wild fact definitions
    this.agenda = {};       // Rules to be executed by the next call to infer()

    // Note: A wild fact is a fact name that contains the wildcard '*'.
    // A wild fact can be general: "*.isHuman" or prefixed: 
    // "container.*.weight". The wild fact prefix (if any) defines the rule 
    // execution context. The rule execution context is composed by the
    // prefix and the actual wildcard value. For example, "container.*.weight"
    // will match both facts named "container.weight" and 
    // "container.frame.weight". The first context is "container.", 
    // the second context is "container.frame.". Context cannot be mixed in 
    // the same rule.

    
    this.trace = function(message) {
        if (this.listeners("trace").length > 0) {
            if (typeof message === "function") {
                this.emit("trace", message());
            } else {
                this.emit("trace", message);
            }
        }
    };
    
    this.addRule = function(ruleName, rule) {
        var ruleContent = rule.toString();
        var regex = /self\.get\(["']?(.*?)["']?\)/gm;
        var match = regex.exec(ruleContent);
        var factName;
        var prefix = "";
        this.rules[ruleName] = rule;
        while (match) {
            factName = match[1];
            if (factName.indexOf("*") === -1) {
                // we have a well defined rule
                if (this.relations[factName] === undefined) {
                    this.relations[factName] = {};
                }
                this.trace( function() { 
                    return "(AE) Adding rule '" + ruleName + 
                        "' to the engine relations."; 
                });
                this.relations[factName][ruleName] = true;
            } else { 
                // we have a wild rule
                var currentPrefix = factName.split("*")[0];
                if (prefix === "") {
                    prefix = currentPrefix;
                } else if (prefix != currentPrefix) {
                    throw "Context can not be changed for the same rule '" + 
                        ruleName + "'. Initial context: '" + prefix + 
                        "' new prefix: '" + currentPrefix +"'.";
                }
                if (this.wildRelations[factName] === undefined) {
                    this.wildRelations[factName] = {};
                }
                this.trace( function() { 
                    return "(AE) Adding rule '" + ruleName + 
                        "' related to " + factName +  " to the engine " +
                        "*wild* relations."; 
                });
                var factSplitted = factName.split("*");
                var factRegex = "(" + factSplitted[0].replace(".", "\\.")
                    + ".*)" + factSplitted[1].replace(".", "\\.");
                this.wildRelations.push({  // wildfact
                    factName: factName,
                    ruleName: ruleName,
                    regex: new RegExp(factRegex)
                });
            }
            match = regex.exec(ruleContent);
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
            var self = this;
            this.trace(function() { 
                return "(FC) Fact '" + factName + "' changed from '" + 
                    self.facts[factName] + "' to '" + value + "'";
            });
            this.facts[factName] = value;
            
            // Adding rule to the agenda based on direct relations with the fact.
            if (this.relations[factName] !== undefined) {
                var rules = this.relations[factName];
                var plannedRules = []; // for tracing purpose only
                for (var ruleName in rules) {
                    if (rules.hasOwnProperty(ruleName)) {
                        if (typeof this.agenda[ruleName] === "undefined") {
                            this.trace(function() { 
                                return "(AA) Adding rule '" + ruleName + 
                                    "' to the agenda."; 
                            });
                            this.agenda[ruleName] = { // ruledef
                                name: ruleName,
                                exec: this.rules[ruleName],
                                context: ""
                            };
                        }
                    }
                }
            }

            // Adding rules to the agenda based on wild fact-rule relations.
            for (var i = 0; i < this.wildRelations.length; i++) {
                var wildfact = this.wildRelations[i];
                var match = wildfact.regex.exec(factName);
                if (match) {
                    var context = match[1];
                    this.trace(function() {
                        return "(AA) Adding rule '" + wildfact.ruleName + 
                            "' to the agenda with context '" + context + "'.";
                    });
                    this.agenda[wildfact.rule + "|" + context] = { // ruledef
                        name: wildfact.ruleName,
                        exec: this.rules[wildfact.ruleName],
                        context: context
                    };
                }
            }

        }
    };

    this.infer = function(callback) {
        this.trace("(SI) Starting inference.");
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

