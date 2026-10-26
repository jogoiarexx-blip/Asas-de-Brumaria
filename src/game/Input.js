import {GamepadController} from './GamepadController.js';

const relevantKeys = new Set(['w','a','s','d','e','f','r','m','p','t','c','n','g','v','q','escape','f3','b',' ','shift','control','arrowup','arrowdown','arrowleft','arrowright']);
export const normalized = key => key === ' ' ? 'space' : key.toLowerCase() === 'control' ? 'ctrl' : key.toLowerCase();
export class Input {
  constructor() {
    this.down=new Set();this.justPressed=new Set();this.enabled=false;
    this.gamepad=new GamepadController();this.pad={connected:false,held:new Set(),justPressed:new Set(),left:{x:0,y:0},right:{x:0,y:0},throttle:0,brake:0};
    window.addEventListener('keydown', event => {
      if (relevantKeys.has(event.key.toLowerCase()) || event.key === ' ') event.preventDefault();
      const key=normalized(event.key);
      if (!this.down.has(key)&&!event.repeat)this.justPressed.add(key);
      this.down.add(key);
    });
    window.addEventListener('keyup',event=>this.down.delete(normalized(event.key)));
    window.addEventListener('blur',()=>{this.down.clear();this.justPressed.clear();});
    document.addEventListener?.('visibilitychange',()=>{if(document.hidden){this.down.clear();this.justPressed.clear();}});
    document.querySelectorAll('[data-hold]').forEach(button=>{
      const key=button.dataset.hold;
      const release=event=>{event.preventDefault();this.down.delete(key);button.classList.remove('active');};
      button.addEventListener('pointerdown',event=>{
        event.preventDefault();button.setPointerCapture(event.pointerId);
        this.down.add(key);button.classList.add('active');
      });
      button.addEventListener('pointerup',release);
      button.addEventListener('pointercancel',release);
      button.addEventListener('lostpointercapture',release);
    });
    document.querySelectorAll('[data-tap]').forEach(button=>{
      button.addEventListener('pointerdown',event=>{
        event.preventDefault();this.justPressed.add(button.dataset.tap);
        button.classList.add('active');
      });
      for(const name of ['pointerup','pointercancel','pointerleave'])button.addEventListener(name,()=>button.classList.remove('active'));
    });
  }
  update(){
    let devices=[];
    try{devices=globalThis.navigator?.getGamepads?.()??[];}catch{devices=[];}
    this.pad=this.gamepad.poll(devices);
  }
  isDown(...keys){return keys.some(key=>this.down.has(key)||this.pad.held.has(key));}
  consume(key){const hit=this.justPressed.has(key)||this.pad.justPressed.has(key);
    this.justPressed.delete(key);this.pad.justPressed.delete(key);return hit;}
  /** Signed axis, negative maps to first action (left/up), positive to second. */
  axis(negative,positive){
    const aliases={a:'arrowleft',d:'arrowright',w:'arrowup',s:'arrowdown'};
    const digital=(this.down.has(positive)||this.down.has(aliases[positive])?1:0)-(this.down.has(negative)||this.down.has(aliases[negative])?1:0);
    const stick=(negative==='a'&&positive==='d')?this.pad.left.x:
      (negative==='w'&&positive==='s')?this.pad.left.y:0;
    const triggers=(negative==='w'&&positive==='s')?this.pad.brake-this.pad.throttle:0;
    const dp=(negative==='a'&&positive==='d')?this.pad.dpad?.x??0:
      (negative==='w'&&positive==='s')?this.pad.dpad?.y??0:0;
    const analog=(Math.abs(stick)>Math.abs(triggers)?stick:triggers);
    return Math.max(-1,Math.min(1, Math.abs(digital)>0?digital:Math.abs(dp)>0?dp:analog));
  }
  get lookAxis(){return this.pad.right;}
  clearActions(){this.justPressed.clear();this.pad.justPressed.clear();}
}
