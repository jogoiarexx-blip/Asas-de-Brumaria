/* Monte Seu Brutu's: catálogo visual independente de preço, estoque e pedidos.
   Mantenha os IDs em sincronia com o campo id dos ingredientes no painel. */
(function (root) {
  'use strict';
  const PREFIXO = new URL('./imagens/', root.document?.currentScript?.src || root.location?.href).href;
  const IMAGENS = Object.freeze({
    'mont-pao-brioche': {base:'pao-brioche-base.webp', topo:'pao-brioche-topo.webp'},
    'mont-pao-tradicional': {base:'pao-tradicional-base.webp', topo:'pao-tradicional-topo.webp'},
    'mont-pao-baguete': {base:'pao-baguete-base.webp', topo:'pao-baguete-topo.webp'},
    'mont-hamburguer-bovino':'hamburguer-bovino.webp',
    'mont-frango':'file-frango.webp',
    'mont-costela':'costela-desfiada.webp',
    'mont-queijo-cheddar':'cheddar.webp',
    'mont-queijo-mussarela':'mucarela.webp',
    'mont-alface':'alface.webp',
    'mont-tomate':'tomate.webp',
    'mont-cebola-roxa':'cebola-roxa.webp',
    'mont-maionese':'maionese.webp',
    'mont-barbecue':'barbecue.webp',
    'mont-molho-casa':'molho-casa.webp',
    'mont-bacon':'bacon.webp',
    'mont-ovo':'ovo.webp',
    'mont-cebola-caramelizada':'cebola-caramelizada.webp',
    'mont-catupiry':'catupiry.webp',
  });
  const GRUPO_ORDEM = Object.freeze(['proteina','queijo','extra','salada','molho']);
  const ESPESSURAS = Object.freeze({pao:36,proteina:35,queijo:21,extra:24,salada:20,molho:14});
  const escapeHtml=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function arquivo(id,parte) {
    const entrada=IMAGENS[id];
    return typeof entrada==='string' ? entrada : (parte ? entrada?.[parte] : entrada?.base);
  }
  function foto(id,parte) {
    const nome=arquivo(id,parte);
    return nome ? PREFIXO + nome : null;
  }
  function listaDeCamadas(selecionados) {
    const entradas=Array.isArray(selecionados)?selecionados:[];
    const pao=entradas.find((x)=>x.grupo==='pao' && x.quantidade>0 && foto(x.id,'base'));
    const grupos=GRUPO_ORDEM.flatMap((g)=>entradas.filter((x)=>x.grupo===g && Number(x.quantidade)>0));
    const componentes=[];
    for(const item of grupos){
      const origem=foto(item.id);
      if(!origem)continue;
      const n=Math.max(1,Math.min(10,Math.trunc(Number(item.quantidade)||1)));
      for(let j=0;j<n;j++)componentes.push({id:item.id,nome:item.nome,grupo:item.grupo,src:origem,indice:j,total:n,altura:ESPESSURAS[item.grupo]||20});
    }
    return {pao,componentes};
  }
  function render(selecionados, destaqueId='') {
    const {pao,componentes}=listaDeCamadas(selecionados);
    if(!pao){
      return '<div class="monte-camadas-vazio" role="img" aria-label="Lanche ainda vazio"><span>🍔</span><strong>Comece escolhendo um pão</strong><small>As fotos reais dos ingredientes vão aparecer aqui conforme você montar.</small></div>';
    }
    const soma=componentes.reduce((s,x)=>s+x.altura,0);
    const fator=Math.min(1,258/Math.max(1,soma));
    // Coordenadas no SVG: imagens 640×360 com conteúdo central, mantidas na mesma perspectiva.
    // As peças são sobrepostas, mostrando a lateral de cada camada, sem distorcer os sprites.
    let topo=227;
    let nivel=1;
    const pecas=[{src:foto(pao.id,'base'),nome:`Base: ${pao.nome}`,y:topo,nivel:nivel++,id:pao.id}];
    for(const comp of componentes){
      topo-=comp.altura*fator;
      pecas.push({src:comp.src,nome:`${comp.nome} (${comp.indice+1}/${comp.total})`,y:topo,nivel:nivel++,id:comp.id});
    }
    topo-=35;
    pecas.push({src:foto(pao.id,'topo'),nome:`Topo: ${pao.nome}`,y:topo,nivel:nivel++,id:pao.id});
    const nomes=selecionados.map((x)=>`${x.quantidade} porção(ões) de ${x.nome}`).join(', ');
    return `<div class="monte-camadas-fundo"><svg class="monte-camadas-svg" viewBox="0 0 640 545" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Prévia do seu lanche com ${escapeHtml(nomes)}" preserveAspectRatio="xMidYMid meet">
      <defs><radialGradient id="mont-sombra"><stop offset="0%" stop-color="#000" stop-opacity=".7"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="320" cy="510" rx="245" ry="20" fill="url(#mont-sombra)"/>
      ${pecas.map((p)=>`<image class="monte-camada-foto${p.id===destaqueId?' monte-camada-nova':''}" href="${p.src}" x="0" y="${Math.round(p.y)}" width="640" height="360" preserveAspectRatio="xMidYMid meet"><title>${escapeHtml(p.nome)}</title></image>`).join('')}
      </svg><div class="monte-camadas-legenda">${componentes.length+2} camadas visuais · imagens reais WebP</div></div>`;
  }
  root.BrutusCamadas = Object.freeze({IMAGENS,foto,listaDeCamadas,render});
})(typeof window!=='undefined'?window:null);
