import * as THREE from 'three';
import {EnemyDragon} from '../entities/EnemyDragon.js';
import {segmentSphereHit} from './combatMath.js';
import {FRONTIER_ZONES,markerId,normalizeFrontier,frontierVisible,frontierClaimable} from './FrontierRules.js';

/** Two optional airborne treasure runs and a pair of region sentinels.
 * Never touches the existing mission/enemy squad, so old saves remain valid.
 * Marker geometry is shared. One instanced core + one instanced ring per
 * region: four decorative draw calls total even on the highest preset.
 * Enemy rigs load lazily on approaching a region, never on initial boot.
 */
export class FrontierActivities {
  constructor(scene,world,saved=null){
    this.scene=scene;this.world=world;
    this.found=new Set();this.defeated=new Set();this.rewarded=new Set();
    this.guardians=new Map();
    this.markers=new Map();

    const geometry=new THREE.OctahedronGeometry(2.25,0);
    const ringGeometry=new THREE.TorusGeometry(4.5,.19,7,24);
    this.sharedGeometry=[geometry,ringGeometry];
    this.rig=new THREE.Object3D();
    for(const zone of FRONTIER_ZONES){
      const cores=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:zone.color}),3);
      const rings=new THREE.InstancedMesh(ringGeometry,new THREE.MeshBasicMaterial({
        color:zone.accent,side:THREE.DoubleSide}),3);
      cores.frustumCulled=true;rings.frustumCulled=true;
      cores.castShadow=false;rings.castShadow=false;
      cores.visible=false;rings.visible=false;
      const points=zone.markers.map(([x,z],i)=>({
        id:markerId(zone,i),x,z,y:this.world.heightAt(x,z)+(zone.id==='ash'?17:14)
      }));
      this.markers.set(zone.id,{zone,cores,rings,points,visible:false});
      this.scene.add(cores);this.scene.add(rings);
    }
    this.restore(saved);
  }
  restore(saved){
    const normalized=normalizeFrontier(saved);
    this.found=new Set(normalized.found);
    this.defeated=new Set(normalized.defeated);
    this.rewarded=new Set(normalized.rewarded);
    for(const record of this.markers.values())this.refreshMatrices(record);
  }
  snapshot(){
    return normalizeFrontier({found:[...this.found],defeated:[...this.defeated],rewarded:[...this.rewarded]});
  }
  refreshMatrices(record){
    const {zone,cores,rings,points}=record;
    for(let i=0;i<points.length;i++){
      const p=points[i],done=this.found.has(p.id);
      this.rig.position.set(p.x,p.y,p.z);
      this.rig.rotation.set(0,i*.45,0);
      this.rig.scale.setScalar(done?.00001:1);
      this.rig.updateMatrix();cores.setMatrixAt(i,this.rig.matrix);
      this.rig.rotation.x=Math.PI/2;
      this.rig.scale.setScalar(done?.00001:1);
      this.rig.updateMatrix();rings.setMatrixAt(i,this.rig.matrix);
    }
    cores.instanceMatrix.needsUpdate=true;rings.instanceMatrix.needsUpdate=true;
    cores.computeBoundingSphere();rings.computeBoundingSphere();
  }
  /** Only two high-detail enemy models exist in memory at most; constructing
   * one happens when the player first enters its island's 170m radius. */
  ensureGuardian(zone){
    if(this.defeated.has(zone.id))return null;
    if(this.guardians.has(zone.id))return this.guardians.get(zone.id);
    const x=zone.x+4,z=zone.z-7,y=this.world.heightAt(x,z)+28;
    const dragon=new EnemyDragon(this.scene,this.world,{x,y,z,
      color:zone.id==='crystal'?0x2d788e:0x754844,accent:zone.color},
      zone.id==='crystal'?0:1);
    dragon.maxHealth=4;dragon.health=4;
    this.guardians.set(zone.id,dragon);
    return dragon;
  }
  get activeGuardians(){
    return [...this.guardians.values()].filter(g=>g.active&&g.alive);
  }
  update(dt,time,dragon,onShot=()=>{},dangerEnabled=true){
    const events=[],position=dragon?.group?.position;
    if(!position)return events;

    for(const zone of FRONTIER_ZONES){
      const record=this.markers.get(zone.id);
      const nearby=frontierVisible(position,zone,record.visible);
      if(nearby!==record.visible){
        record.visible=nearby;
        record.cores.visible=nearby;record.rings.visible=nearby;
      }
      if(nearby&&dragon.riding&&dragon.airborne){
        for(const p of record.points){
          if(this.found.has(p.id)||!frontierClaimable(dragon,p))continue;
          this.found.add(p.id);
          this.refreshMatrices(record);
          const count=record.points.filter(point=>this.found.has(point.id)).length;
          events.push({type:'relic',zone:zone.id,name:zone.name,count,total:3,position:p,
            label:zone.id==='crystal'?'Fragmento de Quartzo':'Brasa Antiga'});
          if(count===3&&!this.rewarded.has(zone.id)){
            this.rewarded.add(zone.id);
            events.push({type:'relic-complete',zone:zone.id,name:zone.name,
              points:zone.reward});
          }
          break; // One flying collection per frame.
        }
      }
      const dx=position.x-zone.x,dz=position.z-zone.z;
      const close=dx*dx+dz*dz<170*170;
      const guardian=(close&&dangerEnabled&&!this.defeated.has(zone.id))
        ?this.ensureGuardian(zone):this.guardians.get(zone.id);
      if(guardian){
        const active=close&&dangerEnabled&&dragon.riding&&!this.defeated.has(zone.id);
        guardian.setActive(active);
        if(active)guardian.update(Math.min(Math.max(dt,0),.06),time,dragon,onShot);
      }
    }
    return events;
  }
  setDetail(observer,tier,camera,forward){
    for(const guardian of this.guardians.values())
      if(guardian.active)guardian.setDetail(observer,tier,camera,forward);
  }
  hitGuardian(from,to,damage=1){
    for(const [id,guardian] of this.guardians){
      if(!guardian.active||!guardian.alive)continue;
      if(!segmentSphereHit(from,to,guardian.position,5.6))continue;
      const dead=guardian.takeHit(damage);
      if(dead)this.defeated.add(id);
      const zone=FRONTIER_ZONES.find(z=>z.id===id);
      return {type:dead?'guardian-defeated':'guardian-hit',zone:id,
        name:zone.guardian,position:guardian.position.clone(),health:guardian.health,
        reward:dead?zone.guardianReward:0};
    }
    return null;
  }
  summary(){
    return FRONTIER_ZONES.map(z=>{
      const count=z.markers.filter((_,i)=>this.found.has(markerId(z,i))).length;
      return `${z.name}: ${count}/3 fragmentos · guardião ${this.defeated.has(z.id)?'vencido':'ativo'}`;
    }).join(' | ');
  }
  dispose(){
    for(const m of this.markers.values()){
      this.scene.remove(m.cores,m.rings);
      m.cores.material.dispose();m.rings.material.dispose();
    }
    for(const g of this.sharedGeometry)g.dispose();
    // Guardians belong to the level and are only disposed on full reset.
    for(const guardian of this.guardians.values()){
      guardian.group.traverse(obj=>{
        if(obj.geometry?.dispose)obj.geometry.dispose();
        const materials=Array.isArray(obj.material)?obj.material:[obj.material];
        materials.forEach(m=>m?.dispose?.());
      });
      this.scene.remove(guardian.group);
    }
    this.guardians.clear();
  }
}
