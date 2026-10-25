/* Brutu's Delivery — Montador do Zero v2. Interface visual aprimorada. */
(function (root) {
  'use strict';
  if (!root || !root.document) return;
  const core = root.BrutusMontadorCore;
  if (!core) return;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const reais = (n) => Number(n || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const ORDEM_GRUPOS = ['pao','proteina','queijo','salada','molho','extra'];
  const PREVIEW_ORDEM = ['molho','salada','extra','queijo','proteina'];
  const passos = [
    { titulo:'1. Escolha o pão', grupos:['pao'], sub:'Escolha o pão que será a base do seu Brutu’s.' },
    { titulo:'2. Escolha suas proteínas', grupos:['proteina'], sub:'Selecione uma ou mais carnes ou proteínas.' },
    { titulo:'3. Escolha os queijos', grupos:['queijo'], sub:'Adicione os queijos que quiser, dentro do limite.' },
    { titulo:'4. Saladas e molhos', grupos:['salada','molho'], sub:'Monte o sabor do seu jeito com saladas e molhos.' },
    { titulo:'5. Extras e finalizar', grupos:['extra'], sub:'Feche sua receita com extras e revise antes de enviar.' },
  ];
  const emojis = { pao:'🥖', proteina:'🥩', queijo:'🧀', salada:'🥬', molho:'🥫', extra:'🥓' };
  const descricoes = {
    'mont-pao-brioche':'Pão macio, levemente adocicado e dourado.',
    'mont-pao-tradicional':'Pão clássico, leve e bem equilibrado.',
    'mont-pao-baguete':'Casquinha mais firme e interior macio.',
    'mont-hamburguer-bovino':'Hambúrguer bovino suculento e grelhado.',
    'mont-frango':'Filé de frango saboroso e grelhado.',
    'mont-costela':'Costela desfiada macia e marcante.',
    'mont-queijo-cheddar':'Queijo cheddar cremoso e intenso.',
    'mont-queijo-mussarela':'Muçarela derretida com sabor suave.',
    'mont-alface':'Folhas frescas e crocantes.',
    'mont-tomate':'Tomate fresco em rodelas.',
    'mont-cebola-roxa':'Cebola roxa fatiada, crocante e aromática.',
    'mont-maionese':'Maionese cremosa para finalizar.',
    'mont-barbecue':'Molho barbecue levemente adocicado.',
    'mont-molho-casa':'Molho da casa especial.',
    'mont-bacon':'Bacon crocante e defumado.',
    'mont-ovo':'Ovo frito na chapa.',
    'mont-cebola-caramelizada':'Cebola lentamente caramelizada.',
    'mont-catupiry':'Catupiry cremoso e marcante.',
  };
  const estilos = {
    'mont-pao-brioche':'brioche',
    'mont-pao-tradicional':'tradicional',
    'mont-pao-baguete':'baguete',
    'mont-hamburguer-bovino':'hamburguer-bovino',
    'mont-frango':'frango',
    'mont-costela':'costela',
    'mont-queijo-cheddar':'cheddar',
    'mont-queijo-mussarela':'mussarela',
    'mont-alface':'alface',
    'mont-tomate':'tomate',
    'mont-cebola-roxa':'cebola-roxa',
    'mont-maionese':'maionese',
    'mont-barbecue':'barbecue',
    'mont-molho-casa':'molho-casa',
    'mont-bacon':'bacon',
    'mont-ovo':'ovo',
    'mont-cebola-caramelizada':'cebola-caramelizada',
    'mont-catupiry':'catupiry',
  };

  function metaIngrediente(ing) {
    const id = String(ing?.id || '');
    return {
      emoji: emojis[ing?.grupo] || '🍔',
      descricao: descricoes[id] || `Ingrediente do grupo ${ing?.grupo || 'extra'}.`,
      visual: estilos[id] || String(ing?.grupo || 'extra'),
    };
  }

  function ordenarIngredientes(lista) {
    return [...lista].sort((a, b) => {
      const ga = ORDEM_GRUPOS.indexOf(a.grupo);
      const gb = ORDEM_GRUPOS.indexOf(b.grupo);
      if (ga !== gb) return ga - gb;
      return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }

  function ordenarPreview(lista) {
    return [...lista].sort((a, b) => {
      const ga = PREVIEW_ORDEM.indexOf(a.grupo);
      const gb = PREVIEW_ORDEM.indexOf(b.grupo);
      if (ga !== gb) return ga - gb;
      return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }


  function renderPecasPreview(ing, quantidade) {
    const meta = metaIngrediente(ing);
    const qtd = Math.max(1, Math.min(quantidade || 1, 3));
    const piece = (cls, n=qtd) => Array.from({ length:n }, (_, idx) => `<span class="monte-piece ${cls} p${idx+1}"></span>`).join('');
    switch (meta.visual) {
      case 'hamburguer-bovino': return piece('piece-patty', Math.max(1, Math.min(2, quantidade)));
      case 'frango': return piece('piece-frango', Math.max(1, Math.min(2, quantidade)));
      case 'costela': return piece('piece-costela', Math.max(2, Math.min(4, quantidade + 1)));
      case 'cheddar': return piece('piece-cheddar', 1);
      case 'mussarela': return piece('piece-mussarela', 1);
      case 'catupiry': return piece('piece-catupiry', Math.max(1, Math.min(2, quantidade)));
      case 'alface': return piece('piece-alface', Math.max(2, Math.min(4, quantidade + 1)));
      case 'tomate': return piece('piece-tomate', Math.max(2, Math.min(4, quantidade + 1)));
      case 'cebola-roxa': return piece('piece-cebola-roxa', Math.max(2, Math.min(4, quantidade + 1)));
      case 'maionese': return piece('piece-maionese', 1);
      case 'barbecue': return piece('piece-barbecue', 1);
      case 'molho-casa': return piece('piece-molho-casa', 1);
      case 'bacon': return piece('piece-bacon', Math.max(2, Math.min(4, quantidade + 1)));
      case 'ovo': return piece('piece-ovo', 1);
      case 'cebola-caramelizada': return piece('piece-cebola-caramelizada', Math.max(2, Math.min(4, quantidade + 1)));
      default: return piece(`piece-${meta.visual || ing.grupo}`, Math.max(1, Math.min(2, quantidade)));
    }
  }

  function renderCamadaPreview(ing, quantidade) {
    const meta = metaIngrediente(ing);
    return `<div class="monte-stack-layer monte-stack-${esc(meta.visual)} monte-group-${esc(ing.grupo)}" title="${esc(ing.nome)}">
      <div class="monte-stack-pieces">${renderPecasPreview(ing, quantidade)}</div>
      <span class="monte-stack-label">${esc(ing.nome)}${quantidade > 1 ? ` ×${quantidade}` : ''}</span>
    </div>`;
  }

  root.iniciarMonteLanche = function ({ getMenu, salvarItem, mostrarToast }) {
    const doc = root.document;
    const el = (id) => doc.getElementById(id);
    const overlay = el('monte-overlay');
    const launcher = el('monte-abrir');
    const chamada = launcher?.closest('.monte-chamada');
    if (!overlay || !launcher) return null;

    const stage = el('monte-stage');
    const visual = el('monte-visual');
    const btnPrev = el('monte-anterior');
    const btnNext = el('monte-proximo');
    const btnDone = el('monte-confirmar');

    let passo = 0;
    let selecao = {};
    let qtd = 1;
    let nota = '';
    let uidEdicao = null;
    let editando = false;
    let focoAntigo = null;

    const aberto = () => !overlay.classList.contains('hidden');
    const ingredientes = () => core.disponiveis(getMenu());
    const linhas = () => ingredientes().filter((i) => selecao[i.id] > 0).map((i) => ({ id:i.id, quantidade:selecao[i.id] }));
    const totalParcial = () => ingredientes().reduce((s, i) => s + Math.round(i.preco * 100) * (selecao[i.id] || 0), 0) / 100;

    function validarEtapa() {
      if (passo === 0 && ingredientes().filter((i) => i.grupo === 'pao').reduce((s, i) => s + (selecao[i.id] || 0), 0) !== 1) {
        return 'Escolha exatamente um pão para continuar.';
      }
      if (passo === 1 && !ingredientes().some((i) => i.grupo === 'proteina' && selecao[i.id] > 0)) {
        return 'Escolha pelo menos uma carne ou proteína.';
      }
      return '';
    }

    function fechar() {
      overlay.classList.add('hidden');
      if (editando) el('cart-overlay')?.classList.remove('hidden');
      else doc.body.style.overflow = '';
      if (focoAntigo?.isConnected) focoAntigo.focus();
    }

    function abrir(item) {
      if (core.configuracao(getMenu()).ativo !== true) {
        mostrarToast('O Monte Seu Lanche está desativado no momento.');
        return;
      }
      focoAntigo = doc.activeElement;
      editando = item?.montagem?.versao === 2 && item.produtoId === core.ID;
      uidEdicao = editando ? item.uid : null;
      passo = 0;
      ultimoDestaque = '';
      selecao = {};
      qtd = editando ? Math.min(20, Math.max(1, Number(item.quantidade) || 1)) : 1;
      nota = editando ? String(item.montagem.nota || '') : '';
      if (editando) {
        for (const i of item.montagem.itens || []) selecao[i.id] = i.quantidade;
      }
      el('cart-overlay')?.classList.add('hidden');
      overlay.classList.remove('hidden');
      doc.body.style.overflow = 'hidden';
      render();
      el('monte-fechar').focus();
    }

    function mudar(id, delta) {
      const ing = ingredientes().find((i) => i.id === id);
      if (!ing) return;
      if (ing.grupo === 'pao' && delta > 0) {
        for (const x of ingredientes().filter((i) => i.grupo === 'pao')) delete selecao[x.id];
      }
      const novo = Math.max(0, Math.min(ing.grupo === 'pao' ? 1 : core.limite(ing), (selecao[id] || 0) + delta));
      ultimoDestaque = delta > 0 ? id : '';
      if (novo) selecao[id] = novo;
      else delete selecao[id];
      render();
    }

    let ultimoDestaque = '';
    function renderVisual() {
      const escolhidos=ordenarIngredientes(ingredientes().filter((i)=>selecao[i.id]>0));
      const total=totalParcial();
      const produtos=escolhidos.map((i)=>({...i,quantidade:selecao[i.id]}));
      const camadas=root.BrutusCamadas;
      visual.innerHTML = `<div class="monte-preview-scene monte-preview-scene-fotos">
        ${camadas?.render ? camadas.render(produtos,ultimoDestaque) : '<p class="monte-ajuda">Prévia indisponível. Confira os ingredientes na lista.</p>'}
        <div class="monte-preview-list" aria-label="Ingredientes selecionados">${escolhidos.map((i)=>{
          const img=camadas?.foto(i.id, i.grupo==='pao'?'topo':undefined);
          return `<div class="monte-preview-item"><div class="monte-thumb monte-thumb-real">${img?`<img src="${img}" alt="" loading="lazy" decoding="async">`:`<span>${emojis[i.grupo]||'🍔'}</span>`}</div><div class="monte-preview-copy"><strong>${esc(i.nome)}</strong><small>${selecao[i.id]} × ${reais(i.preco)}</small></div></div>`;
        }).join('')||'<div class="monte-preview-empty-list">Ainda não há ingredientes selecionados.</div>'}</div>
      </div><strong>Seu Brutu’s exclusivo</strong><small>Fotos ilustrativas dos ingredientes reais que você escolheu.</small>
      <div class="monte-tags">${escolhidos.map((i)=>`<span>${esc(i.nome)} ×${selecao[i.id]}</span>`).join('')||'<span>Comece escolhendo o pão</span>'}</div>`;
      ultimoDestaque='';
      el('monte-preco-unitario').textContent=reais(total);
      el('monte-preco-vivo').textContent=reais(total*qtd);
      el('monte-total').textContent=reais(total*qtd);
      el('monte-quantidade').textContent=String(qtd);
    }

    function render() {
      const cfg = core.configuracao(getMenu());
      const disp = ingredientes();
      const disponiveis = new Set(disp.map((i) => i.id));
      for (const id of Object.keys(selecao)) if (!disponiveis.has(id)) delete selecao[id];

      el('monte-indicador').textContent = passos[passo].titulo;
      [...doc.querySelectorAll('[data-monte-passo]')].forEach((s, i) => s.classList.toggle('ativo', i === passo));
      btnPrev.hidden = passo === 0;
      btnNext.hidden = passo === passos.length - 1;
      btnDone.hidden = passo !== passos.length - 1;

      const agrupados = passos[passo].grupos.map((grupo) => {
        const lista = ordenarIngredientes(disp.filter((i) => i.grupo === grupo));
        const grupoNome = core.GRUPOS.find((g) => g.id === grupo)?.nome || grupo;
        return `<section class="monte-grupo"><h4>${esc(grupoNome)}</h4>
          ${lista.length ? lista.map((i) => {
            const n = selecao[i.id] || 0;
            const meta = metaIngrediente(i);
            return `<div class="monte-extra ${n ? 'monte-escolhido' : ''}">
              <div class="monte-item-resumo">
                <div class="monte-thumb ${root.BrutusCamadas?.foto(i.id, i.grupo==='pao'?'topo':undefined)?'monte-thumb-real':'monte-thumb-'+esc(meta.visual)}" aria-hidden="true">${root.BrutusCamadas?.foto(i.id, i.grupo==='pao'?'topo':undefined)?`<img src="${root.BrutusCamadas.foto(i.id, i.grupo==='pao'?'topo':undefined)}" alt="" loading="lazy" decoding="async">`:`<span>${meta.emoji}</span>`}</div>
                <div class="monte-card-copy"><strong>${esc(i.nome)}</strong><p>${esc(meta.descricao)}</p><small>${reais(i.preco)} por porção · máximo ${core.limite(i)}</small></div>
              </div>
              <div class="monte-contador"><button type="button" data-monte-item="${esc(i.id)}" data-delta="-1" aria-label="Retirar ${esc(i.nome)}" ${!n ? 'disabled' : ''}>−</button><b>${n}</b><button type="button" data-monte-item="${esc(i.id)}" data-delta="1" aria-label="Adicionar ${esc(i.nome)}" ${n >= core.limite(i) ? 'disabled' : ''}>+</button></div>
            </div>`;
          }).join('') : '<p class="monte-ajuda">Nenhum ingrediente disponível neste grupo. O restaurante pode liberá-los no painel.</p>'}
        </section>`;
      }).join('');

      const configurando = cfg.ativo !== true;
      const alerta = configurando ? '<p class="monte-erro" role="status">⚠️ O montador está sendo configurado. O restaurante precisa definir os preços e ativá-lo no painel.</p>' : '';
      const revisao = passo === 4 ? `<div class="monte-revisao"><strong>Confira sua receita do zero</strong>${linhas().map((x) => {
        const ing = disp.find((i) => i.id === x.id);
        return `<p>${x.quantidade}× ${esc(ing.nome)} · ${reais(ing.preco * x.quantidade)}</p>`;
      }).join('') || '<p>Nenhum ingrediente selecionado.</p>'}</div>
      <label class="monte-nota-label" for="monte-nota">Observação para a cozinha (opcional)</label><textarea id="monte-nota" maxlength="140" rows="2" placeholder="Ex.: carne bem passada, sem cebola, mais molho..."></textarea>` : '';

      stage.innerHTML = `${alerta}<p class="monte-ajuda monte-ajuda-topo">${passos[passo].sub}</p>${agrupados}${revisao}`;
      stage.querySelectorAll('[data-monte-item]').forEach((btn) => btn.addEventListener('click', () => mudar(btn.dataset.monteItem, Number(btn.dataset.delta))));
      if (passo === 4) {
        const area = el('monte-nota');
        area.value = nota;
        area.addEventListener('input', () => { nota = area.value; });
      }
      btnDone.disabled = configurando || !linhas().length;
      renderVisual();
    }

    launcher.addEventListener('click', () => abrir());
    el('monte-fechar').addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
    doc.addEventListener('keydown', (e) => {
      if (!aberto()) return;
      if (e.key === 'Escape') {
        fechar();
        e.preventDefault();
      } else if (e.key === 'Tab') {
        const foco = [...overlay.querySelectorAll('button:not([disabled]):not([hidden]),textarea:not([disabled])')].filter((x) => x.offsetParent !== null);
        const first = foco[0];
        const last = foco[foco.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && doc.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && doc.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    });
    btnPrev.addEventListener('click', () => { passo = Math.max(0, passo - 1); render(); });
    btnNext.addEventListener('click', () => {
      const erro = validarEtapa();
      if (erro) { mostrarToast(erro); return; }
      passo = Math.min(passos.length - 1, passo + 1);
      render();
    });
    el('monte-menos').addEventListener('click', () => { qtd = Math.max(1, qtd - 1); renderVisual(); });
    el('monte-mais').addEventListener('click', () => { qtd = Math.min(20, qtd + 1); renderVisual(); });
    btnDone.addEventListener('click', () => {
      try {
        const item = core.criarItem(getMenu(), linhas(), qtd, nota, uidEdicao);
        salvarItem(item, uidEdicao);
        fechar();
        mostrarToast(editando ? 'Montagem atualizada ✅' : 'Seu Brutu’s do zero entrou na sacola! 🍔');
      } catch (e) {
        mostrarToast(e.message || 'Revise os ingredientes.');
      }
    });

    const atualizarBotao = () => {
      const cfg = core.configuracao(getMenu());
      const ativo = cfg.ativo === true;
      if (chamada) {
        chamada.hidden = !ativo;
        chamada.classList.toggle('hidden', !ativo);
      }
      launcher.hidden = !ativo;
      launcher.disabled = !ativo;
      launcher.title = ativo ? 'Monte seu lanche do zero' : 'Temporariamente indisponível';
      if (!ativo && aberto()) fechar();
    };

    atualizarBotao();
    return { abrir, atualizarBotao };
  };
})(typeof window === 'undefined' ? null : window);
