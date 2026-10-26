import { ISLANDS } from '../world/config.js';
export const LANDMARKS=Object.freeze(ISLANDS.map((island,i)=>Object.freeze({
  id:['refugio','cascatas','farol','nevoa','atol','cristais','cinzas'][i],
  name:['Pedra dos Domadores','Fonte das Cascatas','Antigo Farol','Véu da Névoa','Obelisco Esquecido','Coração de Quartzo','Trono das Cinzas'][i],
  island:island.name,
  x:island.x+[42,7,-9,4,0,4,-6][i],z:island.z+[24,-8,3,0,0,-6,4][i]
})));
export function normalizeDiscoveries(data){const found=Array.isArray(data?.found)?data.found:[];
  return LANDMARKS.map(m=>found.includes(m.id));
}
export class Discovery {
  constructor(saved){this.found=normalizeDiscoveries(saved);}
  get total(){return this.found.filter(Boolean).length;}
  snapshot(){return {found:LANDMARKS.filter((_,i)=>this.found[i]).map(m=>m.id)};}
  discover(index){if(!Number.isInteger(index)||index<0||index>=LANDMARKS.length||this.found[index])return null;
    this.found[index]=true;return LANDMARKS[index];
  }
}
