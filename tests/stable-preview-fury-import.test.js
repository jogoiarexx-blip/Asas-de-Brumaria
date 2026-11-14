import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('prévia 3D usa a mesma API groundHeightAt do World real',()=>{
  const preview=read('../src/ui/StablePreview.js');
  const dragon=read('../src/entities/Dragon.js');
  assert.match(preview,/groundHeightAt:.*=>-2/);
  assert.match(dragon,/world\.groundHeightAt\(8,7,1\.65\)/);
});
test('GitHub Pages usa GLTFLoader r180 local com fallback de CDN',()=>{
  const main=read('../src/main.js');
  const gltf=read('../src/entities/dragonAssetLoader.js');
  const loader=read('../vendor/addons/loaders/GLTFLoader.js');
  const utils=read('../vendor/addons/utils/BufferGeometryUtils.js');
  // v1.6.0: o Three.js passa a ser publicado em /vendor e é sempre a 1ª opção.
  assert.match(main,/new URL\('\.\.\/vendor\/three\.module\.js',import\.meta\.url\)\.href,/);
  assert.match(read('../vendor/three.module.js'),/three\.core\.js/);
  assert.match(gltf,/const localLoader=new URL\('\.\.\/\.\.\/vendor\/addons\/loaders\/GLTFLoader\.js'/);
  assert.match(gltf,/const urls=\[localLoader,\.\.\.mirrors\]/);
  assert.match(loader,/export \{ GLTFLoader \}/);
  assert.match(loader,/BufferGeometryUtils\.js/);
  assert.match(utils,/toTrianglesDrawMode/);
});
test('carregamento manual por espécie persiste e nunca desbloqueia Fúria da Luz sozinho',()=>{
  const models=read('../src/entities/SpeciesDragonModels.js');
  const ui=read('../src/ui/UI.js');
  const html=read('../index.html');
  assert.match(models,/async installUploaded\(id,bytes,\{previewDragon=null\}=\{\}\)/);
  assert.match(models,/loadSpeciesModel\(id\)/);
  assert.match(models,/saveSpeciesModel\(id,raw\)/);
  assert.match(models,/info\.animationCount!==8/);
  assert.match(models,/skin\.joints\?\.length===49/);
  assert.match(ui,/furia_noite','night-fury-glb-import'/);
  assert.match(ui,/furia_luz','light-fury-glb-import'/);
  assert.match(ui,/!game\.progression\.unlocked\.includes\(species\)/);
  assert.match(html,/id="fury-glb-status"/);
  assert.match(html,/id="night-fury-glb-file"/);
  assert.match(html,/id="light-fury-glb-file"/);
});
