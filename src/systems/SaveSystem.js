import {normalizeWildBonds} from './WildBonds.js';
import {normalizeExpedition} from './ExpeditionRules.js';
import {normalizeWeather} from './weatherMath.js';
import {normalizeDayCycle} from './dayCycleMath.js';
import {normalizeDiscoveries,LANDMARKS} from './Discovery.js';
import {normalizeFrontier} from './FrontierRules.js';
const STORAGE_KEY='asas-de-brumaria-save-v1';
const isPlainObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finite=(n,lo,hi,defaultValue=0)=>typeof n==='number'&&Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):defaultValue;
const count=(n,max)=>Number.isInteger(n)?Math.max(0,Math.min(max,n)):0;
const MAX_PROGRESS=[0,4,2,2,2,2,0,0];
const bools=(xs,length)=>Array.from({length},(_,i)=>xs?.[i]===true);
export function normalizeSave(payload){
  if(!isPlainObject(payload)||payload.version!==1||!isPlainObject(payload.mission)||!isPlainObject(payload.progression))return null;
  const m=payload.mission;const p=payload.player??{};const stage=count(m.stage,7);
  return {
    version:1,
    mission:{stage,progress:count(m.progress,MAX_PROGRESS[stage]),crystals:bools(m.crystals,3),targets:bools(m.targets,3),hatchlings:bools(m.hatchlings,3),carriedIndex:Number.isInteger(m.carriedIndex)&&m.carriedIndex>=0&&m.carriedIndex<3?m.carriedIndex:-1,rescueHold:finite(m.rescueHold,0,1.25),enemies:Array.from({length:3},(_,i)=>finite(m.enemies?.[i],0,3,3))},
    progression:payload.progression,
    contracts:isPlainObject(payload.contracts)?payload.contracts:null,
    weather:normalizeWeather(payload.weather),
    dayNight:normalizeDayCycle(payload.dayNight),
    wildBonds:normalizeWildBonds(payload.wildBonds),
    expedition:normalizeExpedition(payload.expedition),
    frontier:normalizeFrontier(payload.frontier),
    discoveries:{found:LANDMARKS.filter((_,i)=>normalizeDiscoveries(payload.discoveries)[i]).map(m=>m.id)},
    player:{x:finite(p.x,-420,1450,8),y:finite(p.y,2.7,110,4),z:finite(p.z,-420,420,7),yaw:finite(p.yaw,-Math.PI*4,Math.PI*4,-.5),energy:finite(p.energy,0,250,100),health:finite(p.health,1,100,100),mounted:p.mounted===true,airborne:p.airborne===true,heroX:finite(p.heroX,-420,420,2),heroZ:finite(p.heroZ,-420,420,11)},
    savedAt:typeof payload.savedAt==='string'?payload.savedAt:''
  };
}
export class SaveSystem {
  constructor(storage=globalThis.localStorage){this.storage=storage;this.key=STORAGE_KEY;this.available=!!storage;}
  read(){try{return normalizeSave(JSON.parse(this.storage?.getItem(this.key)??'null'));}catch{return null;}}
  write(data){try{if(!this.storage)return false;this.storage.setItem(this.key,JSON.stringify(data));return true;}catch{return false;}}
  clear(){try{this.storage?.removeItem(this.key);return true;}catch{return false;}}
}
