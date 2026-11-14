# Brumária: Elo dos Dragões — Auditoria e Plano de Evolução

> Antigo **Asas de Brumária**. Documento criado na v1.6.0 e atualizado na v1.6.1 (14/11/2026).
> Parte 1: o que a auditoria encontrou e o que já foi corrigido.
> Parte 2: o que ainda falta corrigir, por prioridade.
> Parte 3: o plano de evolução, com novos capítulos, fases, chefes e sistemas.

---

## Parte 1 — Auditoria da v1.5.8 e correções da v1.6.0

### Como foi medido

O jogo foi executado em Chrome headless com um medidor que intercepta as chamadas WebGL
(`linkProgram`, `texSubImage2D`) e marca cada fase da partida. O roteiro foi o mesmo antes e
depois: vila → montar → atirar → troca automática de qualidade → voo até Cristais → voo até
Cinzas e portal.

**Limite da medição:** o renderizador do teste é por software (SwiftShader). Os milissegundos
valem como comparação antes/depois, não como FPS de um PC ou celular real. A contagem de
shaders compilados e de texturas enviadas é exata em qualquer máquina.

### Causa das travadas (confirmada)

| # | Causa | Onde | Efeito |
|---|-------|------|--------|
| 1 | O ajuste automático de qualidade mudava `shadowMap.enabled`, `sun.castShadow` e `light.visible`. No Three.js isso muda a "assinatura" de luzes e **recompila todos os shaders da cena**. | `GraphicsQuality.apply`, `Game.applySceneQuality` | Uma travada (tiro, textura) derrubava o FPS → o jogo baixava a qualidade → recompilava tudo → travava mais. Efeito cascata. |
| 2 | Texturas 2K do terreno eram carregadas como `<img>`. O navegador só decodifica o WebP no momento do envio à GPU, **na thread principal**. | `TerrainTextureManager._pump` | Um quadro inteiro parado a cada ilha nova. |
| 3 | Cada NPC em GLB trazia 3 texturas 2048² em PNG (10–14 MB por arquivo) e entrava na cena sem preparo: as 3 texturas subiam no mesmo quadro, junto com a compilação do shader. | `VillageNPCs.streamModels` | Travada ao andar pela vila logo depois de começar. |
| 4 | A região das Montanhas da Sombra entrava na cena no mesmo quadro em que era criada. | `Game.loadMountain` | Travada ao chegar perto do portal. |
| 5 | O estábulo (dezenas de nós de DOM) era reconstruído a cada abate, mesmo fechado. | `UI.renderStable` | Micro-travada ao acertar inimigos. |
| 6 | Três objetos `THREE.Color` novos por quadro no clima. | `Weather.update` | Lixo de memória constante (pausas do coletor). |

### Resultado (mesmo roteiro, antes → depois)

| Fase | Shaders compilados | Maior envio de textura travando o quadro |
|------|--------------------|-------------------------------------------|
| Vila, NPCs chegando | 0 → 0 | 56 ms → 3 ms |
| Montar, decolar, 5 tiros | 0 → 0 | 55 ms → 3 ms |
| Ajuste automático → LEVE | **16 → 0** | 46 ms → 0 ms |
| Ajuste automático → EQUILIBRADO | **4 → 0** | — |
| Ajuste automático → DETALHADO | **19 → 0** | 192 ms → 36 ms |
| Voo até Cristais | 4 → 0 | **268 ms → 10 ms** |
| Voo até Cinzas + portal | 5 → 4 (agora assíncronos, com a região oculta) | 85 ms → 0 ms |

Download dos três NPCs: **39,1 MB → 10,2 MB** (texturas 1024² em JPEG; malha e animações intactas).

### O que mudou no código

- **Iluminação travada** (`GraphicsQuality.lockLighting`): depois da tela de preparação, o ajuste
  automático só mexe em resolução, densidade de natureza e *intensidade* de luz/sombra. A troca
  manual (tecla G) continua aplicando tudo.
- **Terreno**: decodificação por `ImageBitmap` fora da thread principal, intervalo mínimo de
  140 ms entre envios, e o "slot" de normal map fica fixo durante a partida.
