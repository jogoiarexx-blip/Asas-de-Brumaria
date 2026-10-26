import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chaseCameraYaw,shortestYawDelta} from '../src/game/cameraMovement.js';
import {mapDragonClips,dragonAnimationState,selectDragonClip} from '../src/entities/dragonClipMap.js';
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('camera follows dragon heading smoothly through -PI/+PI, with no jump',()=>{
  let yaw=Math.PI-.10;
  const heading=-Math.PI+.1;
  for(let i=0;i<60;i++){
    const old=Math.abs(shortestYawDelta(yaw,heading));
    const next=chaseCameraYaw(yaw,heading,1/60);
    assert.ok(Math.abs(shortestYawDelta(yaw,next))<.03);
    assert.ok(Math.abs(shortestYawDelta(next,heading))<=old+1e-8);
    yaw=next;
  }
  assert.ok(Math.abs(shortestYawDelta(yaw,heading))<.01);
  assert.equal(chaseCameraYaw(2,0,0),2);
  assert.equal(chaseCameraYaw(2,NaN,.016),2);
});

test('only a genuine attack state can select the attack clip',()=>{
  const attack={name:'Attack'},fly={name:'Fly'};
  const slots=mapDragonClips([attack,fly]);
  assert.equal(slots.idle,fly);
  const d={airborne:true,speed:19,pose:'fly',attackTime:0,hurtTime:0,riding:true};
  assert.equal(dragonAnimationState(d),'fly');
  assert.equal(selectDragonClip(slots,dragonAnimationState(d)),fly);
  d.attackTime=.3;
  assert.equal(selectDragonClip(slots,dragonAnimationState(d)),attack);
  assert.equal(selectDragonClip(mapDragonClips([attack]),'idle'),null);
});

test('attack only after projectile spawn and camera follows after manual orbit cooldown',()=>{
  const game=source('../src/game/Game.js');
  const success=game.indexOf("if(this.spawnProjectile(start,direction,'player')){");
  const attacked=game.indexOf('this.dragon.triggerAttack();',success);
  assert.ok(success>=0&&attacked>success);
  assert.equal(game.slice(game.indexOf('  fire(){'),success).includes('this.dragon.triggerAttack()'),false);
  assert.match(game,/chaseCameraYaw\(this\.cameraOrbit\.yaw,actorYaw,dt/);
  assert.match(game,/performance\.now\(\)>=this\.cameraManualUntil/);
  assert.match(game,/!this\.ui\.dialogueOpen&&this\.input\.consume\('f'\)/);
});

test('compact HUD retains quest, map, graphics controls, full help and stable',()=>{
  const html=source('../index.html'),css=source('../src/ui/style.css');
  for(const id of ['mission-extra','quest-guide','quest-desc','mini-map','hud-options','gpu-toggle','quality-toggle','stable-toggle'])assert.ok(html.includes(`id="${id}"`),id);
  assert.match(css,/#hud #keyboard-help,#hud #gamepad-help/);
  assert.match(css,/#hud #mission-extra/);
});
