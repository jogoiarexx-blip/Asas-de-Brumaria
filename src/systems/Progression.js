// Regras puras: podem ser testadas sem Three.js, DOM ou localStorage.
export const STARTER_SPECIES='furia_noite';
export const SPECIES = Object.freeze({
  furia_noite: {name:'Fúria da Noite',kind:'Dragão Inicial',price:0,description:'Seu companheiro principal, ágil e habilidoso no voo.',colors:[0x050e16,0x111a24,0x25323e,0x111923,0x1a2636,0x65d0db],speed:1.08,stamina:1.06,fire:1.10},
  nimbo: {name:'Nimbo',kind:'Asa da Névoa',price:0,description:'Equilibrado e confiável.',colors:[0x172e3c,0x254858,0x397c7b,0x236978,0x328b94,0x83c2ae],speed:1,stamina:1,fire:1},
  brasa: {name:'Brasa',kind:'Fúria Rubra',price:2,description:'Especialista em sopro de fogo.',colors:[0x422429,0x923c32,0xc57c44,0xa64232,0xd46a39,0xf5bc74],speed:.93,stamina:.93,fire:1.5},
  raio: {name:'Raio',kind:'Vento Celeste',price:3,description:'Veloz e resistente no voo.',colors:[0x202b5c,0x3554a8,0x6b92d7,0x5072c9,0x8ca6ee,0xc2e8ff],speed:1.22,stamina:1.18,fire:.85},
  furia_luz: {name:'Fúria da Luz',kind:'Guardião Luminoso',price:4,description:'Dragão branco de olhos azuis, rápido e ágil.',colors:[0x849db1,0xe2eff2,0xb2d3e5,0xbacfdc,0xe8f6fa,0x8acdec],speed:1.17,stamina:1.12,fire:1.07}
});
export const SKILLS = Object.freeze({
  speed:{name:'Asas fortes',max:3},stamina:{name:'Fôlego',max:3},fire:{name:'Sopro poderoso',max:3}
});
export const REWARDS=[1,1,1,2,2,2,2];
/** v1.7.0 — Nível de Elo: a parceria com o dragão cresce com voo, carinho e
 * tudo que rende pontos de treino. XP mínimo de cada nível (1 a 5). */
