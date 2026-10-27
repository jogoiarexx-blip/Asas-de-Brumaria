import {obstacleCandidates} from './ObstacleGrid.js';
import {overlapsObstacle3D} from './collision.js';

/** Height-aware camera and flying-body collision sweeps (no WebGL dependency).
 * All positions use world X/Y/Z coordinates and scenery cylinder colliders.
 */
const inObstacle=overlapsObstacle3D;

/** Pull a third-person camera toward the focus before it hits terrain or a prop.
 * Sampling the segment, not just the endpoint, catches intervening walls.
 */
export function resolveCameraPosition(anchor,desired,obstacles=[],terrainAt=()=>-Infinity,{radius=.55,groundClearance=.8}={}) {
  const dx=desired.x-anchor.x,dy=desired.y-anchor.y,dz=desired.z-anchor.z;
  const length=Math.hypot(dx,dy,dz);
  if(!Number.isFinite(length)||length<1e-7)return {...anchor,clipped:false};
  const steps=Math.max(1,Math.ceil(length/.28));
  // Camera-only canopy clearance. Tree gameplay colliders cover trunks, while
  // the rendered crowns are more than twice as wide. Without this extra
  // volume the camera can sit *inside* opaque crowns and hide the player.
  // Flight, walking, hitboxes and saves continue using the original obstacles.
  const minX=Math.min(anchor.x,desired.x)-radius,maxX=Math.max(anchor.x,desired.x)+radius;
  const minZ=Math.min(anchor.z,desired.z)-radius,maxZ=Math.max(anchor.z,desired.z)+radius;
  const minY=Math.min(anchor.y,desired.y)-radius,maxY=Math.max(anchor.y,desired.y)+radius;
  const corridor=[];
  const intersects=(o,r=o.radius,bottom=o.bottom,top=o.top)=>
    o.x+r>=minX&&o.x-r<=maxX&&o.z+r>=minZ&&o.z-r<=maxZ&&top>=minY&&bottom<=maxY;
  for(const o of obstacleCandidates(obstacles,minX,minZ,maxX,maxZ,5)){
    if(intersects(o))corridor.push(o);
    if(o.type!=='tree')continue;
    // addTree uses .82*size for the trunk collider. Broad crowns need ~2.3*size.
    const treeSize=o.radius/.82;
    const crownRadius=treeSize*2.3;
    const crownBottom=o.bottom+treeSize*1.25;
    const crownTop=o.bottom+treeSize*5.95;
    if(intersects(o,crownRadius,crownBottom,crownTop))
      corridor.push({...o,radius:crownRadius,bottom:crownBottom,top:crownTop});
  }
  let last=0;
  for(let k=1;k<=steps;k++){
    const t=k/steps;
    const x=anchor.x+dx*t,y=anchor.y+dy*t,z=anchor.z+dz*t;
    const floor=terrainAt(x,z);
    const inside=Number.isFinite(floor) && y-radius<floor+groundClearance ||
      corridor.some(o=>inObstacle(x,y,z,radius,radius,o));
    if(inside){
      const safe=Math.max(0,last-.01);
      return {x:anchor.x+dx*safe,y:anchor.y+dy*safe,z:anchor.z+dz*safe,clipped:true};
    }
    last=t;
  }
  return {...desired,clipped:false};
}

/** Move a flying actor using its whole vertical body and swept X/Y/Z substeps.
 * Unlike a horizontal-only collision test, this prevents climbing through a
 * ceiling, diving through a roof, or tunneling into a tower in one frame.
 */
export function moveFlightWithCollisions(start,delta,radius,halfHeight,obstacles=[],groundAt=()=>-Infinity,
  {floorOffset=2.58,bounds=1600}={}) {
  const length=Math.hypot(delta.x,delta.y,delta.z);
  const steps=Math.max(1,Math.ceil(length/Math.max(.15,radius*.23)));
  const dx=delta.x/steps,dy=delta.y/steps,dz=delta.z/steps;
  let {x,y,z}=start,blockedHorizontal=false,blockedVertical=false;
  const corridor=obstacleCandidates(obstacles,Math.min(x,x+delta.x)-radius,
    Math.min(z,z+delta.z)-radius,Math.max(x,x+delta.x)+radius,
    Math.max(z,z+delta.z)+radius).filter(o=>
    o.x+o.radius+radius>=Math.min(x,x+delta.x) &&
    o.x-o.radius-radius<=Math.max(x,x+delta.x) &&
    o.z+o.radius+radius>=Math.min(z,z+delta.z) &&
    o.z-o.radius-radius<=Math.max(z,z+delta.z) &&
    o.top>=Math.min(y,y+delta.y)-halfHeight &&
    o.bottom<=Math.max(y,y+delta.y)+halfHeight);
  const open=(nx,ny,nz,oldX=x,oldZ=z)=>{
    if(Math.abs(nx)>=bounds||Math.abs(nz)>=bounds)return false;
    if(ny<groundAt(nx,nz)+floorOffset-1e-6)return false;
    return !corridor.some(o=>{
      if(!inObstacle(nx,ny,nz,radius,halfHeight,o))return false;
      // Old saves might start inside something: moving OUT is still allowed.
      return !inObstacle(oldX,y,oldZ,radius,halfHeight,o) ||
        (nx-o.x)**2+(nz-o.z)**2 < (oldX-o.x)**2+(oldZ-o.z)**2-1e-9 ||
        (ny-y)*(ny-(o.bottom+o.top)/2)<0;
    });
  };
  for(let k=0;k<steps;k++){
    if(Math.abs(dy)>1e-10){if(open(x,y+dy,z))y+=dy;else blockedVertical=true;}
    if(Math.abs(dx)>1e-10){if(open(x+dx,y,z))x+=dx;else blockedHorizontal=true;}
    if(Math.abs(dz)>1e-10){if(open(x,y,z+dz))z+=dz;else blockedHorizontal=true;}
  }
  return {x,y,z,blockedHorizontal,blockedVertical};
}
