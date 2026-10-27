import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {IslandDetailStream,ISLAND_DETAIL_PHASES,rankIslandDetail,islandShoreDistance} from '../src/world/IslandDetailStream.js';
import {ISLANDS} from '../src/world/config.js';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const islands=[{name:'A',x:0,z:0,r:40},{name:'B',x:410,z:0,r:40},{name:'C',x:950,z:0,r:40}];
function fixture(maxResident=2){
 const created=[],disposed=[];
 const makers=Object.fromEntries(ISLAND_DETAIL_PHASES.map(phase=>[phase,island=>created.push(island.name+'/'+phase)]));
 makers.dispose=(island,phase)=>disposed.push(island.name+'/'+phase);
 return {stream:new IslandDetailStream(islands,makers,{maxResident}),created,disposed};
}
test('LOD ranks chunks by distance to shoreline and keeps far terrain as low silhouette',()=>{
 assert.equal(islandShoreDistance({x:0,z:0},islands[0]),0);
 assert.equal(islandShoreDistance({x:0,z:0},islands[1]),370);
 assert.deepEqual(rankIslandDetail({x:0,z:0,y:5},'economy',islands).map(x=>x.island.name),['A']);
 assert.deepEqual(rankIslandDetail({x:0,z:0,y:5},'quality',islands).map(x=>x.island.name),['A','B']);
});
test('only one scene batch is constructed per frame and never in menu before planning',()=>{
 const {stream,created}=fixture();
 assert.equal(stream.step(),0);assert.equal(created.length,0);
 assert.deepEqual(stream.plan({x:0,z:0,y:0},'balanced'),{wanted:1,pending:4});
 assert.equal(stream.step(),1);assert.deepEqual(created,['A/coast']);
 assert.equal(stream.pending,3);stream.step();stream.step();stream.step();
 assert.deepEqual(created,['A/coast','A/foliage','A/grass','A/flowers']);
 assert.equal(stream.pending,0);assert.equal(stream.residentCount,1);
});
test('economy does not build invisible flowers until graphics quality goes back up',()=>{
 const {stream,created}=fixture();
 stream.plan({x:0,z:0,y:0},'economy');
 for(let i=0;i<4;i++)stream.step();
 assert.deepEqual(created,['A/coast','A/foliage','A/grass']);
 stream.plan({x:0,z:0,y:0},'quality');stream.step();
 assert.equal(created.at(-1),'A/flowers');
});
test('moving quickly cancels old queued decorations and reprioritizes new island',()=>{
 const {stream,created}=fixture();
 stream.plan({x:0,z:0,y:0},'balanced');stream.step();
 stream.plan({x:410,z:0,y:0},'balanced');
 assert.equal(stream.step(),1);assert.equal(created.at(-1),'B/coast');
 assert.equal(created.includes('A/foliage'),false);
});
test('hysteresis keeps near resources at edge and the scheduler reuses cached meshes',()=>{
 const {stream,created}=fixture();
 stream.plan({x:0,z:0,y:5},'balanced');
 for(let i=0;i<4;i++)stream.step();
 stream.plan({x:40+250+10,z:0,y:5},'balanced');
 assert.equal(stream.wanted.has('A'),true);
 stream.plan({x:0,z:0,y:5},'balanced');
 assert.equal(stream.pending,0);
 assert.equal(created.length,4);
 assert.ok(stream.stats.reused>=1);
});
test('LRU evicts only out of view; all desired high-quality islands remain complete',()=>{
 const {stream,created,disposed}=fixture(1);
 stream.plan({x:0,z:0,y:5},'balanced');for(let i=0;i<4;i++)stream.step();
 stream.plan({x:410,z:0,y:5},'balanced');for(let i=0;i<4;i++)stream.step();
 assert.equal(stream.residentCount,1);
 assert.equal(stream.resident.has('B'),true);
 assert.deepEqual(disposed,['A/coast','A/foliage','A/grass','A/flowers']);
 assert.equal(created.length,8);
 stream.plan({x:200,z:0,y:5},'quality');for(let i=0;i<5;i++)stream.step();
 assert.equal(stream.resident.has('A'),true);
 assert.equal(stream.resident.has('B'),true);
});
test('terrain/collisions remain built at startup, expensive decoration batches are deferred',()=>{
 const world=source('../src/world/World.js');
 assert.match(world,/for \(const island of ISLANDS\) this\.buildIsland\(island\)/);
 assert.match(world,/this\.addObstacle\(x,y,z,[^\n]*'tree'\)/);
 assert.match(world,/this\.detailStream\.step\(1\)/);
 assert.match(world,/this\.detailStream\.plan\(observer,this\.detailTier\)/);
 assert.match(world,/this\.scene\.remove\(mesh\)/);
 assert.match(world,/this\.flushFoliage\(island\)/);
 assert.match(world,/this\._buildGrassForIsland\(island\)/);
 assert.match(world,/this\._buildWildflowersForIsland\(island\)/);
 assert.match(world,/this\._buildCoastForIsland\(island\)/);
});
test('game Play button prepares nearby details before shader warmup while menu remains frozen',()=>{
 const game=source('../src/game/Game.js');
 const start=game.slice(game.indexOf('  start(){'),game.indexOf('  newGame(){'));
 assert.ok(start.indexOf('await this.world.prepareStartingIsland')<start.indexOf('await prep.run(this)'));
 assert.ok(start.indexOf('await prep.run(this)')<start.indexOf('this.started=true'));
 assert.match(game,/LOD CENÁRIO/);
 assert.match(game,/this\.world\.updateDetail\(this\.camera\.position,dt\)/);
});
