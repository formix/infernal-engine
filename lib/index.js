
var Agenda = require("./agenda");


module.exports = Infernal;



function Infernal() {
    this.facts     = {}; // Graph of facts
    this.rules     = {}; // Map between rule names and rules (function)
    this.relations = {}; // Map between fact names and all related rules
    this.agenda    = new Agenda();

    this.infering  = false;
    this.scopes    = [];
    this.timeout   = 5000;
}


/**
 * Gets a value of the given factPath. A factPath is a hierarchy of facts 
 * separated by '/'.
 */
Infernal.prototype.get = function(factPath) {
    var absolutePath = getAbsolutePath.call(this, factPath);
    var fact = digPath.call(this, this.facts, absolutePath);
    if (fact === undefined) {
        return undefined;
    }
    return fact.target[fact.name];
};


/*
 * Sets a fact value at the given factPath.
 */
Infernal.prototype.set = function(factPath, value) {
    var absolutePath = getAbsolutePath.call(this, factPath);
    if (this.get(factPath) !== value) {
        var fact = digPath.call(this, this.facts, factPath, true);
        fact.target[fact.name] = value;
        if (this.relations[factPath] !== undefined) {
            var rules = this.relations[factPath];
            for (var rulePath in rules) {
                if (rules.hasOwnProperty(rulePath) && 
                        (typeof this.agenda[rulePath] === "undefined")) {
                    var self = this;
                    this.agenda[rulePath] = { // exec
                        path: rulePath,
                        rule: self.rules[rulePath]
                    };
                }
            }
        }
    }

};



Infernal.prototype.addRule = function(rulePath, rule) {
    if (typeof rulePath === "function") {
        rule = rulePath;
        rulePath = rule.name;
    }
    var ruleContent = rule.toString();
    var regex = /this\.get\(["']?(.*?)["']?\)/gm;
    var match = regex.exec(ruleContent);
    var factPath;
    var prefix = "";
    this.rules[rulePath] = rule;
    while (match) {
        factPath = match[1];
        if (this.relations[factPath] === undefined) {
            this.relations[factPath] = {};
        }
        this.relations[factPath][rulePath] = true;
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


function getAbsolutePath(path) {
    var absolutePath = path.trim();
    if (path.trim().indexOf("/") > 0) {
        var scope = "/";
        if (this.scopes.length > 0) {
            scope = this.scopes[0];
        }
        absolutePath = scope + path.trim();
    }
    return absolutePath;
}
