"use strict";

var Agenda = require("./agenda");
var utils = require("./utils");

module.exports = InfernalEngine;


function InfernalEngine(timeout) {
    this._facts     = {}; // Graph of facts
    this._rules     = {}; // Map between rule names and rules (function)
    this._relations = {}; // Map between fact names and all related rules
    this._agenda    = new Agenda();

    this._infering  = false;
    this._scope     = "/";

    this.timeout    = 5000;

    if (timeout) {
        this.timeout = timeout;
    }
}

/**
 * Resets the engine to its inintial state. Do not change timeout value.
 */
InfernalEngine.prototype.reset = function() {
    this._facts     = {};
    this._rules     = {};
    this._relations = {};
    this._agenda    = new Agenda();
    this._infering  = false;
    this._scope     = "/";
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
    var context = utils.getFullName(this._scope, factName);
    var fact = utils.digPath.call(this, this._facts, context);
    if (fact === undefined) {
        return undefined;
    }
    return fact.target[fact.name];
};


/**
 * Sets a fact value for the given factName.
 */
InfernalEngine.prototype.set = function(factName, value) {
    
    var factValue = this.get(factName);
    var valueComp = value;

    if (valueComp instanceof Date) {
        valueComp = valueComp.getTime();
    }

    if (factValue instanceof Date) {
        factValue = factValue.getTime();
    }

    var context = utils.getFullName(this._scope, factName);
    if (factValue !== valueComp) {
        var fact = utils.digPath.call(this, this._facts, context, true);
        fact.target[fact.name] = value;
        if (this._relations[context] !== undefined) {
            var rules = this._relations[context];
            for (var ruleName in rules) {
                if (rules.hasOwnProperty(ruleName) && 
                        (typeof this._agenda[ruleName] === "undefined")) {
                    var self = this;
                    this._agenda[ruleName] = { // exec
                        path: ruleName,
                        rule: self._rules[ruleName]
                    };
                }
            }
        }
    }

};



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
};


InfernalEngine.prototype.getFacts = function() {
    return utils.deepCopy(this._facts);
};


InfernalEngine.prototype.setFacts = function(facts) {
    utils.applyFacts.call(this, "", facts)
};


InfernalEngine.prototype.load = function(model) {
    this.reset();
    utils.applyFacts.call(this, "", model, true);
};


InfernalEngine.prototype.infer = function(timeout, callback) {
    if (typeof timeout === "function") {
        var actualCallback = timeout;
        this.infer(this.timeout, actualCallback);
        return;
    }

    if (this._agenda.isEmpty()) {
        this._infering = false;
        this._scope = "/";
        clearTimeout(this.timeoutId);
        callback();
        return;
    }

    if (timeout > 0 ) {
        this._infering = true;
        this.timeoutId = setTimeout((function() {
            this._infering = false;
            this._scope = "/";
            callback(new Error( 
                "Inference timed out after " + timeout + " ms"));
            return;
        }).bind(this), timeout);
    }

    if (this._infering === false) {
        this._scope = "/";
        callback(new Error("The timeout parameter must be grater than zero " +
            "to start infering."));
        return;
    }

    var exec = this._agenda.shift();

    var lastIndex = exec.path.lastIndexOf("/");
    var scope = "/";
    if (lastIndex > 0) {
        scope = exec.path.substring(0, lastIndex + 1);
    }
    if (scope.indexOf("/") > 0) {
        scope = "/" + scope;
    }
    this._scope = scope;

    process.nextTick((function() {
        exec.rule.call(this, (function(err) {
            if(err) {
                this._infering = false;
                clearTimeout(this.timeoutId);
                this._scope = "/";
                callback(err);
                return;
            }
            this._scope = "/";
            if (this._infering) {
                this.infer(0, callback);
            }
        }).bind(this));
    }).bind(this));
};



