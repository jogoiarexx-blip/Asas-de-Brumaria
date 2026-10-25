/** Third-person camera framing derived from the actual visible character/dragon.
 * Only visual framing changes: controls, collisions, flight physics, save data do not.
 */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function dragonCameraFraming({riding=false,airborne=false,speed=0,
  visualHeight=0,visualWingspan=0,zoom=1}={}){
  const safeZoom=clamp(Number.isFinite(zoom)?zoom:1,.65,1.6);
  if(!riding)return {
    distance:11.5*safeZoom,baseHeight:6.15,anchorHeight:2.7,
    lookAhead:1.45,lookHeight:2
  };
  const height=clamp(Number.isFinite(visualHeight)?visualHeight:0,0,5.4);
  const span=clamp(Number.isFinite(visualWingspan)?visualWingspan:0,0,13);
  const heightBonus=clamp((height-2.15)*.82,0,1.75);
  const wingsBonus=clamp((span-6)*.62,0,3.2);
  const expansion=heightBonus+wingsBonus;
  const velocity=clamp(Number.isFinite(speed)?speed:0,0,75);
  return {
    distance:(15+velocity*.085+expansion)*safeZoom,
    baseHeight:(airborne?7.4:5.9)+heightBonus*.72,
    anchorHeight:3.6+heightBonus*.35,
    lookAhead:(airborne?6.5:4.3)+wingsBonus*.24,
    lookHeight:2.15+heightBonus*.32
  };
}
