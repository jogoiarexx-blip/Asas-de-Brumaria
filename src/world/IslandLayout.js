/** Archipelago spacing v2: larger open-water passages without resizing island meshes.
 * The original anchor positions are kept solely for moving older saves safely. */
export const ISLAND_SPACING=1.5;
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
/** Preserve local walkable points, while moving flying travelers over open sea. */
export function migrateLegacyMapPoint(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))return {x,z};
  // The mountain expedition is an independent map and must remain untouched.
  if(x>650)return {x,z};
  // Keep the mountain gateway usable for saves made in its approach corridor.
  if(x>=270&&Math.abs(z-35)<95)return {x,z};
  const islands=Object.values(ORIGINAL_ISLAND_CENTERS);
  let closest=null,nearest=Infinity;
  for(const island of islands){
    const distance=Math.hypot(x-island.x,z-island.z);
    if(distance<nearest){nearest=distance;closest=island;}
  }
  if(closest&&nearest<=closest.r+28){
    return {x:x+closest.x*(ISLAND_SPACING-1),z:z+closest.z*(ISLAND_SPACING-1)};
  }
  return stretchedCenter(x,z);
}
