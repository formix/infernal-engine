Infernal Engine
===============

[![Join the chat at https://gitter.im/formix/infernal-engine](https://badges.gitter.im/formix/infernal-engine.svg)](https://gitter.im/formix/infernal-engine?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://travis-ci.org/formix/infernal-engine.svg?branch=master)](https://travis-ci.org/formix/infernal-engine)

The **Infernal Engine** is a 0+ order logic forward chaininginference 
engine. Rules are mapped to each fact that it contains so that when a
fact is changed, each rule that uses that fact is added to the agenda for the 
next inference iteration. The agenda maps the rule name to the rule function 
to be executed which implies that a rule will never be executed more than 
once per inference iteration for a given agenda. Moreover, rules that was not
affected by the last set of changes are not evaluated.

**Infernal Engine**'s internal facts and rules representation is a mapping 
between a name and a value or a function. A name is a list of contexts 
separated by slashes with a leading slash. For example, a fact could be named
"/engine/torque" and be mapped to the numeric value "175.5". The same goes 
for a rule named "/engine/checkTorque". The rule name is mapped to the function
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
return its full internal state as a JavaScript object or limit the returned 
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
any kind of weird loop patterns and be verry difficult to debug. To prevent 
insanity inducing infinite loops, **Infernal Engine** `infer` method is time 
constrained. If the inference does not execute under 5 seconds, the engine 
stops and the `infer` callback is called with a timeout error. That timeout 
period can be changed by passing another value (in milliseconds) to the 
`InfernalEngine` constructor.

## Defining a Model

A model is a way to define rules and facts using a simple Javascript object.
You can define a model in its own Node module. Alternatively, a single
module could export a set of related models in the same export.

In the following code block, I have translated the Wikipedia article example
for [forward chaining inference](https://en.wikipedia.org/wiki/Forward\_chaining)
into Infernal Engine representation. The WikiPedia example use natural 
language which is close to a first order logic inference engine while Infernal 
Engine is a 0+ order logic engine.

See [Philippe Morignot PDF presentation](http://philippe.morignot.free.fr/Articles/KnowledgeIFPschool.pdf) to know more about different inference engine order logics.

### Model Example

```javascript
var critterModel = {
  
  name: "Fritz",

  // We agree that setting a property to undefined is equivalent to not
  // defining anything. This is just for syntax reference.
  sound: undefined,
  eats: undefined,
  color: undefined,
  species: undefined,
  sings: undefined,

  isFrog: function(next){
    var sound = this.get("sound");
    var eats = this.get("eats");
    if (sound === "croaks" && eats === "flies") {
      this.set("species", "frog");
    }
    return next();
  },

  isCanary: function(next) {
    var sound = this.get("sound");
    var sings = this.get("sings");
    if ( sings && sound === "chirps" ) {
      this.set("species", "canary");
    }
    return next();
  },

  isGreen: function(next) {
    var species = this.get("species");
    if (species === "frog") {
      this.set("color", "green");
    }
    return next();
  },

  isYellow: function(next) {
    var species = this.get("species");
    if (species === "canary") {
      this.set("color", "yellow");
    }
    return next();
  }
};
```

##  Loading a Model

Using a model (or a sub-model) is pretty simple. All you have to do is to call
the engine's `load` method. Once the engine has some rules in it, changing any
fact will trigger the matching rules that use it. The engine default context 
is always set to the root (`/`) so you don't need to prepend the first 
forward-slash character within your program, at the engine level.

The following example displays the critter model before and after executing 
the inference:

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();
engine.load(critterModel);

engine.set("sound", "croaks");
engine.set("eats", "flies");

console.log(JSON.stringify(engine.getFacts(), null, "  "));
engine.infer(function(err) {
  if (err) {
    console.log(err);
    return;
  }
  console.log(JSON.stringify(engine.getFacts(), null, "  "));
});

```

**Output**
```
{
  "name": "Fritz",
  "sound": "croaks",
  "eats": "flies"
}
{
  "name": "Fritz",
  "sound": "croaks",
  "eats": "flies",
  "species": "frog",
  "color": "green"
}
```

The `Load` method crawls the model object structure and creates the matching
fact and rule mapings. This is how the fact and rules are mapped in the engine
based on the following model:

```javascript
var carModel = {

  name: "Minivan",
  
  speed: {
    userInput: "0",
    limit: 140,
    value: 0,

    checkLimit: function(next) {
      var speedInput = Number(this.get("userInput"));
      var limit = this.get("limit");
      var value = speedInput > limit ? limit : speedInput;
      this.set("value", value);
      return next();
    }
  }
}
```

**Facts**

| Name               | Value     |
|:------------------ |:---------:|
| "/name"            | "Minivan" |
| "/speed/userInput" | "0"       |
| "/speed/limit"     |       140 |
| "/speed/value"     |         0 |

**Rules**

| Name                | Value          |
|:------------------- |:--------------:|
| "/speed/checklimit" | *\[function\]* |

Before adding the rule to the rule map, the engine parses the function using
the regex `/this\.get\"(\.+\)"/`. For each match, it maps the referenced fact 
from the match group to the current rule in a multi-map. That allows the 
engine to match the exact rules to execute whenever a fact is changed. In this
case, the `checkLimit` rule will be added to the agenda whenever the 
`userInput` or the `limit` fact is changed. If both facts change during the 
same inference cycle, the rule is still added only once to the agenda.

I omitted the `userInput` validation in the rule for clarity purpose. To do 
that check, we could simply wrap the function body in a try/catch statement 
and call `return next(exception);` within the catch block. Doing that would 
kill the inference engine flow and jump directly to the `infer` method 
callback. To be gentler, we could as well use facts to inform the user about
his mistake. From there, I bet you already have some idea how to do that.
Something like `this.set("isValid", false);` and setting some meaningful
error message fact along with it would do the trick.

## Calling `next` Within a Rule

You must call the `next` callback to instruct the inference engine to execute 
the following steps. It is also important to leave the rule immediately after 
that call. Not exiting the rule after the `next` call or calling `next` 
multimple times in the same rule could cause unpredictable behavior. Keeping 
the `return` statement in front of the `next()` call (i.e.: `return next();`) 
is a good way to avoid problems.

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

It is also possible to move up relative to the current context by using 
the "..". For example, given the rule `/hoist/engine/checkPhaseCount` 
accessing the fact `../liftCapacity` within `checkPhaseCount` will access 
the `/hoist/liftCapacity` fact.

## Infernal Debugging

Debugging an inference engine's rule-fact relationship web is always a pain. 
**Infernal Engine** is no exception. Being tough is not a reason to avoid 
trying though. To help developpers following the inference steps, it is 
possible to register a tracing function to the engine. This is done by 
calling the `startTracing(function)` method. It is also possible to stop tracing by 
calling `stopTracing()` thereafter.

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();
engine.load(model);

engine.startTracing(function(trace) {
  console.log("-> ", JSON.stringify(trace))
});

engine.set("sound", "croaks");
engine.set("eats", "flies");

console.log(JSON.stringify(engine.getFacts(), null, "  "));
engine.infer(function(err) {
  if (err) {
    console.log(err);
    return;
  }
  console.log(JSON.stringify(engine.getFacts(), null, "  "));
});
```

**Output**
```
{
  "name": "Fritz",
  "sound": "croaks",
  "eats": "flies"
}
->  {"action":"set","fact":"/sound","newValue":"croaks"}
->  {"action":"addToAgenda","rule":"/isForg"}
->  {"action":"addToAgenda","rule":"/isCanary"}
->  {"action":"set","fact":"/eats","newValue":"flies"}
->  {"action":"infer"}
->  {"action":"set","fromRule":"/isForg","fact":"/species","newValue":"frog"}
->  {"action":"addToAgenda","rule":"/isGreen"}
->  {"action":"addToAgenda","rule":"/isYellow"}
->  {"action":"set","fromRule":"/isGreen","fact":"/color","newValue":"green"}
{
  "name": "Fritz",
  "sound": "croaks",
  "eats": "flies",
  "species": "frog",
  "color": "green"
}
```

# Final Note

I think this is the further I could go in term of inference engine using pure
JavaScript syntax. Doing a first order inference engine would involve creating
a special purpose language. That would require a transpiler to parse that 
syntax and make it JavaScript. Honestly, I don't know what would be the 
interest other than doing pure research. I also doubt that a JavaScript
engine could beat the performance that a native (or byte code) engine could 
reach.

I do believe though that this engine can be usefull in many cases. Especially 
when integrating into Web applications. I did not test its perdormances yet. 
That would be fun to see how (bad?) it would perform compared to 
[CLIPS](http://clipsrules.sourceforge.net/) or other forward chaining engines.

In any case, your feedbacks are welcome. Please use github issues to do so.
If you want to get involved, pull requests are welcome too!
