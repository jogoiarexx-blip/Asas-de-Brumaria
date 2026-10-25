# ATUALIZAÇÃO: MONTE SEU LANCHE COM 21 CAMADAS WEBP (v3.0.0)

O cardápio utiliza o módulo de imagens da pasta raiz `monte seu lanche/`, contendo:
- `imagens/`: 21 WebP transparentes
- `manifesto.json`: nomes e vínculo com os ingredientes
- `camadas.js`: mapeamento e ordem de sobreposição
- `camadas.css`: visual e animações
- `montador.js` e `montador.css`: interface de cliente
- `demonstracao.html`: teste visual independente (não faz pedidos)
- `README.md`: manutenção das imagens

A atualização também modifica `index.html`, `sw.js` e `package.json`.

**Publicação no GitHub:** extraia o ZIP e envie os arquivos mantendo a estrutura de pastas. No GitHub, a pasta deve se chamar exatamente `monte seu lanche` (com espaços). O app já usa `%20` nas URLs. Se o navegador exibir versão antiga, atualize a página ou limpe cache do PWA.

**Backend e painel:** continuam com o catálogo de ingredientes e preços já existente; não altere o SQLite do servidor. Nenhum valor de produto foi modificado.

**Validação:** testes automatizados executados localmente; a demonstração visual foi composta programaticamente a partir dos mesmos sprites. Não foi publicada nem testada no site ao vivo.
