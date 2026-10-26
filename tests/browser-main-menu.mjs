import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1365,height:768},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/src/main.js',async route=>{
  const response=await route.fetch(),body=await response.text();
  assert.ok(body.includes('new Game();'));
  await route.fulfill({response,body:body.replace('new Game();','window.__menuQA=new Game();')});
});
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__menuQA&&
    !document.querySelector('#start-btn').disabled,null,{timeout:45000});
  assert.equal(await page.locator('body').getAttribute('class'),'menu-open');
  assert.ok(await page.locator('#menu-title').isVisible());
  assert.ok(await page.locator('#menu-settings-btn').isVisible());
  assert.ok(await page.locator('#start-screen .menu-art').isVisible());
  assert.ok((await page.locator('#menu-title').innerText()).includes('BRUMÁRIA'));
  assert.equal(await page.locator('#start-btn-label').innerText(),'INICIAR AVENTURA');
  const before=await page.evaluate(()=>{
    const game=window.__menuQA;
    const stats={render:0,world:0,dragon:0};
    const originals={render:game.renderer.render.bind(game.renderer),
      world:game.world.update.bind(game.world),
      dragon:game.dragon.update.bind(game.dragon)};
    game.renderer.render=(...args)=>{stats.render++;return originals.render(...args);};
    game.world.update=(...args)=>{stats.world++;return originals.world(...args);};
    game.dragon.update=(...args)=>{stats.dragon++;return originals.dragon(...args);};
    window.__menuRenderProbe=stats;
    return {elapsed:game.elapsed,started:game.started};
  });
  await page.waitForTimeout(550);
  const still=await page.evaluate(()=>({
    ...window.__menuRenderProbe,
    elapsed:window.__menuQA.elapsed,
    started:window.__menuQA.started
  }));
  assert.equal(before.started,false);
  assert.equal(still.started,false);
  assert.deepEqual([still.render,still.world,still.dragon],[0,0,0],
    'menu rendered WebGL or ran gameplay behind the illustrated title screen');
  assert.equal(still.elapsed,before.elapsed,'game time progressed while menu open');
  await page.locator('#menu-settings-btn').click();
  assert.ok(await page.locator('#gpu-panel').isVisible());
  await page.locator('#gpu-close').click();
  assert.equal(await page.locator('#gpu-panel').isVisible(),false);
  await page.locator('#start-screen .menu-controls summary').click();
  assert.ok(await page.locator('.menu-controls-panel').isVisible());
  await page.screenshot({path:'artifacts/menu-principal-pc.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.evaluate(()=>{
    const btn=document.querySelector('#start-btn').getBoundingClientRect();
    const frame=document.querySelector('#start-screen').getBoundingClientRect();
    const style=getComputedStyle(document.querySelector('#start-screen .menu-preview'));
    return {button:{top:btn.top,bottom:btn.bottom,left:btn.left,right:btn.right},
      frameHeight:frame.height,scrollWidth:document.documentElement.scrollWidth,
      windowWidth:innerWidth,previewDisplay:style.display};
  });
  assert.ok(mobile.button.top>=0&&mobile.button.bottom<=844,
    'play button clipped on phone viewport: '+JSON.stringify(mobile));
  assert.ok(mobile.button.left>=0&&mobile.button.right<=390);
  assert.ok(mobile.scrollWidth<=mobile.windowWidth+1,'horizontal overflow on mobile');
  assert.equal(mobile.previewDisplay,'none');
  await page.screenshot({path:'artifacts/menu-principal-celular.png',fullPage:true});
  await page.locator('#start-btn').click();
  await page.waitForFunction(()=>window.__menuQA?.started===true,null,{timeout:10000});
  assert.equal(await page.locator('#start-screen').isVisible(),false);
  const bodyClass=await page.locator('body').getAttribute('class');
  assert.equal(bodyClass?.includes('menu-open')??false,false);
  await page.waitForTimeout(400);
  const after=await page.evaluate(()=>({...window.__menuRenderProbe}));
  assert.ok(after.render>0&&after.world>0&&after.dragon>0,
    'real game did not resume rendering/simulation after play');
  assert.deepEqual(errors,[]);
  console.log('CINEMATIC_MAIN_MENU_DESKTOP_MOBILE_PAUSE_SETTINGS_RESUME_PASS',
    JSON.stringify({before,still,mobile,after}));
}catch(error){
 console.error('MAIN_MENU_QA_FAILED',error);
 try{await page.screenshot({path:'artifacts/menu-principal-falha.png',fullPage:true});}catch{}
 throw error;
}finally{await browser.close();}
