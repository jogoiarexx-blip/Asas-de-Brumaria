import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('cinematic main menu is local, responsive and retains action identifiers',()=>{
 const html=read('../index.html'),css=read('../src/ui/mainMenu.css');
 const art=read('../assets/menu/brumaria-sky.svg');
 for(const id of ['start-screen','menu-title','start-btn','start-btn-label','new-game-btn',
   'menu-settings-btn','menu-load-status','menu-preview','menu-controls'])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/body class="menu-open"/);
 assert.match(html,/src\/ui\/mainMenu\.css/);
 assert.match(css,/brumaria-sky\.svg/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.ok(art.length<16000,'static art too large for startup');
 assert.match(art,/<svg/);
 assert.match(art,/dragon/);
 assert.ok(!css.includes('cdn.')&&!css.includes('https://'),'poster must render offline');
});
test('menu must not run WebGL, gameplay updates, save ticks or timers',()=>{
 const game=read('../src/game/Game.js');
 assert.match(game,/if\(!this\.started\)\{\s*this\.input\.clearActions\(\);\s*return;\s*\}/);
 const pause=game.indexOf('if(!this.started){\n      this.input.clearActions();\n      return;');
 const world=game.indexOf('this.world.update(dt,this.elapsed);',pause);
 const renderer=game.indexOf('this.renderer.render(this.scene,this.camera);',world);
 assert.ok(pause>0&&world>pause&&renderer>world);
 assert.match(game,/this\.clock\.getDelta\(\);this\.fpsTime=0;this\.frames=0;/);
 assert.match(game,/document\.body\.classList\.remove\('menu-open'\)/);
 assert.match(game,/document\.getElementById\('start-btn-label'\)\.textContent='CONTINUAR AVENTURA'/);
 assert.match(game,/document\.getElementById\('gpu-panel'\)\.classList\.remove\('hidden'\)/);
 assert.match(game,/play\.disabled=false/);
});
