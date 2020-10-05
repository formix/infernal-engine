# Infernal Engine #

[![Join the chat at https://gitter.im/formix/infernal-engine](https://badges.gitter.im/formix/infernal-engine.svg)](https://gitter.im/formix/infernal-engine?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://travis-ci.org/formix/infernal-engine.svg?branch=master)](https://travis-ci.org/formix/infernal-engine)

The **Infernal Engine** is a 0+ order logic forward chaining inference
engine. Rules are mapped to facts that are requested by the rule as function
parameters. The returned fact map is applied back to the fact database.
Unaffected rules are not evaluated, rules that are triggered more than once
in the same evaluation are executed only once at the end of the rule execution
sequence.

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

## Usage ##

### Using The "Raw" Engine ###

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();

// Adds a rule named "/increment" to increment the value of 'i' up to 5, one
// increment at time.
engine.addRule("increment", function(next, i) {
    if (i < 5) {
        return next(null, {"i": i + 1});
    } else if (i > 5) {
        return next(new Error("'i' must be lower or equal to 5."));
    }
    return next();
});

// Set a value to the fact "i". the change from 'unknown' to 1 adds the
// rule 'increment' to the execution agenda.
engine.set("i", 1);

// Launch the inference: execute the current agenda and builds the next-agenda
// when the rule change the fact 'i'. Then set the current agenda to the next
// agenda. If the current agenda is not empty, execute 'infer' again. if the
// current agenda is empty, execute the callback function.
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
same rule uses. More complex graph of fact to rules relationships can lead to
infinite loops. To to preserve tour sanity, **Infernal Engine** `infer` method
is time constrained. If the inference does not execute under 5 seconds,
the engine stops and the `infer` callback is called with a timeout error.
That timeout period can be changed by passing another value (in milliseconds)
to the `InfernalEngine` constructor.

### Defining a Model ###

A model is a way to define rules and facts using a simple Javascript object.
You can define a model in its own Node module. Alternatively, a single
module could export a set of related models.

In the following code block, I have translated the Wikipedia article example
for [forward chaining inference](https://en.wikipedia.org/wiki/Forward\_chaining)
into Infernal Engine representation. The WikiPedia example use natural
language which is close to a first order logic inference engine. Infernal Engine
is a 0+ order logic engine.

See [Philippe Morignot PDF presentation](http://philippe.morignot.free.fr/Articles/KnowledgeIFPschool.pdf)
to know more about different inference engine order logics.

#### Model Example ####

```javascript
var critterModel = {

  name: "Fritz",

  // We agree that setting a property to undefined is equivalent to not
  // defining anything. This is just for syntax reference. These properties
  // do not have to be defined in the model.
  sound: undefined,
  eats: undefined,
  color: undefined,
  species: undefined,
  sings: undefined,

  isFrog: function(next, sound, eats){
    let species = "unknown";
    if (sound === "croaks" && eats === "flies") {
      species = "frog";
    }
    return next(null, {"species": species})
  },

  isCanary: function(next, sound, sings) {
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

#### Loading a Model ####

Using a model (or a sub-model) is pretty simple. All you have to do is to call
the engine's `load` method. Once the engine has some rules in it, changing any
fact will add any rules that use it to the agenda. The engine default context
is always set to root (`/`) so you don't need to prepend the first forward-slash
character within your program when working at the engine level.

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

#### Model structure output ####

```json
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

### How models are represented internally ###

The `Load` method crawls the model object structure and creates the matching
fact and rule mapings. This is how the fact and rules are mapped in the engine
based on the following model:

```javascript
let carModel = {

  name: "Minivan",

  speed: {
    speedInput: "0",
    limit: 140,
    value: 0,

    checkLimit: function(next, speedInput, limit) {
      var newValue = speedInput > limit ? limit : speedInput;
      return next(null, {"value": newValue});
    }
  }
}
```

#### Facts ####

| Name               | Value     |
|:------------------ |:---------:|
| "/name"            | "Minivan" |
| "/speed/userInput" | "0"       |
| "/speed/limit"     |       140 |
| "/speed/value"     |         0 |

#### Rules ####

| Name                | Value          |
|:------------------- |:--------------:|
| "/speed/checklimit" | *\[function\]* |

When adding a rule to the Infernal Engine, the rule's parameters are parsed
excluding the `next` callback. These parameter names are expected to exist
within the same context as the rule. If you want to reference a fact outside
the current context or to use a different variable name than the same context
fact, it is possible to use the parameter annotation `/*@ {path_to_fact} */`.
See *Absolute Fact Reference* and *Relative Fact Reference* for the
`{path_to_fact}` syntax.

### Calling `next` Within a Rule ###

You must call the `next` callback to instruct the inference engine to execute
the following steps. It is also important to leave the rule immediately after
that call. Not exiting the rule after the `next` call or calling `next`
multimple times in the same rule without returning afterward could cause
unpredictable behavior. Keeping the `return` statement in front of the `next()`
call (i.e.: `return next();`) is a good way to avoid problems.

The `next` callback first parameter is the error parameter. If set to a
truthy value, this will stop the inference and call the initial `infer`
callback with that error value. The second parameter is an optionnal
JavaScript object mapping facts to the new values to be set in the engine using
relative or absolute fact names.

### Absolute Fact Reference ###

Absolute fact reference involves using a fact full name by including the
leading "/". As a convention, a fact can be contextualized using a directory
like notation. Given the above minival speed example, lets add a message
telling the user that the spped limit of the engine is reached:

```javascript
let carModel = {

  name: "Minivan",
  message: "",

  speed: {
    speedInput: "0",
    limit: 140,
    value: 0,

    checkLimit: function(next, speedInput, limit) {
      var newValue = speedInput > limit ? limit : speedInput;
      return next(null, {"value": newValue});
    },

    // This rule is in the '/speed' context. To reach the /name fact,
    // it is possible to use the parameter annotation to set the modelName
    // parameter to the /name absolute fact. The same goes for the returned
    // /message fact.
    updateMessage: function(next, value, limit, /*@ /name */ modelName) {
      if (value === limit) {
        return next(null, {"/message": `${modelName} ludicrous speed, GO!`});
      }
      return next(null, {"/message": ""});
    }
  }
}
```

### Relative Fact Reference ###

Again, just like directory reference in a file system, facts can be referenced
using their relative path:

```javascript
let carModel = {

  name: "Minivan",
  message: "",

  speed: {
    speedInput: "0",
    limit: 140,
    value: 0,

    checkLimit: function(next, speedInput, limit) {
      var newValue = speedInput > limit ? limit : speedInput;
      return next(null, {"value": newValue});
    },

    updateMessage: function(next, value, limit, /*@ ../name */ modelName) {
      if (value === limit) {
        return next(null, {"../message": `${modelName} ludicrous speed, GO!`});
      }
      return next(null, {"../message": ""});
    }
  }
}
```

## Infernal Debugging ##

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

### Model structure and debugging outputs ###

```json
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

## Final Note ##

This is the last release of the Infernal Engine for the 0 (pre-release)
version. The 1.0.0 release will feature a modernized javascript implementation
using promises with async/await syntax, properties and indexer.

Your feedbacks are welcome. Please use github issues to do so.
If you want to get involved, pull requests are welcome too!
