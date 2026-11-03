/* Embedded PCM recordings; no fetch, XHR, MP3 decoder, or server is required. */
(() => {
  'use strict';
  class BeachSound {
    constructor({button,notify,preferNative=false}) {
      this.button=button;this.notify=notify;this.mode=preferNative?'native':'web';
      this.enabled=false;this.ready=false;this.context=null;this.loading=null;
      this.sources=new Set();this.salvoTimers=new Set();this.oceanSource=null;this.buffers={};
      this.nativeOcean=null;this.nativePool=[];this.lastNativeBatch=null;
      this.needsGesture=false;this.sourceData=window.BEACH_AUDIO;
    }
    validateData() {
      if(!this.sourceData||!this.sourceData.ocean||!this.sourceData.burst||!this.sourceData.cluster)
        throw new Error('Embedded audio script missing');
    }
    timeout(promise,ms=3500) {
      let timer;
      return Promise.race([promise,new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(new Error('Audio activation timed out')),ms);
      })]).finally(()=>clearTimeout(timer));
    }
    initWeb() {
      this.validateData();
      if(!this.context) {
        const Context=window.AudioContext||window.webkitAudioContext;
        if(!Context)throw new Error('Web Audio unavailable');
        this.context=new Context();const ctx=this.context;
        this.master=ctx.createGain();this.master.gain.value=0;
        const limiter=ctx.createDynamicsCompressor();
        limiter.threshold.value=-6;limiter.knee.value=9;limiter.ratio.value=4;
        limiter.attack.value=.003;limiter.release.value=.18;
        this.master.connect(limiter);limiter.connect(ctx.destination);
        this.waveGain=ctx.createGain();this.waveGain.gain.value=.55;
        const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=8500;low.Q.value=.5;
        const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=65;high.Q.value=.5;
        this.waveGain.connect(high);high.connect(low);low.connect(this.master);
      }
    }
    prepareWeb() {
      if(!this.loading) {
        this.loading=Promise.all(['ocean','burst'].map(key=>this.decodeEmbedded(key))).then(([waves,burst])=>{
          this.buffers.waves=waves;this.buffers.firework=burst;this.ready=true;
        }).catch(error=>{this.loading=null;throw error;});
      }
      return this.loading;
    }
    decodeEmbedded(key) {
      const data=this.sourceData[key];
      const binary=atob(data.slice(data.indexOf(',')+1));
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      return new Promise((resolve,reject)=>{
        try{
          const result=this.context.decodeAudioData(bytes.buffer,resolve,reject);
          if(result&&typeof result.then==='function')result.then(resolve,reject);
        }catch(error){reject(error);}
      });
    }
    createMedia(src) {
      const media=new Audio(src);media.preload='auto';
      media.setAttribute('playsinline','');media.setAttribute('webkit-playsinline','');
      return media;
    }
    initNative() {
      this.validateData();this.mode='native';
      if(!this.nativeOcean) {
        this.nativeOcean=this.createMedia(this.sourceData.ocean);
        this.nativeOcean.loop=true;this.nativeOcean.volume=.38;
        // One pre-mixed five-bang clip per visual salvo avoids mobile limits on
        // simultaneous HTML media players. Two salvos can overlap naturally.
        this.nativePool=Array.from({length:4},()=>({
          media:this.createMedia(this.sourceData.cluster),priming:false,used:0
        }));
      }
      this.ready=true;
    }
    primeNative() {
      if(this.mode!=='native')return;
      for(const item of this.nativePool) {
        if(item.priming||!item.media.paused||item.unlocked)continue;
        item.priming=true;item.media.muted=true;
        const play=item.media.play();
        Promise.resolve(play).then(()=>{
          item.media.pause();item.media.currentTime=0;
          item.media.muted=false;item.priming=false;item.unlocked=true;
        }).catch(()=>{item.media.muted=false;item.priming=false;});
      }
    }
    async startNative() {
      this.initNative();this.primeNative();
      // Called synchronously from a click whenever the native path is selected.
      await this.timeout(Promise.resolve(this.nativeOcean.play()));
      this.needsGesture=false;
    }
    startOcean() {
      if(!this.enabled||!this.ready||document.hidden)return;
      if(this.mode==='native') {
        if(this.nativeOcean.paused)Promise.resolve(this.nativeOcean.play())
          .then(()=>{this.needsGesture=false;}).catch(()=>{this.needsGesture=true;});
        return;
      }
      if(this.context.state!=='running'||this.oceanSource)return;
      const source=this.context.createBufferSource();source.buffer=this.buffers.waves;source.loop=true;
      source.connect(this.waveGain);this.oceanSource=source;
      const record={source,nodes:[],kind:'ocean'};this.sources.add(record);
      source.onended=()=>{
        source.disconnect();this.sources.delete(record);
        if(this.oceanSource===source)this.oceanSource=null;
      };
      source.start();
    }
    countBursts(count) {
      this.button.dataset.burstCount=String(Number(this.button.dataset.burstCount||0)+count);
    }
    firework(pan=0,options={}) {
      if(!this.enabled||!this.ready||document.hidden)return;
      if(this.mode==='native') {
        const batch=options.batch;
        if(batch!==undefined&&batch===this.lastNativeBatch)return;
        this.lastNativeBatch=batch;
        const item=this.nativePool.find(p=>!p.priming&&p.media.paused)
          ||this.nativePool.filter(p=>!p.priming).sort((a,b)=>a.used-b.used)[0];
        if(!item)return;
        item.used=Date.now();item.media.pause();item.media.currentTime=0;
        item.media.volume=.40;item.media.muted=false;
        Promise.resolve(item.media.play()).then(()=>{
          item.unlocked=true;this.countBursts(5);
          this.button.dataset.maxConcurrentBursts=String(Math.max(
            Number(this.button.dataset.maxConcurrentBursts||0),5));
        }).catch(()=>{item.unlocked=false;this.needsGesture=true;});
        return;
      }
      if(this.context.state!=='running'){this.needsGesture=true;return;}
      const ctx=this.context,source=ctx.createBufferSource(),gain=ctx.createGain();
      source.buffer=this.buffers.firework;
      const pitches=this.sourceData.pitches||[1];
      source.playbackRate.value=pitches[(options.voice||0)%pitches.length];
      gain.gain.value=.28;source.connect(gain);const nodes=[gain];
      if(typeof ctx.createStereoPanner==='function') {
        const spatial=ctx.createStereoPanner();spatial.pan.value=Math.max(-.65,Math.min(.65,pan*.65));
        gain.connect(spatial);spatial.connect(this.master);nodes.push(spatial);
      }else gain.connect(this.master);
      const record={source,nodes,kind:'firework'};this.sources.add(record);
      source.onended=()=>{source.disconnect();nodes.forEach(node=>node.disconnect());this.sources.delete(record);};
      this.countBursts(1);
      const simultaneous=[...this.sources].filter(record=>record.kind==='firework').length;
      this.button.dataset.maxConcurrentBursts=String(Math.max(
        Number(this.button.dataset.maxConcurrentBursts||0),simultaneous));
      source.start();
    }
    salvo(batch) {
      if(this.mode==='native'){this.firework(0,{batch});return;}
      const offsets=this.sourceData.offsets||[0,75,150,225,300];
      offsets.forEach((delay,voice)=>{
        const timer=setTimeout(()=>{
          this.salvoTimers.delete(timer);
          if(this.enabled)this.firework((voice-2)/3,{batch,voice});
        },delay);
        this.salvoTimers.add(timer);
      });
    }
    stopSources(records=[...this.sources]) {
      for(const record of records){try{record.source.stop();}catch(_){}}
      if(records.some(record=>record.source===this.oceanSource))this.oceanSource=null;
    }
    stopFireworks() {
      for(const timer of this.salvoTimers)clearTimeout(timer);
      this.salvoTimers.clear();
      this.stopSources([...this.sources].filter(record=>record.kind==='firework'));
      for(const item of this.nativePool){item.media.pause();try{item.media.currentTime=0;}catch(_){}}
      this.lastNativeBatch=null;
    }
    updateButton() {
      this.button.setAttribute('aria-pressed',String(this.enabled));
      const label=this.enabled?'关闭海浪、生日歌与烟花声音':'开启海浪、生日歌与烟花声音';
      this.button.setAttribute('aria-label',label);this.button.title=label;
      this.button.dataset.audioMode=this.mode;
      this.button.dataset.audioReady=String(this.ready);
    }
    async toggle() {
      if(this.button.disabled)return;this.button.disabled=true;
      try{
        if(this.enabled&&!this.needsGesture) {
          this.enabled=false;this.stopFireworks();
          if(this.context&&this.master) {
            this.master.gain.setTargetAtTime(0,this.context.currentTime,.04);
            const oldSources=[...this.sources];this.oceanSource=null;
            setTimeout(()=>this.stopSources(oldSources),180);
          }
          if(this.nativeOcean)this.nativeOcean.pause();
          this.notify('声音已关闭');
        }else {
          this.validateData();
          if(this.mode==='web') {
            try{
              this.initWeb();
              // Both start from the click. No awaited network request can consume
              // the user activation needed by iOS/WeChat.
              await this.timeout(Promise.all([this.context.resume(),this.prepareWeb()]));
              if(this.context.state!=='running')throw new Error('Audio context suspended');
            }catch(error){
              this.button.dataset.webAudioFallback=error.name||'Error';
              this.stopSources();if(this.context)this.context.suspend().catch(()=>{});
              await this.startNative();
            }
          }else await this.startNative();
          this.enabled=true;this.needsGesture=false;
          if(this.mode==='web')this.master.gain.setTargetAtTime(.68,this.context.currentTime,.18);
          this.startOcean();delete this.button.dataset.audioError;
          this.notify('海浪与轻柔生日旋律已开启，烟花会成组响起');
        }
      }catch(error) {
        this.enabled=false;this.stopSources();if(this.nativeOcean)this.nativeOcean.pause();
        this.button.dataset.audioError=(error.name||'Error')+': '+error.message;
        this.notify(!this.sourceData?'声音资源未加载完整，请解压并保留全部文件后重试'
          :'请再轻点一次声音按钮，允许浏览器播放声音');
      }finally{this.updateButton();this.button.disabled=false;}
    }
    unlock() {
      if(!this.enabled)return;
      if(this.mode==='native'){this.primeNative();this.startOcean();return;}
      if(this.context&&this.context.state!=='running')
        this.context.resume().then(()=>{this.needsGesture=false;this.startOcean();})
          .catch(()=>{this.needsGesture=true;});
    }
    pause() {
      this.stopSources();if(this.nativeOcean)this.nativeOcean.pause();this.stopFireworks();
      if(this.context)this.context.suspend().catch(()=>{});
    }
    resume() {
      if(!this.enabled)return;
      if(this.mode==='native'){this.startOcean();return;}
      this.context.resume().then(()=>this.startOcean()).catch(()=>{this.needsGesture=true;});
    }
  }
  window.BeachSound=BeachSound;
})();

