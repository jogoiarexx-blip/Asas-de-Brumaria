/** Lazy XZ uniform-grid broadphase for static scenery and mountain colliders.
 * Keeps the original obstacle objects and precise collision tests unchanged.
 * When external code adds/removes obstacles or replaces the array (mountain
 * streaming), the grid automatically rebuilds at the next query.
 */
export class ObstacleGrid {
  constructor(getObstacles,{cellSize=32}={}){
    if(typeof getObstacles!=='function'||!(cellSize>0))throw Error('Invalid obstacle grid');
    this.getObstacles=getObstacles;
    this.cellSize=cellSize;
    this.cells=new Map();this.source=null;this.count=-1;
    this.stats={rebuilds:0,queries:0,candidates:0,fullScanEquivalent:0};
  }
  key(x,z){return `${x},${z}`;}
  refresh(){
    const source=this.getObstacles();
    if(source===this.source&&source.length===this.count)return;
    this.source=source;this.count=source.length;this.cells.clear();
    const scale=this.cellSize;
    for(const obstacle of source){
      const radius=Math.max(0,obstacle.radius||0);
      const minX=Math.floor((obstacle.x-radius)/scale),maxX=Math.floor((obstacle.x+radius)/scale);
      const minZ=Math.floor((obstacle.z-radius)/scale),maxZ=Math.floor((obstacle.z+radius)/scale);
      for(let cx=minX;cx<=maxX;cx++)for(let cz=minZ;cz<=maxZ;cz++){
        const key=this.key(cx,cz),bucket=this.cells.get(key)??[];
        bucket.push(obstacle);this.cells.set(key,bucket);
      }
    }
    this.stats.rebuilds++;
  }
  /** Spatial broadphase only: caller still performs vertical and shape tests.
   * extraRadius supports the third-person camera's larger decorative canopies. */
  queryAABB(minX,minZ,maxX,maxZ,extraRadius=0){
    this.refresh();
    const scale=this.cellSize,pad=Math.max(0,extraRadius);
    const loX=Math.floor((minX-pad)/scale),hiX=Math.floor((maxX+pad)/scale);
    const loZ=Math.floor((minZ-pad)/scale),hiZ=Math.floor((maxZ+pad)/scale);
    const found=new Set();
    for(let cx=loX;cx<=hiX;cx++)for(let cz=loZ;cz<=hiZ;cz++){
      for(const obstacle of this.cells.get(this.key(cx,cz))??[])found.add(obstacle);
    }
    const result=[];
    for(const o of found){
      const radius=Math.max(0,o.radius||0)+pad;
      if(o.x+radius>=minX&&o.x-radius<=maxX&&o.z+radius>=minZ&&o.z-radius<=maxZ)
        result.push(o);
    }
    this.stats.queries++;this.stats.candidates+=result.length;
    this.stats.fullScanEquivalent+=this.count;
    return result;
  }
  queryCircle(x,z,radius=0,extraRadius=0){
    const r=Math.max(0,radius);
    return this.queryAABB(x-r,z-r,x+r,z+r,extraRadius);
  }
}
/** Compatible with both flat obstacle arrays (tests/previews) and indexed worlds. */
export function obstacleCandidates(obstacles,minX,minZ,maxX,maxZ,extraRadius=0){
  return typeof obstacles?.queryAABB==='function'
    ?obstacles.queryAABB(minX,minZ,maxX,maxZ,extraRadius)
    :obstacles??[];
}
