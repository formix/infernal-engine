
module.exports = {
    equals: equals,
    parseParameters: parseParameters,
    popName: popName
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


function* parseParameters(rule) {
    let allParamsRegex = /\((.+?)\)|= ?(?:async)? ?(\w+) ?=>/g;
    let paramCode = (rule.toString().split(')')[0] + ')');
    let paramCodeWithoutEol = paramCode.replace(/\s+/g, " ");
    let allParamMatch = allParamsRegex.exec(paramCodeWithoutEol);
    if (!allParamMatch) return;

    let allParams = allParamMatch[1];
    //https://regex101.com/r/zYhguP/6/
    let paramRegex = /(?:\/\*?@ *([\w/.]+?) *\*\/ *\w+,?)|[(,]? *(\w+) *[,)]?/g;
    let paramMatch = paramRegex.exec(allParams);
    do {
        yield (paramMatch[1] || paramMatch[2]);
        paramMatch = paramRegex.exec(allParams);
    } 
    while (paramMatch)
}

const nameRegex = /[^/]+?$/;
function popName(path) {
    return path.replace(nameRegex, "");
}
