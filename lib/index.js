"use strict";

var Agenda      = require("./agenda");
var utils       = require("./utils");
var EngineProxy = require("./engine-proxy");

module.exports = InfernalEngine;


function InfernalEngine(timeout) {
    this._facts     = {}; // Graph of facts
    this._rules     = {}; // Map between rule names and rules (function)
    this._relations = {}; // Map between fact names and all related rules
    this._diffFacts = null; // A map of fact names that changed
    this._trace     = null; // the tracing function
    this._agenda    = new Agenda();
    this._infering  = false;

    this.timeout    = 5000;

    if (timeout) {
        this.timeout = timeout;
    }
}

/**
 * Resets the engine to its inintial state. Do not change timeout value 
 * nor the tracer function.
 */
InfernalEngine.prototype.reset = function() {
    this._facts     = {};
    this._rules     = {};
    this._relations = {};
    this._diffFacts = null;
    this._agenda    = new Agenda();
    this._infering  = false;
    if (typeof this._trace === "function") {
        process.nextTick(function() {
            this._trace({action: "reset"});
        });
    }
};

/**
 * Gets a value of the given factName. A factName is made of a context and 
 * the fact simple name separated by '/'. Accessing a fact from the engine
 * assumes the context to be "/". Within a rule, the context
 * would be the same as the rule context.
 * 
 * @param factName The fact name.
 *
 * @return the fact value.
 */
InfernalEngine.prototype.get = function(factName) {
    if (factName.charAt(0) !== "/") {
        return this.get("/" + factName);
    }

    var fact = utils.digPath.call(this, this._facts, factName);
    if (fact === undefined) {
        return undefined;
    }

    return fact.data[fact.name];
};


/**
 * Sets a fact value for the given factName.
 */
InfernalEngine.prototype.set = function(factName, value) {
   
    if (factName.charAt(0) !== "/") {
        return this.set("/" + factName, value);
    }

    var oldValue = this.get(factName);
    if (!utils.equals(oldValue, value)) {
        var fact = utils.digPath.call(this, this._facts, factName, true);
        
        if (this._diffFacts) {
            this._diffFacts[fact.fullName] = true;
        }
        
        var oldValue = fact.data[fact.name];

        fact.data[fact.name] = value;
        if (this._relations[factName] !== undefined) {
            var rules = this._relations[factName];
            for (var ruleName in rules) {
                if (rules.hasOwnProperty(ruleName) && 
                        (typeof this._agenda[ruleName] === "undefined")) {
                    var self = this;
                    this._agenda[ruleName] = new EngineProxy(this, ruleName);
                }
            }
        }

        if ((typeof this._trace === "function") && !this._infering) {
            process.nextTick((function() {
                var fullName = utils.getFullName(factName, "");
                this._trace({
                    action: "set",
                    fact: fullName,
                    oldValue: oldValue,
                    newValue: value
                });
            }).bind(this));
        }
    }

    return this;
};


/**
 * Adds a rule to the engine.
 * 
 * @param ruleName the rule name, each segment separated by a '/'. A rule 
 *                 name cannot ends with '/'.
 * @param rule     a function that receive one parameter, the done function.
 *                 This 'done' function must be called before exiting the
 *                 rule.
 *
 * @return         itself for method chaining. 
 */
InfernalEngine.prototype.addRule = function(ruleName, rule) {
    if (typeof ruleName === "function") {
        rule = ruleName;
        ruleName = "/" + rule.name;
    }
    
    if (ruleName.indexOf("/") !== 0) {
        ruleName = "/" + ruleName;
    }
    
    var ruleContent = rule.toString();
    var regex = /this\.get\(["']?(.*?)["']?\)/gm;
    var match = regex.exec(ruleContent);
    var factName;
    var prefix = "";
    this._rules[ruleName] = rule;

    while (match) {
        var context = utils.getContext("/", ruleName);
        factName = utils.getFullName(context, match[1]);
        if (this._relations[factName] === undefined) {
            this._relations[factName] = {};
        }
        this._relations[factName][ruleName] = true;
        match = regex.exec(ruleContent);
    }

    if (typeof this._trace === "function") {
        this._trace({action: "addRule", rule: ruleName});
    }

    return this;
};


/**
 * Gets the subset of facts that changed during the last call to infer().
 *
 * @return an object containing all facts that changed during the last 
 *         inference.
 */
InfernalEngine.prototype.getDiff = function() {
    var diff = {};
    for (var factName in this._diffFacts) {
        var fact = utils.digPath(diff, factName, true);
        fact.data[fact.name] = this.get(factName);
    }
    return diff;
};


InfernalEngine.prototype.getFacts = function() {
    return utils.deepCopy(this._facts);
};


InfernalEngine.prototype.setFacts = function(facts) {
    applyFacts.call(this, "", facts)
};


InfernalEngine.prototype.load = function(model) {
    this.reset();
    applyFacts.call(this, "", model, true);
};


InfernalEngine.prototype.infer = function(timeout, callback) {
    if (typeof timeout === "function") {
        var actualCallback = timeout;
        this.infer(this.timeout, actualCallback);
        return;
    }

    if (this._agenda.isEmpty()) {
        this._infering = false;
        clearTimeout(this.timeoutId);
        callback();
        return;
    }

    if (timeout > 0 ) {
        this._infering = true;
        this._diffFacts = {};
        this.timeoutId = setTimeout((function() {
            this._infering = false;
            callback(new Error( 
                "Inference timed out after " + timeout + " ms"));
            return;
        }).bind(this), timeout);
        if (typeof this._trace === "function") {
            process.nextTick((function() {
                this._trace({action: "infer"});
            }).bind(this));
        }
    }

    if (this._infering === false) {
        callback(new Error("The timeout parameter must be grater than zero " +
            "to start infering."));
        return;
    }

    var proxy = this._agenda.shift();
    
    process.nextTick((function() {
        proxy._executeRule((function(err) {
            if(err) {
                this._infering = false;
                clearTimeout(this.timeoutId);
                callback(err);
                return;
            }
            if (this._infering) {
                this.infer(0, callback);
            }
        }).bind(this));
    }).bind(this));
};


InfernalEngine.prototype.startTracing = function(traceFunction) {
    if (!traceFunction) {
        throw new Error("The parameter 'traceFunction' is mandatory.");
    }
    this._trace = traceFunction;
};

InfernalEngine.prototype.stopTracing = function() {
    this._trace = null;
};



// Private

function applyFacts(context, source, loading) {
    var sourceType = typeof source;
    if ((sourceType === "object") && (source instanceof Date)) {
        sourceType = "date";
    }
    if (sourceType === "function") {
        if (!loading) {
            return;
        } else {
            this.addRule(context, source);
        }
    }
    if (sourceType === "object") {
        for (var property in source) {
            applyFacts.call(this, context + "/" + property, source[property], loading);
        }
    } else {
        this.set(context, source);
    }
}


