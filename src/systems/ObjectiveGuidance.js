import {MOUNTAIN_PORTAL} from './ExpeditionRules.js';
/** Compact, contextual mission guidance, independent of Three.js and saved data. */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function headingToObjective(from,target,yaw=0){
  if(!target||!from||![from.x,from.z,target.x,target.z].every(finite))return null;
  const dx=target.x-from.x,dz=target.z-from.z;
  const distance=Math.round(Math.hypot(dx,dz));
  if(distance<5)return {direction:'CHEGOU',symbol:'◆',distance};
  const angle=finite(yaw)?yaw:0;
  const forward=(-Math.sin(angle)*dx-Math.cos(angle)*dz)/Math.max(1,Math.hypot(dx,dz));
  const right=(Math.cos(angle)*dx-Math.sin(angle)*dz)/Math.max(1,Math.hypot(dx,dz));
  const direction=forward<-.64?'ATRÁS':right>.52?'À DIREITA':right<-.52?'À ESQUERDA':'EM FRENTE';
  const symbol=direction==='ATRÁS'?'↓':direction==='À DIREITA'?'↗':direction==='À ESQUERDA'?'↖':'↑';
  return {direction,symbol,distance};
}
export function missionNextStep({stage=0,progress=0,riding=false,carriedIndex=-1,rescueHold=0,
  nearestEnemyHealth=null,inMountain=false,expeditionPhase='',bossHealth=12,activeContract=null,activeContractType=null,training=false}={}){
  if(inMountain){
    if(expeditionPhase==='boats')return 'MISSÃO: Aproxime-se dos navios e use FOGO para destruir as velas e os cascos.';
    if(expeditionPhase==='boss')return bossHealth<=6?'CHEFE EM FÚRIA: esquive com Q e acerte no CONTRA-ATAQUE!':'CHEFE: desvie do anel de aviso e responda após o sopro.';
    return 'REGRESSO: siga o portal para oeste e receba a recompensa.';
  }
  if(training)return 'CIRCUITO ATIVO: atravesse o próximo aro antes do tempo terminar.';
  if(activeContractType==='brasas')return 'BALIZAS DE FOGO: voe até o farol laranja, mire e pressione F. Depois volte para Suri.';
  if(activeContract)return 'CONTRATO DIÁRIO: siga o destino do minimapa e retorne ao morador.';
  switch(stage){
    case 0:return riding?'MONTARIA PRONTA: descubra os aros da próxima missão.':'ENCONTRE NIMBO: aproxime-se e pressione E para montar.';
    case 1:return `VOO: atravesse o ${Math.max(1,progress+1)}º aro brilhante · ESPAÇO sobe, CTRL desce.`;
    case 2:return 'RUNAS: voe até o cristal luminoso indicado no minimapa.';
    case 3:return 'ALVOS SOMBRIOS: alinhe a mira e pressione F para atacar.';
    case 4:return `${Math.max(0,3-progress)} sentinelas restantes · ${finite(nearestEnemyHealth)?`${Math.ceil(nearestEnemyHealth)} PV no alvo · `:''}FOGO (F), ESQUIVA (Q).`;
    case 5:return carriedIndex>=0?'RESGATE: filhote a bordo! Siga ao SANTUÁRIO e reduza a velocidade.':
      rescueHold>0?'APROXIMAÇÃO: mantenha velocidade baixa até recolher o filhote.':'FILHOTE: aproxime-se DEVAGAR e mantenha voo estável por 1,25 s.';
    case 6:return 'PROVA FINAL: vá ao ESTÁBULO da vila e inicie o treinamento.';
    default:return 'HISTÓRIA CONCLUÍDA: explore as ilhas e complete os contratos diários.';
  }
}
export function shouldShowMountainHint(position,missionStage,inMountain,complete){
  if(inMountain||complete||missionStage<3||!position)return false;
  return finite(position.x)&&finite(position.z)&&Math.hypot(position.x-MOUNTAIN_PORTAL.x,position.z-MOUNTAIN_PORTAL.z)<190;
}
