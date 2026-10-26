/** Distance-based scene detail, independent from SNES-like gameplay physics.
 * Hide only decorative foliage/grass, never collision geometry, NPCs or quests. */
// Even on Ultra, distant foliage has no useful pixel footprint. Terrain and
// colliders remain full fidelity, while decorative instances stop rendering.
export const DETAIL_RANGES=Object.freeze({economy:135,balanced:250,quality:520});

export function detailRadius(tier,height=0){
  const base=DETAIL_RANGES[tier];
  if(base===undefined || base===Infinity)return Infinity;
  const altitude=Math.max(0,Number.isFinite(height)?height:0);
  return base+Math.max(0,altitude-20)*1.6;
}

export function visibleIslandFoliage(observer,island,tier,wasVisible=false){
  if(!(tier in DETAIL_RANGES))return true;
  if(!observer)return true;
  const range=island.r+detailRadius(tier,observer.y)+(wasVisible?24:0);
  const dx=observer.x-island.x,dz=observer.z-island.z;
  return dx*dx+dz*dz <= range*range;
}

export function shouldRefreshClouds(elapsed,tier){
  return elapsed >= (tier==='economy'?.09:tier==='balanced'?.05:.016);
}

/** Wraps cloud position consistently even if the browser pauses for a long time. */
export function wrappedCloudX(initialX,drift,time,wind=1){
  const pos=initialX+drift*time*wind;
  return ((pos+450)%900+900)%900-450;
}

/** Update visual decorations only. Gameplay obstacles and terrain stay untouched. */
export function applyIslandVisibility(observer,tier,islands,foliageByIsland,grassByIsland){
  let visible=0;
  for(const island of islands){
    const meshes=foliageByIsland.get(island.name)??[];
    const grass=grassByIsland.get(island.name);
    const previouslyVisible=meshes[0]?.visible??grass?.visible??false;
    const enabled=visibleIslandFoliage(observer,island,tier,previouslyVisible);
    if(enabled)visible++;
    for(const mesh of meshes)mesh.visible=enabled;
    if(grass)grass.visible=enabled;
  }
  return {visible,total:islands.length};
}
