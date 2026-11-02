import * as THREE from 'three';
import {CONTRACTS} from '../systems/VillageContracts.js';
import {actorVisualLevel} from '../systems/ActorLOD.js';
import {VILLAGE_MODEL_CATALOG,assertUniqueVillageModels} from './villageModelCatalog.js';
import {loadVillageModel} from './VillageGLBAssets.js';
export const VILLAGERS=[
  {id:'iara',name:'ASTRID',role:'Exploradora dos faróis',x:-17,z:25,coat:0x4b8079,cap:0x975a36},
  {id:'lume',name:'LUME',role:'Curandeira',x:22,z:14,coat:0x9f835c,cap:0xd1a271},
  {id:'borin',name:'FORJA',role:'Mestre da forja',x:-7,z:-24,coat:0x71546b,cap:0x62564e},
  {id:'nara',name:'NARA',role:'Guardadora dos filhotes',x:34,z:24,coat:0x7e6b9e,cap:0x6e8b6f},
  {id:'tavi',name:'CABEÇA DE VENTO',role:'Vigia dos Horizontes',x:-29,z:31,coat:0x416b8b,cap:0xc69b5e},
  {id:'suri',name:'SURI',role:'Guardiã dos faróis',x:-30,z:-15,coat:0xa7673a,cap:0xc7a256}
];
function cylinderBetween(a,b,r,mat){
  const vector=new THREE.Vector3().subVectors(b,a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*.78,r,vector.length(),7),mat);
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vector.normalize());mesh.castShadow=true;return mesh;
}
function labelSprite(title,role){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(7,40,46,.9)';ctx.roundRect(5,8,502,109,24);ctx.fill();
  ctx.strokeStyle='#e3ca8b';ctx.lineWidth=4;ctx.stroke();ctx.textAlign='center';ctx.fillStyle='#ffe3a5';ctx.font='bold 35px sans-serif';ctx.fillText(title,256,55);
  ctx.fillStyle='#c5e7dc';ctx.font='22px sans-serif';ctx.fillText(role,256,88);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.scale.set(8,2,1);sprite.position.y=5.6;return sprite;
}
export class VillageNPCs {
  constructor(scene,world){
    this.scene=scene;this.world=world;this.npcs=[];this.markers=[];
    assertUniqueVillageModels();
    this.modelLoading=null;this.loadedModels=new Set();this.modelFailures=new Set();
    const face=new THREE.MeshLambertMaterial({color:0xdba779});
    const hair=new THREE.MeshLambertMaterial({color:0x423631});
    const legs=new THREE.MeshLambertMaterial({color:0x344c50});
    const eye=new THREE.MeshBasicMaterial({color:0x1b292c});
    for(const spec of VILLAGERS){
      const root=new THREE.Group();root.position.set(spec.x,world.heightAt(spec.x,spec.z),spec.z);root.rotation.y=Math.atan2(spec.x,spec.z)+Math.PI;
      // Keep halo and name label outside the replaceable model.
      const body=new THREE.Group();body.name='NpcProceduralFallback';root.add(body);
      const coat=new THREE.MeshLambertMaterial({color:spec.coat});
      const cap=new THREE.MeshLambertMaterial({color:spec.cap});
      const torso=new THREE.Mesh(new THREE.CylinderGeometry(.47,.62,1.3,9),coat);torso.position.y=1.65;torso.castShadow=true;body.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.4,12,9),face);head.position.y=2.7;body.add(head);
      const hairTop=new THREE.Mesh(new THREE.SphereGeometry(.42,10,7),hair);hairTop.scale.y=.42;hairTop.position.y=3.04;body.add(hairTop);
      for(const side of [-1,1]){
        body.add(cylinderBetween(new THREE.Vector3(side*.25,.9,0),new THREE.Vector3(side*.25,.13,0),.19,legs));
        const arm=new THREE.Group();arm.position.set(side*.56,2.13,0);
        arm.add(cylinderBetween(new THREE.Vector3(),new THREE.Vector3(side*.11,-.95,.17),.16,coat));body.add(arm);
        (root.userData.arms??=[]).push({arm,side});
        const e=new THREE.Mesh(new THREE.SphereGeometry(.055,7,6),eye);e.position.set(side*.16,2.73,-.36);body.add(e);
      }
      const hat=new THREE.Mesh(new THREE.ConeGeometry(.55,.57,8),cap);hat.position.y=3.32;body.add(hat);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(.95,.065,6,30),new THREE.MeshBasicMaterial({color:0xffdf98}));halo.rotation.x=Math.PI/2;halo.position.y=.12;root.add(halo);
      root.add(labelSprite(spec.name,spec.role));scene.add(root);this.npcs.push({spec,root,body,halo,model:null,modelStatus:'unloaded'});
      world.addObstacle(spec.x,root.position.y,spec.z,.63,3.5,'npc');
    }
    const palette={correio:0xffcb86,ervas:0x89ffc3,minérios:0x9ec1fa,socorro:0xf8a6dc,patrulha:0x92caff,brasas:0xff985c};
    for(const [id,def] of Object.entries(CONTRACTS)){
      for(let i=0;i<def.points.length;i++){
        const [x,y,z]=def.points[i],height=def.requiresMount?y:world.heightAt(x,z)+1.8;
        const group=new THREE.Group();group.position.set(x,height,z);
        const color=palette[id],material=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.85,flatShading:true});
        const center=new THREE.Mesh(!def.requiresMount?new THREE.OctahedronGeometry(1.1):new THREE.BoxGeometry(2.4,1.3,.9),material);group.add(center);
        const hoop=new THREE.Mesh(new THREE.TorusGeometry(!def.requiresMount?2.5:5,.15,6,32),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));group.add(hoop);
        const beam=new THREE.Mesh(new THREE.CylinderGeometry(.14,.85,!def.requiresMount?7:18,8,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}));beam.position.y=!def.requiresMount?3.6:9;group.add(beam);
        if(def.requiresFire){
          const brazier=new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.8,2.1,6),new THREE.MeshLambertMaterial({color:0x684737}));
          brazier.position.y=-1.3;group.add(brazier);
          const flame=new THREE.Mesh(new THREE.ConeGeometry(1.25,3.8,5),new THREE.MeshBasicMaterial({color:0xffa13c,transparent:true,opacity:.85}));
          flame.position.y=1.4;group.add(flame);group.userData.beaconFlame=flame;
        }
        group.visible=false;scene.add(group);this.markers.push({id,index:i,group,baseY:height});
      }
    }
  }
  /** Hide distant NPC artwork only: dialogue, saved contracts and colliders stay. */
  /** Load one unique NPC at a time. This is intentionally deferred until
   * after Play, so large textures do not compete with dragon boot / GPU warmup.
   * Labels, contracts and physical obstacles exist even before asset loading.
   */
  streamModels(observer,canLoad=false){
    if(!canLoad||this.modelLoading||!observer)return;
    const candidate=this.npcs
      .filter(n=>VILLAGE_MODEL_CATALOG[n.spec.id]&&n.modelStatus==='unloaded')
      .map(n=>({npc:n,d:Math.hypot(n.root.position.x-observer.x,n.root.position.z-observer.z)}))
      .filter(item=>item.d<78)
      .sort((a,b)=>a.d-b.d)[0]?.npc;
    if(!candidate)return;
    const id=candidate.spec.id,config=VILLAGE_MODEL_CATALOG[id];
    candidate.modelStatus='loading';
    this.modelLoading=loadVillageModel(config).then(model=>{
      // Replace ONLY this NPC's fallback, never reuse a scene for another id.
      candidate.root.add(model.holder);
      candidate.model=model;
      candidate.body.visible=false;
      candidate.modelStatus='ready';
      this.loadedModels.add(id);
      console.info('[Vila GLB] Modelo exclusivo:',id,config.file,
        'altura:',model.visualHeight,'escala:',model.scale,
        'clipes:',model.clips.join(', ')||'estático','idle gerado:',model.syntheticIdle);
    }).catch(error=>{
      // Transactional fallback: contracts and interactions stay available.
      candidate.body.visible=true;
      candidate.modelStatus='failed';this.modelFailures.add(id);
      console.warn('[Vila GLB] Mantido NPC procedural:',id,config.file,error);
    }).finally(()=>{this.modelLoading=null;});
  }
  setDetail(observer,tier,camera,forward,canLoad=false){
    for(const npc of this.npcs){
      npc.root.visible=actorVisualLevel(observer,npc.root.position,camera,forward,tier,'npc')!=='hidden';
    }
    this.streamModels(observer,canLoad);
  }
  nearby(position,limit=5){
    let best=null,dist=limit*limit;
    for(const item of this.npcs){const dx=item.root.position.x-position.x,dz=item.root.position.z-position.z;
      const d=dx*dx+dz*dz;if(d<dist){dist=d;best=item;}}
    return best;
  }
  refresh(contracts){
    for(const marker of this.markers){
      const state=contracts.state[marker.id],def=CONTRACTS[marker.id];
      const [x,y,z]=contracts.points(marker.id)[marker.index];
      marker.baseY=def.requiresMount?y:this.world.heightAt(x,z)+1.8;
      marker.group.position.set(x,marker.baseY,z);
      marker.group.visible=state.status==='active'&&!state.collected[marker.index];
    }
  }
  update(dt,time){
    for(let i=0;i<this.npcs.length;i++){
      const npc=this.npcs[i];if(!npc.root.visible)continue;
      npc.halo.rotation.z+=dt*.38;
      if(npc.modelStatus==='ready'){
        npc.model.mixer?.update(Math.min(.12,Math.max(0,dt)));
      }else for(const {arm,side} of npc.root.userData.arms)
        arm.rotation.z=side*Math.sin(time*1.7+i)*.13;
      npc.root.rotation.y=Math.sin(time*.43+i)*.28+Math.PI*.75;
    }
    for(let i=0;i<this.markers.length;i++){
      const marker=this.markers[i];if(!marker.group.visible)continue;
      marker.group.rotation.y+=dt*.65;marker.group.position.y=marker.baseY+Math.sin(time*2+i)*.55;
    }
  }
}
