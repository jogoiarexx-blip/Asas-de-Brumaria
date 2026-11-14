import * as THREE from 'three';

/** v1.7.2 — Asas de membrana para os dragões procedurais.
 * Substitui o triângulo chapado por um leque com borda recortada entre os
 * "dedos" e ossos finos. Tudo é gerado uma vez na construção do modelo;
 * a animação continua girando só as juntas existentes. */

/** Leque de triângulos a partir de `anchor`. Entre dois pontos da borda entra
 * um ponto intermediário puxado para a âncora (`depth` 0..1): o recorte da
 * membrana. `depth` pode ser um número ou uma lista por aresta. */
export function pushScallopedFan(out,anchor,rim,depth=.16){
  for(let i=0;i<rim.length-1;i++){
    const a=rim[i],b=rim[i+1],d=Array.isArray(depth)?(depth[i]??0):depth;
    if(d>0){
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
      const cut=[mid[0]+(anchor[0]-mid[0])*d,mid[1]+(anchor[1]-mid[1])*d-.02,mid[2]+(anchor[2]-mid[2])*d];
      out.push(...anchor,...a,...cut,...anchor,...cut,...b);
    }else out.push(...anchor,...a,...b);
  }
  return out;
}

/** Geometria não indexada (facetada) a partir da lista de triângulos. */
export function membraneFromTriangles(vertices){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

/** Asa completa de uma junta só (dragões selvagens). `side` = -1 ou 1.
 * Origem no ombro; +X aponta para fora, +Z para trás. */
export function wingLayout(side=1,span=3.4,chord=2.3){
  const p=(x,y,z)=>[side*x*span,y,z*chord];
  return {
    shoulder:p(0,0,0),elbow:p(.34,.1,-.16),wrist:p(.6,.16,-.3),
    fingers:[p(1,.02,-.06),p(.93,-.04,.5),p(.7,-.08,.86),p(.42,-.1,.98)],
    root:p(.04,-.08,.74)
  };
}
export function wingMembraneGeometry(side=1,span=3.4,chord=2.3){
  const w=wingLayout(side,span,chord),out=[];
  pushScallopedFan(out,w.wrist,w.fingers,.2);                       // mão
  pushScallopedFan(out,w.elbow,[w.wrist,w.fingers[3],w.root,w.shoulder],[0,.22,0]); // braço
  return membraneFromTriangles(out);
}

/** Osso fino entre dois pontos (cilindro orientado). */
export function boneBetween(a,b,material,radiusStart=.07,radiusEnd=.04,sides=5){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),length=from.distanceTo(to);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd,radiusStart,length,sides),material);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());
  mesh.castShadow=true;
  return mesh;
}
/** Ossos do braço e dos dedos para `wingLayout`. */
export function wingBones(side,material,span=3.4,chord=2.3){
  const w=wingLayout(side,span,chord);
  return [boneBetween(w.shoulder,w.elbow,material,.13,.1),boneBetween(w.elbow,w.wrist,material,.1,.08),
    ...w.fingers.map(tip=>boneBetween(w.wrist,tip,material,.065,.03))];
}