- **`src/systems/GpuPrewarm.js`** (novo): qualquer objeto carregado durante o jogo sobe uma
  textura por quadro e compila shaders de forma assíncrona antes de aparecer. Usado nos NPCs e
  nas Montanhas.
- **Céu novo** (`src/world/SkyDome.js`): degradê zênite/horizonte, faixa de bruma, halo do sol e da
  lua e picos distantes enevoados. Um draw call, sem textura. As cores vêm do clima e do ciclo
  dia/noite que já existiam.
- **Mar**: reflexo do céu por ângulo de visão (Fresnel) e fim da mancha branca estourada do sol.
- **HUD**: a linha "VELOCIDADE / ALT / ESQUIVA" não se embaralha mais em voo.
- **Textos**: "ENCONTRE NIMBO" e "Nimbo confia em você" apareciam mesmo com outro dragão ativo.
- **Three.js publicado junto** (`vendor/`, 1,3 MB): o jogo abre mesmo com as CDNs fora do ar.
- **Favicon embutido**: acabou o erro 404 em toda abertura da página.
- **Nome**: Asas de Brumária → **Brumária: Elo dos Dragões** (menu, HUD, título, scripts). As
  chaves de save não mudaram: o progresso antigo continua valendo.
- **Testes**: 582 → 589, todos passando (`tests/stutter-free-v160.test.js` é o novo).

### Efeito colateral conhecido

Com a iluminação travada, quem começa no modo LEVE (aparelhos com até 4 GB) não ganha sombras
sozinho se o FPS melhorar depois. Basta apertar **G** ou recarregar a página. Foi uma troca
consciente: sombra a menos em vez de travada a mais.

### v1.6.1 — o que entrou depois

- **Pausa (Esc)** com retomar, vídeo/áudio e salvar. Com painéis abertos, Esc ainda fecha primeiro.
- **Cascatas** na Ilha das Cascatas (1 draw call, sem colisão).
- **Lanternas da vila acendem ao anoitecer** e **aurora** ao norte nas noites.
- Texturas do herói em 1024² (4× menos memória de vídeo) preparadas; substituição do GLB no GitHub pendente.
- Teste de desempenho em navegador corrigido (28 aves).

---

## Parte 2 — Pendências encontradas (ainda não corrigidas)

### Prioridade alta

1. **Nomes e modelos de terceiros.** "Fúria da Noite", "Fúria da Luz" e "Astrid" são nomes da
   franquia *Como Treinar o Seu Dragão* (DreamWorks). Se os GLBs também forem desses
   personagens, publicar o jogo é um risco real de remoção. Recomendo nomes e modelos próprios
   antes de divulgar. Sugestões que combinam com o mundo: **Véu-Noturno** e **Alva-Aurora** para
   as espécies; **Íris** para a exploradora. O jogo já tem espécies originais (Nimbo, Brasa,
   Raio) que podem virar as protagonistas.
2. **Dragões e herói ainda pesam ~10 MB cada.** A v1.6.1 mostrou que o peso é da **malha e das
   animações**, não das texturas (reduzir as do herói só levou o arquivo de 10,1 para 9,8 MB). O caminho
   é compressão Meshopt + simplificação de malha, que exige publicar o decodificador e
   regenerar as variantes mobile e o `asset-qa.json` juntos.
3. **Playtest em aparelho real.** Falta medir FPS num celular intermediário e num PC com vídeo
   integrado. O painel F3 e o benchmark (B) já existem para isso.

### Prioridade média

4. **`Game.js` tem 1.280 linhas** e concentra entrada, combate, câmera, expedição e salvamento.
   Dividir em `CombatController`, `ExpeditionController` e `CameraRig` antes do Capítulo 2.
5. **Sem música.** Todo o áudio é sintetizado (efeitos e ambiente). Uma trilha por bioma muda
   muito a percepção de qualidade.
6. **Repositório com 186 MB** e 80 MB de histórico. Os 22 arquivos `TESTES-v*.txt` e o README de
   106 KB podem ir para `docs/historico/`.
