


/**
 * The Fact class stores the path and the value of a Fact instance.
 */
class Fact {
    
    /**
     * 
     * @param {string} path The mandatory path of the fact.
     * @param {any} value The optional value of the fact. If letft undefined, the fact will be
     *                  retracted if it exists.
     */
    constructor(path, value) {
        if (typeof path !== "string") {
            throw new Error("The 'path' parameter must be a string.");
        }
        this._path = path;
        this._value = value;
    }

    /**
     * Gets the fact path.
     */
    get path() {
        return this._path;
    }

    /**
     * Gets the fact value.
     */
    get value() {
        return this._value;
    }

};


module.exports = Fact;