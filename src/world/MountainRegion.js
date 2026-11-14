import * as THREE from 'three';
import {BOAT_POSITIONS,GIANT_DRAGON_POSITION} from '../systems/ExpeditionRules.js';
import {bossDamageStage} from '../systems/AerialCombat.js';
import {shipDamageAppearance,shipDebrisStep,shipSinkingPose} from '../systems/ShipDamage.js';
import {bossMotionTarget,bossMotionStep} from '../systems/BossMotion.js';
import {bossBattleDestination} from '../systems/BossTactics.js';
import {shipWaterSplash,SHIP_SPLASH_START,SHIP_SPLASH_DURATION} from '../systems/ShipSplash.js';

// This entire module is dynamically imported ONLY while flying toward the gate.
// Its scene resources and collision volumes are released when leaving the zone.
export class MountainRegion {
  constructor(scene,world,progress){
    this.scene=scene;this.world=world;this.progress=progress;
    this.root=new THREE.Group();this.root.name='MAPA_MONTANHAS_SOMBRA';scene.add(this.root);
    this.obstacles=[];this.boats=[];this.boatSails=[];this.boatMasts=[];this.boatDecks=[];this.boatObstacles=[];this.boatDebrisAges=Array(BOAT_POSITIONS.length).fill(null);this.boatRippleAges=Array(BOAT_POSITIONS.length).fill(null);this.boss=null;this.elapsed=0;this.attackClock=0;this.bossHitFlash=0;
    this.buildTerrain();this.buildShips();this.buildBoss();this.refresh();
    world.obstacles.push(...this.obstacles);
  }
  heightAt(x,z){
    const dx=x-1042,dz=z-3,d=Math.hypot(dx,dz);
    if(d>=176)return -2;
    const band=Math.max(0,1-d*d/(176*176));
    const summit=48*Math.exp(-((x-1083)**2+(z+33)**2)/(65*65));
    const west=37*Math.exp(-((x-983)**2+(z-57)**2)/(43*43));
    const ridge=25*Math.exp(-((x-1127)**2+(z-73)**2)/(56*56));
    return -2+Math.pow(band,1.45)*(10+summit+west+ridge);
  }
  buildTerrain(){
    const steps=64,rings=18,positions=[],colors=[],indices=[];
    const low=new THREE.Color(0x36565a),mid=new THREE.Color(0x69736d),snow=new THREE.Color(0xd5dee6);
    for(let ring=0;ring<=rings;ring++){
      const radius=176*ring/rings;
      for(let k=0;k<=steps;k++){
        const a=2*Math.PI*k/steps,x=1042+Math.cos(a)*radius,z=3+Math.sin(a)*radius;
        const y=this.heightAt(x,z);
        positions.push(x,y,z);
        const color=y>36?snow:y>18?mid:low;
        colors.push(color.r,color.g,color.b);
        if(ring&&k){const i=ring*(steps+1)+k;indices.push(i,i-1,i-steps-1,i-1,i-steps-2,i-steps-1);}
      }
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    const landscape=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));
    landscape.receiveShadow=true;this.root.add(landscape);
    const water=new THREE.Mesh(new THREE.PlaneGeometry(730,700),new THREE.MeshLambertMaterial({color:0x1f7788,transparent:true,opacity:.87,depthWrite:false}));
    water.rotation.x=-Math.PI/2;water.position.set(1030,-2.15,0);this.root.add(water);
    // Few angular cliffs, not hundreds of imported textures/meshes.
    const stone=new THREE.MeshLambertMaterial({color:0x59626c,flatShading:true});
    // One GPU draw call for all decorative rocks, instead of one draw call
    // and one geometry allocation per cliff. Physics uses the same colliders.
    const rocks=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),stone,14);
    const dummy=new THREE.Object3D();let used=0;
    for(let i=0;i<14;i++){
      const a=i*2.4,r=35+(i*17)%113,x=1042+Math.cos(a)*r,z=3+Math.sin(a)*r;
      const h=this.heightAt(x,z);if(h<2)continue;
      const radius=4+i%4,peak=7+i%6*3;
      dummy.position.set(x,h+peak*.3,z);
      dummy.rotation.y=a;
      dummy.scale.set(radius,peak,radius);
      dummy.updateMatrix();rocks.setMatrixAt(used++,dummy.matrix);
      this.obstacles.push({x,z,radius:radius*.8,bottom:h,top:h+peak,type:'mountain-rock'});
    }
    rocks.count=used;rocks.castShadow=false;rocks.instanceMatrix.needsUpdate=true;
    this.root.add(rocks);this.rocksMesh=rocks;
    const beacon=new THREE.Mesh(new THREE.TorusGeometry(9,.55,8,36),new THREE.MeshBasicMaterial({color:0x8bf2e9}));
    beacon.position.set(806,55,35);beacon.rotation.y=Math.PI/2;this.root.add(beacon);this.entryBeacon=beacon;
  }
  /** Three enemy longships in the Mountains of Shadow.
   * Only their appearance changes: mission hitboxes, health, saves and
   * the sinking animation remain handled by the original systems.
   * All detailed hull/plank/sail geometry is built once per streamed map. */
  buildShips(){
    const hullMat=new THREE.MeshLambertMaterial({color:0x503329,side:THREE.DoubleSide,flatShading:true});
    const keelMat=new THREE.MeshLambertMaterial({color:0x33241e,flatShading:true});
    const plankMat=new THREE.MeshLambertMaterial({color:0x926a47,flatShading:true});
    const trimMat=new THREE.MeshLambertMaterial({color:0xc3995b,flatShading:true});
    const ironMat=new THREE.MeshLambertMaterial({color:0x414b50,flatShading:true});
    const sailMats=[0x8e3434,0x6b3549,0x8d5134].map(color=>
      new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide,flatShading:true}));
    const ropeMat=new THREE.MeshLambertMaterial({color:0xa18d6e});
    const foamMat=new THREE.MeshBasicMaterial({color:0xb9eced,transparent:true,opacity:.36,depthWrite:false,side:THREE.DoubleSide});
    const add=(parent,geo,mat,x=0,y=0,z=0)=>{
      const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
    };
    // Longship's broad midsection narrows toward raised, pointed bow/stern.
    // World ship length remains 14 units so the original hit area fits.
    const stations=[[-7,0.18,1.65],[-6.15,1.35,.65],[-4.9,2.15,-.05],
      [-2.7,2.65,-.2],[0,2.78,-.2],[2.7,2.65,-.2],[4.9,2.15,-.05],
      [6.2,1.25,.65],[7,0.18,1.65]];
    const hullVertices=[],hullIndices=[],boardVertices=[],boardIndices=[];
    for(const [x,width,lip] of stations){
      // Four points around each cross-section: gunwale, chine, keel, chine, gunwale.
      hullVertices.push(x,lip,width,x,-.62,width*.67,x,-1.55,0,x,-.62,-width*.67,x,lip,-width);
      boardVertices.push(x,lip+.025,width*1.008,x,lip-.26,width*.97,
        x,lip+.025,-width*1.008,x,lip-.26,-width*.97);
    }
    for(let i=0;i<stations.length-1;i++){
      for(let j=0;j<4;j++){const a=i*5+j,b=(i+1)*5+j;hullIndices.push(a,b,a+1,b,b+1,a+1);}
      for(let j=0;j<2;j++){const a=i*4+j*2,b=(i+1)*4+j*2;boardIndices.push(a,b,a+1,b,b+1,a+1);}
    }
    const makeGeo=(vertices,indices)=>{
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geo.setIndex(indices);geo.computeVertexNormals();return geo;
    };
    const hullGeo=makeGeo(hullVertices,hullIndices);
    const boardGeo=makeGeo(boardVertices,boardIndices);
    // Curved sail, tapered to its bottom corners, with a dark central emblem.
    const sailGeo=new THREE.BufferGeometry(),sailVertices=[],sailIndices=[];
    const sailSteps=6;
    for(let row=0;row<=sailSteps;row++){
      const t=row/sailSteps,y=4.8+t*8.2;
      const width=4.35*(.87+.13*Math.sin(t*Math.PI));
      for(let col=0;col<=6;col++){
        const u=col/6,z=(u*2-1)*width;
        const bulge=.47*Math.sin(u*Math.PI)*Math.sin(t*Math.PI);
        sailVertices.push(bulge,y,z);
        if(row&&col){const k=row*7+col;sailIndices.push(k,k-1,k-7,k-1,k-8,k-7);}
      }
    }
    sailGeo.setAttribute('position',new THREE.Float32BufferAttribute(sailVertices,3));
    sailGeo.setIndex(sailIndices);sailGeo.computeVertexNormals();
    const stripeGeo=new THREE.BoxGeometry(.075,.055,9);
    const railGeo=new THREE.BoxGeometry(12.5,.25,.19);
    const shieldGeo=new THREE.CylinderGeometry(.63,.63,.13,10);
    const hubGeo=new THREE.CylinderGeometry(.15,.15,.2,8);
    const ropeGeo=new THREE.CylinderGeometry(.033,.033,1,4);
    const frameGeo=new THREE.BoxGeometry(.16,.14,9.1);
    const mastGeo=new THREE.CylinderGeometry(.22,.31,14.2,7);
    const bowGeo=new THREE.ConeGeometry(.85,2.8,6);
    const seatGeo=new THREE.BoxGeometry(.33,.12,4.25);
    const finGeo=new THREE.ConeGeometry(.26,1.2,5);
    const setRigging=(parent,from,to)=>{
      const x=to[0]-from[0],y=to[1]-from[1],z=to[2]-from[2];
      const len=Math.hypot(x,y,z);
      const m=add(parent,ropeGeo,ropeMat,(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2);
      m.scale.y=len;
      // Align the thin rope along its segment without per-frame allocations.
      if(m.quaternion?.setFromUnitVectors)m.quaternion.setFromUnitVectors(
        new THREE.Vector3(0,1,0),new THREE.Vector3(x/len,y/len,z/len));
    };
    this.boatWakes=[];
    for(let i=0;i<BOAT_POSITIONS.length;i++){
      const [x,y,z]=BOAT_POSITIONS[i],group=new THREE.Group();group.position.set(x,y,z);
      group.name='NAVIO_INIMIGO_'+(i+1);
      add(group,hullGeo,hullMat);
      add(group,boardGeo,trimMat);
      const keel=add(group,new THREE.BoxGeometry(11.9,.28,.58),keelMat,0,-1.28,0);
      // Deck retains its original reference for damage-stage roll.
      const deck=new THREE.Group();deck.position.y=.35;group.add(deck);
      add(deck,new THREE.BoxGeometry(11.7,.18,4.55),plankMat);
      for(let n=-2;n<=2;n++)add(deck,new THREE.BoxGeometry(11.45,.035,.055),keelMat,0,.12,n*.82);
      for(const side of [-1,1]){
        add(deck,railGeo,trimMat,0,.48,side*2.4).rotation.y=Math.PI/2;
        for(let n=-5;n<=5;n+=2)add(deck,new THREE.BoxGeometry(.16,.72,.2),keelMat,n,.15,side*2.4);
        for(let n=0;n<4;n++){
          const pos=-4.4+n*2.9;
          const shield=add(group,shieldGeo,i===1?ironMat:i===2?trimMat:sailMats[i],pos,.56,side*2.57);
          shield.rotation.x=Math.PI/2;
          const boss=add(group,hubGeo,ironMat,pos,.56,side*2.68);boss.rotation.x=Math.PI/2;
        }
      }
      for(const pos of [-3.1,0,3.1])add(deck,seatGeo,keelMat,pos,.36,0);
      const prow=add(group,bowGeo,trimMat,-6.3,1.35,0);prow.rotation.z=-.4;
      const prowHead=add(group,new THREE.IcosahedronGeometry(.68,0),ironMat,-6.75,2.57,0);
      for(const side of [-1,1]){
        const horn=add(group,finGeo,trimMat,-6.83,3.05,side*.45);horn.rotation.z=-side*.25;
        add(group,new THREE.BoxGeometry(.2,.8,.18),keelMat,5.5,1,side*.75);
      }
      const stern=add(group,new THREE.BoxGeometry(.45,1.35,3.2),keelMat,5.7,1.18,0);
      const mast=add(group,mastGeo,keelMat,0,6.3,0);
      const sail=new THREE.Mesh(sailGeo,sailMats[i]);group.add(sail);
      // Sail scales from the middle so the established damage response remains visible.
      sail.position.y=-.2;
      for(const yLevel of [4.82,13.02])add(group,frameGeo,trimMat,.12,yLevel,0);
      for(const side of [-1,1]){
        setRigging(group,[0,12.8,0],[-5.7,.85,side*2.05]);
        setRigging(group,[0,12.8,0],[5.4,1.05,side*1.7]);
      }
      const flag=add(group,new THREE.PlaneGeometry(1.9,1.05),sailMats[i],0,14,1.0);
      flag.rotation.y=Math.PI/2;
      // Low-cost broad highlight around the waterline, no dynamic reflections.
      const wake=add(group,new THREE.TorusGeometry(5.5,.065,4,28),foamMat,0,-1.75,0);
      wake.rotation.x=Math.PI/2;wake.scale.set(1.22,.47,1);
      this.boatWakes.push(wake);
      this.boatDecks.push(deck);this.boatMasts.push(mast);
      group.rotation.y=.4+i*1.18;this.root.add(group);this.boats.push(group);this.boatSails.push(sail);
      // Preserve EXACT hit area used by aerial combat and saves.
      const obstacle={x,z,radius:7,bottom:2,top:17,type:'enemy-ship',shape:'box',halfWidth:7,halfDepth:3.8,angle:group.rotation.y};
      this.obstacles.push(obstacle);this.boatObstacles.push(obstacle);
    }
    // Pool the original fragments and water impact rings. No per-frame mesh creation.
    this.boatDebrisMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1.8,.7,1.1),plankMat,BOAT_POSITIONS.length*3);
    this.boatDebrisMesh.frustumCulled=false;this.boatDebrisMesh.visible=false;
    this.debrisDummy=new THREE.Object3D();
    for(let i=0;i<BOAT_POSITIONS.length*3;i++){
      this.debrisDummy.scale.set(0,0,0);this.debrisDummy.updateMatrix();
      this.boatDebrisMesh.setMatrixAt(i,this.debrisDummy.matrix);
    }
    this.root.add(this.boatDebrisMesh);
    const rippleGeometry=new THREE.TorusGeometry(1,.035,4,32);
    this.boatRipples=[];
    for(let i=0;i<BOAT_POSITIONS.length;i++){
      const material=new THREE.MeshBasicMaterial({color:0x9ae7f7,transparent:true,opacity:0,depthWrite:false});
      const ring=new THREE.Mesh(rippleGeometry,material);
      ring.position.set(BOAT_POSITIONS[i][0],-1.96,BOAT_POSITIONS[i][2]);
      ring.rotation.x=-Math.PI/2;ring.visible=false;
      this.root.add(ring);this.boatRipples.push(ring);
    }
  }
  buildBoss(){
    const group=new THREE.Group();group.position.set(GIANT_DRAGON_POSITION.x,GIANT_DRAGON_POSITION.y,GIANT_DRAGON_POSITION.z);
    const scales=new THREE.MeshStandardMaterial({color:0x402744,metalness:.12,roughness:.75,flatShading:true,emissive:0x8f223f,emissiveIntensity:.02});
    this.bossScales=scales;
    const wingMat=new THREE.MeshLambertMaterial({color:0x8a3969,side:THREE.DoubleSide});
    const gold=new THREE.MeshBasicMaterial({color:0xf9a848});
    const body=new THREE.Mesh(new THREE.IcosahedronGeometry(12,1),scales);body.scale.set(1.5,.8,2.2);group.add(body);
    const head=new THREE.Mesh(new THREE.IcosahedronGeometry(6,1),scales);head.position.set(0,4,-19);group.add(head);
    const jaw=new THREE.Mesh(new THREE.ConeGeometry(3,10,6),scales);jaw.position.set(0,2,-25);jaw.rotation.x=-Math.PI/2;group.add(jaw);
    const eyeGeo=new THREE.SphereGeometry(1.2,7,6);
    for(const side of [-1,1]){
      const eye=new THREE.Mesh(eyeGeo,gold);eye.position.set(side*4,6,-22);group.add(eye);
      const horn=new THREE.Mesh(new THREE.ConeGeometry(2,9,5),scales);horn.position.set(side*3,10,-17);horn.rotation.z=-side*.25;group.add(horn);
    }
    this.wings=[];
    for(const side of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(side*9,5,0);group.add(pivot);
      const mesh=new THREE.Mesh(new THREE.ConeGeometry(11,32,3),wingMat);
      mesh.rotation.z=side*.9;mesh.position.set(side*14,1,0);pivot.add(mesh);this.wings.push({pivot,side});
    }
    const tail=new THREE.Mesh(new THREE.ConeGeometry(4,27,6),scales);tail.rotation.x=Math.PI/2;tail.position.z=20;group.add(tail);
    const crown=new THREE.Mesh(new THREE.TorusGeometry(14,.45,7,32),gold);crown.rotation.x=Math.PI/2;group.add(crown);
    // Three low-poly glowing scars share one geometry/material and appear
    // progressively as the boss loses health. No particles or lights added.
    this.bossDamageMarks=[];
    const scarGeometry=new THREE.BoxGeometry(9,.38,1.9);
    const scarMaterial=new THREE.MeshBasicMaterial({color:0xff805d});
    for(const [i,x,y,z] of [[0,-9,7,-2],[1,2,9,4],[2,10,6,10]]){
      const scar=new THREE.Mesh(scarGeometry,scarMaterial);
      scar.position.set(x,y,z);scar.rotation.y=i*.7;scar.rotation.z=i*.35-.25;
      scar.visible=false;group.add(scar);this.bossDamageMarks.push(scar);
    }
    const warningMaterial=new THREE.MeshBasicMaterial({color:0xff5c33,transparent:true,opacity:.86,depthWrite:false});
    const warning=new THREE.Mesh(new THREE.TorusGeometry(20,.65,6,48),warningMaterial);
    warning.rotation.x=Math.PI/2;warning.position.y=17;warning.visible=false;group.add(warning);
    this.bossWarningRing=warning;
    this.root.add(group);this.boss=group;
  }
  refresh(){
    this.boats.forEach((boat,i)=>{
      const health=this.progress.boatHealth[i];
      const appearance=shipDamageAppearance(health);
      const exists=appearance.visible;boat.visible=exists||this.boatDebrisAges[i]!==null;
      // Sails visibly tear after the first hit, instead of looking untouched.
      this.boatSails[i].scale.set(appearance.sailScale,appearance.sailScale,1);
      this.boatMasts[i].rotation.z=appearance.mastTilt;
      this.boatDecks[i].rotation.z=appearance.deckTilt;
      if(this.boatWakes?.[i])this.boatWakes[i].visible=exists;
      const hull=this.boatObstacles[i];if(hull){hull.top=exists?17:2;hull.bottom=exists?2:2;}
    });
    this.boss.visible=this.progress.phase==='boss';
    const stage=bossDamageStage(this.progress.bossHealth);
    for(let i=0;i<this.bossDamageMarks.length;i++)this.bossDamageMarks[i].visible=i<stage;
    this.bossScales.emissiveIntensity=.02+stage*.06;
  }
  notifyBoatHit(index,result){
    if(result?.hit&&result.sunk&&index>=0&&index<this.boatDebrisAges.length)
      {this.boatDebrisAges[index]=0;this.boatRippleAges[index]=0;}
  }
  flashBossHit(){this.bossHitFlash=.36;}
  setBossWarning(active,pattern='aimed'){
    if(!this.bossWarningRing)return;
    this.bossWarningRing.visible=Boolean(active)&&this.boss.visible;
    if(this.bossWarningRing.visible){
      const hex=pattern==='sweep'?0xd18aff:pattern==='fan'?0xffb547:pattern==='vertical'?0x99caff:0xff5c33;
      this.bossWarningRing.material.color.setHex(hex);
    }
  }
  update(dt,time,playerPosition=null){
    this.elapsed+=dt;
    this.bossHitFlash=Math.max(0,this.bossHitFlash-dt);
    if(this.bossScales)this.bossScales.emissiveIntensity=.02+bossDamageStage(this.progress.bossHealth)*.06+this.bossHitFlash*1.1;
    this.boats.forEach((boat,i)=>{
      const age=this.boatDebrisAges[i];
      if(age!==null){
        const sinking=shipSinkingPose(age);
        boat.visible=sinking.visible;
        boat.position.y=BOAT_POSITIONS[i][1]+sinking.offsetY;
        boat.rotation.z=(i%2?1:-1)*sinking.roll;
      }else if(this.progress.boatHealth[i]>0){
        boat.visible=true;
        boat.position.y=BOAT_POSITIONS[i][1]+Math.sin(time*1.7+i)*.5;
        boat.rotation.z=Math.sin(time*1.15+i*.8)*.038;
        boat.rotation.x=Math.sin(time*.85+i*1.4)*.026;
      }else boat.visible=false;
    });
    // Update at most nine transient fragments; no new meshes in the combat loop.
    let debrisActive=false,debrisChanged=false;
    for(let i=0;i<BOAT_POSITIONS.length;i++){
      const age=this.boatDebrisAges[i];
      // Static sunken/untouched boats need no matrix edits or GPU uploads.
      // On the final active tick we write invisible matrices once.
      if(age===null)continue;
      const nextAge=age+dt;
      this.boatDebrisAges[i]=nextAge;
      debrisChanged=true;
      for(let k=0;k<3;k++){
        const piece=shipDebrisStep(nextAge,k);
        const dummy=this.debrisDummy;
        if(piece.visible){
          debrisActive=true;const [x,y,z]=BOAT_POSITIONS[i];
          const angle=i*2.3+k*2.1;
          dummy.position.set(x+Math.cos(angle)*piece.spread,y+piece.sink,z+Math.sin(angle)*piece.spread);
          dummy.rotation.set(piece.spin*.35,piece.spin,angle);
          dummy.scale.set(piece.scale,piece.scale,piece.scale);
        }else dummy.scale.set(0,0,0);
        dummy.updateMatrix();this.boatDebrisMesh.setMatrixAt(i*3+k,dummy.matrix);
      }
      if(!shipDebrisStep(nextAge,0).visible)this.boatDebrisAges[i]=null;
    }
    // An age-based wave can outlive the collapsing hull; no save changes.
    for(let i=0;i<this.boatRipples.length;i++){
      let age=this.boatRippleAges[i];
      const ripple=this.boatRipples[i];
      if(age===null){ripple.visible=false;continue;}
      age+=dt;const appearance=shipWaterSplash(age);
      ripple.visible=appearance.visible;
      if(appearance.visible){
        ripple.scale.setScalar(appearance.radius);
        ripple.material.opacity=appearance.opacity;
      }
      this.boatRippleAges[i]=age>SHIP_SPLASH_START+SHIP_SPLASH_DURATION?null:age;
    }
    this.boatDebrisMesh.visible=debrisActive;
    if(debrisChanged)this.boatDebrisMesh.instanceMatrix.needsUpdate=true;
    if(this.boss.visible){
      const goal=playerPosition?bossBattleDestination(time,this.progress.bossHealth,playerPosition):bossMotionTarget(time,this.progress.bossHealth);
      const position=bossMotionStep(this.boss.position,goal,dt,{
        charging:this.bossWarningRing.visible,stagger:this.bossHitFlash});
      this.boss.position.set(position.x,position.y,position.z);
      this.boss.rotation.y=Math.sin(time*.22)*.19;
      for(const {pivot,side} of this.wings)pivot.rotation.z=side*(.25+Math.sin(time*2)*.25);
      if(this.bossWarningRing.visible)this.bossWarningRing.rotation.z+=dt*2.5;
    }
  }
  unload(){
    // Hulls, sails and rocks share GPU resources: dispose each unique object once.
    const disposed=new Set();
    const release=resource=>{if(resource&&!disposed.has(resource)){
      disposed.add(resource);resource.dispose();
    }};
    this.root.traverse(obj=>{
      release(obj.geometry);
      if(obj.material){for(const material of (Array.isArray(obj.material)?obj.material:[obj.material]))release(material);}
    });
    this.root.parent?.remove(this.root);
    const set=new Set(this.obstacles);this.world.obstacles=this.world.obstacles.filter(item=>!set.has(item));
    if(this.world.mountainRegion===this)this.world.mountainRegion=null;
  }
}
