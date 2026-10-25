import * as THREE from 'three';
import {inspectGLB} from './glbValidation.js';
import {mapDragonClips,dragonAnimationState,selectDragonClip} from './dragonClipMap.js';
import {measureFurySaddle,fitHeroSaddle} from './heroSaddleFit.js';
import {browserDragonBudget,maxDragonTextureSize,downsizeDragonTextures} from './dragonTextureBudget.js';

const VERSION='0.180.0';
const mirrors=[`https://cdn.jsdelivr.net/npm/three@${VERSION}/examples/jsm/loaders/GLTFLoader.js`,
  `https://unpkg.com/three@${VERSION}/examples/jsm/loaders/GLTFLoader.js`];
let promise=null;
async function getGLTFLoader(){
  if(!promise){
    // The original Fury GLBs must work on GitHub Pages without relying on
    // a second external CDN request after the main Three.js runtime loads.
    // Bundle the matching r180 loader and its geometry utility in /vendor.
    const localLoader=new URL('../../vendor/addons/loaders/GLTFLoader.js',import.meta.url).href;
    const urls=[localLoader,...mirrors];
    promise=(async()=>{
      let error;
      for(const path of urls){try{
        const mod=await import(/* @vite-ignore */ path);
        if(mod.GLTFLoader)return mod.GLTFLoader;
      }catch(e){error=e;}}
      throw new Error('GLTFLoader indisponível. Use o inicializador com internet na primeira execução. '+String(error?.message??''));
    })();
  }
  try{return await promise;}catch(e){promise=null;throw e;}
}
function disposeRoot(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(obj=>{
    if(!obj.isMesh)return;
    if(obj.geometry)geometries.add(obj.geometry);
    for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
      if(!mat)continue;
      materials.add(mat);
      for(const x of Object.values(mat))if(x?.isTexture)textures.add(x);
    }
  });
  root.parent?.remove(root);
  for(const g of geometries)g.dispose();
  for(const m of materials)m.dispose();
  for(const t of textures)t.dispose();
}

/** Called only after parse and validation complete so bad uploads never
 * erase the current appearance or interfere with rider and flight physics. */
export async function installDragonGLB(dragon,bytes,{gameplaySpecies=null}={}){
  const info=inspectGLB(bytes);
  const raw=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const GLTFLoader=await getGLTFLoader();
  const gltf=await new GLTFLoader().parseAsync(raw,'');
  if(!gltf?.scene)throw new Error('O GLB não possui uma cena 3D.');
  let root=null;
  try{
    // Reduce WebGL texture memory for mobile/low-RAM devices. Color space,
    // UVs, skeletons, meshes, clips and game collision never change.
    const textureBudget=maxDragonTextureSize(browserDragonBudget());
    downsizeDragonTextures(gltf.scene,textureBudget);
    gltf.scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(gltf.scene);
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    if(!Number.isFinite(size.length())||size.y<.01||Math.max(size.x,size.y,size.z)>1e7)
      throw new Error('Dimensões inválidas ou modelo sem altura.');
    const scale=Math.min(4.1/size.y,6/Math.max(size.x,.01),9/Math.max(size.z,.01));
    if(!Number.isFinite(scale)||scale<=0)throw new Error('Escala GLB inválida.');
    root=new THREE.Group();root.name='ExternalDragonGLB';
    const alignment=new THREE.Group();alignment.scale.setScalar(scale);
    // The 49-bone Fury source faces +Z; Brumaria gameplay faces -Z.
    // Align only official species models, leaving optional user GLBs alone.
    const officialFury=gameplaySpecies==='furia_noite'||gameplaySpecies==='furia_luz';
    if(officialFury){
      alignment.rotation.y=Math.PI;
      alignment.position.set(center.x*scale,-2.48-box.min.y*scale,center.z*scale);
    }else alignment.position.copy(center).multiplyScalar(-scale);
    root.add(alignment);alignment.add(gltf.scene);
    const mixer=new THREE.AnimationMixer(gltf.scene);
    const slots=mapDragonClips(gltf.animations??[]);
    const animations={};
    for(const [key,clip] of Object.entries(slots))animations[key]=mixer.clipAction(clip);
    // Keep the old meshes until a valid replacement is ready.
    const current=dragon.externalDragonModel;
    const original=current?.original??dragon.visual.children
      .filter(obj=>obj!==dragon.rider)
      .map(obj=>({obj,visible:obj.visible}));
    root.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=false;}});
    // Preserve the original saddle position through every swap and reset.
    const riderOriginal=current?.riderOriginal??(dragon.rider?.position.clone()??null);
    const riderPrevious=dragon.rider?.position.clone()??null;
    const saddle=officialFury?measureFurySaddle(gltf.scene,{scale,
      offsetY:alignment.position.y,offsetZ:alignment.position.z}):null;
    const nextModel={root,mixer,slots,animations,active:null,original,scale,
      officialFury,riderOriginal,saddle,restRotations:new Map(),rig:gltf.scene};
    if(officialFury){
      for(const name of ['Bone_038','Bone_039','Bone_042','Bone_043',
        'Bone_029','Bone_034','Bone_006','Bone_011']){
        const bone=gltf.scene.getObjectByName(name);
        if(bone)nextModel.restRotations.set(name,{bone,rotation:bone.quaternion.clone(),
          animated:new THREE.Quaternion()});
      }
    }
    // Transactional swap: keep the previous model alive if setting up the
    // new AnimationMixer, action or scene fails on some browsers.
    try{
      dragon.visual.add(root);
      dragon.externalDragonModel=nextModel;
      if(dragon.rider){
        if(officialFury){
          // The new model's back is lower than the procedural saddle.
          // Move only the rider's visual slot; collision/mount remain intact.
          if(dragon.hero?.riderVisualReady)fitHeroSaddle(dragon.hero);
          else dragon.rider.position.set(0,-2.48+1.08*scale-box.min.y*scale+.08,-.06);
        }else if(riderOriginal)dragon.rider.position.copy(riderOriginal);
      }
      for(const {obj} of original)obj.visible=false;
      updateDragonGLB(dragon,0);
    }catch(error){
      dragon.externalDragonModel=current??null;
      if(dragon.rider&&riderPrevious)dragon.rider.position.copy(riderPrevious);
      if(!current)for(const {obj,visible} of original)obj.visible=visible;
      throw error;
    }
    if(current){
      current.mixer.stopAllAction();
      disposeRoot(current.root);
    }
    return {...info,clips:(gltf.animations??[]).map(x=>x.name),mapped:Object.keys(slots),scale};
  }catch(error){
    if(root)disposeRoot(root);
    else disposeRoot(gltf.scene);
    throw error;
  }
}
export function clearDragonGLB(dragon){
  const data=dragon.externalDragonModel;
  if(!data)return;
  dragon.externalDragonModel=null;
  data.mixer.stopAllAction();
  if(dragon.rider&&data.riderOriginal)dragon.rider.position.copy(data.riderOriginal);
  for(const {obj,visible} of data.original)obj.visible=visible;
  disposeRoot(data.root);
  if(dragon.speciesPreset)dragon.setSpecies(dragon.speciesId,dragon.speciesPreset);
}
/** Map the authored 8 clips to actual gameplay phase durations.
 * One-shot attacks/takeoffs used to be cut off halfway through. */
