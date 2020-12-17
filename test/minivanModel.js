module.exports = {

    name: "Minivan",
  
    speed: {
      input: "0",
      limit: 140,
      value: 0,

      inputIsValidInteger: async function(input) {
        let isInt = /^-?\d+$/.test(input);
        if (!isInt) {
          return { "../message": `Error: '${input}' is not a valid integer.` }
        }
        return { value: Number(input) };
      },
      
      valueIsWithinLimit: async function(value, limit) {
        if (value > limit) {
          return {
            value: limit,
            "/message": `WARN: The speed input can not exceed the speed limit of ${limit}.`
          }
        }
        return { "/message": "" };
      }
    }
  }