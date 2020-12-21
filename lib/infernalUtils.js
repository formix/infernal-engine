
module.exports = {
    equals: equals,
    parseParameters: parseFactPaths,
    getContext: getContext,
    compilePath: compilePath
};

//https://regex101.com/r/zYhguP/6/
const paramRegex = /(?:\/\*?@ *([\w/.]+?) *\*\/ *\w+,?)|[(,]? *(\w+) *[,)]?/g;
const trailingTermRemovalRegex = /[^/]+?$/;
const pathCompactionRegex = /\/[^/.]+\/\.\./;
const currentPathRemoval = /\.\//g;

/**
 * Compare two values and return true if they are equal. Fix date comparison issue and insure
 * both types are the same.
 * 
 * @param {*} a The first value used to compare.
 * @param {*} b The second value used to caompare.
 */
function equals(a, b) {
    var aValue = a;
    if (a instanceof Date) {
        aValue = a.getTime(); 
    }
    var bValue = b;
    if (b instanceof Date) {
        bValue = b.getTime();
    }
    return (aValue === bValue);
}

/**
 * Generator that parses all fact paths derived from the given rule parameters. Either return the
 * parameter name or the path contained by the optional attribute comment. Single parameter lambda
 * function must put the parameter between parenthesis to be parsed properly.
 * 
 * @example
 * 
 * Using an attribute comment:
 * 
 *     async function(/¤@ /path/to/fact ¤/ param1, param2) {}
 * 
 * In the above example: 
 * 
 *   1) ¤ replaces * because using * and / one after the other ends the documentation comment.
 *   2) returned fact paths would be ['/path/to/fact', 'param2']
 * 
 * @param {AsyncFunction} rule The rule 
 */
function* parseFactPaths(rule) {
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


/**
 * Extracts the context from the fact or rule name. Must be a compiled path, not a path that
 * contains "../" or "./".
 * 
 * @example
 * 
 * Given the rule path: '/path/to/some/rule'
 * The returned value would be: '/path/to/some'
 * 
 * @param {String} compiledPath The compiled path to extract the context from.
 */
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
