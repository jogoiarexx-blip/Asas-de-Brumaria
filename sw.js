/* =========================================================================
   BRUTU'S DELIVERY — sw.js (Service Worker)
   -------------------------------------------------------------------------
   Estratégia:
   - App shell (html/css/js/ícones): "cache first" — carrega instantâneo
     e funciona sem internet depois do primeiro acesso.
   - menu.json: "network first, cache fallback" — assim, sempre que o
     cliente tiver internet, ele vê o cardápio mais atualizado; se estiver
     offline, cai para a última versão salva.

   Ao alterar o menu.json, o CACHE_VERSION não precisa mudar: o cardápio
   é buscado direto da rede sempre que possível. Se quiser forçar a
   atualização de arquivos de layout (css/js) para quem já instalou o app,
   troque o número da versão abaixo.
   ========================================================================= */

const CACHE_VERSION = "brutus-v3.0.0-camadas-webp";
const STATIC_CACHE = `${CACHE_VERSION}-estatico`;
const DATA_CACHE = `${CACHE_VERSION}-dados`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css?v=2.9.2",
  "./css/cardapio-profissional.css?v=2.9.2",
  "./js/app.js?v=2.9.7",
  "./js/montador-core.js?v=2.9.7",
  "./monte%20seu%20lanche/camadas.js?v=3.0.0",
  "./monte%20seu%20lanche/montador.js?v=3.0.0",
  "./monte%20seu%20lanche/montador.css?v=3.0.0",
  "./monte%20seu%20lanche/camadas.css?v=3.0.0",
  "./js/fila-pedidos.js",
  "./js/vendor/qrcode.min.js",
  "./css/roleta.css?v=2.9.3",
  "./js/roleta.js?v=2.9.3",
  "./data/menu-public-data.js",
  "./data/menu-public.json",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/og-image-professional.jpg",
  "./img/promo/banner-brutus-premium.webp",
  "./img/roleta/aro-luzes.webp",
  "./img/roleta/pointer.webp",
  "./img/roleta/ganhou.webp",
  "./img/roleta/confete.webp",
  "./img/produtos/brutus-bacon.webp",
  "./img/produtos/brutus-cheddar-duplo.webp",
  "./img/produtos/brutus-raiz.webp",
  "./img/produtos/x-burguer-brutus.webp",
  "./img/produtos/brutus-pickles.webp",
  "./img/produtos/pappy-burger.webp",
  "./img/produtos/brutus-na-chapa.webp",
  "./img/produtos/bruto-power.webp",
  "./img/produtos/brutus-prime.webp",
  "./img/produtos/x-frango-catupiry-bacon-salada.webp",
  "./img/produtos/x-brutus-chips.webp",
  "./img/produtos/carne-e-queijo.webp",
  "./img/produtos/carne-e-queijo-salada.webp",
  "./monte%20seu%20lanche/imagens/alface.webp",
  "./monte%20seu%20lanche/imagens/bacon.webp",
  "./monte%20seu%20lanche/imagens/barbecue.webp",
  "./monte%20seu%20lanche/imagens/catupiry.webp",
  "./monte%20seu%20lanche/imagens/cebola-caramelizada.webp",
  "./monte%20seu%20lanche/imagens/cebola-roxa.webp",
  "./monte%20seu%20lanche/imagens/cheddar.webp",
  "./monte%20seu%20lanche/imagens/costela-desfiada.webp",
  "./monte%20seu%20lanche/imagens/file-frango.webp",
  "./monte%20seu%20lanche/imagens/hamburguer-bovino.webp",
  "./monte%20seu%20lanche/imagens/maionese.webp",
  "./monte%20seu%20lanche/imagens/molho-casa.webp",
  "./monte%20seu%20lanche/imagens/mucarela.webp",
  "./monte%20seu%20lanche/imagens/ovo.webp",
  "./monte%20seu%20lanche/imagens/pao-baguete-base.webp",
  "./monte%20seu%20lanche/imagens/pao-baguete-topo.webp",
  "./monte%20seu%20lanche/imagens/pao-brioche-base.webp",
  "./monte%20seu%20lanche/imagens/pao-brioche-topo.webp",
  "./monte%20seu%20lanche/imagens/pao-tradicional-base.webp",
  "./monte%20seu%20lanche/imagens/pao-tradicional-topo.webp",
  "./monte%20seu%20lanche/imagens/tomate.webp",
];

const MENU_URL_PATH = "/data/menu-public.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((chave) => chave.startsWith("brutus-") && chave !== STATIC_CACHE && chave !== DATA_CACHE)
          .map((chave) => caches.delete(chave))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Nunca cachear API nem painel administrativo.
  // Isso evita painel/login antigo preso no Service Worker após um deploy.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith("/painel.html") ||
    url.pathname.endsWith("/painel-de-controle.html") ||
    url.pathname.endsWith("/css/painel-profissional.css")
  ) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => {
        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
    );
    return;
  }

  // Estratégia especial para o cardápio (menu.json): network-first
  if (url.pathname.endsWith(MENU_URL_PATH) || url.pathname.endsWith("menu.json")) {
    event.respondWith(
      fetch(request)
        .then((respostaRede) => {
          const clone = respostaRede.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
          return respostaRede;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell e demais arquivos: cache-first, com atualização em segundo plano
  event.respondWith(
    caches.match(request).then((respostaCache) => {
      const fetchPromise = fetch(request)
        .then((respostaRede) => {
          if (respostaRede && respostaRede.status === 200) {
            const clone = respostaRede.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return respostaRede;
        })
        .catch(() => respostaCache);
      return respostaCache || fetchPromise;
    })
  );
});


self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientes = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const cliente of clientes) {
      if ("focus" in cliente) return cliente.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow("./");
  })());
});
