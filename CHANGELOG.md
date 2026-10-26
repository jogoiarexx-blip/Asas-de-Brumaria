## v1.4.21 — LOD de texturas por distância, com memória controlada

- Cada ilha determina sua própria qualidade de textura pela distância da costa, independentemente de outras ilhas do mesmo bioma.
- 512 px para ilhas distantes, 1024 px em média distância e, no perfil Detalhado, 2048 px mais normal map quando próximo. Em Equilibrado/Econômico, 1024 px continua sendo a resolução máxima esperada.
- Cinco previews WebP de 512 px criados localmente a partir dos originais CC0 sem baixar outra textura ou alterar os mapas 1K/2K. Transferência total dos cinco: 276.630 bytes (~270 KiB).
- Histerese nos limiares para evitar ficar trocando repetidamente quando o jogador circunda a praia. O detalhamento é progressivo sem congelar a simulação.
- Um download/decodificação/upload de GPU por vez, ordenado pela distância ao jogador; mapa atual continua exibido até a nova imagem estar pronta.
- Ilhas do mesmo bioma compartilham os mapas residentes para economizar memória, mas podem exibir resoluções diferentes ao mesmo tempo.
- Imagens antigas deixam de ocupar a GPU assim que não são mais utilizadas; as ilhas que saem de alcance voltam a um preview leve e o restante é liberado após 18 s sem retorno.
- O material normal neutro entra no aquecimento antecipado de shaders para evitar compilar o PBR de qualidade no primeiro encontro. Sem redução da qualidade de perto.
- 5 novos testes de regressão e teste de fila real com carregador simulado: 524 testes locais aprovados.

## v1.4.20 — Preparação gráfica progressiva ao iniciar a partida

- Após INICIAR/CONTINUAR, a simulação permanece parada enquanto o jogo prepara os recursos 3D necessários; o menu 2D exibe barra de progresso e descrição da etapa atual.
- Aguarda o modelo principal de dragão por tempo limitado; instancia antecipadamente guardiões inativos sem iniciar sua IA, preservando o progresso salvo.
- Percorre personagens, inimigos invisíveis, criaturas, vegetação, terreno e efeitos. Evita recompilar variantes idênticas e considera instancing, skinning, cores de vértice e sombras.
- Faz upload antecipado das texturas já prontas usando renderer.initTexture, e compila lotes de shaders com renderer.compileAsync usando materiais/geométricas reais em uma cena temporária; libera a cena provisória sem liberar os recursos do jogo.
- Executa uma renderização 3D estática de preparação para iniciar recursos de sombras, sem rodar world.update, NPCs, animações ou física no menu.
- O streaming de mapas de terreno segue em segundo plano pelo agendador existente; a qualidade gráfica escolhida é mantida e falhas de preparação não bloqueiam a partida.
- Acrescenta 4 testes de regressão (total local: 519 testes aprovados).

## v1.4.19 — câmera de perseguição, HUD compacto e disparo intencional

- A câmera acompanha suavemente a direção do dragão montado ou do personagem ao caminhar, sem ultrapassar ±180°. Arraste do mouse e analógico direito têm prioridade temporária para explorar os arredores; V realinha atrás do personagem.
- Interface de jogo compacta: missão mostra objetivo curto com detalhes sob demanda; minimapa reduzido; relógio e modo permanecem visíveis, enquanto gráficos/GPU/FPS/clima/controles ficam no botão ☰ MENU. Estábulo e barras de energia/vida permanecem acessíveis. Informações de diagnóstico e mensagens extensas não ocupam o centro do voo.
- Animação de ataque somente após disparo real autorizado; diálogo não admite tecla F como combate, teclas são soltas se a página perder visibilidade. GLBs sem Idle nunca usam Attack/Hurt como animação padrão.
- Testes regressivos adicionados para perseguição angular, animação de ataque e controles básicos do HUD.

## v1.4.3 — Novo contrato de fogo e flores instanciadas

