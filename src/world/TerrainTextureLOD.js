/** Distance to the shoreline rather than the island centre, with hysteresis.
 * The original 2048px PBR quality is preserved close to the observer. */
export const TERRAIN_LOD=Object.freeze({
  highEnter:115,highLeave:185,
  mediumEnter:295,mediumLeave:375,
  lowEnter:620,lowLeave:740,
  evictionSeconds:18,
  batchUploads:1
});

export function coastDistance(observer,island){
  if(!observer||!island||!Number.isFinite(observer.x)||!Number.isFinite(observer.z))
    return Infinity;
  return Math.max(0,Math.hypot(observer.x-island.x,observer.z-island.z)-(island.r??0));
}
/** Profile governs the highest resolution; observer distance selects LOD. */
export function islandTextureLevel(observer,island,quality='balanced',previous=null){
  const distance=coastDistance(observer,island);
  const high=quality==='quality';
  if(high&&distance<=(previous==='desktop'?TERRAIN_LOD.highLeave:TERRAIN_LOD.highEnter))
    return 'desktop';
  if(distance<=(previous==='mobile'||previous==='desktop'
    ?TERRAIN_LOD.mediumLeave:TERRAIN_LOD.mediumEnter))return 'mobile';
  if(distance<=(previous==='low'||previous==='mobile'||previous==='desktop'
    ?TERRAIN_LOD.lowLeave:TERRAIN_LOD.lowEnter))return 'low';
  return null;
}

export function prioritizeIslandLevels(observer,islands,quality,previous=new Map()){
  return islands.map(island=>({island,edge:coastDistance(observer,island),
    level:islandTextureLevel(observer,island,quality,previous.get(island.name))}))
    .sort((a,b)=>a.edge-b.edge);
}
