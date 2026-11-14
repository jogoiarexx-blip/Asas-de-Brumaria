import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('v1.6.1: pausa congela a simulação antes de IA, física e clima, e Esc fecha painéis primeiro',()=>{
  const game=src('../src/game/Game.js'),html=src('../index.html');
  const paused=game.indexOf('if(this.paused){'),sim=game.indexOf('this.world.update(dt,this.elapsed)');
  assert.ok(paused>0&&sim>paused,'o bloqueio de pausa precisa vir antes da simulação');
  assert.match(game,/if\(!anyOpen\)\{this\.setPaused\(true\);return;\}/);
  assert.match(game,/const next=!!paused&&this\.started&&!this\.benchmark\?\.active/);
  assert.match(game,/this\.audio\.ctx\?\.suspend\?\.\(\)/);
  for(const id of ['pause-screen','pause-resume','pause-video','pause-save','pause-hud'])
    assert.match(html,new RegExp('id="'+id+'"'));
});

test('v1.6.1: lanternas acendem à noite só por uniformes, sem luz dinâmica nova',()=>{
  const world=src('../src/world/World.js'),game=src('../src/game/Game.js');
  const glow=world.slice(world.indexOf('buildLanternGlow(){'),world.indexOf('  // Batch static vegetation'));
  assert.doesNotMatch(glow,/PointLight|SpotLight|castShadow=true/);
  assert.match(glow,/emissiveIntensity=\.55\+n\*2\.4/);
  assert.match(glow,/THREE\.AdditiveBlending/);
  assert.match(game,/this\.world\.setNightGlow\(night\)/);
});

test('v1.6.1: cascatas são uma única malha sem colisão que segue o relevo',()=>{
  const world=src('../src/world/World.js');
  const block=world.slice(world.indexOf('buildCascades(){'),world.indexOf('buildLanternGlow(){'));
  assert.match(block,/this\.heightAt\(x,z\)/);
  assert.match(block,/this\.cascades=new THREE\.Mesh\(geometry,material\)/);
  assert.doesNotMatch(block,/addObstacle|castShadow=true/);
  assert.match(world,/this\.cascadeTexture\.offset\.y=/);
});

test('v1.6.1: aurora só aparece à noite e não usa textura',()=>{
  const sky=src('../src/world/SkyDome.js');
  assert.match(sky,/if\(uNight>0\.02\)\{/);
  assert.match(sky,/uNight:\{value:0\},uTime:\{value:0\}/);
  assert.doesNotMatch(sky,/sampler2D|TextureLoader/);
});
