import * as THREE from 'three';
import { approach, clamp, forwardFromYaw, seededRandom } from '../utils/math.js';
import {moveWithCollisions, obstacleBlocks} from '../utils/collision.js';
import {moveFlightWithCollisions} from '../utils/spatialSweep.js';
import {inspectLanding,flightCollisionResponse} from './LandingPhysics.js';
import {flightContactPose} from './FlightContact.js';
import {terrainAttitude,terrainTraction,visualContactHeight} from './TerrainResponse.js';
import {flightPhase, liftBlend} from './flightMath.js';
import {airflowTarget,airflowSpeed} from './Airflow.js';
import {wingPose} from './wingPose.js';
import {cameraRelativeMove,shortestYawDelta,steeringTraction} from '../game/cameraMovement.js';
import {updateDragonGLB} from './dragonAssetLoader.js';
import {batchRigidMeshes} from '../utils/rigBatch.js';
import {windDisplacement} from '../systems/dayCycleMath.js';
import {startDodge,advanceDodge,dodgeImpulse} from '../systems/AerialCombat.js';
import {steeringRate,bankTarget,flightPitch,tailYaw,landingDescent,smoothedTurn} from './flightHandling.js';
const scaleMesh = (geometry,material,x,y,z,sx=1,sy=1,sz=1) => {
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;return mesh;
};
function patternTexture(kind) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d'),random=seededRandom(kind==='wing'?7925:8214);
  ctx.fillStyle='#f0f4ee';ctx.fillRect(0,0,256,256);
  if(kind==='skin') {
    for(let y=-8;y<276;y+=22)for(let x=-8;x<275;x+=20){
      ctx.fillStyle='rgba(44,83,78,.095)';
      ctx.beginPath();ctx.ellipse(x+((y/22|0)%2)*10+random()*4,y+random()*3,7+random()*2,4,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.20)';ctx.lineWidth=1;ctx.stroke();
    }
  }else{
    for(let i=0;i<70;i++){
      ctx.lineWidth=.45+random()*.7;
      ctx.strokeStyle=`rgba(28,72,75,${.045+random()*.07})`;
      const x=random()*256,y=random()*256;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+9,y+24,x+20,y+44);ctx.stroke();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  if(kind==='skin')texture.repeat.set(1.5,1);
  texture.anisotropy=4;
  return texture;
}
export class Dragon {
  constructor(scene,world) {
    this.scene=scene;this.world=world;
    this.group=new THREE.Group();this.visual=new THREE.Group();this.group.add(this.visual);scene.add(this.group);
    this.group.position.set(8,world.groundHeightAt(8,7,1.65)+2.55,7);
    this.yaw=-.5;this.speed=0;this.airborne=false;this.riding=false;this.energy=100;this.fireCooldown=0;
    this.wings=[];this.tail=[];this.legs=[];this.forelegs=[];this.windStrength=0;this.windDrift=0;this.speciesId='furia_noite';this.stats=null;
    this.takeoffTime=0;this.landingTimer=0;this.verticalVelocity=0;this.steerInput=0;this.turnAxis=0;this.bank=0;this.pose='ground';this.attackTime=0;this.hurtTime=0;this.dodgeRemaining=0;this.dodgeCooldown=0;this.dodgeSide=1;this.impactCooldown=0;this.impactPulse=0;this.impactKick=0;this.contactPulse=0;this.contactKind=null;this.contactSpeed=0;this.createModel();
  }
  createModel() {
    const dark=new THREE.MeshStandardMaterial({color:0x172e3c,roughness:.7,metalness:.1});
    const bodyMat=new THREE.MeshStandardMaterial({color:0x254858,roughness:.65});
    const belly=new THREE.MeshStandardMaterial({color:0x397c7b,roughness:.7});
    const wingMat=new THREE.MeshStandardMaterial({color:0x236978,roughness:.7,side:THREE.DoubleSide,flatShading:true});
    const membrane=new THREE.MeshStandardMaterial({color:0x328b94,roughness:.65,side:THREE.DoubleSide,flatShading:true});
    bodyMat.map=patternTexture('skin');
    membrane.map=patternTexture('wing');
    const horn=new THREE.MeshStandardMaterial({color:0x83c2ae,roughness:.6});
    const eyeMat=new THREE.MeshStandardMaterial({color:0xa3f2e7,emissive:0x247776,emissiveIntensity:.28,roughness:.25});
    this.eyeGlowMaterial=eyeMat;
    const pupilMat=new THREE.MeshBasicMaterial({color:0x0b2531});
    const scaleMat=new THREE.MeshStandardMaterial({color:0x2c6e74,roughness:.82,metalness:.08});
    const spotMat=new THREE.MeshStandardMaterial({color:0x76c3b2,roughness:.72});
    this.colorMaterials={dark,bodyMat,belly,wingMat,membrane,horn,scaleMat,spotMat};
    this.visual.add(scaleMesh(new THREE.SphereGeometry(1,16,12),bodyMat,0,0,.25,1.15,.85,2));
    this.visual.add(scaleMesh(new THREE.SphereGeometry(1,12,10),belly,0,-.38,-.6,.78,.53,1.3));
    // Pescoço, cabeça, focinho e sobrancelhas
    this.visual.add(scaleMesh(new THREE.CylinderGeometry(.52,.8,2.3,10),bodyMat,0,.27,-1.72,1,1,1));
    this.headPivot=new THREE.Group();this.headPivot.position.set(0,.73,-2.77);this.visual.add(this.headPivot);
    // A cabeça tem pivô próprio, permitindo inclinação e olhar responsivo.
    const head=scaleMesh(new THREE.SphereGeometry(1,16,12),dark,0,0,0,.9,.78,1.15);
    this.headPivot.add(head);
    this.headPivot.add(scaleMesh(new THREE.SphereGeometry(1,14,9),bodyMat,0,-.30,-.71,.78,.42,.84));
    this.jawPivot=new THREE.Group();this.jawPivot.position.set(0,-.49,-.69);this.headPivot.add(this.jawPivot);
    this.jawPivot.add(scaleMesh(new THREE.SphereGeometry(1,12,8),dark,0,-.18,-.18,.72,.18,.81));
    // Duas arcadas pequenas acompanham mandíbula e crânio (sem animação por vértice).
    for(const side of [-1,1])for(let j=0;j<3;j++){
      const upper=scaleMesh(new THREE.ConeGeometry(.065,.24,5),horn,side*(.25+j*.16),-.51,-.7-j*.14);
      upper.rotation.x=Math.PI;this.headPivot.add(upper);
      const lower=scaleMesh(new THREE.ConeGeometry(.052,.18,5),horn,side*(.25+j*.15),-.025,-.15-j*.12);
      this.jawPivot.add(lower);
    }
    // Cristas cervicais em pivô próprio para reagir ao movimento de voo.
    this.neckCrest=new THREE.Group();this.neckCrest.position.set(0,.53,-1.6);this.visual.add(this.neckCrest);
    for(let j=0;j<5;j++)for(const side of [-1,1]){
      const crest=scaleMesh(new THREE.ConeGeometry(.11,.43+j*.045,5),horn,side*(.3+j*.065),.35-j*.055,-.7+j*.29);
      crest.rotation.z=side*.42;this.neckCrest.add(crest);
    }

    this.eyeBlink=[];this.pupils=[];this.brows=[];
    for(const side of [-1,1]) {
      const eyeRig=new THREE.Group();eyeRig.position.set(side*.61,.21,-.32);this.headPivot.add(eyeRig);
      eyeRig.add(scaleMesh(new THREE.SphereGeometry(1,12,10),eyeMat,0,0,0,.28,.31,.15));
      const pupil=scaleMesh(new THREE.SphereGeometry(1,10,8),pupilMat,side*.07,0,-.13,.13,.21,.07);
      eyeRig.add(pupil);this.pupils.push(pupil);this.eyeBlink.push(eyeRig);
      const brow=scaleMesh(new THREE.CapsuleGeometry(.105,.45,3,6),dark,side*.62,.65,-.30,.85,1,1);
      brow.rotation.z=side*.25;this.headPivot.add(brow);this.brows.push({brow,side});
      const ear=scaleMesh(new THREE.ConeGeometry(.32,1.2,5),dark,side*.68,1.3,-2.26);ear.position.y-=.73;ear.position.z+=2.77;ear.rotation.z=-side*.5;this.headPivot.add(ear);
      const antler=scaleMesh(new THREE.ConeGeometry(.17,.75,6),horn,side*.44,1.44,-2.05);antler.position.y-=.73;antler.position.z+=2.77;antler.rotation.z=-side*.25;this.headPivot.add(antler);
      const nostril=scaleMesh(new THREE.SphereGeometry(1,6,6),dark,side*.4,.61,-4.02,.1,.075,.07);nostril.position.y-=.73;nostril.position.z+=2.77;this.headPivot.add(nostril);
      // Quatro patas articuladas: as dianteiras dobram o punho durante o voo.
      const shoulder=new THREE.Group();shoulder.position.set(side*.89,-.31,-1.0);
      shoulder.add(scaleMesh(new THREE.SphereGeometry(1,10,8),bodyMat,0,-.34,0,.31,.58,.35));
      const wrist=new THREE.Group();wrist.position.set(side*.1,-.83,-.18);shoulder.add(wrist);
      wrist.add(scaleMesh(new THREE.SphereGeometry(1,10,8),dark,0,-.1,-.09,.26,.25,.32));
      for(let k=-1;k<=1;k++){
        const claw=scaleMesh(new THREE.ConeGeometry(.07,.33,5),horn,k*.18,-.28,-.29);
        claw.rotation.x=Math.PI/2;wrist.add(claw);
      }
      this.visual.add(shoulder);this.forelegs.push({shoulder,wrist,side});
      const hind=new THREE.Group();hind.position.set(side*.77,-.35,1.18);
      hind.add(scaleMesh(new THREE.SphereGeometry(1,10,8),bodyMat,0,-.17,0,.48,.69,.68));
      const paw=scaleMesh(new THREE.SphereGeometry(1,8,7),dark,0,-.85,-.25,.38,.22,.52);hind.add(paw);
      for(let claw=0;claw<3;claw++){
        const nail=scaleMesh(new THREE.ConeGeometry(.11,.39,5),horn,(claw-1)*.23,-.89,-.7);
        nail.rotation.x=-Math.PI/2;hind.add(nail);
      }
      this.visual.add(hind);this.legs.push({leg:hind,side});
      this.addWing(side,wingMat,membrane);
    }
    // REV visual: placas ósseas ventrais e pontas de chifre integradas ao rig.
    // Cada detalhe segue o pivô existente sem gerar geometria a cada quadro.
    const armorPlate=new THREE.SphereGeometry(1,8,6);
    const hornTip=new THREE.ConeGeometry(.12,.49,6);
    for(let i=0;i<8;i++){
      const z=-1.54+i*.46;
      const curve=Math.sqrt(Math.max(.12,1-Math.pow((z-.22)/2.65,2)));
      const plate=scaleMesh(armorPlate,belly,0,-.73*curve-.19,z,.62*curve,.095,.19);
      plate.rotation.x=-.1;this.visual.add(plate);
    }
    for(const side of [-1,1]){
      const tip=scaleMesh(hornTip,horn,side*.49,1.84,.22,.76,1,.76);
      tip.rotation.z=-side*.36;this.headPivot.add(tip);
      for(let i=0;i<5;i++){
        const ridge=scaleMesh(armorPlate,scaleMat,side*(.76+.065*Math.sin(i)),.34, -.8+i*.68,.23,.12,.27);
        ridge.rotation.z=side*.31;this.visual.add(ridge);
      }
    }
    // Escamas em fileiras de baixo relevo: acompanham a curvatura do dorso.
    this.scales=[];
    for(let row=0;row<6;row++)for(let col=-2;col<=2;col++) {
      const z=-1.2+row*.47, x=col*.36+(row%2)*.075;
      const t=(x/1.15)**2+((z-.25)/2)**2;
      if(t>.83)continue;
      const y=.85*Math.sqrt(1-t)+.055;
      const sc=scaleMesh(new THREE.OctahedronGeometry(.16,0),row%2?scaleMat:spotMat,x,y,z,.78,.32,1.3);
      sc.rotation.x=-.14;this.visual.add(sc);this.scales.push(sc);
    }
    // Faixas da sela e peitoral com silhueta própria.
    const harness=new THREE.MeshStandardMaterial({color:0x6c4c37,roughness:.95});
    for(const z of [-.35,.43]) {
      const band=new THREE.Mesh(new THREE.TorusGeometry(.94,.08,5,22,Math.PI*1.18),harness);
      band.rotation.x=Math.PI/2;band.rotation.z=Math.PI/2;
      band.position.set(0,.15,z);this.visual.add(band);
    }
    // Espinhos dorsais
    for(let i=0;i<7;i++){
      const spine=scaleMesh(new THREE.ConeGeometry(.23+(i<3?i*.03:0),.65,5),horn,0,.75-(i*.035),-1.2+i*.57);
      spine.rotation.x=-.15;this.visual.add(spine);
    }
    // Cadeia hierárquica de cinco ossos: cada segmento segue a rotação do anterior.
    let parent=this.visual;
    for(let i=0;i<6;i++){
      const joint=new THREE.Group();joint.position.set(0,i===0?-.08:0,i===0?1.65:.72);
      const radius=.55-i*.07;
      joint.add(scaleMesh(new THREE.SphereGeometry(1,10,8),i>3?dark:bodyMat,0,0,.35,radius,Math.max(.12,.4-i*.04),.62));
      parent.add(joint);this.tail.push(joint);parent=joint;
    }
    const fin=scaleMesh(new THREE.ConeGeometry(.48,1.35,5),wingMat,0,0,.76);fin.rotation.x=Math.PI/2;
    parent.add(fin);this.tailFin=fin;
    // Sela
    const saddle=new THREE.Mesh(new THREE.BoxGeometry(1.37,.28,1.15),new THREE.MeshLambertMaterial({color:0x79553d}));saddle.position.set(0,.84,0);saddle.castShadow=true;this.visual.add(saddle);
    const saddleEdge=new THREE.Mesh(new THREE.TorusGeometry(.66,.11,6,18),new THREE.MeshLambertMaterial({color:0xd4aa64}));saddleEdge.rotation.x=Math.PI/2;saddleEdge.scale.y=.7;saddleEdge.position.set(0,.86,.15);this.visual.add(saddleEdge);
    // Ornamentos da testa e chifres acompanham o movimento da cabeça.
    for(const side of [-1,1])for(let i=0;i<3;i++) {
      const ridge=scaleMesh(new THREE.ConeGeometry(.13-i*.018,.32-i*.045,5),horn,side*(.16+i*.18),.74-i*.035,-.26+i*.24);
      ridge.rotation.x=-.25;this.headPivot.add(ridge);
    }
    // Identidades próprias: Nimbo tem barbilhões e cristas, Brasa usa placas e chifres,
    // Raio apresenta lâminas aerodinâmicas. Cada conjunto acompanha os pivôs do dragão.
    this.speciesOrnaments={};
    const createAccents=(id,color)=>{
      const group=new THREE.Group();this.visual.add(group);
      const mat=new THREE.MeshStandardMaterial({color,roughness:.51,metalness:.23,emissive:color,emissiveIntensity:.10});
      if(id==='nimbo'){
        for(const side of [-1,1]){
          const feeler=new THREE.Mesh(new THREE.CylinderGeometry(.035,.085,1.35,6),mat);
          feeler.position.set(side*.67,-.13,-3.72);feeler.rotation.z=side*.8;feeler.rotation.x=.25;group.add(feeler);
          for(let i=0;i<3;i++){
            const fin=new THREE.Mesh(new THREE.ConeGeometry(.21,.7,5),mat);
            fin.position.set(side*(.7+i*.1),.56-i*.18,-1.45+i*.75);
            fin.rotation.z=side*.6;group.add(fin);
          }
        }
      }else if(id==='brasa'){
        for(const side of [-1,1]){
          const antler=new THREE.Mesh(new THREE.ConeGeometry(.23,1.65,5),mat);
          antler.position.set(side*.77,1.24,-2.61);antler.rotation.z=-side*.65;antler.rotation.x=.3;group.add(antler);
          for(let i=0;i<5;i++){
            const armor=new THREE.Mesh(new THREE.ConeGeometry(.29,.75,5),mat);
            armor.position.set(side*.43,.69-i*.07,-1.25+i*.77);armor.rotation.x=-.23;group.add(armor);
          }
        }
      }else if(id==='furia_luz'){
        // Smooth pale dorsal fins and characteristic swept-back ear fins.
        for(const side of [-1,1]){
          for(let i=0;i<4;i++){
            const crest=new THREE.Mesh(new THREE.ConeGeometry(.16,.58-i*.07,5),mat);
            crest.position.set(side*(.57+i*.12),.72-i*.11,-2.58+i*.69);
            crest.rotation.z=-side*.83;crest.rotation.x=-.48;group.add(crest);
          }
          const ear=new THREE.Mesh(new THREE.ConeGeometry(.24,1.12,6),mat);
          ear.position.set(side*.72,1.01,-2.76);
          ear.rotation.z=-side*1.12;ear.rotation.x=-.48;group.add(ear);
        }
      }else{
        for(const side of [-1,1]){
          for(let i=0;i<4;i++){
            const fin=new THREE.Mesh(new THREE.ConeGeometry(.28,1.05-i*.11,3),mat);
            fin.position.set(side*(.75+i*.1),.57,-2.43+i*.8);
            fin.rotation.z=-side*.86;fin.rotation.x=-.35;group.add(fin);
          }
          const stripe=new THREE.Mesh(new THREE.BoxGeometry(.09,.065,2.9),mat);
          stripe.position.set(side*.65,.58,-.68);group.add(stripe);
        }
      }
      // Distinct silhouettes: maritime fins, ember shoulder armor and
      // lightning swept blades. All geometry is static and species-switched.
      const finGeo=new THREE.ConeGeometry(.28,.95,5);
      for(const side of [-1,1]){
        if(id==='nimbo'){
          for(let k=0;k<3;k++){
            const web=new THREE.Mesh(finGeo,mat);
            web.position.set(side*(.7+k*.12),.18-k*.11,1.2+k*.66);
            web.rotation.z=-side*.72;web.rotation.x=.4;group.add(web);
          }
        }else if(id==='brasa'){
          for(let k=0;k<3;k++){
            const plate=new THREE.Mesh(new THREE.DodecahedronGeometry(.36-k*.055,0),mat);
            plate.scale.set(1.35,.48,1.65);
            plate.position.set(side*(.94+k*.09),.45,-.8+k*.8);
            group.add(plate);
          }
        }else if(id==='furia_luz'){
          for(let k=0;k<3;k++){
            const fin=new THREE.Mesh(new THREE.ConeGeometry(.17,.57-k*.09,5),mat);
            fin.position.set(side*(.72+k*.13),.57-k*.12,1.15+k*.56);
            fin.rotation.z=-side*.8;fin.rotation.x=-.3;group.add(fin);
          }
        }else{
          for(let k=0;k<3;k++){
            const blade=new THREE.Mesh(finGeo,mat);
            blade.scale.set(.62,1.4-k*.16,.55);
            blade.position.set(side*(.92+k*.17),.85-k*.07,.8+k*.7);
            blade.rotation.z=-side*1.05;blade.rotation.x=-.5;
            group.add(blade);
          }
        }
      }
      group.visible=id==='nimbo';this.speciesOrnaments[id]=group;
    };
    createAccents('nimbo',0x9de4c8);createAccents('brasa',0xffaf55);createAccents('raio',0xa7d9ff);createAccents('furia_luz',0xc3f1ff);
    this.muzzleGlow=new THREE.Mesh(new THREE.SphereGeometry(.24,8,6),new THREE.MeshBasicMaterial({color:0xffa852,transparent:true,opacity:.8,depthWrite:false}));
    this.muzzleGlow.position.set(0,-.4,-1.52);this.headPivot.add(this.muzzleGlow);this.muzzleGlow.visible=false;
    // Luz de identificação leve
    const light=new THREE.PointLight(0x69eee5,8,15,2);light.position.set(0,.65,-3.1);this.visual.add(light);this.accentLight=light;
    // Bake ONLY rigid geometry within its existing animated joint.
    // Pupils, eyebrows, glowing muzzle and all articulated pivots stay intact.
    let removed=0;
    const batch=(group,options)=>{removed+=batchRigidMeshes(group,options).removed;};
    for(const group of Object.values(this.speciesOrnaments))batch(group);
    batch(this.neckCrest);
    batch(this.jawPivot);
    batch(this.headPivot,{preserve:this.brows.map(({brow})=>brow)});
    for(const {shoulder,wrist} of this.forelegs){batch(wrist);batch(shoulder);}
    for(const {leg} of this.legs)batch(leg);
    for(const {wing,elbow,tip} of this.wings){batch(wing);batch(elbow);batch(tip);}
    batch(this.visual);
    this.rigidBatchedParts=removed;
  }
  addWing(side,wingMat,membrane) {
    // Three lightweight articulated joints instead of a single rigid triangular wing.
    // Every membrane panel shares its parent's pivot so the elbow really folds.
    const wing=new THREE.Group();wing.position.set(side*1.0,.44,.06);
    const sail=(points,indices,parent)=>{
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>[side*p[0],p[1],p[2]]),3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(points.flatMap(p=>[p[0]/5,(p[2]+1.6)/3.4]),2));
      geo.setAttribute('color',new THREE.Float32BufferAttribute(points.flatMap(p=>{const shade=.76+.2*(1-Math.min(1,p[0]/5));return [shade,shade,shade];}),3));
      geo.setIndex(indices);geo.computeVertexNormals();
      membrane.vertexColors=true;membrane.needsUpdate=true;
      const panel=new THREE.Mesh(geo,membrane);panel.castShadow=true;parent.add(panel);
      return panel;
    };
    const bone=(parent,a,b,r=.09)=>{
      const from=new THREE.Vector3(side*a[0],a[1],a[2]);
      const to=new THREE.Vector3(side*b[0],b[1],b[2]);
      const direction=to.clone().sub(from);
      const part=new THREE.Mesh(new THREE.CylinderGeometry(r*.72,r,direction.length(),6),wingMat);
      part.position.copy(from).add(to).multiplyScalar(.5);
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
      part.castShadow=true;parent.add(part);
    };
    const rootPoints=[[0,0,0],[1.2,.14,-.60],[2.10,.11,-.25],[2.05,-.10,.65],[1.55,-.13,1.25],[.85,-.05,1.0]];
    sail(rootPoints,[0,1,5,1,2,3,1,3,4,1,4,5],wing);
    bone(wing,rootPoints[0],rootPoints[1],.13);
    bone(wing,rootPoints[1],rootPoints[2],.09);
    bone(wing,rootPoints[0],rootPoints[5],.07);
    const elbow=new THREE.Group();elbow.position.set(side*2.07,.10,-.22);wing.add(elbow);
    const outerPoints=[[0,0,0],[1.1,.03,-.34],[2.56,.02,-1.0],[2.35,-.10,-.05],[1.98,-.16,.67],[1.55,-.15,.94],[1.18,-.20,1.33],[.62,-.18,1.03]];
    const outerPanel=sail(outerPoints,[0,1,7,1,2,3,1,3,4,1,4,5,1,5,6,1,6,7],elbow);
    bone(elbow,outerPoints[0],outerPoints[1],.10);
    bone(elbow,outerPoints[1],outerPoints[2],.07);
    bone(elbow,outerPoints[0],outerPoints[6],.06);
    const tip=new THREE.Group();tip.position.set(side*1.76,-.04,-.36);elbow.add(tip);
    const tipPoints=[[0,0,0],[1.21,-.04,-.51],[1.04,-.10,.62],[.5,-.12,1.05]];
    sail(tipPoints,[0,1,2,0,2,3],tip);
    bone(tip,tipPoints[0],tipPoints[1],.045);
    const wingClaw=scaleMesh(new THREE.ConeGeometry(.11,.53,5),this.colorMaterials?.horn??wingMat,side*1.1,.04,-.48);
    wingClaw.rotation.x=-Math.PI/2;tip.add(wingClaw);
    this.visual.add(wing);this.wings.push({wing,side,elbow,tip,outerPanel});
  }

  triggerAttack(){this.attackTime=.35;}
  triggerHurt(){this.hurtTime=.45;}
  setSpecies(id,preset){
    this.speciesId=id;this.speciesPreset=preset;
    for(const [kind,group] of Object.entries(this.speciesOrnaments))group.visible=(kind===id);
    this.muzzleGlow.material.color.setHex(id==='furia_luz'?0xc7f7ff:id==='raio'?0x94dfff:id==='brasa'?0xff7438:0x95ffe0);
    const colors=preset.colors;
    [this.colorMaterials.dark,this.colorMaterials.bodyMat,this.colorMaterials.belly,this.colorMaterials.wingMat,this.colorMaterials.membrane,this.colorMaterials.horn].forEach((mat,i)=>mat.color.setHex(colors[i]));
    this.wings.forEach(({wing})=>wing.scale.set(id==='furia_luz'?1.11:id==='raio'?1.17:id==='brasa'?.97:1,1,id==='furia_luz'?1.09:id==='brasa'?1.13:1));
    this.tailFin.scale.setScalar(id==='furia_luz'?.89:id==='raio'?1.25:id==='brasa'?1.5:1);
    this.headPivot.scale.setScalar(id==='furia_luz'?.88:id==='brasa'?1.12:id==='raio'?.93:1);
    this.colorMaterials.scaleMat.color.setHex(colors[1]).multiplyScalar(1.25);
    this.colorMaterials.spotMat.color.setHex(colors[5]).lerp(new THREE.Color(colors[1]),.45);
    this.accentLight.color.setHex(id==='furia_luz'?0xb9ebff:id==='brasa'?0xffa35d:id==='raio'?0x87c8ff:0x69eee5);
    this.accentLight.intensity=id==='furia_luz'?6:8;
    if(this.externalDragonModel){
      // Remember which species decorations belong to the current selection;
      // keep them hidden until the player restores the procedural dragon.
      const accents=new Set(Object.values(this.speciesOrnaments));
      for(const record of this.externalDragonModel.original){
        if(accents.has(record.obj))record.visible=record.obj.visible;
        record.obj.visible=false;
      }
    }
  }
  setStats(stats){
    const previous=this.stats?.maxEnergy??100;
    this.stats=stats;
    this.energy=Math.max(0,Math.min(stats.maxEnergy,this.energy+(stats.maxEnergy-previous)));
  }
  forward() { const {x,z}=forwardFromYaw(this.yaw);return new THREE.Vector3(x,0,z); }
  setWind(strength){this.windStrength=clamp(Number.isFinite(strength)?strength:0,0,1);}
  tryDodge(axis=0){
    const attempt=startDodge({riding:this.riding,airborne:this.airborne,
      energy:this.energy,cooldown:this.dodgeCooldown,axis,previousSide:this.dodgeSide});
    if(!attempt.ok)return false;
    this.energy-=attempt.cost;
    this.dodgeRemaining=attempt.duration;
    this.dodgeCooldown=attempt.cooldown;
    this.dodgeSide=attempt.side;
    return true;
  }
  mount() { this.riding=true;this.speed=0;this.steerInput=0;this.turnAxis=0; }
  dismount() { this.riding=false;this.dodgeRemaining=0;this.speed=0;this.airborne=false;this.verticalVelocity=0;this.takeoffTime=0;this.bank=0;this.steerInput=0;this.turnAxis=0; }
  update(dt,input,time) {
    this.fireCooldown=Math.max(0,this.fireCooldown-dt);
    this.impactCooldown=Math.max(0,this.impactCooldown-dt);
    this.impactKick=Math.max(0,this.impactKick-dt*2.6);
    const activeDodge=this.dodgeRemaining;
    const dodgeStep=activeDodge>0||this.dodgeCooldown>0
      ?advanceDodge({remaining:activeDodge,cooldown:this.dodgeCooldown},dt)
      :{remaining:0,cooldown:0};
    this.dodgeCooldown=dodgeStep.cooldown;
    this.attackTime=Math.max(0,this.attackTime-dt);this.hurtTime=Math.max(0,this.hurtTime-dt);
    if(this.riding) {
      const travel=input.axis?.('w','s')??((input.isDown('s','arrowdown')?1:0)-(input.isDown('w','arrowup')?1:0));
      const horizontalAxis=input.axis?.('a','d')??((input.isDown('d','arrowright')?1:0)-(input.isDown('a','arrowleft')?1:0));
      const relative=Number.isFinite(input.cameraYaw);
      const direction=relative?cameraRelativeMove(horizontalAxis,travel,input.cameraYaw):null;
      // On foot/ground: every WASD direction moves relative to the camera.
      // In the air S still brakes, preserving deliberate slow landings.
      const go=relative
        ?direction.strength>.12&&!(this.airborne&&travel>.12)
        :travel<-.12;
      const brake=relative?(this.airborne&&travel>.12):travel>.12;
      const targetYaw=direction?.yaw??this.yaw;
      const turn=relative
        ?(go?THREE.MathUtils.clamp(shortestYawDelta(this.yaw,targetYaw)/.65,-1,1):0)
        :-horizontalAxis;
      const boost=input.isDown('shift')&&this.energy>4&&(this.airborne||go);
      const maxSpeed=this.airborne?(boost?(this.stats?.boostSpeed??49):(this.stats?.flightSpeed??31)):(boost?17:(this.stats?.groundSpeed??11));
      const facing=relative&&go?steeringTraction(shortestYawDelta(this.yaw,targetYaw)):1;
      const effort=relative?Math.min(1,Math.max(.18,direction.strength)):Math.min(1,Math.max(.15,-travel));
      const targetSpeed=go?maxSpeed*effort*facing:(brake?0:(this.airborne?9:0));
      this.speed=approach(this.speed,targetSpeed,dt*(brake?39:go?24:13));
      const turnSpeed=steeringRate(this.speed,this.airborne);
      this.turnAxis=smoothedTurn(this.turnAxis,turn,dt);this.steerInput=this.turnAxis;
      this.yaw+=this.turnAxis*turnSpeed*dt;
      this.yaw=Math.atan2(Math.sin(this.yaw),Math.cos(this.yaw));
      const forward=this.forward();
      const up=input.isDown('space'),down=input.isDown('ctrl');
      if(up&&!this.airborne){
        this.airborne=true;this.takeoffTime=0;this.landingTimer=0;
        if(this.world.walkable(this.group.position.x,this.group.position.z)){
          this.contactPulse=1;this.contactKind='takeoff';this.contactSpeed=this.speed;
        }
      }
      const gust=this.airborne?windDisplacement(this.windStrength,time,dt,this.group.position.y-this.world.heightAt(this.group.position.x,this.group.position.z)): {x:0,z:0};
      this.windDrift=Math.hypot(gust.x,gust.z)/Math.max(dt,.001);
      const strafe=this.airborne?dodgeImpulse(this.yaw,this.dodgeSide,dt,activeDodge):{x:0,z:0};
      const horizontal={x:forward.x*this.speed*dt+gust.x+strafe.x,z:forward.z*this.speed*dt+gust.z+strafe.z};
      // Sample a small footprint when grounded. Slopes reduce traction but not flight speed.
      const groundPose=this.airborne?null:terrainAttitude(
        (x,z)=>this.world.groundHeightAt(x,z,1.65),
        this.group.position.x,this.group.position.z,this.yaw,1.35);
      if(groundPose){const grip=terrainTraction(groundPose);horizontal.x*=grip;horizontal.z*=grip;}
      if(this.airborne){
        // Sweep vertical and horizontal motion together. Testing only the old Y
        // let a dragon enter the column while climbing or diving in one frame.
        this.takeoffTime+=dt;
        const floorBefore=this.world.groundHeightAt(this.group.position.x,this.group.position.z,1.15)+2.58;
        const desired=airflowTarget({airborne:true,speed:this.speed,height:this.group.position.y-floorBefore,up,down});
        this.verticalVelocity=approach(this.verticalVelocity,desired,dt*(up?69:down?64:48));
        const attemptedVertical=this.verticalVelocity;
        const moved=moveFlightWithCollisions(this.group.position,
          {x:horizontal.x,y:this.verticalVelocity*dt,z:horizontal.z},1.15,1.65,
          this.world.obstacleGrid,(x,z)=>this.world.groundHeightAt(x,z,1.15));
        this.group.position.set(moved.x,moved.y,moved.z);
        const impact=flightCollisionResponse({speed:this.speed,
          blockedHorizontal:moved.blockedHorizontal,blockedVertical:moved.blockedVertical,
          verticalSpeed:this.verticalVelocity});
        if(moved.blockedVertical)this.verticalVelocity=0;
        if(moved.blockedHorizontal){this.speed=impact.speed;this.dodgeRemaining=0;}
        else this.speed=airflowSpeed(this.speed,this.verticalVelocity,dt,maxSpeed);
        if(impact.intensity>.16&&this.impactCooldown<=0&&
           (moved.blockedHorizontal||this.world.walkable(this.group.position.x,this.group.position.z))){
          this.impactPulse=impact.intensity;this.impactKick=impact.intensity;
          this.impactCooldown=.55;
        }
        else this.dodgeRemaining=dodgeStep.remaining;
        const floor=this.world.groundHeightAt(this.group.position.x,this.group.position.z,1.15)+2.58;
        if(this.group.position.y<=floor+.015){
          this.group.position.y=floor;
          const landing=inspectLanding({x:this.group.position.x,z:this.group.position.z,
            radius:1.15,speed:this.speed,verticalSpeed:attemptedVertical,
            groundAt:(x,z)=>this.world.groundHeightAt(x,z,1.15),
            walkable:(x,z)=>this.world.walkable(x,z),
            clearanceAt:(x,z,r)=>this.world.clearanceAt(x,z,r)});
          if(!up&&landing.safe){
            this.airborne=false;this.takeoffTime=0;this.verticalVelocity=0;this.landingTimer=.52;
            this.contactPulse=1;this.contactKind='landing';this.contactSpeed=this.speed;
          }else if(this.airborne){
            // Skim over unsafe surfaces until the pilot reduces speed or
            // finds a flat island; never land on water or a cliff edge.
            this.verticalVelocity=Math.max(0,this.verticalVelocity);
            this.group.position.y=Math.max(this.group.position.y,floor+.06);
          }
        }
      } else {
        this.dodgeRemaining=0;
        const moved=moveWithCollisions(this.group.position,horizontal,1.65,this.world.obstacleGrid,
          (x,z)=>this.world.walkable(x,z),
          o=>obstacleBlocks(o,this.group.position.y,1.65),
          {groundAt:(x,z)=>this.world.groundHeightAt(x,z,1.65),maxStepUp:1.65});
        this.group.position.x=moved.x;this.group.position.z=moved.z;
        if(moved.blocked)this.speed=Math.min(this.speed,4);
        this.group.position.y=Math.max(this.group.position.y,this.world.groundHeightAt(moved.x,moved.z,1.65)+2.58);
        this.verticalVelocity=0;this.landingTimer=Math.max(0,this.landingTimer-dt);
      }
      this.group.position.y=clamp(this.group.position.y,
        Math.max(2.7,this.world.groundHeightAt(this.group.position.x,this.group.position.z,1.15)+2.58),110);
      if(boost){this.energy=Math.max(0,this.energy-(this.stats?.drain??17)*dt);}else{this.energy=Math.min(this.stats?.maxEnergy??100,this.energy+(this.stats?.regen??12)*dt);}
      const bankGoal=bankTarget(this.turnAxis,this.speed,this.airborne,gust.x)+(this.dodgeRemaining>0?this.dodgeSide*.26:0)+(groundPose?.roll??0);
      this.bank=THREE.MathUtils.damp(this.bank,bankGoal,4.2,dt);
      this.visual.rotation.z=THREE.MathUtils.damp(this.visual.rotation.z,this.bank,5.5,dt);
      this.visual.rotation.x=THREE.MathUtils.damp(this.visual.rotation.x,flightPitch(this.verticalVelocity,this.airborne)+(up?-.075:down?.05:0)-this.impactKick*.12+(groundPose?.pitch??0),3.7,dt);
    } else {
      this.dodgeRemaining=0;
      this.windDrift=0;this.steerInput=0;this.turnAxis=smoothedTurn(this.turnAxis,0,dt);this.bank=THREE.MathUtils.damp(this.bank,0,3,dt);
      const floor=this.world.groundHeightAt(this.group.position.x,this.group.position.z,1.65)+2.58;
      this.group.position.y=THREE.MathUtils.damp(this.group.position.y,Math.max(2.7,floor),3,dt);
      this.energy=Math.min(this.stats?.maxEnergy??100,this.energy+(this.stats?.regen??12)*dt);
      this.landingTimer=Math.max(0,this.landingTimer-dt);
      // Even an unmounted dragon follows the safe ground's shallow slopes.
      const groundPose=terrainAttitude((x,z)=>this.world.groundHeightAt(x,z,1.65),
        this.group.position.x,this.group.position.z,this.yaw,1.35);
      this.visual.rotation.z=THREE.MathUtils.damp(this.visual.rotation.z,groundPose.roll,3,dt);
      this.visual.rotation.x=THREE.MathUtils.damp(this.visual.rotation.x,groundPose.pitch,3,dt);
    }
    this.group.rotation.y=this.yaw;
    const floorNow=Math.max(2.7,this.world.groundHeightAt(this.group.position.x,this.group.position.z,1.65)+2.58);
    this.pose=flightPhase(this.airborne,this.takeoffTime,this.group.position.y-floorNow,this.verticalVelocity<-.8,this.landingTimer);
    this.eyeGlowMaterial.emissiveIntensity=.25+(this.attackTime>0?.52:0)+
      (this.hurtTime>0?.42:0)+(this.airborne?.08:0);
    const wingLift=liftBlend(this.airborne,this.takeoffTime,this.landingTimer);
    const contact=flightContactPose({phase:this.pose,takeoffTime:this.takeoffTime,landingTimer:this.landingTimer});
    // Apply squash *and* gait bob once at the end; a second assignment previously erased it.
    const bob=this.riding?Math.sin(time*(3+this.speed*.07))*(this.airborne?.11:.025):Math.sin(time*2)*.09;
    for(const {wing,elbow,tip,side} of this.wings){
      const pose=wingPose({time,side,phase:this.pose,speed:this.speed,bank:this.bank,wingLift,climbing:this.verticalVelocity});
      wing.rotation.z=THREE.MathUtils.damp(wing.rotation.z,pose.shoulder-side*contact.wingFold,7,dt);
      wing.rotation.x=THREE.MathUtils.damp(wing.rotation.x,pose.twist,5,dt);
      wing.rotation.y=THREE.MathUtils.damp(wing.rotation.y,pose.sweep,5,dt);
      elbow.rotation.z=THREE.MathUtils.damp(elbow.rotation.z,pose.elbow,7,dt);
      elbow.rotation.x=THREE.MathUtils.damp(elbow.rotation.x,pose.elbowTwist,5,dt);
      tip.rotation.z=THREE.MathUtils.damp(tip.rotation.z,pose.wrist,8,dt);
      tip.rotation.y=THREE.MathUtils.damp(tip.rotation.y,pose.wristYaw,7,dt);
      tip.rotation.x=THREE.MathUtils.damp(tip.rotation.x,pose.glide?-.17:.01,6,dt);
    }
    for(let i=0;i<this.tail.length;i++){
      this.tail[i].rotation.y=THREE.MathUtils.damp(this.tail[i].rotation.y,tailYaw(this.steerInput,i,time),6,dt);
      this.tail[i].rotation.x=THREE.MathUtils.damp(this.tail[i].rotation.x,flightPitch(this.verticalVelocity,this.airborne)*(.28+i*.07),4,dt);
      this.tail[i].rotation.z=THREE.MathUtils.damp(this.tail[i].rotation.z,
        -this.bank*(.07+i*.04)+Math.sin(time*2.4-i*.46)*.012,3.6,dt);
    }
    for(const {shoulder,wrist,side} of this.forelegs){
      const step=this.riding&&!this.airborne?Math.sin(time*8+side*Math.PI)*Math.min(.21,this.speed*.02):0;
      shoulder.rotation.x=THREE.MathUtils.damp(shoulder.rotation.x,this.airborne?.47:this.pose==='takeoff'?.25:step,5.8,dt);
      wrist.rotation.x=THREE.MathUtils.damp(wrist.rotation.x,this.airborne?-.65:.02,7,dt);
    }
    this.neckCrest.rotation.z=THREE.MathUtils.damp(this.neckCrest.rotation.z,this.bank*.28,4,dt);
    for(const {leg,side} of this.legs)leg.rotation.x=THREE.MathUtils.damp(leg.rotation.x,this.pose==='takeoff'?.38:this.airborne?.27:this.pose==='landing'?-.13-contact.crouch*.4:(this.riding?Math.sin(time*9+side*2)*Math.min(.27,this.speed*.022):0),6,dt);
    this.headPivot.rotation.x=THREE.MathUtils.damp(this.headPivot.rotation.x,(this.airborne?-.065:Math.sin(time*1.6)*.04)-(this.attackTime>0?.18:0)+contact.headDip,8,dt);
    this.headPivot.rotation.y=Math.sin(time*.9)*.065;
    this.headPivot.rotation.z=THREE.MathUtils.damp(this.headPivot.rotation.z,
      -this.bank*.17+this.turnAxis*.06,6,dt);
    for(const pupil of this.pupils)pupil.position.x=(pupil.position.x<0?-1:1)*.07+Math.sin(time*.72)*.025;
    for(const {brow,side} of this.brows)brow.rotation.z=side*(.22+(this.pose==='takeoff'?-.14:Math.sin(time*.8)*.07));
    this.jawPivot.rotation.x=THREE.MathUtils.damp(this.jawPivot.rotation.x,this.attackTime>0?-.48:Math.sin(time*1.7)*.025,11,dt);
    this.muzzleGlow.visible=this.attackTime>.06;
    if(this.muzzleGlow.visible)this.muzzleGlow.scale.setScalar(1+(1-this.attackTime/.35)*1.4);
    this.visual.rotation.y=Math.sin(time*34)*this.hurtTime*.12;
    const blink=Math.sin(time*.65)**18;
    for(const eye of this.eyeBlink)eye.scale.y=Math.max(.065,1-.93*blink);
    this.visual.position.y=THREE.MathUtils.damp(this.visual.position.y,visualContactHeight(contact.offsetY,bob),12,dt);
    updateDragonGLB(this,dt);
  }
}
