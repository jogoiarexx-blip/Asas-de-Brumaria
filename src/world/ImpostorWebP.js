import * as THREE from 'three';
import {ISLANDS} from './config.js';
import {treeVariant,treeCrownPose} from './TreeVariation.js';

/** Pre-rendered WebP silhouettes are transparent and measured in WORLD UNITS,
 * never in image pixels. Terrain/colliders/quests remain original geometry.
 * When a new GLB is supplied, registerObject() takes its real Box3.
 */
import {IMPOSTOR_PROFILES,lodFromShore,boxSize} from './ImpostorRules.js';
function boundsOfVegetation(item,kind,resources){
  const box=new THREE.Box3().makeEmpty(),part=new THREE.Box3(),dummy=new THREE.Object3D();
  const extend=(geo,x,y,z,sx,sy,sz,yaw=0,roll=0)=>{
    if(!geo.boundingBox)geo.computeBoundingBox();
    dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,roll);
    dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
    part.copy(geo.boundingBox).applyMatrix4(dummy.matrix);box.union(part);
  };
  const size=item.size;
  if(kind==='rock'){
    extend(resources.stoneGeometry,0,size*.45,0,1.35*size,.67*size,.95*size,item.rotation);
  }else{
    extend(resources.woodGeometry,0,1.2*size,0,size,size,size);
    const geometries=kind==='conifer'?resources.coniferCrowns:resources.broadleafCrowns;
    for(let k=0;k<2;k++){
      const p=treeCrownPose(item,k);
      extend(geometries[k],p.dx*size,p.y*size,p.dz*size,p.sx*size,p.sy*size,p.sz*size,p.yaw);
    }
    // The fern instances are also part of the true procedural world bounds.
    if(resources.fernGeometry)for(let layer=0;layer<2;layer++){
      const angle=item.palette*1.57+layer*2.4;
      extend(resources.fernGeometry,Math.cos(angle)*size*1.22,.40*size,
        Math.sin(angle)*size*1.22,.75*size,.64*size,.82*size,angle,layer===0?-.18:.2);
    }
  }
  return boxSize(box);
}

