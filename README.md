infernal-engine
===============

This is the first JavaScript inference engine implementation around. The 
engine is developed using NodeJS. An inference engine is a tool to build 
[expert systems](http://en.wikipedia.org/wiki/Expert_system). Expert systems 
are used for many artificial intelligence systems based on knowledge. Video 
games use it to script opponents or NPC reactions and industries use the 
concept to configure complex manufacturing products.

Usage
=====

## Simple incrementation rule with direct fact reference

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();

// adds a rule named "increment" to increment the value of 'i' up to 5.
engine.addRule("increment", function(self, done) {
	var i = self.get("i");
	if (i < 5) {
		i++;
	}
	self.set("i", i);
	done();
});

// Set a value to the fact "i"
engine.set("i", 1);

// launches inference
engine.infer(callback() {
	// will print "5"
	console.log(engine.get("i"));
});
```

Direct fact reference involves using a fact full name within the rule. As a
convention, a fact can be contextualized using dot notation. For example:
`character.race` implies that the "race" fact is within the "character"
context. The context can be of any dept and thus form a complex hierarchy
of facts.

A rule can refer to (`self.get`) or change (`self.set`) any number of facts 
using direct reference.

## Returning data from a rule

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();

// adds a rule named "increment" to increment the value of 'i' up to 5.
engine.addRule("increment", function(self, done) {
	var i = self.get("i");
	if (i < 5) {
		self.set("i", 5);
		done("Warning, 'i' value was too small, changed back to 5.");
		return;
	}
	done();
});

// Set a value to the fact "i"
engine.set("i", 1);

// launches inference
engine.infer(callback(info) {
	// will print "5"
	console.log(engine.get("i"));
	if (info.results.length > 0) {
		console.log(info.results[0].data);
	}
});
```

Since infernal-engine is asynchronous, you need to tell the engine when the 
current rule is done executing. You do that by calling the `done` callback 
function. This function can optionally take a `data` parameter of any type.
If you elect to pass data back to the engine, this object will be added to 
the results of the final execution information object passed to the inference 
callback function (infer). This is the structure of the 'information' object:

* step: the last step the engine executed before ending.
* stop: a flag telling if the inference loop have been stopped before it ends.
* results: an array of all results sent from the rule's `done` callback. The result object:
	* rule: the rule name from which this result originate.
    * context: the context of execution of the rule, if applicable, empty string otherwise
	* step: the step at which that result originate
	* data: the data received from the rule's `done` callback.
	
## Stopping the inference

If something goes really wrong, it may not be a good idea to let the 
inference go on. In this case, you can add a hint to the `data` object
passed to the `done` callback. Then you have to register for the 
InfernalEngine *step* event to scan the results of the last inference step 
(an inference step may involve calling many rules) for the hint you sent. If 
you receive the indication to stop the inference, then set the 'information' 
object property 'stop' to true. Note that InfernalEngine object is an 
EventEmitter with a single event registered on it named *step*.

It's a good practice to add a 'step' listener with a watchdog on the number 
of steps executed. If this number exceeds an arbitrary large value you have 
set in advance, then it may imply an infinite looping inference and thus stop
the engine to investigate.

The two cases stated above are demonstrated in the following example:

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();

engine.on("step", function(info) {
	var i, result;
	
	if (info.step > 500) {
		info.stop = true;
		return;
	}
	for(i = 0; i < info.results; i++) {
		result = info.results[i];
		if (result.data.level === "critical") {
			console.error(result.data.text);
			info.stop = true;
			return;
		}
	}
});

// adds a rule named "increment" to increment the value of 'i' up to 5.
engine.addRule("increment", function(self, done) {
	var i = self.get("i");
	if (i < 5) {
		i++;
	}
	if (i === 3) {
		done({
			level: "critical",
			text: "The value of 'i' can never EVER be equal to 3!"
		});
		return;
	}
	self.set("i", i);
	done();
});

// Set a value to the fact "i"
engine.set("i", 1);

// launches inference
engine.infer(callback() {
	// will print "5"
	console.log(engine.get("i"));
});
``` 

## Wild Rules or indirect fact reference

A real inference engine would not be good without some way to access and set
a fact inside an undefined or semi-defined context. For example, how can we 
define a rule that says that if "someone" is human then this "someone" is 
mortal? This is how to do it using an undefined context:

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();

engine.addRule("humanMortal", function(self, done) {
    if (self.get("*.isHuman")) {
        self.set("*.isMortal", true);
    }
    done();
});

engine.set("socrates.isHuman", true);

// launches inference
engine.infer(callback() {
	// will print "true"
	console.log(engine.get("socrates.isMortal"));
});
``` 

This is how to do it with a semi-defined context:

```javascript
var InfernalEngine = require("infernal-engine");
var engine = new InfernalEngine();

engine.addRule("humanMortal", function(self, done) {
    if (self.get("planetEarth.*.isHuman")) {
        self.set("*.isMortal", true);
    }
    done();
});

engine.set("planetEarth.socrates.isHuman", true);
engine.set("valhalla.odin.isHuman", true);

// launches inference
engine.infer(callback() {
	// will print "true"
	console.log(engine.get("planetEarth.socrates.isMortal"));
	
    // will print "undefined"
	console.log(engine.get("valhalla.odin.isMortal"));
});
``` 

In this particular case, the "humanMortal" rule do not apply to the "valhalla"
context, which is fine. Note that when you get a value from a undefined or 
semi-defined context, you can't get out of the given context other than to 
set fully defined fact values. Every other "get" calls have to be done in the
same context definition. Then setting a contextualized value can be done with
the asterisk notation. In this particular case, the asterisk refer to the full 
context.

## Tracing and Debugging Execution

The infernal-engine offers a very simple tracing macanism. To receive trace 
messages, register to the *trace* event and do whatever you like with the 
message. The most obvious option would be to write the message to the console 
or to a file.

```javascript
var engine = new InfernalEngine();
engine.on("trace", function(message) {
    console.log(message);
});

```

Tracing is quite slow. Don't expect great performances while doing it!

To debug it is quite easy. Since infernal-engine is a Nodejs application,
simply start your program with `node debug` or your favorite Nodejs debugger.
