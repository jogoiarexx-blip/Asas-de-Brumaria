# Impostores WebP para HLOD — v1.5.5

Arquivos binários WebP com transparência:
- `conifer.webp`: pinheiro procedural, silhueta distante.
- `broadleaf.webp`: árvore de copa larga procedural.
- `rock.webp`: rocha procedural.
- `cabin.webp`: cabana estática do Refúgio.

Esses WebPs têm 96×160 pixels. **Não** use esses pixels como dimensões na cena:
`src/world/ImpostorWebP.js` mede cada instância no espaço do jogo usando as
bounding boxes das geometrias procedurais, incluindo o tronco, folhas,
samambaias e escala/rotação originais. Para um GLB estático, usa
`THREE.Box3().setFromObject`. Cada billboard recebe exatamente as medidas
`width`, `height`, `centerY` reais. Margens transparentes da foto são
descartadas por UV após o carregamento, para evitar redução de silhueta.

Terreno, colisores, posição de objetos, estados e missões não mudam com o LOD.
Não transforme personagens interativos ou dragões combatentes em billboards.
WebPs são pré-carregados uma vez; se faltarem, a malha original continua visível.

**Licença:** imagens originais de silhuetas geradas para este projeto, sem
dependências de arquivos de terceiros. A posição, dimensões e tipo referenciam
os assets procedurais já utilizados pelo jogo.
