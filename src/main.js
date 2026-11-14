// A Three.js dependency can be cached locally on first run by start_game.py.
// For static hosting without the local cache, test CDN mirrors before locking the import map.
const THREE_VERSION='0.180.0';
// v1.6.0: o Three.js r180 (MIT) é publicado junto com o jogo em /vendor.
// O jogo abre mesmo com as CDNs fora do ar; elas ficam apenas como reserva.
const THREE_CANDIDATES=[
  new URL('../vendor/three.module.js',import.meta.url).href,
  `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`,
  `https://unpkg.com/three@${THREE_VERSION}/build/three.module.js`,
];

async function resolveThree(){
  for(const url of THREE_CANDIDATES){
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),5500);
      let response;
      try{response=await fetch(url,{cache:'force-cache',signal:controller.signal});}
      finally{clearTimeout(timer);}
      if(!response.ok)continue;
      // The r180 browser module imports ./three.core.js. A half-populated
      // offline cache must never mask fully working CDN mirrors.
      if(url===THREE_CANDIDATES[0]){
        const core=new URL('../vendor/three.core.js',import.meta.url).href;
        const companion=await fetch(core,{cache:'force-cache',signal:controller.signal});
        if(!companion.ok)continue;
      }
      const type=response.headers.get('content-type')||'';
      if(type.includes('text/html'))continue;
      await response.arrayBuffer(); // Complete a leitura para aquecer o cache HTTP.
      // The fetch populates the HTTP cache. Import map is registered only once.
      const importmap=document.createElement('script');
      importmap.type='importmap';
      importmap.textContent=JSON.stringify({imports:{three:url}});
      document.head.append(importmap);
      return url;
    }catch(error){console.warn('Three.js não encontrado nesta origem:',url,error);}
  }
  throw new Error('Three.js 0.180.0 indisponível. Execute INICIAR-JOGO.bat conectado à internet para guardar uma cópia local. Verifique conexão, firewall ou CDN.');
}

function checkWebGL(){
  const canvas=document.createElement('canvas');
  let ctx=null;
  try{ctx=canvas.getContext('webgl2')||canvas.getContext('webgl');}catch{ /* browser disabled GPU */ }
  if(!ctx)throw new Error('WebGL indisponível. No Chrome/Edge, ative a aceleração gráfica e atualize o driver de vídeo.');
}

(async function boot(){
  try{
    checkWebGL();
    await resolveThree();
    const {Game}=await import('./game/Game.js');
    new Game();
  }catch(error){
    console.error('Falha ao iniciar Brumária: Elo dos Dragões:',error);
    const panel=document.getElementById('fatal');
    panel.classList.remove('hidden');
    panel.innerHTML='<h2>Não foi possível abrir o jogo</h2><p>Abra com <b>INICIAR-JOGO.bat</b> ou <b>python start_game.py</b>. Use uma conexão para baixar o Three.js na primeira execução; depois ele pode ser reutilizado offline. Para erro de WebGL, habilite aceleração gráfica. Consulte o arquivo de instruções.</p><pre></pre>';
    panel.querySelector('pre').textContent=String(error);
  }
})();
