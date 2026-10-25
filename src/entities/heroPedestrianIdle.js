import * as THREE from 'three';

/** A grounded stance sampled from the authored walk, without playing its gait.
 * The original character only ships Running, Walking, Arise, Boom_Dance, Dead.
 * Sampling all channels at a fixed instant freezes root motion and leg motion,
 * while a very small chest oscillation keeps the standing hero alive.
 */
export function createPedestrianIdle(clips=[]){
  if(clips.some(c=>/^(idle|standing|rest|breath)$/i.test(c.name)))return null;
  const walk=clips.find(c=>/walk/i.test(c.name));
  if(!walk?.tracks?.length||!Number.isFinite(walk.duration)||walk.duration<=0)return null;
  const times=[0,.75,1.5,2.25,3];
  const target=walk.duration*.5;
  const tracks=[];
  for(const track of walk.tracks){
    const value=Array.from(track.createInterpolant().evaluate(target));
    if(!value.length||!value.every(Number.isFinite))continue;
    const chest=/spine2|chest/i.test(track.name)&&/\.quaternion$/.test(track.name)&&value.length===4;
    const buffer=[];
    for(let i=0;i<times.length;i++){
      if(chest){
        const base=new THREE.Quaternion(...value);
        // 1 degree of breathing at most; no motion on the feet or hips.
        base.multiply(new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1,0,0),Math.sin(times[i]*Math.PI*2/3)*.018));
        buffer.push(base.x,base.y,base.z,base.w);
      }else buffer.push(...value);
    }
    tracks.push(new track.constructor(track.name,times,buffer));
  }
  return tracks.length?new THREE.AnimationClip('Idle',3,tracks):null;
}
