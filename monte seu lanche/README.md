# Monte Seu Lanche — pasta independente de visualização

Esta pasta fica na raiz do projeto Brutu’s Delivery. O app carrega o CSS, o controlador da interface e a configuração das camadas daqui.

- `imagens/`: 21 fotos WebP RGBA de ingredientes, padronizadas em canvas 640×360.
- `manifesto.json`: lista de todos os sprites e correspondências entre IDs e imagens.
- `camadas.js`: mapeamento e regras de empilhamento (pão inferior → proteínas → queijos → extras → saladas → molhos → pão superior); calcula camadas repetidas conforme quantidade.
- `camadas.css`: apresentação responsiva, animações de entrada e fundo do preview.
- `montador.js`: etapas, opções, controles, validações de interface e carrinho; aproveita o catálogo de ingredientes oficial.
- `montador.css`: estilos do painel do cliente.

## Como atualizar imagens

Substitua um WebP mantendo **o mesmo nome**, o mesmo ângulo e proporções. Todos os arquivos devem ter transparência real (canal alfa). Para ingrediente novo no painel, acrescente o ID em `camadas.js` e inclua a foto na pasta `imagens/`. O preview mostra um fallback se a imagem ainda não existir.

A lógica de preços, estoque e regras de pedido **não está nesta pasta**: continua em `js/montador-core.js` (compartilhado com `backend/server.js`), e os ingredientes/preços continuam editáveis na aba Monte Seu Lanche do painel.

## Publicação

O `index.html` carrega a pasta usando URLs `%20` para o espaço no nome. O `sw.js` também inclui os arquivos no cache PWA da versão 3.0.0. Não envie apenas esta pasta: envie junto `index.html` e `sw.js` para que o app passe a carregá-la.

Os arquivos antigos `js/monte-lanche.js` e `css/monte-lanche.css` foram mantidos no repositório por compatibilidade com os testes antigos, mas não são mais carregados pelo cardápio.