- Novo contrato repetível de Suri: Chamas dos Faróis, três alvos atingidos com o sopro, +3 pontos ao entregar.
- Novos braseiros com sinalização clara no mapa, mira assistida de curto alcance e objetivo explicado no HUD.
- Progresso gravado por baliza, protegido contra múltiplos acertos, válido para salvamentos anteriores e reiniciado apenas no dia seguinte.
- Flores decorativas coloridas em lotes instanciados por ilha com visibilidade conforme a qualidade; sem impacto nas colisões.
- 11 testes de regressão novos, preservando os testes existentes. A GPU real ainda precisa ser avaliada.

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

## v1.4.1 — Missões mais claras e gráficos mais detalhados

- Bússola contextual com direção, distância, altitude e nome do objetivo, inclusive sentinelas e santuário dos filhotes.
- Tavi e missão aérea diária Vigília dos Horizontes (três balizas, retorno ao NPC, recompensa); reaberta no dia seguinte sem perder progresso.
- TerrainPalette: areia/grama/rocha em transições suaves por altura e encosta; materiais de água aprimorados sem malhas extras.
- Chuva com textura de filete transparente, em vez de sprites quadrados.
- Correção de sobreposição do aviso do portal no minimapa e indicação da vila na última missão.
- Sem novos downloads de modelos ou texturas externos.

---

## v1.4.0 — Contra-ataque, IA evasiva e física de voo

- Abertura pós-sopro do dragão gigante: dano dobrado com janela de 1,05/1,30 s, com aviso no HUD, interrupção de ataque e reação visual de cambalear.
- Ataque adicional de varredura diagonal, anunciado por anel roxo na segunda fase; até 3 projéteis de trajetória fixa.
- Sentinelas alteram rota após sofrer dano e combinam recuo e flanqueamento conforme distância e resistência.
- Suporte aerodinâmico de voo: descida suave em baixa velocidade, impulso moderado ao mergulhar e arrasto ao subir; sem modificar colisões ou progressão.
- Correção de velocidade da reação de cambalear do dragão gigante.
- Novos módulos puros: BossCounter.js, EnemyTactics.js e Airflow.js.
- 410/410 testes automatizados aprovados; alterações compatíveis com os salvamentos anteriores.
- Sem benchmark de GPU real; desempenho visual ainda exige confirmação prática.

---

## v1.3.9 — Física de contato e táticas do chefe

- Corrigido bug em que `visual.position.y` era atualizado duas vezes e escondia o efeito de contato após decolar ou pousar.
- Incluído `TerrainResponse.js`: amostragem de inclinação, flexão do dragão em encostas e tração reduzida quando caminha em terrenos inclinados.
- Incluído `BossTactics.js`: patrulha reativa à posição do jogador, com aproximação, recuo e perseguição controlada na fase avançada. Movimento limitado à arena; aviso de ataques preservado.
- Incluído `ShipSplash.js`: ondas temporárias de naufrágio de baixo custo. Somente três malhas e nenhuma luz dinâmica nova; partículas de destroços existentes preservadas.
- Carregamento/descarregamento de mapa limpa corretamente os recursos visuais. Saves e controles anteriores mantidos.
- Total de 391 testes automatizados aprovados, incluindo 13 novos. Nenhum benchmark GPU foi executado.

---

## v1.3.8 — Decolagem e aterrissagem, afundamento e patrulha do chefe

- Adicionados FlightContact.js, ShipDamage.js e BossMotion.js com regras determinísticas, testáveis sem GPU.
- Melhores movimentos das patas e asas ao encostar no solo e ao levantar voo; poeira opcional conforme qualidade e presença de chão.
- Após dois ataques, o barco afunda visualmente enquanto três fragmentos giram e descem. Destroços renderizados em um lote instanciado para os três barcos.
- O chefe movimenta-se em torno da fortaleza, altera a patrulha abaixo de 50% de vida e para durante o aviso de ataque.
- Registros de missões, contratos e salvamentos antigos mantidos.
- 378 testes passaram, nenhum erro; medição WebGL/FPS real pendente.

---

## v1.3.7 — Pouso em terrenos inclinados, impacto e batalha variada

