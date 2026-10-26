/** Pure scene inventory. Traverses dormant enemies and effect meshes as well as
 * visible content. Work is deduplicated by material AND geometry shader flags. */
export const TEXTURE_SLOTS=Object.freeze([
  'map','normalMap','roughnessMap','metalnessMap','aoMap','alphaMap',
  'emissiveMap','bumpMap','displacementMap','lightMap','specularMap',
  'envMap','clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap',
  'transmissionMap','thicknessMap','sheenColorMap','sheenRoughnessMap'
]);

export function buildWarmupPlan(groups){
  const seen=new Map(),textures=new Set(),variants=[];
  for(const {name,roots} of groups){
    for(const root of roots??[]){
      if(!root)continue;
      const visit=mesh=>{
        if(!mesh.isMesh||!mesh.material||!mesh.geometry)return;
        const flags=[!!mesh.isSkinnedMesh,!!mesh.isInstancedMesh,
          !!mesh.isBatchedMesh,!!mesh.morphTargetInfluences,
          !!mesh.geometry.attributes?.color,!!mesh.receiveShadow,
          !!mesh.castShadow].map(Number).join('');
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        let selected=false;
        for(const material of materials){
          if(!material)continue;
          let signatures=seen.get(material);
          if(!signatures){signatures=new Set();seen.set(material,signatures);}
          if(signatures.has(flags))continue;
          signatures.add(flags);selected=true;
          for(const slot of TEXTURE_SLOTS){
            const tex=material[slot];
            if(tex?.isTexture && (tex.image||tex.source?.data))textures.add(tex);
          }
        }
        if(selected)variants.push({name,mesh});
      };
      if(typeof root.traverse==='function')root.traverse(visit);
      else{
        const walk=node=>{visit(node);for(const child of node.children??[])walk(child);};
        walk(root);
      }
    }
  }
  return {variants,textures:[...textures]};
}

/** One warm-up batch per task. A batch contains one or more shader variants. */
export function partitionWarmup(items,size=8){
  if(!Number.isInteger(size)||size<1)throw Error('Invalid shader batch size');
  const batches=[];
  for(let i=0;i<items.length;i+=size)batches.push(items.slice(i,i+size));
  return batches;
}