export const BOND_LEVELS=Object.freeze([0,30,80,160,280]);
export const BOND_XP_PER_POINT=5;
export const BOND_PERKS=Object.freeze([
  Object.freeze({level:1,name:'Primeiro laço',description:'Vocês voam juntos.'}),
  Object.freeze({level:2,name:'Fôlego partilhado',description:'+12% de recuperação de energia.'}),
  Object.freeze({level:3,name:'Assobio do domador',description:'A pé e longe do dragão, pressione E (ou MONTAR) para chamá-lo.'}),
  Object.freeze({level:4,name:'Voo em sintonia',description:'−12% de gasto de energia e +4% de velocidade.'}),
  Object.freeze({level:5,name:'Elo pleno',description:'+20% de dano do sopro e +15 de energia máxima.'})
]);
export function bondLevel(xp){
  const value=Number.isFinite(xp)?xp:0;
  let level=1;
  for(let i=1;i<BOND_LEVELS.length;i++)if(value>=BOND_LEVELS[i])level=i+1;
  return level;
}
/** Progresso dentro do nível atual; no nível máximo a fração fica em 1. */
export function bondProgress(xp){
  const value=Math.max(0,Number.isFinite(xp)?xp:0),level=bondLevel(value);
  const floor=BOND_LEVELS[level-1],next=BOND_LEVELS[level]??null;
  return {level,xp:value,floor,next,fraction:next===null?1:Math.min(1,(value-floor)/(next-floor))};
}
const int=(value,min,max,fallback=min)=>Number.isInteger(value)?Math.min(max,Math.max(min,value)):fallback;
export class Progression {
  constructor(saved=null){
    this.points=0;this.earned=0;this.species=STARTER_SPECIES;this.unlocked=[STARTER_SPECIES];this.skills={speed:0,stamina:0,fire:0};this.circuits=0;this.bond=0;
    if(saved)this.restore(saved);
  }
  restore(data){
    if(!data||typeof data!=='object')return;
    this.points=int(data.points,0,9999);this.earned=int(data.earned,0,9999);
    const previous=Array.isArray(data.unlocked)?data.unlocked:[];
    this.unlocked=[STARTER_SPECIES,...Object.keys(SPECIES).filter(id=>id!==STARTER_SPECIES&&previous.includes(id))];
    // Saves created before the Night Fury became the starter keep their
    // missions/skills/points; only the old default Nimbo selection migrates.
    const legacyStarter=!previous.includes(STARTER_SPECIES)&&data.species==='nimbo';
    this.species=legacyStarter?STARTER_SPECIES:(this.unlocked.includes(data.species)?data.species:STARTER_SPECIES);
    for(const key of Object.keys(SKILLS))this.skills[key]=int(data.skills?.[key],0,SKILLS[key].max);
    this.circuits=int(data.circuits,0,9999);
    this.earned=Math.max(this.earned,this.points);
    // Saves anteriores à v1.7.0 não têm Elo: o que já foi conquistado conta.
    this.bond=Number.isInteger(data.bond)?int(data.bond,0,99999):Math.min(99999,this.earned*BOND_XP_PER_POINT);
  }
  snapshot(){return {points:this.points,earned:this.earned,species:this.species,unlocked:[...this.unlocked],skills:{...this.skills},circuits:this.circuits,bond:this.bond};}
  grant(amount){const n=int(amount,0,100);this.points+=n;this.earned+=n;this.addBond(n*BOND_XP_PER_POINT);return n;}
  /** Soma XP de Elo; devolve o nível antes/depois para o jogo anunciar. */
  addBond(amount){
    const before=bondLevel(this.bond);
    this.bond=Math.min(99999,this.bond+int(Math.round(amount),0,1000));
    const level=bondLevel(this.bond);
    return {before,level,leveledUp:level>before};
  }
  get bondLevel(){return bondLevel(this.bond);}
  upgrade(key){
    if(!SKILLS[key])return {ok:false,reason:'Habilidade desconhecida.'};
    const level=this.skills[key],cost=level+1;
    if(level>=SKILLS[key].max)return {ok:false,reason:'Esta habilidade já está no nível máximo.'};
    if(this.points<cost)return {ok:false,reason:`São necessários ${cost} pontos de treino.`};
    this.points-=cost;this.skills[key]++;return {ok:true,cost};
  }
  unlock(id){
    const spec=SPECIES[id];if(!spec)return {ok:false,reason:'Espécie desconhecida.'};
    if(this.unlocked.includes(id))return {ok:false,reason:'Espécie já desbloqueada.'};
    if(this.points<spec.price)return {ok:false,reason:`São necessários ${spec.price} pontos de treino.`};
    this.points-=spec.price;this.unlocked.push(id);return {ok:true,cost:spec.price};
  }
  discover(id){
    if(!SPECIES[id]||this.unlocked.includes(id))return false;
    this.unlocked.push(id);return true;
  }
  select(id){if(!this.unlocked.includes(id))return false;this.species=id;return true;}
  get stats(){
    const spec=SPECIES[this.species],elo=this.bondLevel;
    // Bônus de Elo: no nível 1 todos os fatores valem 1 (números originais).
    const regenBond=elo>=2?1.12:1,drainBond=elo>=4?.88:1,speedBond=elo>=4?1.04:1,fireBond=elo>=5?1.2:1;
    return {maxEnergy:Math.round(100*spec.stamina+this.skills.stamina*22)+(elo>=5?15:0),
      regen:(12*spec.stamina+this.skills.stamina*2)*regenBond,
      drain:17/Math.max(.7,spec.stamina)*drainBond,
      flightSpeed:31*spec.speed*(1+this.skills.speed*.09)*speedBond,
      boostSpeed:49*spec.speed*(1+this.skills.speed*.09)*speedBond,
      groundSpeed:11*(1+this.skills.speed*.06),
      fireDamage:(spec.fire+this.skills.fire*.65)*fireBond,
      fireCost:13*(1-.08*this.skills.fire),
      fireCooldown:.30*(1-.08*this.skills.fire)};
  }
}
