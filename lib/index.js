/**
 * Main module of the library, defines the class InfernalEngine and its
 * private methods.
 * Module index.js
 */

"use strict";

var Agenda      = require("./agenda");
var utils       = require("./utils");
var EngineProxy = require("./engine-proxy");

module.exports = InfernalEngine;


/**
 * InfernalEngine class constructor.
 * @class
 *
 * @param {number} [timeout=5000] - How long the inference can take before
 *        the inference callback is called with a timeout error.
 *
 * @property {number} timeout - The timeout value in milliseconds set by the 
 *                              constructor.
 */
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
        process.nextTick((function() {
            this._trace({action: "reset"});
        }).bind(this));
    }
};

/**
 * Gets a value of the given factName. A factName is made of a context and 
 * the fact simple name separated by '/'. Accessing a fact from the engine
 * assumes the context to be "/". Within a rule, the context
 * would be the same as the rule context.
 * 
 * @param {string} factName - The fact name.
 * @returns {*} the fact value.
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
 *
 * @param {string} factName - The fact name.
 * @param {*} value - The fact value to be set.
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
        
        updateAgenda.call(this, factName);

        if ((typeof this._trace === "function") && !this._infering) {
            process.nextTick((function() {
                this._trace({
                    action: "set",
                    fact: factName,
                    oldValue: oldValue,
                    newValue: value
                });
            }).bind(this));
        }
    }

    return this;
};


/**
 * Notifies the engine to consider the given factName was updated. This method
 * is usefull when changing the content of an array without changing the array
 * reference.
 *
 * @param {string} factName - The fact name that have to be considered 
 *                            changed by the engine.
 * @returns {InfernalEngine} A reference to "this" object for method chaining.
 */
InfernalEngine.prototype.notify = function(factName) {
    if (factName.charAt(0) !== "/") {
        return this.notify("/" + factName, value);
    }
    updateAgenda.call(this, factName);
    if ((typeof this._trace === "function") && !this._infering) {
        process.nextTick((function() {
            this._trace({
                action: "notify",
                fact: factName,
                newValue: value
            });
        }).bind(this));
    }
    return this;
};


/**
 * Adds a rule to the engine.
 * 
 * @param {string} ruleName
 *        The rule name, each segment separated by a '/'. A rule name cannot
 *        ends with '/'.
 *
 * @param {rule} rule 
 *        The rule function has only one paramter: the 'done' function. When
 *        the rule evaluation is terminated, the done function must be called
 *        to tell the engine to execute the next rule in the agenda.
 *
 * @returns {InfernalEngine} A reference to "this" object for method chaining.
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
 * @returns {object} an object containing all facts that changed during the 
 *                   last inference.
 */
InfernalEngine.prototype.getDiff = function() {
    var diff = {};
    for (var factName in this._diffFacts) {
        var fact = utils.digPath(diff, factName, true);
        fact.data[fact.name] = this.get(factName);
    }
    return diff;
};


/**
 * Gets a deep copy of the internal facts object. When a fact contains an 
 * array, that array reference is kept in the returned object. Modifying 
 * that array would result in modifying the original array from the internal
 * facts.
 * 
 * @returns {object} a deep copy of the internal facts.
 */
InfernalEngine.prototype.getFacts = function() {
    return utils.deepCopy(this._facts);
};

/**
 * Sets the internal facts to the values received in the facts parameter. The 
 * internal facts reference is not changed to the object received. Instead,
 * the object tree is is read and each fact it contains are "set" so that any
 * changes to the actual internal fact values will trigger rules as required. 
 * Functions are ingnored by that operation.
 *
 * @param {object} An object tree used to update internal facts.
 *
 * @returns {InfernalEngine} A reference to "this" object for method chaining.
 */
InfernalEngine.prototype.setFacts = function(facts) {
    applyFacts.call(this, "", facts)
    return this;
};

/**
 * Loads a model into the engine. This operation resets the engine and loads
 * that model's properties as facts and methods as rules.
 *
 * @param {object} model - A model object containing facts and rules.
 *
 * @returns {InfernalEngine} A reference to "this" object for method chaining.
 */
InfernalEngine.prototype.load = function(model) {
    this.reset();
    applyFacts.call(this, "", model, true);
    return this;
};


