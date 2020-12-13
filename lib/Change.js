

module.exports = class Change {

    Path = "/";
    InitialValue = null;
    CurrentValue = null;

    constructor(path, initialValue, currentValue) {
        this.Path = path;
        this.InitialValue = initialValue;
        this.CurrentValue = currentValue;
    }
}
