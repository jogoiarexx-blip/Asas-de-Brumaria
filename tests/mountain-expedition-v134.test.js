import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeExpedition,ExpeditionProgress,shouldLoadMountain,shouldEnterMountain,shouldExitMountain,BOAT_POSITIONS,MOUNTAIN_PORTAL} from '../src/systems/ExpeditionRules.js';
import {readGPUSettings,chooseContextOptions,describeRenderer,pixelScaleFor} from '../src/systems/GPUSettings.js';

// Starting a brand new side campaign must not rewrite the main mission stage.
test('expedição nova começa nos barcos sem alterar missões principais',()=>{
 const progress=new ExpeditionProgress();assert.equal(progress.phase,'boats');assert.equal(progress.boatsSunk,0);assert.equal(progress.bossHealth,12);
 assert.equal(BOAT_POSITIONS.length,3);
});
test('três barcos exigem dois acertos cada e só depois liberam o dragão gigante',()=>{
 const mission=new ExpeditionProgress();for(let i=0;i<3;i++){
  assert.equal(mission.hitBoat(i).sunk,false);assert.equal(mission.hitBoat(i).sunk,true);
 }
 assert.equal(mission.phase,'boss');assert.equal(mission.boatsSunk,3);
});
test('chefe é invulnerável antes dos barcos e oferece recompensa apenas uma vez',()=>{
 const mission=new ExpeditionProgress();assert.equal(mission.hitBoss().hit,false);
 for(let i=0;i<3;i++){mission.hitBoat(i);mission.hitBoat(i);}
 for(let i=0;i<11;i++)assert.equal(mission.hitBoss().defeated,false);
 assert.equal(mission.hitBoss().defeated,true);assert.equal(mission.phase,'return');
 assert.equal(mission.completeReturn(),true);assert.equal(mission.completeReturn(),false);
 assert.equal(mission.phase,'complete');
});
test('trânsito de mundo só ocorre montado, no ar, na direção da passagem',()=>{
 assert.equal(shouldLoadMountain({x:MOUNTAIN_PORTAL.x-30,y:40,z:MOUNTAIN_PORTAL.z},true),true);
 assert.equal(shouldLoadMountain({x:0,y:40,z:0},true),false);
 assert.equal(shouldEnterMountain({x:MOUNTAIN_PORTAL.x-1,y:MOUNTAIN_PORTAL.y,z:MOUNTAIN_PORTAL.z},true),true);
 assert.equal(shouldEnterMountain({x:MOUNTAIN_PORTAL.x-1,y:3,z:MOUNTAIN_PORTAL.z},true),false);
 assert.equal(shouldExitMountain({x:733,y:51,z:0},true),true);
});
test('dados antigos e malformados restauram progresso seguro',()=>{
 const old=normalizeExpedition(null);assert.equal(old.phase,'boats');
 const fix=normalizeExpedition({boatHealth:[-10,Infinity,1],bossHealth:999,phase:'complete',rewarded:false});
 assert.deepEqual(fix.boatHealth,[0,2,1]);assert.equal(fix.phase,'boats');
 const battle=new ExpeditionProgress({boatHealth:[0,0,0],bossHealth:4,phase:'boss'});
 assert.equal(battle.bossHealth,4);assert.equal(battle.phase,'boss');
});
test('GPU: navegador recebe apenas preferência, não escolha forçada de placa física',()=>{
 assert.equal(chooseContextOptions({preference:'high-performance',antialias:false}).powerPreference,'high-performance');
 assert.equal(chooseContextOptions({preference:'integrated',antialias:true}).powerPreference,'default');
 assert.equal(readGPUSettings({getItem:()=>'{"preference":"low-power","resolution":0.75,"shadows":false}'}).shadows,false);
 assert.equal(pixelScaleFor(0.75),.75);assert.equal(pixelScaleFor(NaN),1);
});
test('GPU desconhecida expõe mensagem neutra, sem inventar um dispositivo',()=>{
 assert.match(describeRenderer(null),/indisponível/i);
 const gl={getExtension:()=>null,getParameter:()=> 'WebGL Render'};
 assert.match(describeRenderer(gl),/WebGL/);
});
test('integração usa carregamento dinâmico e persistência de expedição',()=>{
 const game=readFileSync(new URL('../src/game/Game.js',import.meta.url),'utf8');
 assert.match(game,/import\('\.\.\/world\/MountainRegion\.js'\)/);
 assert.match(game,/this\.expedition\.snapshot\(\)/);
 assert.match(game,/hitBoat\(/);assert.match(game,/hitBoss\(/);
 const save=readFileSync(new URL('../src/systems/SaveSystem.js',import.meta.url),'utf8');assert.match(save,/normalizeExpedition/);
});