/**
 * Starts the inference. The inference executes all rules in the agenda. Once
 * the inference is done, either because the agenda is empty or becaus the 
 * inference timeout is reached, the callback method is called.
 *
 * @param {number} [timeout=InfernalEngine#timeout] The timeout period in 
 *        milliseconds given to the infer call.
 *
 * @param {inferenceCallback} callback - The function to be executed when done.
 *
 * @returns {InfernalEngine} A reference to "this" object for method chaining.
 */
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

    return this;
};


/**
 * Starts tracing the engine's operations.
 * @param {traceCallback} traceFunction The function called when an event
 *        is taking place. Events that generate a traceFunction call are:
 *        {@link InferenceEngine#reset}, 
 *        {@link InferenceEngine#set},
 *        {@link InferenceEngine#notify},
 *        {@link InferenceEngine#addRule},
 *        {@link InferenceEngine#infer} and
 *        {@link EngineProxy#trace}.
 *
 * @returns {InfernalEngine} A reference to "this" object for method chaining.
 */
InfernalEngine.prototype.startTracing = function(traceFunction) {
    if (!traceFunction) {
        throw new Error("The parameter 'traceFunction' is mandatory.");
    }
    this._trace = traceFunction;
    return this;
};

/**
 * Stops calling any trace callback that could have been defined. Has no 
 * effect if startStracing wasn't called before.
 *
 * @returns {InfernalEngine} A reference to "this" object for method chaining.
 */
InfernalEngine.prototype.stopTracing = function() {
    this._trace = null;
    return this;
};



// Private

function applyFacts(context, source, loading) {
    var sourceType = typeof source;
    if ((sourceType === "object") && (source instanceof Date)) {
        sourceType = "date";
    }
    
    if ((sourceType === "object") && (source instanceof Array)) {
        sourceType = "array";
    }
    
    if (sourceType === "function") {
        if (!loading) {
            return;
        } else {
            this.addRule(context, source);
        }

    } else if (sourceType === "object") {
        for (var property in source) {
            applyFacts.call(this, context + "/" + property, source[property], loading);
        }

    } else {
        this.set(context, source);
    }
}


function updateAgenda(factName) {
    if (this._relations[factName] !== undefined) {
        var rules = this._relations[factName];
        for (var ruleName in rules) {
            if (rules.hasOwnProperty(ruleName) && 
                    (typeof this._agenda[ruleName] === "undefined")) {
                this._agenda[ruleName] = new EngineProxy(this, ruleName);
            }
        }
    }
}


/**
 * The inference callback function.
 * @callback inferenceCallback
 * @param {Error|*} [err] - The error information if something wrong happened.
 */


/**
 * The done function tells the inference engine that the current rule is 
 * terminated and that the next rule shall be executed. If no more rule are in
 * the agenda, the {@link inferenceCallback} function is called without any 
 * parameter. If the done function is called with a parameter, the inference 
 * immediately stops (no more rules are executed from the agenda) and the 
 * {@link inferenceCallback} is called with the same parameter (the error).
 *
 * @callback done
 * @param {Error|*} [err] - The error information to send to the 
 *        {@link inferenceCallback}
 */


/**
 * The rule callback is a function that takes a single {@link done} callback 
 * method. This method is executed in the context of an {@link EngineProxy} 
 * instance. It is important to note that before exiting a rule function, the
 * done callback function has to be called to inform the engine that the next
 * rule in the agenda has to be executed. Usually after calling the done 
 * function the method should exits by explicitely calling 'return' or by 
 * letting the execution exit the scope of the function.
 *
 * @callback rule
 * @this EngineProxy
 * @param {done} done - The done callback to call when the rule terminate
 *                      execution.
 */

 /**
  * The trace callback is called when an event changing the engine state is 
  * hapenning. See {@link InfernalEngine#startTracing} for details.
  *
  * @callback traceCallback
  * @param {object} trace - The trace data.
  * @param {string} trace#action - Can be either 'reset', 'set', 'notify', 
  *                                'addRule', 'infer' or 'trace'.
  * @param {string} [trace#rule] - The rule name that generated the trace. This
  *                                property is undefined if the trace was not
  *                                generated during inference.
  * @param {string} [trace#fact] - The fact name if the trace action is 'set' 
  *                                or 'notify'.
  * @param {*} [trace#oldValue]  - The previous value of the fact if the trace
  *                                action is 'set'.
  * @param {*} [trace#newValue]  - The new value of the fact if trace action 
  *                                is 'set' or 'notify'.
  * @param {string} [trace#message] - The message sent by the 
  *                                {@ling EngineProxy#trace} method if trace
  *                                action is 'trace'.
  */
