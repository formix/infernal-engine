

module.exports = Infernal;



function Infernal() {
    this.facts     = {}; // Map between fact names and fact values
    this.rules     = {}; // Map between rule names and rules (function)
    this.relations = {}; // Map between fact names and all related rules
    this.agenda    = {}; // Rules to be executed by the next call to infer()
}


Infernal.prototype.addRule = function(ruleName, rule) {
    var ruleContent = rule.toString();
    var regex = /this\.get\(["']?(.*?)["']?\)/gm;
    var match = regex.exec(ruleContent);
    var factName;
    var prefix = "";
    this.rules[ruleName] = rule;
    while (match) {
        factName = match[1];
        if (this.relations[factName] === undefined) {
            this.relations[factName] = {};
        }
        this.relations[factName][ruleName] = true;
        match = regex.exec(ruleContent);
    }
};


/**
 * Adds a set of rules to the engine.
 */
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

Infernal.prototype.get = function(factName) {
    var value = this.facts[factName];
    if (value instanceof Array) {
        // array facts are intransitive!
        var array = [];
        for (var i = 0; i < value.length; i++) {
            array.push(value[i]);
        }
        return array;
    } else {
        return value;
    }
};


Infernal.prototype.set = function(factName, value) {
    if (this.facts[factName] !== value) {
        var self = this;
        this.facts[factName] = value;
        
        // Adding rule to the agenda based on direct relations with the fact.
        if (this.relations[factName] !== undefined) {
            var rules = this.relations[factName];
            var plannedRules = []; // for tracing purpose only
            for (var ruleName in rules) {
                if (rules.hasOwnProperty(ruleName) && 
                        (typeof this.agenda[ruleName] === "undefined")) {
                    this.agenda[ruleName] = { // ruledef
                        name: ruleName,
                        exec: this.rules[ruleName],
                        context: ""
                    };
                }
            }
        }

        // Adding rules to the agenda based on wild fact-rule relations.
        for (var i = 0; i < this.wildRelations.length; i++) {
            var wildfact = this.wildRelations[i];
            var match = wildfact.regex.exec(factName);
            if (match) {
                var context = match[1];
                this.agenda[wildfact.rule + "|" + context] = { // ruledef
                    name: wildfact.ruleName,
                    exec: this.rules[wildfact.ruleName],
                    context: context
                };
            }
        }

    }
};


Infernal.prototype.infer = function(callback) {
    var engine = this;
    process.nextTick(function() {
        infer(engine, {
            step : 0,
            results : [],
            stop : false
        }, callback);
    });
};










function infer(engine, info, callback) {
    if (isEmpty(engine.agenda)) {
        callback(null, info);
        return;
    } else if (info.step > 0) {
        engine.emit("step", info);
        if (info.stop) {
            return;
        }
    }

    var current = engine.agenda;
    engine.agenda = {};

    var currentRules = [];
    for ( var ruleName in current) {
        if (current.hasOwnProperty(ruleName)) {
            currentRules.push(current[ruleName]);
        }
    }

    info.step++;

    process.nextTick(function() {
        execRules(engine, currentRules, info, callback);
    });

}

function execRules(engine, currentRules, info, callback) {  // jshint ignore:line

    if (currentRules.length === 0) {
        infer(engine, info, callback);
        return;
    }

    var ruledef = currentRules.pop();

    process.nextTick(function() {
        var wrapper = new EngineWrapper(engine, ruledef)
        wrapper.exec(function(data) {
            if (data) {
                var result = {
                    rule : ruledef.name,
                    context: ruledef.context,
                    step : info.step,
                    data : data
                };
                info.results.push(result);
            }
            execRules(engine, currentRules, info, callback);
        });
    });
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

