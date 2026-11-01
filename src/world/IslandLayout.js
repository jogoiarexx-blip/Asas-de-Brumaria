/** Archipelago v3: increase both centre-to-centre distances and island radii.
 * 1.75 spacing, 1.18 shoreline radius. The eastern island ends before x=650,
 * where the separately streamed mountain expedition begins.
 * All seven original anchors remain immutable for save migrations. */
export const PREVIOUS_ISLAND_SPACING=1.5;
export const ISLAND_SPACING=1.75;
export const ISLAND_SIZE_SCALE=1.18;
export const ORIGINAL_ISLAND_CENTERS=Object.freeze({
  'Ilha do Refúgio':Object.freeze({x:0,z:0,r:83}),
  'Ilha das Cascatas':Object.freeze({x:-183,z:-126,r:55}),
  'Ilha do Farol':Object.freeze({x:168,z:106,r:57}),
  'Ilha da Névoa':Object.freeze({x:-117,z:153,r:48}),
  'Atol Esquecido':Object.freeze({x:195,z:-162,r:42}),
  'Arquipélago dos Cristais':Object.freeze({x:-320,z:95,r:54}),
  'Ilha das Cinzas':Object.freeze({x:332,z:-110,r:58})
});
export const stretchedCenter=(x,z)=>({x:x*ISLAND_SPACING,z:z*ISLAND_SPACING});
export function stretchPointOnIsland(point,name){
  const original=ORIGINAL_ISLAND_CENTERS[name];
  if(!original)throw new Error('Ilha inexistente: '+name);
  if(!Array.isArray(point)||point.length!==3)throw new Error('Esperado [x,y,z]');
  return [point[0]+original.x*(ISLAND_SPACING-1),point[1],point[2]+original.z*(ISLAND_SPACING-1)];
}
export function stretchMarkerOnIsland(point,name){
  const [x,z]=point;
  const [px,,pz]=stretchPointOnIsland([x,0,z],name);
  return [px,pz];
}
/** Move saves from the original map (v1) or previously published v2 map.
 * Keep the traveller's local position relative to their former island.
 * Above water, use proportional scaling; the mountain region and its gate
 * have fixed coordinates and are deliberately untouched.
 */
export function migrateLegacyMapPoint(x,z,sourceSpacing=1){
  if(!Number.isFinite(x)||!Number.isFinite(z))return {x,z};
  // The mountain expedition is an independent map and must remain untouched.
  if(x>650)return {x,z};
  // Keep the mountain gateway usable for saves made in its approach corridor.
  if(x>=270&&Math.abs(z-35)<95)return {x,z};
  const spacing=sourceSpacing===PREVIOUS_ISLAND_SPACING?PREVIOUS_ISLAND_SPACING:1;
  const islands=Object.values(ORIGINAL_ISLAND_CENTERS);
  let closest=null,nearest=Infinity;
  for(const island of islands){
    const distance=Math.hypot(x-island.x*spacing,z-island.z*spacing);
    if(distance<nearest){nearest=distance;closest=island;}
  }
  if(closest&&nearest<=closest.r+28){
    return {x:x+closest.x*(ISLAND_SPACING-spacing),z:z+closest.z*(ISLAND_SPACING-spacing)};
  }
  return {x:x*ISLAND_SPACING/spacing,z:z*ISLAND_SPACING/spacing};
}
