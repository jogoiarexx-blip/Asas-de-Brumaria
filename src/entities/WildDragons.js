import * as THREE from 'three';
import {WILD_DRAGON_DEFS,petRepeatAllowed} from '../systems/WildBonds.js';
import {WildApproach} from '../systems/WildApproach.js';
import {SPECIES} from '../systems/Progression.js';
import {actorVisualLevel,shouldAnimateActor} from '../systems/ActorLOD.js';
import {dragonMeshVisibility} from '../systems/DragonMeshLOD.js';
import {buildDragonProxy} from './DragonProxy.js';
import {wildDragonPose} from './CreatureMotion.js';
import {batchRigidMeshes} from '../utils/rigBatch.js';
import {wingMembraneGeometry,wingBones} from './WingGeometry.js';
const shape=(geometry,material,x,y,z,sx=1,sy=1,sz=1)=>{
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;return m;
};
function buildCreature(spec){
  const bodyColor=SPECIES[spec.species].colors;
  const skin=new THREE.MeshStandardMaterial({color:bodyColor[1],roughness:.76,flatShading:true});
  const face=new THREE.MeshStandardMaterial({color:bodyColor[0],roughness:.67,flatShading:true});
  const wingMat=new THREE.MeshStandardMaterial({color:bodyColor[4],side:THREE.DoubleSide,flatShading:true,roughness:.73});
  const spikeMat=new THREE.MeshStandardMaterial({color:bodyColor[5],roughness:.54,metalness:.08});
  const iris=new THREE.MeshBasicMaterial({color:0xffeac5});
  const pupil=new THREE.MeshBasicMaterial({color:0x102332});
  const group=new THREE.Group();
  const torso=shape(new THREE.SphereGeometry(1,16,12),skin,0,1.9,.35,1,.69,1.55);group.add(torso);
  // Placas vertebrais, pequenas barbatanas e escamas: preserva a silhueta leve.
  for(let i=0;i<8;i++){
    const ridge=shape(new THREE.ConeGeometry(.13+(i%3)*.03,.44,5),spikeMat,0,2.53,-.65+i*.31);
    ridge.rotation.x=-.18;group.add(ridge);
  }
  group.add(shape(new THREE.SphereGeometry(1,12,9),skin,0,2.12,-.95,.48,.61,.92));
  const head=new THREE.Group();head.position.set(0,2.53,-1.45);group.add(head);
  const eyes=[],ears=[];
  const lowerJaw=shape(new THREE.SphereGeometry(.65,12,9),skin,0,-.28,-.52,.88,.21,.87);head.add(lowerJaw);
  head.add(shape(new THREE.SphereGeometry(1,16,12),face,0,0,0,.85,.68,.84));
  head.add(shape(new THREE.SphereGeometry(1,12,10),skin,0,-.23,-.61,.65,.29,.62));
  // Cheeks and nostrils add expression without any per-frame geometry changes.
  for(const side of [-1,1]){
    head.add(shape(new THREE.SphereGeometry(1,9,7),skin,side*.57,-.26,-.38,.26,.21,.32));
    head.add(shape(new THREE.SphereGeometry(1,6,5),face,side*.25,-.22,-1.17,.075,.048,.065));
  }
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.62,.15,-.52);head.add(eye);
    eye.add(shape(new THREE.SphereGeometry(1,12,10),face,0,0,.024,.242,.258,.125));
    eye.add(shape(new THREE.SphereGeometry(1,12,10),iris,0,0,-.018,.217,.227,.135));
    const irisColor=new THREE.MeshBasicMaterial({color:spec.species==='brasa'?0xe6ae5c:spec.species==='raio'?0x83baf7:0x74cbbb});
    eye.add(shape(new THREE.SphereGeometry(1,10,9),irisColor,0,-.009,-.136,.15,.178,.073));
    eye.add(shape(new THREE.SphereGeometry(1,9,7),pupil,0,-.015,-.196,.088,.124,.052));
    eye.add(shape(new THREE.SphereGeometry(1,6,6),new THREE.MeshBasicMaterial({color:0xffffff}),-side*.049,.07,-.23,.043,.044,.022));
    eyes.push(eye);
    const ear=new THREE.Group();ear.position.set(side*.58,.48,.08);head.add(ear);
    const earFin=shape(new THREE.ConeGeometry(.235,.87,5),wingMat,side*.18,.29,.08);
    earFin.rotation.z=-side*.64;earFin.rotation.x=-.31;ear.add(earFin);ears.push({ear,side});
    const horn=shape(new THREE.ConeGeometry(.20,.72,6),spikeMat,side*.51,.70,.12);
    horn.rotation.z=-side*.35;head.add(horn);
    const leg=shape(new THREE.CylinderGeometry(.22,.27,1.0,7),skin,side*.7,.78,.94);
    leg.rotation.x=.15;group.add(leg);
    group.add(shape(new THREE.SphereGeometry(.26,8,6),face,side*.72,.27,.73,1.5,.55,1.7));
  }
  const wings=[];
  for(const side of [-1,1]){
    const joint=new THREE.Group();joint.position.set(side*.69,2.48,-.1);group.add(joint);
    // v1.7.2: membrana em leque com borda recortada e ossos dos dedos
    // (antes: um cone triangular chapado).
    const membrane=shape(wingMembraneGeometry(side,3.5,2.35),wingMat,0,0,.1);
    joint.add(membrane);
    for(const bone of wingBones(side,spikeMat,3.5,2.35)){bone.position.z+=.1;joint.add(bone);}
    wings.push({joint,side});
  }
  // v1.7.2: pescoço, ventre claro, coxas e garras dão volume ao corpo.
  const bellyMat=new THREE.MeshStandardMaterial({color:bodyColor[5],roughness:.8,flatShading:true});
  group.add(shape(new THREE.SphereGeometry(1,12,9),bellyMat,0,1.62,.3,.74,.42,1.32));
  const neck=shape(new THREE.CylinderGeometry(.42,.6,1.15,8),skin,0,2.3,-1.02);neck.rotation.x=-1.05;group.add(neck);
  for(const side of [-1,1]){
    group.add(shape(new THREE.SphereGeometry(1,9,7),skin,side*.66,1.55,.95,.42,.62,.62));
    const fore=shape(new THREE.CylinderGeometry(.17,.21,.95,6),skin,side*.6,.75,-.62);fore.rotation.x=-.12;group.add(fore);
    group.add(shape(new THREE.SphereGeometry(.22,8,6),face,side*.61,.26,-.76,1.4,.55,1.6));
    for(let claw=0;claw<3;claw++){
      const nail=shape(new THREE.ConeGeometry(.055,.24,4),spikeMat,side*(.56+claw*.11),.16,.4+0);nail.rotation.x=-Math.PI/2;group.add(nail);
      const front=shape(new THREE.ConeGeometry(.05,.22,4),spikeMat,side*(.51+claw*.1),.15,-1.08);front.rotation.x=-Math.PI/2;group.add(front);
    }
  }
  const tail=new THREE.Group();tail.position.set(0,1.95,1.5);group.add(tail);
  const tailBody=shape(new THREE.ConeGeometry(.36,3.0,7),skin,0,-.22,1.2);
  tailBody.rotation.x=Math.PI/2;tail.add(tailBody);
  tail.add(shape(new THREE.OctahedronGeometry(.48),spikeMat,0,-.15,2.75,1,.5,1.35));
  for(const side of [-1,1]){
    const fin=shape(new THREE.ConeGeometry(.42,1.05,3),wingMat,side*.42,-.16,2.5,1,1,.22);
    fin.rotation.set(Math.PI/2,0,-side*1.05);tail.add(fin);
  }
  for(let i=0;i<4;i++){const spine=shape(new THREE.ConeGeometry(.1,.3,4),spikeMat,0,.12-i*.05,.25+i*.55);spine.rotation.x=-.2;tail.add(spine);}
  for(let i=0;i<4;i++)group.add(shape(new THREE.ConeGeometry(.17,.45,5),spikeMat,0,2.62,-.62+i*.61));
  if(spec.species==='brasa'){
    for(const side of [-1,1]){
      const crest=shape(new THREE.ConeGeometry(.26,.85,5),spikeMat,side*.4,.45,.32);
      crest.rotation.z=-side*.5;head.add(crest);
    }
  }else if(spec.species==='raio'){
    for(const side of [-1,1]){
      const fin=shape(new THREE.ConeGeometry(.28,.9,3),wingMat,side*.62,2.53,.8);
      fin.rotation.z=side*1.0;group.add(fin);
    }
  }else{
    for(const side of [-1,1]){
      const whisker=shape(new THREE.CylinderGeometry(.04,.07,.95,5),spikeMat,side*.62,-.25,-.45);
      whisker.rotation.z=side*.9;head.add(whisker);
    }
  }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.25,.13,6,36),new THREE.MeshBasicMaterial({color:spec.color,transparent:true,opacity:.65}));
  ring.rotation.x=Math.PI/2;ring.position.y=.25;group.add(ring);
  // Preserve torso breathing, jaw movement and pupil blinking. Fuse only
  // the immobile scales, head decorations and pieces within each wing pivot.
  let batched=0;
  batched+=batchRigidMeshes(group,{preserve:[torso]}).removed;
  batched+=batchRigidMeshes(head,{preserve:[lowerJaw]}).removed;
  for(const {joint} of wings)batched+=batchRigidMeshes(joint).removed;
  batched+=batchRigidMeshes(tail).removed;
  const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.45),new THREE.MeshBasicMaterial({color:spec.color,transparent:true,opacity:.76}));
  beacon.position.set(0,5.2,0);group.add(beacon);
  return {group,wings,tail,head,ring,beacon,torso,lowerJaw,eyes,ears,rigidBatchedParts:batched};
}
export class WildDragons {
  constructor(scene,world,bonds){
    this.world=world;this.bonds=bonds;this.approach=new WildApproach();
    this.creatures=WILD_DRAGON_DEFS.map((spec,i)=>{
      // Escolhe deterministamente uma área aberta para evitar nascer dentro de árvores.
      let x=spec.x,z=spec.z;
      for(let attempt=0;attempt<28;attempt++){
        const radius=attempt===0?0:2+(attempt%7)*2;
        const angle=attempt*2.39996;
        const px=spec.x+Math.cos(angle)*radius,pz=spec.z+Math.sin(angle)*radius;
        if(world.walkable(px,pz)&&world.clearanceAt(px,pz,2.4)<world.heightAt(px,pz)+.5){x=px;z=pz;break;}
      }
      const model=buildCreature(spec);
      const highDetail=new THREE.Group();highDetail.name='DetailedDragon';
      while(model.group.children.length)highDetail.add(model.group.children[0]);
      const palette=SPECIES[spec.species].colors;
      const lowDetail=buildDragonProxy(palette[1],palette[4]);lowDetail.visible=false;
      model.group.add(highDetail,lowDetail);
      model.group.position.set(x,world.heightAt(x,z),z);scene.add(model.group);
      return {spec,...model,highDetail,lowDetail,anchor:new THREE.Vector2(x,z),phase:i*2.1,visualLevel:'full',visualClock:0,petTime:0,lastPetAt:-Infinity};
    });
  }
  /** Visual-only LOD. Wild bonds and gameplay positions remain independent. */
  setDetail(observer,tier,camera,forward){
    for(const creature of this.creatures){
      const level=actorVisualLevel(observer,creature.group.position,camera,forward,tier,'wild');
      creature.visualLevel=level;
      const visibility=dragonMeshVisibility(level);
      creature.highDetail.visible=visibility.high;
      creature.lowDetail.visible=visibility.low;
      creature.group.visible=level!=='hidden';
    }
  }
  get remaining(){return this.creatures.filter(c=>this.bonds.progress(c.spec.id)<3);}
  /** Visual reaction; tamed repeat petting uses a separate cooldown and never grants rewards. */
  onPetted(id,time=Infinity){
    const creature=this.creatures.find(c=>c.spec.id===id);
    if(!creature)return false;
    if(Number.isFinite(time)){
      if(!petRepeatAllowed(time,creature.lastPetAt))return false;
      creature.lastPetAt=time;
    }
    creature.petTime=1.25;
    return true;
  }
  nearby(position,limit=8,includeTamed=false){
    let nearest=null,smallest=limit*limit;
    for(const creature of includeTamed?this.creatures:this.remaining){
      const dx=creature.group.position.x-position.x,dz=creature.group.position.z-position.z;
      const dist=dx*dx+dz*dz;if(dist<smallest){nearest=creature;smallest=dist;}
    }
    return nearest;
  }
  update(dt,time,position,riding,heroSpeed=0){
    for(const creature of this.creatures){
      const {group,anchor,phase,spec}=creature;
      const distance=position.distanceTo(group.position);
      // Domestication always advances, even when the meshes are not drawn.
      const mood=this.approach.update(spec.id,dt,time,{distance,speed:heroSpeed,riding});
      creature.visualClock+=dt;
      creature.petTime=Math.max(0,creature.petTime-dt);
      const level=creature.visualLevel;
      if(!shouldAnimateActor(level,creature.visualClock))continue;
      creature.visualClock=0;
      const near=!riding&&distance<22;
      const tamed=this.bonds.progress(spec.id)>=3;
      const temperament=spec.temperament;
      const orbit=tamed?.3:mood.mood==='assustado'?2.4:near?.27:temperament==='tímido'?1.9:1.15;
      const x=anchor.x+Math.sin(time*.48+phase)*orbit;
      const z=anchor.y+Math.cos(time*.36+phase)*orbit;
      const safe=this.world.walkable(x,z)&&this.world.clearanceAt(x,z,1.3)<this.world.heightAt(x,z)+.5;
      const gx=safe?x:anchor.x, gz=safe?z:anchor.y;
      group.position.set(gx,this.world.heightAt(gx,gz)+Math.sin(time*1.6+phase)*.045,gz);
      const pose=wildDragonPose({time,phase,mood:mood.mood,near,petTime:creature.petTime});
      creature.torso.scale.y=.69*pose.breath;
      const lookAngle=near?Math.atan2(-(position.x-gx),-(position.z-gz)):.7+Math.sin(time*.3+phase)*.45;
      group.rotation.y=THREE.MathUtils.damp(group.rotation.y,lookAngle,1.55,dt);
      for(const {joint,side} of creature.wings){
        const flap=Math.sin(time*(mood.mood==='assustado'?7:near?4.6:2.4)+phase)*(mood.mood==='assustado'?.38:.22);
        joint.rotation.z=side*(.15+flap+(tamed?.14:0)+pose.wingsRelax);
        joint.rotation.x=side*Math.sin(time*.95+phase)*.08;
      }
      creature.head.rotation.x=THREE.MathUtils.damp(creature.head.rotation.x,pose.headPitch,7,dt);
      creature.head.rotation.z=THREE.MathUtils.damp(creature.head.rotation.z,pose.headRoll,6,dt);
      creature.lowerJaw.rotation.x=THREE.MathUtils.damp(creature.lowerJaw.rotation.x,pose.jawOpen,5,dt);
      creature.tail.rotation.y=THREE.MathUtils.damp(creature.tail.rotation.y,pose.tailYaw,6,dt);
      creature.tail.rotation.x=THREE.MathUtils.damp(creature.tail.rotation.x,pose.tailPitch,5,dt);
      for(const eye of creature.eyes)eye.scale.y=THREE.MathUtils.damp(eye.scale.y,pose.eyeOpen,12,dt);
      for(const {ear,side} of creature.ears)ear.rotation.z=THREE.MathUtils.damp(ear.rotation.z,side*pose.ears,6,dt);
      creature.ring.material.opacity=tamed?.19:mood.mood==='tranquilo'?.95:mood.mood==='assustado'?.18:near?.7:.48;
      creature.ring.rotation.z+=dt*.42;
      creature.beacon.position.y=5.2+Math.sin(time*2.4+phase)*.35;
      creature.beacon.visible=!tamed;
    }
  }
}
