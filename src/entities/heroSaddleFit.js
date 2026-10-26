/** Seat the real GLB pelvis on the central upper-back surface of either Fury.
 * Coordinates are relative to dragon.visual, never to collision or world Y. */
export function measureFurySaddle(scene,{scale=1,offsetY=0,offsetZ=0}={}){
  const ys=[];
  scene.traverse(node=>{
    if(!node.isMesh||!node.geometry?.attributes?.position)return;
    const p=node.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),y=p.getY(i);
      if(Math.abs(x)<.24&&z>.15&&z<.55&&y>.58)ys.push(y);
    }
  });
  ys.sort((a,b)=>a-b);
  const surfaceY=ys.length>40?ys[Math.floor((ys.length-1)*.97)]:1.05;
  return {x:0,y:offsetY+surfaceY*scale,z:offsetZ-.29*scale,
    confidence:ys.length>40?'mesh':'fallback',sampleCount:ys.length};
}
export function fitHeroSaddle(hero){
  const model=hero?.dragon?.externalDragonModel;
  const rider=hero?.rider;
  const saddle=model?.saddle;
  const hip=rider?.userData?.glbHip;
  if(!model?.officialFury||!saddle||!hip)return false;
  const s=rider.scale;
  const seat={x:saddle.x-hip.x*s.x,
    y:saddle.y+.045-hip.y*s.y,
    z:saddle.z-hip.z*s.z};
  // A late-arriving GLB/species swap must update the animated destination,
  // not teleport the rider mid-mount.
  if(hero._mountMotion)hero._mountMotion.end.set(seat.x,seat.y,seat.z);
  else rider.position.set(seat.x,seat.y,seat.z);
  rider.userData.saddleFit={species:hero.dragon.speciesId??null,saddle:{...saddle},
    hips:{...hip},contactClearance:.045};
  return true;
}
