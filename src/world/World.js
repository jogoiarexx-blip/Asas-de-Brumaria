import {batchRigidMeshes} from '../utils/rigBatch.js';
import * as THREE from 'three';
import { ISLANDS } from './config.js';
import { seededRandom, clamp } from '../utils/math.js';
import { obstacleCeiling } from '../utils/collision.js';
import {ObstacleGrid} from '../utils/ObstacleGrid.js';
import {predictFlightIsland} from './IslandFlightPrefetch.js';
import { surfaceHeightAt,flattenVillageGround } from '../utils/surfaces.js';
import {terrainPalette} from './TerrainPalette.js';
import {TerrainTextureManager,terrainKind} from './TerrainTextureManager.js';
import {treeVariant,treeCrownPose} from './TreeVariation.js';
import {makeGrassTuftGeometry,terrainColorGrain,makeTreeCrownGeometry} from './NatureGeometry.js';
import {applyIslandVisibility,shouldRefreshClouds,wrappedCloudX} from './VisibilityBudget.js';
import {IslandDetailStream,ISLAND_DETAIL_PHASES} from './IslandDetailStream.js';
import {IslandImpostorLOD} from './ImpostorWebP.js';
import {natureBudget,grassDrawCount,birdFlightPose,natureGust,pollenDrift} from './NatureLife.js';
import {windShaderState,installGrassWind,installBirdWingMotion} from './NatureShaders.js';
const brown = new THREE.MeshLambertMaterial({color:0x855b37});
const leafPalette = [0x245d49,0x2b7355,0x398565,0x31735c];
const rand = seededRandom(18971);
function naturalIslandHeight(island,x,z){
  const dx=x-island.x, dz=z-island.z;
  const d=Math.hypot(dx,dz)/island.r;
  if(d>=1)return -2;
  const rough=Math.sin(x*.13+island.seed)*Math.cos(z*.16-island.seed)*.85;
  const wave=Math.sin(x*.055+island.seed)*Math.cos(z*.07)*1.4;
  return -1.5+island.h*Math.pow(Math.max(0,1-d*d),1.7)+(rough+wave)*(1-d);
}
const VILLAGE_HEIGHT=naturalIslandHeight(ISLANDS[0],8,7);

