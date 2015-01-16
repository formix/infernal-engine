infernal-engine
===============

This is the first JavaScript inference engine implementation around. The 
engine is developed using NodeJS and is intended to work both inside a 
server or in any browser. An inference engine is a tool to build 
[expert systems](http://en.wikipedia.org/wiki/Expert_system). Expert systems 
are the earliest implementations of artificial intelligence (late 1970). They 
are still widely used in video games and product configuration softwares 
these days. 

Usage
=====

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

_Woah! What happened? No loop but still, "i" is now "5"!_ 

Simple: when adding a rule to the engine, the "addRule" method scans the 
source code for each "self.get" method call. For each "self.get" found, a 
relationship between the specified fact (the "self.get" method's parameter)
and the rule is kept within the engine (a fact is the inference engine name 
for a variable). Then whenever the "engine.set" method is called on a fact, 
the engine scans the relations table to find each affected rules. If an
affected rule is found, then it is added to the planning. Calling 
"engine.infer()" executes every rules in the current planning. For sure, 
executing the current planning can cause some more facts to be changed. Those
changes are simply added to the next planning. So the "engine.infer()" method
will also execute all rules from the next planning and so on... until the 
next planning is empty, then it stops.

_I hate your explanation._

Right, me too. I'll try to simplify that one soon enough. But meanwhile, you must 
concede that the previous example was a little bit stupid as well. Why doing `i++` 
when we could assign "i" directly to "5"? For the sake of the example I'd say. And by
the way, changing a value behind the back of that good user isn't fair at all. He 
should be warned at least! Then this is how to do that:

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

Well, this is a good start. Now you know how to communicate back with the 
programmer. Note that the returned data from the "done" callback of the 
rule can pass on any kind of javascript data or object. it's up to you to 
decide. One other thing that could be useful here is the structure of the 
`info` object:

* step: the number of steps the inference engine took to complete.
* stop: a flag telling if the inference loop have been stopped before it ends.
* results: an array of all results sent from the rule callback. The result object:
	* rule: the rule name from which this result originate.
	* step: the step at which that result originate
	* data: the data received from the rule's `done` callback.
	
Finally, how do you stop the inference loop when something goes really wrong?
Simply put, the infernal-engine implements EventEmitter. Subscribe to the event
"step" and your function will be called after every inference step. One good
reason to do that is to count the number of steps taken for a single `infer()` 
call. 

A complex series of rules could lead to an infinite loop setting values to 
the same set of facts without ever converging. If `info.step` gets over 500 
(for example) you could suppose that the inference takes too long and decide 
to stop it. You could limit by execution time or even decide that a user 
input is so dumb that there is no point to waist computer cycles anymore. 
It's up to you to decide and this is how to do it (reusing my initial stupid 
example):

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
		if (result.level === "critical") {
			console.log("
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

