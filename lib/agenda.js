/**
 * Module agenda
 */

"use strict";

module.exports = Agenda;

/**
 * Create an empty Agenda.
 * @class
 */
function Agenda() {
}


/**
 * Removes the first element from the agenda and returns it.
 * 
 * @returns {EngineProxy} - The next EngineProxy to be executed.
 */
Agenda.prototype.shift = function() {
    for (var key in this) {
        if (key !== "shift" && key !== "isEmpty") {
            var exec = this[key];
            delete this[key];
            return exec;
        }
    }
}

/**
 * Tells if the agenda is empty.
 *
 * @returns {boolean} True if the agenda is empty, false otherwise.
 */
Agenda.prototype.isEmpty = function() {
    for (var key in this) {
        if (key !== "shift" && key !== "isEmpty") {
            return false;
        }
    }
    return true;
}
