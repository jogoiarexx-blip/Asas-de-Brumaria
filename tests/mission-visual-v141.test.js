import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {headingToObjective,missionNextStep,shouldShowMountainHint} from '../src/systems/ObjectiveGuidance.js';
import {rainStreakPoints} from '../src/systems/WeatherStreaks.js';
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('navegação distingue esquerda, direita, frente e retorno',()=>{
 const from={x:0,z:0};
 assert.equal(headingToObjective(from,{x:0,z:-100},0).direction,'EM FRENTE');
 assert.equal(headingToObjective(from,{x:80,z:0},0).direction,'À DIREITA');
 assert.equal(headingToObjective(from,{x:-80,z:0},0).direction,'À ESQUERDA');
 assert.equal(headingToObjective(from,{x:0,z:80},0).direction,'ATRÁS');
});
test('orientação mantém distância horizontal mesmo com grande diferença de altura',()=>{
 const nav=headingToObjective({x:0,y:100,z:0},{x:30,y:0,z:-40},0);
 assert.equal(nav.distance,50);assert.equal(nav.direction,'À DIREITA');
});
test('sem destino o HUD não aponta falsamente para o jogador',()=>{
 assert.equal(headingToObjective({x:0,z:0},null,0),null);
 assert.equal(headingToObjective({x:0,z:0},{x:0,z:0},NaN).direction,'CHEGOU');
});
test('a missão dos sentinelas mostra vida do alvo e ação imediata',()=>{
 const instruction=missionNextStep({stage:4,progress:1,riding:true,nearestEnemyHealth:2});
 assert.match(instruction,/2 sentinelas/);assert.match(instruction,/2 PV/);assert.match(instruction,/FOGO/);
});
test('resgate orienta aproximação, transporte e entrega sem pular etapas',()=>{
 assert.match(missionNextStep({stage:5,carriedIndex:-1,rescueHold:0,riding:true}),/DEVAGAR/);
 assert.match(missionNextStep({stage:5,carriedIndex:-1,rescueHold:.7,riding:true}),/APROXIMAÇÃO/);
 assert.match(missionNextStep({stage:5,carriedIndex:1,riding:true}),/SANTUÁRIO/);
});
test('treinamento, circuito e combate têm orientações diferentes',()=>{
 assert.match(missionNextStep({stage:1,progress:2,riding:true}),/3º aro/);
 assert.match(missionNextStep({stage:6,riding:false}),/ESTÁBULO/);
 assert.match(missionNextStep({inMountain:true,expeditionPhase:'boss',bossHealth:5,riding:true}),/CONTRA-ATAQUE/);
});
test('portal é contextual, não tapa o minimapa durante missões distantes',()=>{
 assert.equal(shouldShowMountainHint({x:0,z:0},4,false,false),false);
 assert.equal(shouldShowMountainHint({x:620,z:-192.5},4,false,false),true);
 assert.equal(shouldShowMountainHint({x:620,z:-192.5},1,false,false),false);
 assert.equal(shouldShowMountainHint({x:620,z:-192.5},4,true,false),false);
});
test('chuva usa linhas finas e não partículas quadradas',()=>{
 const weather=source('../src/systems/Weather.js');
 assert.match(weather,/new THREE\.LineSegments/);
 assert.doesNotMatch(weather,/new THREE\.Points\(/);
 const streak=rainStreakPoints({x:4,y:8,z:9},.5,1);
 assert.equal(streak.length,6);
 assert.ok(streak[4]<streak[1]);
});
test('traços de chuva são curtos, finitos e influenciados pelo vento',()=>{
 for(const wind of [-2,0,3]){
  const p=rainStreakPoints({x:1,y:2,z:3},.7,wind);
  assert.ok(p.every(Number.isFinite));
  assert.ok(p[1]-p[4]>=1.3&&p[1]-p[4]<5);
 }
 assert.equal(rainStreakPoints({x:0,y:0,z:0},0,0).length,6);
});
test('HUD expõe etapa ativa e direção da próxima missão',()=>{
 const html=source('../index.html'),ui=source('../src/ui/UI.js');
 assert.match(html,/id="quest-guide"/);
 assert.match(ui,/missionNextStep\(/);
 assert.match(ui,/headingToObjective\(/);
 assert.match(ui,/shouldShowMountainHint\(/);
});

test('marcadores de cristais e filhotes deixam o céu mais limpo',()=>{
 const missions=source('../src/systems/Missions.js');
 assert.match(missions,/CylinderGeometry\(\.13,\.7,22/);
 const hatchlings=source('../src/entities/HatchlingVisual.js');
 assert.match(hatchlings,/CylinderGeometry\(\.12,\.8,15/);
 assert.doesNotMatch(missions,/CylinderGeometry\(\.26,1\.7,48/);
});
