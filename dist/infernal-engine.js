!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.InfernalEngine=e():t.InfernalEngine=e()}(self,(function(){return t={980:t=>{t.exports=class{constructor(t,e){if("string"!=typeof t)throw new Error("The 'path' parameter must be a string.");this._path=t,this._value=e}get path(){return this._path}get value(){return this._value}}},743:(t,e,a)=>{const s=a(74);t.exports=class{constructor(t,e,a){this.engine=t,this.rule=e,this.path=a,this.facts=[]}async execute(){let t=[];this.facts.forEach((e=>{t.push(this.engine._facts.get(e))})),this.engine._trace&&this.engine._trace({action:"execute",rule:path,inputs:t});let e=await this.rule.apply(null,t);if(!e)return;let a=s.getContext(this.path);for(let t in e){if(!e.hasOwnProperty(t))continue;if(!t.startsWith("#")){let i=t.startsWith("/")?t:a+t,r=e[t],n=s.typeof(r);"object"===n?await this.engine.import(r,i):"function"===n?await this.engine.defRule(i,r):await this.engine.assert(i,r);continue}let i=e[t];switch(t){case"#assert":await this.engine.assert(i.path,i.value);break;case"#retract":await this.engine.retract(i.path);break;case"#def":case"#defRule":await this.engine.def(i.path,i.value);break;case"#undef":case"#undefRule":await this.engine.undef(i.path);break;case"#import":await this.engine.import(i.value,i.path);break;default:throw new Error(`Invalid action: '${t}'.`)}}}}},568:(t,e,a)=>{const s=a(74),i=a(743),r=a(980);function n(t){this._trace&&this._trace({action:"undefRule",rule:t}),this._rules.delete(t);for(const[e,a]of this._relations)a.delete(t)}async function c(){this._trace&&this._trace({action:"infer",maxGen:this._maxGen}),this._busy=!0;let t=0;this._facts.set("/$/maxGen",this._maxGen);try{for(;t<this._maxGen&&this._agenda.size>0;){t++,this._facts.set("/$/gen",t),this._trace&&this._trace({action:"executeAgenda",gen:t,ruleCount:this._agenda.size});let e=this._agenda;this._agenda=new Map;for(const[t,a]of e)await a.execute()}}finally{this._busy=!1}if(t==this._maxGen)throw new Error(`Inference not completed because maximum depth reached (${this._maxGen}). Please review for infinite loop or set the maxDepth property to a larger value.`)}async function h(t,e){let a=e;if(e.endsWith("/")&&(a=e.substring(0,e.length-1)),t instanceof Date||t instanceof Array)return await this.assert(a,t);const s=typeof t;if("function"===s)return await this.defRule(a,t);if("object"!==s)return await this.assert(a,t);for(let e in t)await h.call(this,t[e],`${a}/${e}`)}function o(t){this._relations.has(t)&&this._relations.get(t).forEach((t=>{this._agenda.set(t,this._rules.get(t)),this._trace&&this._trace({action:"addToAgenda",rule:t})}))}function l(t,e,a){let s=e[0];1!==e.length?(void 0===t[s]&&(t[s]={}),l(t[s],e.slice(1),a)):t[s]=a}t.exports=class{constructor(t,e){this._maxGen=t||50,this._trace=e,this._busy=!1,this._facts=new Map,this._rules=new Map,this._relations=new Map,this._agenda=new Map,this._changes=new Set}async peek(t){let e=t.startsWith("/")?t:`/${t}`,a=s.compilePath(e);return this._facts.get(a)}async assert(t,e){let a=t.startsWith("/")?t:`/${t}`,i=s.compilePath(a);var r=this._facts.get(i);if(!(e instanceof Array)&&s.equals(r,e))return;let n="assert";if(void 0!==e)this._facts.set(i,e);else{if(!this._facts.has(i))return void(this._trace&&this._trace({action:"retract",warning:`Cannot retract undefined fact '${i}'.`}));n="retract",this._facts.delete(i),this._relations.delete(i)}this._trace&&this._trace({action:n,fact:i,oldValue:r,newValue:e}),i.startsWith("/$")||(this._changes.add(i),o.call(this,i),this._busy||await c.call(this))}async assertAll(t){if(!(t instanceof Array))throw new Error("The 'facts' parameter must be an Array.");if(0!==t.length){this._trace&&this._trace({action:"assertAll",factCount:t.length}),this._busy=!0;try{for(const e of t){if(!(e instanceof r))throw new Error("The asserted array must contains objects of class Fact only.");await this.assert(e.path,e.value)}}finally{this.busy=!1}await c.call(this)}}async retract(t){if(!t.endsWith("/*"))return void await this.assert(t,void 0);let e=t.startsWith("/")?t:`/${t}`,a=s.compilePath(e),i=a.substr(0,a.length-1);for(const[t,e]of this._facts)t.startsWith(i)&&await this.assert(t,void 0)}async defRule(t,e){await this.def(t,e)}async def(t,e){if("async"!==(e&&e.toString().substring(0,5)))throw new Error("The rule parameter must be an async function.");let a=t.startsWith("/")?t:`/${t}`,r=s.compilePath(a),n=s.getContext(r);if(this._rules.has(r))throw new Error(`Can not define the rule '${r}' because it already exist. Call 'undef' or change the rule path.`);let h=new i(this,e,r),o=s.parseParameters(e);for(const t of o){let e=t.startsWith("/")?t:n+t,a=s.compilePath(e);this._relations.has(a)||this._relations.set(a,new Set),this._relations.get(a).add(r),h.facts.push(a)}this._rules.set(r,h),this._trace&&this._trace({action:"defRule",rule:r,inputFacts:h.facts.slice()}),this._agenda.set(r,h),this._trace&&this._trace({action:"addToAgenda",rule:t}),this._busy||await c.call(this)}async undefRule(t){await this.undef(t)}async undef(t){let e=t.startsWith("/")?t:`/${t}`,a=s.compilePath(e);if(!a.endsWith("/*"))return void n.call(this,a);let i=a.substr(0,a.length-1);for(const[t,e]of this._rules)t.startsWith(i)&&n.call(this,t)}async import(t,e){this._trace&&this._trace({action:"import",object:t});let a=this._busy;this._busy=!0;try{await h.call(this,t,e||""),a||await c.call(this)}finally{a||(this._busy=!1)}}async export(t){let e=t||"/";e.startsWith("/")||(e=`/${e}`);let a={};for(const[t,s]of this._facts)t.startsWith(e)&&l(a,t.substring(e.length).replace(/\//g," ").trim().split(" "),s);return a}async exportChanges(){let t={};for(const e of this._changes)l(t,e.replace(/\//g," ").trim().split(" "),this._facts.get(e));return this._changes.clear(),t}async reset(){this._changes.clear()}static fact(t,e){return new r(t,e)}}},74:t=>{t.exports={equals:function(t,e){var a=t;t instanceof Date&&(a=t.getTime());var s=e;return e instanceof Date&&(s=e.getTime()),a===s},parseParameters:function*(t){let a=(t.toString().split(")")[0]+")").replace(/\s+/g," "),s=/\((.+?)\)|= ?(?:async)? ?(\w+) ?=>/g.exec(a);if(!s)return;let i=s[1],r=e.exec(i);do{yield r[1]||r[2],r=e.exec(i)}while(r)},getContext:function(t){return t.replace(a,"")},compilePath:function(t){let e=t,a=t.replace(s,"");for(;a!=e;)e=a,a=e.replace(s,"");if(e.startsWith("/.."))throw new Error(`Unable to compile the path '${t}' properly.`);return e.replace(i,"")},typeof:function(t){return t instanceof Date?"date":t instanceof Array?"array":typeof t}};const e=/(?:\/\*?@ *([\w/.]+?) *\*\/ *\w+,?)|[(,]? *(\w+) *[,)]?/g,a=/[^/]+?$/,s=/\/[^/.]+\/\.\./,i=/\.\//g}},e={},function a(s){if(e[s])return e[s].exports;var i=e[s]={exports:{}};return t[s](i,i.exports,a),i.exports}(568);var t,e}));
//# sourceMappingURL=infernal-engine.js.map