7. **Sombra do sol em 512²** cobrindo 280×280 unidades: serrilhada de perto. Sombra em cascata
   simples (2 níveis) só no modo DETALHADO.

### Prioridade baixa

8. Texturas em **KTX2/Basis** (4–6× menos memória de vídeo) e malhas com **Meshopt**. Exige
    publicar os decodificadores junto.
9. Cabeça de Vento ainda tem 5,8 MB de geometria: simplificar a malha.
10. Nome de arquivo `npc/cabeça de vento (2).glb` com acento, espaço e parênteses: renomear
    para `cabeca-de-vento.glb`.

---

## Parte 3 — Plano de evolução

### Regras de desempenho (valem para toda fase nova)

Medido na v1.6.0 no modo DETALHADO: **a pé na vila, 113 draw calls e ~350 mil triângulos; em voo
sobre o Refúgio, 60 draw calls e ~490 mil triângulos**. A v1.5.8 tem os mesmos números: o céu novo
custa 1 draw call.

| Orçamento | Limite por cena |
|-----------|-----------------|
| Draw calls | 130 (DETALHADO), 80 (LEVE) |
| Triângulos visíveis | 600 mil (DETALHADO), 250 mil (LEVE) |
| Textura por modelo | 1024² no máximo; 2048² só no terreno próximo |
| GLB por personagem | 3 MB no máximo |
| Shaders novos durante o voo | **zero** |

Checklist "sem travada" para qualquer conteúdo novo:

1. Tudo que nasce durante o jogo passa por `prewarmObject` antes de ficar visível.
2. Nunca ligar/desligar `light.visible`, `castShadow` ou `shadowMap.enabled` em jogo. Use intensidade.
3. Nunca trocar um mapa de `null` para textura (ou o inverso) em jogo. Use textura neutra 1×1.
4. `InstancedMesh` com cor: criar `instanceColor` na construção, não no primeiro uso.
5. Nada de `new THREE.Vector3/Color` dentro de `update()`.
6. Rodar o roteiro de medição e conferir "shaders compilados = 0" em todas as fases.

### Linha do tempo

| Versão | Tema | Conteúdo principal |
|--------|------|--------------------|
| **1.6.0** ✅ | Voo sem engasgos | Este documento |
| **1.6.1** ✅ | Pausa e cenário | Pausa, cascatas, lanternas noturnas, aurora |
| **1.6.x** | Fundação | Pendências 1–3, divisão do `Game.js`, modo foto, Nível de Elo |
| **1.7** | Capítulo 2 — Recifes do Trovão | 3 ilhas, 4 fases, chefe Leviatã |
| **1.8** | Capítulo 3 — Floresta Suspensa | 3 ilhas flutuantes, 4 fases, chefe Matriarca |
| **1.9** | Capítulo 4 — Geleiras do Silêncio | 2 ilhas + caverna, 4 fases, chefe Colosso |
| **2.0** | Capítulo 5 — Coração da Bruma | Fase final, chefe em 3 etapas, epílogo |
| **2.x** | Pós-jogo | Desafios diários ampliados, Nova Jornada+, corridas contra fantasma |

O Capítulo 1 é o que existe hoje: sete ilhas, sete missões e a expedição às Montanhas da Sombra.

---

### v1.6.x — Fundação

- ~~Pausa (Esc)~~ feita na v1.6.1. Falta o **modo foto**: câmera livre e esconder HUD.
- **Nível de Elo** (dá sentido ao novo nome): carinho, voo junto e resgates enchem uma barra
  de 1 a 5. Cada nível libera algo: assobio para chamar o dragão, mergulho rápido, rasante,
  sopro carregado, voo em formação com um dragão selvagem amigo.
- **Diário do Domador**: páginas de espécies, marcos e moradores preenchidas ao descobrir.
- **Música**: 4 faixas curtas em loop (vila, voo, combate, noite) com transição suave.

---

### v1.7 — Capítulo 2: Recifes do Trovão

