import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const mountain=read('../src/world/MountainRegion.js');
const section=mountain.slice(mountain.indexOf('  buildShips(){'),mountain.indexOf('  buildBoss(){'));
test('os três navios inimigos da região das Montanhas recebem casco modelado, velas curvas e escudos',()=>{
 assert.match(section,/const stations=\[/);
 assert.match(section,/const hullGeo=makeGeo\(hullVertices,hullIndices\)/);
 assert.match(section,/const sailGeo=new THREE\.BufferGeometry\(\)/);
 assert.match(section,/const shieldGeo=new THREE\.CylinderGeometry\(/);
 assert.match(section,/const prow=add\(/);
 assert.match(section,/setRigging\(group,/);
 assert.match(section,/this\.boatWakes\.push\(wake\)/);
});
test('preserva os obstáculos, alvos, resistência, mastros, convés e efeitos de naufrágio',()=>{
 assert.match(section,/BOAT_POSITIONS\.length/);
 assert.match(section,/radius:7,bottom:2,top:17,type:'enemy-ship',shape:'box',halfWidth:7,halfDepth:3\.8/);
 for(const fragment of ['this.boatDecks.push(deck)','this.boatMasts.push(mast)','this.boats.push(group)','this.boatSails.push(sail)','this.boatObstacles.push(obstacle)','this.boatDebrisMesh=new THREE.InstancedMesh','this.boatRipples.push(ring)'])assert.ok(section.includes(fragment),fragment);
 assert.match(mountain,/shipDamageAppearance\(health\)/);
 assert.match(mountain,/shipSinkingPose\(age\)/);
 assert.match(mountain,/shipDebrisStep\(nextAge,k\)/);
 assert.match(mountain,/shipWaterSplash\(age\)/);
});
test('navios só balançam enquanto vivos e são removidos com a região',()=>{
 assert.match(mountain,/boat\.rotation\.z=Math\.sin\(time\*1\.15\+i\*\.8\)\*\.038/);
 assert.match(mountain,/boat\.rotation\.x=Math\.sin\(time\*\.85\+i\*1\.4\)\*\.026/);
 assert.match(mountain,/if\(this\.boatWakes\?\.\[i\]\)this\.boatWakes\[i\]\.visible=exists/);
 assert.match(mountain,/this\.root\.traverse\(obj=>\{/);
 assert.match(mountain,/release\(obj\.geometry\)/);
});
