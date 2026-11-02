/** One unique GLB per existing quest-giver. The NPC id is intentionally
 * unchanged: contracts, save states and collisions remain compatible. */
export const VILLAGE_MODEL_CATALOG=Object.freeze({
  iara:Object.freeze({file:'Astrid.glb',display:'ASTRID',targetHeight:3.36,yaw:Math.PI}),
  borin:Object.freeze({file:'forja.glb',display:'FORJA',targetHeight:3.42,yaw:Math.PI}),
  tavi:Object.freeze({file:'cabeça de vento (2).glb',display:'CABEÇA DE VENTO',targetHeight:3.34,yaw:Math.PI})
});
export function assertUniqueVillageModels(catalog=VILLAGE_MODEL_CATALOG){
  const ids=Object.keys(catalog);
  const files=ids.map(id=>catalog[id]?.file);
  if(files.some(file=>typeof file!=='string'||!file.endsWith('.glb')||file.includes('/')||file.includes('\\')))
    throw new Error('Catálogo de NPCs tem arquivo GLB inválido.');
  if(new Set(files).size!==files.length)throw new Error('Cada NPC deve usar um GLB exclusivo.');
  return true;
}
export const villageModelUrl=(spec,base=import.meta.url)=>
  spec?.file?new URL('../../npc/'+encodeURIComponent(spec.file),base):null;
assertUniqueVillageModels();
