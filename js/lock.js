/* 启动画面 + 锁屏（由 prototypes/boot-lock v3 预览整合）
   状态：boot（启动中）→ lock（锁屏）→ unlocking → open（桌面 / 应用可用）
   解锁进度 --p 从 0 到 1 写在 .screen 上：手指拖动时实时跟手，松手后按距离和速度决定解锁还是弹回
   通知：XS.notes 是锁屏通知的统一入口（内存里，刷新即清空）；应用调用 XS.notes.add() 推送 */
(function(){
  const $ = s => document.querySelector(s);
  const root = document.documentElement, screen = $('.screen');
  const ls = $('.lockscreen'), lock = $('.lk-main'), boot = $('.boot'), notesEl = $('.lk-notes');
  const layers = ['.layer-home', '.layer-apps', '.layer-overlay'].map($);
  const esc = XS.esc;
  const reduced = () => root.dataset.motion === 'reduce';
  const scaleK = () => XS.frameScale || 1;
  let state = 'boot', p = 0, anim = 0, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, reduced() ? Math.min(ms, 160) : ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  /* —— 通知状态 ——
     { id, app, kind:'message'|'app', contact:{id,name}, title, text, at }
     kind 为 message 时显示联系人头像；app 为 XS.apps 里的应用 id */
  let notes = [];
  XS.notes = {
    list: () => notes.slice(),
    add(n){
      const it = { kind: 'app', ...n, id: n.id || XS.uid('n'), at: n.at || Date.now() };
      notes = [it, ...notes.filter(x => x.id !== it.id)]; XS.emit('notes'); return it.id;
    },
    remove(id){ notes = notes.filter(x => x.id !== id); XS.emit('notes'); },
    clear(){ notes = []; XS.emit('notes'); }
  };

  /* —— 启动画面：手写项目名（矢量路径）+ 画布星点 ——
     星点：少量、大小不一、很淡，缓慢往下飘并轻微左右摆；位置用固定种子生成
     轻点空白处：附近星点亮一下、往外散开并淡出，再从顶上慢慢补回来；中心有一小圈柔光和几粒碎光
     手指移动：附近星点被极轻地带一下，松手后自己回去
     减少动态效果：只画一帧静止的星点，不飘、不闪 */
  const nameSvg = boot.querySelector('.boot-name');
  nameSvg.setAttribute('viewBox', BRAND_NAME.viewBox);
  nameSvg.querySelector('path').setAttribute('d', BRAND_NAME.d);
  const sky = (function(){
    const cv = boot.querySelector('.boot-stars'), g = cv.getContext('2d');
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
    const readTones = () => { const cs = getComputedStyle(boot); tones = [1, 2, 3, 4].map(k => cs.getPropertyValue('--star-' + k).trim()); };
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
    new MutationObserver(() => { readTones(); stop(); if (state === 'boot') start(); }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
    size();
    return { start, stop, tap, local, draw, follow: p => { finger = p; }, get count(){ return stars.filter(s => !s.gone).length; } };
  })();

  /* —— 锁屏时间：每秒检查，分钟变了才更新；通知的“几分钟前”跟着刷新 —— */
  const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  let lastMin = '';
  function tick(){
    const d = new Date(), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    if (hh + mm === lastMin) return; lastMin = hh + mm;
    lock.querySelector('[data-clock="big"]').innerHTML = `${hh}<span class="colon">:</span>${mm}`;
    lock.querySelector('[data-clock="md"]').textContent = `${d.getMonth() + 1}月${d.getDate()}日`;
    lock.querySelector('[data-clock="w"]').textContent = WEEK[d.getDay()];
    notesEl.querySelectorAll('time[data-at]').forEach(t => { t.textContent = ago(+t.dataset.at); });
  }

  /* —— 锁屏通知 ——
     一条：只显示这一张完整的卡，没有标题栏
     多条：顶上“通知 · N 条”+ 展开 / 收起；展开 = 每条一张独立的卡排成一列（默认），收起 = 只留最新一张
     放不下时列表自己滚动，底部“上滑解锁”固定不动
     轻点某条 = 解锁后打开对应应用；收起时轻点那一张 = 展开 */
  let open = true;
  const ago = at => { const m = Math.floor((Date.now() - at) / 60000); return m <= 0 ? '现在' : m < 60 ? `${m} 分钟前` : `${Math.floor(m / 60)} 小时前`; };
  const AV_TONES = [['#F4D6E2', '#E3D9F4'], ['#D8E6F3', '#DCEFE8'], ['#F3E3D2', '#F4D6E2'], ['#E3D9F4', '#D8E6F3']];
  const avatar = c => {
    let h = 0; for (const ch of String(c.id || c.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const [a, b] = AV_TONES[h % AV_TONES.length];
    return `<span class="n-avatar" style="--a:${a};--b:${b}">${esc(String(c.name).trim().slice(0, 1).toUpperCase())}</span>`;
  };
  function card(n, i){
    const app = XS.apps[n.app] || { name: '通知', icon: 'settings', variant: 'ai-gray' };
    const msg = n.kind === 'message' && n.contact;
    const appIcon = cls => `<span class="app-icon ${app.variant} ${cls}">${XS.appIcons[app.icon] || ''}</span>`;
    const pic = msg ? `<span class="n-pic">${avatar(n.contact)}${appIcon('n-badge')}</span>` : `<span class="n-pic">${appIcon('n-appicon')}</span>`;
    const head = msg ? n.contact.name : app.name;
    const label = msg ? `${app.name}，${n.contact.name}：${n.text}` : `${app.name}，${n.title || ''} ${n.text || ''}`;
    return `<article class="lk-note" style="--k:${i}" data-id="${esc(n.id)}" aria-label="${esc(label)}，${ago(n.at)}">
      ${pic}<div class="n-text"><div class="n-head"><b>${esc(head)}</b><time data-at="${+n.at}">${ago(n.at)}</time></div>
      ${msg ? `<p class="n-line">${esc(n.text)}</p>` : `${n.title ? `<p class="n-title">${esc(n.title)}</p>` : ''}${n.text ? `<p class="n-line">${esc(n.text)}</p>` : ''}`}</div></article>`;
  }
  function renderNotes(){
    // FLIP：记下旧位置，重新排版后从旧位置滑到新位置（展开、收起、新通知都用这一套）
    const before = {};
    notesEl.querySelectorAll('.lk-note').forEach(c => { before[c.dataset.id] = c.getBoundingClientRect().top; });
    const list = notes, multi = list.length > 1, shownAll = !multi || open;
    const shown = shownAll ? list : list.slice(0, 1);
    notesEl.className = 'lk-notes' + (!multi ? ' is-single' : shownAll ? ' is-open' : ' is-folded');
    notesEl.hidden = !list.length;
    notesEl.innerHTML = !list.length ? '' :
      (multi ? `<div class="n-bar"><span>通知 · ${list.length} 条</span>` +
        `<button class="n-fold" data-note="fold" aria-expanded="${shownAll}">${shownAll ? '收起' : '展开'}</button></div>` : '') +
      `<div class="n-list">${shown.map(card).join('')}</div>`;
    fadeEdges();
    if (reduced() || state !== 'lock' || !Object.keys(before).length) return;
    const k = scaleK();
    notesEl.querySelectorAll('.lk-note').forEach(c => {
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
  const toggleNotes = v => { open = v; renderNotes(); };
  XS.on('notes', renderNotes);

  /* —— 进度和状态 —— */
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
  // 锁着时桌面、应用、弹层都不能被点到或用键盘聚焦
  function setState(s){
    state = s; screen.dataset.lock = s;
    const opened = s === 'open';
    layers.forEach(l => { l.inert = !opened; });
    ls.inert = opened;
  }

  /* —— 启动 → 锁屏 —— */
  // 启动画面停留约 2.8 秒；手指在屏上玩星点时不自动走，松手后再等一会儿
  const BOOT_MS = 2800;
  let bootT = 0, bootAt = 0, bootG = null;
  const armBoot = ms => { clearTimeout(bootT); if (state === 'boot') bootT = setTimeout(showLock, reduced() ? Math.min(ms, 600) : ms); };
  function playBoot(){
    clearTimers(); cancelAnimationFrame(anim); clearTimeout(bootT);
    setState('boot'); setP(0); bootAt = performance.now();
    screen.classList.remove('lock-enter'); lock.classList.remove('opened');
    boot.hidden = false; boot.className = 'boot';
    void boot.offsetWidth;                      // 重新触发动画
    boot.classList.add('play');
    sky.start();
    armBoot(BOOT_MS);
  }
  function showLock(){
    if (state !== 'boot') return;
    clearTimers(); clearTimeout(bootT); setState('lock');
    boot.classList.add('leave');
    screen.classList.add('lock-enter');
    later(() => { boot.hidden = true; boot.className = 'boot'; sky.stop(); sky.follow(null); }, 900);
    later(() => screen.classList.remove('lock-enter'), 1150);
    lock.focus({ preventScroll: true });
  }
  // 启动画面：轻点空白处 = 星点闪一下；手指移动 = 星点极轻地跟一下；轻点图标或名字 = 跳过（至少先让图标出现）
  boot.addEventListener('pointerdown', e => {
    if (state !== 'boot') return;
    if (e.target.closest('.boot-mark,.boot-name')) { if (performance.now() - bootAt > 500) showLock(); return; }
    clearTimeout(bootT);
    bootG = { id: e.pointerId, p: sky.local(e), moved: false };
    try { boot.setPointerCapture(e.pointerId); } catch (_) {}
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

  /* —— 锁屏密码（js/passcode.js）——
     开了密码时，所有解锁入口（上滑、轻点、回车、通知、XS.lock.unlock）都先到这里输密码；
     只有验证通过（passed）才真正执行 unlock。锁着时桌面不跟手露出，只有壁纸和键盘。 */
  let passed = false, codeEl = null, codePad = null, pending = null;
  const needCode = () => XS.passcode && XS.passcode.enabled() && !passed;
  const syncCode = () => { screen.classList.toggle('need-code', !!needCode()); };
  function askCode(after){
    pending = after || null;
    if (codeEl) { codePad.focus(); return; }
    codePad = XS.passcode.pad({ title: '输入密码', len: XS.passcode.length(), onDone: checkCode, onCancel: cancelCode });
    codeEl = document.createElement('div'); codeEl.className = 'lk-code';
    codeEl.appendChild(codePad.el);
    ls.appendChild(codeEl);
    lock.inert = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (codeEl) codeEl.classList.add('show'); }));
    setTimeout(() => codePad && codePad.focus(), 60);
  }
  async function checkCode(code){
    const r = await XS.passcode.verify(code);
    if (!codeEl) return;
    if (!r.ok) { codePad.fail(XS.passcode.failText(r)); return; }
    passed = true; syncCode();
    const after = pending; pending = null;
    codeEl.classList.add('passed');
    unlock(0, after);
  }
  function closeCode(){
    if (!codeEl) return;
    const el = codeEl; codePad.destroy(); codeEl = codePad = null;
    el.classList.remove('show');
    setTimeout(() => el.remove(), reduced() ? 0 : 320);
    lock.inert = false;
  }
  function cancelCode(){
    if (!codeEl || passed) return;
    pending = null; closeCode(); lock.focus({ preventScroll: true });
  }

  /* —— 锁屏 ⇄ 桌面 —— */
  function unlock(fromP, after){
    if (state !== 'lock') return;
    if (needCode()) { tween(0, 200, easePage); askCode(after); return; }
    setState('unlocking'); lock.classList.add('opened');
    const rest = 1 - (fromP ?? p);
    tween(1, 260 + 360 * rest, easePage, () => {
      setState('open'); screen.style.removeProperty('--p');
      closeCode();
      XS.emit('unlocked');
      after && after();
    });
  }
  function relock(){
    if (state !== 'open') return;
    passed = false; syncCode();
    setP(1); setState('locking'); lock.classList.remove('opened');
    open = true; renderNotes();
    tween(0, 420, easePage, () => { setState('lock'); lock.focus({ preventScroll: true }); });
  }
  /* 旧的「自动锁定」（切到后台一段时间后自动锁屏）已移除：切走再回来不会锁屏。
     开了密码时，只有刷新 / 重新打开页面或手动锁屏后，解锁才需要输入密码。 */
  XS.on('passcode', syncCode);
  function bump(){
    lock.classList.remove('bump'); void lock.offsetWidth; lock.classList.add('bump');
    setTimeout(() => lock.classList.remove('bump'), 450);
  }
  // 解锁后打开通知对应的应用；聊天消息再进入对应联系人的对话
  async function openNote(n){
    XS.notes.remove(n.id);
    const app = XS.apps[n.app];
    if (!app || XS.nav.depth()) return;
    const icon = document.querySelector(`.layer-home [data-app="${n.app}"]`);
    await XS.nav.openApp(n.app, icon);
    if (n.kind === 'message' && n.contact && XS.chat && XS.chat.contact(n.contact.id) && XS.nav.depth() === 1)
      XS.nav.push(XS.chat.openConv(n.contact.id));
  }
  // 轻点：收起时的通知 → 展开；“展开 / 收起”按钮 → 切换；展开后的某条 → 解锁并打开对应应用；空白 → 解锁
  function tapAt(target){
    if (target.closest('[data-note="fold"]')) { toggleNotes(!open); return; }
    const card = target.closest('.lk-note');
    if (card && notesEl.classList.contains('is-folded')) { toggleNotes(true); return; }
    if (card) { const n = notes.find(x => x.id === card.dataset.id); if (n) { unlock(0, () => openNote(n)); return; } }
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
    if (!inList) try { lock.setPointerCapture(e.pointerId); } catch (_) {}
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
  // 键盘：锁屏本身按回车 / 空格解锁；焦点在“展开 / 收起”按钮上时切换
  lock.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (e.target.closest('[data-note="fold"]')) toggleNotes(!open); else unlock();
  });

  // 解锁后再做的事（更新通知、提示条等）：已解锁就立刻执行，否则等这一次解锁
  const whenOpen = fn => {
    if (state === 'open') { fn(); return; }
    const off = XS.on('unlocked', () => { off(); fn(); });
  };
  XS.lock = { start: playBoot, unlock: () => { if (state === 'boot') showLock(); unlock(); }, relock, whenOpen, get state(){ return state; } };

  tick(); setInterval(tick, 1000);
  renderNotes(); syncCode();
  // 仅用于检查多条通知的排版：地址加 ?demo-notes=N 时载入演示通知（js/lock-demo.js），正常打开不会出现
  const demo = new URLSearchParams(location.search).get('demo-notes');
  if (demo != null) { const s = document.createElement('script'); s.src = 'js/lock-demo.js'; s.dataset.count = demo; document.body.appendChild(s); }
})();
