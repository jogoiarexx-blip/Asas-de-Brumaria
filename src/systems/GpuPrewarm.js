import {TEXTURE_SLOTS} from './GraphicsWarmupPlan.js';

/** v1.6.0 — Prepara na GPU um objeto criado/carregado DURANTE o jogo (GLB de
 * NPC, região da montanha, guardiões) antes de ele aparecer na tela.
 *
 * Sem isto, o primeiro quadro que desenha o objeto envia todas as texturas e
 * compila os shaders de uma vez (medido: 3 texturas 2048² no mesmo quadro por
 * NPC). Aqui cada textura sobe em um quadro próprio e os programas são
 * compilados de forma assíncrona (KHR_parallel_shader_compile).
 * Nunca lança erro: em caso de falha o renderer normal assume. */
const nextFrame=()=>new Promise(resolve=>{
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>resolve());
  else setTimeout(resolve,0);
});

export function collectTextures(root){
  const textures=new Set();
  const visit=node=>{
    if(!node?.material)return;
    for(const material of Array.isArray(node.material)?node.material:[node.material]){
      if(!material)continue;
      for(const slot of TEXTURE_SLOTS){
        const texture=material[slot];
        if(texture?.isTexture&&(texture.image||texture.source?.data))textures.add(texture);
      }
    }
  };
  if(typeof root?.traverse==='function')root.traverse(visit);else visit(root);
  return [...textures];
}

export async function prewarmObject(renderer,root,{camera=null,scene=null,yieldFrame=nextFrame,report=null}={}){
  const stats=report??{textures:0,compiled:false,failures:[]};
  if(!renderer||!root)return stats;
  for(const texture of collectTextures(root)){
    try{
      if(typeof renderer.initTexture==='function'){renderer.initTexture(texture);stats.textures++;}
    }catch(error){stats.failures.push('textura: '+(error?.message??error));}
    await yieldFrame(); // uma textura por quadro
  }
  try{
    if(camera&&typeof renderer.compileAsync==='function'){
      await renderer.compileAsync(root,camera,scene??undefined);stats.compiled=true;
    }
  }catch(error){stats.failures.push('shader: '+(error?.message??error));}
  return stats;
}
