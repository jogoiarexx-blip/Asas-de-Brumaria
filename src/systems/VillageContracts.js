import {stretchPointOnIsland} from '../world/IslandLayout.js';
/** Repeatable village jobs. Status is persisted, but completed jobs reopen
 * when the *in-game* day advances. The main story never resets. */
export const CONTRACTS=Object.freeze({
  correio:{title:'CORREIO DOS CÉUS',npc:'iara',reward:2,requiresMount:true,
    description:'Entregue três mensagens nos faróis luminosos e volte para Iara.',
    points:[[103,35,43],stretchPointOnIsland([166,37,106],'Ilha do Farol'),stretchPointOnIsland([-119,35,152],'Ilha da Névoa')]},
  ervas:{title:'ERVAS DO REFÚGIO',npc:'lume',reward:1,requiresMount:false,
    description:'Encontre três plantas curativas a pé e volte para Lume.',
    points:[[36,0,22],[47,0,-15],[-45,0,15]]},
  minérios:{title:'FRAGMENTOS DA FORJA',npc:'borin',reward:2,requiresMount:false,
    description:'Recolha três cristais de minério nas trilhas do Refúgio e entregue na forja.',
    points:[[-29,0,-39],[41,0,40],[-39,0,14]]},
  socorro:{title:'SUPRIMENTOS DE EMERGÊNCIA',npc:'nara',reward:2,requiresMount:true,
    description:'Leve três caixas de suprimentos às ilhas afastadas e retorne para Nara.',
    points:[stretchPointOnIsland([-182,30,-123],'Ilha das Cascatas'),stretchPointOnIsland([168,35,104],'Ilha do Farol'),stretchPointOnIsland([196,32,-160],'Atol Esquecido')]},
  patrulha:{title:'VIGÍLIA DOS HORIZONTES',npc:'tavi',reward:2,requiresMount:true,
    description:'Sobrevoe três balizas de patrulha entre as ilhas e informe Tavi ao regressar.',
    points:[stretchPointOnIsland([-115,42,79],'Ilha da Névoa'),stretchPointOnIsland([121,44,32],'Ilha do Farol'),stretchPointOnIsland([174,38,-110],'Atol Esquecido')]},
  brasas:{title:'CHAMAS DOS FARÓIS',npc:'suri',reward:3,requiresMount:true,requiresFire:true,
    description:'Monte no dragão e acenda com FOGO as três balizas laranjas das ilhas. Volte para Suri.',
    points:[[105,38,43],stretchPointOnIsland([-154,42,-105],'Ilha das Cascatas'),stretchPointOnIsland([190,42,-115],'Atol Esquecido')]}
});
const safeStatus=value=>['idle','active','ready','done'].includes(value)?value:'idle';
const dayNumber=value=>Number.isSafeInteger(value)?Math.min(1000000,Math.max(1,value)):1;
export class VillageContracts {
  constructor(saved,day=1){
    this.day=dayNumber(day);
    this.state=Object.fromEntries(Object.keys(CONTRACTS).map(k=>[k,{status:'idle',collected:[false,false,false],startedDay:null}]));
    if(saved)this.restore(saved);
    this.syncDay(day);
  }
  get active(){return Object.entries(this.state).filter(([,s])=>s.status==='active'||s.status==='ready');}
  snapshot(){return {day:this.day,...Object.fromEntries(Object.entries(this.state).map(([k,v])=>[k,{status:v.status,collected:[...v.collected],startedDay:v.startedDay}]))};}
  restore(saved){
    this.day=Math.max(this.day,dayNumber(saved?.day));
    for(const key of Object.keys(CONTRACTS)){
      const value=saved?.[key]??{};
      const status=safeStatus(value.status);
      const collected=CONTRACTS[key].points.map((_,i)=>value.collected?.[i]===true);
      if(status==='ready'||status==='done')collected.fill(true);
      const startedDay=status==='idle'?null:dayNumber(value.startedDay??this.day);
      this.state[key]={status,collected,startedDay};
    }
  }
  syncDay(day){
    const next=dayNumber(day);
    if(next<=this.day)return false;
    this.day=next;
    for(const state of Object.values(this.state))if(state.status==='done'){
      state.status='idle';state.collected.fill(false);state.startedDay=null;
    }
    return true;
  }
  /** Each day's circuit moves by 4-7 meters, without changing the islands. */
  points(key){
    const def=CONTRACTS[key];if(!def)return [];
    const day=this.state[key]?.startedDay??this.day;
    const cycle=(day-1)%3;
    const offsets=[[0,0],[5,-4],[-5,5]][cycle];
    return def.points.map(([x,y,z])=>[x+offsets[0],y,z+offsets[1]]);
  }
  talk(npc){
    const key=Object.keys(CONTRACTS).find(k=>CONTRACTS[k].npc===npc);
    if(!key)return null;
    const def=CONTRACTS[key],s=this.state[key];
    if(s.status==='idle'){
      s.status='active';s.startedDay=this.day;
      return {npc,text:`DIA ${this.day} · ${def.title}: ${def.description} Recompensa: ${def.reward} pontos de treino.`,action:'accepted',key};
    }
    if(s.status==='active')return {npc,text:`Ainda faltam ${s.collected.filter(x=>!x).length} objetivos. ${def.description}`,action:'reminder',key};
    if(s.status==='ready'){
      s.status='done';return {npc,text:`Excelente trabalho! ${def.title} concluído. Você ganhou ${def.reward} pontos de treinamento. Novas tarefas estarão disponíveis no próximo dia.`,action:'reward',key,reward:def.reward};
    }
    return {npc,text:'Contrato diário concluído. Volte amanhã para uma nova rota!',action:'done',key};
  }
  /** Projectile-only contracts: proximity cannot ignite a beacon. */
  ignite(key,index){
    const s=this.state[key],def=CONTRACTS[key];
    if(!def?.requiresFire||!s||s.status!=='active'||!Number.isInteger(index)||
      index<0||index>=def.points.length||s.collected[index])return false;
    s.collected[index]=true;
    if(s.collected.every(Boolean))s.status='ready';
    return true;
  }
  collect(key,index,mounted){
    const s=this.state[key],def=CONTRACTS[key];
    if(!s||s.status!=='active'||s.collected[index]||!def.points[index]||def.requiresFire||def.requiresMount!==mounted)return false;
    s.collected[index]=true;
    if(s.collected.every(Boolean))s.status='ready';
    return true;
  }
}
