import {stretchPointOnIsland} from '../world/IslandLayout.js';
// Regras independentes de WebGL: a amizade não pode render pontos duplicados.
export const WILD_DRAGON_DEFS=Object.freeze([
  {id:'brasa',name:'FAÍSCA',species:'brasa',island:'Ilha das Cascatas',temperament:'corajoso',x:-169,z:-110,color:0xd7683b},
  {id:'raio',name:'ZÉFIRO',species:'raio',island:'Ilha do Farol',temperament:'curioso',x:157,z:97,color:0x87a9ff},
  {id:'nimbo',name:'NEBLINA',species:'nimbo',island:'Ilha da Névoa',temperament:'tímido',x:-108,z:144,color:0x65d8bd}
].map(def=>{const [x,,z]=stretchPointOnIsland([def.x,0,def.z],def.island);return Object.freeze({...def,x,z});}));
const ids=WILD_DRAGON_DEFS.map(d=>d.id);
const BOND_TARGET=3;
export const PET_COOLDOWN_SECONDS=1.8;
export function petRepeatAllowed(now,lastPetAt){
  return Number.isFinite(now)&&now>=0&&(!Number.isFinite(lastPetAt)||now-lastPetAt>=PET_COOLDOWN_SECONDS);
}
export function normalizeWildBonds(input){
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  return Object.fromEntries(ids.map(id=>[id,Number.isInteger(source[id])?Math.max(0,Math.min(BOND_TARGET,source[id])):0]));
}
export class WildBonds {
  constructor(saved){this.state=normalizeWildBonds(saved);this.lastTouch=Object.fromEntries(ids.map(id=>[id,-Infinity]));}
  progress(id){return this.state[id]??0;}
  get total(){return ids.filter(id=>this.state[id]>=BOND_TARGET).length;}
  get completed(){return this.total===ids.length;}
  snapshot(){return {...this.state};}
  bond(id,elapsed,allowed=true){
    if(!ids.includes(id))return {ok:false,reason:'Criatura desconhecida.'};
    if(!allowed)return {ok:false,reason:'Pouse e aproxime-se a pé, sem montar no dragão.'};
    if(!Number.isFinite(elapsed)||elapsed<0)return {ok:false,reason:'Tempo inválido.'};
    if(this.state[id]>=BOND_TARGET)return {ok:false,reason:'Este dragão já confia em você.'};
    if(elapsed-this.lastTouch[id]<1.8)return {ok:false,reason:'Aguarde o dragão se acalmar antes de interagir novamente.'};
    this.lastTouch[id]=elapsed;
    const progress=++this.state[id];
    return {ok:true,progress,completed:progress===BOND_TARGET};
  }
}
