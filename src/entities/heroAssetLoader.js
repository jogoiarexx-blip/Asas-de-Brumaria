import * as THREE from 'three';
import {inspectGLB} from './glbValidation.js';
import {addMissingRiderClips,mountedMotionState} from './heroRiderAnimation.js';
import {fitHeroSaddle} from './heroSaddleFit.js';
import {createPedestrianIdle} from './heroPedestrianIdle.js';

const VERSION='0.180.0';
const CDN=[`https://cdn.jsdelivr.net/npm/three@${VERSION}/examples/jsm/`,`https://unpkg.com/three@${VERSION}/examples/jsm/`];
let loaderPromise=null;
async function firstImport(urls){
 let error;
 for(const url of urls){try{return await import(/* @vite-ignore */ url);}catch(e){error=e;}}
 throw new Error('Não foi possível carregar o leitor GLB. Verifique a internet ou execute o inicializador para guardar as bibliotecas localmente. '+String(error?.message??''));
}
async function addons(){
 if(loaderPromise)return loaderPromise;
 loaderPromise=(async()=>{
   const loaders=[new URL('../../vendor/addons/loaders/GLTFLoader.js',import.meta.url).href,...CDN.map(c=>c+'loaders/GLTFLoader.js')];
   const skeletons=[new URL('../../vendor/addons/utils/SkeletonUtils.js',import.meta.url).href,...CDN.map(c=>c+'utils/SkeletonUtils.js')];
   const [loader,rig]=await Promise.all([firstImport(loaders),firstImport(skeletons).catch(()=>null)]);
   return {GLTFLoader:loader.GLTFLoader,cloneSkinned:rig?.clone??null};
 })();
 try{return await loaderPromise;}catch(error){loaderPromise=null;throw error;}
}
function disposeModels(hero){
 for(const mixer of hero.glbMixers??[])mixer.stopAllAction();
 hero.glbMixers=[];
 const materials=new Set(),geometries=new Set(),textures=new Set();
 for(const root of hero.glbRoots??[]){
   root.traverse(node=>{
     if(!node.isMesh)return;
     if(node.geometry)geometries.add(node.geometry);
     for(const mat of (Array.isArray(node.material)?node.material:[node.material])){
       if(!mat)continue;materials.add(mat);
       for(const val of Object.values(mat))if(val?.isTexture)textures.add(val);
     }
   });
   root.parent?.remove(root);
 }
 for(const g of geometries)g.dispose();for(const t of textures)t.dispose();for(const m of materials)m.dispose();
 hero.glbRoots=[];hero.glbClips=[];hero.externalModel=null;hero.externalMixer=null;hero.externalClips=null;
 hero.riderVisualReady=false;
 if(hero.rider?.userData?.preGLBMount){
   hero.rider.position.copy(hero.rider.userData.preGLBMount);
   delete hero.rider.userData.preGLBMount;
 }
 if(hero.rider?.userData){delete hero.rider.userData.glbHip;delete hero.rider.userData.saddleFit;}
}
function makeVariant(scene,yaw){
 const box=new THREE.Box3().setFromObject(scene),size=box.getSize(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<.01)throw new Error('GLB sem tamanho válido.');
 const scale=2.23/size.y;
 scene.scale.setScalar(scale);
 scene.position.set(-(box.min.x+box.max.x)*.5*scale,-box.min.y*scale,-(box.min.z+box.max.z)*.5*scale);
 const root=new THREE.Group();root.rotation.y=yaw;root.add(scene);
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});
 return root;
}
const clipName=(name='')=>{
 const n=name.toLowerCase().replace(/[._-]+/g,' ');
 if(/riding hurt/.test(n))return 'rideHurt';
 if(/riding attack/.test(n))return 'rideAttack';
 if(/riding takeoff/.test(n))return 'rideTakeoff';
 if(/riding landing/.test(n))return 'rideLand';
 if(/riding glide/.test(n))return 'rideGlide';
 if(/riding fly/.test(n))return 'rideFly';
 if(/riding walk/.test(n))return 'rideWalk';
 if(/riding idle|riding sit|ride idle/.test(n))return 'rideIdle';
 if(n==='mount')return 'mount';
 if(n==='dismount')return 'dismount';
 if(/ride|sit/.test(n))return 'rideIdle';
 if(/run|sprint/.test(n))return 'run';
 if(/walk/.test(n))return 'walk';
 if(/idle|rest|breath/.test(n))return 'idle';
 if(/dead|death/.test(n))return 'dead';
 if(/arise|get up/.test(n))return 'arise';
 if(/dance/.test(n))return 'dance';
 return null;
};
function mixAnimations(scene,sourceClips,{repairMounted=false,pedestrian=false}={}){
 const clipList=repairMounted?addMissingRiderClips(scene,sourceClips,{repairMounted:true}):[...sourceClips];
 const synthesized=pedestrian?createPedestrianIdle(clipList):null;
 const clips=synthesized?[...clipList,synthesized]:clipList;
 const mixer=new THREE.AnimationMixer(scene),actions={};
 for(const clip of clips){const slot=clipName(clip.name);if(slot&&!actions[slot])actions[slot]=mixer.clipAction(clip);}
 const active=actions.idle??actions.walk??Object.values(actions)[0]??null;
 active?.play();
 return {mixer,actions,active,state:'idle'};
}

