import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('v1.7.2: a água da cascata desce a encosta (deslocamento negativo em V)',()=>{
  const world=src('../src/world/World.js');
  assert.match(world,/this\.cascadeTexture\.offset\.y=1-\(time\*\.42\)%1/);
  // V cresce com a distância percorrida morro abaixo.
  assert.match(world,/uvs\.push\(0,travelled\/9,1,travelled\/9\)/);
});

test('v1.7.2: leque de membrana gera recortes entre os dedos e nunca vértices inválidos',()=>{
  // Mesma regra de src/entities/WingGeometry.js, verificada sem Three.js.
  const wing=src('../src/entities/WingGeometry.js');
  const body=wing.slice(wing.indexOf('export function pushScallopedFan'),wing.indexOf('/** Geometria não indexada'));
  const pushScallopedFan=new Function(body.replace('export function pushScallopedFan','return function pushScallopedFan'))();
  const flat=pushScallopedFan([],[0,0,0],[[1,0,0],[1,0,1],[0,0,1]],0);
  assert.equal(flat.length,2*9,'sem recorte: um triângulo por aresta');
  const cut=pushScallopedFan([],[0,0,0],[[1,0,0],[1,0,1],[0,0,1]],.2);
  assert.equal(cut.length,4*9,'com recorte: dois triângulos por aresta');
  assert.ok(cut.every(Number.isFinite));
  const mixed=pushScallopedFan([],[0,0,0],[[1,0,0],[1,0,1],[0,0,1]],[0,.2]);
  assert.equal(mixed.length,3*9);
  // O ponto de recorte fica entre a borda e a âncora.
  const mid=[cut[6],cut[7],cut[8]];
  assert.ok(Math.hypot(mid[0],mid[2])<Math.hypot(1,.5));
});

test('v1.7.2: dragões selvagens e inimigos usam a membrana nova e mantêm as juntas animadas',()=>{
  const wild=src('../src/entities/WildDragons.js'),enemy=src('../src/entities/EnemyDragon.js');
  assert.match(wild,/wingMembraneGeometry\(side,3\.5,2\.35\)/);
  assert.doesNotMatch(wild,/new THREE\.ConeGeometry\(1\.38,3\.35,3\)/);
  assert.match(wild,/wings\.push\(\{joint,side\}\)/);
  assert.match(enemy,/pushScallopedFan\(\[\],mirrored\[0\],mirrored\.slice\(1\),depth\)/);
  assert.match(enemy,/wings\.push\(\{wing,elbow,side\}\)/);
  assert.match(enemy,/return \{root,head,wings,tail,eye\}/);
});

test('v1.7.2: casas detalhadas compartilham materiais, fundem peças e não mudam a colisão',()=>{
  const world=src('../src/world/World.js');
  assert.match(world,/const kit=this\.cabinKit\?\?=this\.makeCabinKit\(\)/);
  assert.match(world,/batchRigidMeshes\(this\.cabinDetail\)/);
  assert.match(world,/this\.cabinDetail\.visible=this\.villageCabins\[0\]\.visible/);
  assert.match(world,/this\.windowMaterial\.emissiveIntensity=n\*1\.9/);
  // Colisores originais intactos.
  assert.match(world,/this\.addObstacle\(x,y,z,Math\.hypot\(3\*size,2\.5\*size\),7\.6\*size,'cabin'\)/);
  assert.match(world,/this\.addObstacle\(x,y\+3\.8\*size,z,5\.3\*size,3\.6\*size,'cabin-roof'\)/);
  const kit=world.slice(world.indexOf('makeCabinKit(){'),world.indexOf('buildCoastRocks(){'));
  assert.doesNotMatch(kit,/PointLight|SpotLight/);
});

test('v1.7.2: rochas da costa são uma malha instanciada; só os pilares têm colisão',()=>{
  const world=src('../src/world/World.js');
  const block=world.slice(world.indexOf('buildCoastRocks(){'),world.indexOf('buildPier(){'));
  assert.match(block,/new THREE\.InstancedMesh\(geometry,material,total\)/);
  assert.match(block,/mesh\.setColorAt\(index,/,'instanceColor criado na construção (sem shader novo em voo)');
  assert.match(block,/if\(stack\)\{\s*this\.addObstacle\(x,ground-1,z,width\*\.95,height\+1,'sea-stack'\)/);
  // Pedras pequenas ficam fora da área caminhável (0,92 do raio).
  assert.match(block,/stack\?1\.2\+rnd\(\)\*\.1:\.965\+rnd\(\)\*\.1/);
  assert.doesNotMatch(block,/Math\.random/);
  assert.equal((world.match(/buildCoastRocks\(\)/g)??[]).length,2);
});

test('v1.7.2: aves com volume mantêm a envergadura usada pelo shader de bater asas',()=>{
  const world=src('../src/world/World.js'),shader=src('../src/world/NatureShaders.js');
  assert.match(shader,/smoothstep\(\.3,2\.9,abs\(position\.x\)\)/);
  assert.match(world,/\[side\*2\.96,\.02,-\.3\]/);
  assert.match(world,/for\(let k=0;k<6;k\+\+\)\{\s*const a=ring\[k\]/);
});
