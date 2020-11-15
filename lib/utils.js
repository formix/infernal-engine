
module.exports = {
    equals: equals,
    parseParameters: parseParameters,
    getContext: getContext,
    compilePath: compilePath
};

function equals(a, b) {
    var aValue = a;
    if (a instanceof Date) {
        aValue = a.getTime(); 
    }
    var bValue = b;
    if (b instanceof Date) {
        bValue = b.getTime();
    }
    return (aValue === bValue) && ((typeof a) === (typeof b));
}


//https://regex101.com/r/zYhguP/6/
const paramRegex = /(?:\/\*?@ *([\w/.]+?) *\*\/ *\w+,?)|[(,]? *(\w+) *[,)]?/g;

function* parseParameters(rule) {
    let allParamsRegex = /\((.+?)\)|= ?(?:async)? ?(\w+) ?=>/g;
    let paramCode = (rule.toString().split(')')[0] + ')');
    let paramCodeWithoutEol = paramCode.replace(/\s+/g, " ");
    let allParamMatch = allParamsRegex.exec(paramCodeWithoutEol);
    if (!allParamMatch) return;

    let allParams = allParamMatch[1];
    let paramMatch = paramRegex.exec(allParams);
    do {
        yield (paramMatch[1] || paramMatch[2]);
        paramMatch = paramRegex.exec(allParams);
    } 
    while (paramMatch)
}


const trailingTermRemovalRegex = /[^/]+?$/;
const pathCompactionRegex = /[^/]+\/\.\.\//g   // https://regex101.com/r/ux7Ak5/3
const currentPathRemoval = /\.\//g;


function getContext(compiledPath) {
    return compiledPath.replace(trailingTermRemovalRegex, "");
}

/**
 * Create a compacted fact name from a given fact name. Path do not end with a trailing '/'.
 * 
 *  '../' Denote the parent term. Move up one term in the context or path.
 *  './'  Denote the current term. Removed from the context or path.
 * 
 * Examples: 
 * 
 *  '/a/given/../correct/./path' is compiled to '/a/correct/path'
 * 
 * @param {String} path The path or context to compile into a context.
 */
function compilePath(path) {
    let current = path;
    let next = path.replace(pathCompactionRegex, "");
    while (next != current) {
        current = next;
        next = current.replace(pathCompactionRegex, "");
    }
    if (current.startsWith("/..")) {
        throw new Error(`Unable to compile the path '${path}' properly.`);
    }
    return current.replace(currentPathRemoval, "");
}