export class IslandImpostorLOD{
  constructor(world,scene){
    this.world=world;this.scene=scene;this.groups=new Map();this.registered=[];
    this.textureReady=new Set();this.textures=new Map();this.elapsed=0;this.lastYaw=Infinity;
    this.geometry=new THREE.PlaneGeometry(1,1);
    this.loader=new THREE.TextureLoader();
    this.loadWebP();
  }
  loadWebP(){
    for(const kind of ['conifer','broadleaf','rock','cabin']){
      const url='./assets/impostors/'+kind+'.webp';
      const texture=this.loader.load(url,()=>{
        texture.colorSpace=THREE.SRGBColorSpace;
        // The WebP has transparent margins for safe atlas rendering. Crop
        // those by UV (no texture re-upload) so the visible silhouette fills
        // exactly the source Box3 dimensions when the sprite is scaled.
        try{
          const image=texture.image,canvas=document.createElement('canvas');
          canvas.width=image.width;canvas.height=image.height;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});
          ctx.drawImage(image,0,0);
          const px=ctx.getImageData(0,0,image.width,image.height).data;
          let minX=image.width,minY=image.height,maxX=-1,maxY=-1;
          for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
            if(px[(y*image.width+x)*4+3]<12)continue;
            minX=Math.min(minX,x);maxX=Math.max(maxX,x);
            minY=Math.min(minY,y);maxY=Math.max(maxY,y);
          }
          if(maxX>=minX&&maxY>=minY){
            texture.offset.set(minX/image.width,1-(maxY+1)/image.height);
            texture.repeat.set((maxX-minX+1)/image.width,(maxY-minY+1)/image.height);
          }
          texture.needsUpdate=true;
        }catch{/* WebP still loads normally if canvas readback is restricted. */}
        this.textureReady.add(kind);
      },undefined,()=>{this.textureReady.delete(kind);});
      texture.colorSpace=THREE.SRGBColorSpace;
      this.textures.set(kind,texture);
    }
  }
  makeBatch(items,kind){
    if(!items.length)return null;
    const material=new THREE.MeshBasicMaterial({
      map:this.textures.get(kind),transparent:true,alphaTest:.25,
      depthWrite:false,side:THREE.DoubleSide,fog:true,opacity:1
    });
    const mesh=new THREE.InstancedMesh(this.geometry,material,items.length);
    mesh.frustumCulled=true;mesh.visible=false;mesh.castShadow=false;
    mesh.userData.impostorKind=kind;
    this.scene.add(mesh);
    return {mesh,items,kind};
  }
  createIsland(island){
    if(this.groups.has(island.name))return this.groups.get(island.name);
    const all={conifer:[],broadleaf:[],rock:[]};
    const resources=this.world._foliageResources;
    const trees=this.world.forestTrees.filter(x=>x.island===island.name);
    const rocks=this.world.forestRocks.filter(x=>x.island===island.name);
    for(const t of trees){
      const kind=treeVariant(t).kind;
      all[kind].push({...t,bounds:boundsOfVegetation(t,kind,resources)});
    }
    for(const r of rocks)all.rock.push({...r,bounds:boundsOfVegetation(r,'rock',resources)});
    const group={state:'far',blend:0,batches:Object.entries(all).map(([k,v])=>this.makeBatch(v,k)).filter(Boolean)};
    for(const b of group.batches){
      b.mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(island.x,24,island.z),
        island.r+90);
    }
    this.groups.set(island.name,group);return group;
  }
  /** Register any static procedural object or loaded GLB, preserving exact
   * bounding box, pivot and floor height from the source Three.js object.
   * Never register interactive actors (player, enemies, bosses).
   */
  registerObject(object,{kind='cabin',near=125,far=230}={}){
    if(!object||!this.textures.has(kind))return false;
    object.updateWorldMatrix?.(true,true);
    const bounds=new THREE.Box3().setFromObject(object);
    if(bounds.isEmpty())return false;
    const size=boxSize(bounds);
    const batch=this.makeBatch([{x:(bounds.min.x+bounds.max.x)/2,
      y:bounds.min.y,z:(bounds.min.z+bounds.max.z)/2,bounds:{...size,centerY:size.height/2}}],kind);
    if(!batch)return false;
    batch.mesh.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
    batch.mesh.boundingSphere.radius+=6;
    this.registered.push({object,batch,near,far,state:'full'});
    return true;
  }
  face(batch,yaw){
    const dummy=new THREE.Object3D();
    for(let i=0;i<batch.items.length;i++){
      const item=batch.items[i],size=item.bounds;
      dummy.position.set(item.x,item.y+size.centerY,item.z);
      dummy.rotation.set(0,yaw,0);dummy.scale.set(size.width,size.height,1);
      dummy.updateMatrix();batch.mesh.setMatrixAt(i,dummy.matrix);
    }
    batch.mesh.instanceMatrix.needsUpdate=true;
  }
  update(observer,camera,tier='balanced',dt=0){
    this.elapsed+=Math.max(0,dt);
    const yaw=camera?.rotation?.y??0;
    const refresh=this.elapsed>=.22||Math.abs(yaw-this.lastYaw)>.12;
    if(refresh){this.elapsed=0;this.lastYaw=yaw;}
    const profile=IMPOSTOR_PROFILES[tier]??IMPOSTOR_PROFILES.balanced;
    for(const island of ISLANDS){
      const d=Math.max(0,Math.hypot(observer.x-island.x,observer.z-island.z)-island.r);
      const group=this.createIsland(island);
      const target=lodFromShore(d,profile,group.state);
      const hasProxy=group.batches.every(b=>this.textureReady.has(b.kind));
      const nearMeshes=this.world.foliageByIsland.get(island.name)??[];
      const nearReady=nearMeshes.length>0;
      const state=target!=='hidden'&&!nearReady&&hasProxy?'far':
        (target==='far'||target==='hidden')&&!hasProxy&&nearReady?'mid':target;
      group.state=state;
      // Two short frames of overlap between WebP and real geometry soften
      // swaps without allocating new meshes or changing gameplay colliders.
      const proxyTarget=(state==='far'||!nearReady&&state!=='hidden')&&hasProxy?1:0;
      group.blend=Math.max(0,Math.min(1,group.blend+(proxyTarget?0.52:-0.52)));
      const proxyOn=group.blend>0.01&&hasProxy&&state!=='hidden';
      for(const batch of group.batches){
        const appeared=!batch.mesh.visible;
        batch.mesh.visible=proxyOn&&this.textureReady.has(batch.kind);
        batch.mesh.material.opacity=group.blend;
        if(batch.mesh.visible&&(refresh||appeared))this.face(batch,yaw);
      }
      const realOn=state==='full'||state==='mid'||!hasProxy&&state!=='hidden'||group.blend<1&&nearReady;
      for(const mesh of nearMeshes){
        if(!realOn){mesh.visible=false;continue;}
        if(mesh.userData.lodLayer==='fern'||mesh.userData.lodLayer==='upper-crown')
          mesh.visible=state==='full';
        else mesh.visible=true;
      }
      const grass=this.world.grassByIsland.get(island.name);
      const flowers=this.world.flowersByIsland.get(island.name);
      if(grass)grass.visible=state==='full';
      if(flowers)flowers.visible=state==='full'&&tier!=='economy';
      const accents=this.world.biomeAccentsByIsland.get(island.name);
      if(accents)accents.visible=state==='full'||state==='mid';
    }
    for(const record of this.registered){
      const it=record.batch.items[0],d=Math.hypot(observer.x-it.x,observer.z-it.z);
      const mode=lodFromShore(d,{near:record.near,far:record.far,hide:profile.hide},record.state);
      record.state=mode;
      const proxyVisible=(mode==='far')&&this.textureReady.has(record.batch.kind);
      const appeared=!record.batch.mesh.visible;
      record.batch.mesh.visible=proxyVisible;
      record.object.visible=!proxyVisible&&mode!=='hidden';
      if(proxyVisible&&(refresh||appeared))this.face(record.batch,yaw);
    }
  }
  getStatistics(){
    return {islands:this.groups.size,visibleBatches:[...this.groups.values()].flatMap(g=>g.batches)
      .filter(x=>x.mesh.visible).length,webpReady:[...this.textureReady]};
  }
}
