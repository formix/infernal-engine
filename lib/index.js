
var Agenda = require("./agenda");


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
 * assumes the base context to be "/". Within a rule, the base context
 * would be the same as the rule context.
 * 
 * @param factName The fact name.
 *
 * @return the fact value.
 */
InfernalEngine.prototype.get = function(factName) {
    var context = getContext(this._scope, factName);
    var fact = digPath.call(this, this._facts, context);
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

    var context = getContext(this._scope, factName);
    if (factValue !== valueComp) {
        var fact = digPath.call(this, this._facts, context, true);
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
        var homePath = getHomePath("/", ruleName);
        factName = getContext(homePath, match[1]);
        if (this._relations[factName] === undefined) {
            this._relations[factName] = {};
        }
        this._relations[factName][ruleName] = true;
        match = regex.exec(ruleContent);
    }
};


InfernalEngine.prototype.getFacts = function() {
    return deepCopy(this._facts);
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



/**
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
        target: heap.pop(),
        name: hierarchy[0]
    };
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


function getHomePath(base, path) {
    var context = getContext(base, path);
    var lastSlash = context.lastIndexOf("/");
    return context.substring(0, lastSlash + 1);
}

function getContext(base, path) {
    var contextParts = [];
    if (path.indexOf("/") === 0) {
        // Since "path" starts with a '/' means that "path" is absolute. We 
        // don't care about the base path in that case.
        contextParts = contextParts.concat(path.split("/"));
    } else {
        if (!base || base === "/" || base.indexOf("/") !== 0) {
            // Makes sure that we have the empty item as the first element of 
            // the array to represents the root 'contextPart'.
            contextParts.push("");
        } else {
            contextParts = contextParts.concat(base.split("/"));
        }
        contextParts = contextParts.concat(path.split("/"));
    }

    // Here, "contextParts" should contains an array of all elements in the 
    // path. We expect "contextParts[0]" to contains an empty string. That
    // empty string represents the root ot the path and must be there.

    var stack = [];
    for (var i = 0; i < contextParts.length; i++) {
        var contextPart = contextParts[i];
        if (i === 0 || contextPart !== "") {    
            // Keeps initial empty contextPart (root) and skip subsequent empty
            // contextParts. This will make path like "/a/b//c" into "/a/b/c".
            if (contextPart === "..") {
                if (stack.length > 1) {
                    stack.pop();
                }
            } else {
                stack.push(contextPart);
            }
        }
    }

    var context = "";
    for (var i = 0; i < stack.length; i++) {
        if (i > 0) {
            context += "/";
        }
        context += stack[i];
    }

    return context;
}


function deepCopy(target, source) {
    if (typeof source !== "object") {
        return deepCopy({}, target);
    }
    if (typeof source !== "object" || (source instanceof Date)) {
        throw new Error("The 'source' parameter must be an object.");
    }
    for (var property in source) {
        var propertyType = typeof source[property];
        if (propertyType === "object" &&
                source[property] !== null &&
                !(source[property] instanceof Date)) {
            target[property] = target[property] || {};
            deepCopy(target[property], source[property]);
        } else if (propertyType !== "function") {
            target[property] = source[property];
        }
    }
    return target;
}


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
