import {PREVIOUS_ISLAND_SPACING,migrateLegacyMapPoint,migrateSeparatedIslandPoint} from '../world/IslandLayout.js';
import {normalizeWildBonds} from './WildBonds.js';
import {normalizeExpedition,MOUNTAIN_PORTAL} from './ExpeditionRules.js';
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
  // Existing saves use the original island coordinates. Migrate only once.
  const layout=payload.layoutVersion===3?3:payload.layoutVersion===2?2:1;
  const spacing=layout===2?PREVIOUS_ISLAND_SPACING:1;
  const formerDragon=layout===3?{x:p.x,z:p.z}:migrateLegacyMapPoint(p.x??8,p.z??7,spacing);
  const formerHero=layout===3?{x:p.heroX,z:p.heroZ}:migrateLegacyMapPoint(p.heroX??2,p.heroZ??11,spacing);
  const dragon=payload.islandLayoutVersion===2?formerDragon:migrateSeparatedIslandPoint(formerDragon.x,formerDragon.z);
  const hero=payload.islandLayoutVersion===2?formerHero:migrateSeparatedIslandPoint(formerHero.x,formerHero.z);
  // Reposition only old checkpoints parked at the original gateway.
  // No adjustment for players in the mountain map or new-version saves.
  const oldGateway=payload.portalVersion!==2&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&
    p.x<=650&&Math.hypot(p.x-328,p.z-35)<75;
  if(oldGateway){
    dragon.x=MOUNTAIN_PORTAL.returnX;dragon.z=MOUNTAIN_PORTAL.returnZ;
    if(Number.isFinite(p.heroX)&&Number.isFinite(p.heroZ)&&
      Math.hypot(p.heroX-328,p.heroZ-35)<100){
      hero.x=MOUNTAIN_PORTAL.returnX-8;hero.z=MOUNTAIN_PORTAL.returnZ;
    }
  }
  return {
    version:1,layoutVersion:3,islandLayoutVersion:2,portalVersion:2,
    mission:{stage,progress:count(m.progress,MAX_PROGRESS[stage]),crystals:bools(m.crystals,3),targets:bools(m.targets,3),hatchlings:bools(m.hatchlings,3),carriedIndex:Number.isInteger(m.carriedIndex)&&m.carriedIndex>=0&&m.carriedIndex<3?m.carriedIndex:-1,rescueHold:finite(m.rescueHold,0,1.25),enemies:Array.from({length:3},(_,i)=>finite(m.enemies?.[i],0,3,3))},
    progression:payload.progression,
    contracts:isPlainObject(payload.contracts)?payload.contracts:null,
    weather:normalizeWeather(payload.weather),
    dayNight:normalizeDayCycle(payload.dayNight),
    wildBonds:normalizeWildBonds(payload.wildBonds),
    expedition:normalizeExpedition(payload.expedition),
    frontier:normalizeFrontier(payload.frontier),
    islandActivities:{completed:Array.from({length:7},(_,i)=>payload.islandActivities?.completed?.[i]===true)},
    discoveries:{found:LANDMARKS.filter((_,i)=>normalizeDiscoveries(payload.discoveries)[i]).map(m=>m.id)},
    player:{x:finite(dragon.x,-700,1450,8),y:finite(p.y,2.7,110,4),z:finite(dragon.z,-640,640,7),yaw:finite(p.yaw,-Math.PI*4,Math.PI*4,-.5),energy:finite(p.energy,0,250,100),health:finite(p.health,1,100,100),mounted:p.mounted===true,airborne:p.airborne===true,heroX:finite(hero.x,-700,660,2),heroZ:finite(hero.z,-700,700,11)},
    savedAt:typeof payload.savedAt==='string'?payload.savedAt:''
  };
}
export class SaveSystem {
  constructor(storage=globalThis.localStorage){this.storage=storage;this.key=STORAGE_KEY;this.available=!!storage;}
  read(){try{return normalizeSave(JSON.parse(this.storage?.getItem(this.key)??'null'));}catch{return null;}}
  write(data){try{if(!this.storage)return false;this.storage.setItem(this.key,JSON.stringify(data));return true;}catch{return false;}}
  exportBackup(){
    const data=this.read();
    return data?JSON.stringify({format:'asas-de-brumaria-save',exportedAt:new Date().toISOString(),data},null,2):null;
  }
  importBackup(text){
    if(typeof text!=='string'||text.length>524288)return {ok:false,reason:'Arquivo de progresso muito grande ou inválido.'};
    let envelope;
    try{envelope=JSON.parse(text);}catch{return {ok:false,reason:'Arquivo JSON inválido.'};}
    if(!isPlainObject(envelope)||envelope.format!=='asas-de-brumaria-save')
      return {ok:false,reason:'Este arquivo não é um backup do Asas de Brumária.'};
    const normalized=normalizeSave(envelope.data);
    if(!normalized)return {ok:false,reason:'Progresso incompatível ou corrompido.'};
    try{
      if(!this.storage)return {ok:false,reason:'Armazenamento indisponível.'};
      const previous=this.storage.getItem(this.key);
      if(previous)this.storage.setItem(this.key+'-backup',previous);
      this.storage.setItem(this.key,JSON.stringify(normalized));
      return {ok:true,stage:normalized.mission.stage};
    }catch{return {ok:false,reason:'Não foi possível gravar o progresso.'};}
  }
  clear(){try{this.storage?.removeItem(this.key);return true;}catch{return false;}}
}
