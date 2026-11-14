/** Regressão real no Chromium para erro HTTP 503 em /src/game/Game.js. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720}});
let rejected=0;
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route(/\/src\/game\/Game\.js(?:\?|$)/,route=>{
  if(rejected<2){rejected++;return route.fulfill({status:503,contentType:'text/plain',body:'Service Unavailable'});}
  return route.continue();
});
await page.route('**/src/main.js',async route=>{
  const response=await route.fetch(),body=await response.text();
  assert.match(body,/const BOOT_RETRY_DELAYS=/);
  return route.fulfill({response,body:body.replace('new Game();','window.__retryQA=new Game();')});
});
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.__retryQA&&!document.querySelector('#start-btn')?.disabled,
    null,{timeout:90000});
  assert.equal(rejected,2,'two mocked HTTP 503 responses were not exercised');
  assert.equal(await page.locator('#fatal').isVisible(),false,'fatal error appeared despite recovery');
  assert.deepEqual(errors,[],'uncaught browser errors after recovery');
  console.log('GITHUB_PAGES_HTTP_503_AUTO_RECOVERY_PASS',JSON.stringify({rejected}));
}finally{await browser.close();}