- Introduzida inspeção de pouso com superfície caminhável, inclinação em oito pontos, velocidade e obstáculos; impede contato automático com oceano e bordas perigosas.
- Corrigida checagem da velocidade vertical: utiliza valor anterior ao bloqueio físico para não aceitar descida excessiva.
- Impulso visual em colisões fortes e estilhaços instanciados com cooldown, sem novas luzes ou objetos gráficos permanentes.
- Dragão gigante alterna disparos direcionados, leque e alturas diferentes, limitado a três projéteis por ciclo.
- Alertas específicos, cores diferentes do anel e janela de aviso de 0,95 s preservada quando a vida cai para a segunda fase.
- Total: 364 testes automatizados aprovados (26 novos), sem alterações nos salvamentos.

---

## v1.3.6 — Esquivas, combate tático e chefe danificado

- Esquiva aérea lateral com Q/R3/toque, recarga, custo de energia, tempo de invulnerabilidade e colisão mantida.
- Sentinelas com aproximação lateral limitada e previsível em vez de perseguição sempre em linha direta.
- Mira antecipatória limitada do dragão gigante: sem mísseis teleguiados, com aviso de sopro preservado.
- Três marcas luminosas e efeito de impacto no chefe conforme a resistência cai; progresso da missão continua compatível com saves antigos.
- HUD apresenta estado da esquiva e recarga.
- 18 testes de regressão novos (338 no total), sem alterar os dados salvos nem os recursos do mapa.

---

## v1.3.5 — Transição robusta e chefe sinalizado

- Regressão corrigida: chegada ao portal antes de concluir o carregamento dinâmico não deixa o jogador atravessar para uma região vazia.
- Ataque do dragão gigante agora conta com aviso visual, ciclo previsível e segunda fase acelerada. Timer de combate é reiniciado ao sair de alcance.
- Primeiro acerto nos barcos altera o visual das velas.
- Rochedos das montanhas migrados para InstancedMesh; colisores preservados.
- Geometrias e materiais compartilhados liberados uma vez durante o unload.
- 12 testes adicionais (320 no total), incluindo integração dos objetos 3D com stubs e verificações do temporizador de ataque.
- Sem alterações no formato dos salvamentos.

---

## v1.3.4 — Segunda região em streaming e batalhas de chefe

- Novo módulo carregado dinamicamente `src/world/MountainRegion.js`, com terreno montanhoso original, pedras, oceano, três barcos 3D e dragão colossal animado.
- Portal a leste: geometria, materiais e colisões da região são criados apenas quando o jogador se aproxima voando; ao voltar, recursos são liberados para PCs mais fracos.
- Campanha paralela com sequência barcos (2 disparos cada), chefe (12 disparos), retorno e recompensa não repetida; HUD e minimapa atualizados.
- Salvos antigos compatíveis: campo opcional `expedition`; a história principal, os contratos e os GLBs não são substituídos.
- Painel `⚙ GPU` para WebGL powerPreference (apenas sugestão ao navegador), resolução escalonada, sombras, antialias e identificação da GPU quando permitida.
- Testes de missão, carregamento/descarregamento, colisões, persistência e sanitização de opções. Renderização real e FPS requerem teste no navegador do usuário.

---

## v1.3.3 — Novas missões, resgate e física

- Novo ciclo de **dias numerados** persistidos sem perda de saves v1.
- Quatro contratos repetíveis por dia, com reset somente de missões concluídas e preservação de tarefas ativas.
- Nara é uma nova moradora; correio, ervas, fragmentos de minério e suprimentos contam com rotas alternadas a cada dia.
- Missão de filhotes não é mais um simples voo por proximidade: aproximação lenta, estabilização, recolhimento, transporte ao santuário e entrega individual.
- Filhote transportado e progresso de resgate persistem em save, inclusive após reinicialização.
- Física de descida gradual e inclinação visual suave do personagem em terrenos irregulares.
- Luzes locais não essenciais desligadas em gráficos LEVE/EQUILIBRADO para reduzir custo.
- Quadro de missões diárias adicionado ao estábulo; minimapa mostra santuário durante transporte.
- 292 testes automatizados aprovados, incluindo execução simulada completa da missão; renderização GPU não validada neste ambiente.

---

## v1.3.2 — Renderização, alocações do combate e benchmark comparativo

