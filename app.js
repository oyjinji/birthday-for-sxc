/* Buildless birthday scene. Character cutouts and CC0 field recordings are local. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const app = $('experience');
  const svg = $('scene');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  let H = 1920, scene = 'intro', busy = false, time = 0;
  let cam = 0, picnicOpacity = 0, motionEnabled = false;
  let targetX = 0, targetY = 0, tiltX = 0, tiltY = 0;
  let betaOrigin = null, pointerId = null, holding = false, holdStarted = 0;
  let frame = 0, lastFrame = 0, toastTimer;
  let fireworkClock = 0, nextSalvoAt = 0, salvoId = 0, bursts = [], isCelebrating = false, danceTime = 0;
  let tween = null, tweenResolve = null;
  const starSpecs = [], ripples = [], dancers = [];

  function el(tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
    if (parent) parent.appendChild(node);
    return node;
  }
  function use(id, attrs, parent) {
    const node = el('use', attrs, parent);
    node.setAttribute('href', '#' + id);
    // Older iOS/WeChat SVG engines still use xlink:href.
    node.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + id);
    return node;
  }
  let seed = 17;
  function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  const status = message => { $('liveStatus').textContent = message; };
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
  }

  function buildArtwork() {
    const stars = $('stars');
    for (let i = 0; i < 42; i++) {
      const large = i < 7;
      const x = 55 + random() * 970;
      const y = .045 + random() * .46;
      const node = large ? el('g', {}, stars)
        : el('circle', {r: 2.7 + random() * 2, fill: '#fff4d9', class: 'star-dot'}, stars);
      const animated = large ? use('starShape', {class:'twinkle'}, node) : node;
      animated.style.setProperty('--duration', (4.5 + random() * 5) + 's');
      animated.style.setProperty('--delay', (-random() * 9) + 's');
      starSpecs.push({node, x, y, large, scale: .65 + random() * .35});
    }
    [[55,1.03],[498,.57],[1010,1.05]].forEach(([x,s]) => use('cloud', {'data-x':x,'data-scale':s}, $('clouds')));
    for (let i = 0; i < 7; i++) {
      const x = [130,600,845,325,90,720,520][i];
      const width = [170,145,115,180,120,170,100][i];
      const node = el('path', {d:`M${x} 0q${width*.25} -14 ${width*.5} 0t${width*.5} 0`, 'stroke-width':i > 3 ? 5 : 6}, $('ripples'));
      ripples.push({node,x,base:.615 + (i % 4) * .035,phase:i * 1.07});
    }
    use('shell', {transform:'translate(920 1760) scale(.8)',id:'shellAtShore'}, $('beachDetails'));
    [[145, .83],[830, .96],[155, .965]].forEach(([x,y],i) => {
      const g = el('g', {'data-x':x,'data-y':y,'data-sand-detail':'true', opacity:.55}, $('beachDetails'));
      el('path', {d:'M-10 0h4m12 0h3m8-9h3',stroke:'#c7b5ba','stroke-width':3,'stroke-linecap':'round'}, g);
    });
    for (let i = -220; i <= 220; i += 25) el('path', {d:`M${i} 74l-3 11`}, $('fringe'));
    for (let i = 0; i < 5; i++) {
      const y = -52 + i * 25, x = 190 + i * 10;
      el('path', {d:`M${-x} ${y}h-13M${x} ${y}h13`}, $('fringe'));
    }
    for (let i = 0; i < 5; i++) {
      const node = use('starShape', {opacity:.7}, $('wishMotes'));
      node.dataset.phase = i * 1.6;
    }
    ['chiikawa','hachiware'].forEach((id,i) => {
      const g = el('g', {id: id + 'Dancer'}, $('charactersFront'));
      const body = el('g', {}, g);
      use(id, {}, body);
      dancers.push({g,body,phase:i * Math.PI,front:true});
    });
  }

  function layout() {
    const rect = app.getBoundingClientRect();
    H = 1080 * rect.height / Math.max(rect.width, 1);
    svg.setAttribute('viewBox', `0 0 1080 ${H}`);
    document.documentElement.style.setProperty('--vh', window.innerHeight * .01 + 'px');
    const horizon = H * .58;
    [['skyFill',0,horizon],['seaFill',horizon,H*.80],['sandFill',H*.70,H]].forEach(([id,y1,y2])=>{
      const gradient=$(id);gradient.setAttribute('gradientUnits','userSpaceOnUse');
      gradient.setAttribute('x1',0);gradient.setAttribute('x2',0);
      gradient.setAttribute('y1',y1);gradient.setAttribute('y2',y2);
    });
    $('moon').setAttribute('transform', `translate(910 ${H*.105})`);
    for (const s of starSpecs) {
      if (s.large) s.node.setAttribute('transform', `translate(${s.x} ${s.y*H}) scale(${s.scale})`);
      else {s.node.setAttribute('cx',s.x);s.node.setAttribute('cy',s.y*H);}
    }
    for (const c of $('clouds').children) c.setAttribute('transform',`translate(${c.dataset.x} ${horizon-70*Number(c.dataset.scale)}) scale(${c.dataset.scale})`);
    $('sea').setAttribute('d',`M-1400 ${horizon}H2500V${H+2000}H-1400Z`);
    const shore = `M-1300 ${H*.66}C-400 ${H*.655},-120 ${H*.675},60 ${H*.70}S340 ${H*.743},550 ${H*.746}S850 ${H*.775},1150 ${H*.78}S1900 ${H*.79},2500 ${H*.80}`;
    $('sand').setAttribute('d',shore + `V${H+2600}H-1300Z`);
    for (const id of ['foam','shoreLine','wash']) $(id).setAttribute('d',shore);
    $('shoreLine').setAttribute('transform','translate(0 8)');
    $('shellAtShore').setAttribute('transform',`translate(940 ${H*.93}) scale(.75)`);
    for (const d of svg.querySelectorAll('[data-sand-detail]')) d.setAttribute('transform',`translate(${d.dataset.x} ${H*Number(d.dataset.y)})`);
    $('picnic').setAttribute('transform',`translate(540 ${H*.875})`);
    // Firework positions are relative to viewport; clear old positions after rotation.
    clearFireworks();
    if (reducedMotion && isCelebrating) staticFireworks();
    renderCamera();
    renderDancers();
  }

  function renderCamera() {
    const z = lerp(1, 1.85, cam);
    const targetY = lerp(H*.845,H*.635,cam);
    const tx = 540 - 540*z;
    const ty = targetY - H*.845*z;
    $('camera').setAttribute('transform',`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${z.toFixed(5)})`);
    $('skyLayer').setAttribute('transform',`translate(${(tiltX*9).toFixed(2)} ${(tiltY*7).toFixed(2)})`);
    $('farLayer').setAttribute('transform',`translate(${(tiltX*16).toFixed(2)} ${(tiltY*11).toFixed(2)})`);
    $('clouds').setAttribute('opacity',(1-cam*.9).toFixed(3));
    $('nearLayer').setAttribute('transform',`translate(${(tiltX*22).toFixed(2)} ${(tiltY*13).toFixed(2)})`);
    $('picnic').setAttribute('opacity',picnicOpacity.toFixed(3));
  }
  function animateCamera(to, duration, showPicnic = true) {
    return new Promise(resolve => {
      if (tweenResolve) tweenResolve();
      tweenResolve = resolve;
      tween = {from:cam,to,opacityFrom:picnicOpacity,opacityTo:showPicnic?1:0,elapsed:0,duration:reducedMotion?350:duration};
    });
  }
  function setScene(next) {
    scene = next;
    app.dataset.scene = next;
    for (const [name,selector] of [['intro','.intro-ui'],['wish','.wish-ui'],['celebration','.celebration-ui']]) {
      const section = app.querySelector(selector);
      const active = name === next;
      section.setAttribute('aria-hidden', String(!active));
      section.toggleAttribute('inert', !active);
    }
  }
  async function enterWish() {
    if (scene !== 'intro' || busy) return;
    busy = true;
    enableAutomaticMotion();
    setScene('transition');
    status('镜头来到沙滩上的生日蛋糕。');
    await animateCamera(1,2200);
    setScene('wish');
    busy = false;
    $('wishButton').focus({preventScroll:true});
    status('闭上眼睛，长按许愿按钮；愿望许好后松开。');
  }

  function startHold(event) {
    if (scene !== 'wish' || busy || holding) return;
    if (event && event.type === 'pointerdown' && (!event.isPrimary || event.button > 0)) return;
    if (event && event.cancelable) event.preventDefault();
    holding = true;
    holdStarted = performance.now();
    if (event && event.pointerId !== undefined) {
      pointerId = event.pointerId;
      try {$('wishButton').setPointerCapture(pointerId);} catch (_) { /* May be unavailable in old WebViews. */ }
    }
    app.classList.add('is-holding');
    $('wishLabel').textContent = '静静许愿';
    $('wishHelp').textContent = '慢慢许愿，想好了就松开';
    $('wishButton').setAttribute('aria-label','许愿中，松开后揭晓');
  }
  function releaseCapture() {
    if (pointerId !== null) {
      try { if ($('wishButton').hasPointerCapture(pointerId)) $('wishButton').releasePointerCapture(pointerId); } catch (_) {}
    }
    pointerId = null;
  }
  function resetHold() {
    holding = false;
    releaseCapture();
    app.classList.remove('is-holding');
    $('wishLabel').textContent = '长按许愿';
    $('wishHelp').textContent = '按住时闭眼，松开后揭晓';
    $('wishButton').setAttribute('aria-label','长按许愿，闭眼后松开揭晓');
  }
  function cancelHold() { if (holding) resetHold(); }
  function finishHold(event) {
    if (!holding || (event && event.pointerId !== undefined && pointerId !== null && event.pointerId !== pointerId)) return;
    const elapsed = performance.now() - holdStarted;
    resetHold();
    if (elapsed < 650) {
      $('wishHelp').textContent = '再多按住一小会儿，闭上眼睛许个愿';
      return;
    }
    audio.unlock();
    reveal();
  }
  async function reveal() {
    if (busy || scene !== 'wish') return;
    busy = true;
    app.classList.add('is-revealing');
    $('wishButton').disabled = true;
    $('flame').style.opacity = '0';
    $('candle').classList.add('smoking');
    $('candle').classList.add('candle-removed');
    status('愿望已收到。生日惊喜正在揭晓。');
    await new Promise(resolve => setTimeout(resolve,reducedMotion?100:500));
    setScene('transition');
    await animateCamera(0,2400);
    danceTime = 0;
    isCelebrating = true;
    renderDancers();
    fireworkClock = 0;nextSalvoAt = 0;
    $('charactersBack').classList.add('visible');
    $('charactersFront').classList.add('visible');
    setScene('celebration');
    app.classList.remove('is-revealing');
    if (reducedMotion) staticFireworks();
    if (reducedMotion && audio.enabled) audio.salvo(++salvoId);
    status('SXC大王23岁生日快乐！愿你的每一个愿望，都慢慢绽放。吉伊和小八正围着蛋糕跳舞，海上的烟花为你绽放。');
    $('replayButton').focus({preventScroll:true});
    busy = false;
  }
  async function replay() {
    if (busy || scene !== 'celebration') return;
    busy = true;
    isCelebrating = false;
    clearFireworks();
    $('charactersBack').classList.remove('visible');
    $('charactersFront').classList.remove('visible');
    setScene('transition');
    $('candle').classList.remove('smoking');
    $('candle').classList.remove('candle-removed');
    $('flame').style.opacity = '1';
    await animateCamera(1,2100);
    resetHold();
    $('wishButton').disabled = false;
    setScene('wish');
    busy = false;
    $('wishButton').focus({preventScroll:true});
    status('再许一个愿望吧。');
  }

  function renderDancers() {
    for (const d of dancers) {
      const phase = reducedMotion ? d.phase : danceTime*.00026 + d.phase;
      const depth = Math.sin(phase);
      const x = 540 + Math.cos(phase)*330;
      const y = H*.875 + depth*65;
      const scale = 1.23 + depth*.07;
      const bounce = reducedMotion ? 0 : Math.abs(Math.sin(time*.0048 + d.phase)) * 12;
      const rotation = reducedMotion ? (d.phase? -7:7) : Math.sin(time*.0048 + d.phase)*6;
      const front = depth >= -.15;
      if (front !== d.front) {
        (front?$('charactersFront'):$('charactersBack')).appendChild(d.g);
        d.front = front;
      }
      d.g.setAttribute('transform',`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})`);
      d.body.setAttribute('transform',`translate(0 ${-bounce.toFixed(1)}) rotate(${rotation.toFixed(1)} 0 -85)`);
    }
  }
  function clearFireworks() { bursts=[];$('fireworks').replaceChildren();audio.stopFireworks(); }
  const fireworkColors = ['#ffedb3','#f5c9d9','#ddd4f0','#fff6dc'];
  let burstIndex = 0;
  function createBurst(fixed = false, index = burstIndex++, options = {}) {
    const slots = [[.15,.15],[.83,.17],[.13,.43],[.87,.45],[.50,.10],[.12,.29],[.88,.30],[.48,.48]];
    const slot = slots[index%slots.length];
    const x = 1080*slot[0], y = H*slot[1];
    const radius = 73 + random()*30;
    const color = fireworkColors[index%fireworkColors.length];
    const g = el('g', {transform:`translate(${x} ${y})`,opacity:fixed?1:0}, $('fireworks'));
    const trail = el('path', {d:`M0 ${radius+110}Q-8 ${radius+50} 0 15`,fill:'none',stroke:color,'stroke-width':3,'stroke-linecap':'round',opacity:.5}, g);
    const rays = el('g', {}, g);
    for (let i=0;i<8;i++) {
      const angle = Math.PI*2*i/8-.15;
      const c=Math.cos(angle),s=Math.sin(angle);
      el('path',{d:`M${c*radius*.30} ${s*radius*.30}Q${c*radius*.7-4} ${s*radius*.7-3} ${c*radius} ${s*radius}`,fill:'none',stroke:color,'stroke-width':5.5,'stroke-linecap':'round'},rays);
      if(i%2===0) el('path',{d:'M0-7L2-2L7 0L2 2L0 7L-2 2L-7 0L-2-2Z',fill:color,transform:`translate(${c*radius*1.13} ${s*radius*1.13})`},rays);
      else el('circle',{cx:c*radius*1.18,cy:s*radius*1.18,r:3.5,fill:color},rays);
    }
    if(fixed){trail.remove();return;}
    bursts.push({g,rays,trail,age:-(options.delay||0),radius,pan:slot[0]*2-1,
      batch:options.batch,voice:options.voice||0,sounded:false});
  }
  function createSalvo() {
    const batch=++salvoId;
    const offsets=(window.BEACH_AUDIO&&window.BEACH_AUDIO.offsets)||[0,75,150,225,300];
    offsets.forEach((delay,voice)=>createBurst(false,burstIndex++,{batch,delay,voice}));
  }
  function staticFireworks() {clearFireworks();[0,1,2,3,4].forEach(i=>createBurst(true,i));}
  function updateFireworks(dt) {
    if(!isCelebrating || reducedMotion) return;
    fireworkClock += dt;
    if(fireworkClock>=nextSalvoAt){fireworkClock=0;nextSalvoAt=1900+random()*350;createSalvo();}
    bursts = bursts.filter(b=>{
      b.age+=dt;
      if(b.age<0)return true;
      b.g.setAttribute('opacity',1);
      // Play the recorded bang when the firework opens, after its rising trail.
      if (!b.sounded && b.age >= 480) {
        b.sounded = true;
        if (audio.enabled) audio.firework(b.pan,{batch:b.batch,voice:b.voice});
      }
      const p=clamp((b.age-450)/1500,0,1), grow=1-Math.pow(1-p,3);
      b.rays.setAttribute('transform',`translate(0 ${p*p*24}) scale(${.15+grow*.85})`);
      b.rays.setAttribute('opacity',b.age<450?0:Math.min(1,p*7)*(1-Math.pow(p,3)));
      b.trail.setAttribute('opacity',b.age<500?Math.sin(b.age/500*Math.PI)*.6:0);
      if(b.age>2300){b.g.remove();return false;}return true;
    });
  }

  function onOrientation(event) {
    if(!motionEnabled || event.gamma===null || event.beta===null) return;
    if(betaOrigin===null) betaOrigin=event.beta;
    const angle = screen.orientation ? screen.orientation.angle : (window.orientation || 0);
    const x=clamp(event.gamma/24,-1,1), y=clamp((event.beta-betaOrigin)/24,-1,1);
    if(angle===90){targetX=-y;targetY=x;}else if(angle===270 || angle===-90){targetX=y;targetY=-x;}else{targetX=x;targetY=y;}
  }
  function attachMotion() {
    if(motionEnabled) return;
    motionEnabled=true;
    betaOrigin=null;
    window.addEventListener('deviceorientation',onOrientation,{passive:true});
    $('motionButton').setAttribute('aria-pressed','true');
    $('motionButton').setAttribute('aria-label','关闭手机轻晃视差');
  }
  function enableAutomaticMotion() {
    const API=window.DeviceOrientationEvent;
    if(!reducedMotion && API && typeof API.requestPermission!=='function' && window.isSecureContext) attachMotion();
  }
  async function toggleMotion() {
    if(reducedMotion){toast('已跟随你的系统设置，减少画面晃动');return;}
    if(motionEnabled){
      motionEnabled=false;
      window.removeEventListener('deviceorientation',onOrientation);
      targetX=targetY=0;
      $('motionButton').setAttribute('aria-pressed','false');
      $('motionButton').setAttribute('aria-label','开启手机轻晃视差');
      toast('已关闭轻晃效果');return;
    }
    const API=window.DeviceOrientationEvent;
    if(!API){toast('这台设备可用鼠标轻移画面，手机上可开启轻晃');return;}
    if(!window.isSecureContext){toast('手机轻晃需要通过 HTTPS 链接打开');return;}
    try{
      if(typeof API.requestPermission==='function'){
        const permission=await API.requestPermission();
        if(permission!=='granted'){toast('未开启轻晃，依然可以完整体验惊喜');return;}
      }
      attachMotion();toast('轻轻转动手机，星海会跟着你移动');
    }catch(_){toast('当前浏览器未开放轻晃，依然可以触摸体验');}
  }

  const audio = new window.BeachSound({button:$('soundButton'),notify:toast});

  function animate(now) {
    frame=requestAnimationFrame(animate);
    if(lastFrame && now-lastFrame<30)return;
    const dt=Math.min(lastFrame?now-lastFrame:33,80);lastFrame=now;time+=dt;
    if(tween){
      tween.elapsed+=dt;
      const p=clamp(tween.elapsed/tween.duration,0,1),e=ease(p);
      cam=lerp(tween.from,tween.to,e);
      picnicOpacity=lerp(tween.opacityFrom,tween.opacityTo,clamp(p*1.8,0,1));
      if(p===1){tween=null;const resolve=tweenResolve;tweenResolve=null;if(resolve)resolve();}
    }
    if(!reducedMotion){tiltX=lerp(tiltX,targetX,.045);tiltY=lerp(tiltY,targetY,.045);}
    renderCamera();
    if(!reducedMotion){
      ripples.forEach(({node,base,phase})=>{
        const drift=Math.sin(time*.0007+phase);
        node.setAttribute('transform',`translate(${drift*9} ${H*base+Math.sin(time*.00045+phase)*6})`);
        node.setAttribute('opacity',.58+drift*.16);
      });
      const wash=(time%6800)/6800;
      $('foam').setAttribute('transform',`translate(0 ${Math.sin(time*.0008)*4})`);
      $('wash').setAttribute('transform',`translate(0 ${-24+wash*49})`);
      $('wash').setAttribute('opacity',Math.sin(wash*Math.PI)*.55);
    }else{
      ripples.forEach(({node,base})=>node.setAttribute('transform',`translate(0 ${H*base})`));
      $('wash').setAttribute('opacity',.2);
    }
    for(const mote of $('wishMotes').children){
      const phase=Number(mote.dataset.phase),p=reducedMotion?phase:time*.0006+phase;
      mote.setAttribute('transform',`translate(${Math.sin(p)*165} ${-155+Math.cos(p*.8)*55}) scale(.32)`);
      mote.setAttribute('opacity',cam*(.3+(.5+Math.sin(p))*.18));
    }
    if(isCelebrating){danceTime+=dt;renderDancers();}
    updateFireworks(dt);
  }

  $('enterButton').addEventListener('click',enterWish);
  app.addEventListener('click',event=>{
    if(scene==='intro'&&!event.target.closest('button'))enterWish();
  });
  $('replayButton').addEventListener('click',replay);
  $('motionButton').addEventListener('click',toggleMotion);
  $('soundButton').addEventListener('click',()=>audio.toggle());
  app.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
  const wishButton=$('wishButton');
  if(window.PointerEvent){
    wishButton.addEventListener('pointerdown',startHold);
    wishButton.addEventListener('pointerup',finishHold);
    wishButton.addEventListener('pointercancel',event=>{if(event.pointerId===pointerId)cancelHold();});
    wishButton.addEventListener('lostpointercapture',cancelHold);
  }else{
    wishButton.addEventListener('touchstart',event=>{if(event.touches.length===1)startHold(event);},{passive:false});
    window.addEventListener('touchend',finishHold,{passive:true});
    window.addEventListener('touchcancel',cancelHold,{passive:true});
    wishButton.addEventListener('mousedown',startHold);
    window.addEventListener('mouseup',finishHold);
  }
  wishButton.addEventListener('contextmenu',event=>event.preventDefault());
  wishButton.addEventListener('keydown',event=>{
    if((event.code==='Space'||event.code==='Enter')&&!event.repeat){event.preventDefault();startHold();}
    if(event.code==='Escape')cancelHold();
  });
  wishButton.addEventListener('keyup',event=>{
    if(event.code==='Space'||event.code==='Enter'){event.preventDefault();finishHold();}
  });
  wishButton.addEventListener('blur',cancelHold);
  app.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'||motionEnabled||reducedMotion)return;
    const rect=app.getBoundingClientRect();targetX=clamp(((event.clientX-rect.left)/rect.width-.5)*2,-1,1);targetY=clamp(((event.clientY-rect.top)/rect.height-.5)*2,-1,1);
  },{passive:true});
  app.addEventListener('pointerleave',()=>{if(!motionEnabled)targetX=targetY=0;});
  window.addEventListener('blur',cancelHold);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelHold();cancelAnimationFrame(frame);frame=0;lastFrame=0;audio.pause();}
    else{if(!frame)frame=requestAnimationFrame(animate);audio.resume();}
  });
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(layout,80);},{passive:true});
  window.addEventListener('orientationchange',()=>{betaOrigin=null;targetX=targetY=0;},{passive:true});
  buildArtwork();layout();setScene('intro');
  frame=requestAnimationFrame(animate);
})();
