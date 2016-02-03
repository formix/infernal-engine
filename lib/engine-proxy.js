"use strict";

var utils = require("./utils");


module.exports = EngineProxy;


function EngineProxy(engine, ruleName) {
    this.engine = engine;
    this.ruleName = ruleName;
    this.context = utils.getContext("/", ruleName);
}


EngineProxy.prototype.get = function(factName) {
    var fullFactName = utils.getFullName(this.context, factName);
    return this.engine.get(fullFactName);
};


EngineProxy.prototype.set = function(factName, value) {
    var fullFactName = utils.getFullName(this.context, factName);
    this.engine.set(fullFactName, value);
    return this;
};


EngineProxy.prototype._executeRule = function(callback) {
   this.engine._rules[this.ruleName].call(this, callback);
   return this;
};