/** Load a self-contained user GLB. Does not replace existing model on failure. */
export async function installHeroGLB(hero,bytes,{yaw=0,onStatus=()=>{}}={}){
 const raw=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const info=inspectGLB(raw);
 onStatus(`Lendo ${info.meshCount} malha(s) 3D…`);
 const {GLTFLoader,cloneSkinned}=await addons();
 const loader=new GLTFLoader();
 const gltf=await loader.parseAsync(raw,'');
 if(!gltf?.scene)throw new Error('GLB sem cena 3D.');
 // SkeletonUtils.clone preserves skin/bone references; when unavailable, parse
 // a second time instead of using scene.clone() with broken skinning.
 const mountedScene=cloneSkinned?cloneSkinned(gltf.scene):(await new GLTFLoader().parseAsync(raw,'')).scene;
 const foot=makeVariant(gltf.scene,yaw),rider=makeVariant(mountedScene,yaw);
 const footAnim=mixAnimations(gltf.scene,gltf.animations??[],{pedestrian:true});
 const rideAnim=mixAnimations(mountedScene,gltf.animations??[],{repairMounted:true});
 disposeModels(hero);
 hero.group.add(foot);hero.rider.add(rider);
 hero.rider.updateMatrixWorld(true);
 const hipBone=mountedScene.getObjectByName('mixamorigHips')
   ??mountedScene.getObjectByName('mixamorig_Hips')
   ??mountedScene.getObjectByName('mixamorig:Hips');
 if(hipBone?.isBone){
   const hips=hero.rider.worldToLocal(hipBone.getWorldPosition(new THREE.Vector3()));
   hero.rider.userData.glbHip={x:hips.x,y:hips.y,z:hips.z};
   hero.rider.userData.preGLBMount=hero.rider.position.clone();
 }
 hero.group.userData.body.visible=false;hero.rider.userData.body.visible=false;
 hero.glbRoots=[foot,rider];hero.glbClips=[footAnim,rideAnim];hero.glbMixers=[footAnim.mixer,rideAnim.mixer];
 hero.riderVisualReady=true;
 fitHeroSaddle(hero);
 hero.mountAnimationRemaining=hero.mounted?.83:0;hero.dismountAnimationRemaining=0;
 hero.externalHeroInfo={...info,animations:(gltf.animations??[]).map(a=>a.name),
   mappedRiding:Object.keys(rideAnim.actions).filter(name=>name.startsWith('ride')||name==='mount'||name==='dismount')};
 hero.externalModel=foot;hero.externalMixer=footAnim.mixer;hero.externalClips=footAnim.actions;
 return info;
}
export function clearHeroGLB(hero){
 disposeModels(hero);
 hero.group.userData.body.visible=true;
 hero.rider.userData.body.visible=true;
}
export async function loadOptionalHeroGLB(hero,url,{yaw=0,onError=console.warn}={}){
 if(!url)return false;
 try{
   const response=await fetch(new URL(url,document.baseURI));
   if(!response.ok)throw new Error(`GLB não encontrado: HTTP ${response.status} (${url})`);
   await installHeroGLB(hero,await response.arrayBuffer(),{yaw});return true;
 }catch(error){onError('Modelo GLB opcional indisponível; personagem original preservado:',error);return false;}
}
function transition(data,name,{oneShot=false,rate=1}={}){
 const {mixer,actions}=data;
 const next=actions[name]??actions.rideIdle??actions.idle??actions.walk??Object.values(actions)[0];
 if(!next)return mixer;
 if(next!==data.active){
   next.reset().setLoop(oneShot?THREE.LoopOnce:THREE.LoopRepeat,oneShot?1:Infinity);
   next.clampWhenFinished=oneShot;
   next.fadeIn(.17).play();
   data.active?.fadeOut(.17);
   data.active=next;data.state=name;
 }
 next.setEffectiveTimeScale(THREE.MathUtils.clamp(rate,.6,2.2));
 return mixer;
}
export function updateOptionalHeroGLB(hero,dt=0){
 if(!hero.glbClips?.length||!Number.isFinite(dt)||dt<0)return;
 const foot=hero.glbClips[0],mounted=hero.glbClips[1];
 hero.mountAnimationRemaining=Math.max(0,(hero.mountAnimationRemaining??0)-dt);
 hero.dismountAnimationRemaining=Math.max(0,(hero.dismountAnimationRemaining??0)-dt);
 let footState=hero.moveSpeed>.12?(hero.moveSpeed>5.5?'run':'walk'):'idle';
 if(!hero.mounted&&hero.dismountAnimationRemaining>0)footState='dismount';
 const footRate=footState==='run'?Math.max(.8,hero.moveSpeed/8.3):footState==='walk'?Math.max(.8,hero.moveSpeed/3.2):1;
 // The mounted body follows the same real dragon state as its 8-clip GLB.
 const rideState=hero.mounted&&hero.mountAnimationRemaining>0?'mount':mountedMotionState(hero.dragon);
 const rideSpeed=rideState==='rideWalk'?Math.max(.75,hero.dragon.speed/7.5):1;
 // Two full skinned 100k-vertex meshes are retained for seamless swapping,
 // but ONLY the visible rig receives expensive mixer updates each frame.
 if(hero.mounted){
   transition(mounted,rideState,{
     oneShot:['mount','rideTakeoff','rideLand','rideAttack','rideHurt'].includes(rideState),
     rate:rideSpeed
   }).update(Math.min(dt,.12));
 }else{
   transition(foot,footState,{oneShot:footState==='dismount',rate:footRate})
     .update(Math.min(dt,.12));
 }
}
