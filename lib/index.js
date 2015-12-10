

module.exports = Infernal;



function Infernal() {
    this.facts     = {}; // Graph of facts
    this.rules     = {}; // Map between rule names and rules (function)
    this.relations = {}; // Map between fact names and all related rules
    this.agenda    = {}; // Rules to be executed by the next call to infer()
}


/**
 * Adds a set of rules to the engine.
 */
/*
Infernal.prototype.addRules = function(ruleSet, namespace) {
    var prefix = "";
    if (namespace) {
        prefix = namespace + ".";
    }
    for ( var ruleName in ruleSet) {
        if (ruleSet.hasOwnProperty(ruleName)) {
            this.addRule(prefix + ruleName, ruleSet[ruleName]);
        }
    }
};
*/


/**
 * Gets a value of the given factPath. A factPath is a hierarchy of facts 
 * separated by '/'.
 */
Infernal.prototype.get = function(factPath) {
    var hierarchy = factPath.split(/\//g);
    var root = this.facts;
    while (hierarchy.length > 0) {
        var factName = hierarchy.shift();
        if (!root[factName]) {
            return undefined;
        }
        root = root[factName];
    }
    return root;
};

/*
 * Sets a fact value at the given factPath.
 */
Infernal.prototype.set = function(factPath, value) {

    if (this.get(factPath) !== value) {
        var hierarchy = factPath.split(/\//g);
        var root = this.facts;
        while (hierarchy.length > 1) {
            var factName = hierarchy.shift();
            if (!root[factName]) {
                root[factName] = {};
            }
            root = root[factName];
        }
        root[hierarchy[0]] = value;

        /*
        if (this.relations[factPath] !== undefined) {
            var rules = this.relations[factPath];
            for (var rulePath in rules) {
                if (rules.hasOwnProperty(rulePath) && 
                        (typeof this.agenda[rulePath] === "undefined")) {
                    this.agenda[rulePath] = { // ruledef
                        path: rulePath,
                        exec: this.rules[rulePath]
                    };
                }
            }
        }
        */
    }

};



Infernal.prototype.addRule = function(rulePath, rule) {
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





Infernal.prototype.infer = function(callback) {
    var engine = this;
    process.nextTick(function() {
        infer(this, {
            step : 0,
            results : [],
            stop : false
        }, callback);
    });
};


function isObject(value) {
    if ((value === null) || (value === undefined)) {
        return false;
    }
    if ((value instanceof Date) || (value instanceof Array)) {
        return false;
    }
    return (value instanceof Object);
}

