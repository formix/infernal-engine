module.exports = {

  name: "Fritz",
  
  // We agree that setting a property to undefined is equivalent to not
  // defining anything. This is just for syntax reference. These properties
  // do not have to be defined in the model.
  sound: undefined,
  eats: undefined,
  color: undefined,
  species: undefined,
  sings: undefined,
  
  isFrog: async function(sound, eats){
    let species = "unknown";
    if (sound === "croaks" && eats === "flies") {
      species = "frog";
    }
    return {"species": species};
  },

  isCanary: async function(sound, sings) {
    if ( sings && sound === "chirps" ) {
      return {"species": "canary"};
    }
  },
  
  isGreen: async function(species) {
    if (species === "frog") {
      return {"color": "green"};
    }
  },
  
  isYellow: async function(species) {
    if (species === "canary") {
      return {"color": "yellow"};
    }
  }

};