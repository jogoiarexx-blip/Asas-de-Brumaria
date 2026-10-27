## Novo protagonista animado — 44 ossos, 16 animações (24/10/2026)

O jogo aceita `personagem_animado_montaria.glb`, construído a partir do GLB animado enviado pelo jogador.
O arquivo conserva os cinco clipes originais (`Running`, `Walking`, `Arise`, `Boom_Dance`, `Dead`)
e acrescenta `Idle`, `Mount`, `Riding_Idle`, `Riding_Walk`, `Riding_Takeoff`,
`Riding_Fly`, `Riding_Glide`, `Riding_Landing`, `Riding_Attack`, `Riding_Hurt` e `Dismount`.
A adaptação em `heroRiderAnimation.js` também gera os movimentos quando o usuário importa
o GLB original de cinco animações; o esqueleto não é recriado e os personagens antigos
são ocultados somente após a importação válida.

**Usar agora:** inicie a partida, pressione `T`, vá a **NOVO HERÓI ANIMADO**, clique
**IMPORTAR GLB** e escolha `personagem_animado_montaria.glb`.
O IndexedDB guarda o arquivo nesse navegador, sem alterar a campanha.

**Instalar para todos no GitHub Pages:** carregue o binário proprietário
`assets/models/personagem_animado_montaria.glb` no repositório e só depois mude
`HERO_ASSET_PUBLISHED` para `true` em `src/entities/heroAssetConfig.js`.
Até lá o código intencionalmente evita um 404 e mantém a importação manual/fallback.
O código-fonte sozinho não contém o modelo binário enviado no chat.

# Asas de Brumária v1.4.18 — Corrigida a substituição automática das Fúrias 3D

## Problema que fazia o dragão antigo continuar aparecendo
No navegador, a versão anterior armazenava a função nativa `fetch` em uma propriedade e depois a chamava como método, perdendo o contexto correto. O erro de leitura de `dragon-species.json` era silenciado e o controlador considerava que os dois GLBs **não existiam**, mesmo quando a URL do manifesto retornava HTTP 200 com `available:true`. O jogo então exibia o dragão procedural antigo.

**Correções v1.4.18:**
- Chamada de `fetch` com contexto seguro. Erros no manifesto não são mais silenciados permanentemente; podem ser investigados e repetidos.
- Prioridade para os arquivos oficiais `assets/models/furia-da-noite.glb` e `furia-da-luz.glb`, ou versões mobile; versões antigas gravadas no IndexedDB não impedem que os GLBs publicados sejam escolhidos.
- Importação manual continua permitida, mas somente após escolha explícita do usuário na sessão atual. Falhas revertem a seleção.
- Indicador de estado no HUD, distinguindo *carregando*, *GLB exibido*, *indisponível* e *falha de renderização*; erros do importador são exibidos, em vez de apenas manter o visual antigo sem explicação.
- **Novo teste obrigatório no Chromium:** `tests/browser-fury-auto.mjs`, que abre o jogo sem importar arquivos, exige skin de 49 ossos e oito animações, verifica que **nenhuma malha do dragão procedural antigo permaneça visível**, fotografa a Fúria da Noite e testa a prévia da Fúria da Luz sem desbloqueá-la.

Os quatro GLBs reais (completos e mobile) e `dragon-species.json` permanecem no GitHub Pages, sem modificação de seus ossos, texturas, malhas ou clipes. Missões, progressão, controles e saves são preservados.

---

# Asas de Brumária v1.4.17 — Fúrias originais com opção móvel

## Evolução desta revisão
- **Variantes móveis testadas estruturalmente:** Fúria da Noite: **10,40 → 5,86 MB (−43,59%)**; Fúria da Luz: **11,93 → 6,98 MB (−41,53%)**. As três imagens JPEG por arquivo foram reduzidas de 2048 para 1024 pixels. Foram preservados 49 ossos, as 8 animações, os índices, as UVs e os 270 buffers não destinados a imagens.
- **Escolha automática no navegador:** aparelhos com tela de toque, até 4 GB de RAM reportados ou economia de dados preferem os GLBs mobile quando publicados. Desktops usam o original 2K. Um erro 404 na variante móvel aciona fallback para o modelo completo.
- **Importação manual também mais leve:** modelos GLB escolhidos no estábulo usam no máximo texturas 1024 px em aparelhos móveis comuns e até 512 px nos dispositivos de baixa memória. O redimensionamento acontece na memória antes do upload das texturas para WebGL, sem modificar o arquivo de origem do usuário.
- **Publicação em GitHub Pages:** depois de disponibilizar `assets/models/furia-da-noite.glb` e `assets/models/furia-da-luz.glb` no repositório, o workflow `.github/workflows/publish-furies.yml` gera os modelos mobile com `tools/prepare_fury_models.py`, valida os arquivos e executa um teste Chromium importando os **dois modelos reais**. O manifesto só é ativado depois do sucesso.
- **Importante:** o código está preparado, mas o GitHub não recebe os GLBs de 10–12 MB por este conector. Eles só aparecerão automaticamente para todos depois do upload pelo proprietário do repositório. Sem os binários, o fallback procedural e a opção de importar pelo estábulo continuam disponíveis.
- **Referência:** [Publicar Fúrias no GitHub e otimizar mobile](docs/PUBLICAR-FURIAS-MOBILE.md).

---

# Asas de Brumária v1.4.16 — Recuperação segura de GLB e prévia animada

- **Importação segura:** novos GLBs da Fúria da Noite e da Luz só são gravados em IndexedDB após serem aceitos pelo `GLTFLoader` e renderizados. A Fúria da Luz pode ser pré-visualizada sem ser desbloqueada.
- **Troca sem perda visual:** modelo atual fica disponível durante a busca e decodificação do próximo; erros preservam o visual válido quando apropriado ou retornam ao modelo procedural da espécie escolhida.
- **Oito movimentos na prévia:** agora o estábulo permite escolher Idle, Walk, Fly, Glide, Attack, Hurt, Takeoff e Landing. As opções mudam apenas a prévia; não influenciam física ou missões.
- **Desempenho:** limite de aproximadamente 24 desenhos/s na prévia WebGL, sem limitar a renderização durante a partida.
- **Testes:** regressões para rollback, Fúria da Luz bloqueada, carregamento inválido e trocas de espécie, mais verificação dos oito movimentos no Chromium. O runner de GitHub Actions foi fixado em Ubuntu 24.04 para compatibilidade com Playwright.
- **Detalhes e próximas prioridades:** [Auditoria técnica das Fúrias](docs/AUDITORIA-FURIAS-V1.4.16.md). Os GLBs reais dos dois dragões ainda precisam ser publicados na hospedagem para aparecerem automaticamente em qualquer navegador; caso contrário podem ser carregados manualmente no estábulo.

---

# Asas de Brumária v1.4.15 — Correção da prévia 3D e dos GLBs das Fúrias

## Problemas corrigidos
- **Prévia no estábulo:** `StablePreview` agora fornece `groundHeightAt` como a classe `Dragon` exige, evitando o erro `TypeError: world.groundHeightAt is not a function` quando o jogador abre o estábulo.
- **Erro 404 Three.js no GitHub Pages:** `src/main.js` não tenta mais baixar `/vendor/three.module.js` em páginas `*.github.io`. Usa os CDNs já configurados. O carregador GLB também evita requisitar o `vendor/addons/GLTFLoader.js` ausente, sem prejudicar a execução offline pelo launcher local.
- **Fúria da Noite/Luz com GLB original:** o manifesto de publicação continua desativado até que os arquivos 3D sejam efetivamente enviados ao repositório. Como alternativa imediata, o estábulo agora tem botões **CARREGAR FÚRIA DA NOITE** e **CARREGAR FÚRIA DA LUZ**; basta escolher os dois arquivos `.glb` do pacote original.
- **Persistência:** os GLBs são conferidos (glTF 2.0, 49 ossos, 8 animações) e guardados separadamente no IndexedDB quando permitido. A Fúria da Luz continua bloqueada até ser comprada por 4 pontos; carregar sua aparência não a desbloqueia.
- **Compatibilidade:** o modelo procedural original continua como reserva para arquivos inválidos/ausentes, os saves da campanha não são substituídos e a prévia 3D também aceita o modelo importado quando disponível.
- **Testes:** `tests/stable-preview-fury-import.test.js` cobre o contrato do World, a escolha de URL do Three.js e o importador por espécie. `tests/browser-smoke.mjs` agora abre o estábulo e **exige uma prévia 3D funcional**, evitando falsos positivos.

### Como instalar os dois modelos originais nesta versão sem alterar GitHub

No estábulo, pressione **CARREGAR FÚRIA DA NOITE** e escolha `furia-da-noite.glb` do pacote `Asas_de_Brumaria_Furias_Noite_e_Luz_Integracao.zip`. Depois pressione **CARREGAR FÚRIA DA LUZ** e selecione `furia-da-luz.glb`. A Fúria da Luz só poderá ser montada após desbloqueá-la com 4 pontos. Em navegadores com IndexedDB habilitado, os arquivos continuam disponíveis após recarregar a página.

Para que todos os visitantes tenham os GLBs automaticamente, publique `assets/models/furia-da-noite.glb`, `assets/models/furia-da-luz.glb` e o `dragon-species.json` com `available:true` no repositório GitHub Pages. Um código publicado isoladamente não coloca os binários do pacote na hospedagem.

---

# Asas de Brumária v1.4.14 — Fúria da Noite principal, Fúria da Luz desbloqueável

- **Dragão principal:** Fúria da Noite (`furia_noite`), desbloqueada automaticamente em partidas novas.
- **Fúria da Luz:** `furia_luz` permanece bloqueada até pagar **4 pontos de treinamento** no estábulo; depois pode ser selecionada e salva.
- **Modelos enviados pelo desenvolvedor:** `furia-da-noite.glb` e `furia-da-luz.glb` usam um rig de 49 ossos e oito clipes: Idle, Walk, Fly, Glide, Attack, Hurt, Takeoff e Landing, com `THREE.AnimationMixer` e transições. Os clipes de ataque, dano, decolagem e pouso não repetem em loop.
- **Compatibilidade:** outros dragões, missões, colisões, cavaleiro, melhorias, combate e controles são mantidos. Saves antigos preservam pontos, circuitos, habilidades e espécies descobertas. A seleção inicial Nimbo de saves anteriores migra para Fúria da Noite.
- **Prévia no estábulo:** o modelo GLB, quando disponível, pode girar e animar; outras espécies continuam tendo modelos procedurais.
- **Publicação dos assets:** o repositório possui `assets/models/dragon-species.json` com `available:false` enquanto os grandes arquivos 3D fornecidos pelo usuário ainda não foram enviados. Para ativar os modelos 3D reais no Pages, envie **os dois GLBs** para `assets/models/` e substitua o manifesto por `{"available":true,"species":["furia_noite","furia_luz"]}`. Até lá, o jogo usa automaticamente o fallback procedural e mantém a progressão nova, sem quebrar o navegador.
- **QA:** `npm run check` confere o sistema e, após ativar o manifesto, passa a exigir os dois arquivos reais, cada um com 49 ossos e oito animações. Os testes Chromium verificam o dragão inicial e o bloqueio da Fúria da Luz.

---

# Asas de Brumária v1.4.13 — Dragão CC0 real jogável no estábulo

## Modelo 3D real, com rig e seis animações
- **Novo botão no Estábulo: USAR DRAGÃO CC0 REAL.** O jogador escolhe usar o modelo Cethiel/Drummyfish (CC0), mantido no repositório em `assets/models/cethiel-dragon.glb`. O modelo original permanece padrão e pode ser restaurado a qualquer momento pelo botão **VOLTAR AO DRAGÃO ORIGINAL**.
- **Arquivos reais:** convertido com Blender 4.0.2 do ZIP CC0 original em `https://opengameart.org/content/cethiels-dragon-3d`; 738 KB, cerca de 1.900 triângulos, 32 ossos, duas malhas, dois materiais e uma textura incorporada.
- **Animações:** do autor: `Attack`, `Die`, `Idle`, `Walk`. Criadas neste projeto sobre os ossos originais das asas: `Flying`, `Glide`. As animações originais foram preservadas. O modelo e as duas animações adicionais foram gerados reproduzivelmente pelos scripts em `tools/fetch_cc0_dragon.py` e `tools/export_cc0_dragon_blender.py`.
- **Qualidade e fallback:** o GLB é opcional, não substitui as quatro espécies procedurais, não altera controles de voo, colisões, missão, save ou cavaleiro. Uma falha no carregamento não impede jogar com o dragão original.
- **Prova de QA:** GitHub Actions `39667376609`: exportação e importação no Chromium/WebGL aprovadas; malha skinned reconhecida, animações de voo/planagem, cavaleiro preservado e retorno ao original. Reexecução `39668422587` confirmou que a seleção **USAR DRAGÃO CC0 REAL** funciona por arquivo local servido no navegador. O repositório contém o GLB binário com blob SHA `4a96abde21e180b2d51df9355fc2ad517c3c6e67`, igual ao produzido no teste.
- **Limites:** o teste de navegador acelera cenas e não mede FPS em GPU dedicada. O estilo CC0 externo é um protótipo alternativo e não um redesenho das espécies Nimbo, Brasa, Raio ou Fúria da Luz.

