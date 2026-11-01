import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
const errors=[];
page.on('pageerror',err=>errors.push(String(err)));
await page.route('**/src/main.js',async route=>{
  const response=await route.fetch(),source=await response.text();
  assert.ok(source.includes('new Game();'));
  await route.fulfill({response,body:source.replace('new Game();','window.__upgradeGame=new Game();')});
});
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>Boolean(window.__upgradeGame),null,{timeout:45000});
  const stored=await page.evaluate(()=>window.__upgradeGame.saveGame(true));
  assert.equal(stored,true,'No local game save available for export');
  const transfer=page.waitForEvent('download');
  await page.locator('#save-export').click();
  const download=await transfer;
  assert.ok(download.suggestedFilename().endsWith('.json'));
  await page.locator('#menu-settings-btn').click();
  await page.locator('#audio-effects').fill('35');
  await page.locator('#audio-ambience').fill('20');
  const levels=await page.evaluate(()=>window.__upgradeGame.audio.volumes);
  assert.ok(Math.abs(levels.effects-.35)<.01);
  assert.ok(Math.abs(levels.ambience-.2)<.01);
  await page.locator('#gpu-close').click();
  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  const outcome=await page.evaluate(async()=>{
    const game=window.__upgradeGame;
    const {LANDMARKS}=await import('./src/systems/Discovery.js');
    const site=LANDMARKS[0];
    game.hero.group.position.set(site.x,game.world.groundHeightAt(site.x,site.z,.5),site.z);
    const first=game.tryIslandActivity();
    const repeat=game.tryIslandActivity();
    game.saveGame(true);
    const json=game.saveSystem.exportBackup();
    const restored=game.saveSystem.importBackup(json);
    return {first,repeat,activities:game.islandActivities.total,
      savedActivities:game.saveSystem.read()?.islandActivities?.completed?.[0],
      restored:restored.ok,questHint:document.getElementById('quest-hint')?.textContent,
      hitFeedback:!!document.getElementById('hit-confirm')};
  });
  assert.equal(outcome.first,true);
  assert.equal(outcome.activities,1);
  assert.equal(outcome.savedActivities,true);
  assert.equal(outcome.restored,true);
  assert.equal(outcome.hitFeedback,true);
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.locator('#mobile-controls').evaluate(el=>({
    visible:getComputedStyle(el).display!=='none',
    minButton:Math.min(...[...el.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height)),
    viewport:document.documentElement.clientWidth,
    pageWidth:document.documentElement.scrollWidth
  }));
  assert.equal(mobile.visible,true);
  assert.ok(mobile.minButton>=40,'mobile buttons too small');
  assert.ok(mobile.pageWidth<=mobile.viewport+1,'horizontal overflow mobile');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'artifacts/v151-hud-mobile.png'});
  console.log('V151_SAVE_AUDIO_ISLAND_MOBILE_PASS',JSON.stringify({outcome,levels,mobile}));
}catch(error){
  console.error('V151_BROWSER_ERROR',error);
  try{await page.screenshot({path:'artifacts/v151-browser-error.png'});}catch{}
  throw error;
}finally{await browser.close();}
