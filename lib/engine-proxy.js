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
    var oldValue = this.engine.get(fullFactName);
    this.engine.set(fullFactName, value);



    if ((typeof this.engine._trace === "function") && !utils.equals(oldValue, value)) {
        var self = this;
        process.nextTick(function() {
            self.engine._trace({
                action: "set",
                rule: self.ruleName,
                fact: fullFactName,
                oldValue: oldValue,
                newValue: value
            });
        });
    }

    return this;
};


EngineProxy.prototype._executeRule = function(callback) {
   this.engine._rules[this.ruleName].call(this, callback);
   return this;
};
