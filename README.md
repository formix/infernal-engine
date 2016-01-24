infernal-engine
===============

This is the first JavaScript inference engine implementation around. The 
engine is developed using NodeJS. An inference engine is a tool to build 
[expert systems](http://en.wikipedia.org/wiki/Expert_system). Expert systems 
are used for many artificial intelligence implementations based on knowledge.
Video games use it to script opponents character AI and industries 
use the concept to configure complex manufacturing products.

Update Notes
============

## Version 0.10

This version is a major rewrite of the engine. After a year of self education
and some professional project developed in NodeJS, I rewrote the library. You 
will see a lot of algorithmic improvements (if you care about my source code)
and a better asynchronous API. The major change is the way to declare rule 
and fact names. Instead of using the "dot" notation (i.e. 
"department.marketting.updateScore"), we switched to a directory like notation
(i.e. "/department/marketting/updateScore"). This is a great improvement since
it is now possible to access facts relative to the current rule context,
specifiy fact by its absolute name (starting with "/") and move up in the path
using "..". See the *Usage* section below for more information.


Usage
=====

## Example

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

## Calling `done` Within a Rule

You must call the `done` callback to tell the inference engine that the current
rule finished executing. Otherwise, the engine will wait until it timeout. You
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
prepend the given base context. 

It is also possible to move up in the current context using "..". For example,
given the rule `/hoist/motor/checkPhaseCount` accessing the fact 
`../liftCapacity` will let the `checkPhaseCount` access `/hoist/liftCapacity`. 

InfernalEngine
==============

To use this module, install it by calling `npm install infernal-engine --save`.
Then in your program, do `require('infernal-engine')`.

## Constructor InfernalEngine([timeout])

Creates an InfernalEngine instance.

### Parameters

#### timeout

Optional parameter that sets the number of milliseconds given to the
inference before timing out. Default 5000 ms.


## InfernalEngine.addRule(ruleName, rule)

Adds a rule to the engine.

### Parameters

#### ruleName

The rule name must be a full path to that rule. For example: 
"/engine/frame/maxWidth". Within the rule function, all usages to get and
set will use the current rule home path (in the previous example 
"/engine/frame/") to access facts.

#### rule

A function that have a single argument (the done function).


## InfernalEngine.get(factName)

Gets the fact value of the given factName. The fact name can be relative (not
starting by '/') or absolute (starting by '/'). In the context of a rule 
execution, the current context is the same as the rule. Outside of a rule,
the context is set to the root ('/').

### Parameters

#### factName

The name of the fact we want to get.


## InfernalEngine.set(factName, value)

Sets a fact of the given factName to the given value.

### Parameters

#### factName

The name of the fact we want to get.

#### value

The value to set to the fact.


## InfernalEngine.infer([timeout], callback)

This method launch the inference with the given optional timeout and a 
callback executed when the inference is done.

### Parameters

#### [timeout]

Optional parameter. Time out in milliseconds before stopping the inference 
with a timeout error. If not set, uses the timeout from the given at 
construction.

#### callback

Called when the inference is done. Prototype `function(err)`. Will receive 
a value in the error parameter if something wrong happened during inference.


## InfernalEngine.getFacts()

Returns a copy of the engine's runtime facts in a object.


## InfernalEngine.setFacts(newFacts)

Sets the internal facts to the given `newFacts` object. The `newFacts` object
can be a subset of the current engine facts structure. Any value changed
by this method call could add a rule to be executed in the agenda.

### Paramters

#### newFacts

The fact object to be applied to the engine's runtime facts.