- `ReusableSlots.js`: pool de objetos de capacidade fixa, com retirada, reciclagem e limitação de instâncias ativas.
- `Effects.js`: partículas de fogo/explosões usam vetores pré-alocados e slot reutilizável; mantém instancing por tipo.
- `Game.js`: projéteis pré-criados, com reciclagem do registro e do vetor de velocidade; mira automática evita clones e arrays intermediários.
- `GraphicsBenchmark.js`: medição real de quadros no navegador, 0,8 s de aquecimento + 4 s de amostra por perfil, percentual 1% low e latência p95; resultados copiáveis no painel.
- Durante o benchmark a jogabilidade/IA fica pausada para manter a mesma cena e não causar mortes ou mudanças na progressão; ao finalizar/cancelar os gráficos anteriores são restaurados.
- Novos atalhos `B` e botões no painel F3. Sem mudança em saves ou controles anteriores.
- 269 testes automatizados aprovados (17 testes adicionais); sem medição real de FPS em GPU neste ambiente.

---

# v1.3.1 — Malhas simplificadas, animações e combate com menos alocações

- Novo módulo `src/entities/DragonProxy.js`: proxy geométrico com 5 malhas, poucas faces, geometrias compartilhadas, materiais reutilizados e sem sombras.
- Dragões selvagens e sentinelas alternam automaticamente entre modelo detalhado, proxy e ocultação usando o LOD já existente (qualidade de vídeo, distância e direção da câmera).
- Preservadas a lógica de IA e vínculo, as colisões, o combate próximo e as posições dos grupos originais.
- Herói procedural com respiração de repouso, pivô animado na cabeça e articulação aprimorada dos joelhos em corrida e montaria.
- Inimigos reutilizam vetores para perseguição e disparos, com menos objetos temporários por quadro.
- Painel F3 indica quantos dragões estão com malha simplificada.
- 252 testes automatizados: 238 anteriores + 14 novos, incluindo quatro testes de construção real de proxies com implementação mock da API 3D.
- Limitação: sem medição FPS em dispositivo real ou validação visual de todas as trocas LOD via WebGL; não é um LOD de rig completo.

---

## v1.3.0 — LOD de personagens e atualização inteligente

- Dragões selvagens, sentinelas e moradores passam a usar controle de visibilidade por distância e direção da câmera.
- Animações em média distância limitadas a 10 Hz; próximas, mantidas por quadro; distantes/fora de visão, omitidas.
- IA de sentinelas em combate próximo preservada sem atrasar ataques. Patrulhas longínquas recebem atualização de intervalo variável conforme a qualidade, sem alterar missões.
- Painel F3 informa número de personagens ativos e quantos têm animação de baixa frequência.
- Regras reunidas em `ActorLOD.js` com testes de segurança, combate, visão e recuperação de atualização ao aproximar.
- 238 testes automatizados aprovados, 0 falhas. Não foi possível realizar benchmark visual em GPU real.

---

## v1.2.9 — Desempenho do cenário e culling seguro

- Nuvens: substituídos 125 Mesh individuais por um InstancedMesh único; atualizações das matrizes reduzidas a 10–60 Hz conforme qualidade, usando animação contínua e acumulada para evitar saltos ao mudar o vento.
- Floresta: batches de árvores e pedras organizados por ilha para frustum culling mais eficaz. Matrizes estáticas são criadas apenas na carga inicial.
- Grama: batches existentes por ilha passam a ocultar detalhes distantes em LEVE/EQUILIBRADO. Em DETALHADO, mantêm toda a vegetação.
- Distância de detalhe adaptada à altura da câmera e com histerese de 24 metros. Apenas visual é ocultado: colisões e missões continuam ativas.
- F3 mostra o número de ilhas com vegetação ativa e indica nuvens desenhadas em um lote.
- 13 testes novos de política de visibilidade, animação de nuvens, regressões e integração; total: 219 testes.
- Resultados de FPS precisam ser confirmados em GPUs físicas e no navegador WebGL.

---

## v1.2.8 — Confiabilidade, estabilidade e diagnóstico F3

