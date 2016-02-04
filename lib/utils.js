"use strict";

exports.digPath = digPath;
exports.getContext = getContext;
exports.getFullName = getFullName;
exports.deepCopy = deepCopy;


/**
 * Dig a path in a root object until it finds the property that contains the 
 * leaf element of the path.
 *
 * @param root   The root object to dig into
 * @param path   The path formatted with forward slashes. Supports ".." to move 
 *               up one object in the hierarchy.
 * @param create If set to true, create the object tree while digging instead 
 *               of returning undefined when encountering an undefined path 
 *               element.
 * 
 * @return The last object in the path along with the target leaf name in an 
 *         object having these two properties: 'target', 'name'. If create is
 *         falsy, returns undefined if the path element don't exists in the 
 *         object hierarchy.
 */
function digPath(facts, path, create) {
    var hierarchy = path.split(/\//g);
    var heap = [facts];
    var root = facts;
    var factFullName = "";
    while (hierarchy.length > 1) {
        var name = hierarchy.shift();
        if (name === "..") {
            if (heap.length !== 0) {
                heap.pop();
                if (heap.length === 0) {
                    root = facts;
                } else {
                    root = heap[heap.length - 1];
                }
            }
        } else if (name !== "") {
            factFullName += "/" + name;
            if (!root[name]) {
                if (!create) {
                    return undefined;
                } else {
                    root[name] = {};
                }
            }
            root = root[name]
            heap.push(root);
        }
    }
    return {
        data: heap.pop(),
        name: hierarchy[0],
        fullName: factFullName + "/" + hierarchy[0]
    };
}


function getContext(currentContext, path) {
    var fullName = getFullName(currentContext, path);
    var lastSlash = fullName.lastIndexOf("/");
    return fullName.substring(0, lastSlash + 1);
}

function getFullName(context, path) {
    
    if (!context || context.indexOf("/") !== 0) {
        throw new Error("context must start with a '/'. Value: '" + 
            context + "'");
    }
    
    if (path.indexOf("/") === 0) {
        // Since "path" starts with a '/' means that "path" is absolute. We 
        // don't care about the context in that case.
        return getFullName(path, "");
    }

    var contextArray = context.split("/");
    var pathArray = path.split("/");
    var contextStack = contextArray.concat(pathArray);

    // Here, "contextStack" should contains an array of all elements in the 
    // path. We expect "contextStack[0]" to contains an empty string. That
    // empty string represents the root of the path and must be there.

    var stack = [];
    for (var i = 0; i < contextStack.length; i++) {
        var contextPart = contextStack[i];
        if (i === 0 || contextPart !== "") {    
            // Keeps initial empty contextPart (root) and skip subsequent empty
            // contextStack. This will make path like "/a/b//c" into "/a/b/c".
            if (contextPart === "..") {
                if (stack.length > 1) {
                    stack.pop();
                }
            } else {
                stack.push(contextPart);
            }
        }
    }

    var fullName = "";
    for (var i = 0; i < stack.length; i++) {
        if (i > 0) {
            fullName += "/";
        }
        fullName += stack[i];
    }

    return fullName;
}


function deepCopy(target, source) {
    if (typeof source !== "object") {
        return deepCopy({}, target);
    }
    if (typeof source !== "object" || (source instanceof Date)) {
        throw new Error("The 'source' parameter must be an object.");
    }
    for (var property in source) {
        var propertyType = typeof source[property];
        if (propertyType === "object" &&
                source[property] !== null &&
                !(source[property] instanceof Date)) {
            target[property] = target[property] || {};
            deepCopy(target[property], source[property]);
        } else if (propertyType !== "function") {
            target[property] = source[property];
        }
    }
    return target;
}

