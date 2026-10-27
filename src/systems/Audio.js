/** Procedural environmental audio and layered SFX. All sources are local,
 *  generated after an explicit Play click; no audio files or external CDNs. */
export class AudioSystem {
  constructor(){
    this.ctx=null;this.muted=false;this.master=null;this.noiseBuffer=null;
    this.ambience=null;this.activeVoices=0;this.maxVoices=20;
  }
  unlock(){
    if(this.muted)return;
    try{
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)return;
      if(!this.ctx){
        this.ctx=new Context();
        const master=this.ctx.createGain();master.gain.value=.72;
        const limiter=this.ctx.createDynamicsCompressor();
        limiter.threshold.value=-13;limiter.knee.value=12;
        limiter.ratio.value=5;limiter.attack.value=.004;limiter.release.value=.19;
        master.connect(limiter).connect(this.ctx.destination);
        this.master=master;this.noiseBuffer=this.createNoiseBuffer();
        this.startAmbience();
      }
      if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
    }catch(error){console.warn('Áudio do navegador indisponível:',error);this.ctx=null;}
  }
  createNoiseBuffer(){
    const ctx=this.ctx,frames=Math.round(ctx.sampleRate*2),buffer=ctx.createBuffer(1,frames,ctx.sampleRate);
    const channel=buffer.getChannelData(0);let state=0x5eeda38;
    for(let i=0;i<channel.length;i++){
      state=(Math.imul(state,1664525)+1013904223)>>>0;
      channel[i]=(state/2147483648-1)*.65;
    }
    return buffer;
  }
  startAmbience(){
    if(this.ambience)return;
    const ctx=this.ctx;
    const layer=(type,freq)=>{
      const source=ctx.createBufferSource();source.buffer=this.noiseBuffer;source.loop=true;
      const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.value=freq;
      const gain=ctx.createGain();gain.gain.value=0;
      source.connect(filter).connect(gain).connect(this.master);source.start();
      return {source,filter,gain};
    };
    this.ambience={wind:layer('bandpass',350),sea:layer('lowpass',290)};
  }
  updateAmbience({speed=0,airborne=false,coastDistance=100,wind=0,rain=0,time=0}={}){
    if(!this.ctx||!this.ambience)return;
    const now=this.ctx.currentTime,mute=this.muted?0:1;
    // Crossfade rather than starting/stopping sources on each takeoff or landing.
    const windMix=mute*Math.min(.19,.025+Math.max(0,speed)*.0024+
      (airborne?.055:0)+Math.abs(wind)*.012);
    const waterMix=mute*Math.min(.10,.018+Math.max(0,70-coastDistance)/70*.052+
      rain*.035);
    this.ambience.wind.gain.gain.setTargetAtTime(windMix*(.92+.08*Math.sin(time*.45)),now,.34);
    this.ambience.sea.gain.gain.setTargetAtTime(waterMix*(.83+.17*Math.sin(time*.32)),now,.65);
    this.ambience.wind.filter.frequency.setTargetAtTime(Math.min(1500,320+speed*15),now,.7);
  }
  tone(frequency,duration=.18,waveform='sine',volume=.06,glide=0,delay=0){
    if(!this.ctx||this.muted||this.ctx.state!=='running'||this.activeVoices>=this.maxVoices)return;
    const ctx=this.ctx,t=ctx.currentTime+delay,life=Math.max(.05,duration);
    const osc=ctx.createOscillator(),gain=ctx.createGain();this.activeVoices++;
    osc.type=waveform;osc.frequency.setValueAtTime(Math.max(50,frequency),t);
    if(glide)osc.frequency.exponentialRampToValueAtTime(Math.max(50,frequency+glide),t+life);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.016);
    gain.gain.exponentialRampToValueAtTime(.0001,t+life);
    osc.connect(gain).connect(this.master);
    osc.onended=()=>{osc.disconnect();gain.disconnect();this.activeVoices=Math.max(0,this.activeVoices-1);};
    osc.start(t);osc.stop(t+life+.015);
  }
  noise(duration=.25,{frequency=800,volume=.08,delay=0,type='bandpass'}={}){
    if(!this.ctx||this.muted||this.ctx.state!=='running'||this.activeVoices>=this.maxVoices)return;
    const ctx=this.ctx,t=ctx.currentTime+delay,source=ctx.createBufferSource();
    const filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this.noiseBuffer;source.loop=true;filter.type=type;filter.frequency.value=frequency;
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    source.connect(filter).connect(gain).connect(this.master);this.activeVoices++;
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.activeVoices=Math.max(0,this.activeVoices-1);};
    source.start(t);source.stop(t+duration+.01);
  }
  play(name,variant=null){
    if(name==='mount'){
      this.tone(200,.21,'triangle',.055,210);this.noise(.13,{frequency:320,volume:.035});
      this.tone(480,.39,'sine',.045,180,.1);
    }else if(name==='pickup'){
      this.tone(540,.16,'sine',.055,200);this.tone(820,.28,'triangle',.04,180,.12);
    }else if(name==='fire'){
      this.noise(.26,{frequency:950,volume:.15});this.tone(195,.28,'sawtooth',.045,-135);
      this.tone(480,.12,'triangle',.027,-240);
    }else if(name==='enemyFire'){
      this.noise(.21,{frequency:500,volume:.08});this.tone(260,.25,'sawtooth',.031,-175);
    }else if(name==='hit'){
      this.noise(.14,{frequency:700,volume:.09});this.tone(180,.22,'triangle',.065,-120);
    }else if(name==='hurt'){
      this.noise(.24,{frequency:230,volume:.11,type:'lowpass'});
      this.tone(120,.39,'square',.032,-60);this.tone(75,.28,'sine',.067,-20);
    }else if(name==='pulse'){
      const pitch=variant==='raio'?1.3:variant==='brasa'?.78:variant==='nimbo'?.90:1;
      this.noise(.65,{frequency:630*pitch,volume:.18});
      this.tone(120*pitch,.57,'sawtooth',.09,310*pitch);
      this.tone(620*pitch,.46,'sine',.065,-350*pitch,.08);
    }else if(name==='wingbeat'){
      this.noise(.29,{frequency:205,volume:.045,type:'lowpass'});
      this.tone(72,.24,'sine',.022,-15);
    }else if(name==='land'){
      this.noise(.22,{frequency:185,volume:.065,type:'lowpass'});
      this.tone(94,.24,'triangle',.04,-27);
    }else if(name==='complete'){
      [440,554,659,880].forEach((hz,i)=>this.tone(hz,.43,'sine',.048,0,i*.14));
    }else if(name==='rescue'){
      [700,880,1050].forEach((hz,i)=>this.tone(hz,.34,'sine',.043,0,i*.11));
    }else if(name==='error')this.tone(160,.13,'square',.02,-70);
  }
  dispose(){
    if(this.ambience)for(const layer of Object.values(this.ambience)){
      try{layer.source.stop();layer.source.disconnect();layer.filter.disconnect();layer.gain.disconnect();}catch{}
    }
    this.ambience=null;
    this.ctx?.close?.().catch?.(()=>{});this.ctx=null;
  }
}
