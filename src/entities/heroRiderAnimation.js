import * as THREE from 'three';

/** Retarget riding animations onto existing Mixamo-like bones without remeshing.
 * Keeps every authored clip intact; generates only missing compatible clips.
 */
const BONES={
  hips:'mixamorig:Hips',spine:'mixamorig:Spine',spine1:'mixamorig:Spine1',
  chest:'mixamorig:Spine2',neck:'mixamorig:Neck',head:'mixamorig:Head',
  lthigh:'mixamorig:LeftUpLeg',rthigh:'mixamorig:RightUpLeg',
  lknee:'mixamorig:LeftLeg',rknee:'mixamorig:RightLeg',
  lfoot:'mixamorig:LeftFoot',rfoot:'mixamorig:RightFoot',
  larm:'mixamorig:LeftArm',rarm:'mixamorig:RightArm',
  lelbow:'mixamorig:LeftForeArm',relbow:'mixamorig:RightForeArm',
  lhand:'mixamorig:LeftHand',rhand:'mixamorig:RightHand'
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const scale=(p,f=1)=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v.map(n=>n*f)]));
export function riderBoneNames(){return Object.values(BONES);}

/** Optimized against measured 44-bone FK. Source rig faces local +Z.
 * Before: both hands 0.31m behind the hips; after: ~0.27m ahead.
 * Preserve the authored five non-mounted animation clips unchanged. */
function seated(t,strength=1){
  const wave=Math.sin(Math.PI*2*t);
  return scale({
    hips:[6,0,.9*wave],spine:[7,0,-.6*wave],spine1:[6,0,.5*wave],
    chest:[5,0,-.8*wave],neck:[-2,0,0],head:[0,1.2*wave,0],
    lthigh:[-63,0,-7],rthigh:[-63,0,7],lknee:[82,0,0],rknee:[82,0,0],
    lfoot:[-14,0,0],rfoot:[-14,0,0],
    larm:[57,21,-10],rarm:[60,-19,7],
    lelbow:[41,3,-3],relbow:[38,-3,4],
    lhand:[-8,0,0],rhand:[-8,0,0]
  },strength);
}
function flying(t,flapping=true){
  const p=seated(t),wave=Math.sin(Math.PI*2*t);
  p.chest=[5+(flapping?2*wave:0),0,-1.2*wave];
  p.spine1=[7,0,-.8*wave];p.hips=[7,0,.9*wave];
  p.head=[-2,0,-1.8*wave];
  p.larm=[57+(flapping?3*wave:0),21,-10];
  p.rarm=[60+(flapping?3*wave:0),-19,7];
  p.lelbow=[41+1.5*wave,3,-3];p.relbow=[38+1.5*wave,-3,4];
  return p;
}
export const RIDER_CLIPS=Object.freeze({
  Idle:[3,t=>({spine:[-1,0,0],chest:[Math.sin(t*Math.PI*2)*1.3,0,0]})],
  Mount:[.86,t=>seated(t,clamp(t*1.28,0,1))],
  Riding_Idle:[2.4,t=>seated(t)],
  Riding_Walk:[.8,t=>{
    const p=seated(t),w=Math.sin(2*Math.PI*t);
    p.chest=[5,0,1.1*w];p.hips=[6,0,-1.1*w];
    p.lthigh=[-63+3*w,0,-7];p.rthigh=[-63-3*w,0,7];return p;
  }],
  Riding_Takeoff:[.78,t=>({...flying(t),chest:[11-6*t,0,0],hips:[9-2*t,0,0]})],
  Riding_Fly:[1,t=>flying(t)],
  Riding_Glide:[2.4,t=>flying(t,false)],
  Riding_Landing:[.54,t=>({...seated(t),chest:[9-4*t,0,0],hips:[9-3*t,0,0]})],
  Riding_Attack:[.4,t=>({...flying(t,false),
    rarm:[60+10*Math.sin(Math.PI*t),-19,7],
    chest:[5+7*Math.sin(Math.PI*t),0,0]})],
  Riding_Hurt:[.5,t=>({...seated(t),
    spine:[7,0,9*Math.sin(Math.PI*t)],
    head:[0,0,-12*Math.sin(Math.PI*t)]})],
  Dismount:[.77,t=>seated(t,clamp((1-t)*1.28,0,1))]
});
export function addMissingRiderClips(scene,clips=[],{repairMounted=false}={}){
  // Previous production GLB clips are backwards. Replace ONLY mounted poses.
  const authored=repairMounted?clips.filter(c=>!Object.hasOwn(RIDER_CLIPS,c.name)):clips;
  const byName=new Set(authored.map(c=>c.name.toLowerCase()));
  const bones=Object.fromEntries(Object.entries(BONES)
    .map(([alias,name])=>[alias,scene.getObjectByName(name)
      ??scene.getObjectByName(name.replace(/[:./]/g,'_'))]).filter(([,bone])=>bone?.isBone));
  // Models with other skeletons retain their authored animation/fallback.
  if(!bones.hips||!bones.lthigh||!bones.rthigh||!bones.larm||!bones.rarm)return clips;
  const generated=[];
  for(const [name,[duration,pose]] of Object.entries(RIDER_CLIPS)){
    if(byName.has(name.toLowerCase()))continue;
    const frames=17,times=Array.from({length:frames},(_,i)=>duration*i/(frames-1));
    const tracks=[];
    for(const [alias,bone] of Object.entries(bones)){
      const original=bone.quaternion.clone(),q=new THREE.Quaternion();
      const values=[];
      for(let i=0;i<frames;i++){
        const degrees=pose(i/(frames-1))[alias]??[0,0,0];
        const euler=new THREE.Euler(...degrees.map(v=>THREE.MathUtils.degToRad(v)),'XYZ');
        q.setFromEuler(euler).premultiply(original).normalize();
        values.push(q.x,q.y,q.z,q.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',times,values));
    }
    generated.push(new THREE.AnimationClip(name,duration,tracks));
  }
  return [...authored,...generated];
}
export function mountedMotionState(dragon={}){
  if((dragon.hurtTime??0)>0)return 'rideHurt';
  if((dragon.attackTime??0)>0)return 'rideAttack';
  if(dragon.pose==='takeoff')return 'rideTakeoff';
  if(dragon.pose==='landing')return 'rideLand';
  if(dragon.airborne)return dragon.speed>12?'rideFly':'rideGlide';
  return dragon.speed>1.15?'rideWalk':'rideIdle';
}
