# Infernal Engine #

[![Join the chat at https://gitter.im/formix/infernal-engine](https://badges.gitter.im/formix/infernal-engine.svg)](https://gitter.im/formix/infernal-engine?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://travis-ci.org/formix/infernal-engine.svg?branch=master)](https://travis-ci.org/formix/infernal-engine)

The **Infernal Engine** is a 1-order logic forward chaining inference
engine. Inference engine are used to build expert systems to modelise human
experience using rules. The goal of the engine is to maintain its internal
fact base concistent with its rules base. Each change to the fact or rule base
triggers the inference. It is possible to control how and when the inference
is fired using *models*.

[InfernalEngine class Reference](https://formix.github.io/infernal-engine/)

See [Philippe Morignot order logic explanations](http://philippe.morignot.free.fr/Articles/KnowledgeIFPschool.pdf)
to know more about different inference engine order logics.

## Usage ##

### Using The "Raw" Engine ###

```javascript
var InfernalEngine = require("infernal-engine");
let engine = new InfernalEngine();

await engine.addRule("count5", async (i) => {
    if (typeof i !== "undefined" && i < 5) {
        return { "i": i + 1 };
    }
});

await engine.set("i", 1);

let final_i = await engine.get("i");

console.log(final_i); // displays 5
```

Some things to consider for the above example:

  1. All **InfernalEngine** methods must be called with *await*.

  2. Rules must be async functions or async lambda expressions (with
     parenthesis, even with only one parameter).

  3. Defining a rule using the *#addRule* method triggers the inference for
     that rule. Therefore rules code must be resilient to undefined facts
     unless implemented within a *model* that has pre-initialized facts.

  4. Rules must either return nothing or an object that maps a relative or
     absolute fact reference. Those concepts are explained in details below.

  5. Asserting a fact is done using the *#set* method. Asserting new facts
     triggers the inference as well.

  6. If you want to know a fact value, call the *#get* method.

This simple example shows all the atomic inference methods of the
**InfernalEngine**. You can go from there and have fun building a complex web
of facts and rules already. But sincerely, your expert system programming
life would be pretty miserable without the *model*.

### Defining a Model ###

A model is a way to define rules and facts using a simple Javascript object.
The following code block translates the Wikipedia article example for
[forward chaining inference](https://en.wikipedia.org/wiki/Forward\_chaining)
into an InfernalEngine *model* representation.

#### Model Example ####

```javascript
var critterModel = {

  name: "Fritz",
  
  sound: "",
  eats: "",
  sings: false,

  color: "unknown",
  species: "unknown",
  
  isFrog: async function(sound, eats){
    let species = "unknown";
    if (sound === "croaks" && eats === "flies") {
      species = "frog";
    }
    return {"species": species};
  },

  isCanary: async function(sound, sings) {
    if ( sings && sound === "chirps" ) {
      return {"species": "canary"};
    }
  },
  
  isGreen: async function(species) {
    if (species === "frog") {
      return {"color": "green"};
    }
  },
  
  isYellow: async function(species) {
    if (species === "canary") {
      return {"color": "yellow"};
    }
  }

};
```

#### Importing a Model ####

A model is a javascript object with scalar values or arrays and methods.
Facts and rules paths are built based on their location in the object.
The internal representation of a model is explained in the next section.

The following example displays the critter model after setting two facts at
the same time:

```javascript
let InfernalEngine = require("infernal-engine");
let engine = new InfernalEngine();

let critterModel = require("./models/critterModel");

await engine.import(critterModel);
await engine.import({
    eats: "flies",
    sound: "croaks"
});

let state = await engine.export();
console.log(JSON.stringify(state, null, "  "));
```

#### Model structure output ####

```json
{
  "name": "Fritz",
  "sound": "croaks",
  "eats": "flies",
  "species": "frog",
  "color": "green"
}
```

In the above example, the inference runs twice: once after the model is
imported and another time after the facts `eats` and `sound` are imported.

Given the set of rules, the inference that runs after importing the
`critterModel` should not change anything to the internal fact base. On
another hand, inferring after importing `eats` and `sound` facts will update
the internal fact base.

This example shows how to set multiple facts at once and have the inferrence
being triggered only once. Using the `#set` method for each fact would have
worked as well but it would have launched the inference one more time.

It is also possible to import a model into a different path if the import
method `path` parameter was given. For example:

```javascript
await engine.import(critterModel, "/some/other/path");
```

Doing so would have resulted in the following JSON output:

```json
{
  "some": {
    "other": {
      "path" : {
        "name": "Fritz",
        "sound": "croaks",
        "eats": "flies",
        "species": "frog",
        "color": "green"
      }
    }
  }
}
```

Finally, the `export` method also supports the path parameter. When provided,
the exported model only contains facts that are under it. Given the previous
`import` example with a path, exporting the content of `"/some/other/path"`
would print the original output. Example:

```javascript
let state = await engine.export("/some/other/path");
```

Back to the original result:

```json
{
  "name": "Fritz",
  "sound": "croaks",
  "eats": "flies",
  "species": "frog",
  "color": "green"
}
```

### How models are represented internally ###

The `import` method crawls the model object structure and creates the matching
fact and rule mapings. This is how the fact and rules are mapped in the engine
based on the following model:

```javascript
let carModel = {

  name: "Minivan",

  speed: {
    input: "0",
    limit: 140,
    value: 0,

    inputIsValidInteger: async function(input) {
      let isInt = /^-?\d+$/.test(input);
      if (!isInt) {
        return { "../message": `Error: '${input}' is not a valid integer.` }
      }
      return { 
        "../message": undefined,
        value: Number(input) 
      };
    },
    
    valueIsUnderLimit: async function(value, limit) {
      if (value > limit) {
        return {
          value: limit,
          "/message": `WARN: The speed input can not exceed the speed limit of ${limit}.`
        }
      }
    }

  }
}
```

#### Facts ####

| Name               | Value     |
|:------------------ |:---------:|
| "/name"            | "Minivan" |
| "/speed/input"     | "0"       |
| "/speed/limit"     |       140 |
| "/speed/value"     |         0 |

#### Rules ####

| Name                         | Value          |
|:---------------------------- |:--------------:|
| "/speed/inputIsValidInteger" | *\[function\]* |
| "/speed/valueIsUnderLimit"   | *\[function\]* |

When adding a rule to the InfernalEngine, its parameters are parsed.
These parameter names are expected to exist within the same context as the
rule. If you want to reference a fact outside the current context or to use a
different variable name than the same context fact, it is possible to use the
parameter annotation `/*@ {path_to_fact} */`. See *Absolute Fact Reference*
and *Relative Fact Reference* for the `{path_to_fact}` syntax.

### Path, Context and Name ###

#### Path ####

A path is the full name of a fact or a rule. A path always begin with a "/"
and each segment of the path is separated by "/". Example:

- /name

- /speed/input

- /speed/inputIsValidInteger

Are three valid paths.

#### Name ####

The name of the rule or the fact is the last string after the last "/"
character. For example, the name in "/speed/input" is "input".

#### Context ####

The context is the path less the name. For example, the context in
"/speed/input" is "/speed/". For "/name" the context is simply "/" (aslo
called the root context).

### Absolute Fact Reference ###

Absolute fact reference involves using a fact full name by including the
leading "/". As a convention, a fact can be contextualized using a directory
like notation. Given the above minivan speed example, lets add a message
telling the user that the spped limit of the engine is reached:

```javascript
let carModel = {

  name: "Minivan",
  message: "",

  speed: {
    input: "0",
    limit: 140,
    value: 0,

    inputIsValidInteger: async function(input) {
      let isInt = /^-?\d+$/.test(input);
      if (!isInt) {
        return { "../message": `Error: '${input}' is not a valid integer.` }
      }
      return { 
        "../message": undefined,
        value: Number(input) 
      };
    },
    
    valueIsUnderLimit: async function(value, limit) {
      if (value > limit) {
        return {
          value: limit,
          "/message": `WARN: The speed input can not exceed the speed limit of ${limit}.`
        }
      }
    }

    // This rule is in the '/speed' context. To reach the /name fact,
    // it is possible to use the parameter annotation to set the modelName
    // parameter to the /name absolute fact. The same goes for the returned
    // /message2 fact.
    updateMessage: function(value, limit, /*@ /name */ modelName) {
      if (value === limit) {
        return {"/message2": `${modelName} ludicrous speed, GO!`};
      }
      return {"/message2": undefined};
    }
  }
}
```

In the above example, "../message" and "/message" reference the same
"message" fact. Since the "message" fact is directly in the root context and
the "input" fact is under the "/speed/" context, it is easy to see that poping
up one directory from "/speed/" takes the reference to the root context.

### Rule Parameters and Parameter Annotations ###

By default rules parameters are fetching facts that have the same name as the
given parameter from the same rule context. To reach a fact somewhere else in
the fact tree, a parameter can be prefixed with a special comment that we are
calling a **Parameter Annotation**. The parameter annotation lets you set the
exact fact path that shall be set to the following parameter. The syntax is:

`/*@ {path_to_fact} */`

`path_to_fact` can be either a relative or an absolute path.

### Relative and Absolute Fact Reference ###

Just like directory reference in a file system, facts can be referenced
using their relative path from the context of the executing rule. When
referencing a fact, "../" does pop up one path element. When the path
starts with "/", it references an absolute path from the root context.
To dig down inside the fact tree from the current context, just writhe the
path elements without a leading "/" like: "child/of/the/current/context".

### Metafacts ###

There is a special kind of facts that lies within the engine. Meta facts
can be referenced in a rule to know about the context of the current rule
execution. Meta facts cannot trigger rules that references them. They are
to be injected into rules that have been triggered by other fact changes.
Metafacts are in the "/$/" context. For now there is only two meta
facts:

  1. `/$/maxDepth` contains the value passed to the InfernalEngine constructor
     of the same name. It tells how many agenda can be generated in one
     inference run before failing.

  2. `/$/depth` is the current agenda generation. Its value starts at 1 and is
     always smaller or equal to `/$/maxDepth`.

You can add metafacts as well, they will not trigger any rule either. You can
even overwrite the aforementionned metafacts, but that change will last one
inference run or one agenda generation only. Obviously not a good idea but I
don't care since the engine is providing that information to you for your
benefits only. These two metafacts do not affect the actual internal state of
the InfernalEngine.

## Infernal Tracing ##

To trace what happens internally, provide a tracing function with one
parameter to the InfernalEngine constructor's second parameter. The following
code gives an example of that:

```javascript
const InfernalEngine = require("infernal-engine");
const model = require("../models/critterModel");

(async () => {
    let engine = new InfernalEngine(null, 
        msg => console.log("-> ", JSON.stringify(msg)));
    
    console.log("Importing the critterModel:");
    await engine.import(model);
    
    console.log("Initial model:")
    let initialModel = await engine.export();
    console.log(JSON.stringify(initialModel, null, "  "));
    
    console.log("Importing two facts to be asserted:");
    await engine.import({
        sound: "croaks",
        eats: "flies"
    })
    
    console.log("Inferred model:")
    let inferredModel = await engine.export();
    console.log(JSON.stringify(inferredModel, null, "  "));
})();
```

### Tracing outputs and resulting fact object ###

```json
Importing the critterModel:
->  {"action":"import","object":{"name":"Fritz","sound":"","eats":"","sings":false,"color":"unknown","species":"unknown"}}
->  {"action":"assert","fact":"/name","newValue":"Fritz"}
->  {"action":"assert","fact":"/sound","newValue":""}
->  {"action":"assert","fact":"/eats","newValue":""}
->  {"action":"assert","fact":"/sings","newValue":false}
->  {"action":"assert","fact":"/color","newValue":"unknown"}
->  {"action":"assert","fact":"/species","newValue":"unknown"}
->  {"action":"defRule","rule":"/isFrog","inputFacts":["/sound","/eats"]}
->  {"action":"addToAgenda","rule":"/isFrog"}
->  {"action":"defRule","rule":"/isCanary","inputFacts":["/sound","/sings"]}
->  {"action":"addToAgenda","rule":"/isCanary"}
->  {"action":"defRule","rule":"/isGreen","inputFacts":["/species"]}
->  {"action":"addToAgenda","rule":"/isGreen"}
->  {"action":"defRule","rule":"/isYellow","inputFacts":["/species"]}
->  {"action":"addToAgenda","rule":"/isYellow"}
->  {"action":"infer","maxGen":50}
->  {"action":"executeAgenda","gen":1,"ruleCount":4}
->  {"action":"execute","rule":"/isFrog","inputs":["",""]}
->  {"action":"execute","rule":"/isCanary","inputs":["",false]}
->  {"action":"execute","rule":"/isGreen","inputs":["unknown"]}
->  {"action":"execute","rule":"/isYellow","inputs":["unknown"]}
Initial facts:
{
  "name": "Fritz",
  "sound": "",
  "eats": "",
  "sings": false,
  "color": "unknown",
  "species": "unknown",
  "$": {
    "maxGen": 50,
    "gen": 1
  }
}
Importing two facts to be asserted:
->  {"action":"import","object":{"sound":"croaks","eats":"flies"}}
->  {"action":"assert","fact":"/sound","oldValue":"","newValue":"croaks"}
->  {"action":"addToAgenda","rule":"/isFrog"}
->  {"action":"addToAgenda","rule":"/isCanary"}
->  {"action":"assert","fact":"/eats","oldValue":"","newValue":"flies"}
->  {"action":"addToAgenda","rule":"/isFrog"}
->  {"action":"infer","maxGen":50}
->  {"action":"executeAgenda","gen":1,"ruleCount":2}
->  {"action":"execute","rule":"/isFrog","inputs":["croaks","flies"]}
->  {"action":"assert","fact":"/species","oldValue":"unknown","newValue":"frog"}
->  {"action":"addToAgenda","rule":"/isGreen"}
->  {"action":"addToAgenda","rule":"/isYellow"}
->  {"action":"execute","rule":"/isCanary","inputs":["croaks",false]}
->  {"action":"executeAgenda","gen":2,"ruleCount":2}
->  {"action":"execute","rule":"/isGreen","inputs":["frog"]}
->  {"action":"assert","fact":"/color","oldValue":"unknown","newValue":"green"}
->  {"action":"execute","rule":"/isYellow","inputs":["frog"]}
Inferred facts:
{
  "name": "Fritz",
  "sound": "croaks",
  "eats": "flies",
  "sings": false,
  "color": "green",
  "species": "frog",
  "$": {
    "maxGen": 50,
    "gen": 2
  }
}
```

## Final Note ##

This is the last release of the Infernal Engine for the 0 (pre-release)
version. The 1.0.0 release will feature a modernized javascript implementation
using promises with async/await syntax, classes, getters, setters, etc.

Your feedbacks are welcome. Please use github issues to do so.
If you want to get involved, pull requests are welcome too!
