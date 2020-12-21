module.exports = {

  name: "Fritz",
  
  sound: "",
  eats: "",
  sings: false,

  color: "unknown",
  species: "unknown",
  
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