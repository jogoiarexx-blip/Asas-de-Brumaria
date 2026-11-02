/** Deterministic lightweight NPC brains: no pathfinding worker or per-frame
 * allocations. The player is never chased; a nearby quest-giver stops to talk.
 * Each profession follows its own short patrol circuit on the refuge island. */
export const VILLAGE_AI_PROFILES=Object.freeze({
  iara:Object.freeze({radius:25,speed:1.5,rest:1.5}),
  lume:Object.freeze({radius:17,speed:1.0,rest:2.8}),
  borin:Object.freeze({radius:13,speed:.94,rest:3.2}),
  nara:Object.freeze({radius:16,speed:1.08,rest:2.6}),
  tavi:Object.freeze({radius:30,speed:1.85,rest:1.1}),
  suri:Object.freeze({radius:20,speed:1.12,rest:2.1})
});
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export const distanceXZ=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function random(brain){
  brain.seed=(Math.imul(brain.seed,1664525)+1013904223)>>>0;
  return brain.seed/4294967296;
}
export function makeVillageBrain(spec,index=0){
  const profile=VILLAGE_AI_PROFILES[spec.id]??{radius:14,speed:1.05,rest:2};
  return {home:{x:spec.x,z:spec.z},profile,seed:(0xabc1+index*13931)>>>0,
    state:'rest',rest:.7+index*.48,goal:null,stuck:0,walkCount:0,
    heading:Math.PI*.75,steps:0,activity:'rest',lastGreeting:-Infinity};
}
export function selectVillageGoal(brain,position,canVisit=()=>true){
  const {home,profile}=brain;
  // Return to a recognizable home base regularly to keep quests discoverable.
  if(brain.walkCount>0&&brain.walkCount%3===0 && canVisit(home.x,home.z)){
    brain.goal={x:home.x,z:home.z};brain.walkCount++;return brain.goal;
  }
  for(let i=0;i<14;i++){
    const angle=random(brain)*2*Math.PI;
    const radius=profile.radius*(.34+.6*random(brain));
    const x=home.x+Math.cos(angle)*radius;
    const z=home.z+Math.sin(angle)*radius;
    if(distanceXZ({x,z},position)<3.5||!canVisit(x,z))continue;
    brain.goal={x,z};brain.walkCount++;return brain.goal;
  }
  brain.goal={...home};
  return brain.goal;
}
export function advanceVillageBrain(brain,position,dt,{
  player=null,dialogue=false,canVisit=()=>true,blocked=false
}={}){
  const step=Math.max(0,Math.min(.12,Number.isFinite(dt)?dt:0));
  if(!step)return {state:brain.state,dx:0,dz:0,yaw:brain.heading};
  const playerDistance=player?distanceXZ(position,player):Infinity;
  if((dialogue&&playerDistance<9)||playerDistance<5.6){
    brain.state='greet';brain.activity='greet';brain.rest=Math.max(brain.rest,1.05);
    if(playerDistance>.01)brain.heading=Math.atan2(player.x-position.x,player.z-position.z);
    return {state:'greet',dx:0,dz:0,yaw:brain.heading};
  }
  if(brain.state==='greet'){
    brain.state='rest';brain.rest=Math.max(brain.rest,1.2);
  }
  if(brain.state==='rest'){
    brain.rest=Math.max(0,brain.rest-step);
    if(brain.rest>0)return {state:'rest',dx:0,dz:0,yaw:brain.heading};
    selectVillageGoal(brain,position,canVisit);brain.state='walk';
  }
  if(blocked){
    brain.stuck+=step;
    if(brain.stuck>=.55){
      selectVillageGoal(brain,position,canVisit);
      brain.stuck=0;
    }
  }else brain.stuck=Math.max(0,brain.stuck-step*2);
  const goal=brain.goal;
  if(!goal){brain.state='rest';brain.rest=1;return {state:'rest',dx:0,dz:0,yaw:brain.heading};}
  const distance=distanceXZ(position,goal);
  if(distance<=.8){
    brain.state='rest';brain.activity='rest';
    brain.rest=brain.profile.rest*(.65+random(brain)*.8);brain.goal=null;
    return {state:'rest',dx:0,dz:0,yaw:brain.heading};
  }
  const length=Math.min(distance,step*brain.profile.speed);
  const dx=(goal.x-position.x)/distance*length,dz=(goal.z-position.z)/distance*length;
  brain.heading=Math.atan2(dx,dz);
  brain.state='walk';brain.activity='walk';brain.steps++;
  return {state:'walk',dx,dz,yaw:brain.heading};
}
