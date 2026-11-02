import * as THREE from 'three';
import {CONTRACTS} from '../systems/VillageContracts.js';
import {actorVisualLevel} from '../systems/ActorLOD.js';
import {VILLAGE_MODEL_CATALOG,assertUniqueVillageModels} from './villageModelCatalog.js';
import {loadVillageModel} from './VillageGLBAssets.js';
import {makeVillageBrain,advanceVillageBrain,distanceXZ} from './VillageNPCAI.js';
import {moveWithCollisions,overlapsCircle,obstacleBlocks} from '../utils/collision.js';
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
        const leg=new THREE.Group();leg.position.set(side*.25,.95,0);
        leg.add(cylinderBetween(new THREE.Vector3(),new THREE.Vector3(0,-.8,0),.19,legs));
        body.add(leg);(root.userData.legs??=[]).push({leg,side});
        const arm=new THREE.Group();arm.position.set(side*.56,2.13,0);
        arm.add(cylinderBetween(new THREE.Vector3(),new THREE.Vector3(side*.11,-.95,.17),.16,coat));body.add(arm);
        (root.userData.arms??=[]).push({arm,side});
        const e=new THREE.Mesh(new THREE.SphereGeometry(.055,7,6),eye);e.position.set(side*.16,2.73,-.36);body.add(e);
      }
      const hat=new THREE.Mesh(new THREE.ConeGeometry(.55,.57,8),cap);hat.position.y=3.32;body.add(hat);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(.95,.065,6,30),new THREE.MeshBasicMaterial({color:0xffdf98}));halo.rotation.x=Math.PI/2;halo.position.y=.12;root.add(halo);
      root.add(labelSprite(spec.name,spec.role));scene.add(root);
      const collider=world.addObstacle(spec.x,root.position.y,spec.z,.63,3.5,'npc');
      this.npcs.push({spec,root,body,halo,collider,
        brain:makeVillageBrain(spec,this.npcs.length),
        blocked:false,model:null,modelStatus:'unloaded'});
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
  /** Static-path world obstacles remain spatially indexed. An NPC collider
   * invalidates the grid only when crossing a 32m cell boundary. */
  colliderCellKey(collider){
    const cell=this.world.obstacleGrid.cellSize,r=collider.radius;
    return [Math.floor((collider.x-r)/cell),Math.floor((collider.x+r)/cell),
      Math.floor((collider.z-r)/cell),Math.floor((collider.z+r)/cell)].join(',');
  }
  /** Check terrain/props ahead, so a destination is walkable before moving.
   * The NPC never leaves the Refúgio, walks on water or scales cabin roofs. */
  canVisit(npc,x,z,from=npc.root.position){
    if(!this.world.walkable(x,z))return false;
    const y=this.world.heightAt(x,z);
    if(!Number.isFinite(y)||y<2||Math.abs(y-from.y)>2.8)return false;
    const obstacles=this.world.obstacleGrid.queryCircle(x,z,.85);
    return !obstacles.some(o=>o!==npc.collider&&obstacleBlocks(o,y+1.4,1.4)
      &&overlapsCircle(x,z,.67,o));
  }
  animateNpcModel(npc,state,dt){
    if(npc.modelStatus==='ready'){
      const model=npc.model,next=state==='walk'&&model.actions?.walk?'walk':'idle';
      if(model.active!==next){
        const target=model.actions[next],previous=model.actions[model.active];
        target?.reset().fadeIn(.18).play();
        previous?.fadeOut(.18);
        model.active=next;
      }
      // Maintain authored feet cadence at the actual gameplay movement speed.
      model.actions?.walk?.setEffectiveTimeScale(Math.max(.65,Math.min(1.65,
        npc.brain.profile.speed/1.15)));
      if(npc.root.visible)model.mixer?.update(Math.min(.12,Math.max(0,dt)));
    }else if(npc.root.visible){
      const stride=state==='walk'?Math.sin(npc.brain.steps*.43)*.43:0;
      for(const {arm,side} of npc.root.userData.arms)
        arm.rotation.x=-side*stride*.65;
      for(const {leg,side} of npc.root.userData.legs??[])
        leg.rotation.x=side*stride;
      npc.body.position.y=state==='walk'?Math.abs(stride)*.045:0;
    }
  }
  update(dt,time,player=null,dialogueOpen=false){
    const step=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
    for(const npc of this.npcs){
      const pos=npc.root.position,brain=npc.brain;
      const playerClose=player&&distanceXZ(pos,player)<88;
      // Distant NPCs keep their last safe waypoint; never run AI for an island
      // that has been completely culled to save CPU on long flights.
      const simulate=npc.root.visible||playerClose;
      if(simulate&&step){
        const current={x:pos.x,z:pos.z};
        const valid=(x,z)=>this.canVisit(npc,x,z);
        const decision=advanceVillageBrain(brain,current,step,{
          player,dialogue:dialogueOpen,canVisit:valid,blocked:npc.blocked
        });
        npc.blocked=false;
        if(decision.state==='walk'){
          const previousY=pos.y,stamp=this.colliderCellKey(npc.collider);
          const move=moveWithCollisions(pos,{x:decision.dx,z:decision.dz},.55,
            this.world.obstacleGrid,(x,z)=>this.world.walkable(x,z),
            o=>o!==npc.collider&&obstacleBlocks(o,previousY+1.55,1.55),
            {groundAt:(x,z)=>this.world.heightAt(x,z),maxStepUp:1});
          const moved=Math.hypot(move.x-pos.x,move.z-pos.z);
          const destinationY=this.world.heightAt(move.x,move.z);
          if(!Number.isFinite(destinationY)||destinationY<2||
             Math.abs(destinationY-previousY)>1.45){
            npc.blocked=true;
          }else{
            pos.x=move.x;pos.z=move.z;pos.y=destinationY;
            npc.collider.x=pos.x;npc.collider.z=pos.z;
            npc.collider.bottom=destinationY;npc.collider.top=destinationY+3.5;
            if(stamp!==this.colliderCellKey(npc.collider))
              this.world.obstacleGrid.invalidate();
            npc.blocked=moved<Math.hypot(decision.dx,decision.dz)*.28;
          }
        }
        const angle=Math.atan2(Math.sin(decision.yaw-npc.root.rotation.y),
          Math.cos(decision.yaw-npc.root.rotation.y));
        npc.root.rotation.y+=angle*Math.min(1,step*5.2);
        this.animateNpcModel(npc,decision.state,step);
      }
      if(npc.root.visible)npc.halo.rotation.z+=step*.38;
    }
    for(let i=0;i<this.markers.length;i++){
      const marker=this.markers[i];if(!marker.group.visible)continue;
      marker.group.rotation.y+=dt*.65;marker.group.position.y=marker.baseY+Math.sin(time*2+i)*.55;
    }
  }
}