**Bioma:** arquipélago de recife negro sob tempestade permanente, a sul. Raios de verdade
(o clima "tempestade" já existe), colunas de basalto e navios naufragados.
**Mecânica nova: correntes de ar e raios.** Colunas de vento sobem o dragão sem gastar energia;
nuvens carregadas avisam com 1,5 s de antecedência antes de descarregar.

| Fase | Título | Objetivo | Total |
|------|--------|----------|-------|
| 8 | O CHAMADO DA TORMENTA | Atravesse o corredor de vento seguindo 6 boias de luz | 6 |
| 9 | FARÓIS APAGADOS | Reacenda 4 faróis com fogo antes da maré cobrir cada um | 4 |
| 10 | NINHO NO NAUFRÁGIO | Escolte 3 filhotes de Raio entre os destroços, protegendo-os dos raios | 3 |
| 11 | O LEVIATÃ DOS RECIFES | Chefe: serpente marinha que emerge em 3 pontos; acerte as barbatanas brilhantes | 3 etapas |

- **Inimigos:** Enguias-Faísca (saltam da água em arco), Corvos de Sal (enxame fraco e rápido).
- **Recompensa:** espécie Raio evolui (sopro em corrente que salta entre 3 alvos); 6 pontos de treino.
- **Custo técnico:** 3 ilhas no fluxo de detalhes já existente; raio = 1 malha instanciada + a
  luz de clarão que já está na cena; Leviatã = 1 malha articulada por segmentos (como a cauda do dragão).

### v1.8 — Capítulo 3: Floresta Suspensa

**Bioma:** ilhas flutuantes cobertas de árvores gigantes, ligadas por raízes e cipós, a norte.
Cachoeiras que caem no vazio, pólen luminoso à noite.
**Mecânica nova: voo de precisão e furtividade.** Túneis de raízes exigem velocidade baixa;
criaturas adormecidas acordam se o dragão passar rápido ou usar fogo.

| Fase | Título | Objetivo | Total |
|------|--------|----------|-------|
| 12 | RAÍZES NO CÉU | Atravesse 5 túneis de raízes sem tocar nas paredes | 5 |
| 13 | SEMENTES DE LUZ | Colete 8 sementes luminosas durante a noite e plante no Refúgio | 8 |
| 14 | O SONO DOS ANTIGOS | Passe por 3 ninhos de dragões anciãos sem acordá-los (velocidade < 40%) | 3 |
| 15 | A MATRIARCA DE MUSGO | Chefe: não se derrota; ganha-se a confiança — desvie, cure 4 feridas com a onda elemental | 4 |

- **Inimigos:** Vespas-Lanterna (perseguem a luz do fogo), Cipós-Laço (prendem por 2 s se encostar).
- **Recompensa:** nova espécie **Musgo** (lenta, resistente, cura aliados com a onda); montaria
  dupla temporária na Matriarca na fase final.
- **Custo técnico:** ilhas flutuantes reutilizam o gerador de terreno com base invertida; túneis
  usam a grade de colisão existente; cachoeira = 1 plano com shader de rolagem.

### v1.9 — Capítulo 4: Geleiras do Silêncio

**Bioma:** duas ilhas de gelo e uma caverna interna enorme, a oeste, depois dos Cristais.
Aurora no céu noturno (extensão do `SkyDome`), neve com vento lateral.
**Mecânica nova: calor.** Uma barra de frio enche ao voar alto ou na nevasca; fogueiras, fontes
termais e o próprio fogo do dragão aquecem. Gelo fino quebra com fogo e abre passagens.

| Fase | Título | Objetivo | Total |
|------|--------|----------|-------|
| 16 | TRAVESSIA BRANCA | Voe entre 5 fogueiras de sinalização sem deixar o frio chegar a 100% | 5 |
| 17 | ESPELHOS DE GELO | Derreta 6 paredes para refletir a luz até o portão da caverna | 6 |
| 18 | OS PRESOS NO GELO | Liberte 3 dragões congelados e defenda cada um por 30 s | 3 |
| 19 | O COLOSSO DE GEADA | Chefe na caverna: derrube estalactites sobre ele; fogo só fere depois | 3 etapas |

