Infernal Engine
===============

[![Join the chat at https://gitter.im/formix/infernal-engine](https://badges.gitter.im/formix/infernal-engine.svg)](https://gitter.im/formix/infernal-engine?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://travis-ci.org/formix/infernal-engine.svg?branch=master)](https://travis-ci.org/formix/infernal-engine)

This is the simplest and most efficient open source JavaScript inference 
engine implementation around. The engine is developed using NodeJS. An 
inference engine is a tool to build 
[expert systems](http://en.wikipedia.org/wiki/Expert_system). Expert
systems are used for many artificial intelligence implementations based on
knowledge. Video games use it to script opponents character AI and industries
use the concept to configure complex manufacturing products. You can even use
Infernal Engine to drive your web page UI rendering since it is now a Bower 
package!

[InfernalEngine class Reference](http://infernal-engine.formix.org/InfernalEngine.html)

Usage
=====

## Using The Engine

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();

// Adds a rule named "increment" to increment the value of 'i' up to 5.
engine.addRule("increment", function(next) {
    var i = this.get("i");
    if (i < 5) {
        i++;
    } else if (i > 5) {
        return next(new Error("'i' must be lower or equal to 5."));
    }
    this.set("i", i);
    return next();
});

// Set a value to the fact "i"
engine.set("i", 1);

// launches inference
engine.infer(function(err) {
    if (err) {
        console.log(err);
        return;
    }
    
    // will print "5"
    console.log(engine.get("i"));
});
```


## Defining a Model

A model is a way to define rules and facts using a simple Javascript object.
Usually, a model is defined in its own Node module. Alternatively, a single
module could export a set of related models in the same export.

```javascript
// module character.js

module.exports = {
    playerName: "",
    name: "",

    race: {
        selected: "human",
        options: ["human", "elf", "dwarf", "halfling", "gnome"],
        valid: true;

        validate: validateSelection
    },

    class: {
        selected: "wizard",
        options: ["fighter", "wizard", "cleric", "rogue"],
        valid: true,

        validate: validateSelection,
        
        updateOptions: function(next) {
            // update available classes based on AD&D 1st and 2nd edition
            var race = this.get("../race/selected");
            var options = [];
            if (race === "dwarf" || race === "halfling") {
                options = ["fighter", "rogue"];
            } else if (race === "elf" || race === "gnome") {
                options = ["fighter", "rogue", "wizard"];
            } else if (race === "human") {
                options: ["fighter", "wizard", "cleric", "rogue"],
            }
            this.set("options", options);
            return next();
        }
    }
};


function validateSelection(next) {
    var selected = this.get("selected");
    var options = this.get("options");
    var index = options.indexOf(selected);
    var valid = (index > -1);
    this.set("valid", valid);
    return next();
}
```

[Try it here!](https://tonicdev.com/5708161aed8bd01200bfc216/571e50620ec3e81700655fd1)

The previous example will insure that the selected option is valid for both
race and class. This is done using the same function reference 
`validateSelection` as the validation rule.

With the *Infernal Engine* You can reuse predefined functions
anywhere in your model as long as the model's fact structure supports that rule
reference requirements. Each rule is executed in its own context, even if the
same reference is used.

Changing the `race` value for "halfling" will in turn:

 1. launch the rule "/race/validate"
 2. set the fact "/race/valid" to true
 3. launch the rule "/class/updateOptions"
 4. change the fact "/class/options" to ["fighter", "rogue"]
 5. launch the rule "/class/validate"
 6. set the fact "/class/valid" to false

So changin the race from "human" to "halfling" while keeping the class 
"wizard" puts the character class in an invalid state since an halfling cannot
be a wizard!


## Calling `next` Within a Rule

You must return the call to the `next` callback to instruct the inference 
engine to execute the next inference step then to exit the current rule. 
Not returning the `next` result will cause a timeout error. See code 
examples above for details.

You can call the `next` callback with a single parameter. This will stop the 
inference and call the initial `infer` callback with the parameter you have 
set. Calling next with a parameter instruct the engine that an error happened
during the rule inference.

**Never execute the** `next` **callback without returning its result.**

*Note that this is not a breaking change from version 0.16.2. I introduce the
`return next()` paradigm to insure that `next` (same thing as `done`) is never
called twice within the same rule and that the programmer do not forget to
exit the rule after calling `next`. The engine does nothing with the result 
of the `next` function execution.*

## Absolute Fact Reference

Absolute fact reference involves using a fact full name, including the 
leading "/". As a convention, a fact can be contextualized using a directory
like notation. For example: `/character/race` implies that the "race" fact is
within the "character" context starting at the root context. The context can 
be of any dept and thus form a complex hierarchy of facts.

## Relative Fact Reference 

Relative fact reference involves using a fact partial name within the current 
rule context. To refer to a relative fact, use the fact context without the 
leading "/" in the fact name. For eaxmple a rule named 
`/hoist/engine/checkPhaseCount` is within the base context 
`/hoist/engine/`. Accessing any fact without a leading "/", will 
prepend the current rule context to the referenced fact. 

It is also possible to move up in the current context using "..". For example,
given the rule `/hoist/motor/checkPhaseCount` accessing the fact 
`../liftCapacity` within `checkPhaseCount` will access `/hoist/liftCapacity`.


