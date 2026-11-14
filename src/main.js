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

// GitHub Pages can occasionally reply 503 even after a successful deployment.
// A failed dynamic import is remembered by the browser for that URL: retry with
// a distinct query so a transient 503 does not poison the entire session.
const GAME_MODULE=new URL('./game/Game.js',import.meta.url).href;
const GAME_MODULE_MIRROR='https://cdn.jsdelivr.net/gh/jogoiarexx-blip/Asas-de-Brumaria@main/src/game/Game.js';
const BOOT_RETRY_DELAYS=[0,600,1400];
const bootSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function bootStatus(message){
  const status=document.getElementById('menu-load-status');
  if(status)status.textContent=message;
}

async function checkGameResponse(url,cache){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(url,{cache,signal:controller.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status} ao carregar ${new URL(url).pathname}`);
    const type=(response.headers.get('content-type')||'').toLowerCase();
    if(type.includes('text/html'))throw new Error(`O servidor devolveu HTML em vez do módulo: ${new URL(url).pathname}`);
    await response.arrayBuffer(); // Leitura completa antes do import dinâmico.
  }finally{clearTimeout(timer);}
}

async function loadGameModule(){
  let lastError=null;
  for(let attempt=0;attempt<BOOT_RETRY_DELAYS.length;attempt++){
    if(attempt)await bootSleep(BOOT_RETRY_DELAYS[attempt]);
    const url=new URL(GAME_MODULE);
    if(attempt)url.searchParams.set('brumaria-retry',`1711-${attempt}-${Date.now()}`);
    bootStatus(attempt?`RECONECTANDO AO JOGO · TENTATIVA ${attempt+1}/3`:'CARREGANDO O MUNDO...');
    try{
      await checkGameResponse(url.href,attempt?'reload':'default');
      return await import(url.href);
    }catch(error){
      // Sintaxe defeituosa não é falha temporária de rede: mostrar a causa.
      if(error instanceof SyntaxError)throw error;
      lastError=error;
      console.warn(`Falha ao obter o jogo (tentativa ${attempt+1}):`,error);
    }
  }
  // Se a origem do GitHub Pages falhar, carrega os módulos da cópia pública
  // no jsDelivr. Imports relativos usam a mesma origem do espelho.
  bootStatus('GITHUB PAGES INDISPONÍVEL · TENTANDO SERVIDOR ALTERNATIVO...');
  try{
    await checkGameResponse(GAME_MODULE_MIRROR,'no-store');
    return await import(GAME_MODULE_MIRROR);
  }catch(error){
    console.warn('Servidor alternativo também indisponível:',error);
    throw new Error(`Não foi possível baixar os módulos do jogo. GitHub Pages: ${String(lastError)}. Servidor alternativo: ${String(error)}.`);
  }
}

(async function boot(){
  try{
    checkWebGL();
    await resolveThree();
    const {Game}=await loadGameModule();
    new Game();
  }catch(error){
    console.error('Falha ao iniciar Brumária: Elo dos Dragões:',error);
    const panel=document.getElementById('fatal');
    if(!panel)return;
    panel.classList.remove('hidden');
    panel.innerHTML='<h2>Não foi possível abrir Brumária</h2><p>O servidor pode estar temporariamente indisponível (HTTP 503), ou o navegador pode estar sem WebGL. Seus saves estão preservados. Tente novamente; se persistir, abra em outra rede ou verifique o status do GitHub Pages.</p><button type="button" id="retry-game-load">↻ TENTAR NOVAMENTE</button><pre></pre>';
    panel.querySelector('pre').textContent=String(error);
    panel.querySelector('#retry-game-load').addEventListener('click',()=>window.location.reload());
  }
})();
