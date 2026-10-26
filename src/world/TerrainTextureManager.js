import * as THREE from 'three';

/** Quality-aware locally hosted CC0 photo material loader.
 * Browser never talks to the texture provider and retains procedural
 * terrain colors/physics if a file is missing or WebP is unsupported.
 */
export const TERRAIN_KINDS=Object.freeze(['meadow','beach','stone','ash','crystal']);
export const TERRAIN_TEXTURE_ROOT='./assets/textures/terrain/';
export function textureTier(quality){
  return quality==='quality'?'desktop':'mobile';
}
export function terrainKind(island){
  if(island?.biome==='ash')return 'ash';
  if(island?.biome==='crystal')return 'crystal';
  if(island?.name==='Atol Esquecido')return 'beach';
  if(island?.name==='Antigo Farol')return 'stone';
  return 'meadow';
}
export function textureFile(kind,channel,tier){
  if(!TERRAIN_KINDS.includes(kind)||!['diff','normal'].includes(channel)
    ||!['mobile','desktop'].includes(tier))throw Error('Unknown terrain PBR map');
  return `${TERRAIN_TEXTURE_ROOT}${kind}_${channel}_${tier}.webp`;
}
export class TerrainTextureManager {
  constructor(){
    this.materials=new Map();
    this.loader=new THREE.TextureLoader();
    this.loading=new Map();this.resolved=new Map();
    this.tier=null;this.serial=0;this.failed=new Set();
  }
  register(kind,material){
    if(!TERRAIN_KINDS.includes(kind))throw Error('Unknown terrain kind');
    const group=this.materials.get(kind)??[];
    group.push(material);
    this.materials.set(kind,group);
    if(this.tier)this.applyToKind(kind,this.tier,this.serial);
  }
  async get(kind,channel,tier){
    const url=textureFile(kind,channel,tier);
    if(!this.loading.has(url)){
      const promise=this.loader.loadAsync(url).then(texture=>{
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        texture.colorSpace=channel==='diff'?THREE.SRGBColorSpace:THREE.NoColorSpace;
        texture.anisotropy=channel==='diff'?8:4;
        texture.generateMipmaps=true;
        texture.minFilter=THREE.LinearMipmapLinearFilter;
        texture.magFilter=THREE.LinearFilter;
        return texture;
      }).catch(error=>{
        if(!this.failed.has(url)){
          console.warn('[Terrain CC0] Procedural fallback for missing '+url,error?.message??error);
          this.failed.add(url);
        }
        return null;
      });
      this.loading.set(url,promise);
    }
    return this.loading.get(url);
  }
  async applyToKind(kind,tier,serial){
    const base=await this.get(kind,'diff',tier);
    // The normal map is reserved for the high-detail preset to save
    // texture bandwidth and GPU memory on mobile.
    const normal=base&&tier==='desktop'?await this.get(kind,'normal',tier):null;
    if(serial!==this.serial)return;
    for(const material of this.materials.get(kind)??[]){
      if(material.map!==base||material.normalMap!==normal){
        material.map=base;
        material.normalMap=normal;
        // Neutral photos multiplied by existing height and biome vertex
        // colors would be too dark without mild exposure compensation.
        material.color.setScalar(base?1.65:1);
        material.needsUpdate=true;
      }
    }
  }
  setQuality(quality){
    const tier=textureTier(quality);
    if(this.tier===tier)return;
    this.tier=tier;
    const serial=++this.serial;
    for(const kind of this.materials.keys())void this.applyToKind(kind,tier,serial);
  }
}