export function furyClipTimeScale(state,clipDuration,speed=0){
  if(!Number.isFinite(clipDuration)||clipDuration<=0)return 1;
  const walkPeriod=THREE.MathUtils.lerp(1.48,.67,THREE.MathUtils.clamp(speed/12,0,1));
  const target={
    idle:3.2,walk:walkPeriod,fly:THREE.MathUtils.lerp(1.05,.74,THREE.MathUtils.clamp(speed/50,0,1)),
    glide:2.4,takeoff:.74,land:.50,attack:.36,hurt:.45
  }[state]??clipDuration;
  return THREE.MathUtils.clamp(clipDuration/target,.5,4.5);
}

export function updateDragonGLB(dragon,dt=0){
  const data=dragon.externalDragonModel;
  if(!data)return;
  const state=dragonAnimationState(dragon);
  const clip=selectDragonClip(data.slots,state);
  const next=clip?data.mixer.clipAction(clip):null;
  if(next&&next!==data.active){
    const oneShot=['attack','hurt','takeoff','land'].includes(state);
    next.setLoop(oneShot?THREE.LoopOnce:THREE.LoopRepeat,oneShot?1:Infinity);
    next.clampWhenFinished=oneShot;
    next.reset().fadeIn(.13).play();
    if(data.active)data.active.fadeOut(.13);
    data.active=next;
  }
  if(next){
    // Speed scales the animation; physics is the sole owner of displacement.
    next.setEffectiveTimeScale(data.officialFury
      ?furyClipTimeScale(state,clip?.duration??1,dragon.speed)
      :1);
  }
  if(Number.isFinite(dt)&&dt>0)data.mixer.update(Math.min(dt,.12));
  if(data.officialFury&&data.restRotations?.size){
    const airborne=state==='fly'||state==='takeoff'||state==='glide';
    // Exaggerate the actual, exported bone keyframes, not the procedural
    // wing meshes (which stay hidden). Keep left/right authoring symmetry.
    const wingGain=state==='fly'?1.75:state==='takeoff'?1.55:state==='glide'?1.12:1.12;
    const legGain=state==='walk'?1.42:state==='land'?1.25:1.06;
    for(const [name,part] of data.restRotations){
      const wing=name==='Bone_038'||name==='Bone_039'||name==='Bone_042'||name==='Bone_043';
      const gain=wing?(airborne?wingGain:1.04):legGain;
      part.animated.copy(part.bone.quaternion);
      part.bone.quaternion.copy(part.rotation).slerp(part.animated,gain);
    }
  }
}
