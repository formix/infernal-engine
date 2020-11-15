"use strict";

var utils = require("./utils");


module.exports = EngineProxy;

/**
 * Creates an engine proxy class to hold a rule context of execution.
 * @class
 * @param {InfernalEngine} engine - The engine being proxied.
 * @param {string} - the rule name that will execute under the EngineProxy 
 *                   context.
 */
function EngineProxy(engine, ruleName) {
    this.engine = engine;
    this.ruleName = ruleName;
    this.context = utils.getContext("/", ruleName);
}


/**
 * Gets the fact value for the given factName. Note that the factName can be 
 * a relative path to the current rule context. Usage of ".." allows to go
 * up the context stack to reach parents and sibling facts.
 *
 * @param {string} factName - The fact name.
 * 
 * @returns {*} The fact value.
 */
EngineProxy.prototype.get = function(factName) {
    var fullFactName = utils.getFullName(this.context, factName);
    return this.engine.get(fullFactName);
};


/**
 * Sets a fact value for the given fact name. The fact name can be a relative 
 * path. See {@link EngineProxy#get} for details.
 *
 * @oaram {string} factName - the fact name.
 * @param {*} value - The value to set to the fact.
 *
 * @returns {EngineProxy} A reference to "this" object for method chaining.
 */
EngineProxy.prototype.set = function(factName, value) {

    if ((typeof this.engine._trace === "function") && !utils.equals(oldValue, value)) {
        var self = this;
        process.nextTick(function() {
            self.engine._trace({
                action: "set",
                fromRule: self.ruleName,
                fact: fullFactName,
                oldValue: oldValue,
                newValue: value
            });
        });
    }

    var fullFactName = utils.getFullName(this.context, factName);
    var oldValue = this.engine.get(fullFactName);
    this.engine.set(fullFactName, value);

    return this;
};

/**
 * Notifies that the given fact has changed. The fact name can be a relative 
 * path. See {@link EngineProxy#get} for details.
 *
 * @param {string} factName - The fact name.
 *
 * @returns {EngineProxy} A reference to "this" object for method chaining.
 */
EngineProxy.prototype.notify = function(factName) {
    var fullFactName = utils.getFullName(this.context, factName);
    this.engine.notify(fullFactName);
    return this;
};


/**
 * This method sends a trace message to the tracing function, if tracing 
 * is activated.
 *
 * @param {string} message - The message to send to the trace function.
 *
 * @returns {EngineProxy} A reference to "this" object for method chaining.
 */
EngineProxy.prototype.trace = function(message) {
    if (typeof this.engine._trace === "function") {
        var self = this;
        process.nextTick(function() {
            self.engine._trace({
                action: "trace",
                rule: self.ruleName,
                message: message
            });
        });
    }
    return this;
}


// private
EngineProxy.prototype._executeRule = function(callback) {
    let rule = this.engine._rules[this.ruleName];
    let params = [callback];
    rule.inputFacts.forEach(factName => {
        params.push(this.engine.get(factName))
    });
    rule.run.apply(this, params);
    return this;
};
