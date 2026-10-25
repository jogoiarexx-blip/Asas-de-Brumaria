import * as THREE from 'three';
import {moveWithCollisions,obstacleBlocks} from '../utils/collision.js';
import {buildHero} from './heroVisual.js';
import {walkIntent,poseForHero} from './heroMotion.js';
import {cameraRelativeMove,shortestYawDelta} from '../game/cameraMovement.js';
import {groundFollow,terrainLean} from '../utils/groundPhysics.js';
import {HERO_GLB_URL,HERO_MODEL_FACING_YAW} from './heroAssetConfig.js';
import {loadOptionalHeroGLB,updateOptionalHeroGLB} from './heroAssetLoader.js';

export class Hero {
  constructor(scene,world,dragon) {
    this.world=world;this.dragon=dragon;
    this.group=buildHero();this.group.position.set(2,world.groundHeightAt(2,11,.52),11);scene.add(this.group);
    this.rider=buildHero();this.rider.position.set(0,.75,-.03);this.rider.rotation.y=0;
    // The mounted avatar must be exactly the same physical/visual size as on foot.
    // Do not shrink the player to make an undersized dragon appear rideable.
    this.rider.scale.setScalar(1);dragon.visual.add(this.rider);this.rider.visible=false;
    dragon.rider=this.rider; // Preserve the player when swapping dragon visuals.
    dragon.hero=this; // Refit saddle after either asynchronous GLB has loaded.
    this.mounted=false;this.walkTime=0;this.moveSpeed=0;this.fallVelocity=0;this.slopeClock=0;this.slope={pitch:0,roll:0};
    // HeroAssetUI owns auto-loading (bundled GLB or remembered import) so
    // concurrent loader calls never swap the meshes and skinned rigs twice.
    this.mountAnimationRemaining=0;this.dismountAnimationRemaining=0;
  }
  setMounted(value){
    if(this.mounted!==value){
      this.mountAnimationRemaining=value?.86:0;
      this.dismountAnimationRemaining=value?0:.77;
      if(value&&this.riderVisualReady){
        this.rider.rotation.x=0;this.rider.rotation.z=0;
      }
    }
    this.mounted=value;
    this.group.visible=!value;this.rider.visible=value;this.fallVelocity=0;
  }
  animate(model,pose,dt,now,mounted=false){
    const {legs,arms,cape,body,head}=model.userData;
    legs.forEach((leg,i)=>{
      const phase=i===0?1:-1;
      leg.hip.rotation.x=THREE.MathUtils.damp(leg.hip.rotation.x,mounted?-.73:pose.stride*phase,12,dt);
      leg.knee.rotation.x=THREE.MathUtils.damp(leg.knee.rotation.x,mounted?.86:Math.max(0,-pose.stride*phase)*.75+pose.footLift*.2,11,dt);
    });
    arms.forEach((arm,i)=>{
      const phase=i===0?-1:1;
      arm.shoulder.rotation.x=THREE.MathUtils.damp(arm.shoulder.rotation.x,mounted?-.7:pose.arm*phase,11,dt);
      arm.elbow.rotation.x=THREE.MathUtils.damp(arm.elbow.rotation.x,mounted?-.64:-.18,10,dt);
    });
    // Balanço secundário: deslocamento de peso, mãos e cotovelos.
    // Somente pivôs existentes; compatível com o modelo GLB opcional.
    const motion=mounted?Math.min(1,Math.abs(this.dragon?.speed||0)/28):Math.min(1,this.moveSpeed/9);
    arms.forEach((arm,i)=>{
      const side=i===0?-1:1;
      arm.shoulder.rotation.z=THREE.MathUtils.damp(arm.shoulder.rotation.z,
        mounted?side*(-.12-.08*motion):side*(.07+.07*motion),9,dt);
      arm.elbow.rotation.z=THREE.MathUtils.damp(arm.elbow.rotation.z,mounted?side*.09:side*.035,9,dt);
    });
    head.rotation.z=THREE.MathUtils.damp(head.rotation.z,
      mounted?-this.dragon.bank*.22:pose.sway*.13,5,dt);
    body.rotation.z=THREE.MathUtils.damp(body.rotation.z,mounted?-this.dragon.bank*.26+Math.sin(now*2)*.015:pose.sway,7,dt);
    body.scale.y=THREE.MathUtils.damp(body.scale.y,1+pose.breath,4,dt);
    const steer=mounted?(this.dragon?.turnAxis||0):0;
    head.rotation.y=THREE.MathUtils.damp(head.rotation.y,pose.headTurn-steer*.22,3,dt);
    // Rider anticipates maneuvers, but stays attached to the existing saddle rig.
    if(mounted){
      const climb=THREE.MathUtils.clamp((this.dragon?.verticalVelocity||0)/22,-1,1);
      const speed=THREE.MathUtils.clamp((this.dragon?.speed||0)/45,0,1);
      body.rotation.x=THREE.MathUtils.damp(body.rotation.x,.08-climb*.13+speed*.08,7,dt);
      cape.rotation.z=THREE.MathUtils.damp(cape.rotation.z,-(this.dragon?.bank||0)*.22,6,dt);
    }else{
      cape.rotation.z=THREE.MathUtils.damp(cape.rotation.z,pose.sway*.42,6,dt);
    }
    if(!mounted)body.rotation.x=THREE.MathUtils.damp(body.rotation.x,pose.bodyLean,7,dt);
    cape.rotation.x=THREE.MathUtils.damp(cape.rotation.x,pose.cape+Math.sin(now*(mounted?6:9))*.04,5,dt);
  }
  update(dt,input,time){
    if(this.mounted){
      this.moveSpeed=0;
      this.animate(this.rider,poseForHero(time,1,true,false),dt,time,true);
      // The GLB rider follows the mount's bank/pitch without changing hitboxes,
      // clipping through the saddle or accumulating transforms each frame.
      if(this.riderVisualReady){
        this.rider.rotation.z=THREE.MathUtils.damp(this.rider.rotation.z,-this.dragon.bank*.075,7,dt);
        this.rider.rotation.x=THREE.MathUtils.damp(this.rider.rotation.x,
          THREE.MathUtils.clamp(-this.dragon.verticalVelocity*.0025,-.065,.065),6,dt);
      }
      updateOptionalHeroGLB(this,dt);
      return;
    }
    const x=input.axis?.('a','d')??((input.isDown('d','arrowright')?1:0)-(input.isDown('a','arrowleft')?1:0));
    const z=input.axis?.('w','s')??((input.isDown('s','arrowdown')?1:0)-(input.isDown('w','arrowup')?1:0));
    const intent=walkIntent(x,z),slow=input.isDown('shift');
    // Always travel in the camera's horizontal plane, never along world axes.
    // The camera pitch cannot make the hero climb or descend.
    const direction=cameraRelativeMove(intent.x,intent.z,input.cameraYaw);
    let moving=intent.strength>.001;
    if(moving){
      const step=(slow?3.1:9)*intent.strength*dt;
      const dx=direction.x/intent.strength*step,dz=direction.z/intent.strength*step;
      const result=moveWithCollisions(this.group.position,{x:dx,z:dz},.52,this.world.obstacles,
        (px,pz)=>this.world.walkable(px,pz),
        o=>obstacleBlocks(o,this.group.position.y+1.1,1.1),
        {groundAt:(px,pz)=>this.world.groundHeightAt(px,pz,.52),maxStepUp:1.1});
      const vx=result.x-this.group.position.x,vz=result.z-this.group.position.z;
      this.moveSpeed=Math.hypot(vx,vz)/Math.max(dt,.001);
      moving=this.moveSpeed>.001;
      this.group.position.x=result.x;this.group.position.z=result.z;
      // Turn the body toward its real movement direction, not the map's -Z.
      const change=shortestYawDelta(this.group.rotation.y,direction.yaw);
      this.group.rotation.y+=change*Math.min(1,dt*13);
      this.walkTime+=dt*(slow?6.2:12.5)*intent.strength;
    } else this.moveSpeed=0;
    if(!moving)this.moveSpeed=0;
    const targetGround=this.world.groundHeightAt(this.group.position.x,this.group.position.z,.52);
    const contact=groundFollow({y:this.group.position.y,velocity:this.fallVelocity,target:targetGround,dt});
    this.group.position.y=contact.y;this.fallVelocity=contact.velocity;
    this.slopeClock+=dt;
    if(this.slopeClock>=.12){
      this.slopeClock=0;
      this.slope=terrainLean(this.group.position.x,this.group.position.z,(x,z)=>this.world.groundHeightAt(x,z,.52));
    }

    const pose=poseForHero(this.walkTime,moving?Math.min(1,this.moveSpeed/(slow?3.1:9)):0,false,!slow);
    this.animate(this.group,pose,dt,time);
    // Small slope lean affects the visual root, not its collision capsule.
    const root=this.group.userData.body;
    root.rotation.x=THREE.MathUtils.damp(root.rotation.x,pose.bodyLean+this.slope.pitch,5,dt);
    root.rotation.z=THREE.MathUtils.damp(root.rotation.z,pose.sway+this.slope.roll,5,dt);
    this.rider.rotation.x=THREE.MathUtils.damp(this.rider.rotation.x,0,8,dt);
    this.rider.rotation.z=THREE.MathUtils.damp(this.rider.rotation.z,0,8,dt);
    updateOptionalHeroGLB(this,dt);
  }
}