- Corrigida confirmação prematura da gravação de GLB no armazenamento local; o resultado agora depende de transação concluída.
- Corrigida a substituição do modelo recém-importado por modelo antigo salvo após carregamento assíncrono.
- Tela de erro recuperável após exceção no quadro, com opção de recarregar, e avisos para perda de contexto WebGL.
- Diagnóstico F3 de chamadas de desenho, triângulos, uso de GPU, projéteis, partículas e FPS para reproduzir travamentos em PCs fracos.
- Trabalho gráfico pausado quando a aba estiver oculta, sem acumular tempo de simulação.
- 206 testes: 196 anteriores + 10 regressões novas. Sem regressões encontradas nos testes automatizados.
- Chromium no ambiente de teste bloqueou acesso ao servidor local; não há confirmação de ganho FPS real por GPU.

---

## v1.2.7 — Importador GLB real

- Novo painel no estábulo: importar `.glb` do PC, testar demonstração e remover modelo.
- Validação de assinatura, estrutura glTF 2.0 e limite de tamanho com mensagens de erro claras.
- Loader oficial Three.js r180 com addons locais, fallback de CDN e configuração de cache nos inicializadores.
- GLB com malhas skinned agora é clonado corretamente para a versão montada, com fallback seguro para rigs.
- Importação atômica: se der erro, o personagem anterior permanece; animações Idle, Walk, Run e Ride quando presentes.
- IndexedDB guarda GLBs pessoais pequenos localmente e restaura o modelo depois de recarregar a página.
- Modelo de teste original em `assets/models/hero-demo.glb`; sem assets de terceiros incluídos.
- Testes de GLB, modelo corrompido, carregador e interface adicionados; salva missões e jogo sem modificar o formato.
- WebGL deve ser confirmado no navegador; teste com modelos reais mais complexos ainda depende do hardware do jogador.

# v1.2.6 — Desempenho e estabilidade do fogo

- Corrigido gargalo de projéteis: reutilização de malhas, limite de objetos ativos e eliminação de fontes de luz por disparo.
- Quatro malhas instanciadas substituem centenas de objetos individuais de partículas, com limites específicos por qualidade.
- Perfil LEVE mais agressivo, autoqualidade conservadora, menos atualização do minimapa e da chuva.
- Cálculo de FPS corrigido para usar tempo real do navegador; desempenho abaixo da meta reduz a qualidade automaticamente.
- Nós de áudio são desligados após efeitos para evitar acumulação.
- 14 testes novos com regressão de desempenho e políticas de projéteis; total de 187 testes aprovados.
- Não é garantida performance fixa em hardware não testado; teste visual WebGL e controle físico permanecem pendentes de validação direta.

---

# v1.2.5 — Controle, personagem e arquitetura

- Gamepad API padrão com suporte a Xbox/PlayStation/USB/Bluetooth, analógicos com deadzone e câmera independente.
- Gatilhos analógicos de aceleração e freio, botões de voo, combate, interações e menu. Ações de botão executam só no momento de pressionar e se soltam ao desconectar o controle.
- Navegação do estábulo pelo direcional do controle, com A para confirmar e B para fechar, sem remover teclado/toque.
- Personagem procedural aprimorado: olhos, sobrancelhas, gorro, roupa, tiras, braços articulados com cotovelos e pernas com joelhos e botas.
- Código separado em entrada/gamepad, visual, movimento, e carregador opcional de GLB; integração preparada para rigs e animações (Idle/Walk/Run) com fallback.
- Fontes externas CC0 pesquisadas e documentadas, sem redistribuir modelos sem download/autorização explícita.
- Salvamentos compatíveis com versões anteriores; novas baterias de testes mantêm a campanha e as colisões intactas.

---

# v1.2.4 — Contatos mais precisos com o cenário

- Casas: corpo com caixa 6×5 (ajustada pelo tamanho de cada construção), telhado poligonal separado e afunilado em altura, em vez de um único cilindro largo.
- Caixotes: caixa orientada conforme a rotação visual; menos colisões invisíveis nas esquinas.
- Cinco monumentos: base heptagonal, pilar pentagonal e redução de seção no alto, alinhados às malhas 3D.
- Andar, câmera, voo, recuperação de saves e interação de desmontagem compartilham o mesmo detector de colisão, com broad-phase em raio circunscrito.
- Corrigido bloqueio indevido no chão causado por telhados elevados; ajustado raio do broad-phase das cabanas para incluir todos os cantos.
- Preservados os volumes circulares da vegetação, animações, missões e formato dos salvamentos.
- Testes: 138 existentes + 13 cenários novos = 151 testes automatizados, execução de verificação de código e servidor HTTP.
- Limitações: colisão ainda aproximada (caixas e polígonos), sem física de triângulos/ossos do dragão; renderização WebGL exige verificação visual adicional.

