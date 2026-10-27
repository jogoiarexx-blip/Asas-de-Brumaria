import * as THREE from 'three';
import {effectLimit} from './PerformanceBudget.js';
import {ReusableSlots} from './ReusableSlots.js';
/** One instanced draw call per effect type, no temporary meshes or point lights. */
export class Effects {
  constructor(scene){
    this.scene=scene;this.limit=effectLimit('balanced');
    this.geometry=new THREE.TetrahedronGeometry(.75,0);
    this.materials={
      fire:new THREE.MeshBasicMaterial({color:0xffa15e}),
      enemy:new THREE.MeshBasicMaterial({color:0xf06aab}),
      rescue:new THREE.MeshBasicMaterial({color:0x9dffde}),
      impact:new THREE.MeshBasicMaterial({color:0xffe4ae}),
      pulse:new THREE.MeshBasicMaterial({color:0x73dbef,transparent:true,opacity:.9,depthWrite:false})
    };
    this.buckets={};this.dummy=new THREE.Object3D();
    this.pulseMaterial=new THREE.MeshBasicMaterial({color:0x80dbfc,transparent:true,opacity:0,
      depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    this.pulseRing=new THREE.Mesh(new THREE.RingGeometry(.84,1,56),this.pulseMaterial);
    this.pulseRing.rotation.x=-Math.PI/2;
    this.pulseRing.visible=false;this.pulseRing.frustumCulled=false;this.pulseRing.castShadow=false;
    scene.add(this.pulseRing);this.pulseTime=0;this.pulseRadius=32;
    const capacity=effectLimit('quality');
    for(const [type,material] of Object.entries(this.materials)){
      const mesh=new THREE.InstancedMesh(this.geometry,material,capacity);
      mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=false;
      const pool=new ReusableSlots(capacity,()=>({
        position:new THREE.Vector3(),velocity:new THREE.Vector3(),
        life:0,maxLife:0,scale:1,rotation:0
      }));
      scene.add(mesh);this.buckets[type]={mesh,pool,particles:pool.active};
    }
  }
  setQuality(tier){
    this.limit=effectLimit(tier);
    for(const bucket of Object.values(this.buckets)){
      bucket.pool.trim(this.limit);
      bucket.mesh.count=bucket.particles.length;
    }
  }
  burst(position,type='impact',count=12){
    const bucket=this.buckets[type]??this.buckets.impact;
    const remaining=Math.max(0,this.limit-bucket.particles.length);
    const size=Math.min(remaining,Math.max(0,Math.floor(count)));
    for(let i=0;i<size;i++){
      const particle=bucket.pool.take();
      if(!particle)break;
      const theta=Math.random()*Math.PI*2,vertical=(Math.random()-.38)*2;
      const speed=7+Math.random()*13;
      particle.position.copy(position);
      particle.velocity.set(Math.cos(theta),vertical,Math.sin(theta)).normalize().multiplyScalar(speed);
      particle.life=particle.maxLife=.45+Math.random()*.55;
      particle.scale=.5+Math.random()*.8;
      particle.rotation=Math.random()*6;
    }
  }
  pulse(position,{radius=34,color=0x80dbfc}={}){
    this.pulseTime=.62;this.pulseRadius=radius;
    this.pulseRing.position.copy(position);this.pulseRing.position.y-=.45;
    this.pulseRing.visible=true;this.pulseMaterial.color.setHex(color);
    this.materials.pulse.color.setHex(color);
    this.burst(position,'pulse',26);
  }
  update(dt){
    if(this.pulseTime>0){
      this.pulseTime=Math.max(0,this.pulseTime-dt);
      const progress=1-this.pulseTime/.62;
      this.pulseRing.scale.setScalar(this.pulseRadius*(.10+.9*progress));
      this.pulseMaterial.opacity=.78*Math.pow(Math.max(0,1-progress),1.25);
      this.pulseRing.visible=this.pulseTime>0;
    }
    const d=this.dummy;
    for(const bucket of Object.values(this.buckets)){
      const particles=bucket.particles;
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];p.life-=dt;
        if(p.life<=0){bucket.pool.releaseAt(i);continue;}
        p.position.addScaledVector(p.velocity,dt);p.velocity.y-=8*dt;p.rotation+=dt*6;
        p.scale*=Math.max(.001,1-dt*2.1);
      }
      bucket.mesh.count=particles.length;
      for(let i=0;i<particles.length;i++){
        const p=particles[i];d.position.copy(p.position);d.scale.setScalar(Math.max(.005,p.scale));
        d.rotation.set(p.rotation*.85,p.rotation,0);d.updateMatrix();bucket.mesh.setMatrixAt(i,d.matrix);
      }
      if(particles.length)bucket.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  dispose(){
    for(const bucket of Object.values(this.buckets))this.scene.remove(bucket.mesh);
    this.scene.remove(this.pulseRing);this.pulseRing.geometry.dispose();this.pulseMaterial.dispose();
    this.geometry.dispose();Object.values(this.materials).forEach(m=>m.dispose());
  }
}
