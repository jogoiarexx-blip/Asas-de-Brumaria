import * as THREE from 'three';
import {stretchPointOnIsland} from '../world/IslandLayout.js';
import {limitedTurn,pursuitYaw,shortestAngle} from '../systems/combatMath.js';
import {approach,clamp} from '../utils/math.js';
import {actorVisualLevel,shouldAnimateActor,enemySimulationStep} from '../systems/ActorLOD.js';
import {dragonMeshVisibility} from '../systems/DragonMeshLOD.js';
import {enemyCombatPlan} from '../systems/EnemyTactics.js';
import {buildDragonProxy} from './DragonProxy.js';

// Malha leve e original, com asas de duas juntas, cauda articulada e cabeça animada.
function enemyModel(color,accent) {
  const root=new THREE.Group();
  const main=new THREE.MeshStandardMaterial({color,roughness:.7,flatShading:true});
  const dark=new THREE.MeshStandardMaterial({color:0x292034,roughness:.82,flatShading:true});
  const wingSkin=new THREE.MeshStandardMaterial({color:accent,roughness:.75,side:THREE.DoubleSide,flatShading:true});
  const eye=new THREE.MeshBasicMaterial({color:0xffc172});
  const add=(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
    mesh.castShadow=true;parent.add(mesh);return mesh;
  };
  add(root,new THREE.SphereGeometry(1,10,8),main,0,0,.15,1.25,.78,2.2);
  add(root,new THREE.SphereGeometry(1,10,8),dark,0,-.2,-1,.75,.47,1.2);
  const head=new THREE.Group();head.position.set(0,.38,-2);root.add(head);
  add(head,new THREE.SphereGeometry(1,10,8),main,0,.32,-.6,.72,.64,1.05);
  add(head,new THREE.ConeGeometry(.49,1.1,6),main,0,.02,-1.43,.85,1,.9).rotation.x=-Math.PI/2;
  for(const side of [-1,1]){
    add(head,new THREE.SphereGeometry(.17,8,6),eye,side*.58,.55,-.85);
    const horn=add(head,new THREE.ConeGeometry(.16,.91,5),dark,side*.53,.95,-.3);horn.rotation.z=-side*.4;
    add(root,new THREE.SphereGeometry(1,9,7),main,side*.85,-.61,1.1,.43,.65,.65);
  }
  const wings=[];
  for(const side of [-1,1]){
    const wing=new THREE.Group();wing.position.set(side*.95,.52,.05);root.add(wing);
    const elbow=new THREE.Group();elbow.position.set(side*2.45,.12,-.4);wing.add(elbow);
    const wingShape=(points,parent)=>{
      const vertices=new Float32Array(points.flatMap(p=>[side*p[0],p[1],p[2]]));
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.setIndex([0,1,2,0,2,3,0,3,4]);geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,wingSkin);mesh.castShadow=true;parent.add(mesh);
    };
    wingShape([[0,0,0],[1.1,.05,-.5],[2.55,0,-.68],[1.85,-.14,1.45],[.6,-.18,1.08]],wing);
    wingShape([[0,0,0],[2.7,.2,-1.75],[3,.06,0],[2.2,-.18,1.7],[.8,-.13,1.2]],elbow);
    const beam=add(wing,new THREE.CylinderGeometry(.11,.19,2.6,5),main,side*1.18,.12,-.22);
    beam.rotation.z=side*Math.PI/2;
    wings.push({wing,elbow,side});
  }
  const tail=[];let tailParent=root;
  for(let i=0;i<4;i++){
    const joint=new THREE.Group();joint.position.set(0,i===0?-.15:0,i===0?1.7:.78);tailParent.add(joint);
    add(joint,new THREE.SphereGeometry(1,7,6),i===3?dark:main,0,0,.34,.45-i*.085,.32-i*.045,.7);
    tail.push(joint);tailParent=joint;
  }
  const tip=add(tailParent,new THREE.ConeGeometry(.45,1.25,3),wingSkin,0,0,.92);tip.rotation.x=Math.PI/2;
  for(let i=0;i<4;i++) add(root,new THREE.ConeGeometry(.22,.74,4),dark,0,.77,-.5+i*.65);
  return {root,head,wings,tail};
}
export const ENEMY_SPAWNS=[
  {x:-67,y:39,z:-177,color:0x774e6d,accent:0xb35c8e},
  {x:200,y:46,z:24,color:0x703b37,accent:0xce7d58},
  {x:-153,y:43,z:130,color:0x504f77,accent:0x8886cd}
].map((enemy,i)=>{
  const island=['Ilha das Cascatas','Ilha do Farol','Ilha da Névoa'][i];
  const [x,y,z]=stretchPointOnIsland([enemy.x,enemy.y,enemy.z],island);
  return {...enemy,x,y,z};
});
export class EnemyDragon {
  constructor(scene,world,data,index){
    this.world=world;this.index=index;
    this.anchor=new THREE.Vector3(data.x,data.y,data.z);
    this.group=new THREE.Group();this.model=enemyModel(data.color,data.accent);this.group.add(this.model.root);
    this.proxy=buildDragonProxy(data.color,data.accent,{enemy:true});this.proxy.visible=false;this.group.add(this.proxy);
    this.scratchDestination=new THREE.Vector3();this.scratchDirection=new THREE.Vector3();
    this.scratchMuzzle=new THREE.Vector3();this.scratchPredicted=new THREE.Vector3();
    this.group.position.copy(this.anchor);this.group.visible=false;scene.add(this.group);
    this.yaw=index*2.0;this.group.rotation.y=this.yaw;
    this.speed=16;this.health=3;this.maxHealth=3;this.alive=true;this.active=false;
    this.state='patrol';this.phase=index*2.3;this.fireCooldown=2+index*.55;
    this.hurtPulse=0;this.evadeTime=0;this.tactic='patrol';this.decisionTimer=0;this.visualClock=0;this.visualLevel='full';this.simulationCarry=0;
  }
  setActive(value){this.active=value;this.group.visible=value&&this.alive&&this.visualLevel!=='hidden';}
  setDetail(observer,tier,camera,forward){
    this.visualLevel=actorVisualLevel(observer,this.group.position,camera,forward,tier,'enemy');
    const visibility=dragonMeshVisibility(this.visualLevel);
    this.model.root.visible=visibility.high;
    this.proxy.visible=visibility.low;
    this.group.visible=this.active&&this.alive&&this.visualLevel!=='hidden';
  }
  takeHit(amount=1){
    if(!this.active||!this.alive)return false;
    this.health=Math.max(0,this.health-Math.max(0,amount));this.hurtPulse=.28;this.evadeTime=.9;
    if(this.health<=0){this.alive=false;this.group.visible=false;return true;}
    return false;
  }
  get position(){return this.group.position;}
  update(dt,time,player,onShot){
    if(!this.active||!this.alive)return;
    this.fireCooldown-=dt;this.hurtPulse=Math.max(0,this.hurtPulse-dt);
    this.evadeTime=Math.max(0,this.evadeTime-dt);
    const origin=this.group.position,p=player.group.position;
    const distance=origin.distanceTo(p);
    this.state=player.riding&&distance<153?'chase':'patrol';
    const plan=enemyCombatPlan({distance:this.state==='chase'?distance:Infinity,health:this.health,evadeTime:this.evadeTime,index:this.index,time});
    this.tactic=plan.mode;
    const destination=this.scratchDestination;
    if(this.state==='chase'){
      const direction=this.scratchDirection.subVectors(p,origin).normalize();
      destination.copy(p).addScaledVector(direction,-plan.retreat);
      destination.x-=direction.z*plan.flank;destination.z+=direction.x*plan.flank;
      destination.y=p.y+Math.sin(time*1.1+this.phase)*6+(this.index-1)*4;
    } else {
      const a=time*.23+this.phase;
      destination.set(this.anchor.x+Math.cos(a)*40,this.anchor.y+Math.sin(a*1.6)*9,this.anchor.z+Math.sin(a)*40);
    }
    const intendedYaw=pursuitYaw(origin,destination);
    this.yaw=limitedTurn(this.yaw,intendedYaw,dt*(this.state==='chase'?1.2:.76));
    this.group.rotation.y=this.yaw;
    const desiredSpeed=this.state==='chase'?plan.speed:16;
    this.speed=approach(this.speed,desiredSpeed,dt*9);
    origin.x=clamp(origin.x-Math.sin(this.yaw)*this.speed*dt,-610,610);
    origin.z=clamp(origin.z-Math.cos(this.yaw)*this.speed*dt,-610,610);
    const floor=this.world.heightAt(origin.x,origin.z)+15;
    origin.y=THREE.MathUtils.damp(origin.y,Math.max(floor,clamp(destination.y,22,88)),1.25,dt);
    // AI, cooldowns, movement and fire remain active at full frequency.
    // Only transforms of the decorative rig are rate-limited at a distance.
    this.visualClock+=dt;
    if(shouldAnimateActor(this.visualLevel,this.visualClock)){
    this.visualClock=0;
    const {root,wings,head,tail}=this.model;
    root.rotation.z=THREE.MathUtils.damp(root.rotation.z,-shortestAngle(intendedYaw-this.yaw)*.20,2.8,dt);
    root.rotation.x=Math.sin(time*2+this.phase)*.04;
    root.position.y=Math.sin(time*5+this.phase)*.15;
    root.scale.setScalar(1+this.hurtPulse*.23);
    wings.forEach(({wing,elbow,side})=>{
      wing.rotation.z=side*(.15+Math.sin(time*7.1+this.phase)*.38);
      elbow.rotation.z=side*(-.12+Math.sin(time*7.1+this.phase-.7)*.18);
    });
    tail.forEach((joint,i)=>joint.rotation.y=Math.sin(time*3-this.phase-i*.6)*(.11+i*.025));
    head.rotation.x=Math.sin(time*3.5+this.phase)*.06;
    }
    if(this.state==='chase'&&distance<105&&distance>14&&this.fireCooldown<=0){
      const aimed=pursuitYaw(origin,p);
      if(Math.abs(shortestAngle(aimed-this.yaw))<.30){
        this.fireCooldown=2.7+this.index*.38;
        const muzzle=this.scratchMuzzle.copy(origin);muzzle.x-=Math.sin(this.yaw)*4.6;muzzle.y+=1.1;muzzle.z-=Math.cos(this.yaw)*4.6;
        const lead=Math.min(.45,distance/70);
        const predicted=this.scratchPredicted.copy(p).addScaledVector(player.forward(),player.speed*lead);
        predicted.y+=.4;
        onShot(muzzle,predicted.sub(muzzle).normalize(),this);
      }
    }
  }
}
export class EnemySquad {
  constructor(scene,world){
    this.enemies=ENEMY_SPAWNS.map((data,i)=>new EnemyDragon(scene,world,data,i));
    this.active=false;
  }
  setActive(value){this.active=value;this.enemies.forEach(e=>e.setActive(value));}
  get alive(){return this.enemies.filter(e=>e.alive);}
  nearest(position){
    let best=null,dist=Infinity;
    for(const e of this.alive){const d=e.position.distanceToSquared(position);if(d<dist){dist=d;best=e;}}
    return best;
  }
  setDetail(observer,tier,camera,forward){
    this.detailTier=tier;
    for(const enemy of this.enemies)enemy.setDetail(observer,tier,camera,forward);
  }
  update(dt,time,dragon,onShot){
    if(!this.active)return;
    const tier=this.detailTier??'balanced';
    for(const enemy of this.enemies){
      if(!enemy.alive)continue;
      const distance=enemy.position.distanceTo(dragon.group.position);
      const step=enemySimulationStep(distance,enemy.simulationCarry,dt,tier);
      enemy.simulationCarry=step.carry;
      if(step.run)enemy.update(step.dt,time,dragon,onShot);
    }
  }
}
