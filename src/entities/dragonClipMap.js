/** Safely associate author-provided animation names with flight and gameplay.
 * Never assume a GLB includes flight just because it is rigged. */
export const DRAGON_CLIP_STATES=Object.freeze(['idle','walk','takeoff','fly','glide','land','attack','hurt']);
export function classifyDragonClip(name=''){
  const s=String(name).toLowerCase().replace(/[_.-]/g,' ');
  if(/hurt|hit|damage|wound|stagger/.test(s))return 'hurt';
  if(/attack|fire|breath|bite|roar|shoot/.test(s))return 'attack';
  if(/takeoff|take off|launch|depart/.test(s))return 'takeoff';
  if(/landing|land|touchdown/.test(s))return 'land';
  if(/glid|soar|hover|float/.test(s))return 'glide';
  if(/fly|flying|flight|flap|wing/.test(s))return 'fly';
  if(/run|walk|step|gait|move/.test(s))return 'walk';
  if(/idle|rest|breath|stand|sleep/.test(s))return 'idle';
  return null;
}
export function mapDragonClips(clips=[]){
  const slots={};
  for(const clip of clips){
    const kind=classifyDragonClip(clip.name);
    if(kind&&!slots[kind])slots[kind]=clip;
  }
  // Do not assign an attack/hurt clip to idle: that looked like auto-attacking.
  if(!slots.idle)slots.idle=slots.glide??slots.fly??slots.walk??null;
  return slots;
}
export function dragonAnimationState(dragon={}){
  if(dragon.hurtTime>0)return 'hurt';
  if(dragon.attackTime>0)return 'attack';
  if(dragon.pose==='takeoff')return 'takeoff';
  if(dragon.pose==='landing')return 'land';
  if(dragon.airborne)return dragon.speed<12?'glide':'fly';
  if(dragon.riding&&dragon.speed>1.2)return 'walk';
  return 'idle';
}
export function selectDragonClip(slots,state){
  const fallback=state==='takeoff'?['takeoff','fly','glide','idle']:
    state==='land'?['land','walk','idle']:
    state==='glide'?['glide','fly','idle']:
    state==='fly'?['fly','glide','idle']:
    state==='hurt'?['hurt','idle']:
    state==='attack'?['attack','idle']:
    state==='walk'?['walk','idle']:
    ['idle','glide','fly','walk'];
  return fallback.map(s=>slots[s]).find(Boolean)??null;
}