export class World {
  constructor(scene,renderer=null) {
    this.scene = scene;
    this.elapsed = 0;
    this.clouds = [];
    this.materials = [];
    this.obstacles = [];this.surfaces=[];
    this.obstacleGrid=new ObstacleGrid(()=>this.obstacles,{cellSize:32});
    this.forestTrees = [];this.forestRocks = [];this.foliageMeshes = [];this.villageCabins=[];
    this.foliageByIsland=new Map();this.grassByIsland=new Map();this.flowersByIsland=new Map();
    this.biomeAccentsByIsland=new Map();this.coastByIsland=new Map();this.coastFade=new Map();
    this.terrainTextures=new TerrainTextureManager(renderer);
    this.detailTier='balanced';this.detailElapsed=Infinity;this.cloudElapsed=Infinity;
    this.cloudTravel=0;this.visibleIslandCount=ISLANDS.length;
    this.cloudWind=1;
    this.natureWeatherWind=0;
    this.natureWind=windShaderState();
    this.natureWind.player.value=new THREE.Vector2(1e6,1e6);
    this.birdWingTime={value:0};this.birdUpdateClock=Infinity;
    this.pollenUpdateClock=Infinity;
    this.populate();
    this.detailStream=new IslandDetailStream(ISLANDS,{
      coast:island=>this._buildCoastForIsland(island),
      foliage:island=>this.flushFoliage(island),
      grass:island=>this._buildGrassForIsland(island),
      flowers:island=>this._buildWildflowersForIsland(island),
      dispose:(island,phase)=>this.releaseIslandDetails(island,phase)
    });
    // Starting village is already prepared; nothing remote is eagerly uploaded.
    this.detailStream.markReady(ISLANDS[0].name);
    this.visualStreamingEnabled=false;
    this.impostors=new IslandImpostorLOD(this,this.scene);
    for(const house of this.villageCabins)this.impostors.registerObject(house,{kind:'cabin',near:145,far:265});
  }
  islandHeight(island,x,z) {
    const original=naturalIslandHeight(island,x,z);
    return island===ISLANDS[0]?flattenVillageGround(original,x,z,VILLAGE_HEIGHT):original;
  }
  heightAt(x,z) {
    if(x>650&&this.mountainRegion)return this.mountainRegion.heightAt(x,z);
    let h = -2;
    for (const island of ISLANDS) h=Math.max(h,this.islandHeight(island,x,z));
    return h;
  }
  groundHeightAt(x,z,radius=0) { return surfaceHeightAt(this.heightAt(x,z),x,z,this.surfaces,radius); }
  walkable(x,z) { if(x>650&&this.mountainRegion)return this.mountainRegion.heightAt(x,z)>1;return ISLANDS.some(i=>Math.hypot(x-i.x,z-i.z) < i.r*.92 && this.islandHeight(i,x,z)>1); }
  clearanceAt(x,z,radius=1) { return obstacleCeiling(x,z,radius,this.obstacleGrid); }
  addObstacle(x,y,z,radius,height,type){
    const obstacle={x,z,radius,bottom:y,top:y+height,type};
    this.obstacles.push(obstacle);
    return obstacle;
  }
  populate() {
    const scene = this.scene;
    const sky = new THREE.HemisphereLight(0xd6f4ff,0x3a6d65,2.25); scene.add(sky);this.sky=sky;
    const sun = new THREE.DirectionalLight(0xffedcb,2.65); sun.position.set(-135,190,-200);
    sun.castShadow=true; sun.shadow.mapSize.set(512,512); sun.shadow.camera.left=-140;sun.shadow.camera.right=140; sun.shadow.camera.top=140; sun.shadow.camera.bottom=-140;
    sun.shadow.camera.near=1; sun.shadow.camera.far=500; sun.shadow.bias=-.001; scene.add(sun);scene.add(sun.target);this.sun=sun;
    const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(29,20,16),new THREE.MeshBasicMaterial({color:0xffefd0,fog:false}));
    sunOrb.position.set(-400,270,-520); scene.add(sunOrb);this.sunOrb=sunOrb;
    const waterTexture = this.makeWaterTexture();
    this.waterTexture=waterTexture;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),new THREE.MeshPhongMaterial({color:0x287da2,shininess:120,specular:0xb6ebed,map:waterTexture,bumpMap:waterTexture,bumpScale:.12,transparent:false}));
    this.water=water;
    water.rotation.x=-Math.PI/2; water.position.y=-.9; water.receiveShadow=true;scene.add(water);
    // v1.6.0 — mar com reflexo do céu por ângulo de visão (Fresnel) e brilho do
    // sol mais concentrado. Mesmo material Phong: nenhuma textura ou passe extra.
    this.waterSkyTint={value:new THREE.Color(0xa3e2ed)};
    water.material.shininess=64;water.material.specular.setRGB(.022,.027,.029);
    water.material.onBeforeCompile=shader=>{
      shader.uniforms.uSkyTint=this.waterSkyTint;
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>','#include <common>\nuniform vec3 uSkyTint;')
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          float brumFresnel=pow(1.0-clamp(dot(normalize(vViewPosition),normal),0.0,1.0),3.2);
          diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.86,.95,1.02),uSkyTint,brumFresnel*.62);`);
    };
    water.material.customProgramCacheKey=()=>'brumaria-water-fresnel-v160';
    for (const island of ISLANDS) this.buildIsland(island);
    this.flushFoliage();
    this.buildCoastalDetails(); this.buildWildGrass(); this.buildWildflowers(); this.buildBiomeAccents(); this.buildVillage(); this.buildVillageProps(); this.buildClouds(); this.buildSeabirds(); this.buildPollen();
    this.buildCoastRocks(); this.buildPier();
    this.buildCascades(); this.buildLanternGlow();
  }
  makeWaterTexture() {
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=384;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#62b6c9';ctx.fillRect(0,0,384,384);
    for (let i=0;i<330;i++) { const x=rand()*384, y=rand()*384;
      ctx.strokeStyle=`rgba(214,254,250,${.04+rand()*.14})`;
      ctx.lineWidth=.6+rand()*1.35;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+7,y-3,x+18+rand()*27,y);ctx.stroke(); }
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(18,18);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  buildIsland(island) {
    const N=84,R=27,pos=[],colors=[],uv=[],indices=[];
    // Subtle patches and steep-edge rock blending add definition using existing vertex colors.
    for(let ring=0;ring<=R;ring++) {
      const rr=ring/R*island.r;
      for(let j=0;j<=N;j++){
        const a=j/N*Math.PI*2,x=island.x+Math.cos(a)*rr,z=island.z+Math.sin(a)*rr;
        const y=this.islandHeight(island,x,z);
        pos.push(x,y,z);
        // Continuous world-space UVs avoid visible seams across rings;
        // tile every ~14 metres rather than stretching one image per island.
        uv.push(x/14,z/14);
        const dx=(this.islandHeight(island,x+1.1,z)-this.islandHeight(island,x-1.1,z))*.45;
        const dz=(this.islandHeight(island,x,z+1.1)-this.islandHeight(island,x,z-1.1))*.45;
        const slope=clamp(Math.hypot(dx,dz)/3.2,0,1);
        const detail=Math.sin(x*.17+island.seed)*Math.cos(z*.13-island.seed);
        const c=terrainPalette(y,slope,detail,island.biome);
        const grain=terrainColorGrain(x,z,y,island.seed,island.biome);
        colors.push(Math.min(1,c[0]*grain),Math.min(1,c[1]*grain),Math.min(1,c[2]*grain));
      }
    }
    for(let ring=0;ring<R;ring++)for(let j=0;j<N;j++){
      const a=ring*(N+1)+j,b=a+N+1;indices.push(a,a+1,b,a+1,b+1,b);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    // Vertex colors and the original mesh remain the fallback if assets fail.
    // Texture layer has no additional geometry/draw calls.
    const material=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
    this.terrainTextures.register(terrainKind(island),material,island);
    const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;sceneAdd(this.scene,mesh);
    // Maintain visual density on larger shores without new draw calls.
    const amount=island.name==='Ilha do Refúgio'?110:45;
    for(let i=0;i<amount;i++) {
      const a=rand()*Math.PI*2,d=Math.sqrt(rand())*island.r*.8;
      const x=island.x+Math.cos(a)*d,z=island.z+Math.sin(a)*d;
      if(island.name==='Ilha do Refúgio' && x>-22 && x<32 && z>-28 && z<34) continue;
      const y=this.heightAt(x,z);if(y<3)continue;
      if(rand()<.76)this.addTree(x,y,z,.7+rand()*1.25,island.name);
      else this.addRock(x,y,z,.8+rand()*1.5,island.name);
    }
    for(let i=0;i<24;i++) {
      const a=rand()*Math.PI*2,d=island.r*(.84+rand()*.13),x=island.x+Math.cos(a)*d,z=island.z+Math.sin(a)*d;
      this.addRock(x,this.heightAt(x,z),z,.6+rand()*1.3,island.name);
    }
  }
  /** Single instanced draw per new biome. New silhouettes use procedural
   * vertices and per-instance color instead of 28 separate materials/textures.
   * Collider coordinates are created once and do not affect flight physics. */
  buildBiomeAccents() {
    const dummy=new THREE.Object3D();
    for(const island of ISLANDS){
      if(!['crystal','ash'].includes(island.biome))continue;
      const crystal=island.biome==='crystal',count=14;
      const geometry=crystal?new THREE.OctahedronGeometry(1,0):new THREE.ConeGeometry(1,3,5);
      const material=new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true});
      const mesh=new THREE.InstancedMesh(geometry,material,count);
      const palette=crystal?[0x81f3ff,0x49b8d8,0xbce9e9]:[0x65545a,0x8b655e,0x504b55];
      for(let i=0;i<count;i++){
        // A safe annulus around the center preserves the existing discovery
        // monument and the center-of-island flight training checkpoints.
        const theta=(i+.35)*Math.PI*2/count;
        const r=island.r*(.49+.18*(i%3)/2);
        const x=island.x+Math.cos(theta)*r,z=island.z+Math.sin(theta)*r;
        const ground=this.heightAt(x,z);
        const height=crystal?3.7+(i%4)*.65:3+(i%4)*.7;
        dummy.position.set(x,ground+height*.5,z);
        dummy.rotation.set(0,i*.8,crystal?.08*(i%3-1):0);
        dummy.scale.set(crystal?1.13:1.25,crystal?height*.5:height/3,crystal?1.13:1.25);
        dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        mesh.setColorAt(i,new THREE.Color(palette[i%palette.length]));
        this.addObstacle(x,ground,z,crystal?1.2:1.05,height,crystal?'crystal-spire':'basalt-spire');
      }
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      mesh.castShadow=false;mesh.receiveShadow=true;
      mesh.computeBoundingSphere();
      this.scene.add(mesh);
      this.biomeAccentsByIsland.set(island.name,mesh);
    }
  }
  // Faixas de espuma e reflexos ao redor das cinco costas, sem mapas de textura externos.
  buildCoastalDetails() { this._buildCoastForIsland(ISLANDS[0]); }
  _buildCoastForIsland(island) {
    if(this.coastByIsland.has(island.name))return;
    const objects=[];
    const foamMat=new THREE.MeshBasicMaterial({color:0xe2f9eb,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide});
    const waveMat=new THREE.MeshBasicMaterial({color:0x96e9e5,transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide});
    for(let band=0;band<2;band++) {
      const positions=[],uv=[],indices=[],steps=144;
      const r0=island.r*(band===0?.935:.965);
      const r1=r0+(band===0?2.1:1.0);
      for(let i=0;i<=steps;i++) {
        const t=i/steps,a=t*Math.PI*2;
        const wobble=Math.sin(a*17+island.seed)*.22+Math.sin(a*31-island.seed)*.14;
        for(const dr of [r0,r1]) {
          const r=dr+wobble;
          positions.push(island.x+Math.cos(a)*r,-.70+band*.012,island.z+Math.sin(a)*r);
          uv.push(t,dr===r0?0:1);
        }
        if(i<steps){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,band===0?foamMat:waveMat);
      this.scene.add(mesh);objects.push(mesh);
    }
    this.coastByIsland.set(island.name,objects);
    if(island!==ISLANDS[0]){
      this.coastFade.set(island.name,0);
      for(const mesh of objects)mesh.material.opacity=0;
    }
  }
  // Instância centenas de tufos sem centenas de draw calls.
  buildWildGrass() { this._buildGrassForIsland(ISLANDS[0]); }
  _buildGrassForIsland(island) {
    if(this.grassByIsland.has(island.name))return;
    const geometry=this._grassGeo??(this._grassGeo=makeGrassTuftGeometry());
    const material=this._grassMat??(this._grassMat=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide}));
    if(!this._grassWindInstalled){installGrassWind(material,this.natureWind);this._grassWindInstalled=true;}
    const dummy=new THREE.Object3D();
    const rand=seededRandom(19001+ISLANDS.indexOf(island)*1709);
    {
      const count=island.r>70?440:250;
      const mesh=new THREE.InstancedMesh(geometry,material,count);
      const palette=island.biome==='crystal'?[0x66b5b7,0x82cad0,0x548f9e]:
        island.biome==='ash'?[0x8b8074,0x6a7370,0x9b8a7b]:
        island.name==='Ilha da Névoa'?[0x669c9a,0x86a79a,0x4a887e]:
        island.name==='Atol Esquecido'?[0xb7af62,0xc4be81,0x819d5b]:[0x68a977,0x91b76f,0x447f67];
      let placed=0;
      for(let attempts=0;attempts<count*5&&placed<count;attempts++){
        const a=rand()*Math.PI*2,d=Math.sqrt(rand())*island.r*.83;
        const x=island.x+Math.cos(a)*d,z=island.z+Math.sin(a)*d;
        if(island.name==='Ilha do Refúgio'&&x>-37&&x<34&&z>-32&&z<38)continue;
        const y=this.heightAt(x,z);if(y<2||y>24)continue;
        dummy.position.set(x,y+.025,z);dummy.rotation.y=rand()*Math.PI*2;
        const scale=.55+rand()*1.7;dummy.scale.set(scale,scale*(.7+rand()*.8),scale);dummy.updateMatrix();
        mesh.setMatrixAt(placed,dummy.matrix);
        mesh.setColorAt(placed,new THREE.Color(palette[Math.floor(rand()*palette.length)]));
        placed++;
      }
      mesh.count=placed;mesh.userData.totalCount=placed;
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      this.scene.add(mesh);this.grassByIsland.set(island.name,mesh);
    }
  }
  /** Low-cost flower accents: one instanced draw per island; no collisions. */
  buildWildflowers(){ this._buildWildflowersForIsland(ISLANDS[0]); }
  _buildWildflowersForIsland(island){
    if(this.flowersByIsland.has(island.name))return;
    const geometry=this._flowerGeo??(this._flowerGeo=new THREE.TetrahedronGeometry(.38,0));
    const material=this._flowerMat??(this._flowerMat=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}));
    const dummy=new THREE.Object3D();
    const rand=seededRandom(39811+ISLANDS.indexOf(island)*1117);
    const palette=[0xffd8a1,0xf9acc7,0xd7c7ff,0xfff3b7,0x87d6cf];
    {
      const maximum=island.r>70?175:85;
      const flowers=new THREE.InstancedMesh(geometry,material,maximum);
      let count=0;
      for(let attempts=0;attempts<maximum*8&&count<maximum;attempts++){
        const a=rand()*Math.PI*2,d=island.r*Math.sqrt(rand())*.81;
        const x=island.x+Math.cos(a)*d,z=island.z+Math.sin(a)*d;
        if(island===ISLANDS[0]&&x>-36&&x<40&&z>-30&&z<45)continue;
        const y=this.heightAt(x,z);
        if(y<3||y>21)continue;
        const size=.45+rand()*.8;
        dummy.position.set(x,y+.26*size,z);dummy.rotation.set(0,rand()*6.28,0);
        dummy.scale.set(size,.38*size,size);dummy.updateMatrix();
        flowers.setMatrixAt(count,dummy.matrix);
        flowers.setColorAt(count,new THREE.Color(palette[Math.floor(rand()*palette.length)]));
        count++;
      }
      flowers.count=count;flowers.userData.totalCount=count;flowers.instanceMatrix.needsUpdate=true;
      if(flowers.instanceColor)flowers.instanceColor.needsUpdate=true;
      flowers.castShadow=false;flowers.receiveShadow=false;
      this.scene.add(flowers);this.flowersByIsland.set(island.name,flowers);
    }
  }
  buildVillageProps() {
    const timber=new THREE.MeshStandardMaterial({color:0x826248,roughness:.95});
    const gold=new THREE.MeshStandardMaterial({color:0xe2b86e,roughness:.55,metalness:.18});
    // Caixas de provisões, degraus para o estábulo e balizas de orientação.
    const crateLocations=[[-5,14],[16,14],[-25,18],[16,-15]];
    for(const [x,z] of crateLocations) {
      const y=this.heightAt(x,z);
      const box=new THREE.Mesh(new THREE.BoxGeometry(1.35,1.3,1.35),timber);
      box.position.set(x,y+.65,z);box.rotation.y=x*.1;box.castShadow=true;this.scene.add(box);
      const rim=new THREE.Mesh(new THREE.BoxGeometry(1.41,.15,1.41),gold);
      rim.position.set(x,y+1.25,z);rim.rotation.y=x*.1;this.scene.add(rim);
      this.addObstacle(x,y,z,1.04,1.35,'crate');
      Object.assign(this.obstacles.at(-1),{shape:'box',halfWidth:.705,halfDepth:.705,angle:box.rotation.y});
    }
    const guides=[[6,16],[12,17],[18,6],[-2,13]];
    for(const [x,z] of guides) {
      const y=this.heightAt(x,z);
      const post=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,3.4,6),timber);
      post.position.set(x,y+1.7,z);post.castShadow=true;this.scene.add(post);
      const lamp=new THREE.Mesh(new THREE.OctahedronGeometry(.46),new THREE.MeshStandardMaterial({color:0xffce78,emissive:0xff9e42,emissiveIntensity:.9}));
      lamp.position.set(x,y+3.43,z);this.scene.add(lamp);
      (this.villageLamps??=[]).push(lamp);
      this.addObstacle(x,y,z,.33,3.55,'post');
    }
  }
  /** v1.6.1 — Cascatas da Ilha das Cascatas: três riachos que descem a encosta
   * acompanhando o relevo até o mar. Uma única malha (1 draw call), textura
   * procedural rolando; sem colisão, sombra ou partículas. */
  buildCascades(){
    const island=ISLANDS.find(i=>i.name==='Ilha das Cascatas');
    if(!island)return;
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=256;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='rgba(96,186,226,.7)';ctx.fillRect(0,0,64,256); // lâmina d'água
    const edge=ctx.createLinearGradient(0,0,64,0);edge.addColorStop(0,'rgba(255,255,255,.75)');edge.addColorStop(.16,'rgba(255,255,255,0)');edge.addColorStop(.84,'rgba(255,255,255,0)');edge.addColorStop(1,'rgba(255,255,255,.75)');
    ctx.fillStyle=edge;ctx.fillRect(0,0,64,256); // espuma nas margens
    let seed=9157;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<70;i++){
      const x=rnd()*64,y=rnd()*256,len=26+rnd()*80,w=1+rnd()*3.2;
      const g=ctx.createLinearGradient(0,y,0,y+len);
      g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(${225+rnd()*30|0},250,255,${.55+rnd()*.45})`);g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g;
      for(const oy of [0,-256,256])ctx.fillRect(x,y+oy,w,len); // emenda vertical contínua
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;
    this.cascadeTexture=texture;
    const positions=[],uvs=[],indices=[];
    for(const angle of [.55,2.5,4.35]){
      const dx=Math.cos(angle),dz=Math.sin(angle),tx=-dz,tz=dx;
      let travelled=0,previous=null,base=positions.length/3,rows=0;
      for(let step=0;step<=64;step++){
        const radius=island.r*(.16+.84*step/64);
        const x=island.x+dx*radius+Math.sin(step*.42+angle)*1.4,z=island.z+dz*radius+Math.cos(step*.37+angle)*1.4;
        const ground=this.heightAt(x,z);
        if(previous)travelled+=Math.hypot(x-previous.x,z-previous.z,ground-previous.y);
        previous={x,y:ground,z};
        const half=.8+1.7*Math.min(1,step/22);
        const y=Math.max(ground,-.9)+.22;
        positions.push(x-tx*half,y,z-tz*half,x+tx*half,y,z+tz*half);
        uvs.push(0,travelled/9,1,travelled/9);rows++;
        if(ground<-.7)break; // chegou ao mar
      }
      for(let r=0;r<rows-1;r++){const i=base+r*2;indices.push(i,i+2,i+1,i+1,i+2,i+3);}
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeBoundingSphere();
    const material=new THREE.MeshBasicMaterial({color:0xc4e8fb,map:texture,transparent:true,opacity:.92,
      depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    this.cascades=new THREE.Mesh(geometry,material);this.cascades.name='CASCATAS';
    this.cascades.castShadow=false;this.cascades.receiveShadow=false;this.cascades.renderOrder=2;
    this.scene.add(this.cascades);
  }
  /** v1.6.1 — As lanternas da vila acendem ao anoitecer. Só uniformes mudam
   * (emissivo + opacidade do brilho): nenhuma luz dinâmica nova. */
  buildLanternGlow(){
    const lamps=this.villageLamps??[];
    if(!lamps.length)return;
    const points=[],world=new THREE.Vector3();
    for(const lamp of lamps){lamp.getWorldPosition(world);points.push(world.x,world.y,world.z);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,236,190,1)');g.addColorStop(.25,'rgba(255,190,110,.55)');g.addColorStop(1,'rgba(255,150,60,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
    const sprite=new THREE.CanvasTexture(canvas);sprite.colorSpace=THREE.SRGBColorSpace;
    this.lanternGlow=new THREE.Points(geometry,new THREE.PointsMaterial({map:sprite,size:9,sizeAttenuation:true,
      transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:true}));
    this.lanternGlow.name='BRILHO_LANTERNAS';this.lanternGlow.frustumCulled=false;this.scene.add(this.lanternGlow);
    this.setNightGlow(0);
  }
  /** `night` em 0..1 (mesma medida das estrelas). */
  setNightGlow(night=0){
    const n=THREE.MathUtils.clamp(night,0,1);
    if(n===this._nightGlow)return;
    this._nightGlow=n;
    for(const lamp of this.villageLamps??[])lamp.material.emissiveIntensity=.55+n*2.4;
    if(this.windowMaterial)this.windowMaterial.emissiveIntensity=n*1.9;
    if(this.lanternGlow)this.lanternGlow.material.opacity=n*.85;
  }
  // Batch static vegetation into five draw groups instead of thousands of scene meshes.
  // The collision volumes remain identical to the procedural v0.7 terrain.
  addTree(x,y,z,size=1,island='Ilha do Refúgio') {
    this.forestTrees.push({x,y,z,size,island,palette:Math.floor(rand()*leafPalette.length)});
    this.addObstacle(x,y,z,.82*size,5.2*size,'tree');
  }
  addRock(x,y,z,size,island='Ilha do Refúgio') {
    this.forestRocks.push({x,y,z,size,island,palette:rand()>.5?0x829087:0x6c807a,rotation:rand()*6});
    this.addObstacle(x,y,z,1.18*size,1.2*size,'rock');
  }
  flushFoliage(only=ISLANDS[0]) {
    if(this.foliageByIsland.has(only.name))return;
    const dummy=new THREE.Object3D();
    // Each island gets its own GPU batches, allowing per-island frustum culling.
    const buckets=new Map(ISLANDS.map(i=>[i.name,{trees:[],rocks:[]}])) ;
    const nearest=t=>{
      let result=ISLANDS[0],best=Infinity;
      for(const island of ISLANDS){
        const dx=t.x-island.x,dz=t.z-island.z,d=dx*dx+dz*dz;
        if(d<best){best=d;result=island;}
      }
      return result.name;
    };
    for(const t of this.forestTrees)buckets.get(nearest(t)).trees.push(t);
    for(const r of this.forestRocks)buckets.get(nearest(r)).rocks.push(r);
    const common=this._foliageResources??(this._foliageResources={
      woodGeometry:new THREE.CylinderGeometry(.2,.38,2.4,6),
      crownMaterial:new THREE.MeshLambertMaterial({color:0xffffff}),
      coniferCrowns:[new THREE.ConeGeometry(1.65,3.2,7),new THREE.ConeGeometry(1.37,2.85,7)],
      broadleafCrowns:[makeTreeCrownGeometry(1.4,13),makeTreeCrownGeometry(1.1,27)],
      stoneGeometry:new THREE.DodecahedronGeometry(1,0),
      stoneMaterial:new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),
    });
    const {woodGeometry,crownMaterial,coniferCrowns,broadleafCrowns,stoneGeometry,stoneMaterial}=common;
    const addBatch=(geometry,material,items,place,colorOf,shadows,islandName)=>{
      if(!items.length)return;
      const batch=new THREE.InstancedMesh(geometry,material,items.length);
      batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      for(let i=0;i<items.length;i++){
        const item=items[i];dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);
        place(item,dummy);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);
        if(colorOf)batch.setColorAt(i,new THREE.Color(colorOf(item)));
      }
      batch.instanceMatrix.needsUpdate=true;
      if(batch.instanceColor)batch.instanceColor.needsUpdate=true;
      batch.castShadow=shadows===true||shadows==='base';batch.userData.lodLayer=typeof shadows==='string'?shadows:'base';batch.computeBoundingSphere();
      this.scene.add(batch);this.foliageMeshes.push(batch);
      this.foliageByIsland.get(islandName).push(batch);
    };
    for(const island of [only]){
      const {trees,rocks}=buckets.get(island.name);
      this.foliageByIsland.set(island.name,[]);
      addBatch(woodGeometry,brown,trees,
        (t,d)=>{d.position.set(t.x,t.y+1.2*t.size,t.z);d.scale.setScalar(t.size);},
        t=>[0xd8c6a4,0xc8b4a3,0xe3c9a3,0xd3b19a][t.palette%4],true,island.name);
      // Keep one trunk + two canopy layers, but use two distinct silhouettes.
      // Matrices and colors are uploaded once; render uses existing island visibility.
      const conifers=trees.filter(t=>treeVariant(t).kind==='conifer');
      const broadleaf=trees.filter(t=>treeVariant(t).kind==='broadleaf');
      for(let k=0;k<2;k++){
        const placeCrown=(t,d)=>{
          const pose=treeCrownPose(t,k);
          d.position.set(t.x+pose.dx*t.size,t.y+pose.y*t.size,t.z+pose.dz*t.size);
          d.rotation.y=pose.yaw;
          d.scale.set(pose.sx*t.size,pose.sy*t.size,pose.sz*t.size);
        };
        addBatch(coniferCrowns[k],crownMaterial,conifers,placeCrown,
          t=>leafPalette[(t.palette+k)%leafPalette.length],k===0?'base':'upper-crown',island.name);
        addBatch(broadleafCrowns[k],crownMaterial,broadleaf,placeCrown,
          t=>leafPalette[(t.palette+k+1)%leafPalette.length],k===0?'base':'upper-crown',island.name);
      }
      // Sub-bosque instanciado: samambaias de duas tonalidades nas bordas das árvores.
      // Sem hitboxes novas, sem sombras extras e com descarte por ilha já existente.
      const fernGeo=this._fernGeo??(this._fernGeo=new THREE.ConeGeometry(.72,1.42,5));
      this._foliageResources.fernGeometry=fernGeo;
      const fernMat=this._fernMat??(this._fernMat=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}));
      for(let layer=0;layer<2;layer++){
        addBatch(fernGeo,fernMat,trees,
          (t,d)=>{
            const angle=t.palette*1.57+layer*2.4;
            d.position.set(t.x+Math.cos(angle)*t.size*1.22,t.y+.40*t.size,t.z+Math.sin(angle)*t.size*1.22);
            d.rotation.y=angle;d.rotation.z=(layer===0?-.18:.2);
            d.scale.set(.75*t.size,.64*t.size,.82*t.size);
          },
          t=>layer===0?0x377b56:leafPalette[t.palette],'fern',island.name);
      }
      addBatch(stoneGeometry,stoneMaterial,rocks,
        (r,d)=>{d.position.set(r.x,r.y+r.size*.45,r.z);d.rotation.y=r.rotation;d.scale.set(1.35*r.size,.67*r.size,.95*r.size);},
        r=>r.palette,true,island.name);
    }
  }
  /** Deferred scenery never owns collision volumes: those were baked in
   * buildIsland() before any streaming. Reused shared geometries stay alive. */
  releaseIslandDetails(island,phase){
    const id=island.name;
    if(phase==='foliage'){
      const batches=this.foliageByIsland.get(id)??[];
      for(const mesh of batches){
        this.scene.remove(mesh);mesh.dispose?.();
        const index=this.foliageMeshes.indexOf(mesh);
        if(index!==-1)this.foliageMeshes.splice(index,1);
      }
      this.foliageByIsland.delete(id);
    }else if(phase==='grass'||phase==='flowers'){
      const map=phase==='grass'?this.grassByIsland:this.flowersByIsland;
      const mesh=map.get(id);
      if(mesh){this.scene.remove(mesh);mesh.dispose?.();map.delete(id);}
    }else if(phase==='coast'){
      const meshes=this.coastByIsland.get(id)??[];
      for(const mesh of meshes){this.scene.remove(mesh);mesh.geometry.dispose();}
      this.coastFade.delete(id);
      // Both foam materials are unique to the island, not shared.
      for(const material of new Set(meshes.map(m=>m.material)))material.dispose();
      this.coastByIsland.delete(id);
    }
  }
  /** Used in Play's preparation panel. No streaming is triggered in the menu.
   * The player's saved position may be on a different island than the village. */
  async prepareStartingIsland(observer,onProgress=()=>{}){
    this.visualStreamingEnabled=true;
    this.detailStream.plan(observer,this.detailTier);
    // One batch per animation frame rather than one huge synchronous build.
    const primary=this.detailStream.queue[0]?.island?.name;
    if(!primary)return;
    for(let i=0;i<ISLAND_DETAIL_PHASES.length;i++){
      if(!this.detailStream.queue.some(item=>item.island.name===primary))break;
      this.detailStream.step(1);
      onProgress(i+1,ISLAND_DETAIL_PHASES.length);
      if(typeof requestAnimationFrame==='function')
        await new Promise(resolve=>requestAnimationFrame(resolve));
    }
  }
  buildVillage() {
    const cabin=(x,z,size=1)=>{
      const group=new THREE.Group();const y=this.heightAt(x,z);group.position.set(x,y,z);group.scale.setScalar(size);
      const wood=new THREE.MeshLambertMaterial({color:0x9f7652}), roof=new THREE.MeshLambertMaterial({color:0x354c54});
      const base=new THREE.Mesh(new THREE.BoxGeometry(6,4.5,5),wood);base.position.y=2.35;base.castShadow=true;group.add(base);
      const top=new THREE.Mesh(new THREE.ConeGeometry(5.3,3.6,4),roof);top.position.y=5.6;top.rotation.y=Math.PI/4;top.castShadow=true;group.add(top);
      const door=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.7,.08),new THREE.MeshLambertMaterial({color:0x513729}));door.position.set(0,1.35,2.54);group.add(door);
      // v1.7.2 — casas com alicerce de pedra, esteios, beiral, janelas que
      // acendem à noite, chaminé e alpendre. Materiais compartilhados entre as
      // casas e peças fundidas por material: poucas chamadas de desenho a mais.
      const kit=this.cabinKit??=this.makeCabinKit();
      // Os detalhes das quatro casas vão para um único grupo, fundido por
      // material depois: 4 chamadas de desenho para a vila inteira.
      const detail=this.cabinDetail??=new THREE.Group();
      const part=(geometry,material,lx,ly,lz)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x+lx*size,y+ly*size,z+lz*size);mesh.scale.setScalar(size);mesh.castShadow=false;detail.add(mesh);return mesh;};
      part(kit.foundation,kit.stone,0,.3,0);
      for(const sx of [-1,1])for(const sz of [-1,1])part(kit.post,kit.darkWood,sx*3.02,2.35,sz*2.52);
      for(const y of [1.25,3.45])part(kit.beam,kit.darkWood,0,y,2.53);
      const eaves=part(kit.eaves,kit.roofTrim,0,3.98,0);eaves.rotation.y=Math.PI/4;
      const cap=part(kit.roofCap,kit.roofTrim,0,7.42,0);cap.rotation.y=Math.PI/4;
      for(const sx of [-1,1]){
        part(kit.window,this.windowMaterial,sx*2.05,2.55,2.535);
        part(kit.windowBarH,kit.darkWood,sx*2.05,2.55,2.56);part(kit.windowBarV,kit.darkWood,sx*2.05,2.55,2.56);
        part(kit.sill,kit.darkWood,sx*2.05,1.93,2.62);
        const side=part(kit.window,this.windowMaterial,sx*3.035,2.55,-.3);side.rotation.y=Math.PI/2;
        part(kit.porchPost,kit.darkWood,sx*1.25,1.5,3.75);
      }
      part(kit.doorFrame,kit.darkWood,0,2.78,2.56);
      part(kit.knob,kit.stone,.45,1.3,2.61);
      const awning=part(kit.awning,kit.roofTrim,0,3.12,3.2);awning.rotation.x=.22;
      part(kit.step,kit.stone,0,.16,3.2);
      part(kit.chimney,kit.stone,1.75,5.9,-1.1);part(kit.chimneyCap,kit.darkWood,1.75,7.28,-1.1);
      this.scene.add(group);this.villageCabins.push(group);
      this.addObstacle(x,y,z,Math.hypot(3*size,2.5*size),7.6*size,'cabin');
      Object.assign(this.obstacles.at(-1),{shape:'box',halfWidth:3*size,halfDepth:2.5*size});
      this.obstacles.at(-1).top=y+4.60*size;
      // Four-sided roof, matching the rotated square-pyramid mesh above.
      this.addObstacle(x,y+3.8*size,z,5.3*size,3.6*size,'cabin-roof');
      Object.assign(this.obstacles.at(-1),{shape:'polygon',sides:4,phase:Math.PI/4,radiusTop:.1*size});
    };
    cabin(-12,-14,1);cabin(-22,9,.8);cabin(21,-23,1.13);cabin(-32,-17,.76);
    batchRigidMeshes(this.cabinDetail);this.cabinDetail.name='DETALHES_DAS_CASAS';this.scene.add(this.cabinDetail);
    const platform=new THREE.Mesh(new THREE.CylinderGeometry(7.2,7.2,.75,24),new THREE.MeshLambertMaterial({color:0x9d7c5c}));
    platform.position.set(8,this.heightAt(8,7)+.17,7);platform.receiveShadow=true;this.scene.add(platform);
    this.surfaces.push({x:8,z:7,radius:7.2,top:platform.position.y+.375});
    const fire=new THREE.Group();fire.position.set(-3,this.heightAt(-3,0),0);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.65,0),new THREE.MeshLambertMaterial({color:0x777a6f}));stone.position.set(Math.cos(a)*2.1,.3,Math.sin(a)*2.1);fire.add(stone);
    }
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.9,2.3,6),new THREE.MeshBasicMaterial({color:0xff9939}));flame.position.y=1.2;fire.add(flame);
    const light=new THREE.PointLight(0xffad60,25,23,2);light.position.y=3;fire.add(light);this.fireLight=light;this.fire=flame;this.scene.add(fire);
    this.addObstacle(-3,fire.position.y,0,2.2,2.8,'fire');
    const banner=new THREE.Group();banner.position.set(13,this.heightAt(13,-9),-9);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,9,6),brown);pole.position.y=4.5;banner.add(pole);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(4,2),new THREE.MeshLambertMaterial({color:0xf0ca79,side:THREE.DoubleSide}));flag.position.set(2,7.4,0);banner.add(flag);this.scene.add(banner);
  }
  /** Geometrias e materiais das casas, criados uma única vez. */
  makeCabinKit(){
    // Janela: escura de dia, âmbar à noite (só emissiveIntensity muda).
    this.windowMaterial=new THREE.MeshStandardMaterial({color:0x2b3d47,emissive:0xffb85c,emissiveIntensity:0,roughness:.35});
    return {
      stone:new THREE.MeshLambertMaterial({color:0x8a8d86}),
      darkWood:new THREE.MeshLambertMaterial({color:0x5b3f2c}),
      roofTrim:new THREE.MeshLambertMaterial({color:0x283b42}),
      foundation:new THREE.BoxGeometry(6.5,.6,5.5),post:new THREE.BoxGeometry(.34,4.5,.34),
      beam:new THREE.BoxGeometry(6.2,.22,.14),eaves:new THREE.ConeGeometry(5.75,.55,4),roofCap:new THREE.ConeGeometry(.5,.7,4),
      window:new THREE.BoxGeometry(1.05,1.05,.07),windowBarH:new THREE.BoxGeometry(1.2,.09,.06),windowBarV:new THREE.BoxGeometry(.09,1.2,.06),
      sill:new THREE.BoxGeometry(1.35,.12,.24),doorFrame:new THREE.BoxGeometry(1.75,.2,.14),knob:new THREE.SphereGeometry(.08,6,5),
      awning:new THREE.BoxGeometry(3.1,.14,1.5),porchPost:new THREE.BoxGeometry(.2,3,.2),step:new THREE.BoxGeometry(2.3,.32,1.1),
      chimney:new THREE.BoxGeometry(.95,2.7,.95),chimneyCap:new THREE.BoxGeometry(1.2,.16,1.2)
    };
  }
  /** v1.7.2 — Costa menos "disco perfeito": pedras na arrebentação e dois
   * pilares de rocha por ilha. Uma única malha instanciada; os pilares têm
   * colisão de voo, as pedras pequenas ficam fora da área caminhável. */
  buildCoastRocks(){
    const perIsland=18,total=ISLANDS.length*perIsland;
    const geometry=new THREE.DodecahedronGeometry(1,0);
    const material=new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true});
    const mesh=new THREE.InstancedMesh(geometry,material,total);
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    let index=0;this.seaStacks=[];
    for(const island of ISLANDS){
      let seed=Math.floor(island.seed*7919)+17;
      const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const tint=island.biome==='ash'?0x4a4340:island.biome==='crystal'?0x6f8fa3:0x878b84;
      for(let i=0;i<perIsland;i++){
        const stack=i<2,angle=rnd()*Math.PI*2;
        const radius=island.r*(stack?1.2+rnd()*.1:.965+rnd()*.1);
        const x=island.x+Math.cos(angle)*radius,z=island.z+Math.sin(angle)*radius;
        const width=stack?2.3+rnd()*1.3:.7+rnd()*1.25,height=stack?9+rnd()*7:.6+rnd()*1.3;
        const ground=Math.max(this.heightAt(x,z),-.9);
        dummy.position.set(x,ground+height*(stack?.42:.3)-.25,z);
        dummy.scale.set(width,height*(stack?.62:1),width*(.75+rnd()*.5));
        dummy.rotation.set(rnd()*(stack?.07:.3),rnd()*Math.PI,rnd()*(stack?.07:.3));dummy.updateMatrix();
        mesh.setMatrixAt(index,dummy.matrix);
        mesh.setColorAt(index,color.setHex(tint).multiplyScalar(.82+rnd()*.34));
        index++;
        if(stack){
          this.addObstacle(x,ground-1,z,width*.95,height+1,'sea-stack');
          this.seaStacks.push({x,z,radius:width,height});
        }
      }
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
    mesh.castShadow=false;mesh.receiveShadow=true;mesh.name='ROCHAS_DA_COSTA';mesh.computeBoundingSphere();
    this.coastRocks=mesh;this.scene.add(mesh);
  }
  /** v1.7.2 — Píer de madeira e dois barcos no Refúgio (apenas cenário). */
  buildPier(){
    const island=ISLANDS[0],angle=1.02,dx=Math.cos(angle),dz=Math.sin(angle);
    const wood=new THREE.MeshLambertMaterial({color:0x8a6a4a}),dark=new THREE.MeshLambertMaterial({color:0x4f3a2a});
    const hull=new THREE.MeshLambertMaterial({color:0x7a4b33,side:THREE.DoubleSide}),sail=new THREE.MeshLambertMaterial({color:0xe9dcc0,side:THREE.DoubleSide});
    const group=new THREE.Group();group.name='PIER_DO_REFUGIO';
    const start=island.r*.9,length=island.r*.3,deck=.55;
    group.position.set(island.x+dx*start,deck,island.z+dz*start);group.rotation.y=Math.atan2(dx,dz);
    const add=(geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);group.add(m);return m;};
    const plank=new THREE.BoxGeometry(3.2,.2,1.15);
    for(let z=.6;z<length;z+=1.3)add(plank,wood,0,0,z);
    const post=new THREE.CylinderGeometry(.2,.24,3.2,6);
    for(let z=1;z<length;z+=3.9)for(const sx of [-1,1])add(post,dark,sx*1.55,-.9,z);
    add(new THREE.BoxGeometry(.14,.14,length),dark,-1.55,.75,length/2);
    for(let z=1;z<length;z+=3.9)add(new THREE.BoxGeometry(.14,.85,.14),dark,-1.55,.4,z);
    const lampPost=add(new THREE.CylinderGeometry(.09,.12,2.6,6),dark,1.45,1.3,length-.8);lampPost.castShadow=true;
    const lamp=new THREE.Mesh(new THREE.OctahedronGeometry(.34),new THREE.MeshStandardMaterial({color:0xffce78,emissive:0xff9e42,emissiveIntensity:.9}));
    lamp.position.set(1.45,2.75,length-.8);group.add(lamp);
    const hullGeometry=new THREE.SphereGeometry(1,8,5,0,Math.PI*2,Math.PI/2,Math.PI/2);
    for(const [bx,bz,yaw] of [[3.4,length*.55,.25],[-3.6,length*.82,-.4]]){
      const boat=new THREE.Group();boat.position.set(bx,-deck-.45,bz);boat.rotation.y=yaw;group.add(boat);
      const body=new THREE.Mesh(hullGeometry,hull);body.scale.set(1,.75,2.5);boat.add(body);
      const bench=new THREE.Mesh(new THREE.BoxGeometry(1.7,.1,.4),dark);bench.position.y=-.12;boat.add(bench);
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,3.2,5),dark);mast.position.set(0,1.4,-.3);boat.add(mast);
      const cloth=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,.3,-.2, 0,2.9,-.2, 0,.3,1.7],3)),sail);
      cloth.geometry.computeVertexNormals();boat.add(cloth);
      batchRigidMeshes(boat);(this.pierBoats??=[]).push(boat);
    }
    batchRigidMeshes(group,{preserve:[lamp]});
    this.scene.add(group);this.pier=group;
    // A lanterna do píer acende junto com as da vila.
    lamp.updateWorldMatrix(true,false);
    (this.villageLamps??=[]).push(lamp);this.pierLamp=lamp;
  }
  buildClouds() {
    const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.62,depthWrite:false,fog:true});
    const geometry=new THREE.SphereGeometry(1,8,6);
    // All 125 cloud puffs share one geometry, material, and GPU draw call.
    const CLOUD_COUNT=25,PUFFS=5;
    this.cloudMesh=new THREE.InstancedMesh(geometry,material,CLOUD_COUNT*PUFFS);
    this.cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cloudMesh.frustumCulled=false;this.cloudMesh.castShadow=false;
    this.scene.add(this.cloudMesh);
    for(let i=0;i<CLOUD_COUNT;i++){
      const cloud={x:(rand()-.5)*850,y:85+rand()*78,z:(rand()-.5)*850,
        scale:1.8+rand()*2.8,drift:.8+rand()*1.6,puffs:[]};
      for(let j=0;j<PUFFS;j++)cloud.puffs.push({
        x:(j-2)*2,y:(rand()-.5)*.8,z:(rand()-.5)*2,
        sx:2.5+rand(),sy:1.15+rand()*.65,sz:1.6+rand()
      });
      this.clouds.push(cloud);
    }
    this.updateClouds(0);
  }
  updateClouds(time){
    if(!this.cloudMesh)return;
    const dummy=this.cloudDummy??=new THREE.Object3D();
    let index=0;
    for(const cloud of this.clouds){
      const x=wrappedCloudX(cloud.x,cloud.drift,time,1);
      for(const puff of cloud.puffs){
        dummy.position.set(x+puff.x*cloud.scale,cloud.y+puff.y*cloud.scale,cloud.z+puff.z*cloud.scale);
        dummy.rotation.set(0,0,0);
        dummy.scale.set(puff.sx*cloud.scale,puff.sy*cloud.scale,puff.sz*cloud.scale);
        dummy.updateMatrix();this.cloudMesh.setMatrixAt(index++,dummy.matrix);
      }
    }
    this.cloudMesh.instanceMatrix.needsUpdate=true;
    this.cloudElapsed=0;
  }
  setDetailQuality(tier){
    this.terrainTextures.setQuality(tier);
    this.detailTier=tier;
    this.detailElapsed=Infinity;
    this.cloudElapsed=Infinity;
    if(this.birdMesh)this.birdMesh.count=Math.min(this.birds.length,natureBudget(tier).birds);
    this.birdUpdateClock=Infinity;this.pollenUpdateClock=Infinity;
  }
  updateDetail(observer,dt=0,flight=null,camera=null){
    if(this.visualStreamingEnabled)this.detailStream.step(1);
    // Fade newly streamed coast geometry on its own material: no extra draw calls,
    // and no opacity changes to shared foliage or gameplay colliders.
    for(const [id,value] of this.coastFade){
      const next=Math.min(1,value+Math.max(0,dt)*1.65);
      const objects=this.coastByIsland.get(id);
      if(objects)for(const mesh of objects)mesh.material.opacity=next*(mesh===objects[0]?0.28:0.17);
      this.coastFade.set(id,next);
      if(next===1)this.coastFade.delete(id);
    }
    this.detailElapsed+=Math.max(0,dt);
    if(this.detailElapsed<(this.detailTier==='economy'?.30:this.detailTier==='balanced'?.20:.15))return;
    this.detailElapsed=0;
    this.natureFocus=observer;
    // Predict the next island from actual movement direction, not the camera.
    // Stream a distant coast/tree batch and its 512px preview in advance.
    const predicted=flight?.airborne?predictFlightIsland(flight.position,flight.direction,
      flight.speed,ISLANDS):null;
    this.terrainTextures.updateFocus(observer,ISLANDS);
    this.terrainTextures.prefetchAhead(predicted);
    if(this.visualStreamingEnabled)this.detailStream.plan(observer,this.detailTier,
      {prefetchIsland:predicted});
    const state=applyIslandVisibility(observer,this.detailTier,ISLANDS,this.foliageByIsland,this.grassByIsland);
    for(const island of ISLANDS){
      const bloom=this.flowersByIsland.get(island.name);
      if(!bloom)continue;
      const grass=this.grassByIsland.get(island.name);
      if(grass)grass.count=grassDrawCount(grass.userData.totalCount??grass.count,this.detailTier);
      bloom.visible=(grass?.visible??true)&&this.detailTier!=='economy';
      const accents=this.biomeAccentsByIsland.get(island.name);
      if(accents)accents.visible=this.foliageByIsland.get(island.name)?.[0]?.visible??true;
      bloom.count=this.detailTier==='balanced'?Math.ceil(bloom.userData.totalCount*.65):bloom.userData.totalCount;
    }
    if(this.visualStreamingEnabled&&this.impostors)this.impostors.update(observer,camera,this.detailTier,dt);
    this.visibleIslandCount=state.visible;
  }
  /** One instanced flock draw. A single geometry contains body, tail and
   * tapered layered wings; per-bird wing bending happens on the GPU.
   * Different coastal habitats get different birds with no new draw calls. */
  buildSeabirds() {
    const positions=[],colors=[];
    const pushTriangle=(a,b,c,tint)=>{
      const color=new THREE.Color(tint);
      for(const v of [a,b,c]){
        positions.push(...v);colors.push(color.r,color.g,color.b);
      }
    };
    const wing=0xe6e9db,feather=0xc4d2ce,body=0xf7f1de,tail=0xaebec0;
    // v1.7.2 — ave com volume: corpo em fuso de 6 lados, cabeça, bico, asas em
    // três painéis com pontas escuras e cauda em leque. Mesma envergadura de
    // antes (o shader bate as asas pela distância |x| ao corpo).
    const tipDark=0x58666c,belly=0xfffaf0,beak=0xe8a94e;
    for(const side of [-1,1]){
      pushTriangle([side*.2,.1,-.42],[side*1.2,.16,-.95],[side*1.25,.08,.2],wing);
      pushTriangle([side*.2,.1,-.42],[side*1.25,.08,.2],[side*.22,.04,.34],feather);
      pushTriangle([side*1.2,.16,-.95],[side*2.2,.1,-.72],[side*2.05,.02,.42],wing);
      pushTriangle([side*1.2,.16,-.95],[side*2.05,.02,.42],[side*1.25,.08,.2],feather);
      pushTriangle([side*2.2,.1,-.72],[side*2.96,.02,-.3],[side*2.05,.02,.42],tipDark);
      pushTriangle([side*.06,.02,.7],[side*.5,.03,1.42],[side*.12,-.02,1.5],tail);
    }
    pushTriangle([-.12,-.02,1.5],[0,.02,.7],[.12,-.02,1.5],feather);
    const ring=[];for(let k=0;k<6;k++){const a=k*Math.PI/3;ring.push([Math.cos(a)*.3,Math.sin(a)*.24+.02,-.25]);}
    const nose=[0,.14,-.98],rear=[0,0,.82];
    for(let k=0;k<6;k++){
      const a=ring[k],b=ring[(k+1)%6],shade=a[1]+b[1]>.1?body:belly;
      pushTriangle(nose,b,a,shade);pushTriangle(rear,a,b,k%2?feather:shade);
    }
    pushTriangle([0,.34,-.92],[-.15,.16,-1.02],[.15,.16,-1.02],body);
    pushTriangle([0,.34,-.92],[.15,.16,-1.02],[0,.2,-.66],body);
    pushTriangle([0,.34,-.92],[0,.2,-.66],[-.15,.16,-1.02],body);
    pushTriangle([0,.2,-1.36],[-.08,.2,-1.0],[.08,.2,-1.0],beak);
    pushTriangle([0,.2,-1.36],[.08,.2,-1.0],[0,.12,-1.0],beak);
    pushTriangle([0,.2,-1.36],[0,.12,-1.0],[-.08,.2,-1.0],beak);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const material=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,
      flatShading:true,fog:true});
    installBirdWingMotion(material,this.birdWingTime);
    this.birdMesh=new THREE.InstancedMesh(geometry,material,42);
    this.birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.birdMesh.frustumCulled=false;this.birdMesh.castShadow=false;
    this.scene.add(this.birdMesh);this.birdDummy=new THREE.Object3D();
    this.birds=[];
    const birdRand=seededRandom(49281);
    const shades=[0xffffff,0xc3dfe5,0xe6cda8,0xb3c7c7];
    for(let i=0;i<42;i++){
      const island=ISLANDS[i%ISLANDS.length];
      const angle=birdRand()*Math.PI*2;
      const distance=island.r*(.72+birdRand()*.64);
      this.birds.push({
        centerX:island.x+Math.cos(angle)*distance,
        centerZ:island.z+Math.sin(angle)*distance,
        y:20+birdRand()*29,
        offset:birdRand()*Math.PI*2,
        speed:.24+birdRand()*.19,
        radius:9+birdRand()*14,depth:8+birdRand()*13,
        size:.70+birdRand()*.56,
        tint:new THREE.Color(shades[i%shades.length])
      });
    }
    this.updateSeabirds(0);
  }
  updateSeabirds(time,observer=null){
    if(!this.birdMesh)return;
    const dummy=this.birdDummy;
    let visible=0;
    const max=natureBudget(this.detailTier).birds;
    for(const bird of this.birds){
      if(visible>=max)break;
      const pose=birdFlightPose(bird,time);
      if(observer&&Math.hypot(pose.x-observer.x,pose.z-observer.z)>390)continue;
      dummy.position.set(pose.x,pose.y,pose.z);
      dummy.rotation.set(0,pose.yaw,pose.bank);
      dummy.scale.setScalar(bird.size);dummy.updateMatrix();
      this.birdMesh.setMatrixAt(visible,dummy.matrix);
      this.birdMesh.setColorAt(visible,bird.tint);
      visible++;
    }
    this.birdMesh.count=visible;
    this.birdMesh.instanceMatrix.needsUpdate=true;
    if(this.birdMesh.instanceColor)this.birdMesh.instanceColor.needsUpdate=true;
  }
  /** Tiny drifting pollen near flowering coastal groves, drawn in one batch.
   * Entirely decorative: no shadows, colliders, physics or extra textures. */
  buildPollen(){
    const geometry=new THREE.TetrahedronGeometry(.12,0);
    const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,
      opacity:.64,depthWrite:false,fog:true});
    this.pollenMesh=new THREE.InstancedMesh(geometry,material,56);
    this.pollenMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pollenMesh.frustumCulled=false;this.pollenMesh.castShadow=false;
    this.scene.add(this.pollenMesh);
    const pollenRand=seededRandom(82177);
    const colors=[0xffe7aa,0xf6f6ca,0xc7eae4,0xffd4a2];
    this.pollen=[];
    for(const island of ISLANDS)for(let i=0;i<8;i++){
      const angle=pollenRand()*Math.PI*2,r=island.r*(.26+pollenRand()*.46);
      const x=island.x+Math.cos(angle)*r,z=island.z+Math.sin(angle)*r;
      const y=this.heightAt(x,z);
      if(y<2)continue;
      this.pollen.push({x,y:y+1.3+pollenRand()*1.8,z,
        size:.6+pollenRand()*1.3,
        tint:new THREE.Color(colors[i%colors.length])});
    }
    this.pollenDummy=new THREE.Object3D();
    this.updatePollen(0);
  }
  updatePollen(time,observer=null){
    if(!this.pollenMesh)return;
    const cap=natureBudget(this.detailTier).pollen;
    let count=0;
    for(let i=0;i<this.pollen.length&&count<cap;i++){
      const p=this.pollen[i];
      if(observer&&Math.hypot(p.x-observer.x,p.z-observer.z)>85)continue;
      const drift=pollenDrift(i,time);
      this.pollenDummy.position.set(p.x+drift.x,p.y+drift.y,p.z+drift.z);
      this.pollenDummy.scale.setScalar(p.size);this.pollenDummy.rotation.set(0,time*.2+i,0);
      this.pollenDummy.updateMatrix();
      this.pollenMesh.setMatrixAt(count,this.pollenDummy.matrix);
      this.pollenMesh.setColorAt(count,p.tint);count++;
    }
    this.pollenMesh.count=count;
    this.pollenMesh.instanceMatrix.needsUpdate=true;
    if(this.pollenMesh.instanceColor)this.pollenMesh.instanceColor.needsUpdate=true;
  }
  update(dt,time) {
    this.elapsed=time;
    // Two directional wave frequencies encoded in one tiled bump/albedo map.
    // Color responds to the existing sun/weather rather than adding costly reflections.
    this.waterTexture.offset.x=(time*.005)%1;this.waterTexture.offset.y=(time*.0027)%1;
    const seaLight=THREE.MathUtils.clamp(this.sun.intensity/2.65,.22,1.15);
    this.water.material.color.setRGB(.075+.07*seaLight,.27+.11*seaLight,.37+.13*seaLight);
    this.water.material.bumpScale=.105+Math.sin(time*.35)*.022;
    if(this.scene.fog?.color)this.waterSkyTint.value.copy(this.scene.fog.color);
    // One wave amplitude update per island; no particles or extra draw calls.
    for(const bands of this.coastByIsland.values())for(let i=0;i<bands.length;i++){
      bands[i].material.opacity=(i===0?.28:.17)*(0.86+.14*Math.sin(time*1.3+i));
    }
    if(this.fire)this.fire.scale.y=1+Math.sin(time*9)*.16;
    // Detalhes acompanham as casas quando elas viram impostor ao longe.
    if(this.cabinDetail&&this.villageCabins[0])this.cabinDetail.visible=this.villageCabins[0].visible;
    // Barcos balançam de leve: duas rotações por quadro, sem alocação.
    if(this.pierBoats)for(let i=0;i<this.pierBoats.length;i++){const boat=this.pierBoats[i];boat.rotation.z=Math.sin(time*.9+i*2.1)*.07;boat.rotation.x=Math.sin(time*.7+i)*.035;}
    // v1.7.2: V cresce morro abaixo; deslocar no sentido negativo faz a água
    // descer (antes ela subia a encosta).
    if(this.cascadeTexture)this.cascadeTexture.offset.y=1-(time*.42)%1;
    const elapsed=Math.max(0,dt);
    this.cloudTravel+=elapsed*this.cloudWind;this.cloudElapsed+=elapsed;
    if(shouldRefreshClouds(this.cloudElapsed,this.detailTier))this.updateClouds(this.cloudTravel);
    // GPU uniforms only: no per-blade geometry updates or extra draw calls.
    this.natureWind.time.value=time;
    this.natureWind.strength.value=natureGust(time,this.natureWeatherWind)*natureBudget(this.detailTier).wind;
    if(this.natureFocus)this.natureWind.player.value.set(this.natureFocus.x,this.natureFocus.z);
    this.birdWingTime.value=time;
    this.birdUpdateClock+=elapsed;
    if(this.birdUpdateClock>=natureBudget(this.detailTier).interval){
      this.birdUpdateClock=0;this.updateSeabirds(time,this.natureFocus);
    }
    this.pollenUpdateClock+=elapsed;
    if(this.pollenUpdateClock>=natureBudget(this.detailTier).interval*1.8){
      this.pollenUpdateClock=0;this.updatePollen(time,this.natureFocus);
    }
  }
}
function sceneAdd(scene,mesh){scene.add(mesh);}