---

# Asas de Brumária v1.2.3 — Colisão de câmera e voo

- Câmera de terceira pessoa agora verifica todo o segmento entre o personagem e a posição desejada; não basta avaliar a altura no destino.
- Câmera recua automaticamente antes de construções, monumentos, árvores e terreno intermediário, incluindo durante o movimento suavizado.
- Dragão em voo agora aplica colisão contínua e combinada em X/Y/Z com volumes e alturas dos obstáculos. Evita atravessar paredes durante turbo, descer através de pedras ou subir através de tetos.
- Mantidos o pouso, a desaceleração ao colidir e os controles de voo, sem mudar o formato dos salvamentos e missões.
- Dez novos testes de regressão em `tests/flight-camera-v123.test.js` (total: 138), além da checagem de sintaxe e imports.
- Limites conhecidos: volumes de colisão são cilindros aproximados; a renderização gráfica completa precisa de verificação em computador com WebGL.

---

## v1.2.2 — Colisão nos monumentos

- Cinco monumentos (inclusive o grande obelisco mostrado na captura) agora registram dois volumes sólidos com altura: pedestal e coluna.
- Passagem de personagens através da pedra bloqueada, preservando o deslize ao contornar a base e o voo por cima das partes baixas.
- Ao retomar saves antigos, personagens e dragões dentro de volumes físicos são reposicionados para o ponto seguro mais próximo.
- Testes específicos para corrida, voo, deslizamento, restauração de saves e ausência de colisores faltantes.

# v1.2.1 — Correção da plataforma central

- Terreno da vila nivelado sob toda a plataforma, com transição suave ao relevo natural.
- Plataforma desenhada como cilindro de laterais retas (24 segmentos) para coincidir com seu piso físico.
- Colisão de apoio inclui o raio dos pés do personagem (0,52 m) e a base do dragão (1,65 m), evitando atravessar as bordas.
- Alturas renderizadas e calculadas usam a mesma função, inclusive após carregar um save.
- Acrescentados cinco testes de regressão; 120 testes aprovados.
- A atualização mantém missões e dados salvos. A execução gráfica WebGL ainda requer validação manual.

---

# Asas de Brumária v1.2.0 — Colisões da Vila e Piso Sólido

- A plataforma do estábulo ganhou altura de apoio real para o herói, o dragão e a câmera, eliminando o piso meramente visual.
- Caixas, postes, fogueira e moradores agora registram volumes sólidos de colisão. Preserva árvores, pedras e casas.
- Movimento em solo limita a subida máxima por passo e continua deslizando ao longo de paredes; evita escalar desníveis altos instantaneamente.
- Desmontagem procura local acessível e livre de obstáculos; se não existir, avisa e mantém o herói montado.
- Carregamento de posição e respawn respeitam o piso elevado, sem alterar o formato de saves anteriores.
- Testes de regressão em `tests/collisions-v120.test.js` e suíte anterior preservados.
- Limitação: física aproximada baseada em círculos e alturas; não há colisão exata de malha nem simulação rígida completa.

---

# Asas de Brumária — Histórico

## v1.1.0 — Asas Articuladas e Câmera Livre

- Rig hierárquico das asas em ombro, cotovelo e punho: 3 segmentos animados por espécie, com malha interna/externa/terminal que acompanha os pivôs.
- Patas dianteiras articuladas com ombro, punho e garras.
- Novo controlador orbital: arrastar para girar, roda para zoom, V para restaurar a vista, limites seguros de ângulo e zoom.
- Estábulo 3D atualizado para repetir a mesma pose da montaria.
- Import map de Three.js escolhido dinamicamente: arquivo local opcional, jsDelivr e unpkg; mensagem clara ao falhar WebGL/CDN.
- Novo iniciador Windows via PowerShell/HttpListener (sem Python). Ambos inicializadores tentam cache local do Three.js.
- Preservados HUD, missões, progresso e chave do save sem mudança de formato.
- 106 testes Node.js aprovados; HTTP dos arquivos locais aprovado; WebGL e PowerShell ainda não puderam ser executados neste ambiente de teste.

