

function EngineWrapper(engine, ruledef) {

    this._engine = engine;
    this._ruledef = ruledef;

}


EngineWrapper.prototype.set = function(factName, value) {

    var splittedFact = factName.split("*");
    
    if (splittedFact.length === 1) {
        this._engine.set(factName, value);
        return;
    }

    var contextFactName = this._ruledef.context + splittedFact[1];
    this._engine.set(contextFactName, value);
};


EngineWrapper.prototype.get = function(factName) {
    
    var splittedFact = factName.split("*");
    
    if (splittedFact.length === 1) {
        return this._engine.get(factName);
    }

    var contextFactName = this._ruledef.context + splittedFact[1];
    return this._engine.get(contextFactName);

};


EngineWrapper.prototype.exec = function(callback) {
    
   this._ruledef.exec(this, callback); 

};


module.exports = EngineWrapper;

