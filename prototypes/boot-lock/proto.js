/* 启动画面 + 锁屏 预览原型的交互（独立文件，不属于正式页面）
   状态：boot（启动中）→ lock（锁屏）→ desk（桌面示意）
   解锁进度 --p 从 0 到 1，手指拖动时实时跟手，松手后按距离和速度决定解锁还是弹回 */
(function(){
  const $ = s => document.querySelector(s);
  const root = document.documentElement, screen = $('#screen'), lock = $('#lock'), boot = $('#boot'), desk = $('#desk'), notesEl = $('#notes');
  const reduced = () => root.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let state = 'boot', p = 0, anim = 0, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, reduced() ? Math.min(ms, 160) : ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  /* —— 图标、状态栏：直接用正式项目的图标库 —— */
  const paintIcons = r => r.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = XS.appIcons[el.dataset.icon]; });
  paintIcons(document);
  $('#sbRight').innerHTML = XS.statusIcons.signal + XS.statusIcons.wifi + XS.statusIcons.battery;

  /* —— 启动画面：手写项目名（矢量路径）+ 画布星点 ——
     星点：少量、大小不一、很淡，缓慢往下飘并轻微左右摆；位置用固定种子生成，截图可复现
     轻点空白处：附近星点亮一下、往外散开并淡出，再从顶上慢慢补回来；中心有一小圈柔光和几粒碎光
     手指移动：附近星点被极轻地带一下（最多挪十几像素），松手后自己回去
     减少动态效果：只画一帧静止的星点，不飘、不闪 */
  const nameSvg = $('#bootName');
  nameSvg.setAttribute('viewBox', BRAND_NAME.viewBox);
  nameSvg.querySelector('path').setAttribute('d', BRAND_NAME.d);
  const sky = (function(){
    const cv = $('#bootStars'), g = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, tones = [], raf = 0, last = 0, T = 0, finger = null;
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const N = 30, stars = [], bursts = [];
    for (let i = 0; i < N; i++) {
      const tier = i % 10 === 3 ? 2 : i % 3 === 0 ? 1 : 0;           // 0 = 细点（大多数）1 = 小光点 2 = 四角星（只有 3 颗）
      stars.push({
        x: rnd(), y: rnd(), tier,
        r: tier === 2 ? 3.2 + rnd() * 1.2 : tier === 1 ? 1.3 + rnd() * .7 : .6 + rnd() * .6,
        a: tier === 2 ? .34 + rnd() * .12 : .16 + rnd() * .22,        // 透明度很低
        v: 5 + rnd() * 9,                                             // 往下飘，像素/秒
        sw: 3 + rnd() * 7, sp: .12 + rnd() * .2, ph: rnd() * 6.28,    // 左右摆的幅度、速度、相位
        tw: .5 + rnd() * .7, tp: rnd() * 6.28,                        // 亮度起伏
        tone: i % 4, dx: 0, dy: 0, vx: 0, vy: 0, fx: 0, fy: 0, flash: 0, fade: 1, gone: false
      });
    }
    const readTones = () => { const cs = getComputedStyle(root); tones = [1, 2, 3, 4].map(k => cs.getPropertyValue('--star-' + k).trim()); };
    function size(){
      const r = cv.parentElement; W = r.offsetWidth; H = r.offsetHeight; dpr = Math.min(3, devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      readTones(); if (!raf) draw();
    }
    // 图标和名字所在的区域：星点经过时再压暗，保证不抢画面
    const calm = (x, y) => { const cx = W / 2, cy = H / 2 - 30, ex = (x - cx) / 130, ey = (y - cy) / 150, d = ex * ex + ey * ey; return d < 1 ? .25 + .75 * d : 1; };
    function pos(s){
      const span = H + 20;
      const y = ((s.y * span + T * s.v) % span) - 10;
      const x = s.x * W + Math.sin(T * s.sp + s.ph) * s.sw;
      return [x + s.dx + s.fx, y + s.dy + s.fy];
    }
    function starPath(x, y, r){
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? r * .28 : r;
        g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      }
      g.closePath();
    }
    function draw(){
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      for (const s of stars) {
        const [x, y] = pos(s);
        const tw = reduced() ? 1 : .72 + .28 * Math.sin(T * s.tw + s.tp);
        const al = Math.min(1, s.a * tw * s.fade * calm(x, y) + s.flash * .55);
        if (al < .01) continue;
        const r = s.r * (1 + s.flash * .9);
        g.fillStyle = tones[s.tone];
        // 柔光晕
        g.globalAlpha = al * .35;
        g.beginPath(); g.arc(x, y, r * (s.tier === 2 ? 2.2 : 3.2), 0, 6.283); g.fill();
        g.globalAlpha = al;
        if (s.tier === 2) { starPath(x, y, r * 1.6); g.fill(); }
        else { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
      }
      // 轻点：一圈很淡的柔光 + 几粒往外散开的碎光
      for (const b of bursts) {
        const k = b.t / b.life, e = 1 - Math.pow(1 - k, 3);
        g.globalAlpha = (1 - k) * .22;
        g.fillStyle = tones[b.tone];
        g.beginPath(); g.arc(b.x, b.y, 8 + e * 34, 0, 6.283); g.fill();
        for (const p of b.bits) {
          g.globalAlpha = (1 - k) * .6;
          g.beginPath(); g.arc(b.x + Math.cos(p.a) * p.d * e, b.y + Math.sin(p.a) * p.d * e, p.r * (1 - k * .6), 0, 6.283); g.fill();
        }
      }
      g.globalAlpha = 1;
    }
    function step(now){
      const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; T += dt;
      for (const s of stars) {
        // 被散开的星点：带初速度往外飘，阻尼减速，同时淡出；淡完后从顶上重新飘下来
        s.dx += s.vx * dt; s.dy += s.vy * dt; s.vx *= Math.pow(.08, dt); s.vy *= Math.pow(.08, dt);
        s.flash = Math.max(0, s.flash - dt * 2.4);
        if (s.gone) {
          s.fade = Math.max(0, s.fade - dt * 1.3);
          if (!s.fade) { s.gone = false; s.dx = s.dy = s.vx = s.vy = 0; s.y = (1 - (T * s.v) / (H + 20) % 1) % 1; s.x = .04 + rnd() * .92; s.fade = .001; }
        } else if (s.fade < 1) s.fade = Math.min(1, s.fade + dt * .5);
        // 跟随手指：只挪很小的距离，弹簧回位
        let tx = 0, ty = 0;
        if (finger) {
          const [x, y] = pos(s), ddx = finger.x - x, ddy = finger.y - y, d = Math.hypot(ddx, ddy);
          if (d < 110 && d > 1) { const f = (1 - d / 110) * 14; tx = s.fx + ddx / d * f; ty = s.fy + ddy / d * f; }
        }
        s.fx += (tx - s.fx) * Math.min(1, dt * 3); s.fy += (ty - s.fy) * Math.min(1, dt * 3);
      }
      for (let i = bursts.length - 1; i >= 0; i--) if ((bursts[i].t += dt) >= bursts[i].life) bursts.splice(i, 1);
      draw();
      raf = requestAnimationFrame(step);
    }
    function tap(x, y){
      if (reduced()) return;
      let n = 0;
      for (const s of stars) {
        if (s.gone) continue;
        const [sx, sy] = pos(s), ddx = sx - x, ddy = sy - y, d = Math.hypot(ddx, ddy);
        if (d > 120) continue;
        const f = 1 - d / 120, ux = d > 1 ? ddx / d : Math.cos(n), uy = d > 1 ? ddy / d : Math.sin(n);
        s.flash = Math.max(s.flash, .5 + f * .5);
        s.vx += ux * (30 + 60 * f); s.vy += uy * (30 + 60 * f);
        if (d < 70) s.gone = true;                                   // 离得近的散开后消失
        n++;
      }
      const bits = [];
      for (let k = 0; k < 7; k++) bits.push({ a: k / 7 * 6.283 + rnd() * .6, d: 22 + rnd() * 26, r: .8 + rnd() * .9 });
      bursts.push({ x, y, t: 0, life: .95, tone: Math.floor(rnd() * 4), bits });
      if (bursts.length > 4) bursts.shift();
    }
    const start = () => { size(); if (raf || reduced()) { draw(); return; } last = 0; raf = requestAnimationFrame(step); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const local = e => { const r = cv.getBoundingClientRect(), k = r.width / W || 1; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; };
    addEventListener('resize', size);
    new MutationObserver(() => { readTones(); stop(); if (!boot.hidden) start(); }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
    size();
    return { start, stop, tap, local, draw, follow: p => { finger = p; }, get count(){ return stars.filter(s => !s.gone).length; } };
  })();

  /* —— 时间：每秒检查，分钟变了才更新 —— */
  const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  let lastMin = '';
  function tick(){
    const d = new Date(), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    if (hh + mm === lastMin) return; lastMin = hh + mm;
    const t = `${d.getHours()}:${mm}`, md = `${d.getMonth() + 1}月${d.getDate()}日`;
    document.querySelectorAll('[data-clock]').forEach(el => {
      const k = el.dataset.clock;
      if (k === 'big') el.innerHTML = `${hh}<span class="colon">:</span>${mm}`;
      else el.textContent = k === 't' ? t : k === 'w' ? WEEK[d.getDay()] : md;
    });
  }
  tick(); setInterval(tick, 1000);

  /* —— 锁屏通知（演示数据）——
     一条：只显示这一张完整的卡，没有标题栏
     多条：顶上“通知 · N 条”+ 展开 / 收起；展开 = 每条一张独立的卡排成一列（默认），收起 = 只留最新一张
     不再用叠起的卡边和“还有 N 条”提示；放不下时列表自己滚动，底部“上滑解锁”固定不动
     轻点某条 = 解锁后打开对应应用（原型里只提示）；收起时轻点那一张 = 展开
     隐藏预览：聊天只显示“聊天 · 新消息”，不露联系人和内容；其他应用只显示应用名 */
  const opt = { count: 2, open: true, privacy: false };
  const ago = m => m <= 0 ? '现在' : m < 60 ? `${m} 分钟前` : `${Math.floor(m / 60)} 小时前`;
  const AV_TONES = [['#F4D6E2', '#E3D9F4'], ['#D8E6F3', '#DCEFE8'], ['#F3E3D2', '#F4D6E2'], ['#E3D9F4', '#D8E6F3']];
  const avatar = c => {
    let h = 0; for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const [a, b] = AV_TONES[h % AV_TONES.length];
    return `<span class="n-avatar" style="--a:${a};--b:${b}">${esc(c.name.trim().slice(0, 1).toUpperCase())}</span>`;
  };
  function card(n, i){
    const app = DEMO_APPS[n.app], msg = n.kind === 'message', hide = opt.privacy;
    const appIcon = cls => `<span class="app-icon ${app.variant} ${cls}" data-icon="${app.icon}"></span>`;
    const pic = msg && !hide ? `<span class="n-pic">${avatar(n.contact)}${appIcon('n-badge')}</span>` : `<span class="n-pic">${appIcon('n-appicon')}</span>`;
    const head = msg ? (hide ? app.name : n.contact.name) : app.name;
    const line = hide ? (msg ? '新消息' : '新通知') : msg ? n.text : [n.title, n.text].filter(Boolean).join('\n');
    const label = hide ? `${app.name}，${line}` : msg ? `${app.name}，${n.contact.name}：${n.text}` : `${app.name}，${n.title || ''} ${n.text}`;
    return `<article class="note glass" style="--k:${i}" data-id="${n.id}" aria-label="${esc(label)}，${ago(n.minutesAgo)}">
      ${pic}<div class="n-text"><div class="n-head"><b>${esc(head)}</b><time>${ago(n.minutesAgo)}</time></div>
      ${msg || hide ? `<p class="n-line">${esc(line)}</p>` : `${n.title ? `<p class="n-title">${esc(n.title)}</p>` : ''}<p class="n-line">${esc(n.text)}</p>`}</div></article>`;
  }
  function renderNotes(){
    // FLIP：记下旧位置，重新排版后从旧位置滑到新位置（展开、收起、切条数都用这一套）
    const before = {};
    notesEl.querySelectorAll('.note').forEach(c => { before[c.dataset.id] = c.getBoundingClientRect().top; });
    const list = DEMO_NOTES.slice(0, opt.count);
    const multi = list.length > 1, open = !multi || opt.open;
    const shown = open ? list : list.slice(0, 1);
    notesEl.className = 'notes' + (!multi ? ' is-single' : open ? ' is-open' : ' is-folded');
    notesEl.hidden = !list.length;
    notesEl.innerHTML = !list.length ? '' :
      (multi ? `<div class="n-bar"><span>通知 · ${list.length} 条</span>` +
        `<button class="n-fold" data-note="fold" aria-expanded="${open}">${open ? '收起' : '展开'}</button></div>` : '') +
      `<div class="n-list">${shown.map(card).join('')}</div>`;
    paintIcons(notesEl);
    fadeEdges();
    if (reduced() || !Object.keys(before).length) return;
    const k = scaleK();
    notesEl.querySelectorAll('.note').forEach(c => {
      const old = before[c.dataset.id];
      const dy = old == null ? 18 : (old - c.getBoundingClientRect().top) / k;
      if (Math.abs(dy) < .5) return;
      c.animate([{ transform: `translate3d(0,${dy}px,0)`, opacity: old == null ? 0 : 1 }, { transform: 'none', opacity: 1 }],
        { duration: 460, easing: 'cubic-bezier(.32,.72,0,1)', delay: old == null ? 30 * [...c.parentNode.children].indexOf(c) : 0, fill: 'backwards' });
    });
  }
  // 通知多到放不下时，列表自己滚动：上下边缘按是否还有内容淡出，提示可以滚
  function fadeEdges(){
    const l = notesEl.querySelector('.n-list'); if (!l) return;
    notesEl.classList.toggle('fade-top', l.scrollTop > 2);
    notesEl.classList.toggle('fade-bot', l.scrollTop + l.clientHeight < l.scrollHeight - 2);
  }
  notesEl.addEventListener('scroll', fadeEdges, true);
  addEventListener('resize', fadeEdges);
  const toggleNotes = open => { opt.open = open; renderNotes(); syncPanel(); };

  /* —— 提示条 —— */
  let toastT;
  function toast(text){
    const t = $('#toast'); t.textContent = text;
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1900);
  }
  const scaleK = () => screen.getBoundingClientRect().height / screen.offsetHeight || 1;   // 电脑外框的缩放比例

  /* —— 进度 —— */
  const setP = v => { p = v; screen.style.setProperty('--p', v.toFixed(4)); };
  const easePage = t => 1 - Math.pow(1 - t, 3.2);
  const easeBack = t => { const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  function tween(to, ms, ease, done){
    cancelAnimationFrame(anim);
    const from = p, t0 = performance.now(); ms = reduced() ? 120 : ms;
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      setP(from + (to - from) * (reduced() ? k : ease(k)));
      if (k < 1) anim = requestAnimationFrame(step); else done && done();
    };
    anim = requestAnimationFrame(step);
  }

  /* —— 启动 → 锁屏 —— */
  // 启动画面停留约 2.8 秒；手指在屏上玩星点时不自动走，松手后再等一会儿。hold = 一直停在启动画面（预览星点互动用）
  const BOOT_MS = 2800;
  let hold = false, bootT = 0;
  const armBoot = ms => { clearTimeout(bootT); if (!hold && state === 'boot') bootT = setTimeout(showLock, reduced() ? Math.min(ms, 600) : ms); };
  function playBoot(){
    clearTimers(); cancelAnimationFrame(anim); clearTimeout(bootT);
    state = 'boot'; setP(0); toDeskState(false);
    screen.classList.remove('lock-enter'); lock.classList.remove('opened');
    boot.hidden = false; boot.className = 'boot';
    void boot.offsetWidth;                      // 重新触发动画
    boot.classList.add('play');
    sky.start();
    armBoot(BOOT_MS);
  }
  function showLock(){
    if (state !== 'boot') return;
    clearTimers(); clearTimeout(bootT); state = 'lock';
    boot.classList.add('leave');
    screen.classList.add('lock-enter');
    later(() => { boot.hidden = true; boot.className = 'boot'; sky.stop(); sky.follow(null); }, 900);
    later(() => screen.classList.remove('lock-enter'), 1150);
    lock.focus({ preventScroll: true });
  }
  // 启动画面：轻点空白处 = 星点闪一下；手指移动 = 星点极轻地跟一下；轻点图标或名字 = 跳过（至少先让图标出现）
  let bootAt = 0, bootG = null;
  boot.addEventListener('pointerdown', e => {
    if (state !== 'boot') return;
    if (e.target.closest('.boot-mark,.boot-name')) { if (performance.now() - bootAt > 500) showLock(); return; }
    bootG = { id: e.pointerId, p: sky.local(e), moved: false };
    boot.setPointerCapture(e.pointerId);
    clearTimeout(bootT);
  });
  boot.addEventListener('pointermove', e => {
    if (state !== 'boot') return;
    const pt = sky.local(e);
    if (bootG && e.pointerId === bootG.id) { if (Math.hypot(pt.x - bootG.p.x, pt.y - bootG.p.y) > 8) bootG.moved = true; sky.follow(pt); }
    else if (e.pointerType === 'mouse') sky.follow(pt);
  });
  const bootUp = e => {
    if (!bootG || e.pointerId !== bootG.id) return;
    if (!bootG.moved && e.type === 'pointerup') sky.tap(bootG.p.x, bootG.p.y);
    bootG = null; if (e.pointerType !== 'mouse') sky.follow(null);
    armBoot(1600);
  };
  boot.addEventListener('pointerup', bootUp);
  boot.addEventListener('pointercancel', bootUp);
  boot.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') sky.follow(null); });
  const startBoot = () => { bootAt = performance.now(); playBoot(); };

  /* —— 锁屏 ⇄ 桌面 —— */
  function toDeskState(on){
    screen.classList.toggle('at-desk', on);
    desk.inert = !on; lock.inert = on;
  }
  function unlock(fromP, after){
    if (state !== 'lock') return;
    state = 'unlocking'; lock.classList.add('opened');
    const rest = 1 - (fromP ?? p);
    tween(1, 260 + 360 * rest, easePage, () => { state = 'desk'; toDeskState(true); after && after(); });
  }
  function relock(){
    if (state !== 'desk') return;
    state = 'locking'; toDeskState(false); lock.classList.remove('opened');
    tween(0, 420, easePage, () => { state = 'lock'; lock.focus({ preventScroll: true }); });
  }
  function bump(){
    lock.classList.remove('bump'); void lock.offsetWidth; lock.classList.add('bump');
    setTimeout(() => lock.classList.remove('bump'), 450);
  }
  // 轻点锁屏上的东西：收起时的通知 → 展开；“展开 / 收起”按钮 → 切换；展开后的某条 → 解锁并（示意）打开对应应用；空白 → 解锁
  function tapAt(target){
    if (target.closest('[data-note="fold"]')) { toggleNotes(!opt.open); return; }
    const note = target.closest('.note');
    if (note && notesEl.classList.contains('is-folded')) { toggleNotes(true); return; }
    if (note) {
      const n = DEMO_NOTES.find(x => x.id === note.dataset.id), name = DEMO_APPS[n.app].name;
      unlock(0, () => toast(n.kind === 'message' ? `示意：解锁后打开「${name}」与${n.contact.name}的对话` : `示意：解锁后打开「${name}」`));
      return;
    }
    unlock(0);
  }

  /* —— 手势：鼠标和触摸统一用 Pointer 事件 —— */
  let g = null;
  lock.addEventListener('pointerdown', e => {
    if (state !== 'lock' || e.button > 0) return;
    cancelAnimationFrame(anim);
    // 触摸落在能滚动的通知列表里：交给列表自己滚动，只认轻点，不拖动解锁
    const l = e.target.closest('.n-list'), inList = e.pointerType !== 'mouse' && l && l.scrollHeight > l.clientHeight + 1;
    g = { id: e.pointerId, target: e.target, y0: e.clientY, t0: performance.now(), p0: p, moved: false, list: inList, hist: [[performance.now(), e.clientY]] };
    if (!inList) lock.setPointerCapture(e.pointerId);
  });
  lock.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    const dy = (g.y0 - e.clientY) / scaleK();
    if (Math.abs(dy) > 6) g.moved = true;
    if (g.list) return;
    const H = screen.offsetHeight * .5;                     // 拖半屏 = 完全解锁
    let v = g.p0 + dy / H;
    if (v < 0) v = v * .25;                                 // 往下拉：带阻尼，只动一点
    setP(Math.max(-.06, Math.min(1, v)));
    g.hist.push([performance.now(), e.clientY]); if (g.hist.length > 5) g.hist.shift();
  });
  const release = e => {
    if (!g || e.pointerId !== g.id) return;
    const gg = g; g = null;
    const [t1, y1] = gg.hist[0], dt = performance.now() - t1;
    const vel = dt > 0 ? (y1 - e.clientY) / scaleK() / dt : 0;  // 像素/毫秒，向上为正
    const quick = !gg.moved && performance.now() - gg.t0 < 400;
    if (e.type === 'pointercancel') { if (!gg.list) tween(0, 380, easeBack); return; }
    if (gg.list) { if (quick) tapAt(gg.target); return; }
    if (quick) { setP(0); tapAt(gg.target); return; }
    if (p > .32 || vel > .45) unlock();
    else tween(0, 380 + 200 * Math.max(0, p), easeBack, () => p === 0 && bump());
  };
  lock.addEventListener('pointerup', release);
  lock.addEventListener('pointercancel', release);
  // 键盘：锁屏本身按回车/空格解锁；焦点在“展开 / 收起”按钮上时按回车切换
  lock.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (e.target.closest('[data-note="fold"]')) toggleNotes(!opt.open); else unlock();
  });

  // 桌面示意：轻点状态栏回到锁屏；轻点图标只提示这是示意
  $('#statusbar').addEventListener('click', relock);
  desk.addEventListener('click', e => {
    const a = e.target.closest('[data-app]'); if (a) toast(`这是衔接示意，「${a.dataset.app}」不在原型里打开`);
  });

  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === 'l' || e.key === 'L') relock();
    if (e.key === 'r' || e.key === 'R') startBoot();
    if (e.key === ' ' && state === 'lock' && !lock.contains(document.activeElement)) { e.preventDefault(); unlock(); }
  });

  /* —— 控制面板 —— */
  const panel = $('.panel');
  const COUNTS = [0, 1, 2, 4, 6];
  function syncPanel(){
    panel.querySelector('[data-act="count"]').textContent = `通知条数：${opt.count}`;
    const fold = panel.querySelector('[data-act="fold"]');
    fold.textContent = `多条通知：${opt.open ? '展开' : '收起'}`; fold.disabled = opt.count < 2;
    panel.querySelector('[data-act="hold"]').textContent = `启动画面：${hold ? '停住（可点星点）' : '自动进入锁屏'}`;
    panel.querySelector('[data-act="privacy"]').textContent = `锁屏预览：${opt.privacy ? '隐藏内容' : '显示内容'}`;
  }
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'toggle') { b.setAttribute('aria-expanded', panel.classList.toggle('open')); return; }
    panel.classList.remove('open'); panel.querySelector('.panel-toggle').setAttribute('aria-expanded', 'false');
    if (a === 'boot') startBoot();
    if (a === 'lock') { if (state === 'desk') relock(); else if (state === 'boot') showLock(); }
    if (a === 'hold') { hold = !hold; syncPanel(); if (hold) { if (state !== 'boot') startBoot(); else clearTimeout(bootT); } else armBoot(1200); }
    if (a === 'theme') { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; b.textContent = root.dataset.theme === 'dark' ? '切换浅色' : '切换深色'; }
    if (a === 'motion') { root.dataset.motion = reduced() ? 'full' : 'reduce'; b.textContent = '减少动效：' + (root.dataset.motion === 'reduce' ? '开' : '关'); }
    if (a === 'count') { opt.count = COUNTS[(COUNTS.indexOf(opt.count) + 1) % COUNTS.length]; renderNotes(); syncPanel(); }
    if (a === 'fold') toggleNotes(!opt.open);
    if (a === 'privacy') { opt.privacy = !opt.privacy; renderNotes(); syncPanel(); }
  });

  /* —— 电脑上外框按窗口高度缩放 —— */
  const embed = new URLSearchParams(location.search).has('embed');   // 嵌在字体对比页里：不留边
  if (embed) root.classList.add('embed');
  const fit = () => {
    const m = embed ? 0 : 32, s = Math.min(1, (innerHeight - m) / 864, (innerWidth - m) / 410);
    $('#device').style.setProperty('--fit', s.toFixed(3));
  };
  addEventListener('resize', fit); fit();

  // 截图工具用：?at=lock / ?at=desk / ?at=boot（静止帧）/ ?hold=1（停在启动画面可互动）；?theme=dark；?notes=4&open=0&privacy=1；?tw=200（时间字重，对比用）
  const q = new URLSearchParams(location.search);
  if (q.get('theme') === 'dark') root.dataset.theme = 'dark';
  if (q.get('motion') === 'reduce') root.dataset.motion = 'reduce';
  if (q.get('clean')) root.classList.add('clean');
  if (q.get('tw')) root.style.setProperty('--time-w', +q.get('tw') || 500);
  if (q.has('notes')) opt.count = Math.max(0, Math.min(DEMO_NOTES.length, +q.get('notes') || 0));
  opt.open = q.get('open') !== '0'; opt.privacy = q.get('privacy') === '1';
  renderNotes(); syncPanel();

  // 字体对比页传来的本机字体：只在这个页面内存里用，不上传、不保存；scope = time（时间和日期）/ all（锁屏全部文字）
  let testFace = null;
  addEventListener('message', async e => {
    const m = e.data; if (!m || m.type !== 'test-font') return;
    root.classList.remove('font-time', 'font-all');
    if (m.buf) {
      if (testFace) document.fonts.delete(testFace);
      testFace = new FontFace('ProtoTestFont', m.buf); await testFace.load(); document.fonts.add(testFace);
    }
    if (testFace && m.scope) root.classList.add('font-' + m.scope);
    requestAnimationFrame(fadeEdges);
    parent.postMessage({ type: 'test-font-ready' }, '*');
  });
  window.proto = { get state(){ return state; }, get p(){ return p; }, get notes(){ return { ...opt }; }, startBoot, showLock, unlock, relock, setP, toggleNotes };
  if (q.get('at') === 'lock') { boot.hidden = true; state = 'lock'; }
  else if (q.get('at') === 'desk') { boot.hidden = true; setP(1); state = 'desk'; toDeskState(true); }
  else if (q.get('at') === 'boot') { boot.classList.add('play', 'still'); sky.draw(); }
  else { hold = q.get('hold') === '1'; syncPanel(); startBoot(); }
})();
