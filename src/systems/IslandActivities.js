import {LANDMARKS} from './Discovery.js';

/** Seven optional, one-time island challenges. No mandatory story gate. */
export const ISLAND_TASKS=Object.freeze([
  {label:'Inspeção do Refúgio',hint:'Explore o marco a pé e pressione E.',type:'walk'},
  {label:'Voo das Cascatas',hint:'Passe voando a baixa altitude e pressione E.',type:'low'},
  {label:'Vigília do Farol',hint:'Suba acima de 18 m e pressione E.',type:'high'},
  {label:'Planagem na Névoa',hint:'Plane devagar perto do marco e pressione E.',type:'glide'},
  {label:'Arrancada do Atol',hint:'Acelere no ar e pressione E.',type:'boost'},
  {label:'Pouso dos Cristais',hint:'Pouse montado perto do marco e pressione E.',type:'rest'},
  {label:'Chama das Cinzas',hint:'Chegue voando com energia acima de 50 e pressione E.',type:'charged'}
]);
export function activityAllowed(type,state={}){
  const speed=Number.isFinite(state.speed)?state.speed:0;
  const altitude=Number.isFinite(state.altitude)?state.altitude:0;
  switch(type){
    case 'walk':return !state.mounted;
    case 'low':return !!state.mounted&&!!state.airborne&&altitude>3&&altitude<25&&speed>8;
    case 'high':return !!state.mounted&&!!state.airborne&&altitude>=18;
    case 'glide':return !!state.mounted&&!!state.airborne&&speed>=6&&speed<=16;
    case 'boost':return !!state.mounted&&!!state.airborne&&speed>=28;
    case 'rest':return !!state.mounted&&!state.airborne&&speed<6;
    case 'charged':return !!state.mounted&&!!state.airborne&&state.energy>50;
    default:return false;
  }
}
export class IslandActivities{
  constructor(snapshot){this.completed=Array(LANDMARKS.length).fill(false);this.restore(snapshot);}
  restore(snapshot){
    const values=Array.isArray(snapshot?.completed)?snapshot.completed:[];
    this.completed=LANDMARKS.map((_,i)=>values[i]===true);
  }
  snapshot(){return {completed:[...this.completed]};}
  get total(){return this.completed.filter(Boolean).length;}
  nearby(position,radius=18){
    if(!position)return -1;
    return LANDMARKS.findIndex((landmark,i)=>!this.completed[i]&&
      Math.hypot(position.x-landmark.x,position.z-landmark.z)<=radius);
  }
  hint(position,radius=36){
    const i=this.nearby(position,radius);
    return i<0?'':ISLAND_TASKS[i].label+': '+ISLAND_TASKS[i].hint;
  }
  tryComplete(position,state={}){
    const i=this.nearby(position);
    if(i<0)return null;
    const task=ISLAND_TASKS[i];
    const altitude=position.y-(Number.isFinite(state.ground)?state.ground:position.y);
    if(!activityAllowed(task.type,{...state,altitude}))return {ok:false,hint:task.hint};
    this.completed[i]=true;
    return {ok:true,label:task.label,index:i};
  }
}
