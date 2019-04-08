Infernal Engine
===============

[![Join the chat at https://gitter.im/formix/infernal-engine](https://badges.gitter.im/formix/infernal-engine.svg)](https://gitter.im/formix/infernal-engine?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://travis-ci.org/formix/infernal-engine.svg?branch=master)](https://travis-ci.org/formix/infernal-engine)

The **Infernal Engine** is a 0+ order logic, forward chaining, inference 
engine. Rules are mapped to each fact that it contains so that when a
fact is changed, each rule that uses that fact is added to the agenda for the 
next inference iteration. The agenda maps the rule name to the rule function 
to be executed which implies that a rule will never be executed more than 
once per inference iteration for a given agenda.

**Infernal Engine**'s internal facts and rules representation is a mapping 
between a name and a value or a function. A name is a list of contexts 
separated by slashes with a leading slash. For example, a fact could be named
"/engine/torque" and be mapped to the numeric value "175.5". The same goes 
for a rule named "/engine/maxTorque". The rule name is mapped to the function
that implements it. In this example, both the fact and the rule are under the 
same "/engine" context. This context assembly can be leveraged to do 
*relative fact reference* and *absolut fact reference* within the rule. Those 
concepts are explained later in this document.

**Infernal Engine**'s inference model can be defined using multiple simple 
JavaScript objects. A model is a JavaScript object that contains facts 
(properties) and rules (functions) without syntactic or structural constraints.
In other words, the model can be a JavaScript object of any depth and have any
structure. When loading the model, its structure is translated to the 
forward slash name format explained earlier. It is possible to conditionnaly 
bind together different collaborating models to create a runtime super-model.
A collaborating model can be loaded either between inference execution or 
during a rule interpretation. After the inference execution, the engine can 
return its full internal state as a JavaScript object or restraint the returned 
object to facts that changed during the last inference execution. In
both cases, rules are not included in that state.

**Infernal Engine** can have a tracing function attached to help debugging and 
track the inference sequence and actions.

[InfernalEngine class Reference](https://formix.github.io/infernal-engine/)

Usage
=====

## Using The "Raw" Engine

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();

// Adds a rule named "/increment" to increment the value of 'i' up to 5.
engine.addRule("increment", function(next) {
    var i = this.get("i");
    if (i < 5) {
        i++;
        this.set("i", i);
    } else if (i > 5) {
        return next(new Error("'i' must be lower or equal to 5."));
    }
    return next();
});

// Set a value to the fact "/i"
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
As you can see, a rule can retrigger itself if it changes a fact that this
same rule uses. More complex graph of fact-rule-fact relationship could trigger
that kind of loop and be verry difficult to debug. To prevent infinite loops,
**Infernal Engine** `infer` method is time limited. If the inference does not 
execute under 5 seconds, the engine stops and the `infer` callback is called 
with a timeout error. That timeout period can be changed by passing
another value (in milliseconds) to the `InfernalEngine` constructor.

## Defining a Model

A model is a way to define rules and facts using a simple Javascript object.
You can define a model in its own Node module. Alternatively, a single
module could export a set of related models in the same export.

```javascript
// insert the forward chaining wikipedia example implementation here...
```

## Calling `next` Within a Rule

You must return the call to the `next` callback to instruct the inference 
engine to execute the next inference step then to exit the current rule. 
Not returning the `next` result will cause a timeout error. See code 
examples above for details.

You can call the `next` callback with a single parameter. This will stop the 
inference and call the initial `infer` callback with the parameter you have 
set as the error object. Calling next with a parameter instruct the engine 
that an error happened during the rule inference. As stated above, you must 
return the `next` callback result even when it is called with an error 
parameter.

## Absolute Fact Reference

Absolute fact reference involves using a fact full name by including the 
leading "/". As a convention, a fact can be contextualized using a directory
like notation. For example: `/engine/torque` implies that the "torque" fact is
within the "engine" context starting at the root context. The context can 
be of any dept and thus form a complex hierarchy of facts.

## Relative Fact Reference 

Relative fact reference involves using a fact partial name within the current 
rule context. To refer to a relative fact, use the fact context without the 
leading "/" in the fact name. For eaxmple a rule named 
`/hoist/engine/checkPhaseCount` is within the base context 
`/hoist/engine`. Accessing any fact without a leading "/", will 
prepend the current rule context to the referenced fact. 

It is also possible to move up in the current context using "..". For example,
given the rule `/hoist/engine/checkPhaseCount` accessing the fact 
`../liftCapacity` within `checkPhaseCount` will access the 
`/hoist/liftCapacity` fact.


