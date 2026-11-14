import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Progression,BOND_LEVELS,BOND_PERKS,BOND_XP_PER_POINT,bondLevel,bondProgress} from '../src/systems/Progression.js';
const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('v1.7.0: níveis de Elo seguem os limiares e o progresso fica entre 0 e 1',()=>{
  assert.deepEqual([...BOND_LEVELS],[0,30,80,160,280]);
  assert.equal(BOND_PERKS.length,5);
  assert.deepEqual([0,29,30,79,80,159,160,279,280,99999].map(bondLevel),[1,1,2,2,3,3,4,4,5,5]);
  assert.equal(bondLevel(NaN),1);
  assert.deepEqual(bondProgress(55),{level:2,xp:55,floor:30,next:80,fraction:.5});
  assert.equal(bondProgress(5000).fraction,1);assert.equal(bondProgress(5000).next,null);
});

test('v1.7.0: no nível 1 os atributos são idênticos aos de antes do Elo',()=>{
  const p=new Progression();
  assert.equal(p.bondLevel,1);
  const s=p.stats;
  assert.equal(s.maxEnergy,106);
  assert.ok(Math.abs(s.regen-12*1.06)<1e-9);
  assert.ok(Math.abs(s.drain-17/1.06)<1e-9);
  assert.ok(Math.abs(s.flightSpeed-31*1.08)<1e-9);
  assert.ok(Math.abs(s.fireDamage-1.10)<1e-9);
});

test('v1.7.0: cada nível libera o bônus prometido e nada antes da hora',()=>{
  const base=new Progression().stats;
  const at=xp=>{const p=new Progression();p.bond=xp;return p.stats;};
  assert.ok(Math.abs(at(30).regen/base.regen-1.12)<1e-9);
  assert.equal(at(30).drain,base.drain);
  assert.equal(at(80).flightSpeed,base.flightSpeed);
  assert.ok(Math.abs(at(160).drain/base.drain-.88)<1e-9);
  assert.ok(Math.abs(at(160).boostSpeed/base.boostSpeed-1.04)<1e-9);
  assert.equal(at(160).fireDamage,base.fireDamage);
  assert.ok(Math.abs(at(280).fireDamage/base.fireDamage-1.2)<1e-9);
  assert.equal(at(280).maxEnergy,base.maxEnergy+15);
});

test('v1.7.0: pontos de treino rendem Elo, o save guarda e restaura, e saves antigos migram',()=>{
  const p=new Progression();
  p.grant(2);
  assert.equal(p.bond,2*BOND_XP_PER_POINT);
  const up=p.addBond(25);
  assert.deepEqual(up,{before:1,level:2,leveledUp:true});
  assert.equal(new Progression(p.snapshot()).bond,35);
  // Save anterior à v1.7.0: sem campo bond, 9 pontos já conquistados.
  const legacy=new Progression({points:3,earned:9,species:'furia_noite',unlocked:['furia_noite'],skills:{},circuits:0});
  assert.equal(legacy.bond,45);assert.equal(legacy.bondLevel,2);
  // Valores inválidos nunca quebram o save.
  assert.equal(new Progression({points:0,earned:0,bond:-50}).bond,0);
  const q=new Progression();q.addBond(-10);q.addBond(NaN);assert.equal(q.bond,0);
});

test('v1.7.0: assobio exige nível 3, a pé, com ponto livre; modo foto só existe na pausa',()=>{
  const game=src('../src/game/Game.js'),html=src('../index.html'),ui=src('../src/ui/UI.js');
  assert.match(game,/if\(this\.progression\.bondLevel<3\|\|this\.dragon\.riding\|\|this\.inMountain\)return false;/);
  assert.match(game,/if\(!this\.world\.walkable\(x,z\)\)continue;/);
  assert.match(game,/overlapsCircle\(x,z,3\.2,obstacle\)/);
  assert.match(game,/this\.whistleReadyAt=this\.elapsed\+20/);
  assert.match(game,/this\.photoMode=!!on&&this\.paused/);
  assert.match(game,/this\.updateBond\(dt\)/);
  for(const id of ['bond-status','bond-bar','bond-list','bond-summary','pause-photo','photo-exit'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(ui,/if\(bondXp!==this\.bondShown\)/);
});
