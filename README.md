Infernal Engine
===============

[![Build Status](https://travis-ci.org/formix/infernal-engine.svg?branch=master)](https://travis-ci.org/formix/infernal-engine)

This is the first open source JavaScript inference engine implementation
around. The engine is developed using NodeJS. An inference engine is a tool
to build [expert systems](http://en.wikipedia.org/wiki/Expert_system). Expert
systems are used for many artificial intelligence implementations based on
knowledge. Video games use it to script opponents character AI and industries
use the concept to configure complex manufacturing products.

[Documentation Home](http://infernal-engine.formix.org)

Usage
=====

## Using The Engine

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();

// Adds a rule named "increment" to increment the value of 'i' up to 5.
engine.addRule("increment", function(done) {
    var i = this.get("i");
    if (i < 5) {
        i++;
    } else if (i > 5) {
        done(new Error("'i' must be lower or equal to 5."));
        return;
    }
    this.set("i", i);
    done();
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
        
        updateOptions: function(done) {
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
            done();
        }
    }
};


function validateSelection(done) {
    var selected = this.get("selected");
    var options = this.get("options");
    var index = options.indexOf(selected);
    var valid = (index > -1);
    this.set("valid", valid);
    done();
}
```

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


## Calling `done` Within a Rule

You must call the `done` callback to tell the inference engine that the current
rule finished executing. Otherwise, the engine will wait idle until timeout. You
can call the `done` callback with a single error parameter. This will stop the
inference and call the `infer` callback with the error parameter you have set.

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


