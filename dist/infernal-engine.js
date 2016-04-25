(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["InfernalEngine"] = factory();
	else
		root["InfernalEngine"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Main module of the library, defines the class InfernalEngine and its
	 * private methods.
	 * Module infernal-engine
	 */
	
	"use strict";
	
	var Agenda      = __webpack_require__(2);
	var utils       = __webpack_require__(3);
	var EngineProxy = __webpack_require__(4);
	
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
	    this._changes   = null; // A map of fact names that changed
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
	    this._changes   = null;
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
	 * @param {function} [callback] - 
	 *        The callback(err, changes). Tha changes object is a mapping between
	 *        every fact names and their final value.
	 */
	InfernalEngine.prototype.set = function(factName, value, callback) {
	   
	    if (factName.charAt(0) !== "/") {
	        return this.set("/" + factName, value, callback);
	    }
	
	    var oldValue = this.get(factName);
	    if (!utils.equals(oldValue, value)) {
	        var fact = utils.digPath.call(this, this._facts, factName, true);
	        
	        if (this._changes) {
	            this._changes[fact.fullName] = value;
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
	
	        if (callback) {
	            this.infer((function(err) {
	                if (err) {
	                    callback(err);
	                    return;
	                }
	                callback(null, this.getChanges());
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
	    for (var factName in this._changes) {
	        var fact = utils.digPath(diff, factName, true);
	        fact.data[fact.name] = this.get(factName);
	    }
	    return diff;
	};
	
	
	/**
	 * Gets an object mapping the fact full name to the last change the given
	 * fact got through.
	 *
	 * @returns {object} A map of fact paths and their corresponding values.
	 */
	InfernalEngine.prototype.getChanges = function() {
	    return utils.deepCopy(this._changes);
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
	        this._changes = {};
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
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(1)))

/***/ },
/* 1 */
/***/ function(module, exports) {

	// shim for using process in browser
	
	var process = module.exports = {};
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;
	
	function cleanUpNextTick() {
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}
	
	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = setTimeout(cleanUpNextTick);
	    draining = true;
	
	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    clearTimeout(timeout);
	}
	
	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        setTimeout(drainQueue, 0);
	    }
	};
	
	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};
	
	function noop() {}
	
	process.on = noop;
	process.addListener = noop;
	process.once = noop;
	process.off = noop;
	process.removeListener = noop;
	process.removeAllListeners = noop;
	process.emit = noop;
	
	process.binding = function (name) {
	    throw new Error('process.binding is not supported');
	};
	
	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ },
/* 2 */
/***/ function(module, exports) {

	/**
	 * Module agenda
	 */
	
	"use strict";
	
	module.exports = Agenda;
	
	/**
	 * Create an empty Agenda.
	 * @class
	 */
	function Agenda() {
	}
	
	
	/**
	 * Removes the first element from the agenda and returns it.
	 * 
	 * @returns {EngineProxy} - The next EngineProxy to be executed.
	 */
	Agenda.prototype.shift = function() {
	    for (var key in this) {
	        if (key !== "shift" && key !== "isEmpty") {
	            var exec = this[key];
	            delete this[key];
	            return exec;
	        }
	    }
	}
	
	/**
	 * Tells if the agenda is empty.
	 *
	 * @returns {boolean} True if the agenda is empty, false otherwise.
	 */
	Agenda.prototype.isEmpty = function() {
	    for (var key in this) {
	        if (key !== "shift" && key !== "isEmpty") {
	            return false;
	        }
	    }
	    return true;
	}


/***/ },
/* 3 */
/***/ function(module, exports) {

	"use strict";
	
	exports.digPath     = digPath;
	exports.getContext  = getContext;
	exports.getFullName = getFullName;
	exports.deepCopy    = deepCopy;
	exports.equals      = equals;
	
	
	/*
	 * Dig a path in a root object until it finds the property that contains the 
	 * leaf element of the path.
	 *
	 * @param root   The root object to dig into
	 * @param path   The path formatted with forward slashes. Supports ".." to move 
	 *               up one object in the hierarchy.
	 * @param create If set to true, create the object tree while digging instead 
	 *               of returning undefined when encountering an undefined path 
	 *               element.
	 * 
	 * @return The last object in the path along with the target leaf name in an 
	 *         object having these two properties: 'target', 'name'. If create is
	 *         falsy, returns undefined if the path element don't exists in the 
	 *         object hierarchy.
	 */
	function digPath(facts, path, create) {
	    var hierarchy = path.split(/\//g);
	    var heap = [facts];
	    var root = facts;
	    var factFullName = "";
	    while (hierarchy.length > 1) {
	        var name = hierarchy.shift();
	        if (name === "..") {
	            if (heap.length !== 0) {
	                heap.pop();
	                if (heap.length === 0) {
	                    root = facts;
	                } else {
	                    root = heap[heap.length - 1];
	                }
	            }
	        } else if (name !== "") {
	            factFullName += "/" + name;
	            if (!root[name]) {
	                if (!create) {
	                    return undefined;
	                } else {
	                    root[name] = {};
	                }
	            }
	            root = root[name]
	            heap.push(root);
	        }
	    }
	    return {
	        data: heap.pop(),
	        name: hierarchy[0],
	        fullName: factFullName + "/" + hierarchy[0]
	    };
	}
	
	
	function getContext(currentContext, path) {
	    var fullName = getFullName(currentContext, path);
	    var lastSlash = fullName.lastIndexOf("/");
	    return fullName.substring(0, lastSlash + 1);
	}
	
	function getFullName(context, path) {
	    
	    if (!context || context.indexOf("/") !== 0) {
	        throw new Error("context must start with a '/'. Value: '" + 
	            context + "'");
	    }
	    
	    if (path.indexOf("/") === 0) {
	        // Since "path" starts with a '/' means that "path" is absolute. We 
	        // don't care about the context in that case.
	        return getFullName(path, "");
	    }
	
	    var contextArray = context.split("/");
	    var pathArray = path.split("/");
	    var contextStack = contextArray.concat(pathArray);
	
	    // Here, "contextStack" should contains an array of all elements in the 
	    // path. We expect "contextStack[0]" to contains an empty string. That
	    // empty string represents the root of the path and must be there.
	
	    var stack = [];
	    for (var i = 0; i < contextStack.length; i++) {
	        var contextPart = contextStack[i];
	        if (i === 0 || contextPart !== "") {    
	            // Keeps initial empty contextPart (root) and skip subsequent empty
	            // contextStack. This will make path like "/a/b//c" into "/a/b/c".
	            if (contextPart === "..") {
	                if (stack.length > 1) {
	                    stack.pop();
	                }
	            } else {
	                stack.push(contextPart);
	            }
	        }
	    }
	
	    var fullName = "";
	    for (var i = 0; i < stack.length; i++) {
	        if (i > 0) {
	            fullName += "/";
	        }
	        fullName += stack[i];
	    }
	
	    return fullName;
	}
	
	
	function deepCopy(target, source) {
	    var sourceType = typeof source;
	    if (sourceType !== "object") {
	        return deepCopy({}, target);
	    }
	    if (sourceType !== "object" || (source instanceof Date)) {
	        throw new Error("The 'source' parameter must be an object.");
	    }
	    for (var property in source) {
	        var propertyType = typeof source[property];
	        if ((propertyType === "object") &&
	                (source[property] !== null) &&
	                !(source[property] instanceof Date) &&
	                !(source[property] instanceof Array)) {
	            target[property] = target[property] || {};
	            deepCopy(target[property], source[property]);
	        } else if (propertyType !== "function") {
	            target[property] = source[property];
	        }
	    }
	    return target;
	}
	
	
	function equals(a, b) {
	    var aValue = a;
	    if (a instanceof Date) {
	        aValue = a.getTime(); 
	    }
	    var bValue = b;
	    if (b instanceof Date) {
	        bValue = b.getTime();
	    }
	    return (aValue === bValue) && ((typeof a) === (typeof b));
	}


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {"use strict";
	
	var utils = __webpack_require__(3);
	
	
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
	   this.engine._rules[this.ruleName].call(this, callback);
	   return this;
	};
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(1)))

/***/ }
/******/ ])
});
;
//# sourceMappingURL=infernal-engine.js.map