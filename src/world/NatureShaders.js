/** GPU-only animation for instanced grass and bird wings. The root of each
 * grass blade stays pinned to terrain, and none of these visual effects
 * changes any gameplay hitbox. No CPU vertex uploads per frame. */
export function windShaderState(){
  return {
    time:{value:0},strength:{value:1},player:{value:{x:1e6,y:1e6}}
  };
}
export function installGrassWind(material,state){
  material.onBeforeCompile=shader=>{
    shader.uniforms.uNatureTime=state.time;
    shader.uniforms.uNatureStrength=state.strength;
    shader.uniforms.uNaturePlayer=state.player;
    shader.vertexShader='uniform float uNatureTime;\nuniform float uNatureStrength;\nuniform vec2 uNaturePlayer;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
  vec2 origin=instanceMatrix[3].xz;
  float blade=clamp(position.y/1.12,0.0,1.0);
  float tip=blade*blade;
  float gust=sin(uNatureTime*1.7+origin.x*.13+origin.y*.093);
  float breeze=sin(uNatureTime*.64+origin.x*.061-origin.y*.047);
  float proximity=1.0-smoothstep(0.0,3.9,length(origin-uNaturePlayer));
  vec2 playerAway=normalize(origin-uNaturePlayer+vec2(.00001,.00002));
  transformed.x+=(gust*.18+breeze*.08)*uNatureStrength*tip+proximity*playerAway.x*.29*tip;
  transformed.z+=(breeze*.13-gust*.04)*uNatureStrength*tip+proximity*playerAway.y*.29*tip;
#endif`);
  };
  material.customProgramCacheKey=()=> 'brumaria-grass-breeze-v156';
}
export function installBirdWingMotion(material,timeUniform){
  material.onBeforeCompile=shader=>{
    shader.uniforms.uBirdTime=timeUniform;
    shader.vertexShader='uniform float uBirdTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
  float tip=smoothstep(.3,2.9,abs(position.x));
  // Body remains steady while the wing tips flex. Long gentle glides are
  // followed by several short beats, with a phase per bird instance.
  float phase=uBirdTime*4.8+instanceMatrix[3].x*.037+instanceMatrix[3].z*.021;
  float flap=sin(phase)*(.64+.36*sin(uBirdTime*.61));
  transformed.y+=tip*tip*flap*1.05;
#endif`);
  };
  material.customProgramCacheKey=()=> 'brumaria-bird-wings-v156';
}
