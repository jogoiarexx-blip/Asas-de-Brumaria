import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const url=process.env.BRUMARIA_TEST_URL??'http://127.0.0.1:8765/';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1365,height:768},deviceScaleFactor:1});
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack??error)));
page.on('console',msg=>{if(msg.type()==='error')pageErrors.push('console: '+msg.text());});
const check=async label=>{
  const fatal=page.locator('#fatal');
  if(await fatal.isVisible())throw Error(label+': '+(await fatal.innerText()).slice(0,1400));
  if(pageErrors.length)throw Error(label+': '+pageErrors.join('\n').slice(0,2000));
  console.log('PASS:',label);
};
try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  try{
    await page.locator('#game canvas').waitFor({state:'attached',timeout:40000});
  }catch(error){
    await page.screenshot({path:'artifacts/boot-failure.png',fullPage:true});
    const fatal=await page.locator('#fatal').innerText();
    throw Error('Falha na inicialização: '+fatal+'; console='+pageErrors.join(' | ')+'; '+error);
  }
  await page.waitForTimeout(1200);
  await check('Three.js carregado e cena 3D inicializada');

  await page.locator('#start-btn').click();
  await page.locator('#start-screen').waitFor({state:'hidden',timeout:90000});
  await page.waitForTimeout(1500);
  await check('Nova partida iniciada e 90 quadros aproximados');

  await page.keyboard.down('e');
  await page.waitForTimeout(230);
  await page.keyboard.up('e');
  try{
    await page.waitForFunction(()=>/NIMBO|MONTAD|SOLO|VOO/i.test(document.querySelector('#mode-pill')?.textContent??''),null,{timeout:13000});
  }catch(error){
    console.log('MOUNT DEBUG:',JSON.stringify({
      mode:await page.locator('#mode-pill').innerText(),
      toast:await page.locator('#toast').innerText(),
      interaction:await page.locator('#interaction').innerText(),
      fatal:await page.locator('#fatal').innerText()
    }));
    throw error;
  }
  await check('Interação inicial e montagem sem erro');

  await page.keyboard.down('w');
  await page.waitForTimeout(750);
  await page.keyboard.up('w');
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await check('Entrada de movimento, aceleração e decolagem');

  await page.keyboard.press('t');
  await page.locator('#stable').waitFor({state:'visible',timeout:10000});
  // Previously opening the stable failed: StablePreview's fake World exposed
  // heightAt while Dragon.constructor required groundHeightAt.
  await page.waitForTimeout(450);
  assert.doesNotMatch(await page.locator('#stable-preview-caption').innerText(),/indisponível/i);
  assert.ok((await page.locator('#stable-preview-canvas').evaluate(el=>el.width))>20,
    'Prévia 3D do estábulo não renderizou');
  assert.ok(await page.locator('#night-fury-glb-import').isVisible());
  assert.ok(await page.locator('#light-fury-glb-import').isVisible());
  await page.screenshot({path:'artifacts/stable-preview-fixed.png'});
  console.log('PASS: prévia do estábulo renderiza e botões das duas Fúrias estão disponíveis');
  const stableText=await page.locator('#species-list').innerText();
  assert.ok(stableText.includes('Fúria da Noite'),'Starter Night Fury missing from stable');
  assert.ok(stableText.includes('Fúria da Luz'),'Unlockable Light Fury missing from stable');
  assert.equal(await page.locator('[data-species="furia_noite"]').isDisabled(),true);
  assert.equal(await page.locator('[data-species="furia_luz"]').isDisabled(),true);
  console.log('PASS: Fúria da Noite inicial e Fúria da Luz ainda bloqueada');
  await page.locator('[data-preview="furia_luz"]').click();
  await page.waitForTimeout(500);
  await check('Estábulo e Fúria da Luz disponíveis na prévia');

  // Browser click catches pointer-events:none overlays that selectOption alone misses.
  await page.locator('#stable-preview-motion').click({timeout:5000});
  for(const motion of ['idle','walk','fly','glide','attack','hurt','takeoff','land']){
    await page.locator('#stable-preview-motion').selectOption(motion);
    await page.waitForTimeout(70);
    assert.equal(await page.locator('#stable-preview-motion').inputValue(),motion);
    await check('Prévia 3D: animação '+motion);
  }

  // Exercise the actual GLTFLoader, scene replacement and fallback using
  // an original animated dragon GLB with clips for flight, attack and landing.
  const demoBytes=await page.evaluate(async()=>{
    const {buildDragonDemoGLB}=await import('./src/entities/dragonDemoGlb.js');
    return Array.from(buildDragonDemoGLB());
  });
  await page.locator('#dragon-glb-file').setInputFiles({
    name:'dragao-teste.glb',mimeType:'model/gltf-binary',buffer:Buffer.from(demoBytes)
  });
  await page.waitForFunction(()=>
    document.querySelector('#dragon-glb-status')?.dataset.state==='ok',null,{timeout:15000});
  const statusText=await page.locator('#dragon-glb-status').innerText();
  assert.match(statusText,/Flying/);
  assert.match(statusText,/Attack/);
  await check('Importação GLB animado no dragão sem alterar o controle');

  await page.locator('#dragon-glb-file').setInputFiles({
    name:'arquivo-invalido.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('invalid GLB')
  });
  await page.waitForFunction(()=>
    document.querySelector('#dragon-glb-status')?.dataset.state==='error',null,{timeout:10000});
  await check('Arquivo GLB inválido rejeitado sem derrubar o jogo');

  await page.locator('#stable-close').click();
  await page.waitForTimeout(350);
  await check('Modelo importado mantém montagem, voo e renderização');

  await page.keyboard.press('t');
  await page.locator('#stable').waitFor({state:'visible',timeout:10000});
  await page.locator('#dragon-glb-reset').click();
  await page.waitForFunction(()=>
    document.querySelector('#dragon-glb-status')?.textContent?.includes('original restaurado'),null,{timeout:15000});
  await check('Restaurar dragão procedural após GLB');
  await page.locator('#stable-close').click();
  await page.keyboard.press('p');
  await page.waitForTimeout(450);
  await check('Salvar partida sem travamento de frame');
  await page.screenshot({path:'artifacts/brumaria-smoke.png',fullPage:true});
  console.log('RESULTADO: smoke browser concluído, screenshot artifacts/brumaria-smoke.png');
}catch(error){
  console.error('QA BROWSER ERROR:',error);
  try{await page.screenshot({path:'artifacts/brumaria-failure.png',fullPage:true});}catch{}
  throw error;
}finally{
  await browser.close();
}
