/** Pure HLOD thresholds for unit tests without a WebGL/Three.js dependency. */
export const IMPOSTOR_PROFILES=Object.freeze({
  economy:Object.freeze({near:85,far:145,hide:880}),
  balanced:Object.freeze({near:125,far:215,hide:1050}),
  quality:Object.freeze({near:180,far:325,hide:1300})
});
export function lodFromShore(distance,profile,previous='far'){
  const h=19;
  const near=previous==='full'?profile.near+h:profile.near-h;
  const far=previous==='far'?profile.far-h:profile.far+h;
  return distance<near?'full':distance<far?'mid':distance<profile.hide?'far':'hidden';
}
export function boxSize(b){
  return {width:Math.max(.02,b.max.x-b.min.x,b.max.z-b.min.z),
    height:Math.max(.02,b.max.y-b.min.y),centerY:(b.min.y+b.max.y)/2};
}