## v1.0.0 — Vínculos Vivos e Voo Assistido (15/10/2026)
- Domesticação comportamental: a calma aumenta com proximidade e velocidade adequada; não é mais suficiente apertar E imediatamente.
- Personalidades: Faísca se aproxima facilmente, Zéfiro demanda mais paciência e Neblina foge de corridas, exigindo passos lentos (Shift no PC, DEVAGAR no celular) ou espera.
- Estados temporários de animação: observando, tranquilo, assustado; reações de asas, cabeça e mandíbula; respiração e placas dorsais na geometria dos selvagens.
- Controle de voo mais gradual: suavização exponencial de direção (independente do FPS) e pouso assistido em baixa velocidade próximo ao terreno.
- Feedback de interação no HUD, estábulo e interface para toque.
- Save v1 preservado; calma temporal não é persistida, vínculos definitivos continuam salvos.
- 95 testes automatizados aprovados. HTTP verificado. Renderização WebGL não pôde ser confirmada no Chromium deste ambiente (falha EGL/ANGLE e CDN inacessível).
- Não houve publicação em serviço externo. Three.js continua importado do CDN e precisa de internet.

# Histórico de versões

## v0.9.0 — Encontro com os Selvagens

- Faísca, Zéfiro e Neblina aparecem em três ilhas com animações de asas, cabeça e cauda e detalhes individuais.
- Domesticação com três interações a pé, recarga curta e proteção contra recompensas duplicadas.
- Amizades dão um ponto e podem desbloquear Brasa e Raio gratuitamente.
- Minimapa com pins lilases e lista de amizades no estábulo.
- Salvamento v1 retrocompatível, servidor Python com porta de hospedagem e arquivo .replit.
- 83 testes automatizados; endpoints HTTP validados, WebGL não verificado neste ambiente.


## v0.8.0 — Voo Vivo e Performance

- Lotes instanciados para árvores e rochas do arquipélago: cinco malhas de folhagem/rocha substituem a criação de uma malha por tronco, copa ou rocha. Colisores originais continuam ativos.
- Movimento de voo mais estável, com curvas moderadas em velocidade elevada, corpo inclinado com amortecimento, cauda e pontas de asa reagindo ao giro, e patas com transições de decolagem e pouso.
- Anatomia procedural do dragão ganha dentes articulados à mandíbula, cristas cervicais e garras nas extremidades das asas.
- Sistema gráfico com perfis automático, leve, equilibrado e detalhado, controle G/botão no HUD, ajuste de pixel ratio, sombras no nível leve e seleção persistente separada do save.
- 71 testes Node aprovados, incluindo 13 novos para física visual, perfis/histerese e integração de lotes. Sem validação visual completa de WebGL, pois o CDN do Three.js não é alcançável neste ambiente.



## v0.7.0 — O Despertar dos Céus

- Relógio ambiental de 12 minutos, sol/lua/estrelas com transição de iluminação misturada ao clima; HUD e atalho N.
- Vento agora interfere suavemente no voo acima da altitude mínima, até 3,8 m/s, sem contornar colisões.
- Estábulo com prévia 3D interativa dos modelos procedurais de Nimbo, Brasa e Raio; visualização sem compra.
- Salvamento v1 compatível acrescido do estado do dia/noite.
- 58 testes automatizados aprovados; arquivos locais respondendo por HTTP. WebGL completo ainda não validado em browser automatizado.

## v0.6.0 — Céus da Tempestade

- Quatro estados climáticos graduais: céu aberto, ventos, chuva e tempestade, com iluminação e neblina adaptadas.
- Chuva local com `THREE.Points` e relâmpagos ocasionais. Tecla C alterna o clima manualmente.
- Nimbo, Brasa e Raio ganham ornamentos específicos, diferentes detalhes na silhueta e reações ao combate.
- Cinco marcos de descoberta nas ilhas (totens/losangos no mapa), cada um valendo +1 ponto uma vez por partida.
- Extensão compatível de salvamento para clima e descobertas no mesmo formato v1.
- 44 testes aprovados (34 anteriores + 10 novos), incluindo saves antigos, clima, exploração e recompensas únicas.
- Servidor HTTP local verificado; execução WebGL total não testada por bloqueio do navegador automatizado e inacessibilidade do CDN externo no contêiner.


