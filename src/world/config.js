import {ISLAND_SPACING,stretchPointOnIsland} from './IslandLayout.js';

export const ISLANDS = [
  { name:'Ilha do Refúgio',x:0,z:0,r:83,h:22,seed:0.5 },
  { name:'Ilha das Cascatas',x:-183,z:-126,r:55,h:19,seed:2.6 },
  { name:'Ilha do Farol',x:168,z:106,r:57,h:18,seed:4.1 },
  { name:'Ilha da Névoa',x:-117,z:153,r:48,h:16,seed:1.9 },
  { name:'Atol Esquecido',x:195,z:-162,r:42,h:15,seed:3.6 },
  // Capítulo opcional: duas novas ilhas, fora da rota original das missões.
  { name:'Arquipélago dos Cristais',x:-320,z:95,r:54,h:21,seed:6.1,biome:'crystal' },
  { name:'Ilha das Cinzas',x:332,z:-110,r:58,h:23,seed:7.9,biome:'ash' }
].map(island=>Object.freeze({...island,x:island.x*ISLAND_SPACING,z:island.z*ISLAND_SPACING}));
export const QUEST_DEFS = [
  {id:'bond',title:'A PRIMEIRA CONEXÃO',desc:'Encontre sua Fúria da Noite, aproxime-se e pressione E para montar.',total:1},
  {id:'rings',title:'O BATISMO DO VENTO',desc:'Atravesse os cinco aros luminosos para dominar os céus.',total:5},
  {id:'crystals',title:'AS RUNAS PERDIDAS',desc:'Recolha três cristais de energia espalhados entre as ilhas.',total:3},
  {id:'targets',title:'DEFENSORES DE BRUMÁRIA',desc:'Use F para lançar fogo e destruir os três orbes sombrios.',total:3},
  {id:'battle',title:'SENTINELAS DA TORMENTA',desc:'Enfrente três dragões inimigos. Mire para a frente e lance fogo com F; evite os disparos!',total:3},
  {id:'rescue',title:'FILHOTES PERDIDOS',desc:'Aproxime-se devagar, proteja cada filhote e transporte-o para o Refúgio.',total:3},
  {id:'training',title:'PROVA DO DOMADOR',desc:'Retorne à vila, abra o estábulo com T e complete um circuito de treinamento.',total:1}
];
export const RING_POSITIONS = [
  [39,29,-65],[108,32,-17],
  stretchPointOnIsland([85,37,91],'Ilha do Farol'),
  stretchPointOnIsland([-8,33,112],'Ilha da Névoa'),[-96,29,33]
];
export const CRYSTAL_POSITIONS = [
  stretchPointOnIsland([-155,30,-102],'Ilha das Cascatas'),
  stretchPointOnIsland([137,29,107],'Ilha do Farol'),
  stretchPointOnIsland([-111,29,148],'Ilha da Névoa')
];
export const TARGET_POSITIONS = [
  stretchPointOnIsland([-72,30,-158],'Ilha das Cascatas'),
  stretchPointOnIsland([189,36,9],'Ilha do Farol'),
  stretchPointOnIsland([-163,36,106],'Ilha da Névoa')
];

export const HATCHLING_POSITIONS = [
  stretchPointOnIsland([-176,32,-127],'Ilha das Cascatas'),
  stretchPointOnIsland([176,31,120],'Ilha do Farol'),
  stretchPointOnIsland([-102,33,170],'Ilha da Névoa')
];
