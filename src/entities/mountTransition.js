/** Deterministic 3D travel between on-foot and saddle, with no resize.
 * All coordinates must be in the SAME space; caller owns world/local mapping.
 * Output is a new point, never a mutation of a skinned model or collision box.
 */
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const MOUNT_TRANSITION_SECONDS=.86;
export const DISMOUNT_TRANSITION_SECONDS=.77;
export function mountTransitionPoint(start,end,elapsed,duration,{arc=.16}={}){
  const safeTime=Number.isFinite(elapsed)?elapsed:duration;
  const t=clamp(duration>0?safeTime/duration:1,0,1);
  // Smoothstep gives zero velocity at either end, avoiding a visible snap.
  const u=t*t*(3-2*t);
  const lift=arc*Math.sin(Math.PI*u);
  return {x:start.x+(end.x-start.x)*u,
    y:start.y+(end.y-start.y)*u+lift,
    z:start.z+(end.z-start.z)*u,
    done:t>=1,progress:t};
}