## v0.5.0 — Terras Vivas

- Colisões circulares com árvores, rochedos e casas da vila para caminhada e dragão próximo ao solo; verificação de altura para liberar sobrevoo de obstáculos.
- Resolução por passos de varredura para evitar atravessar obstáculos em alta velocidade, deslizamento junto às bordas, recuperação ao sair de volumes sobrepostos por saves antigos e filtragem espacial de colisores na trajetória.
- Decolagem e descida com aceleração vertical suave, pouso animado, quatro poses de voo e pontas das asas móveis independentemente da base.
- Dragão com padrões de pele e membrana produzidos por CanvasTexture/UV, escamas geométricas no dorso, sela com arreios, sobrancelhas, olhos com piscar sincronizado e mais ornamentos de cabeça.
- Espuma costeira nas cinco ilhas, vegetação variada em meshes instanciados e novos objetos decorativos na vila.
- HUD apresenta estado de decolagem/pouso e nome do dragão ativo na resistência.
- 34 testes automatizados aprovados (23 anteriores + 11 novos), incluindo colisão em passo longo, deslizamento, altitude, save sobreposto e fases de voo.
- Conserva 7 missões, 2 contratos, 3 dragões, circuitos e salvamento v1. A renderização final WebGL ainda precisa ser validada em navegador com acesso ao CDN.


## v0.4.0 — Vila dos Domadores

- Três NPCs originais com modelos procedurais, placas de identificação, gestos e diálogos (Iara, Lume e Borin).
- Dois contratos paralelos jogáveis com coleta contextualizada, retorno ao NPC, recompensa única e marcadores no mundo/minimapa.
- Circuito da Tempestade com cinco checkpoints, 80 segundos e velocidade mínima, desbloqueado após o primeiro treino.
- Dragão aprimorado com cauda encadeada em seis segmentos, cabeça/mandíbula móveis, patas articuladas, olhos animados e batimento de asas adaptado à planagem.
- Persistência de contratos compatível com save v0.3.0; melhor feedback visual no HUD e botão contextual para celular.
- 23 testes de lógica e integridade aprovados; renderização completa ainda exige validação manual com WebGL.


## v0.3.0 — Estábulo dos Dragões

- Três espécies/perfis selecionáveis (Nimbo, Brasa e Raio) com aparência procedural, velocidade, energia e fogo específicos.
- Estábulo na vila: desbloqueios, pontos, compra de habilidades com três níveis e botões para celular.
- Circuito com três aros cronometrados e recompensa renovável.
- Sétima missão: Prova do Domador.
- Salvamento automático e manual em `localStorage`, restauração de missões, inimigos, progressão e personagem.
- Melhorias de fogo escalável, cores de projéteis e informação de energia total no HUD.
- Correção de normalização da tecla Ctrl; correção de save com vida fracionária dos inimigos.
- 17 testes lógicos aprovados; arquivos do servidor HTTP local verificados.

## v0.2.0 — Batalha das Sentinelas

- IA de três dragões inimigos com patrulha, perseguição, desvio, ajuste de altitude e disparos.
- Dragões adversários procedurais com asas, cauda e cabeça animadas.
- Resistência de Nimbo, dano, imunidade temporária e reaparecimento no vilarejo.
- Combate entre equipes com colisão contínua de projéteis e assistência leve de mira.
- Efeitos de impacto, dano e explosões; novos sons gerados por WebAudio.
- Missões 5 e 6: Sentinelas da Tormenta e Filhotes Perdidos.
- Minimapa e HUD ampliados, com sinalização de inimigos e de filhotes.
- Erros de inicialização do Three.js são exibidos ao jogador.
- Nove testes de lógica e verificações de módulos/HTML.

## v0.1.0 — Primeira Conexão

- Arquipélago 3D de cinco ilhas, Nimbo e herói.
- Montaria, caminhada, voo livre, turbo, fogo e controles touch.
- Quatro missões iniciais e efeitos WebAudio.