---

# Asas de Brumária v1.4.12 — Dragão GLB animado (integração opcional)

## Novidade jogável no estábulo
- **IMPORTAR DRAGÃO GLB:** importe um modelo 3D legalmente obtido e convertido a GLB. O jogo inspeciona a estrutura, normaliza a escala e mapeia automaticamente as animações nomeadas Idle, Walking, Flying, Glide, Takeoff, Landing, Attack e Hurt.
- **TESTAR DRAGÃO DEMO ANIMADO:** gera localmente um pequeno GLB original de dragão com 8 clipes e asas articuladas para testar o pipeline sem depender de download de assets de terceiros. É um protótipo geométrico, **não** o modelo de Cethiel convertido.
- **VOLTAR AO DRAGÃO ORIGINAL:** restaura todas as malhas e animações procedurais. O cavaleiro, as colisões, o voo, as missões, as espécies e os saves não são alterados. GLBs opcionais podem ser guardados no IndexedDB, isolados do save da campanha.
- **Código:** `src/entities/dragonAssetLoader.js`, `dragonClipMap.js`, `dragonDemoGlb.js`, `dragonAssetStore.js` e `src/ui/DragonAssetUI.js`; teste Node em `tests/dragon-glb.test.js`; teste funcional de upload, GLB inválido e restauração em `tests/browser-smoke.mjs`.
- **Fonte CC0 indicada:** [Cethiel's Dragon 3D](https://opengameart.org/content/cethiels-dragon-3d), de Drummyfish/Cethiel. O pacote oficial é ZIP e precisa ser inspecionado e convertido para GLB no Blender; não foi incorporado ao repositório nem validado em jogo nesta revisão.
- **Validações até o merge:** parse estático dos módulos novos; gerador do GLB demo executado e inspecionado (glTF 2.0, 6 malhas, 14 nós-filhos e 8 animações, offsets corretos). A suíte GitHub Actions de Chromium desta revisão ainda estava **na fila** no momento da integração. Não há alegação de teste WebGL aprovado no novo importador.
- **Compatibilidade GitHub Pages:** nenhuma dependência obrigatória nem mudança de build no jogo; carregador GLTF oficial só é importado quando um GLB opcional é escolhido.

---

## Pesquisa open source para modelos 3D (outubro de 2026)

Foi integrado um novo guia de assets CC0 e bibliotecas open source em [docs/OPEN-SOURCE-3D-ROADMAP.md](docs/OPEN-SOURCE-3D-ROADMAP.md). O primeiro candidato para um dragão real rigado e animado é **Cethiel’s Dragon 3D (CC0)**; outros acervos selecionados incluem Quaternius Ultimate Monsters e Animated Animals, Kenney Nature Kit/Fantasy Town e Poly Haven.

Adicionamos auditoria de modelos GLB sem dependências adicionais: `npm run assets:inspect -- modelo.glb`. Quem instalar opcionalmente `@gltf-transform/cli` pode usar `npm run assets:optimize -- original.glb otimizado.glb` para gerar um GLB otimizado sem usar Draco/Meshopt/KTX2 ou fundir ossos e malhas animadas. O processo verifica a compatibilidade estrutural do arquivo e preserva o original.

**Importante:** nenhum modelo externo ou biblioteca pesada foi embutido no jogo nesta etapa. A tela, os controles, as missões e os salvamentos existentes permanecem iguais. As novas ferramentas deverão ser usadas quando selecionarmos e validarmos um GLB real.

---

# Asas de Brumária v1.4.11 — Otimização dos dragões articulados

## Novo agrupamento de malhas
- **Rigs montáveis:** `src/utils/rigBatch.js` agrupa geometrias rígidas opacas que compartilham material *dentro do mesmo pivô*, preservando textura, cores por vértice, normais e sombras. É aplicado somente na construção do modelo, nunca a cada quadro. Nenhum objeto de animação é agrupado com outro pivô.
- **Dragão principal:** 161 malhas rígidas consolidadas na construção. Mantidas cabeça, mandíbula, duas asas com cotovelos e pontas, olhos, sobrancelhas, patas e segmentos da cauda independentes. Ornamentos dos quatro dragões são consolidados em suas próprias variantes visíveis.
- **Dragões acariciáveis:** Brasa (21 malhas consolidadas), Raio (20) e Nimbo (21), mantendo piscadas, carinho, movimentos de cabeça e asas. Os dragões distantes ainda usam seus modelos simplificados anteriores.
- **Memória e compatibilidade:** sem modificação de controles, física, missões, progressão ou formato de saves. As geometrias originais não são descartadas prematuramente quando compartilhadas com outras malhas.

## Medição Chromium WebGL (GitHub Actions, SwiftShader)
| Cena | Chamadas de desenho: v1.4.10 → v1.4.11 | Geometrias: antes → depois |
| --- | ---: | ---: |
| Vila | **318 → 204** (−35,8%) | 310 → 219 |
| Dragões selvagens | **401 → 287** (−28,4%) | 423 → 311 |
| Montanha e chefe | **216 → 102** (−52,8%) | 439 → 327 |

- **Verificação automática:** GitHub Actions `39251876830` aprovou os dois trabalhos, incluindo **445/445 testes de lógica**, cenários completos de resgate, treinamento e montanha no Chromium, validação dos pivôs e contagem de malhas consolidadas e benchmark de três cenários.
- **Limites:** são métricas de renderização real num navegador com SwiftShader no CI, não FPS em placa de vídeo dedicada. Não é possível inferir aumento percentual de FPS no computador do jogador só a partir da queda das draw calls.

---

# Asas de Brumária v1.4.10 — Otimização de renderização e medição de desempenho

## Implementado
- **Aves marítimas instanciadas:** 12 aves animadas agora usam **um único `THREE.InstancedMesh`** com dois pares de asas reunidos em geometria compartilhada, preservando cor, posição, movimento e seed do cenário. A verificação WebGL confirmou `12 instâncias, 1 draw call`. O culling frustum usa uma esfera calculada na criação com margem para a órbita de voo, sem recalcular limites a cada frame.
- **Destroços de barcos:** quando nenhum barco está afundando, o mapa da montanha não recalcula nove matrizes de fragmentos nem marca o buffer de instâncias para upload. Durante o afundamento as peças continuam animadas; no último quadro são ocultadas corretamente, sem afetar dano ou recompensas.
- **Benchmark repetível no navegador:** `tests/browser-performance.mjs` mede três cenas em 1280×720, qualidade equilibrada, reportando FPS do Chromium SwiftShader, p95 do frame, chamadas de desenho, triângulos e geometrias. Salva `artifacts/perf-metrics.json` e capturas para futura comparação. O workflow executa o teste junto do smoke, das missões principais e das montanhas.

## Comparação observada (CI Chromium, SwiftShader)
| Cena | Draw calls antes → depois | Geometrias antes → depois |
| --- | --- | --- |
| Vila | 317 → 318 | 319 → 310 |
| Dragões selvagens | **422 → 401** | **446 → 423** |
| Chefe da montanha | 216 → 216 | 462 → 439 |

- **Ganhos estruturais:** menos 21 draw calls (5,0%) na cena dos dragões selvagens, menos 23 geometrias (5,2%) nessa cena; em cenas distantes, a nova ave única é descartada por frustum e não acrescenta chamadas de desenho. A cena da vila pode exibir uma chamada a mais porque o lote pode abranger aves antes individualmente fora do campo da câmera.
- **Validação do código otimizado:** GitHub Actions `39242903765`, **445 de 445 testes aprovados** e smoke Chromium aprovado, incluindo todos os cenários das missões principais, treinamento, barcos e chefe. A verificação específica da fauna confirmou 12 aves por um draw call.
- **Limitação:** FPS de 2–12 no Chromium sem GPU dedicada não representa FPS do usuário, e os resultados numéricos variam entre runners. A melhoria de FPS em placas reais ainda não foi quantificada. O benchmark interno no jogo pode ser ativado com F3 e B, nos mesmos locais e câmera.

---

# Asas de Brumária v1.4.9 — QA do treinamento e das Montanhas da Sombra

## Validações realizadas no navegador
- **Treinamento:** testes Playwright usam as classes reais de `Training`, `Missions` e `Game`. Confirmados circuito básico, progressão até a fase 7, cooldown, velocidade mínima do avançado, circuito avançado e ausência de recompensa duplicada. Treino básico concede **1 ponto do circuito + 2 pontos da missão final**; avançado concede mais 2 pontos, total 5.
- **Streaming da montanha:** importação dinâmica de `MountainRegion`, adição de 14 obstáculos da região, deslocamento pelo portal e restauração ao entrar.
- **Navios:** três navios atingidos duas vezes cada, por seis projéteis simulados através do sistema verdadeiro de fogo e colisão. Fase muda de `boats` para `boss`.
- **Chefe:** o aviso do ataque ocorre antes dos projéteis; janela de contra-ataque confirmada. Derrota por 11 disparos com um contra-ataque registrado, sem alterar a resistência do chefe artificialmente.
- **Salvamento e retorno:** partida salva na fase do chefe, página recarregada, barcos ainda destruídos, retorno ao portal, chefe derrotado, +3 pontos de expedição **apenas uma vez** e liberação da região da GPU.
- **Verificação automatizada:** GitHub Actions `39236876779`, ambos trabalhos aprovados. **445 testes de lógica aprovados**, com 79 módulos e 132 imports locais analisados. `tests/browser-mountain.mjs` inclui imagens e verificações de erros de console.
- **Escopo:** trajetos entre checkpoints e alvos foram acelerados dentro do Playwright; as classes de jogo, tiros, colisões, fluxo de missão e carregamento do mapa não foram substituídas. A execução usa Chromium com renderização SwiftShader; desempenho FPS de hardware real e uma campanha inteira pilotada manualmente permanecem sem certificação.
- **Código de produção:** nenhuma regra ou recompensa de jogo precisou de correção nesta etapa. A validação é permanente no CI e não instala atalhos de depuração na versão pública.

---

# Asas de Brumária v1.4.8 — Validação de missões e câmera na floresta

## Implementações confirmadas
- **Testes E2E de missões no Chromium:** o arquivo `tests/browser-missions.mjs` executa as classes reais Game/Missions/EnemyDragon/SaveSystem com renderização WebGL e deslocamentos acelerados entre destinos dentro do teste. Testa cinco aros, três cristais, três orbes destruídos por projéteis reais, três sentinelas derrotadas por projéteis reais, resgate e entrega dos três filhotes, checkpoint salvo/restaurado após reload e carinho após amizade 3/3 sem recompensas extras.
- **Segurança da aplicação:** o teste captura uma referência ao Game somente ao interceptar `src/main.js` pelo Playwright. Não foi adicionado painel de trapaças ou API de depuração ao jogo publicado.
- **Correção de câmera:** `src/utils/spatialSweep.js` passa a considerar as copas maiores das árvores ao posicionar a câmera, sem alterar obstáculos usados por jogadores, dragões, física ou saves. Nova regressão em `tests/camera-canopy.test.js` verifica copas, árvores altas, pousos e cenário sem árvores.
- **Resultado verificável:** GitHub Actions, run `39233563527`: **445/445 testes aprovados**, 79 módulos e 132 imports válidos; ambos jobs `tests` e `browser-smoke` concluídos com sucesso. Capturas de tela (início, fase dos filhotes e carinho) estão disponíveis nos artifacts da execução.
- **Limite de teste:** os trajetos longos foram acelerados pelo teste automatizado; os controles de pilotagem foram verificados no smoke padrão. FPS da GPU SwiftShader e obstáculos em cenários teletransportados não equivalem a desempenho em hardware real. Ainda não representa cada missão percorrida manualmente, nem o circuito final, nem toda a expedição da montanha.

---

# Asas de Brumária v1.4.7 — QA de jogabilidade e correções estruturais

- **Carinho contínuo:** Faísca, Zéfiro e Neblina podem ser acariciados após atingir confiança 3/3. A animação é repetível com cooldown de 1,8 segundo, sem repetir recompensas, espécie desbloqueada ou alterações de salvamento.
- **HUD contextual:** dragões já amigos continuam visíveis como alvos de interação e mostram "ACARICIAR · AMIGO" quando tranquilos.
- **Compatibilidade gráfica:** `PCFShadowMap` substitui o modo de sombra removido; `start_game.py` baixa conjuntamente `three.module.js` e `three.core.js` do Three r180. O carregador ignora cache parcial e usa CDN quando necessário.
- **Regressão:** testes antigos atualizados para a quarta espécie e para a separação de modelos de filhotes. Testes de entrega e salvamento continuam exercitando as regras reais de `Missions` via adaptador de cena.
- **Validação GitHub Actions:** **442 de 442 testes automatizados aprovados**, 79 módulos JavaScript com sintaxe verificada e 132 imports locais encontrados corretamente.
- **Teste de navegação automatizado:** Chromium + SwiftShader abriram o mundo 3D, iniciaram a partida, montaram, testaram controles de deslocamento/decolagem, abriram o estábulo com Fúria da Luz e salvaram sem erro detectado. `tests/browser-smoke.mjs` e workflow em `.github/workflows/validate.yml`.
- **Limites de QA:** o smoke de navegador não representa uma partida integral, nem aprova todas as missões ou desempenho em GPU real. Avaliação de FPS e jogo prolongado permanecem pendentes.

---

# Asas de Brumária v1.4.6 — Filhotes expressivos e dragões acariciáveis

## Visual e animação
- **Filhotes do resgate:** novos modelos com cabeça proporcionalmente maior, olhos em camadas com reflexo, focinho curto, bochechas, patas arredondadas, chifres pequenos, cauda curta e asas em membranas. Três paletas diferentes e olhos piscando.
- **Animação dos filhotes:** respiração, movimento de cabeça e cauda, piscadas e asas com ritmo próprio quando transportados; seus alvos, anéis, feixes e posições de missão continuam iguais.
- **Dragões selvagens Faísca, Zéfiro e Neblina:** olhos com pupilas e brilho, bochechas, narinas e orelhas articuladas; expressões variam ao observar, assustar-se e relaxar.
- **Carinho visível:** após uma interação de confiança bem-sucedida, o dragão baixa a cabeça, semicierra os olhos, movimenta cauda/orelhas e relaxa as asas durante 1,25 segundo. A reação é visual e não concede pontos extras nem altera o cooldown.
- **Código desacoplado:** poses puras em `src/entities/CreatureMotion.js`, modelo separado em `src/entities/HatchlingVisual.js`, integrados aos sistemas existentes sem mudar o schema dos salvamentos.
- **Desempenho:** as geometrias dos três filhotes são compartilhadas; animações atualizam apenas transformações, sem criar malhas a cada quadro. Os dragões selvagens continuam sob `ActorLOD`.
- **Testes:** novo `tests/creature-visuals.test.js` verifica poses, resgate, tempo de carinho e integração. Em execução isolada local, **4 verificações de animação e regras puras passaram**, incluindo 500 frames por filhote. **Ainda faltam `npm run check` completo, teste visual WebGL, FPS e jogabilidade em navegador.**

---

# Asas de Brumária v1.4.5 — Fúria da Luz

- **Novo dragão jogável:** Fúria da Luz, de tons branco-azulados, barbatanas arredondadas, chifres menores e brilho frio, disponível por **4 pontos de treinamento** no estábulo.
- **Integrado:** seleção e prévia 3D usam o mecanismo atual de `SPECIES` e `Dragon.setSpecies`; voo, fogo, controles, câmera e upgrades continuam compartilhados com as outras espécies.
- **Compatibilidade de saves:** o novo identificador `furia_luz` é reconhecido pelo carregamento anterior sem alterar o esquema de salvamento. Um save antigo permanece na espécie selecionada anteriormente.
- **Testes acrescentados:** arquivo `tests/light-fury.test.js` verifica cores, atributos, desbloqueio, compra, restauração e compatibilidade com partidas antigas.
- **Execução de testes:** o workflow de `npm run check` já está configurado em `.github/workflows/validate.yml`, mas não há resultado de execução confirmado no GitHub neste momento. O teste visual WebGL, FPS, combate e transições de missões ainda precisa ser validado no navegador.

---

# Asas de Brumária v1.4.4 — Dragões mais expressivos e florestas variadas

## Evolução visual desta versão

- **Asas dos dragões:** novos movimentos de varredura horizontal, torção do cotovelo e ponta das asas durante voo e planagem, integrados ao `wingPose` existente. Cabeça e cauda reagem às curvas sem alterar física nem colisões.
- **Silhueta de cada espécie:** Nimbo recebeu barbatanas extras, Brasa ganhou placas laterais e Raio tem lâminas aerodinâmicas. Os modelos usam os mesmos rigs, materiais e controles de espécies anteriores.
- **Cavaleiro:** inclinação responsiva a velocidade, subida, descida e curvas, acompanhada de cabeça e capa, sem interferir com a importação opcional de GLB.
- **Florestas:** substituição de copas homogêneas por coníferas e árvores de copa arredondada, ambas instanciadas por ilha. As variações são determinísticas a partir da posição existente, sem consumir o RNG global ou alterar a geração das árvores, hitboxes e saves. O sub-bosque instanciado permanece.
- **Orçamento gráfico:** uma chamada de desenho adicional no máximo por ilha para as copas, sem animação de vértices por CPU, materiais por árvore, luzes adicionais ou colisões novas.
- **Validação:** quatro testes matemáticos novos (copas determinísticas, coexistência de dois formatos, simetria e finitude das poses e planagem) aprovados localmente em Node 22. Adicionado workflow GitHub Actions para `npm run check` a cada push e pull request; o resultado do fluxo completo e o FPS WebGL ainda precisam ser confirmados.

---

# Asas de Brumária v1.4.3 — Faróis de fogo e cenário florido

## Conteúdo novo

- **Suri, guardiã dos faróis:** nova moradora da vila, com o contrato diário **Chamas dos Faróis**. Aceite a missão, monte no dragão, acenda três balizas laranjas com a tecla **F** (fogo) e retorne a Suri para receber **3 pontos de treinamento**. Cada missão reabre no dia seguinte. O jogador precisa desbloquear o sopro de fogo nas missões da história; apenas sobrevoar a baliza não conta.
- **Visual dos objetivos:** balizas com braseiros e chama laranja, bônus de mira quando o marcador está ativo e dicas próprias no painel de missão e na barra do contrato.
- **Ilhas mais coloridas:** flores de cinco cores espalhadas pelo terreno, em **um lote 3D instanciado por ilha**, sem hitboxes nem centenas de objetos isolados. Elas ficam ocultas no modo **LEVE**, usam densidade menor no **EQUILIBRADO** e aparecem completas no **DETALHADO**.
- **Compatibilidade:** os cinco contratos anteriores, missão principal, dragões e mapas em streaming continuam. Os saves antigos recebem o novo contrato inicialmente disponível sem perder suas conquistas.
- **Lógica testada:** 11 novos testes de faróis, recompensa, virada do dia, salvamento, projéteis, HUD e geometria instanciada. A medição de FPS ainda precisa ser realizada em uma GPU real.

### Como jogar

1. Vá à vila do Refúgio e converse com **Suri**, perto da forja.
2. Desbloqueie o sopro de fogo se ainda não o tiver feito; aperte **T** para ver o quadro diário.
3. Siga a bússola e o minimapa até as três balizas laranjas, acenda cada uma com **F** e volte para Suri.
4. No menu ⚙ GPU, use o perfil LEVE se o computador apresentar engasgos.

---

## v1.4.2 — Gráficos e missões

A v1.4.2 reúne as melhorias gráficas do terreno e da água com o trabalho de orientação de missões das versões anteriores, sem apagar progressos.

- Chuva com traços finos em uma única geometria LineSegments, sem pontos quadrados; quantidade ajustada à qualidade gráfica.
- Feixes de cristais e de resgate menores e mais transparentes para evitar triângulos enormes sobre o céu.
- Objetivos com direção e distância horizontal no minimapa, próximos passos contextuais para resgate dos filhotes, sentinelas, circuitos, contratos e chefes.
- Aviso do portal das montanhas apenas ao chegar perto dele; não cobre permanentemente o minimapa.
- Mantidos água com relevo sutil, tons de terreno por altitude/declividade e a missão diária adicional de patrulha com Tavi.
- Nenhum campo novo no formato do salvamento, nenhum modelo externo obrigatório.

**Validação:** 426 testes automatizados aprovados. É necessária validação gráfica WebGL e FPS em hardware real.

---

# Asas de Brumária v1.4.1 — Orientação de missões e melhorias visuais

- **Bússola de objetivos no HUD:** seta indica a direção relativa ao jogador, distância real até o alvo, instrução para subir ou descer e nome do objetivo. Funciona para sentinelas, aros, filhotes, contratos, treinamento, barcos e chefe. A missão final agora aponta para a vila.
- **Nova missão diária:** Tavi, o Vigia dos Horizontes, oferece a **Vigília dos Horizontes**: voe por três balizas espalhadas pelo arquipélago e retorne a ele para receber dois pontos de treinamento. O contrato pode ser repetido a cada dia de jogo, com pequenas mudanças na rota. As quatro missões diárias anteriores continuam funcionando e os saves antigos são compatíveis.
- **Terreno:** cores por altura e inclinação produzem transições entre praia, vegetação e afloramentos rochosos com o mesmo número de malhas de terreno.
- **Água:** reflexos especulares e mapa de relevo (bump) reutilizam a textura gerada no próprio jogo, sem downloads nem objetos extras.
- **Chuva:** as partículas deixam de parecer quadrados brancos e passam a usar um pequeno traço texturizado e transparente, mantendo um único draw call.
- **HUD:** cartão do novo mapa não sobrepõe mais o minimapa, e o guia de missões se adapta a telas menores.
- **Compatibilidade:** regras de combate, salvamentos, missões anteriores e perfis GPU preservados.

**Validação:** execute `npm run check`. Os testes automatizados não substituem um teste visual em GPU real. No Windows, a distribuição continua sendo um jogo para navegador com inicializador PowerShell, não um executável nativo independente.

---

# Asas de Brumária v1.4.0 — Voo aerodinâmico, sentinelas reativas e contra-ataque no chefe

## Principais melhorias

- **Contra-ataque tático no dragão gigante:** após um sopro, o chefe fica brevemente vulnerável. Acerte-o em até 1,05 s na primeira fase ou 1,30 s na segunda para aplicar 2 pontos de dano e interromper a preparação do próximo sopro. Um golpe normal ainda tira 1 ponto. O HUD informa **✦ CONTRA-ATAQUE!** e uma mensagem confirma o acerto. Não há mudança na estrutura dos salvamentos.
- **Quarto padrão do chefe:** abaixo de metade da vida, o dragão alterna também a **VARREDURA DE FOGO**, anunciada por um anel roxo, com no máximo 3 projéteis em trajetórias diagonais fixas. O aviso de 0,95 segundo e os limites do pool permanecem.
- **Reação ao dano:** o dragão gigante diminui de velocidade quando cambaleia, corrigindo a reação anterior, que aumentava acidentalmente sua velocidade.
- **Sentinelas evasivas:** os inimigos agora desviam de forma lateral por um curto período depois de serem atingidos, flanqueiam e recuam quando o jogador chega muito perto. Mantida a perseguição e o ataque sem teletransporte.
- **Voo mais expressivo:** ao reduzir demais a velocidade em voo o dragão entra em descida suave; mergulhos dão um pequeno impulso horizontal e subidas têm arrasto. Os controles manuais têm prioridade, o pouso continua dependendo de terreno seguro e o movimento mantém a varredura 3D contra obstáculos.
- **Desempenho:** não foram incluídas novas luzes, materiais caros, partículas por quadro ou modelos 3D pesados. LOD, pooling, missões diárias, GLB e regiões em streaming permanecem disponíveis.

### Testar a nova batalha

Voe até o mapa das Montanhas da Sombra, destrua os três navios e enfrente o chefe. Esquive-se do aviso, aguarde o sopro, alinhe seu dragão e **acerte durante a mensagem de CONTRA-ATAQUE**. O golpe bem cronometrado causa dano dobrado e deixa o chefe cambaleante. No ar, experimente soltar a aceleração para perceber a descida suave e usar CTRL para mergulhar.

**Testes automatizados:** 410 de 410 passaram, sem falhas (391 da v1.3.9 + 19 novos). Testes WebGL visuais, controle físico e benchmark real de FPS ainda precisam ser feitos num computador com GPU. O inicializador Windows abre o navegador e não é um EXE nativo.

---

# Asas de Brumária v1.3.9 — Chefe tático, contato com terreno e ondas de naufrágio

## Melhorias implementadas

- **Corrigida a animação de pouso:** a compressão do corpo do dragão estava sendo sobrescrita pelo balanço de caminhada/voo no mesmo quadro. Agora as duas componentes são combinadas com uma única interpolação, deixando as patas flexionarem visualmente durante o contato com o solo.
- **Terreno e tração:** o dragão amostra a elevação em quatro pontos e inclina o corpo suavemente em encostas; caminhando, a tração reduz moderadamente em terrenos íngremes. O sistema não altera o voo nem permite atravessar construções; pousos continuam dependendo da validação de inclinação da v1.3.7.
- **Dragão gigante mais estratégico:** adapta a rota à posição e altitude do jogador. Aproxima-se quando há distância, recua se o jogador se aproxima demais e executa trajetórias mais agressivas abaixo da metade da vida. Toda a movimentação permanece dentro de limites da arena, e o chefe ainda para durante os avisos de sopro.
- **Naufrágios visuais:** ondas circulares aparecem sobre o mar enquanto os navios afundam, com raio crescente e transparência gradual. São três malhas recicláveis de baixa complexidade, carregadas somente com o mapa das montanhas e descartadas ao sair.
- **Sem alterações de progresso:** os saves continuam armazenando apenas a vida dos barcos e do chefe, sem replay dos naufrágios após recarregar.
- **Testes:** 391 testes automatizados aprovados (378 anteriores + 13 novos), incluindo a construção/destruição real da região com objetos Three.js simulados, ciclo completo de onda na água e regressões anteriores.

**Limitações:** desempenho, aparência final dos efeitos e movimentação de combate precisam de teste visual com uma GPU real. Os testes de código não comprovam um FPS específico em hardware fraco.

---

# Asas de Brumária v1.3.8 — Contato de voo, barcos e IA do dragão gigante

## Novidades verificadas

- **Decolagem e pouso:** corpo, asas e patas do dragão agora mostram uma breve compressão de contato com o chão. Os efeitos de poeira são pontuais, reaproveitam as partículas existentes e não aparecem sobre água. O custo diminui em gráficos LEVE.
- **Destruição dos barcos:** após o primeiro golpe, a vela diminui e o mastro se inclina. Ao receber o segundo golpe, o casco aderna e afunda gradualmente, acompanhado por fragmentos de madeira. São **nove fragmentos em um único InstancedMesh**, reutilizando o material de madeira já carregado.
- **Salvamentos:** apenas a vida do barco é salva, como antes. Reabrir uma partida após destruí-lo não repete o naufrágio. Não houve mudança de versão do esquema de save.
- **Chefe das montanhas:** novo deslocamento suave de patrulha, com movimentos em X, Y e Z. Com metade da vida, a trajetória fica mais dinâmica; durante os avisos coloridos, o chefe interrompe o deslocamento para permitir uma esquiva clara. A velocidade é limitada para evitar teletransportes após pausas.
- **Desempenho:** a malha dos destroços fica invisível fora do curto evento de destruição; sem luzes dinâmicas adicionais ou física pesada de fragmentos.

**Validação:** 378 testes automatizados aprovados (364 anteriores + 14 novos), com execução de eventos de naufrágio, restauração do mapa, limites da trajetória do chefe e verificação de colisões existentes. O ganho de FPS na sua GPU ainda precisa de medição visual em navegador real.

---

# Asas de Brumária v1.3.7 — Pouso seguro, impactos e novos sopros do chefe

## Evolução da física

- O dragão só aterrissa quando há **superfície firme e caminhável**, espaço livre, inclinação moderada e velocidades controladas. Não aterrissa automaticamente sobre o mar ou junto de encostas perigosas.
- A validação amostra oito pontos em volta das patas, além do centro, para evitar ficar preso em bordas de ilha e terrenos inclinados.
- Se chegar ao solo em alta velocidade, o voo continua até reduzir a velocidade e encontrar terreno seguro; para pousar solte CTRL, freie com S/LT e escolha local plano.
- Nas colisões fortes, o dragão perde velocidade e recebe uma pequena inclinação de impacto. Os estilhaços reutilizam as partículas instanciadas existentes (sem luzes novas).
- Mantida a varredura de colisão 3D para esquiva e turbo, sem atravessar estruturas.

## Dragão gigante — novos padrões

- **Sopro direcionado:** projétil único com mira preditiva (já existente, reforçado).
- **Leque de fogo:** três projéteis abertos na horizontal, com anel laranja.
- **Chamas em alturas diferentes:** três projéteis com inclinações verticais, com anel azul, disponível quando a vida do chefe chega à segunda fase.
- Os avisos textuais e a cor da aura identificam o ataque antes do disparo. Mudanças de fase durante o aviso não trocam o golpe anunciado; janela mínima de 0,95 s preservada.
- Máximo de três projéteis por ciclo, usando o pool do combate; efeitos de sopro compartilham as malhas instanciadas. O HUD mostra aviso de sopro iminente.

## Compatibilidade e validação

Os salvamentos, missões diárias, transporte de filhotes, expansão das montanhas, controles, GLB e configurações de GPU não foram alterados. Código-fonte e versão Windows são dois ZIPs independentes. A versão Windows usa inicializador de navegador, não EXE nativo.

**364/364 testes automatizados aprovados** (338 anteriores + 26 novos). Os testes incluem o comportamento de pouso, colisão, velocidades, três padrões de ataque, contagem limitada e manutenção do aviso durante uma troca de fase.

**Limitação:** ainda falta testar visualmente o jogo em um navegador com GPU/WebGL e medir a taxa de quadros em hardware de entrada. O número de testes não prova desempenho real.

---

# Asas de Brumária v1.3.6 — Combate aéreo, esquiva e dragão gigante

Esta etapa aprimora a jogabilidade sem alterar o formato dos salvamentos, missões, mapas ou recompensas.

## Esquiva aérea
- Em voo e montado, pressione **Q** (teclado), **R3** (analógico direito pressionado, controle padrão) ou **ESQUIVA** no celular.
- Use **A/D** ou o analógico esquerdo para escolher o lado da esquiva; sem direção, alterna o lado automaticamente.
- A manobra desloca o dragão **lateralmente por 0,34 segundo**, consome **18 de energia** e tem **2,25 segundos de recarga**.
- Ataques inimigos não causam dano durante a curta manobra. A esquiva **não atravessa objetos**: paredes, rochas, barcos e outras colisões continuam ativos; ao bater, a manobra termina.
- O HUD informa **ESQUIVA PRONTA / ESQUIVANDO / tempo de recarga**.

## Inimigos e dragão gigante
- As sentinelas passam a **flanquear o jogador em trajetórias laterais suaves** durante a perseguição; regras de combate próximo e missões são preservadas.
- O dragão gigante antecipa moderadamente a direção do jogador antes de disparar (até **12 metros**), mas o projétil não o persegue depois do disparo. O anel vermelho de aviso permanece.
- O chefe mostra **três marcas luminosas de dano** e brilho crescente conforme perde vida; os detalhes já aparecem corretamente ao carregar um salvamento antigo com o chefe danificado.
- As marcas compartilham geometria e material, evitando luzes dinâmicas ou partículas permanentes adicionais.

## Validação
**338 testes aprovados (320 anteriores + 18 novos).** Testes de movimentação lateral, colisão, duração, recarga, controle, dano progressivo e recuperação do progresso. 

**Limitação:** a renderização visual e o FPS real ainda precisam de teste em navegador com GPU/WebGL. A versão Windows utiliza inicializador local e navegador, não executável nativo.

---

# Asas de Brumária v1.3.5 — Estabilidade da expansão e chefe melhorado

## Atualização

- **Passagem das montanhas mais segura:** voar rápido não deixa o personagem ultrapassar o portal enquanto o módulo do mapa ainda é carregado. O dragão aguarda brevemente junto à entrada; depois que o cenário chega, basta voar para leste novamente. Se a importação falhar, o jogo avisa e tenta de novo após o intervalo existente.
- **Dragão gigante com ataques anunciados:** um anel vermelho e uma mensagem sinalizam o sopro por cerca de 0,95 segundo. Os ataques começam em ciclos de 3,65 segundos e passam para 2,65 segundos após a metade da vida do chefe. O ataque não acontece se o personagem estiver fora do alcance da batalha.
- **Barcos com dano visível:** após o primeiro acerto, a vela encolhe, antes de o barco desaparecer no segundo golpe. O progresso já salvo continua valendo.
- **Desenho mais leve nas montanhas:** rochas decorativas são desenhadas com uma malha instanciada, mantendo volumes individuais de colisão. Essa parte passa de até 14 chamadas de desenho para 1, sem alterar a disposição.
- **Descarregamento da região:** materiais/geometrias compartilhados são liberados uma única vez cada quando a região é descarregada.
- **Missões, controles, resgate e progresso:** nada no formato do save foi alterado. São 320 testes automatizados aprovados.

O desempenho em PCs fracos ainda depende de testes no navegador com GPU real. O modo ⚙ GPU e o painel F3 continuam disponíveis.

---

# Asas de Brumária v1.3.4 — Expedição às Montanhas da Sombra

A nova campanha paralela começa em uma **passagem azul a leste do arquipélago**, aproximadamente em X=328, Z=35. Monte no dragão, desbloqueie a habilidade de fogo na história principal e **voe na direção do portal** (aproxime-se acima de 14 m de altitude). A geometria da nova região é carregada dinamicamente ao aproximar-se — não é construída durante o início do jogo. Após cruzar o portal, você chegará ao cenário com ilhas montanhosas, barcos de saqueadores e um dragão gigante.

## Objetivos da expedição

1. **A frota dos saqueadores:** acerte cada um dos 3 barcos inimigos duas vezes com fogo. Os barcos afundados desaparecem, deixam de bloquear o voo e permanecem derrotados se você salvar e sair.
2. **O dragão colossal:** quando a frota cair, um dragão gigante aparece. Acerte-o 12 vezes enquanto desvia de seus projéteis. O chefe não pode ser atingido antes dos barcos.
3. **Volta ao Refúgio:** retorne voando pelo portal a oeste da região (siga X decrescente). Só então a campanha é concluída e concede **+3 pontos de treinamento, uma única vez**.

O combate é independente das 7 missões principais e dos contratos diários existentes. O progresso é salvo no navegador e é retomado ao retornar ao portal. Se fechar a página durante a expedição, o dragão reaparecerá **próximo ao portal principal**, com os alvos já destruídos mantidos (não no mapa remoto, que precisa ser carregado novamente). Morra ou retorne antes do chefe e o objetivo não será apagado.

## Configurar gráficos e preferência de GPU

Clique em **⚙ GPU** no HUD para escolher: automático, *preferir alto desempenho* ou *preferir baixo consumo*; resolução interna de 50%, 75% ou 100%; sombras; antialias. Clique em **SALVAR, APLICAR E REINICIAR** para aplicar. A configuração gráfica anterior (AUTO/LEVE/EQUILIBRADO/DETALHADO, tecla G) continua disponível. O painel informa a GPU exposta pelo navegador quando houver autorização.

**Importante:** WebGL permite informar ao navegador uma *preferência*, mas **não escolher/forçar qual placa física executará o jogo**. Para selecionar GPU dedicada em notebooks com duas placas, configure Chrome/Edge em Configurações do Windows > Sistema > Tela > Elementos gráficos > Opções > Alto desempenho (o nome pode variar). Reinicie o navegador se necessário. Informação da GPU também pode ficar oculta por privacidade.

O modo LEVE é recomendado para PCs fracos; desligar antialias e sombras e reduzir resolução também ajuda. O ambiente de teste automatizado não executa o WebGL na GPU real do usuário: os ganhos de FPS e o funcionamento visual devem ser verificados no navegador.

---

# Asas de Brumária v1.3.3 — Física, resgate e missões diárias

**Atualização incremental baseada na v1.3.2**: sem reiniciar a história nem modificar a chave de salvamento anterior.

## Melhorias principais

- **Resgate dos filhotes (missão 6):** cada filhote exige aproximação a menos de 9,5 m, voo estabilizado a no máximo 12 m/s por 1,25 segundo e **transporte individual de volta ao santuário da Ilha do Refúgio**. A entrega exige entrar no círculo com baixa velocidade. Os três transportes concedem uma única recompensa final. O filhote acompanha visualmente a montaria e o minimapa destaca o refúgio quando há filhote a bordo.
- **Progresso retomável:** ao salvar enquanto carrega um filhote, a carga é restaurada; saves anteriores continuam no mesmo estágio, sem completar etapas automaticamente. Os estados novos são opcionais.
- **Dias persistentes:** 1 dia no jogo = 12 minutos. O relógio mostra DIA e horário; a tecla N continua avançando três horas e pode passar para o dia seguinte.
- **Quatro contratos diários:** Correio dos Céus (Iara), Ervas do Refúgio (Lume), Fragmentos da Forja (Borin) e Suprimentos de Emergência (Nara, nova moradora). Contratos concluídos reabrem no dia seguinte; os incompletos permanecem em andamento, inclusive após sair e retornar. Rotas diárias alternam posições de modo reprodutível; o quadro de tarefas aparece no estábulo.
- **Física do personagem:** a descida ao caminhar por desníveis tem gravidade progressiva e limite de velocidade, em vez de encaixe vertical instantâneo. Pequenas inclinações do corpo acompanham o terreno sem afetar a cápsula de colisão.
- **Gráficos leves:** luzes locais secundárias são desativadas em LEVE/EQUILIBRADO conforme o custo, preservando a iluminação global e os objetos; marcadores de missão utilizam geometria simples existente.

## Como testar

1. Atualize a página com Ctrl+F5 e continue sua partida.
2. Abra o estábulo com **T** e veja **QUADRO DE MISSÕES**; fale com os quatro moradores para aceitar os contratos.
3. Pressione **N** para avançar o relógio de três em três horas: após a virada do dia, contratos já concluídos estarão disponíveis novamente.
4. Na missão **FILHOTES PERDIDOS**, aproxime-se com o dragão, reduza a velocidade e mantenha-se próximo até recolher. O destino será o santuário no Refúgio. Repita para os três filhotes.
5. Para comparar desempenho, use **F3** (diagnóstico) e **B** (comparador de FPS).

**Validação:** 292 testes automatizados passaram, incluindo simulação completa do resgate e retomada de save, testes do calendário diário e física do personagem. A execução visual em GPU real ainda precisa ser confirmada no navegador. A versão Windows é um inicializador de jogo web, não um EXE nativo; a primeira execução pode requerer internet para o Three.js.

---

# Asas de Brumária v1.3.2 — Combate otimizado + comparador real de FPS

**Foco:** reduzir pequenas pausas ao soltar fogo e medir o desempenho dos três perfis gráficos **no navegador do próprio jogador**.

## Principais mudanças

- **Partículas reutilizadas:** explosões e efeitos agora usam pools fixos de partículas já criadas no carregamento. Cada tipo reutiliza posição, velocidade e estado de animação; a quantidade ativa permanece limitada pelo orçamento de qualidade. Evita gerar centenas de objetos temporários durante longas batalhas.
- **Projéteis totalmente reutilizados:** o jogo pré-cria até 28 projéteis com malhas, materiais compartilhados e vetores de velocidade e recicla o registro completo durante o combate. Também remove alocações de vetores/listas desnecessárias durante a mira automática.
- **Comparação FPS no próprio hardware:** durante o jogo, pressione **F3** para abrir diagnósticos e **B** (ou o botão **COMPARAR FPS**) para iniciar a medição. O jogo mantém a **mesma cena congelada**, sem avançar missões, ataques ou física, e mede **LEVE → EQUILIBRADO → DETALHADO**, com 0,8 segundo de aquecimento e 4 segundos de amostragem por modo. O teste dura aproximadamente 15 segundos, sem considerar carregamento e latência do sistema.
- **Resultados úteis:** FPS médio, FPS 1% low, tempo do quadro p95, quadros longos de 50 ms ou mais, chamadas de renderização (draw calls) e triângulos. Use **COPIAR RESULTADOS** para enviar os números. Pressione **B** novamente para cancelar.
- **Segurança:** ao cancelar, trocar gráficos, perder o contexto gráfico ou sair da aba, o teste para e restaura a qualidade anterior. O teste **não altera salvamentos nem preferências de qualidade** e não acelera nem avança a partida.

### Como obter um comparativo confiável

1. Inicie a aventura e fique parado olhando para uma cena representativa (por exemplo, com dragões e alguns efeitos ativos).
2. Pressione **F3**, depois **B**. Não mova o personagem nem a câmera durante a comparação.
3. Aguarde os três perfis terminarem e copie os resultados. O painel restaura automaticamente a qualidade anterior.
4. Repita em outra área, inclusive junto de construções ou durante batalhas, para verificar os gargalos.

**Importante:** os resultados são tempos reais de quadros no navegador do dispositivo que executa o teste; **não são benchmarks de GPU realizados neste ambiente**. O jogo mede renderização de uma cena estática, não a execução completa da lógica de combate. Os números podem variar com navegador, resolução, temperatura, drivers e programas abertos. Não prometemos FPS fixo.

**Testes:** `npm run check` valida 269 testes automatizados (252 anteriores + 17 novos). Verificação de lógica, sintaxe e imports; não substitui testes de WebGL nem controle físico. A compatibilidade dos saves, missões, controle e GLB é preservada.

---

# Asas de Brumária v1.3.1 — LOD geométrico e animações do herói

Esta atualização substitui a malha 3D completa dos dragões distantes (quando LOD=limited) por uma silhueta original de **cinco malhas** com geometrias e materiais compartilhados. Os dragões próximos continuam usando sua forma detalhada. As partes simplificadas não projetam sombras nem executam animações de asas por quadro. Nas distâncias ocultas, nenhum dos dois modelos é desenhado.

O personagem procedural ganhou uma animação discreta de respiração quando parado, pivô de cabeça para olhar suavemente e joelhos mais flexíveis durante a corrida. A animação de montaria foi preservada, e a importação opcional de GLB continua usando as próprias animações do modelo quando presentes.

Durante a perseguição, os inimigos reutilizam vetores temporários para cálculos de destino, direção e fogo, evitando criar novos vetores a cada atualização. F3 informa quantos dragões estão usando as malhas simplificadas.

**Testes:** 252 verificações automatizadas, incluindo testes de construção efetiva das malhas, reuso de recursos 3D, animação e integração. A validação visual e o ganho real de FPS dependem de teste WebGL em GPU real. Missões, arquivos GLB, controles e saves mantidos. O jogo é Three.js no navegador; o pacote Windows fornece um inicializador local e não um EXE nativo.

---

# Asas de Brumária v1.3.0 — LOD de personagens e desempenho de combate

## Melhorias nesta versão

- **LOD visual de personagens:** dragões selvagens, sentinelas e moradores deixam de renderizar quando estão longe ou fora do campo de visão. O raio aumenta nos modos EQUILIBRADO e DETALHADO.
- **Animação adaptativa:** personagens em distância intermediária atualizam braços, asas, caudas e cabeças a até 10 vezes por segundo, em vez de 60. Perto do personagem, permanecem com animação completa.
- **Sentinelas preservadas no combate:** o comportamento e os ataques continuam atualizados a cada quadro dentro de 190 m; patrulhas acima desse alcance usam simulação agrupada a 5–8 vezes por segundo nos perfis leves. No modo DETALHADO, a simulação continua por quadro.
- **Interações intactas:** vincular dragões, conversar e encontrar alvos continuam possíveis mesmo quando os objetos visuais distantes estão ocultos. Perto dos personagens, o LOD volta imediatamente para completo.
- **Diagnóstico F3:** acrescentada contagem de personagens renderizados e animações com frequência limitada.
- **Arquitetura:** regras de distância, direção e orçamento em `src/systems/ActorLOD.js`, independentes das malhas 3D e dos dados salvos.

**Limitações:** as distâncias são políticas conservadoras aproximadas, não modelos simplificados de triângulos (LOD geométrico tradicional). A renderização WebGL completa e o FPS em uma GPU de entrada ainda precisam de medição prática. Não há ganhos de FPS garantidos por estes testes.

**Testes:** 238 testes automatizados em `npm run check` (219 existentes + 19 novos). Nenhuma mudança no esquema dos saves, missões ou controles.

---

# Asas de Brumária v1.2.9 — Cenários otimizados por distância

**Atualização técnica de desempenho para PCs modestos.** As 25 nuvens (125 partes visuais) agora são renderizadas em **um único lote instanciado**, sem criar 125 objetos 3D independentes. A animação dos lotes é feita com frequência reduzida em modo LEVE, preservando o movimento suave entre mudanças de vento.

A vegetação deixa de usar um único lote espalhado pelo mapa inteiro: árvores, rochas e arbustos passam a ser distribuídos em lotes por ilha, o que permite ao Three.js descartar lotes fora da câmera e ocultar detalhes de ilhas muito distantes. A distância aumenta com a altitude e usa margem de transição para evitar alternância incessante na borda do alcance. **Colisão, terreno, missões e objetos interativos não são ocultados por essa técnica.**

**Diagnóstico F3:** agora também informa quantas ilhas estão exibindo vegetação detalhada e a quantidade de lotes das nuvens. Qualidade DETALHADA mantém a vegetação próxima com todos os detalhes e oculta apenas lotes decorativos muito distantes (a partir de cerca de 520 m, com margem e ajuste pela altitude); terreno e colisões permanecem ativos.

**Validação:** 219 testes automatizados aprovados (206 existentes + 13 novos), verificação de imports e sintaxe. O desempenho real em GPU fraca ainda precisa ser medido no navegador; não há promessa de FPS específico.

---

# Asas de Brumária v1.2.8 — Confiabilidade e diagnósticos

- **GLB persistente:** a gravação no IndexedDB agora só é confirmada depois que a transação termina; falhas de commit exibem aviso, sem falso sucesso.
- **GLB sem corrida assíncrona:** selecionar um modelo ou restaurar o original impede que uma restauração antiga sobrescreva a nova escolha enquanto carrega.
- **Recuperação WebGL:** detecta perda/restauração do contexto gráfico e volta ao perfil LEVE para segurança, com aviso na tela.
- **Erros de jogo visíveis:** falhas inesperadas de quadro exibem uma tela com erro e botão de reinicialização em vez de congelar silenciosamente; salva o progresso quando possível.
- **F3 — Diagnóstico:** FPS, draw calls, triângulos, geometrias, texturas, tiros e partículas são exibidos uma vez por segundo, facilitando análises futuras.
- **Segundo plano:** pausa o trabalho pesado e reinicia a medição de FPS quando a aba está oculta.
- **WebGL:** removida a perda de contexto forçada no teste inicial.
- **Compatibilidade:** missões, controle, voo, progressão e saves anteriores mantidos. Não foi adicionado nenhum GLB de terceiros.

**Validação:** 206 testes automatizados, incluindo testes comportamentais de falha de transação e de diagnóstico. O navegador Chromium deste ambiente não permitiu acesso ao servidor local; portanto o WebGL visual ainda precisa de validação em um dispositivo com GPU.

---

# Asas de Brumária v1.2.7 — Importação de GLB funcional

**Corrigido:** a versão anterior não tinha nenhum arquivo GLB instalado e mantinha o carregamento desativado. Agora a importação é feita no jogo, por arquivo local, com diagnóstico de erros e uma demonstração original.

1. Abra o jogo e inicie a aventura.
2. Pressione **T** para abrir o estábulo.
3. Na seção **PERSONAGEM 3D · GLB**, clique **TESTAR MODELO DEMO** para conferir o importador, ou **IMPORTAR GLB** e selecione um `.glb` do computador.
4. O modelo passa a aparecer **andando e montado no dragão**; se o arquivo tiver clips com nomes Idle/Walk/Run/Ride, eles serão utilizados.
5. O jogo tentará salvar o arquivo no armazenamento local do navegador (IndexedDB) para carregar novamente nas próximas sessões. Se estiver no modo privado, pode não ser possível salvar.
6. Use **VOLTAR AO ORIGINAL** para desfazer a substituição e limpar o arquivo salvo.

O jogo **não envia o modelo para servidores**. A seleção de arquivo fica no navegador. Limite GLB: 48 MB; para armazenamento persistente, 20 MB. Não é compatível diretamente com arquivos FBX/OBJ/ZIP; converta para GLB no Blender. Exporte sem Draco, Meshopt nem texturas KTX2, que exigem decodificadores adicionais.

A demo é uma figura simplificada criada para verificar a importação, não um asset de produção. O importador usa o GLTFLoader oficial Three.js r180 e SkeletonUtils (licença MIT). Os arquivos podem ser guardados pelo inicializador Windows ou Python ao iniciar com internet, e no GitHub Pages ficam junto ao jogo.

**Atenção:** arquivos de até 20 MB são salvos em IndexedDB da origem atual. A mudança de endereço/porta/navegador não compartilha os arquivos GLB, mas os salvamentos das missões permanecem independentes.

# Asas de Brumária v1.2.6 — Fogo otimizado e modo leve

## O que mudou
- Explosões agora usam quatro grupos de instâncias 3D (um por tipo), sem criar uma malha por partícula. Limite simultâneo por tipo: 14 em LEVE, 32 em EQUILIBRADO e 60 em DETALHADO.
- Projéteis são reutilizados (pool), limitados a 12/20/28 conforme o perfil. Fogo inimigo não pode ocupar todos os espaços e impedir permanentemente os disparos do jogador.
- Removidas luzes dinâmicas individuais dos tiros, reduzindo o custo de iluminação, GPU e descarte de memória durante batalhas.
- Chuva e HUD usam orçamentos variáveis, evitando trabalho desnecessário nos dispositivos mais modestos.
- Gráficos automáticos iniciam em LEVE com até 4 GB de memória informada pelo navegador, EQUILIBRADO em aparelhos sem classificação e detalhado em desktops com muita memória. O jogo reduz qualidade ao detectar FPS baixo.
- Escala de renderização por perfil: LEVE até 0,72, EQUILIBRADO até 1,00 e DETALHADO até 1,50 pixels físicos por CSS pixel, com sombras desabilitadas em LEVE.
- FPS agora usa tempo real de quadro, não o tempo limitado para física, e não adapta enquanto a tela inicial estiver aberta.
- Áudio desconecta nós temporários depois de tocar. O mapa e indicadores atualizam menos vezes por segundo no modo LEVE.

**Importante:** não há medição garantida de FPS em PCs de terceiros. A bateria de testes mede consistência da lógica, não reproduz a GPU do jogador. Para forçar desempenho, pressione **G** até ver **GRÁFICOS: LEVE** e reinicie a aba após alterar para liberar outros recursos em cache.

Controles, dragões, missões, salvamentos e compatibilidade de controle USB/Bluetooth foram preservados. Testes: `npm run check`.

---

# Asas de Brumária — v1.2.5: Controles e Personagem Melhorado

Esta atualização acrescenta suporte a gamepads padrão no navegador, personagens procedurais mais detalhados, animação modular, separação da entrada física da lógica e um carregador **opcional** de personagens GLB. Veja `docs/ASSETS-GRATUITOS.md` para fontes CC0.

**Controles Xbox/PlayStation (mapeamento padrão):** analógico esquerdo move/guia; analógico direito gira a câmera; A/X no PlayStation interage; B/Círculo volta; X/Quadrado lança fogo; Y/Triângulo abre estábulo; LB/L1 desce; RB/R1 sobe; LT/L2 freia; RT/R2 acelera; clique do analógico esquerdo ativa turbo/andar devagar; clique do analógico direito recentraliza; Start abre o jogo ou o estábulo; Select salva. Setas do controle navegam pelos botões do estábulo com A para confirmar. A identificação depende da Gamepad API do navegador; conecte o controle e pressione um botão para habilitar o acesso.

**Compatibilidade:** teclado e toque mantidos, progresso salvo inalterado. Personagem a pé recebeu novas malhas, rosto, equipamentos, articulações de joelho/cotovelo, transições de caminhada e corrida; a rigagem original da montaria foi preservada. Assets externos não acompanham o ZIP, mas podem ser adicionados ao diretório `assets/models/` de forma opcional. Modelos com licenças proibitivas não são distribuídos.

**Testes:** execute `npm run check` com Node.js; a renderização WebGL e os controles reais ainda requerem testes manuais em computador com GPU e gamepad.

---

# Asas de Brumária v1.2.4 — Colisões por geometria

**Melhoria principal:** cabanas usam limites de caixas alinhadas às paredes, caixotes usam caixas rotacionadas e monumentos utilizam polígonos de 7 e 5 lados, com a coluna afunilada em altura. Árvores, pedras e postes permanecem com volumes circulares por desempenho.

Os mesmos testes de geometria são usados para caminhar, deslizar, voar, aproximar a câmera, desmontar e recuperar posições salvas. O telhado fica acima do personagem que anda a pé, não bloqueando deslocamentos abaixo dele. A geometria é aproximada (volumes simplificados), não colisão de triângulos completos. Missões e saves anteriores continuam compatíveis.

**Testes:** `npm run check` (151 verificações automatizadas). Para Windows: extraia `Brumaria-v1.2.4-Windows.zip` e execute `JOGAR-WINDOWS.bat` com PowerShell habilitado. É necessária conexão no primeiro uso para buscar o Three.js.

---

## v1.2.3 — Melhorias no voo e na câmera

A câmera agora recua diante de obstáculos, e o dragão verifica trajetórias 3D completas para reduzir atravessamentos durante curvas, subidas e descidas. O progresso anterior é preservado. Pressione V para centralizar a câmera e use Ctrl para descer com a montaria. Execute `npm run check` para conferir os 138 testes automatizados.

## v1.2.2 — Colisão nos monumentos

- Cinco monumentos (inclusive o grande obelisco mostrado na captura) agora registram dois volumes sólidos com altura: pedestal e coluna.
- Passagem de personagens através da pedra bloqueada, preservando o deslize ao contornar a base e o voo por cima das partes baixas.
- Ao retomar saves antigos, personagens e dragões dentro de volumes físicos são reposicionados para o ponto seguro mais próximo.
- Testes específicos para corrida, voo, deslizamento, restauração de saves e ausência de colisores faltantes.

## Atualização v1.2.1

Corrige o personagem entrando na plataforma do estábulo: o chão sob a estrutura foi nivelado, o corpo continua apoiado nas bordas e o visual da plataforma foi alinhado com o piso de colisão. Os saves continuam compatíveis. Rode `npm run check` para os testes automatizados.

## Atualização v1.2.0 — Colisões aprimoradas

A plataforma central do estábulo é reconhecida como piso. Caixas, postes, NPCs e fogueira agora bloqueiam o movimento. Subidas muito altas são impedidas sem quebrar o deslizamento; para desmontar, o jogo procura uma área livre e segura. O salvamento mantém o mesmo formato da versão anterior. Confira `CHANGELOG.md` e execute `npm run check` para os testes.

# Asas de Brumária — v1.1.0

Um jogo-protótipo **3D em Three.js** sobre amizade, treinamento e aventuras com dragões. Mundo, personagens e nomes originais. Não utiliza personagens, modelos, áudio nem logos de *Como Treinar o Seu Dragão*.

## v1.1.0 — Asas Articuladas e Câmera Livre

A evolução preserva **as sete missões, os três dragões selecionáveis, os três selvagens, os dois contratos e a chave antiga do salvamento**. O motor continua em Three.js 0.180.0, sem precisar instalar Node.js para jogar.

- **Anatomia das asas:** agora cada asa possui três articulações independentes (ombro, cotovelo e punho) e membranas separadas que acompanham as juntas, em vez de uma superfície totalmente rígida. As poses mudam durante decolagem, cruzeiro, planagem e pouso. As patas dianteiras ganharam ombros e punhos articulados.
- **Câmera orbital:** arraste diretamente sobre a cena 3D para girar a vista; use a **roda do mouse para aproximar/afastar** e **V para centralizar**. Os controles de voo não foram alterados. O movimento da câmera é calculado de maneira independente de quadros.
- **Prévia do estábulo:** o dragão exibido usa as mesmas três articulações de asa do dragão montado.
- **Carregamento mais resistente:** o jogo tenta uma cópia local cacheada do Three.js e depois dois CDNs alternativos (jsDelivr e unpkg). Se a biblioteca ou o WebGL falharem, a interface informa o motivo. O inicializador Python e o inicializador Windows tentam salvar a biblioteca em disco na primeira execução com internet, permitindo abrir offline em execuções futuras.
- **Windows sem Python:** `JOGAR-WINDOWS.bat` inicia um servidor HTTP com o PowerShell integrado ao Windows 10/11, sem instalar Python. `INICIAR-JOGO.bat` continua disponível como alternativa.

**Validação:** 106 verificações automatizadas aprovadas (95 antigas + 11 novas). Servidor HTTP Python devolveu 200 aos módulos testados. **Limitações:** a execução completa do WebGL ainda não foi validada porque o Chromium de automação bloqueou o servidor local (`ERR_BLOCKED_BY_ADMINISTRATOR`). O PowerShell não pôde ser executado neste contêiner Linux e precisa de teste no Windows. Esta versão não contém arquivos GLB rigados nem executável `.exe`; a rigagem é hierárquica por grupos Three.js. A biblioteca Three.js não vem incluída no ZIP e requer internet **no primeiro acesso** para ser cacheada ou carregada por CDN.

### Início rápido (Windows)

1. Extraia o ZIP inteiro em uma pasta (não abra o HTML diretamente).
2. Dê dois cliques em **`JOGAR-WINDOWS.bat`**. Isso abre uma janela do PowerShell e o jogo no navegador. Mantenha a janela aberta.
3. Na primeira execução, permita acesso à internet para carregar/cachear o Three.js. Em execuções seguintes, se a biblioteca estiver em `vendor/three.module.js`, pode funcionar offline.
4. Se a janela não abrir, use o inicializador tradicional `INICIAR-JOGO.bat` (exige Python 3) ou `python start_game.py`.

## v1.0.0 — Vínculos Vivos e Voo Assistido

O jogo evolui o encontro com os selvagens, mantendo a campanha e os salvamentos da v0.9.0. **A domesticação agora não é só pressionar E:** aproxime-se a pé, fique perto durante alguns segundos até o indicador de calma chegar a 100% e só então pressione **E** (ou **CARINHO** na tela). São três interações bem-sucedidas com intervalo entre elas. A barra de calma é temporária, mas o vínculo de até três etapas continua salvo.

- **Faísca (corajoso):** ganha confiança rapidamente, mesmo com passos normais.
- **Zéfiro (curioso):** observa por um pouco mais de tempo, mas permite caminhar normalmente.
- **Neblina (tímido):** se assusta com corrida perto dele. Pressione e segure **Shift a pé** (ou **DEVAGAR** no celular) para caminhar lentamente. Se ele se assustar, aguarde e aproxime-se outra vez.

Os modelos selvagens receberam mais detalhes geométricos no dorso, respiração discreta e novas reações da cabeça, mandíbula e asas conforme o humor. O dragão montado ganhou suavização de curva independente da taxa de quadros e **descida assistida** quando você freia para menos de 7 m/s a até 14 m de altura do terreno, sem manter comandos de subida ou descida. **Ctrl continua descendo manualmente**. O uso de Shift montado continua sendo turbo.

**Compatibilidade:** mesma chave de armazenamento de progresso no navegador e mesmo formato de save v1. A calma momentânea não é persistida de propósito; missões, pontos, desbloqueios, posição e amizade permanecem.

**Validação:** 95 testes automatizados de lógica, sintaxe e integração passaram em Node.js 22. O servidor HTTP respondeu aos módulos testados. A execução gráfica WebGL **não foi validada** nesta máquina: o Chromium de automação não conseguiu inicializar EGL/ANGLE, e o ambiente não conseguiu acessar o CDN de Three.js. Teste no Chrome/Edge do computador com WebGL habilitado e conexão à internet. Esta versão ainda não possui modelos GLB de produção nem compilação EXE nativa e não foi publicada no Replit.

## v0.9.0 — Encontro com os Selvagens

Três dragões selvagens vivem em ilhas diferentes: **Faísca** (Brasa, Ilha das Cascatas), **Zéfiro** (Raio, Ilha do Farol) e **Neblina** (Nimbo, Ilha da Névoa). Cada um tem cores, anatomia e animações procedurais próprias.

Voe até a ilha, pouse, desmonte e aproxime-se do dragão. Ganhe calma permanecendo perto e pressione **E** (ou **CARINHO** no celular) três vezes, esperando entre as interações. Neblina exige passos lentos ou espera após se assustar. Ao conquistar a confiança, você recebe **1 ponto de treinamento** uma única vez. Os encontros de Brasa e Raio desbloqueiam gratuitamente essas espécies no estábulo caso ainda não estejam liberadas. O encontro de Neblina dá a recompensa e o registro da amizade.

O minimapa sinaliza os selvagens restantes em lilás. No estábulo, uma nova lista mostra as ilhas, o temperamento e o progresso individual. A atividade é paralela: as sete missões anteriores permanecem intactas. Os vínculos são mantidos no save v1, inclusive ao atualizar de uma versão antiga.

O pacote contém `.replit` e o servidor Python aceita a variável `PORT` e host remoto para facilitar importação no Replit. **Nenhum site ou jogo foi publicado automaticamente.** O Three.js continua carregado via CDN, e gráficos completos exigem internet e WebGL. Dragões selvagens são modelos geométricos procedurais, não arquivos GLB rigados.

## Como jogar

1. Extraia **todo o conteúdo** do ZIP em uma pasta.
2. **Windows:** clique em `JOGAR-WINDOWS.bat` (não requer Python) ou `INICIAR-JOGO.bat` (requer Python 3 instalado). **Linux/macOS:** execute `python3 start_game.py` nessa pasta.
3. O navegador abrirá o servidor local (geralmente `http://127.0.0.1:8765/`). É necessária **internet na primeira execução** para obter Three.js 0.180.0, que pode ser salvo localmente. Há fallback por dois CDNs.
4. Clique em **COMEÇAR A AVENTURA**. Mova-se até o dragão e pressione **E**.

Alternativa: sirva a pasta com qualquer servidor HTTP local. **Não abra `index.html` diretamente pelo `file://`.** Chrome ou Edge recentes com WebGL são recomendados.

### Comandos

| Tecla | Ação |
|---|---|
| W / S | Andar ou avançar/frear voando |
| A / D | Caminhar lateralmente ou girar o dragão |
| E | Conversar, amansar dragões selvagens, montar/desmontar |
| Espaço | Decolar / ganhar altitude |
| Ctrl | Descer / pousar |
| Shift | Montado: turbo (gasta energia). A pé: caminhar devagar para não assustar Neblina |
| F | Sopro de fogo (liberado após Runas Perdidas) |
| T | Abrir/fechar o estábulo e sistema de treinamento |
| C | Alternar o clima para testes (céu, vento, chuva e tempestade) |
| N | Avançar três horas no relógio ambiental para testes |
| G | Alternar qualidade gráfica: automática, leve, equilibrada e detalhada |
| V | Recentralizar câmera durante exploração ou voo |
| Arrastar sobre o mundo 3D / roda do mouse | Girar câmera / aproximar ou afastar |
| Esc | Fechar o estábulo ou diálogo |
| P | Salvar partida manualmente |
| M | Ativar/desativar áudio |
| R | Voltar à vila |

Em **celulares**, use os botões virtuais de movimento/voo e o botão **ESTÁBULO**. A interface aceita toque, mas o desempenho depende do aparelho.

## Dragões e progressão (mantidos da v0.3.0)

### Três dragões para treinar

- **Nimbo / Asa da Névoa:** início gratuito, equilibrado.
- **Brasa / Fúria Rubra:** custa **2 pontos**, poderoso no sopro de fogo, mas um pouco menos veloz.
- **Raio / Vento Celeste:** custa **3 pontos**, mais veloz, regenera mais energia e tem sopro mais fraco.

São **variantes visuais procedurais** do mesmo modelo-base, com cores, ornamentos próprios de cada espécie e atributos diferentes; ainda não são modelos 3D totalmente distintos nem rigados em GLB.

### Evolução de habilidades

O estábulo fica na **Ilha do Refúgio**, perto da vila. Para **gastar pontos, trocar de dragão ou iniciar circuitos**, retorne até lá e pouse. Abra o painel com **T** ou o botão na interface.

- **Asas fortes:** até 3 níveis; aumenta velocidade normal e turbo.
- **Fôlego:** até 3 níveis; aumenta energia máxima e regeneração.
- **Sopro poderoso:** até 3 níveis; aumenta dano e reduz custo e recarga do fogo.

Cada primeiro nível custa 1 ponto, segundo custa 2, terceiro custa 3. Você ganha pontos concluindo missões e circuitos de treino. O progresso é **compartilhado entre as espécies**.

### Circuito aéreo e sétima missão

No estábulo, clique em **INICIAR CIRCUITO**: voe por três aros dourados, na ordem, em **95 segundos**. Completar rende **1 ponto de treinamento**. Há um intervalo de **25 segundos de tempo de jogo** antes de repetir. A última missão, **Prova do Domador**, é concluída quando você termina um circuito depois do resgate dos filhotes.

### Novidades da v0.4.0 — Vila dos Domadores

**Moradores interativos** (fale com **E** a pé, perto do personagem; no celular o botão muda para FALAR):

- **Iara**, exploradora dos faróis — libera o contrato **Correio dos Céus**. Monte num dragão, entregue três mensagens nos marcadores dourados e volte a falar com Iara para receber **+2 pontos**.
- **Lume**, curandeira — libera **Ervas do Refúgio**. Encontre três ervas verdes **a pé** na ilha inicial; retorne a Lume para receber **+1 ponto** e recuperar resistência.
- **Borin**, mestre da forja — dá orientações sobre o estábulo, habilidades e o circuito avançado.

Você pode realizar os contratos em paralelo com a campanha. Eles só pagam recompensa na primeira conclusão de cada save; o progresso parcial é salvo e restaurado.

**Novo Circuito da Tempestade:** desbloqueado após completar pelo menos um circuito básico, acessível pelo estábulo; cinco aros, **80 segundos**, velocidade mínima de **18 m/s** ao passar pelos aros e **+2 pontos** ao concluir. Ambos os modos compartilham a recarga de 25 segundos.

**Melhorias no dragão:** cadeia hierárquica com seis segmentos de cauda, articulação de cabeça e mandíbula, animação de patas, transição entre bater asas e planar e silhuetas relativas diferentes por espécie. Os modelos continuam **procedurais**; não há rig importado em GLB.

### Novidades da v0.5.0 — Terras Vivas

- **Colisões do cenário:** árvores, pedras e cabanas agora bloqueiam caminhada e avanço do dragão nas alturas correspondentes. Há deslizamento em obstáculos, varredura em vários passos para impedir atravessar paredes no turbo e checagem de altitude para permitir sobrevoar as construções. Ao descer por cima de um objeto alto, o dragão fica sustentado acima do obstáculo até se afastar; não é possível pousar no telhado como solo seguro.
- **Animação aérea:** aceleração vertical suave, transição de decolagem, cruzeiro e pouso; asas com pontas articuladas e mudança do ritmo de batimento conforme o voo. O HUD identifica decolagem e pouso.
- **Dragões visuais:** texturas procedurais geradas em memória com canvas, escamas no corpo, detalhes da sela, sobrancelhas, ornamentos da cabeça e olhos piscando em conjunto com as pupilas. São **modelos 3D procedurais**, não malhas GLB de alta fidelidade.
- **Ilhas vivas:** faixas de espuma costeira, mais tufos de vegetação renderizados com `InstancedMesh` (para reduzir chamadas de desenho), caixas e lanternas decorativas na vila.
- **Salvamento:** mantém a estrutura v1 e os saves anteriores. Os estados de animação não são salvos, sendo reconstruídos ao retomar o voo.

**Atenção:** colisores do cenário são aproximações circulares das formas 3D, não um motor de física completo. Objetos decorativos pequenos permanecem atravessáveis. Jogar em dispositivos móveis mais modestos pode exigir redução da resolução pela configuração do navegador.

### Novidades da v0.6.0 — Céus da Tempestade

- **Clima dinâmico:** quatro condições visuais que se alternam a cada 75–95 segundos de jogo: céu aberto, ventos fortes, chuva e tempestade. Mudam a cor do céu e da neblina, iluminação do mundo, velocidade de deslocamento das nuvens e intensidade de precipitação. Tempestades podem produzir lampejos de relâmpago. A tecla **C** permite alternar manualmente para testar cada condição.
- **Economia de desempenho:** chuva é desenhada com `THREE.Points` e geometrias reutilizadas. A quantidade de gotas diminui em aparelhos com tela de toque.
- **Silhuetas e combate:** Nimbo ganha barbilhões e cristas, Brasa placas e chifres, e Raio aletas aerodinâmicas. O dragão abre a mandíbula e produz brilho no focinho ao atacar, reagindo também quando recebe dano. A paleta dos disparos continua específica de cada espécie.
- **Cinco marcos exploráveis:** totens tridimensionais em cada ilha, mostrados como losangos turquesa no minimapa enquanto não descobertos. Aproxime-se de cada um (até 13 metros horizontalmente, com tolerância vertical para quem está voando) para ganhar **+1 ponto de treinamento uma única vez por marco**. O HUD mostra `EXPLORAÇÃO X/5 MARCOS` e o estábulo apresenta o progresso.
- **Salvamento:** nova posição na campanha NÃO é necessária. O estado de clima e de descobertas é adicionado à mesma chave de save `v1`. Saves da v0.5.0 e anteriores continuam válidos (sem pontos extras dados ao carregar automaticamente).

**Escopo real:** ventos e chuva são efeitos gráficos e atmosféricos e **não alteram a velocidade nem a física de voo**. Os dragões continuam modelos procedurais do mesmo esqueleto, sem rig de animação importado. O clima tem ciclo de dia/noite desde a v0.7.0.

### Novidades da v0.8.0 — Voo Vivo e Performance

- **Vegetação otimizada:** copas, troncos e rochas das ilhas passam a ser desenhados em cinco lotes `THREE.InstancedMesh` (tronco, três camadas de folhas, rochas), em vez de milhares de malhas separadas. Posicionamento, dimensões e volumes de colisão foram preservados. A quantidade real de draw calls depende de materiais/sombras e da GPU.
- **Voo refinado:** curvas de alta velocidade têm sensibilidade mais previsível, inclinação do corpo limitada, inclinação vertical baseada em subida/descida reais, pontas de asas com pequena resposta à curva, cauda articulada acompanhando o movimento e patas ajustadas à decolagem e pouso. O controle W/A/S/D e as teclas de voo continuam os mesmos.
- **Modelo procedimental detalhado:** dentes superiores e inferiores ligados aos respectivos pivôs da cabeça e mandíbula, pequenas cristas cervicais articuladas e garras nas pontas das asas. **Não são** novos modelos GLB e não existe rig de esqueleto externo nesta versão.
- **Qualidade gráfica adaptativa:** começa no perfil recomendado pelo dispositivo; após três amostras consecutivas abaixo de 29 FPS, reduz um nível, com pausa entre mudanças. Após dez amostras acima de 56 FPS, pode aumentar gradualmente. Perfil LEVE reduz resolução interna e desliga sombras. Aperte **G** ou toque em **GRÁFICOS** no HUD para escolher `AUTO`, `LEVE`, `EQUILIBRADO` ou `DETALHADO`. O modo escolhido é salvo separadamente no mesmo navegador e não altera a partida.
- **Compatibilidade:** sete missões, dois contratos, três espécies, marcos, treinos, dia/noite e salvamento `v1` mantidos sem migração.
- **Validação:** 71 testes automatizados passaram (58 anteriores + 13 novos), além de verificação dos arquivos e resposta HTTP do servidor local. A renderização WebGL completa depende do Three.js remoto e não foi comprovada neste ambiente sem acesso ao CDN.

### Novidades da v0.7.0 — O Despertar dos Céus

- **Dia e noite:** ciclo de 720 segundos de jogo por dia, começando por volta de 10:19; sol, lua e estrelas visíveis em seus horários; iluminação, céu e neblina combinados com os quatro estados climáticos. HUD mostra a hora. **N** adianta três horas para testar horários.
- **Vento no voo:** ventos fortes e tempestades agora causam deriva horizontal moderada, limitada a 3,8 m/s, quando o dragão está alto o suficiente. A influência passa pelo mesmo sistema de colisões. Não é uma simulação aerodinâmica completa.
- **Prévia 3D do estábulo:** usa uma instância dos mesmos modelos procedurais do jogo, com botão **VER EM 3D** e rotação por arrastar. Visualizar não compra nem equipa um dragão. Um segundo contexto WebGL só é criado ao abrir o estábulo; em caso de falha, a lista de espécies permanece funcional.
- **Salvamento:** `dayNight` foi adicionado à mesma chave v1 já existente. Saves antigos recebem horário inicial, sem perder missões, contratos, descobertas nem habilidades.
- **Testes:** 58 verificações aprovadas (44 anteriores + 14 novas). Servidor HTTP respondeu corretamente. A renderização gráfica WebGL não foi validada de ponta a ponta: o Chromium headless não concluiu a abertura neste ambiente e o CDN externo não estava acessível para testes.

### Salvamento automático

Partidas são salvas no `localStorage` do navegador: a cada **15 segundos de jogo**, ao montar/desmontar, desbloquear algo, concluir objetivos e quando a página perde o foco ou fecha. **P** força o salvamento manual.

Ao retornar, use **CONTINUAR AVENTURA**. A opção **CRIAR NOVA PARTIDA** pede confirmação e apaga o save local. O sistema mantém: missão e progresso, cristais/orbes/filhotes recolhidos, vida restante dos inimigos, dragão selecionado/desbloqueado, pontos e melhorias, energia/resistência, posição, estado montado/desmontado e estado dos dois contratos da vila, clima e marcos explorados.

**Limitações do save:** válido somente no **mesmo navegador e mesmo endereço de origem**; aba anônima/limpeza de dados pode apagá-lo. Circuitos iniciados, projéteis no ar, temporizadores e posição dos inimigos **não** são preservados na retomada. Se o navegador bloquear armazenamento, é possível continuar jogando sem persistência (P apresenta aviso).

## Campanha principal: sete missões

1. A primeira conexão — monte em seu dragão.
2. O batismo do vento — passe por cinco aros.
3. As runas perdidas — recolha três cristais.
4. Defensores de Brumária — destrua três orbes com fogo.
5. Sentinelas da Tormenta — derrote os três dragões inimigos.
6. Filhotes Perdidos — resgate três filhotes.
7. Prova do Domador — conclua um circuito de treinamento na vila.

## Desenvolvimento e testes

Com **Node.js 20+**, execute `npm run check` para verificações estáticas de imports/sintaxe/IDs de interface e testes de lógica pura. O jogo **não precisa de npm para iniciar**.

Na v1.1.0: **106 testes automatizados aprovados** (95 anteriores + 11 novos), incluindo câmera e rig das asas. Anteriormente, na v0.9.0: **83 testes automatizados aprovados** (71 anteriores + 12 novos) para missões, progressão, salvamento, colisão, voo, clima e descoberta; arquivos verificados por servidor HTTP local. A validação visual completa com WebGL **não foi possível**: o navegador automatizado desta infraestrutura bloqueia endereços locais (`ERR_BLOCKED_BY_ADMINISTRATOR`) e o CDN não está acessível deste contêiner. O jogo deve ser validado em um navegador real, especialmente em dispositivos móveis.

## Organização

```text
asas-de-brumaria/
├── index.html
├── JOGAR-WINDOWS.bat, start_windows.ps1
├── INICIAR-JOGO.bat
├── start_game.py
├── package.json
├── README.md
├── CHANGELOG.md
├── vendor/README.txt (cache externo opcional)
├── src/
│   ├── game/Game.js, Input.js
│   ├── entities/Dragon.js, Hero.js, EnemyDragon.js, VillageNPCs.js, WildDragons.js
│   ├── systems/Missions.js, Training.js, TrainingConfig.js, Progression.js, SaveSystem.js
│   ├── systems/Weather.js, weatherMath.js, Discovery.js, DayNight.js, dayCycleMath.js, WildBonds.js
│   ├── systems/VillageContracts.js
│   ├── systems/Audio.js, Effects.js, combatMath.js
│   ├── world/World.js, Landmarks.js, config.js
│   ├── ui/UI.js, StablePreview.js, style.css
│   └── utils/math.js
├── .replit (configuração opcional para hospedagem)
└── tests/
```

## Próximas prioridades

Modelos GLB rigados individualmente para cada espécie, física aerodinâmica aprofundada e árvores de diálogo com escolhas ainda não estão implementados.


## Expansão das Sete Ilhas — revisão de estrutura, gráficos e desempenho

O arquipélago principal agora possui **sete ilhas exploráveis**. As duas regiões inéditas, **Arquipélago dos Cristais** (X≈-320, Z≈95) e **Ilha das Cinzas** (X≈332, Z≈-110), incluem relevo, vegetação, formações de cristal/basalto com colisores e monumentos descobríveis. Os dois biomas usam **cores de vértice e instanciamento**, sem texturas externas adicionais. As cinco ilhas originais e as sete missões principais continuam no lugar, inclusive nos salvamentos anteriores.

Depois de concluir **dois circuitos de treinamento**, abra o estábulo com **T** e escolha **Travessia das Sete Ilhas**. Esta fase opcional tem **sete checkpoints**, 165 segundos, velocidade mínima de 14 m/s e recompensa de quatro pontos de treinamento. O radar destaca a próxima baliza; os dois monumentos novos concedem pontos de exploração uma vez cada.

**Qualidade sem sobrecarregar o renderizador:** a vegetação decorativa de ilhas distantes deixa de ser desenhada até no perfil detalhado; os novos cristais e pilares de basalto usam só **dois lotes instanciados**; os 15 checkpoints compartilham quatro geometrias e quatro materiais. Quando a taxa de quadros permanece entre 30 e 46 FPS, o modo AUTO diminui a densidade de pixels em passos discretos de 4%, até 16%, **sem reduzir a qualidade de texturas, modelos, sombras ou física**. A resolução retorna gradualmente com desempenho recuperado. Em quedas graves, continuam valendo os perfis gráficos existentes.

A revisão não promete um ganho fixo de FPS: use o benchmark do jogo e o painel **F3** para verificar chamadas de desenho, triângulos e desempenho no seu dispositivo. Os testes de código incluem continuação de saves, desbloqueio do circuito, novas ilhas e controles de qualidade; testes de navegador validam a aplicação renderizada via GitHub Actions.


## Expedições da Fronteira — revisão 146

Os biomas **Arquipélago dos Cristais** e **Ilha das Cinzas** agora têm missões secundárias independentes da campanha original. Sobrevoe cada ilha para encontrar **três fragmentos luminosos** a baixa altitude: são seis no total. É preciso estar montado e em voo e passar a até 8,5 unidades do objeto. Completar os três fragmentos concede **+2 pontos** nos Cristais e **+3 pontos** nas Cinzas. O estábulo (T) exibe a contagem de fragmentos e o estado de cada guardião.

Depois que a campanha desbloqueia o combate aéreo (a partir da missão 4, com estágio interno 3), as ilhas são defendidas pelo **Guardião de Quartzo** e pela **Sentinela de Basalto**. Cada um tem 4 pontos de resistência, patrulha a própria ilha e concede **+2 pontos de treinamento** uma única vez quando derrotado. Os inimigos existentes da história continuam separados e inalterados. As versões antigas de salvamento são convertidas sem reiniciar as missões.

**Desempenho:** cada ilha nova utiliza dois grupos de objetos instanciados (núcleo e aro), totalizando apenas **quatro lotes de desenho** quando as duas regiões estão visíveis. A decoração é ocultada a mais de cerca de 205 m da ilha, com margem de 25 m para evitar cintilação na troca de visibilidade. Os guardiões só são criados ao aproximar-se pela primeira vez a menos de 170 m e são desativados quando o jogador se afasta; continuam usando os mecanismos de LOD do jogo. Um teste automatizado do navegador confirma coleta de todos os fragmentos, ausência de recompensas duplicadas, salvamento e combate.


### Orientação de voo da fronteira — revisão 147

Ao se aproximar do Arquipélago dos Cristais ou da Ilha das Cinzas, o minimapa passa a exibir os **fragmentos ainda não coletados**, em cores próprias para cada bioma. A seta do objetivo aponta para o fragmento disponível mais próximo. Depois de recolher os três objetos, caso o combate já esteja liberado, o objetivo local passa a apontar para o **guardião sobrevivente**. Durante o combate, o indicador de mira reconhece tanto guardiões quanto sentinelas da campanha.

A orientação local só assume prioridade dentro de 125 unidades do centro da ilha e não interrompe **missões nas Montanhas da Sombra, treinamentos ou contratos de moradores**. Ao voltar à vila, os objetivos antigos continuam sendo exibidos. Concluir um objetivo remove o respectivo marcador sem alterar os dados de progresso da campanha.

Esses recursos utilizam o canvas 2D do minimapa e as posições já carregadas das atividades: não adicionam texturas, luzes, inimigos ou chamadas de renderização 3D. Os testes verificam troca de objetivo, distância, combate desbloqueado e preservação das prioridades da história. 


## Revisão 148 — texturas fotográficas CC0 instaladas localmente

Foram baixados e incluídos no repositório **20 mapas de textura WebP** reais, oriundos de materiais **Poly Haven CC0**. Cada superfície possui um mapa de cor (diffuse) e um mapa normal (OpenGL) em duas variantes: **1024×1024** para perfil leve/equilibrado e **2048×2048** no perfil detalhado. Os originais de 2K fornecidos pelos autores foram usados na conversão. Os arquivos locais estão em `assets/textures/terrain/` e a procedência, licença, URLs de origem e hashes SHA-256 ficam em `assets/textures/terrain/manifest.json`.

| Superfície do jogo | Material Poly Haven | Página CC0 |
| --- | --- | --- |
| Refúgio e Cascatas (chão florestal) | forrest_ground_01 | https://polyhaven.com/a/forrest_ground_01 |
| Atol Esquecido (praia) | coast_sand_02 | https://polyhaven.com/a/coast_sand_02 |
| Farol e Névoa (solo rochoso) | rocky_terrain_02 | https://polyhaven.com/a/rocky_terrain_02 |
| Ilha das Cinzas (rocha escura) | dark_rock | https://polyhaven.com/a/dark_rock |
| Arquipélago dos Cristais (solo rochoso) | rocks_ground_06 | https://polyhaven.com/a/rocks_ground_06 |

**Licença:** todos os materiais selecionados foram publicados sob **CC0 1.0** pela Poly Haven (https://polyhaven.com/license). Nenhuma atribuição é obrigatória, mas o crédito é mantido para transparência. O jogo distribui as texturas localmente, sem consultar nem fazer hotlink ao provedor ao jogar; o pipeline de importação verifica o domínio e pode ser reproduzido em `tools/import_polyhaven_textures.py` usando o workflow de GitHub Actions `install-terrain-textures.yml`.

**Desempenho:** o renderizador mantém a coloração por vértice e a malha dos terrenos, sem duplicar a geometria nem adicionar um draw call por textura. Os UVs são contínuos entre os anéis das ilhas e as imagens repetem-se a cada 14 unidades. A variante 2K com normais só é ativada no modo detalhado; perfis leves usam cor 1K e evitam o segundo mapa. Os mapas são carregados apenas próximo das ilhas (190 m + raio) e descarregados com margem de 260 m, liberando recursos da GPU ao afastar-se. Em caso de erro de carregamento, o terreno original com cores de vértice permanece utilizável. Nenhuma colisão, história, controle ou salvamento é alterado.


## Revisão 149 — carregamento progressivo sem travar o voo

O carregamento das texturas fotográficas CC0 foi reestruturado para reduzir travadas ao se aproximar de ilhas ou alternar entre os gráficos Equilibrado e Detalhado. Em vez de iniciar diversas imagens 2K ao mesmo tempo, o `TerrainTextureManager` agora mantém uma **fila sequencial de downloads e decodificação**. O carregamento começa antes da ilha ficar próxima (margem de aproximadamente **245 unidades**), preservando a qualidade e os mapas normais de 2K quando o perfil Detalhado é selecionado.

As imagens são **preparadas na GPU durante períodos ociosos do navegador**, limitadas a uma textura por intervalo de preparação, sempre que o navegador e o driver permitirem. Um **mapa branco compartilhado de 1 pixel** mantém a variante do shader já compilada, sem mudar o aspecto procedural durante a espera. Ao trocar o perfil gráfico, a textura atual permanece na tela até a nova versão estar pronta; mapas antigos são descartados depois que não estão mais em uso. As texturas de uma ilha deixam de ser solicitadas quando o jogador se afasta, mas permanecem em cache temporário por **18 segundos**, reduzindo recarregamentos ao fazer curvas ou retornar rapidamente à região.

**Diagnóstico:** pressione **F3** para verificar a quantidade de mapas residentes, arquivos na fila, downloads e uploads ociosos. O recurso é destinado à observação de travadas; a redução real no tempo de quadro depende de navegador, GPU, velocidade de armazenamento e internet. Texturas, geometrias e missões originais continuam no jogo.


## REV150 — menu principal cinematográfico e leve

O menu principal agora possui uma arte vetorial inédita das ilhas e de um dragão voando (`assets/menu/brumaria-sky.svg`), céu iluminado, hierarquia de textos mais legível, painéis com as áreas da aventura e botões separados para **Iniciar/Continuar**, **Nova Partida** e **Configurações**. Há orientação de comandos sem cobrir a tela, suporte às proporções de PC/celular, controle/teclado e à preferência de reduzir animações. O visual é implementado com `src/ui/mainMenu.css`, independente do HUD de gameplay.

**Desempenho:** o menu não renderiza frames WebGL nem executa atualizações do mundo, física, IA, câmera, clima, texturas ou salvamento periódico enquanto `Game.started` está falso. O loop fica apenas verificando controles de entrada, inclusive o botão Start de gamepad. A arte é SVG/CSS pequeno, sem modelos 3D, texturas 2K ou vídeos adicionais. O botão Iniciar permanece desabilitado até terminar a inicialização do jogo, e o mundo volta a rodar ao clicar. Saves anteriores são preservados. A checagem automatizada em `tests/browser-main-menu.mjs` testa essa pausa, as configurações e o retorno ao gameplay em desktop e celular.

### LOD de cenário por ilha (v1.4.23)

A renderização usa `src/world/IslandDetailStream.js`, um agendador de lotes visuais por região inspirado no padrão de LOD do Driver 2: terreno/colisões e objetivos existem desde o início; copa das árvores, troncos, pedras, grama, flores e espuma são criados sob demanda. O cache é reutilizado no retorno às ilhas; recursos fora da faixa podem ser liberados. A cada frame, somente um lote pode ser construído, com priorização da costa mais próxima. Durante o Play, os detalhes do ponto de partida são preparados antes da pré-compilação dos shaders. A qualidade Detalhada continua mostrando todos os lotes quando a ilha está próxima. F3 exibe as estatísticas de streaming e renderização.
