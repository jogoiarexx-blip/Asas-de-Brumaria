import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('boot: módulo principal tem três tentativas com cache-busting para contornar 503',()=>{
  assert.match(main,/const BOOT_RETRY_DELAYS=\[0,600,1400\]/);
  assert.match(main,/url\.searchParams\.set\('brumaria-retry'/);
  assert.match(main,/checkGameResponse\(url\.href,attempt\?'reload':'default'\)/);
  assert.match(main,/HTTP \$\{response\.status\}/);
  assert.match(main,/return await import\(url\.href\)/);
});
test('boot: se Pages falha, tenta CDN com imports relativos e trata erro definitivo',()=>{
  assert.match(main,/const GAME_MODULE_MIRROR='https:\/\/cdn\.jsdelivr\.net\/gh\/jogoiarexx-blip\/Asas-de-Brumaria@main\/src\/game\/Game\.js'/);
  assert.match(main,/await checkGameResponse\(GAME_MODULE_MIRROR,'no-store'\)/);
  assert.match(main,/return await import\(GAME_MODULE_MIRROR\)/);
  assert.match(main,/id="retry-game-load"/);
  assert.match(main,/window\.location\.reload\(\)/);
});
test('boot: não tenta reimportar indefinidamente após erro de sintaxe',()=>{
  assert.match(main,/if\(error instanceof SyntaxError\)throw error;/);
  assert.match(main,/const timer=setTimeout\(\(\)=>controller\.abort\(\),10000\)/);
  assert.match(main,/finally\{clearTimeout\(timer\);\}/);
});
