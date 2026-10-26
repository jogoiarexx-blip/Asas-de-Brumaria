/** Continuous height/slope terrain colors, without image textures or extra draw calls. */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(x)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const sand=[.73,.68,.48],grass=[.17,.40,.29],meadow=[.31,.53,.33],stone=[.40,.46,.44],peak=[.56,.58,.54];
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
export function terrainPalette(height,slope=0,detail=0,biome='temperate'){
  const h=Number.isFinite(height)?height:0;
  const s=clamp(Number.isFinite(slope)?slope:0,0,1);
  let color=mix(sand,grass,smooth((h-1.1)/4.7));
  color=mix(color,meadow,smooth((h-8)/14)*.55);
  color=mix(color,stone,smooth((h-14)/12)*(.32+s*.60));
  color=mix(color,peak,smooth((h-23)/12)*.35);
  // New islands reuse the same vertex-color material, normals and shader.
  // Distinct biomes do NOT create additional textures or draw calls.
  if(biome==='crystal')color=mix(color,[.35,.71,.72],.44);
  else if(biome==='ash')color=mix(color,[.35,.32,.34],.55);
  const grain=clamp(Number.isFinite(detail)?detail:0,-1,1)*.075;
  return color.map(c=>clamp(c+grain,0,1));
}
