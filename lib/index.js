
var Agenda = require("./agenda");


module.exports = Infernal;


function Infernal(timeout) {
    this.facts     = {}; // Graph of facts
    this.rules     = {}; // Map between rule names and rules (function)
    this.relations = {}; // Map between fact names and all related rules
    this.agenda    = new Agenda();

    this.infering  = false;
    this.scopes    = [];
    this.timeout   = 5000;

    if (timeout) {
        this.timeout = timeout;
    }
}


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
Infernal.prototype.get = function(factName) {
    var absolutePath = getAbsolutePath(this.scopes[0], factName);
    var fact = digPath.call(this, this.facts, absolutePath);
    if (fact === undefined) {
        return undefined;
    }
    return fact.target[fact.name];
};


/**
 * Sets a fact value for the given factName.
 */
Infernal.prototype.set = function(factName, value) {
    var absolutePath = getAbsolutePath(this.scopes[0], factName);
    if (this.get(factName) !== value) {
        var fact = digPath.call(this, this.facts, absolutePath, true);
        fact.target[fact.name] = value;
        if (this.relations[absolutePath] !== undefined) {
            var rules = this.relations[absolutePath];
            for (var ruleName in rules) {
                if (rules.hasOwnProperty(ruleName) && 
                        (typeof this.agenda[ruleName] === "undefined")) {
                    var self = this;
                    this.agenda[ruleName] = { // exec
                        path: ruleName,
                        rule: self.rules[ruleName]
                    };
                }
            }
        }
    }

};



Infernal.prototype.addRule = function(ruleName, rule) {
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
    this.rules[ruleName] = rule;
    while (match) {
        var homePath = getHomePath("/", ruleName);
        factName = getAbsolutePath(homePath, match[1]);
        if (this.relations[factName] === undefined) {
            this.relations[factName] = {};
        }
        this.relations[factName][ruleName] = true;
        match = regex.exec(ruleContent);
    }
};



Infernal.prototype.infer = function(timeout, callback) {
    if (typeof timeout === "function") {
        var actualCallback = timeout;
        this.infer(this.timeout, actualCallback);
        return;
    }

    if (this.agenda.isEmpty()) {
        this.infering = false;
        this.scopes = [];
        clearTimeout(this.timeoutId);
        callback();
        return;
    }

    if (timeout > 0 ) {
        this.infering = true;
        this.timeoutId = setTimeout((function() {
            this.infering = false; 
            callback(new Error( 
                "Inference timed out after " + timeout + " ms"));
            return;
        }).bind(this), timeout);
    }

    if (this.infering === false) {
        callback(new Error("The timeout parameter must be grater than zero " +
            "to start infering."));
        return;
    }

    var exec = this.agenda.shift();

    var lastIndex = exec.path.lastIndexOf("/");
    var scope = "/";
    if (lastIndex > 0) {
        scope = exec.path.substring(0, lastIndex + 1);
    }
    if (scope.indexOf("/") > 0) {
        scope = "/" + scope;
    }
    this.scopes.push(scope);

    process.nextTick((function() {
        exec.rule.call(this, (function(err) {
            if(err) {
                this.infering = false;
                clearTimeout(this.timeoutId);
                callback(err);
                return;
            }
            this.scopes.shift();
            if (this.infering) {
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
    var absolutePath = getAbsolutePath(base, path);
    var lastSlash = absolutePath.lastIndexOf("/");
    return absolutePath.substring(0, lastSlash + 1);
}

function getAbsolutePath(base, path) {
    var folders = [];
    if (path.indexOf("/") === 0) {
        // Since "path" starts with a '/' means that "path" is absolute. We 
        // don't care about the base path in that case.
        folders = folders.concat(path.split("/"));
    } else {
        if (!base || base === "/" || base.indexOf("/") !== 0) {
            // Makes sure that we have the empty item as the first element of 
            // the array to represents the root 'folder'.
            folders.push("");
        } else {
            folders = folders.concat(base.split("/"));
        }
        folders = folders.concat(path.split("/"));
    }

    // Here, "folders" should contains an array of all elements in the path.
    // We expect "folders[0]" to contains an empty string. That empty string
    // represents the root ot the path and must be there.

    var stack = [];
    for (var i = 0; i < folders.length; i++) {
        var folder = folders[i];
        if (i === 0 || folder !== "") {    
            // Keeps initial empty folder (root) and skip subsequent empty 
            // folders. This will make path like "/a/b//c" into "/a/b/c".
            if (folder === "..") {
                if (stack.length > 1) {
                    stack.pop();
                }
            } else {
                stack.push(folder);
            }
        }
    }

    var absolutePath = "";
    for (var i = 0; i < stack.length; i++) {
        if (i > 0) {
            absolutePath += "/";
        }
        absolutePath += stack[i];
    }

    return absolutePath;
}