- **Inimigos:** Lobos-de-Geada (em terra, perseguem o herói a pé), Estilhaços (cristais que explodem ao morrer).
- **Recompensa:** espécie **Geada** (sopro que congela inimigos por 3 s); pele de inverno para o herói.
- **Custo técnico:** caverna carregada como região separada, igual às Montanhas da Sombra
  (já com pré-aquecimento); neve reutiliza o sistema de chuva com outra velocidade e cor.

### v2.0 — Capítulo 5: Coração da Bruma

**Bioma:** o olho da névoa no centro do mapa, antes intransponível. Ruínas da primeira vila de
domadores, ilhas em espiral ao redor de um redemoinho de nuvens.
**Mecânica nova: todas juntas.** Correntes de ar, furtividade e calor aparecem em sequência.
Os dragões amigos conquistados nos capítulos anteriores voam em formação e ajudam.

| Fase | Título | Objetivo | Total |
|------|--------|----------|-------|
| 20 | O OLHO DA NÉVOA | Suba a espiral de vento em 4 anéis, cada um com a regra de um capítulo | 4 |
| 21 | A PRIMEIRA VILA | Explore as ruínas a pé e ative 5 murais que contam a origem do Elo | 5 |
| 22 | TODOS OS CÉUS | Defenda o Refúgio com os dragões aliados em 3 ondas | 3 |
| 23 | O SEM-ELO | Chefe final em 3 etapas: perseguição, duelo aéreo e escolha final (derrotar ou criar o elo) | 3 etapas |

- **Dois finais** conforme a escolha e o nível de Elo. Epílogo jogável: voo livre ao pôr do sol
  com todos os dragões conquistados.
- **Recompensa:** Nova Jornada+ (inimigos mais fortes, espécies e níveis mantidos).

---

### Sistemas que acompanham os capítulos

| Sistema | Versão | Descrição |
|---------|--------|-----------|
| Nível de Elo | 1.6.x | Barra de 1 a 5 com habilidades de parceria |
| Árvore de habilidades em 3 ramos | 1.7 | Voo, Sopro e Elo, no lugar da lista única do estábulo |
| Equipamento do herói | 1.7 | Sela, óculos e capa com bônus pequenos, ganhos em contratos |
| Dragões aliados | 1.8 | Amizades selvagens passam a acompanhar em missões escolhidas |
| Moradores com rotina diária | 1.8 | A patrulha atual ganha horários: forja de dia, fogueira à noite |
| Corridas contra fantasma | 1.9 | Grava o melhor tempo do jogador em cada circuito |
| Conquistas e Diário completo | 2.0 | 40 conquistas ligadas a exploração, elo e desafio |
| Acessibilidade | contínuo | Zoom liberado, daltonismo no minimapa, legendas dos sons, voo assistido |

### Cenários: próximos passos visuais

1. **Nuvens volumétricas baratas**: camadas de impostores com o mesmo degradê do céu novo.
2. **Espuma na costa** por distância ao litoral, no shader do mar.
3. ~~Cachoeiras na Ilha das Cascatas~~ feito na v1.6.1. Próximo: queda vertical com névoa na base.
4. **Vila viva**: ~~lanternas ao anoitecer~~ (v1.6.1); faltam janelas acesas, fumaça nas
   chaminés e barcos atracados.
5. **Pilares de rocha no mar** entre as ilhas, com colisão, para dar referência de velocidade em voo.
6. ~~Aurora~~ (v1.6.1); faltam **estrelas cadentes** no `SkyDome`.

### Como medir cada entrega

- `npm run check` — testes de lógica (593 hoje).
- Roteiro de engasgos: shaders compilados e maior envio de textura por fase (tabela da Parte 1).
- F3 em jogo: FPS, draw calls e triângulos. Tecla B: comparação entre LEVE, EQUILIBRADO e DETALHADO.
- Critério de aceite de uma fase nova: zero shader compilado em voo, orçamento da tabela
  respeitado e missão concluível do início ao fim com teclado, controle e toque.
