import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../assets/textures/terrain/',import.meta.url);
const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
const names=['meadow','beach','stone','ash','crystal'];
test('real downloaded texture manifest contains 5 explicitly licensed CC0 materials',()=>{
 assert.equal(manifest.source,'Poly Haven');
 assert.equal(manifest.license,'CC0-1.0');
 assert.equal(manifest.license_url,'https://polyhaven.com/license');
 assert.deepEqual(Object.keys(manifest.materials).sort(),[...names].sort());
 for(const [key,asset] of Object.entries(manifest.materials)){
  assert.equal(asset.page,`https://polyhaven.com/a/${asset.asset}`);
  assert.match(asset.channels.diff.source_url,/^https:\/\/(dl\.polyhaven\.org|cdn\.polyhaven\.com)\//);
  assert.match(asset.channels.normal.source_url,/^https:\/\/(dl\.polyhaven\.org|cdn\.polyhaven\.com)\//);
  assert.ok(names.includes(key));
 }
});
test('all 20 WebP images are present, hash verified, optimized and the right size',()=>{
 let total=0;
 for(const key of names){
  const asset=manifest.materials[key];
  for(const [channel,entry] of Object.entries(asset.channels)){
   assert.ok(['diff','normal'].includes(channel));
   for(const [tier,record] of Object.entries(entry.variants)){
    const p=new URL(record.filename,root);
    assert.ok(existsSync(p),record.filename+' not committed to GitHub');
    const bytes=readFileSync(p);total+=bytes.length;
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.equal(bytes.length,record.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
    assert.deepEqual(record.size,[tier==='desktop'?2048:1024,tier==='desktop'?2048:1024]);
    assert.ok(bytes.length<4_500_000,'browser download budget exceeded: '+record.filename);
   }
  }
 }
 assert.ok(total<25_000_000,'terrain budget too heavy for a casual browser game');
});
test('terrain integration retains vertex coloring, accurate UV mapping and dynamic quality',()=>{
 const world=src('../src/world/World.js'),manager=src('../src/world/TerrainTextureManager.js');
 assert.match(world,/uv\.push\(x\/14,z\/14\)/);
 assert.match(world,/geo\.setAttribute\('uv'/);
 assert.match(world,/new THREE\.MeshLambertMaterial\(\{vertexColors:true,side:THREE\.DoubleSide\}\)/);
 assert.match(world,/this\.terrainTextures\.register\(terrainKind\(island\),material\)/);
 assert.match(world,/this\.terrainTextures\.setQuality\(tier\)/);
 assert.match(manager,/THREE\.SRGBColorSpace:THREE\.NoColorSpace/);
 assert.match(manager,/THREE\.LinearMipmapLinearFilter/);
 assert.match(manager,/this\.serial/);
 assert.match(manager,/texture\?1\.65:1/);
 assert.match(manager,/job\.channel==='diff'&&job\.tier==='desktop'/);
 assert.match(manager,/return quality==='quality'\?'desktop':'mobile'/);
 assert.match(manager,/Procedural fallback for missing/);
});
