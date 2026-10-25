/** Consistent visual dimensions for the two original Fury GLBs.
 * Their source meshes are approximately 1.7 high and 4.7 across the wings.
 * The protagonist is 2.23 high; at full size the mounts must be taller.
 * Visual geometry is resized inside the existing collision-safe actor root.
 */
export const FURY_VISUAL_TARGET=Object.freeze({
  height:3.35,
  wingspan:9.35,
  length:10.0
});
export const LEGACY_DRAGON_VISUAL_LIMIT=Object.freeze({
  height:4.1,
  wingspan:6,
  length:9
});
export function dragonVisualScale(size,officialFury=false){
  const target=officialFury?FURY_VISUAL_TARGET:LEGACY_DRAGON_VISUAL_LIMIT;
  const x=size?.x,y=size?.y,z=size?.z;
  if(![x,y,z].every(v=>Number.isFinite(v)&&v>.01))throw new Error('Dimensões GLB inválidas.');
  const scale=Math.min(target.height/y,target.wingspan/x,target.length/z);
  if(!Number.isFinite(scale)||scale<=0)throw new Error('Escala GLB inválida.');
  return scale;
}
