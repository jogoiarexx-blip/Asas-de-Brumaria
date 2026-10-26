/** Third-person camera-relative travel, shared by the hero and mounted dragon.
 * Input axes: x=-left/+right, z=-forward/+back. +Y is never movement.
 * Camera yaw zero looks toward world -Z; positive yaw looks toward -X.
 * Pure math, independent of the camera's pitch and all game save state. */
export function cameraRelativeMove(x=0,z=0,cameraYaw=0){
  const a=Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0;
  const b=Number.isFinite(z)?Math.max(-1,Math.min(1,z)):0;
  const yaw=Number.isFinite(cameraYaw)?cameraYaw:0;
  const raw=Math.hypot(a,b);
  if(raw<.001)return {x:0,z:0,strength:0,yaw};
  const strength=Math.min(raw,1),ratio=strength/raw;
  const c=Math.cos(yaw),s=Math.sin(yaw);
  // Camera-local X points right and camera-local Z points backward.
  const dx=(a*c+b*s)*ratio;
  const dz=(-a*s+b*c)*ratio;
  return {x:dx,z:dz,strength,yaw:Math.atan2(-dx,-dz)};
}
export function shortestYawDelta(current,target){
  return Math.atan2(Math.sin(target-current),Math.cos(target-current));
}
/** Chase camera easing along the shortest angular arc (also across ±PI).
 * Manual orbit remains authoritative until Game releases its override. */
export function chaseCameraYaw(cameraYaw,actorYaw,dt,rate=4){
  if(!Number.isFinite(cameraYaw)||!Number.isFinite(actorYaw)||!Number.isFinite(dt)||dt<=0)return cameraYaw;
  const angle=shortestYawDelta(cameraYaw,actorYaw);
  const amount=1-Math.exp(-Math.max(0,rate)*Math.min(dt,.1));
  const yaw=cameraYaw+angle*amount;
  return Math.atan2(Math.sin(yaw),Math.cos(yaw));
}
/** Slow down while swinging around rather than sliding backward across the ground. */
export function steeringTraction(delta){
  return Math.max(0,Math.cos(delta));
}
