/** Pure movement and LOD budgets for lightweight, deterministic island nature.
 * The terrain, wildlife interactions and collision shapes do not use this module. */
export const NATURE_BUDGETS=Object.freeze({
  economy:Object.freeze({grass:.48,birds:14,pollen:0,interval:.12,wind:.72}),
  balanced:Object.freeze({grass:.76,birds:28,pollen:16,interval:.07,wind:1}),
  quality:Object.freeze({grass:1,birds:42,pollen:34,interval:.035,wind:1.18})
});
export const natureBudget=(tier)=>NATURE_BUDGETS[tier]??NATURE_BUDGETS.balanced;
export const grassDrawCount=(total,tier)=>Math.max(0,Math.min(total,
  Math.ceil(Math.max(0,total)*natureBudget(tier).grass)));
export function birdFlightPose(bird,time){
  const t=Number.isFinite(time)?time:0;
  const speed=Math.max(.12,Number(bird.speed)||.36);
  const a=t*speed+bird.offset;
  const ax=bird.radius??17,az=bird.depth??13;
  const sw=t*.34+bird.offset*.9;
  const x=bird.centerX+Math.cos(a)*ax+Math.sin(sw)*4.5;
  const z=bird.centerZ+Math.sin(a*.88)*az+Math.cos(sw)*3;
  const vx=-Math.sin(a)*ax*speed+Math.cos(sw)*4.5*.34;
  const vz=Math.cos(a*.88)*az*speed*.88-Math.sin(sw)*3*.34;
  const altitude=bird.y+Math.sin(t*.72+bird.offset)*1.7+
    Math.sin(t*1.22+bird.offset*.34)*.58;
  return {x,y:altitude,z,yaw:Math.atan2(-vx,-vz),
    bank:Math.max(-.19,Math.min(.19,Math.sin(t*.57+bird.offset)*.14)),
    glide:Math.sin(t*.56+bird.offset*.7)>.33};
}
export function natureGust(time,wind=0){
  const intensity=Math.max(0,Math.min(2.5,Number(wind)||0));
  return Math.max(.22,Math.min(1.9,.42+intensity*.8+
    Math.sin(time*.51)*.11+Math.sin(time*.19+1.7)*.08));
}
export function pollenDrift(index,time){
  const t=(Number.isFinite(time)?time:0)+index*1.71;
  return {x:Math.sin(t*.67+index*.33)*.85,
    y:Math.sin(t*.95)*.35,z:Math.cos(t*.57+index*.48)*.65};
}
