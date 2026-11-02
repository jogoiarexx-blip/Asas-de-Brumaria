import * as THREE from 'three';
import {inspectGLB} from './glbValidation.js';
import {createPedestrianIdle} from './heroPedestrianIdle.js';
import {villageModelUrl} from './villageModelCatalog.js';

const VERSION='0.180.0';
const LOCAL=new URL('../../vendor/addons/loaders/GLTFLoader.js',import.meta.url).href;
const SOURCES=[LOCAL,
  'https://cdn.jsdelivr.net/npm/three@'+VERSION+'/examples/jsm/loaders/GLTFLoader.js',
  'https://unpkg.com/three@'+VERSION+'/examples/jsm/loaders/GLTFLoader.js'];
let loaderPromise=null;
async function getLoader(){
  loaderPromise??=(async()=>{
    let failure;
    for(const url of SOURCES){
      try{const module=await import(/* @vite-ignore */ url);if(module.GLTFLoader)return module.GLTFLoader;}
      catch(e){failure=e;}
    }
    throw new Error('Leitor GLB local/CDN indisponível: '+String(failure?.message??''));
  })();
  try{return await loaderPromise;}catch(e){loaderPromise=null;throw e;}
}

/** Fit an asset without squashing it: same uniform scale on X/Y/Z.
 * Root remains on the exact terrain height and collision position. */
export function fitVillageModel(scene,{targetHeight=3.35,yaw=Math.PI}={}){
  scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(scene);
  const size=bounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<.01||size.y>1e6)
    throw new Error('GLB de NPC sem altura válida.');
  const center=bounds.getCenter(new THREE.Vector3());
  const scale=targetHeight/size.y;
  const holder=new THREE.Group();
  holder.name='VillageGLBVisual';
  holder.rotation.y=yaw;
  scene.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  scene.scale.setScalar(scale);
  holder.add(scene);
  scene.traverse(node=>{
    if(node.isMesh||node.isSkinnedMesh){
      node.castShadow=true;
      node.receiveShadow=false;
      node.frustumCulled=false; // Skinned bounds move during authored animations.
    }
  });
  return {holder,scale,originalHeight:size.y,visualHeight:targetHeight};
}

/** Loads one file, at most once per NPC, with a procedural fallback if the GLB
 * is corrupt, missing or unsupported. Does not touch contracts or hitboxes.
 * The caller serializes jobs to avoid three 10–14 MB texture uploads at once. */
export async function loadVillageModel(spec,{fetcher=(...a)=>fetch(...a),base=import.meta.url}={}){
  const url=villageModelUrl(spec,base);
  if(!url)throw new Error('NPC não possui modelo cadastrado.');
  const response=await fetcher(url,{cache:'force-cache'});
  if(!response.ok)throw new Error('NPC '+spec.file+' HTTP '+response.status);
  const bytes=await response.arrayBuffer();
  const info=inspectGLB(bytes);
  const Loader=await getLoader();
  const gltf=await new Loader().parseAsync(bytes,'');
  if(!gltf?.scene)throw new Error('GLB sem cena 3D para NPC: '+spec.file);
  const model=fitVillageModel(gltf.scene,spec);
  const animations=gltf.animations??[];
  const authoredIdle=animations.find(clip=>/idle|rest|stand|breath|talk|speak/i.test(clip.name));
  // The uploaded Astrid / Forja / Cabeça de Vento have Running and Walking,
  // but no standing pose. Sample the real walk at mid-stride and generate a
  // subtle 3-second breathing loop, freezing feet/root motion (no moonwalk).
  const idle=authoredIdle??createPedestrianIdle(animations);
  const walking=animations.find(clip=>/walk/i.test(clip.name));
  // Root X/Z translation belongs to gameplay movement, not animation data.
  // Preserve local leg/arm tracks and the vertical bounce of the hips.
  const inPlaceWalk=walking?.clone();
  if(inPlaceWalk){
    inPlaceWalk.name='NPC_WALK_IN_PLACE';
    for(const track of inPlaceWalk.tracks){
      if(!track.name.endsWith('.position')||track.getValueSize()!==3)continue;
      const values=track.values,baseX=values[0],baseZ=values[2];
      for(let i=0;i<values.length;i+=3){values[i]=baseX;values[i+2]=baseZ;}
    }
  }
  const mixer=idle||inPlaceWalk?new THREE.AnimationMixer(gltf.scene):null;
  const actions={idle:idle&&mixer?mixer.clipAction(idle):null,
    walk:inPlaceWalk&&mixer?mixer.clipAction(inPlaceWalk):null};
  actions.idle?.play();
  return {...model,mixer,actions,active:'idle',info,clips:animations.map(clip=>clip.name),
    syntheticIdle:!authoredIdle&&!!idle};
}
