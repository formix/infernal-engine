"use strict";

module.exports = Agenda;


function Agenda() {
}


Agenda.prototype.shift = function() {
    for (var key in this) {
        if (key !== "shift" && key !== "isEmpty") {
            var exec = this[key];
            delete this[key];
            return exec;
        }
    }
}


Agenda.prototype.isEmpty = function() {
    for (var key in this) {
        if (key !== "shift" && key !== "isEmpty") {
            return false;
        }
    }
    return true;
}
