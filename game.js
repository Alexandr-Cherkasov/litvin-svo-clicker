(() => {
  'use strict';
  const maxClicks = 150;
  const stage = document.querySelector('.stage');
  const character = document.querySelector('#character');
  const car = document.querySelector('#car');
  const rearTire = document.querySelector('#rear-tire');
  const replay = document.querySelector('#replay');
  const music = document.querySelector('#music');
  const musicToggle = document.querySelector('#music-toggle');
  const count = document.querySelector('#count');
  const meter = document.querySelector('#meter');
  const fill = document.querySelector('#fill');
  const message = document.querySelector('#message');
  const victory = document.querySelector('#victory');
  const popups = document.querySelector('#click-effects');
  const effects = document.querySelector('#effects');
  const ctx = effects.getContext('2d');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  const updates = [
    [0, 'Один клик — один шаг к дрифту.'],
    [1, 'Первый клик. Продолжай!'],
    [15, 'В бардачке BMW нашёлся бланк контракта.'],
    [35, 'Ого, ты почти попал на СВО. Продолжай кликать!'],
    [60, 'Контракт почти подписан, продолжай.'],
    [85, 'Ключи уже в замке зажигания.'],
    [105, 'Ещё немного, и BMW сорвётся с места.'],
    [125, 'Подпись всё ближе. Задние колёса уже дымятся.'],
    [140, 'Финиш рядом. Жми!'],
    [150, 'Дрифт запущен.'],
  ];
  let clicks = 0;
  let status = -1;
  let activeFrame = 0;
  let tapAnimation;
  let height = 1, width = 1;

  function resizeEffects() {
    width = effects.clientWidth;
    height = effects.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.75);
    effects.width = Math.round(width*ratio);
    effects.height = Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }

  function updateProgress() {
    count.textContent = clicks;
    meter.setAttribute('aria-valuenow', clicks);
    fill.style.width = (clicks/maxClicks*100) + '%';
    replay.disabled = clicks === 0;
    const next = updates.findLastIndex(([at]) => clicks >= at);
    if (next !== status) {
      status = next;
      message.textContent = updates[status][1];
      if (!motion.matches) {
        message.getAnimations().forEach(animation => animation.cancel());
        message.animate([{ scale: .94 }, { scale: 1 }], { duration: 175, easing: 'ease-out' });
      }
    }
  }

  function registerClick() {
    if (clicks >= maxClicks) return;
    clicks++;
    updateProgress();
    if (clicks === maxClicks) {
      character.disabled = true;
      stage.dataset.phase = 'drift';
      victory.hidden = false;
      popups.replaceChildren();
      celebrate();
      return;
    }
    if (motion.matches) return;
    tapAnimation?.cancel();
    tapAnimation = character.animate([
      { transform:'translate(-50%, -100%) scale(.93,.945) rotate(-1.6deg)' },
      { transform:'translate(-50%, -100%) scale(1.026,1.018) rotate(.7deg)', offset:.58 },
      { transform:'translate(-50%, -100%)' }
    ], {duration:190,easing:'ease-out'});
    const plus = document.createElement('span');
    plus.className = 'plus';
    plus.textContent = '+1';
    plus.style.setProperty('--offset', ((clicks%2 ? -1 : 1)*(30+Math.random()*52))+'px');
    popups.append(plus);
    plus.addEventListener('animationend', () => plus.remove(), { once:true });
    if (popups.childElementCount > 15) popups.firstElementChild.remove();
  }

  const fireworkColors = ['255,143,110','255,220,140','190,147,255','136,198,255','255,134,178','255,238,195'];
  const smokeTexture = document.createElement('canvas');
  smokeTexture.width = smokeTexture.height = 96;
  const smokeBrush = smokeTexture.getContext('2d');
  const gradient = smokeBrush.createRadialGradient(48,48,0,48,48,48);
  gradient.addColorStop(0,'#eddefc');
  gradient.addColorStop(.38,'#e2c8eeaf');
  gradient.addColorStop(.69,'#c6a9d448');
  gradient.addColorStop(1,'#aa90c000');
  smokeBrush.fillStyle = gradient;
  smokeBrush.fillRect(0,0,96,96);

  function driftCar(progress) {
    const slide = Math.sin(progress * Math.PI);
    car.style.setProperty('--car-x', `${-48 + 196 * progress}%`);
    car.style.setProperty('--car-y', `${76 + 10 * slide}%`);
    car.style.setProperty('--car-angle', `${-5 + 13 * slide}deg`);
    car.hidden = false;
  }

  function celebrate() {
    const smoke = [], sparks = [], flashes = [];
    const reduced = motion.matches;
    const travel = reduced ? 1.05 : 3.65;
    const total = reduced ? 1.5 : 6.85;
    let start = null, previous = 0, nextBurst = .07, nextSmoke = .08, burstIndex = 0;

    function cloud(x,y,velocity) {
      smoke.push({x:x+(Math.random()-.5)*26,y:y+(Math.random()-.5)*13,
        vx:velocity+Math.random()*35,vy:-9-Math.random()*42,
        age:0,life:1.28+Math.random()*1.38,
        radius:12+Math.random()*21,rate:35+Math.random()*36});
    }

    function firework() {
      const index = burstIndex++;
      const angle = -.65+index*Math.PI/3.3;
      const x = width*(.5+Math.cos(angle)*.378);
      const y = height*(.58+Math.sin(angle)*.30);
      const color = fireworkColors[index%fireworkColors.length];
      const scale = Math.max(.44, Math.min(1,width/850));
      flashes.push({x,y,color,age:0});
      const points = reduced ? 20 : 64;
      for (let i=0;i<points;i++) {
        const direction = i*2*Math.PI/points+Math.random()*.10;
        const speed = (67+Math.random()*116)*scale;
        sparks.push({x,y,vx:Math.cos(direction)*speed,vy:Math.sin(direction)*speed,color,
          age:0,life:.72+Math.random()*.88,r:.8+Math.random()*1.65});
      }
    }

    function paintSmoke(dt) {
      for (let i=smoke.length-1;i>=0;i--) {
        const puff=smoke[i];
        puff.age+=dt;
        if (puff.age>=puff.life) {
          smoke.splice(i,1);
          continue;
        }
        puff.x+=puff.vx*dt;
        puff.y+=puff.vy*dt;
        const r=puff.radius+puff.rate*puff.age;
        ctx.globalAlpha = .32*(1-puff.age/puff.life);
        ctx.drawImage(smokeTexture,puff.x-r,puff.y-r*.72,r*2,r*1.44);
      }
      ctx.globalAlpha = 1;
    }

    function paintFireworks(dt) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i=flashes.length-1;i>=0;i--) {
        const flash=flashes[i];
        flash.age+=dt;
        if (flash.age>.26) {
          flashes.splice(i,1);
          continue;
        }
        const r=6+flash.age*61;
        const shine=ctx.createRadialGradient(flash.x,flash.y,0,flash.x,flash.y,r);
        shine.addColorStop(0,`rgba(${flash.color},${.52*(1-flash.age/.26)})`);
        shine.addColorStop(1,`rgba(${flash.color},0)`);
        ctx.fillStyle=shine;
        ctx.fillRect(flash.x-r,flash.y-r,r*2,r*2);
      }
      for (let i=sparks.length-1;i>=0;i--) {
        const spark=sparks[i];
        spark.age+=dt;
        if (spark.age>=spark.life) {
          sparks.splice(i,1);
          continue;
        }
        spark.x+=spark.vx*dt;
        spark.y+=spark.vy*dt;
        spark.vx*=1-dt*.52;
        spark.vy+=(62-spark.vy*.5)*dt;
        const opacity=Math.sqrt(1-spark.age/spark.life)*(.78+.2*Math.sin(spark.age*22+i));
        ctx.strokeStyle=`rgba(${spark.color},${opacity})`;
        ctx.lineWidth=spark.r;
        ctx.beginPath();
        ctx.moveTo(spark.x,spark.y);
        ctx.lineTo(spark.x-spark.vx*.075,spark.y-spark.vy*.075);
        ctx.stroke();
        ctx.fillStyle=`rgba(255,240,219,${opacity*.72})`;
        ctx.fillRect(spark.x-.65,spark.y-.65,1.3,1.3);
      }
      ctx.restore();
    }

    function tick(now) {
      if (start === null) start=now;
      const time=(now-start)/1000;
      const dt=Math.min(.05,time-previous);
      previous=time;
      ctx.clearRect(0,0,width,height);
      const driftTime = time - (reduced ? 0 : .25);
      if (driftTime>=0 && driftTime<=travel) {
        driftCar(driftTime/travel);
        if (!reduced && time>=nextSmoke) {
          nextSmoke=time+.033;
          const tire = rearTire.getBoundingClientRect();
          const area = effects.getBoundingClientRect();
          const x = tire.left - area.left;
          const y = tire.top - area.top;
          if (x > -120 && x < width + 25) {
            cloud(x,y,-35);
            cloud(x,y,-52);
          }
        }
      } else if (driftTime > travel && !car.hidden) {
        car.hidden = true;
      }
      if (time>=nextBurst && time<total-1.22) {
        firework();
        if (!reduced && burstIndex%4===0) firework();
        nextBurst=time+.43;
      }
      paintSmoke(dt);
      paintFireworks(dt);
      if (time<total) {
        activeFrame=requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0,0,width,height);
        stage.dataset.phase='finished';
        activeFrame=0;
      }
    }
    car.hidden = true;
    activeFrame=requestAnimationFrame(tick);
  }

  function reset() {
    if (activeFrame) cancelAnimationFrame(activeFrame);
    activeFrame=0;
    clicks=0;
    stage.dataset.phase='idle';
    victory.hidden=true;
    character.disabled=false;
    tapAnimation?.cancel();
    popups.replaceChildren();
    ctx.clearRect(0,0,width,height);
    car.removeAttribute('style');
    car.hidden = false;
    updateProgress();
    character.focus({ preventScroll:true });
  }

  function updateMusicToggle() {
    musicToggle.setAttribute('aria-pressed', String(!music.paused));
  }

  function startMusic() {
    music.play().catch(updateMusicToggle);
  }

  music.volume = 0.35;
  music.addEventListener('play', updateMusicToggle);
  music.addEventListener('pause', updateMusicToggle);
  character.addEventListener('click', startMusic, { once: true });
  musicToggle.addEventListener('click', () => {
    character.removeEventListener('click', startMusic);
    if (music.paused) startMusic();
    else music.pause();
  });

  new ResizeObserver(resizeEffects).observe(stage);
  resizeEffects();
  character.addEventListener('click', registerClick);
  replay.addEventListener('click', reset);
  updateProgress();
})();
