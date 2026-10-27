import * as THREE from 'three';
import { ISLANDS } from './config.js';
import { seededRandom, clamp } from '../utils/math.js';
import { obstacleCeiling } from '../utils/collision.js';
import { surfaceHeightAt,flattenVillageGround } from '../utils/surfaces.js';
import {terrainPalette} from './TerrainPalette.js';
import {TerrainTextureManager,terrainKind} from './TerrainTextureManager.js';
import {treeVariant,treeCrownPose} from './TreeVariation.js';
import {applyIslandVisibility,shouldRefreshClouds,wrappedCloudX} from './VisibilityBudget.js';
import {IslandDetailStream,ISLAND_DETAIL_PHASES} from './IslandDetailStream.js';
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
    this.forestTrees = [];this.forestRocks = [];this.foliageMeshes = [];
    this.foliageByIsland=new Map();this.grassByIsland=new Map();this.flowersByIsland=new Map();
    this.biomeAccentsByIsland=new Map();this.coastByIsland=new Map();
    this.terrainTextures=new TerrainTextureManager(renderer);
    this.detailTier='balanced';this.detailElapsed=Infinity;this.cloudElapsed=Infinity;
    this.cloudTravel=0;this.visibleIslandCount=ISLANDS.length;
    this.cloudWind=1;
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
  clearanceAt(x,z,radius=1) { return obstacleCeiling(x,z,radius,this.obstacles); }
  addObstacle(x,y,z,radius,height,type){
    this.obstacles.push({x,z,radius,bottom:y,top:y+height,type});
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
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2200,2200),new THREE.MeshPhongMaterial({color:0x287da2,shininess:115,specular:0xb6ebed,map:waterTexture,bumpMap:waterTexture,bumpScale:.095,transparent:false}));
    water.rotation.x=-Math.PI/2; water.position.y=-.9; water.receiveShadow=true;scene.add(water);
    for (const island of ISLANDS) this.buildIsland(island);
    this.flushFoliage();
    this.buildCoastalDetails(); this.buildWildGrass(); this.buildWildflowers(); this.buildBiomeAccents(); this.buildVillage(); this.buildVillageProps(); this.buildClouds(); this.buildSeabirds();
  }
  makeWaterTexture() {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#62b6c9';ctx.fillRect(0,0,256,256);
    for (let i=0;i<130;i++) { const x=rand()*256, y=rand()*256;
      ctx.strokeStyle=`rgba(214,254,250,${.07+rand()*.18})`;
      ctx.lineWidth=1+rand()*1.8;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+7,y-3,x+18+rand()*20,y);ctx.stroke(); }
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
        colors.push(c[0],c[1],c[2]);
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
    const amount=island.r>75?89:35;
    for(let i=0;i<amount;i++) {
      const a=rand()*Math.PI*2,d=Math.sqrt(rand())*island.r*.8;
      const x=island.x+Math.cos(a)*d,z=island.z+Math.sin(a)*d;
      if(island.name==='Ilha do Refúgio' && x>-22 && x<32 && z>-28 && z<34) continue;
      const y=this.heightAt(x,z);if(y<3)continue;
      if(rand()<.76)this.addTree(x,y,z,.7+rand()*1.25);
      else this.addRock(x,y,z,.8+rand()*1.5);
    }
    for(let i=0;i<24;i++) {
      const a=rand()*Math.PI*2,d=island.r*(.84+rand()*.13),x=island.x+Math.cos(a)*d,z=island.z+Math.sin(a)*d;
      this.addRock(x,this.heightAt(x,z),z,.6+rand()*1.3);
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
  }
  // Instância centenas de tufos sem centenas de draw calls.
  buildWildGrass() { this._buildGrassForIsland(ISLANDS[0]); }
  _buildGrassForIsland(island) {
    if(this.grassByIsland.has(island.name))return;
    const geometry=this._grassGeo??(this._grassGeo=new THREE.ConeGeometry(.21,.85,3));
    const material=this._grassMat??(this._grassMat=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}));
    const dummy=new THREE.Object3D();
    const rand=seededRandom(19001+ISLANDS.indexOf(island)*1709);
    {
      const count=island.r>70?220:115;
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
        dummy.position.set(x,y+.39,z);dummy.rotation.y=rand()*Math.PI*2;
        const scale=.55+rand()*1.7;dummy.scale.set(scale,scale*(.7+rand()*.8),scale);dummy.updateMatrix();
        mesh.setMatrixAt(placed,dummy.matrix);
        mesh.setColorAt(placed,new THREE.Color(palette[Math.floor(rand()*palette.length)]));
        placed++;
      }
      mesh.count=placed;mesh.instanceMatrix.needsUpdate=true;
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
      this.addObstacle(x,y,z,.33,3.55,'post');
    }
  }
  // Batch static vegetation into five draw groups instead of thousands of scene meshes.
  // The collision volumes remain identical to the procedural v0.7 terrain.
  addTree(x,y,z,size=1) {
    this.forestTrees.push({x,y,z,size,palette:Math.floor(rand()*leafPalette.length)});
    this.addObstacle(x,y,z,.82*size,5.2*size,'tree');
  }
  addRock(x,y,z,size) {
    this.forestRocks.push({x,y,z,size,palette:rand()>.5?0x829087:0x6c807a,rotation:rand()*6});
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
      broadleafCrowns:[new THREE.IcosahedronGeometry(1.4,0),new THREE.IcosahedronGeometry(1.1,0)],
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
      batch.castShadow=shadows;batch.computeBoundingSphere();
      this.scene.add(batch);this.foliageMeshes.push(batch);
      this.foliageByIsland.get(islandName).push(batch);
    };
    for(const island of [only]){
      const {trees,rocks}=buckets.get(island.name);
      this.foliageByIsland.set(island.name,[]);
      addBatch(woodGeometry,brown,trees,
        (t,d)=>{d.position.set(t.x,t.y+1.2*t.size,t.z);d.scale.setScalar(t.size);},null,true,island.name);
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
          t=>leafPalette[(t.palette+k)%leafPalette.length],k===0,island.name);
        addBatch(broadleafCrowns[k],crownMaterial,broadleaf,placeCrown,
          t=>leafPalette[(t.palette+k+1)%leafPalette.length],k===0,island.name);
      }
      // Sub-bosque instanciado: samambaias de duas tonalidades nas bordas das árvores.
      // Sem hitboxes novas, sem sombras extras e com descarte por ilha já existente.
      const fernGeo=this._fernGeo??(this._fernGeo=new THREE.ConeGeometry(.72,1.42,5));
      const fernMat=this._fernMat??(this._fernMat=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}));
      for(let layer=0;layer<2;layer++){
        addBatch(fernGeo,fernMat,trees,
          (t,d)=>{
            const angle=t.palette*1.57+layer*2.4;
            d.position.set(t.x+Math.cos(angle)*t.size*1.22,t.y+.40*t.size,t.z+Math.sin(angle)*t.size*1.22);
            d.rotation.y=angle;d.rotation.z=(layer===0?-.18:.2);
            d.scale.set(.75*t.size,.64*t.size,.82*t.size);
          },
          t=>layer===0?0x377b56:leafPalette[t.palette],false,island.name);
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
      this.scene.add(group);
      this.addObstacle(x,y,z,Math.hypot(3*size,2.5*size),7.6*size,'cabin');
      Object.assign(this.obstacles.at(-1),{shape:'box',halfWidth:3*size,halfDepth:2.5*size});
      this.obstacles.at(-1).top=y+4.60*size;
      // Four-sided roof, matching the rotated square-pyramid mesh above.
      this.addObstacle(x,y+3.8*size,z,5.3*size,3.6*size,'cabin-roof');
      Object.assign(this.obstacles.at(-1),{shape:'polygon',sides:4,phase:Math.PI/4,radiusTop:.1*size});
    };
    cabin(-12,-14,1);cabin(-22,9,.8);cabin(21,-23,1.13);cabin(-32,-17,.76);
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
  }
  updateDetail(observer,dt=0){
    if(this.visualStreamingEnabled)this.detailStream.step(1);
    this.detailElapsed+=Math.max(0,dt);
    if(this.detailElapsed<.24)return;
    this.detailElapsed=0;
    // Stream photograph textures using existing 0.24s island visibility cadence.
    this.terrainTextures.updateFocus(observer,ISLANDS);
    if(this.visualStreamingEnabled)this.detailStream.plan(observer,this.detailTier);
    const state=applyIslandVisibility(observer,this.detailTier,ISLANDS,this.foliageByIsland,this.grassByIsland);
    for(const island of ISLANDS){
      const bloom=this.flowersByIsland.get(island.name);
      if(!bloom)continue;
      const grass=this.grassByIsland.get(island.name);
      bloom.visible=(grass?.visible??true)&&this.detailTier!=='economy';
      const accents=this.biomeAccentsByIsland.get(island.name);
      if(accents)accents.visible=this.foliageByIsland.get(island.name)?.[0]?.visible??true;
      bloom.count=this.detailTier==='balanced'?Math.ceil(bloom.userData.totalCount*.65):bloom.userData.totalCount;
    }
    this.visibleIslandCount=state.visible;
  }
  buildSeabirds() {
    // Merge a pair of wings once and instance the whole bird.
    // Formerly: 12 bird groups / 24 independent draw calls.
    // Now: one material + geometry, 12 moving instances, one draw call.
    const halves=[];
    for(const side of [-1,1]){
      const cone=new THREE.ConeGeometry(.25,2.5,3).toNonIndexed();
      cone.rotateZ(side*Math.PI/2);
      cone.translate(side*.95,0,0);
      halves.push(cone);
    }
    const geometry=new THREE.BufferGeometry();
    for(const [name,itemSize] of [['position',3],['normal',3],['uv',2]]){
      const length=halves.reduce((total,g)=>total+g.getAttribute(name).array.length,0);
      const data=new Float32Array(length);
      let offset=0;
      for(const half of halves){
        const part=half.getAttribute(name).array;
        data.set(part,offset);offset+=part.length;
      }
      geometry.setAttribute(name,new THREE.BufferAttribute(data,itemSize));
    }
    halves.forEach(half=>half.dispose());
    geometry.computeBoundingSphere();
    const material=new THREE.MeshBasicMaterial({color:0xe3faf9,side:THREE.DoubleSide});
    const count=12;
    this.birdMesh=new THREE.InstancedMesh(geometry,material,count);
    this.birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.birdMesh.frustumCulled=true;this.birdMesh.castShadow=false;
    this.scene.add(this.birdMesh);this.birdDummy=new THREE.Object3D();
    this.birds=[];
    for(let i=0;i<count;i++){
      this.birds.push({centerX:(rand()-.5)*250,y:38+rand()*28,centerZ:(rand()-.5)*230,
        offset:rand()*6.2,speed:2+rand()*2});
    }
    this.updateSeabirds(0);
    // Bird flights orbit up to 18 world units around their initial position.
    // The enlarged static bounds remain valid without per-frame sphere rebuilds.
    this.birdMesh.computeBoundingSphere();
    this.birdMesh.boundingSphere.radius+=36;
  }
  updateSeabirds(time){
    const dummy=this.birdDummy;
    for(let i=0;i<this.birds.length;i++){
      const bird=this.birds[i],angle=time*.18*bird.speed+bird.offset;
      dummy.position.set(bird.centerX+Math.cos(angle)*18,bird.y,bird.centerZ+Math.sin(angle)*18);
      dummy.rotation.set(0,-angle,0);
      dummy.scale.set(1,1,1);
      dummy.updateMatrix();
      this.birdMesh.setMatrixAt(i,dummy.matrix);
    }
    this.birdMesh.instanceMatrix.needsUpdate=true;
  }
  update(dt,time) {
    this.elapsed=time;this.waterTexture.offset.x=(time*.004)%1;this.waterTexture.offset.y=(time*.003)%1;
    if(this.fire)this.fire.scale.y=1+Math.sin(time*9)*.16;
    const elapsed=Math.max(0,dt);
    this.cloudTravel+=elapsed*this.cloudWind;this.cloudElapsed+=elapsed;
    if(shouldRefreshClouds(this.cloudElapsed,this.detailTier))this.updateClouds(this.cloudTravel);
    this.updateSeabirds(time);
  }
}
function sceneAdd(scene,mesh){scene.add(mesh);}
