/** Elemental burst is distinct from the regular fire projectile. The pure
 * rules are shared by input and combat tests and never advance while paused. */
export const PULSE_COOLDOWN=6.8;
export function pulseConfig(species='furia_noite',fireSkill=0){
  const elements={
    furia_noite:{name:'Onda de Plasma',color:0x62d8f0,radius:34,cost:30},
    furia_luz:{name:'Explosão Luminosa',color:0xd5f7ff,radius:36,cost:30},
    nimbo:{name:'Pulso da Névoa',color:0x74e8cb,radius:36,cost:27},
    raio:{name:'Onda Elétrica',color:0x8fbaff,radius:39,cost:33},
    brasa:{name:'Anel de Chamas',color:0xff873d,radius:32,cost:27}
  };
  const base=elements[species]??elements.furia_noite;
  return {...base,cost:Math.max(18,base.cost-fireSkill*2),damage:.75+fireSkill*.23};
}
export function canCastPulse({riding,energy,cooldown,dialogue=false},configuration){
  if(!riding||dialogue)return {ok:false,reason:'Monte no dragão para usar o poder.'};
  if(cooldown>0)return {ok:false,reason:'Poder recarregando.'};
  if(energy<configuration.cost)return {ok:false,reason:'Energia insuficiente para o poder.'};
  return {ok:true};
}
export function targetsInPulse(position,targets,radius){
  const radiusSquared=radius*radius;
  return targets.filter(target=>{
    if(!target?.alive||!target.active)return false;
    const p=target.position??target.group?.position;
    if(!p)return false;
    const dx=p.x-position.x,dy=p.y-position.y,dz=p.z-position.z;
    return dx*dx+dy*dy+dz*dz<=radiusSquared;
  });
}
