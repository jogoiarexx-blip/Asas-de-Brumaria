// Definições sem Three.js, testáveis sem renderização.
export const CIRCUITS=Object.freeze({
  basic:{label:'DESAFIO DOS VENTOS',seconds:95,reward:1,minSpeed:0,
    checkpoints:[[37,24,-30],[-22,27,-43],[-35,25,29]]},
  advanced:{label:'CIRCUITO DA TEMPESTADE',seconds:80,reward:2,minSpeed:18,
    checkpoints:[[55,30,-51],[98,43,-35],[106,49,52],[12,38,88],[-48,32,29]]},
  // Fase extra de exploração: conecta as duas ilhas inéditas.
  // As sete balizas criam uma rota de longa distância, com tempo suficiente
  // para procurar as costas e pousar sem ultrapassar a física original.
  frontier:{label:'TRAVESSIA DAS SETE ILHAS',seconds:165,reward:4,minSpeed:14,
    checkpoints:[[90,42,-34],[215,42,-143],[332,38,-105],[185,43,52],
      [-28,44,102],[-183,41,138],[-320,38,95]]}
});
