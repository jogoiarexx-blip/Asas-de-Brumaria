import test from 'node:test';
import assert from 'node:assert/strict';
import {WEATHER_MODES,weatherMode,normalizeWeather,advanceWeather,nextWeather} from '../src/systems/weatherMath.js';
import {Discovery,LANDMARKS} from '../src/systems/Discovery.js';
import {normalizeSave,SaveSystem} from '../src/systems/SaveSystem.js';
import {readFileSync} from 'node:fs';
const minimal={version:1,mission:{stage:0,progress:0},progression:{points:2},player:{x:8,z:7}};

test('clima possui quatro estados distintos com parâmetros de luz e precipitação',()=>{
  assert.deepEqual(WEATHER_MODES.map(x=>x.id),['clear','breeze','rain','storm']);
  assert.equal(WEATHER_MODES.filter(x=>x.rain>0).length,2);
  assert.ok(WEATHER_MODES.every(x=>x.duration>0 && x.sun>0));
});
test('ciclo manual retorna ao céu aberto após a tempestade',()=>{
  let mode='clear';for(let i=0;i<4;i++)mode=nextWeather(mode);
  assert.equal(mode,'clear');assert.equal(weatherMode('invalid').id,'clear');
});
test('tempo atravessa mudanças de clima sem perder excedente',()=>{
  const a=advanceWeather({mode:'clear',elapsed:89},3);
  assert.deepEqual(a,{mode:'breeze',elapsed:2});
  const b=advanceWeather({mode:'rain',elapsed:94},4);
  assert.deepEqual(b,{mode:'storm',elapsed:3});
});
test('save climático inválido é sanitizado e estado válido preservado',()=>{
  assert.deepEqual(normalizeWeather({mode:'unknown',elapsed:Infinity}),{mode:'clear',elapsed:0});
  assert.deepEqual(normalizeWeather({mode:'storm',elapsed:23}),{mode:'storm',elapsed:23});
});
test('sete marcos de exploração têm coordenadas, ids e nomes únicos',()=>{
  assert.equal(LANDMARKS.length,7);
  assert.equal(new Set(LANDMARKS.map(x=>x.id)).size,7);
  assert.ok(LANDMARKS.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.z)&&x.name.length>3));
});
test('descobertas concedem uma única conclusão e rejeitam índices inválidos',()=>{
  const discovery=new Discovery();
  assert.equal(discovery.total,0);
  assert.equal(discovery.discover(2)?.id,'farol');
  assert.equal(discovery.discover(2),null);
  assert.equal(discovery.discover(9),null);
  assert.equal(discovery.total,1);
});
test('marcos persistem no save e dados adulterados não desbloqueiam itens desconhecidos',()=>{
  const d=new Discovery({found:['farol','farol','nonexistent','nevoa']});
  assert.equal(d.total,2);
  const normalized=normalizeSave({...minimal,discoveries:d.snapshot(),weather:{mode:'rain',elapsed:17}});
  assert.deepEqual(normalized.discoveries.found,['farol','nevoa']);
  assert.deepEqual(normalized.weather,{mode:'rain',elapsed:17});
  assert.equal(new Discovery(normalized.discoveries).total,2);
});
test('partida da versão anterior inicia com clima padrão e nenhuma descoberta',()=>{
  const old=normalizeSave(minimal);
  assert.deepEqual(old.weather,{mode:'clear',elapsed:0});
  assert.deepEqual(old.discoveries,{found:[]});
});
test('gravação e leitura restituem pontos, marcos e clima na mesma chave de save',()=>{
  const db=new Map();const storage={getItem:k=>db.get(k)??null,setItem:(k,v)=>db.set(k,v),removeItem:k=>db.delete(k)};
  const saver=new SaveSystem(storage);
  assert.equal(saver.write({...minimal,progression:{points:7},weather:{mode:'breeze',elapsed:12},discoveries:{found:['atol']}}),true);
  assert.equal(saver.read().progression.points,7);
  assert.deepEqual(saver.read().discoveries.found,['atol']);
  assert.equal(saver.read().weather.mode,'breeze');
});
test('integração liga clima, marcos, ataque e dano aos eventos do jogo',()=>{
  const game=readFileSync(new URL('../src/game/Game.js',import.meta.url),'utf8');
  const dragon=readFileSync(new URL('../src/entities/Dragon.js',import.meta.url),'utf8');
  const weather=readFileSync(new URL('../src/systems/Weather.js',import.meta.url),'utf8');
  assert.match(game,/this\.weather\.update\(/);
  assert.match(game,/this\.updateDiscoveries\(/);
  assert.match(game,/this\.dragon\.triggerAttack\(/);
  assert.match(game,/this\.dragon\.triggerHurt\(/);
  assert.match(dragon,/this\.speciesOrnaments\[id\]/);
  assert.match(weather,/this\.rain\.visible=wet/);
});
