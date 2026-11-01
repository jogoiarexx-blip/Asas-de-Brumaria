import * as THREE from 'three';
import {LANDMARKS} from '../systems/Discovery.js';
import {landmarkCollisionVolumes} from '../utils/collision.js';
/** Marcos exploráveis com desenho procedural e halo: a conquista é feita em Discovery. */
export class Landmarks {
  constructor(scene,world){
    this.scene=scene;
    this.objects=LANDMARKS.map((def,index)=>{
      const g=new THREE.Group();g.position.set(def.x,world.heightAt(def.x,def.z),def.z);
      const stone=new THREE.MeshStandardMaterial({color:0x50696d,roughness:.83,flatShading:true});
      const rune=new THREE.MeshStandardMaterial({color:index%2?0xe5cf82:0x86eff3,emissive:index%2?0x8b6435:0x2c9ca9,emissiveIntensity:1.8,metalness:.15});
      const base=new THREE.Mesh(new THREE.CylinderGeometry(3.4,4.3,1.5,7),stone);base.position.y=.75;base.receiveShadow=true;g.add(base);
      const pillar=new THREE.Mesh(new THREE.CylinderGeometry(1.2,2.1,8.3,5),stone);pillar.position.y=5.4;pillar.castShadow=true;g.add(pillar);
      for(let j=0;j<3;j++){
        const line=new THREE.Mesh(new THREE.TorusGeometry(.8,.1,5,6),rune);
        line.rotation.x=Math.PI/2;line.position.y=4+j*1.35;g.add(line);
      }
      const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(1.65),rune);crystal.position.y=10.65;g.add(crystal);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(4.2,.12,6,36),new THREE.MeshBasicMaterial({color:0xe3d8a3,transparent:true,opacity:.45}));
      ring.rotation.x=Math.PI/2;ring.position.y=1.8;g.add(ring);
      // Match the visible 7-sided pedestal and column with separate height-aware colliders.
      for(const collider of landmarkCollisionVolumes(def.x,def.z,g.position.y)){
        world.addObstacle(collider.x,collider.bottom,collider.z,collider.radius,collider.top-collider.bottom,collider.type);
        Object.assign(world.obstacles.at(-1),collider);
      }
      // Different accents and shapes make the seven sites recognizable
      // without increasing terrain collisions or requiring external assets.
      const colors=[0x75ddab,0x61beff,0xffc96e,0xb7d0ed,0x8bead7,0xb68aff,0xff8954];
      const accent=new THREE.MeshBasicMaterial({color:colors[index],transparent:true,opacity:.7,depthWrite:false});
      const decor=new THREE.Group();g.add(decor);
      if(index===1){
        for(let k=0;k<3;k++){
          const waterfall=new THREE.Mesh(new THREE.BoxGeometry(.24,5-k*.7,.28),accent);
          waterfall.position.set((k-1)*1.5,4,-2.5-k*.35);decor.add(waterfall);
        }
      }else if(index===2){
        const flame=new THREE.Mesh(new THREE.ConeGeometry(2.2,4.4,7),accent);
        flame.position.y=13.4;decor.add(flame);
      }else if(index===3){
        for(let k=0;k<3;k++){
          const mist=new THREE.Mesh(new THREE.TorusGeometry(3.7+k*.5,.13,5,28),accent);
          mist.position.y=3.2+k*2.4;mist.rotation.x=Math.PI/2;decor.add(mist);
        }
      }else if(index===4){
        for(let k=0;k<5;k++){
          const wind=new THREE.Mesh(new THREE.BoxGeometry(.2,4,.4),accent);
          wind.position.set(Math.cos(k*Math.PI*2/5)*3.6,5,Math.sin(k*Math.PI*2/5)*3.6);
          wind.rotation.y=k*Math.PI*2/5;decor.add(wind);
        }
      }else if(index===5){
        for(let k=0;k<4;k++){
          const shard=new THREE.Mesh(new THREE.OctahedronGeometry(1.3),accent);
          shard.position.set(Math.cos(k*Math.PI/2)*3.7,3+k*.8,Math.sin(k*Math.PI/2)*3.7);
          decor.add(shard);
        }
      }else if(index===6){
        for(let k=0;k<5;k++){
          const ember=new THREE.Mesh(new THREE.TetrahedronGeometry(.7+k*.08),accent);
          ember.position.set(Math.cos(k*2.4)*2.8,5+k*.9,Math.sin(k*2.4)*2.8);
          decor.add(ember);
        }
      }else{
        const crown=new THREE.Mesh(new THREE.TorusGeometry(2.4,.18,6,20),accent);
        crown.rotation.x=Math.PI/2;crown.position.y=12.2;decor.add(crown);
      }
      scene.add(g);return {g,crystal,ring,rune,decor};
    });
  }
  update(time,discovery){this.objects.forEach((object,i)=>{
    const seen=discovery.found[i];object.crystal.rotation.y=time*.8+i;
    object.decor.rotation.y=Math.sin(time*.16+i)*.06;
    object.crystal.position.y=10.65+Math.sin(time*1.5+i)*.35;
    object.rune.emissiveIntensity=seen?.25:1.2+Math.sin(time*2+i)*.25;
    object.ring.visible=!seen;
    object.ring.scale.setScalar(1+Math.sin(time*1.3+i)*.04);
  });}
  tryDiscover(position,discovery){for(let i=0;i<LANDMARKS.length;i++){
    if(discovery.found[i])continue;
    const o=this.objects[i].g.position;
    if(Math.hypot(position.x-o.x,position.z-o.z)<13 && Math.abs(position.y-o.y)<43){return discovery.discover(i);}
  }return null;}
}
