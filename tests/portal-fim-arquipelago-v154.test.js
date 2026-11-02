import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ISLANDS} from '../src/world/config.js';
import {MOUNTAIN_PORTAL,shouldLoadMountain,shouldEnterMountain,shouldExitMountain,
  shouldHoldMountainGate,shouldUnloadMountain} from '../src/systems/ExpeditionRules.js';
import {shouldShowMountainHint} from '../src/systems/ObjectiveGuidance.js';
import {normalizeSave} from '../src/systems/SaveSystem.js';

const point=(x,z,y=44)=>({x,z,y});
test('portal fica no limite leste da última ilha, sem invadir as Montanhas',()=>{
  const ash=ISLANDS.find(i=>i.name==='Ilha das Cinzas');
  assert.ok(ash,'Ilha das Cinzas ausente');
  assert.ok(MOUNTAIN_PORTAL.x>620 && MOUNTAIN_PORTAL.x<650);
  assert.ok(Math.hypot(MOUNTAIN_PORTAL.x-ash.x,MOUNTAIN_PORTAL.z-ash.z)<ash.r);
  assert.ok(ash.x+ash.r<650);
  assert.ok(ash.x+ash.r-MOUNTAIN_PORTAL.x<20);
  assert.equal(MOUNTAIN_PORTAL.returnZ,MOUNTAIN_PORTAL.z);
  assert.ok(MOUNTAIN_PORTAL.returnX<MOUNTAIN_PORTAL.x);
  assert.ok(Math.hypot(MOUNTAIN_PORTAL.returnX-ash.x,MOUNTAIN_PORTAL.returnZ-ash.z)<ash.r*.92);
});
test('a travessia exige entrar no anel, não mais cruzar a coordenada antiga',()=>{
  const oldGate=point(365,35,55);
  assert.equal(shouldLoadMountain(oldGate,true),false);
  assert.equal(shouldEnterMountain(oldGate,true),false);
  assert.equal(shouldEnterMountain(point(633,-130),true),false);
  assert.equal(shouldEnterMountain(point(632,-192.5,100),true),false);
  assert.equal(shouldEnterMountain(point(632,-192.5),false),false);
  assert.equal(shouldEnterMountain(point(632,-192.5),true),true);
  assert.equal(shouldLoadMountain(point(515,-192.5,50),true),true);
  assert.equal(shouldLoadMountain(point(515,-192.5,50),false),false);
  assert.equal(shouldHoldMountainGate(point(632,-192.5),true,true,false),true);
  assert.equal(shouldHoldMountainGate(point(632,-192.5),true,true,true),false);
  assert.equal(shouldHoldMountainGate(point(632,-192.5),true,false,false),false);
  assert.equal(shouldUnloadMountain(point(8,7)),true);
  assert.equal(shouldUnloadMountain(point(633,-192.5)),false);
  assert.equal(shouldExitMountain(point(712,55),true),true);
  assert.equal(shouldExitMountain(point(712,55),false),false);
});
test('indicação de missão e minimapa acompanham portal final',()=>{
  assert.equal(shouldShowMountainHint(point(633,-192.5),3,false,false),true);
  assert.equal(shouldShowMountainHint(point(328,35),3,false,false),false);
  assert.equal(shouldShowMountainHint(point(633,-192.5),2,false,false),false);
  const ui=readFileSync(new URL('../src/ui/UI.js',import.meta.url),'utf8');
  const game=readFileSync(new URL('../src/game/Game.js',import.meta.url),'utf8');
  assert.match(ui,/mx\(MOUNTAIN_PORTAL\.x\)/);
  assert.match(ui,/my\(MOUNTAIN_PORTAL\.z\)/);
  assert.match(game,/root\.position\.set\(MOUNTAIN_PORTAL\.x,MOUNTAIN_PORTAL\.y,MOUNTAIN_PORTAL\.z\)/);
  assert.match(game,/this\.gateMustLeave=true/);
  assert.match(game,/MOUNTAIN_PORTAL\.returnX/);
});
test('save na entrada antiga desloca apenas o jogador e preserva progresso',()=>{
 const old={version:1,layoutVersion:3,mission:{stage:6,progress:1},progression:{points:27},
   player:{x:310,z:35,y:50,mounted:true,airborne:true,heroX:300,heroZ:35}};
 const upgraded=normalizeSave(old);
 assert.equal(upgraded.portalVersion,2);
 assert.equal(upgraded.player.x,MOUNTAIN_PORTAL.returnX);
 assert.equal(upgraded.player.z,MOUNTAIN_PORTAL.returnZ);
 assert.equal(upgraded.player.heroX,MOUNTAIN_PORTAL.returnX-8);
 assert.equal(upgraded.mission.stage,6);
 assert.equal(upgraded.progression.points,27);
 assert.deepEqual(normalizeSave(upgraded).player,upgraded.player);
 const stable=normalizeSave({...old,portalVersion:2,player:{...old.player,x:332,z:35}});
 assert.equal(stable.player.x,332,'novo save fora do portal não pode ser movido');
 const mountain=normalizeSave({...old,player:{...old.player,x:940,z:40}});
 assert.equal(mountain.player.x,940,'montanhas ficam na região original');
});
