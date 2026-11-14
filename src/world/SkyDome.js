import * as THREE from 'three';

/** v1.6.0 — Céu em degradê com bruma no horizonte, halo do sol/lua e picos
 * distantes envoltos em névoa. Uma única esfera (1 draw call, sem texturas,
 * sem sombras, sem profundidade) que acompanha a câmera.
 *
 * As cores NÃO têm estado próprio: derivam de scene.background e scene.fog,
 * que o clima e o ciclo dia/noite já animam. Assim tempestade, entardecer e
 * noite continuam funcionando sem nenhuma regra nova. */
export const SKY_DOME_RADIUS=420;
const VERTEX=/* glsl */`
varying vec3 vDir;
void main(){
  vDir=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const FRAGMENT=/* glsl */`
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uGlow;
uniform float uPeaks;
uniform float uNight;
uniform float uTime;
varying vec3 vDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
}
float ridge(vec2 c,float scale,float seed){
  return noise(c*scale+seed)*0.6+noise(c*scale*2.3+seed*1.7)*0.28+noise(c*scale*5.1+seed)*0.12;
}
void main(){
  vec3 d=normalize(vDir);
  float h=d.y;
  vec3 col=mix(uHorizon,uZenith,pow(clamp(h,0.0,1.0),0.5));
  // Faixa de bruma: o horizonte funde com a neblina do mar.
  col=mix(col,uHorizon,exp(-abs(h)*11.0)*0.6);
  float s=max(dot(d,uSunDir),0.0);
  col+=uSunColor*(pow(s,64.0)*0.5+pow(s,7.0)*0.14)*uGlow;
  // v1.6.1 — aurora ao norte nas noites: cortinas ondulantes, só matemática.
  if(uNight>0.02){
    float ang=atan(d.x,-d.z);
    float band=smoothstep(0.1,0.28,h)*smoothstep(0.78,0.36,h)*smoothstep(2.0,0.5,abs(ang));
    float curtain=pow(sin(ang*5.0+uTime*0.11+sin(ang*2.3-uTime*0.07)*1.6)*0.5+0.5,3.0);
    float rays=0.55+0.45*noise(vec2(ang*42.0,uTime*0.22));
    vec3 aurora=mix(vec3(0.12,0.92,0.56),vec3(0.46,0.32,0.96),smoothstep(0.24,0.62,h));
    col+=aurora*band*curtain*rays*uNight*0.3;
  }
  // Picos distantes: duas camadas, sempre periódicas (ruído no círculo XZ).
  vec2 c=normalize(d.xz+vec2(1e-5));
  float far=0.016+ridge(c,2.6,11.0)*0.085;
  float near=0.006+ridge(c,4.2,37.0)*0.048;
  vec3 farCol=mix(uHorizon,uZenith,0.34);
  vec3 nearCol=mix(uHorizon,uZenith*0.62,0.5);
  col=mix(col,farCol,smoothstep(far+0.004,far-0.004,h)*0.42*uPeaks);
  col=mix(col,nearCol,smoothstep(near+0.003,near-0.003,h)*0.5*uPeaks);
  col=mix(col,uHorizon,smoothstep(0.012,-0.02,h));
  col+=(hash(gl_FragCoord.xy)-0.5)/255.0; // evita faixas no degradê
  gl_FragColor=vec4(col,1.0);
  // Sem tone mapping: no Three.js a neblina é aplicada depois dele, então o
  // horizonte só casa com o mar enevoado se o céu usar a cor pura da neblina.
  #include <colorspace_fragment>
}`;

/** Zênite derivado da cor do céu: mais profundo e azulado que o horizonte. */
export function zenithFromSky(sky,target=new THREE.Color()){
  return target.setRGB(sky.r*.2,sky.g*.42,sky.b*.9).lerp(sky,.1);
}

export class SkyDome {
  constructor(scene){
    this.scene=scene;
    this.uniforms={
      uZenith:{value:new THREE.Color(0x3f86c9)},uHorizon:{value:new THREE.Color(0xa3e2ed)},
      uSunDir:{value:new THREE.Vector3(0,1,0)},uSunColor:{value:new THREE.Color(0xffe2b0)},
      uGlow:{value:1},uPeaks:{value:1},uNight:{value:0},uTime:{value:0}
    };
    this.material=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:VERTEX,fragmentShader:FRAGMENT,
      side:THREE.BackSide,depthTest:false,depthWrite:false,fog:false,toneMapped:false});
    this.mesh=new THREE.Mesh(new THREE.SphereGeometry(SKY_DOME_RADIUS,32,20),this.material);
    this.mesh.name='CEU_BRUMARIA';this.mesh.renderOrder=-1000;this.mesh.frustumCulled=false;
    this.mesh.castShadow=false;this.mesh.receiveShadow=false;this.mesh.matrixAutoUpdate=true;
    scene.add(this.mesh);
    this._dir=new THREE.Vector3();
  }
  /** `sun`/`moon` são os astros existentes; `night` em 0..1 (opacidade das estrelas). */
  update(camera,{sun=null,moon=null,night=0,time=0}={}){
    this.mesh.position.copy(camera.position);
    this.uniforms.uNight.value=Math.max(0,Math.min(1,night));this.uniforms.uTime.value=time;
    const sky=this.scene.background,fog=this.scene.fog;
    if(sky?.isColor)zenithFromSky(sky,this.uniforms.uZenith.value);
    if(fog?.color)this.uniforms.uHorizon.value.copy(fog.color);
    const body=sun?.visible?sun:(moon?.visible?moon:null);
    if(body){
      this.uniforms.uSunDir.value.copy(this._dir.subVectors(body.position,camera.position).normalize());
      if(body===sun)this.uniforms.uSunColor.value.setRGB(1,.86,.66);
      else this.uniforms.uSunColor.value.setRGB(.55,.68,.95);
      this.uniforms.uGlow.value=body===sun?1-night*.6:.55;
    }else this.uniforms.uGlow.value=0;
  }
  dispose(){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.material.dispose();}
}
