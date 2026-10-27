import * as THREE from 'three';

/** Three intersecting tapered blades with a bent tip, all in one reusable
 *  instanced geometry. No per-frame vertex updates and no new draw calls. */
export function makeGrassTuftGeometry(){
  const positions=[],normals=[],uvs=[],indices=[],colors=[];
  const directions=[0,Math.PI*2/3,Math.PI*4/3];
  for(let blade=0;blade<3;blade++){
    const angle=directions[blade],base=positions.length/3;
    const tangent=[Math.cos(angle),Math.sin(angle)];
    const width=blade===1?.17:.23,lean=blade===2?.27:.16;
    const points=[[-width,0,0],[width,0,0],[-width*.58,.53,lean],[width*.58,.53,lean],[0,1.12,lean+.20]];
    for(const [side,height,forward] of points){
      positions.push(side*tangent[0]+forward*tangent[1],height,side*tangent[1]-forward*tangent[0]);
      normals.push(0,.4,1);uvs.push((side/width+1)*.5,height/1.12);
      // Vertex tint multiplies the per-instance bioma color: darker roots.
      const shade=height===0?.61:height<.7?.91:1.08;
      colors.push(shade,shade,shade);
    }
    indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

/** World-space micro color variation: sand, rock, moss and ash keep their
 *  original terrain topology, hitboxes, UV tiling and full-resolution textures. */
export function terrainColorGrain(x,z,y,seed,biome='meadow'){
  const broad=Math.sin(x*.11+seed*2.1)*Math.sin(z*.075-seed);
  const fine=Math.sin(x*.93+z*.37+seed)*Math.cos(z*.86-x*.29);
  const shore=y<2.7?-.045:0;
  const strength=biome==='ash'?.07:biome==='crystal'?.10:.095;
  return Math.max(.77,Math.min(1.13,1+strength*(broad*.55+fine*.45)+shore));
}

/** Shared low-poly, irregular canopy. Small geometric facets suggest leaves
 * without allocating a mesh for every twig or adding draw calls per tree. */
export function makeTreeCrownGeometry(radius=1,seed=0){
  const geometry=new THREE.IcosahedronGeometry(radius,1);
  const attr=geometry.getAttribute('position');
  for(let i=0;i<attr.count;i++){
    const x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);
    const n=Math.sin(x*6.1+seed*2.3)*Math.cos(z*5.3-seed*.8);
    const spread=1+.085*n;
    attr.setXYZ(i,x*spread,y*(1+.07*n),z*spread);
  }
  attr.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
