/* 应用登记 + 桌面（分页格子、小组件、Dock、长按编辑与拖动）
   每个应用在自己的文件里补上 mount()；没有 mount 的应用点开会提示「暂未开放」
   桌面布局保存在 xs.v1.home：{ v, pages: [[格子项]], dock: [应用 id] }
   格子项：{ t:'app', id, c, r } 或 { t:'w', id, kind, c, r, w, h }（c 列、r 行，从 0 开始） */
(function(){
  XS.apps = {
    chat:     { id: 'chat',     name: '聊天',    icon: 'chat',     variant: 'ai-dark',  dock: true },
    settings: { id: 'settings', name: '设置',    icon: 'settings', variant: 'ai-gray',  dock: true },
    charhall: { id: 'charhall', name: 'Char 馆', icon: 'char',     variant: 'ai-light' },
    photos:   { id: 'photos',   name: '相册',    icon: 'photos',   variant: 'ai-light' },
    camera:   { id: 'camera',   name: '相机',    icon: 'camera',   variant: 'ai-dark' },
    music:    { id: 'music',    name: '音乐',    icon: 'music',    variant: 'ai-light' },
    notes:    { id: 'notes',    name: '备忘录',  icon: 'notes',    variant: 'ai-light' },
    calendar: { id: 'calendar', name: '日历',    icon: 'calendar', variant: 'ai-light' },
    weather:  { id: 'weather',  name: '天气',    icon: 'weather',  variant: 'ai-light' },
    maps:     { id: 'maps',     name: '地图',    icon: 'maps',     variant: 'ai-light' },
    browser:  { id: 'browser',  name: '浏览器',  icon: 'browser',  variant: 'ai-light' },
    files:    { id: 'files',    name: '文件',    icon: 'files',    variant: 'ai-light' },
    wallet:   { id: 'wallet',   name: '钱包',    icon: 'wallet',   variant: 'ai-light' },
    messages: { id: 'messages', name: '短信',    icon: 'messages', variant: 'ai-light' },
    phone:    { id: 'phone',    name: '电话',    icon: 'phone',    variant: 'ai-light' },
    library:  { id: 'library',  name: '书房',    icon: 'library',  variant: 'ai-light' }
  };

  const COLS = 4, DOCK_MAX = 4, KEY = 'home', HOLD_MS = 450;
  // 小组件模板（外观、字段、可选尺寸）在 js/apps/home-widgets.js
  const WIDGETS = XS.widgets.kinds;
  const CSS_MAX = 4000;
  const cleanCfg = (kind, c) => XS.widgets.clean(kind, c);
  const sizeOk = (kind, w, h) => WIDGETS[kind].sizes.some(s => s[0] === w && s[1] === h);
  // 自定义 CSS 的括号必须配平，否则会跑出这个小组件的作用范围
  function cssBalanced(s){
    s = s.replace(/\/\*[\s\S]*?(\*\/|$)/g, '').replace(/"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/g, '""');
    let d = 0;
    for (const ch of s) { if (ch === '{') d++; else if (ch === '}' && --d < 0) return false; }
    return d === 0 && !/<\/?style/i.test(s);
  }
  const wcls = id => 'wc-' + String(id).replace(/[^\w-]/g, '_');
  const esc = XS.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const scale = () => XS.frameScale || 1;
  const reduced = () => document.documentElement.dataset.motion === 'reduce';

  let L = null;          // 当前布局
  let rows = 6;          // 当前屏幕能放下的行数（随窗口变化）
  let M = {};            // 格子尺寸：colW / cellH / gap / padX / wmx
  let root = null, pagesEl = null, dockEl = null, dotsEl = null;
  let editing = false, press = null, drag = null, suppress = false;
  // 长按/拖动后只吞掉紧跟着的那一次 click；click 在 pointerup 之后同步派发，
  // 所以下一个宏任务就清掉，避免残留标记吞掉之后的键盘或点击操作
  const releaseSuppress = () => setTimeout(() => { suppress = false; }, 0);

  /* ---------- 布局数据 ---------- */
  // 默认桌面：第一屏 = 一行日期时间 + 4×2 人物卡 + 2×2 拍立得 / 音乐 + 一行常用应用；其余应用放第二页
  // 按当前能放下的行数取舍，矮屏幕先去掉时间行和音乐卡，保证常用图标留在第一页
  const DEF_APPS = ['charhall', 'photos', 'notes', 'calendar'];
  function defaults(n = rows){
    const w = (kind, c, r, w, h) => ({ t: 'w', id: 'w_' + kind, kind, c, r, w, h });
    const p1 = [], top = n >= 6 ? 1 : 0;
    if (top) p1.push(w('time', 0, 0, 4, 1));
    p1.push(w('profile', 0, top, 4, 2));
    let r = top + 2, rest = [];
    if (n - r >= 3) { p1.push(w('polaroid', 0, r, 2, 2), w('music', 2, r, 2, 2)); r += 2; }
    else rest.push(w('polaroid', 0, 2, 2, 2), w('music', 2, 2, 2, 2));
    const apps = DEF_APPS.filter(id => XS.apps[id]);
    apps.forEach((id, i) => p1.push({ t: 'app', id, c: i, r }));
    const p2 = [w('chat', 0, 0, 4, 1), w('note', 0, 1, 4, 1)];
    return { v: 1, pages: [p1, p2.concat(rest)], dock: Object.values(XS.apps).filter(a => a.dock).map(a => a.id) };
  }
  // 文件夹：{ t:'f', id, name, apps:[应用 id，按顺序], c, r, w, h }，第一批支持 1×1、2×1、2×2
  const FSIZES = [[1, 1], [2, 1], [2, 2]];
  const MERGE_MS = 1800;   // 拖到另一个图标正中心停这么久才出现合并预览
  const size = it => it.t === 'app' ? [1, 1] : [it.w, it.h];
  const removeFrom = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); };
  const clone = o => o == null ? null : JSON.parse(JSON.stringify(o));
  // base = 已保存的布局；每次渲染都从它重新整理出 L，窗口暂时变矮时挪动的位置不会写回
  let base = null;
  // 写入失败（多半是图片撑满了存储）时不更新 base，下次渲染会回到上一次保存的样子
  const save = () => { if (!XS.store.set(KEY, L)) return false; base = clone(L); return true; };
  const getRemovedApps = () => new Set(XS.store.get('home.removedApps', []));
  const markRemoved = id => { const s = getRemovedApps(); s.add(id); XS.store.set('home.removedApps', [...s]); };
  const unmarkRemoved = id => { const s = getRemovedApps(); s.delete(id); XS.store.set('home.removedApps', [...s]); };

  // 这一块（c, r, w, h）是否在范围内且没有和其他项重叠
  function fits(items, c, r, w, h, exclude){
    if (c < 0 || r < 0 || c + w > COLS || r + h > rows) return false;
    return items.every(it => {
      if (it === exclude) return true;
      const [iw, ih] = size(it);
      return c + w <= it.c || it.c + iw <= c || r + h <= it.r || it.r + ih <= r;
    });
  }
  const occupantAt = (items, c, r, exclude) => items.find(it => {
    if (it === exclude) return false;
    const [w, h] = size(it);
    return c >= it.c && c < it.c + w && r >= it.r && r < it.r + h;
  });
  // 找空位；给了 near 就找离它最近的
  function findFree(items, w, h, exclude, near){
    let best = null, bd = Infinity;
    for (let r = 0; r + h <= rows; r++) for (let c = 0; c + w <= COLS; c++) {
      if (!fits(items, c, r, w, h, exclude)) continue;
      if (!near) return { c, r };
      const d = (c - near.c) ** 2 + (r - near.r) ** 2;
      if (d < bd) { bd = d; best = { c, r }; }
    }
    return best;
  }
  // 从 start 页往后找能放下的位置；都放不下就新开一页
  function placeAnywhere(it, start){
    const [w, h] = size(it);
    for (let p = start; p < L.pages.length; p++) {
      const f = findFree(L.pages[p], w, h);
      if (f) { Object.assign(it, f); L.pages[p].push(it); return p; }
    }
    if (w > COLS || h > rows) return -1;
    it.c = 0; it.r = 0; L.pages.push([it]);
    return L.pages.length - 1;
  }
  function sanitize(o){
    if (!o || typeof o !== 'object') return null;
    const c = Math.max(0, o.c | 0), r = Math.max(0, o.r | 0);
    if (o.t === 'app') return XS.apps[o.id] ? { t: 'app', id: o.id, c, r } : null;
    if (o.t === 'f') {
      const apps = (Array.isArray(o.apps) ? o.apps : []).filter((id, i, a) => XS.apps[id] && a.indexOf(id) === i);
      const sz = FSIZES.find(s => s[0] === o.w && s[1] === o.h) || FSIZES[0];
      return { t: 'f', id: String(o.id || XS.uid('f')), name: String(o.name || '').trim().slice(0, 16) || '文件夹', apps, c, r, w: sz[0], h: sz[1] };
    }
    const k = WIDGETS[o.kind];
    if (o.t === 'w' && k) {
      const sz = sizeOk(o.kind, o.w, o.h) ? [o.w, o.h] : k.sizes[0];
      const it = { t: 'w', id: String(o.id || XS.uid('w')), kind: o.kind, c, r, w: sz[0], h: sz[1] };
      const cfg = cleanCfg(o.kind, o.cfg);
      if (cfg) it.cfg = cfg;
      return it;
    }
    return null;
  }
  // 读取后整理：去掉未知应用、重复项、重叠项；超出当前行数的挪到空位；漏掉的应用补回桌面
  function normalize(){
    // 没有保存过布局才用默认桌面；默认桌面里没排到的应用放第二页起，不堆满第一屏
    const fresh = !L || !Array.isArray(L.pages);
    if (fresh) L = defaults();
    const seen = new Set();
    L.dock = (Array.isArray(L.dock) ? L.dock : []).filter((id, i, a) => XS.apps[id] && a.indexOf(id) === i).slice(0, DOCK_MAX);
    L.dock.forEach(id => seen.add(id));
    const overflow = [], wids = new Set();
    L.pages = L.pages.map(items => {
      const out = [];
      (Array.isArray(items) ? items : []).forEach(raw => {
        let it = sanitize(raw);
        if (!it) return;
        if (it.t === 'f') {
          it.apps = it.apps.filter(id => !seen.has(id));
          if (!it.apps.length) return;
          // 只剩一个应用：文件夹自动解散，图标回到文件夹原来的位置
          if (it.apps.length === 1) it = { t: 'app', id: it.apps[0], c: it.c, r: it.r };
          else it.apps.forEach(id => seen.add(id));
        }
        if (it.t === 'app') { if (seen.has(it.id)) return; seen.add(it.id); }
        else { if (wids.has(it.id)) it.id = XS.uid(it.t); wids.add(it.id); }
        const [w, h] = size(it);
        fits(out, it.c, it.r, w, h) ? out.push(it) : overflow.push(it);
      });
      return out;
    });
    const removed = getRemovedApps();
    Object.keys(XS.apps).forEach(id => { if (!seen.has(id) && !removed.has(id)) overflow.push({ t: 'app', id, c: 0, r: 0 }); });
    if (!L.pages.length) L.pages.push([]);
    overflow.forEach(it => placeAnywhere(it, fresh && it.t === 'app' ? Math.min(1, L.pages.length - 1) : 0));
    L.pages = L.pages.filter(p => p.length);
    if (!L.pages.length) L.pages.push([]);
    L.v = 1;
  }

  /* ---------- 渲染 ---------- */
  const appBtn = (a, key, style='') => `<button class="app tap" data-app="${a.id}" data-key="${key}" aria-label="${esc(a.name)}"${style ? ` style="${style}"` : ''}>
    <span class="app-icon ${a.variant}">${XS.appIcons[a.icon]}</span><span class="app-label">${esc(a.name)}</span>
    <span class="app-del" role="button" data-appdel="${a.id}" aria-label="从桌面移除${esc(a.name)}">${XS.icon('close')}</span></button>`;
  // 小组件外壳：preview 为 true 时用于编辑面板 / 选择器里的实时预览（不带网格位置和删除键）
  // 背景图只有旧版时钟 / 日历走 CSS 变量；其余图片由模板直接放 <img>
  function widgetHtml(it, preview){
    const cfg = it.cfg || {}, k = WIDGETS[it.kind], bg = k.legacy && cfg.img;
    const cls = `widget wk-${it.kind} ws-${it.w}x${it.h} ${preview ? 'wc-preview' : wcls(it.id)}${bg ? ' has-img' : ''}${cfg.style ? ' wt-' + cfg.style : ''}`;
    const style = (preview ? '' : `grid-column:${it.c + 1} / span ${it.w};grid-row:${it.r + 1} / span ${it.h};`)
      + (bg ? `--w-img:url(&quot;${esc(cfg.img)}&quot;);` : '');
    return `<div class="${cls}"${preview ? '' : ` data-w="${esc(it.id)}"`} role="group" aria-label="${k.name}小组件${preview ? '预览' : ''}"${style ? ` style="${style}"` : ''}>
    ${preview ? '' : `<button class="w-del tap" data-del="${esc(it.id)}" aria-label="移除${k.name}小组件">${XS.icon('close')}</button>`}${k.body(cfg)}</div>`;
  }
  // 旧版小组件的两行自定义文字；没填的位置由时钟每分钟刷新
  function fillLines(el, cfg){
    if (!el) return;
    el.querySelectorAll('[data-line]').forEach(n => {
      const v = cfg && cfg['l' + n.dataset.line];
      if (v) { n.textContent = v; n.dataset.fixed = ''; } else delete n.dataset.fixed;
    });
  }
  // 每个小组件的自定义 CSS 限定在自己的 class 里（用 CSS 嵌套），通过 textContent 写入，不会注入标签
  const scopedCss = (sel, css) => css && cssBalanced(css) ? `${sel}${sel}{${css}\n}\n` : '';
  function applyWidgetCss(){
    let st = $('style[data-wcss]', root);
    if (!st) { st = document.createElement('style'); st.dataset.wcss = ''; root.appendChild(st); }
    st.textContent = L.pages.flat().filter(it => it.t === 'w' && it.cfg && it.cfg.css).map(it => scopedCss('.' + wcls(it.id), it.cfg.css)).join('');
  }

  // 当前页是一份独立状态：只有用户翻页（滚动停在新页）或显式跳页才改它；
  // 弹窗关闭、重新渲染、窗口变宽变窄时 scrollLeft 会被浏览器夹住或取整，不能再反推页码
  let cur = 0, pageW = 0;
  const curPage = () => cur;
  const setPage = (p, smooth) => {
    cur = Math.max(0, Math.min(L ? L.pages.length - 1 : 0, p | 0));
    pagesEl.scrollTo({ left: cur * pagesEl.clientWidth, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  };
  const gridOf = p => pagesEl.children[p] && pagesEl.children[p].firstElementChild;
  // 文件夹：1×1 是图标大小的方块 + 名称，里面 3×3 小缩略图；2×1 / 2×2 只放装得下的真实 App（可直接点开），
  // 不画 +N、箭头或把手；点空白处或名称展开看全部
  const miniIcon = id => { const a = XS.apps[id]; return `<span class="app-icon ${a.variant}">${XS.appIcons[a.icon]}</span>`; };
  function folderHtml(it){
    const big = it.w > 1, shown = it.apps.slice(0, big ? it.w * it.h : 9);
    const inner = big
      ? shown.map(id => `<button class="f-app tap" data-fapp="${id}" aria-label="${esc(XS.apps[id].name)}">${miniIcon(id)}</button>`).join('')
      : shown.map(id => `<span class="f-mini">${miniIcon(id)}</span>`).join('');
    return `<div class="folder fs-${it.w}x${it.h}" data-f="${esc(it.id)}" role="group" aria-label="文件夹 ${esc(it.name)}，${it.apps.length} 个应用"
      style="grid-column:${it.c + 1} / span ${it.w};grid-row:${it.r + 1} / span ${it.h}">
      <div class="f-box tap" role="button" tabindex="0" data-fopen="${esc(it.id)}" aria-label="打开文件夹 ${esc(it.name)}">${inner}</div>
      <button class="f-name tap" data-fopen="${esc(it.id)}">${esc(it.name)}</button></div>`;
  }
  // 编辑模式下的尺寸热区：文件夹方块右下角一块（不画出来），从这里拖动是调尺寸
  const inResizeZone = (box, x, y) => {
    const r = box.getBoundingClientRect(), z = Math.max(22 * scale(), Math.min(r.width, r.height) * .3);
    return x >= r.right - z && x <= r.right + 8 * scale() && y >= r.bottom - z && y <= r.bottom + 8 * scale();
  };
  const pageHtml = (items, p) => `<div class="home-page" data-page="${p}"><div class="home-grid">${items.map(it => it.t === 'app'
    ? appBtn(XS.apps[it.id], 'app:' + it.id, `grid-column:${it.c + 1};grid-row:${it.r + 1}`) : it.t === 'f' ? folderHtml(it) : widgetHtml(it)).join('')}</div></div>`;

  // 按可用高度算行数，并把剩余高度平均分给行间距，让每一页的格子都铺满、对齐
  function measure(){
    const cs = getComputedStyle(root);
    let cellH = parseFloat(cs.getPropertyValue('--cell-h')) || 84;
    const cellMin = parseFloat(cs.getPropertyValue('--cell-h-min')) || cellH;
    const minGap = parseFloat(cs.getPropertyValue('--grid-gap-min')) || 14;
    const padX = parseFloat(cs.getPropertyValue('--grid-px')) || 14;
    const icon = parseFloat(cs.getPropertyValue('--app-icon')) || 60;
    const H = pagesEl.clientHeight, W = pagesEl.clientWidth;
    if (!H || !W) return false;   // 还没排版（页面隐藏中）：先不算，等 ResizeObserver 有了尺寸再渲染
    rows = Math.max(3, Math.min(7, Math.floor((H + minGap) / (cellH + minGap))));
    // 矮屏只差一点就能多放一行时，把格子压矮一些（不低于 --cell-h-min），第一屏的应用不被挤到第二页
    const more = Math.min(7, Math.floor((H + minGap) / (cellMin + minGap)));
    if (more > rows) { rows = more; cellH = Math.floor((H - (rows - 1) * minGap) / rows); }
    root.style.setProperty('--cell-live', cellH + 'px');
    const gap = rows > 1 ? Math.min(40, Math.max(minGap, (H - rows * cellH) / (rows - 1))) : 0;
    const colW = (W - padX * 2) / COLS;
    M = { cellH, gap, padX, colW, wmx: Math.max(0, (colW - icon) / 2) };
    root.style.setProperty('--rows', rows);
    root.style.setProperty('--grid-gap', gap + 'px');
    root.style.setProperty('--col-w', colW + 'px');
    root.style.setProperty('--w-mx', M.wmx + 'px');
    return true;
  }

  function renderDots(){
    const n = L.pages.length, cur = curPage();
    dotsEl.hidden = n < 2 && !editing;
    dotsEl.innerHTML = L.pages.map((_, p) => `<button class="dot" data-dot="${p}" aria-label="第 ${p + 1} 页"${p === cur ? ' aria-current="true"' : ''}></button>`).join('');
  }
  let pendingPage = null;
  function render(page){
    if (!measure()) {
      if (page != null) pendingPage = page;
      if (!L) { L = clone(base); normalize(); }
      return;
    }
    L = clone(base);
    normalize();
    const p = Math.max(0, Math.min(L.pages.length - 1, page == null ? curPage() : page));
    // Dock 外框按真实图标数量收缩：先量出内容的自然宽度，再写成显式像素——
    // 只有显式宽度才能做过渡（max-content 不能动画），之后图标进出就是平滑的收缩 / 展开
    const k = scale(), sized = dockEl.classList.contains('sized'), dockW0 = parseFloat(dockEl.style.width) || 0;
    if (sized) dockEl.classList.remove('sized');   // 量宽度时先关掉过渡，避免量到一半的中间值
    pagesEl.innerHTML = L.pages.map(pageHtml).join('');
    dockEl.innerHTML = L.dock.map(id => appBtn(XS.apps[id], 'dock:' + id)).join('');
    dockEl.classList.toggle('is-empty', !L.dock.length);
    dockEl.style.width = '';                       // 回到 max-content 才能量准
    const dockW = dockEl.getBoundingClientRect().width / k;
    const grow = sized && !reduced() && dockW0 > 0 && Math.abs(dockW - dockW0) > .5;
    dockEl.style.width = (grow ? dockW0 : dockW) + 'px';
    void dockEl.offsetWidth;                          // 让起止宽度各自落到显式像素
    if (grow) { dockEl.classList.add('sized'); void dockEl.offsetWidth; dockEl.style.width = dockW + 'px'; }
    else dockEl.classList.add('sized');
    L.pages.flat().forEach(it => { if (it.t === 'w' && it.cfg) fillLines(pagesEl.querySelector(`[data-w="${CSS.escape(it.id)}"]`), it.cfg); });
    applyWidgetCss();
    cur = p; pageW = pagesEl.clientWidth;
    pagesEl.scrollLeft = p * pageW;
    renderDots();
    tick(true);
  }

  /* ---------- 时钟：每秒检查，分钟变了才改文字 ---------- */
  let lastKey = '';
  const fillClock = scope => { const v = XS.widgets.clockValues(); scope.querySelectorAll('[data-clock]:not([data-fixed])').forEach(el => { el.textContent = v[el.dataset.clock]; }); };
  function tick(force){
    if (!root) return;
    const n = new Date(), key = `${n.getDate()}-${n.getHours()}-${n.getMinutes()}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    fillClock(root);
  }
  setInterval(tick, 1000);

  // 照片自动轮播：多张照片的小组件每 4 秒淡入淡出切换（只用 opacity，编辑态 / 减少动态时暂停）
  setInterval(() => {
    if (reduced() || editing || drag || !root) return;
    root.querySelectorAll('[data-w]').forEach(w => {
      const slides = w.querySelectorAll('.w-slide');
      if (slides.length < 2) return;
      let cur = -1; slides.forEach((s, i) => { if (s.classList.contains('on')) cur = i; });
      if (cur < 0) return;
      slides[cur].classList.remove('on');
      slides[(cur + 1) % slides.length].classList.add('on');
    });
  }, 4000);

  /* ---------- 编辑模式 ---------- */
  function setEditing(on){
    editing = on;
    root.classList.toggle('editing', on);
    renderDots();
  }
  function removeWidget(id){
    L.pages.forEach(items => { const it = items.find(x => x.t === 'w' && x.id === id); if (it) removeFrom(items, it); });
    save(); render();
  }
  // 只移除快捷方式（桌面 / Dock / 文件夹里的图标），应用和它的数据都不动；提示里可以撤销
  function removeApp(id){
    const snap = clone(L), name = XS.apps[id] ? XS.apps[id].name : '应用';
    L.pages.forEach(items => {
      const it = items.find(x => x.t === 'app' && x.id === id);
      if (it) removeFrom(items, it);
      items.forEach(x => { if (x.t === 'f') removeFrom(x.apps, id); });
    });
    removeFrom(L.dock, id);
    markRemoved(id);
    save(); render();
    XS.ui.toast(`已从桌面移除「${name}」，可在设置里放回`, 4000, { text: '撤销', run(){ L = snap; unmarkRemoved(id); normalize(); save(); render(); } });
  }
  // 供设置页「主屏幕与 App 资源库」调用：把应用放回桌面第一处空位
  function restoreApp(id){
    unmarkRemoved(id);
    if (!base) base = XS.store.get(KEY, defaults());
    L = clone(base);
    if (!L.pages.length) L.pages.push([]);
    placeAnywhere({ t: 'app', id, c: 0, r: 0 }, 0);
    normalize();
    save();
    if (root) render();
  }
  // 预览推荐布局：只在内存里换成默认桌面，底部浮条选“保留”才写入；“取消”回到原来保存的布局
  let previewBak;
  function previewDefault(){
    if (!root || previewBak !== undefined) return;
    previewBak = base;
    base = defaults();
    setEditing(false);
    render(0);
    const bar = XS.ui.h(`<div class="home-preview" role="dialog" aria-label="推荐布局预览">
      <span class="hp-text">正在预览推荐布局，保留后会替换当前桌面排列</span>
      <button class="btn btn-sm btn-plain tap" data-pv="cancel">取消</button>
      <button class="btn btn-sm btn-primary tap" data-pv="keep">保留</button></div>`);
    root.appendChild(bar);
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-pv]');
      if (!b) return;
      const keep = b.dataset.pv === 'keep';
      if (keep) { L = clone(base); if (!save()) { XS.ui.toast('本地存储空间不够'); return; } }
      else base = previewBak;
      previewBak = undefined;
      bar.remove();
      render(0);
      XS.ui.toast(keep ? '已换成推荐布局' : '已恢复原来的桌面');
    });
  }
  XS.homeApi = { getRemovedApps, restoreApp, previewDefault };
  function addWidget(kind, w, h){
    const k = WIDGETS[kind], [dw, dh] = k.sizes[0];
    const it = { t: 'w', id: XS.uid('w'), kind, c: 0, r: 0, w: w || dw, h: h || dh };
    if (it.h > rows) { XS.ui.toast('屏幕高度不够，放不下这个尺寸'); return; }
    const p = placeAnywhere(it, curPage());
    if (p < 0) { XS.ui.toast('屏幕太小，放不下这个小组件'); return; }
    save(); render(p);
    XS.ui.toast(`已添加到第 ${p + 1} 页`);
  }
  // 按桌面真实格子尺寸画一个小组件，再整体缩进 host（最大 maxW × maxH）
  function fitPreview(host, it, maxW, maxH){
    const cellW = M.colW || 88, cellH = M.cellH || 84, gap = M.gap || 16, mx = M.wmx || 10;
    const W = it.w * cellW - 2 * mx, H = it.h * cellH + (it.h - 1) * gap;
    const s = Math.min(1, maxH / H, maxW / W);
    host.innerHTML = widgetHtml({ ...it, id: 'preview' }, true);
    const el = host.firstElementChild;
    Object.assign(el.style, { width: W + 'px', height: H + 'px', margin: 0, transform: `scale(${s})`, transformOrigin: '0 0' });
    host.style.width = W * s + 'px'; host.style.height = H * s + 'px';
    fillLines(el, it.cfg); fillClock(el);
    return el;
  }
  // 选择器：每种模板一张真实缩略预览（用默认 / 现有真实数据），下面是可选尺寸，点尺寸直接添加
  function widgetSheet(){
    const kinds = Object.entries(WIDGETS).filter(([, k]) => !k.legacy);
    const list = XS.ui.h(`<div class="wpick">${kinds.map(([kind, k]) => `<div class="wpick-item" data-kind="${kind}">
      <div class="wpick-pv" aria-hidden="true"><div class="wpick-host"></div></div>
      <div class="wpick-text"><div class="wpick-name">${esc(k.name)}</div><div class="wpick-sub">${esc(k.desc)}</div>
        <div class="wpick-sizes">${k.sizes.map(([w, h]) => `<button class="wpick-size tap" data-add="${kind}" data-sz="${w}x${h}" aria-label="添加 ${w}×${h} 的${esc(k.name)}">${w}×${h}</button>`).join('')}</div></div></div>`).join('')}
      <p class="wpick-hint">只会放进空着的格子，不会盖住图标；当前页放不下会放到后面的页面。添加后长按小组件、松手，可以换图片、文字、尺寸和点按目标。</p></div>`);
    const close = XS.ui.sheet({ title: '添加小组件', content: list, doneText: '完成' });
    requestAnimationFrame(() => list.querySelectorAll('.wpick-item').forEach(row => {
      const kind = row.dataset.kind, [w, h] = WIDGETS[kind].sizes[0];
      fitPreview(row.querySelector('.wpick-host'), { t: 'w', kind, w, h }, 132, 92);
    }));
    list.addEventListener('click', e => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      const [w, h] = b.dataset.sz.split('x').map(Number);
      close(); addWidget(b.dataset.add, w, h);
    });
  }

  /* ---------- 小组件编辑：尺寸、图片（上传即裁切）、文字、点按目标、CSS，实时预览；保存才生效 ---------- */
  function findWidget(id){
    for (let p = 0; p < L.pages.length; p++) {
      const item = L.pages[p].find(x => x.t === 'w' && x.id === id);
      if (item) return { page: p, item };
    }
    return null;
  }
  const segHtml = (label, key, opts) => `<div class="seg-row"><div class="row-title">${label}</div>
    <div class="segmented" role="radiogroup" aria-label="${label}" data-seg="${key}">${opts.map(([v, t]) => `<button class="seg" role="radio" data-v="${v}">${esc(t)}</button>`).join('')}</div></div>`;
  function fieldHtml(f){
    if (f.t === 'seg') return `<div class="group-block"><div class="group">${segHtml(f.label, f.k, f.opts)}</div></div>`;
    if (f.t === 'text') return `<div class="field-inline"><label for="we-${f.k}">${f.label}</label><input id="we-${f.k}" data-f="${f.k}" maxlength="${f.max}" placeholder="${esc(f.ph())}" autocomplete="off"></div>`;
    if (f.t === 'area') return `<div class="field-inline top"><label for="we-${f.k}">${f.label}</label><textarea id="we-${f.k}" data-f="${f.k}" maxlength="${f.max}" rows="2" placeholder="${esc(f.ph())}"></textarea></div>`;
    if (f.t === 'target') return `<div class="field-inline"><label for="we-${f.k}">${f.label}</label><select id="we-${f.k}" data-f="${f.k}">${f.opts().map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></div>`;
    return `<div class="group-block"><div class="group-label">${f.label}</div><div class="wedit-imgs" data-img="${f.k}"></div></div>`;
  }
  function widgetEditor(id){
    const found = findWidget(id);
    if (!found) return;
    const k = WIDGETS[found.item.kind];
    const d = { kind: found.item.kind, w: found.item.w, h: found.item.h, cfg: clone(found.item.cfg) || {} };
    const imgF = k.fields.filter(f => f.t === 'image' || f.t === 'images');
    const inline = k.fields.filter(f => ['text', 'area', 'target'].includes(f.t));
    const box = XS.ui.h(`<div class="wedit">
      <div class="wedit-stage" aria-live="polite"><div class="wedit-host"></div></div>
      ${k.sizes.length > 1 ? `<div class="group-block"><div class="group">${segHtml('尺寸', 'size', k.sizes.map(([w, h]) => [`${w}x${h}`, `${w}×${h}`]))}</div></div>` : ''}
      ${k.fields.filter(f => f.t === 'seg').map(fieldHtml).join('')}
      ${imgF.map(fieldHtml).join('')}
      ${inline.length ? `<div class="group-block"><div class="group-label">文字与点按</div><div class="group">${inline.map(fieldHtml).join('')}</div></div>` : ''}
      <div class="group-block"><div class="group-label">CSS</div>
        <label class="field wedit-css"><span class="sr-only">小组件 CSS</span><textarea data-f="css" maxlength="${CSS_MAX}" spellcheck="false" autocapitalize="off"
          placeholder="只作用于这个小组件，例如：&#10;background: #111; color: #fff;"></textarea>
        <span class="hint" data-csshint>直接写属性改外框；写选择器（如 .w-name）改里面的元素。</span></label></div>
      <button class="btn btn-block btn-danger tap" data-a="reset">恢复默认</button>
      <input type="file" accept="image/*" hidden aria-label="选择图片"></div>`);
    const host = $('.wedit-host', box), stage = $('.wedit-stage', box);
    const hint = $('[data-csshint]', box), hintText = hint.textContent, file = $('input[type=file]', box);
    const pv = document.createElement('style');
    box.appendChild(pv);
    // 图片区：单张 = 缩略图 + 上传 / 更换 / 移除；多张 = 缩略图列表，可前移、删除，末尾“添加”
    function paintImgs(){
      imgF.forEach(f => {
        const el = $(`[data-img="${f.k}"]`, box), v = d.cfg[f.k];
        if (f.t === 'image') {
          el.innerHTML = `${v ? `<img class="wedit-thumb" src="${esc(v)}" alt="当前${f.label}">` : ''}
            <button class="btn btn-sm btn-plain tap" data-pick="${f.k}">${v ? '更换' : '上传'}${f.label}</button>
            ${v ? `<button class="btn btn-sm btn-plain tap" data-rm="${f.k}">移除</button>` : ''}`;
          return;
        }
        const l = v || [];
        el.innerHTML = l.map((src, i) => `<span class="wedit-slot"><img class="wedit-thumb" src="${esc(src)}" alt="第 ${i + 1} 张">
          ${i ? `<button class="wedit-mini tap" data-mv="${f.k}:${i}" aria-label="第 ${i + 1} 张往前移">${XS.icon('back')}</button>` : ''}
          <button class="wedit-mini tap" data-rm="${f.k}:${i}" aria-label="删除第 ${i + 1} 张">${XS.icon('close')}</button></span>`).join('')
          + (l.length < f.max ? `<button class="wedit-add tap" data-pick="${f.k}" aria-label="添加照片">${XS.icon('plus')}</button>` : '')
          + `<span class="wedit-note">${l.length} / ${f.max} 张${l.length > 1 ? '，第一张显示在桌面上' : ''}</span>`;
      });
    }
    function paint(){
      fitPreview(host, { t: 'w', ...d }, (stage.clientWidth || 320) - 24, 200);
      const ok = !d.cfg.css || cssBalanced(d.cfg.css);
      pv.textContent = ok ? scopedCss('.wc-preview', d.cfg.css || '') : '';
      hint.textContent = ok ? hintText : '大括号 { } 没有配对，这段 CSS 暂时不生效，也不能保存。';
      hint.classList.toggle('bad', !ok);
      paintImgs();
    }
    // 分段：尺寸改 d.w / d.h，其余写进配置
    const tabs = [...box.querySelectorAll('[data-seg]')].map(seg => {
      const key = seg.dataset.seg, btns = [...seg.querySelectorAll('.seg')];
      const cur = () => key === 'size' ? `${d.w}x${d.h}` : d.cfg[key] || btns[0].dataset.v;
      const idx = () => Math.max(0, btns.findIndex(b => b.dataset.v === cur()));
      const t = XS.ui.pillTabs(seg, { itemSel: '.seg', attr: 'aria-checked', index: idx(), onChange: i => {
        const v = btns[i].dataset.v;
        if (key === 'size') [d.w, d.h] = v.split('x').map(Number); else d.cfg[key] = v;
        paint();
      }});
      return () => t.select(idx(), false);
    });
    function syncForm(){
      box.querySelectorAll('[data-f]').forEach(f => { f.value = d.cfg[f.dataset.f] || (f.tagName === 'SELECT' ? f.options[0].value : ''); });
      tabs.forEach(s => s());
    }
    box.addEventListener('input', e => {
      const f = e.target.dataset.f;
      if (!f) return;
      if (e.target.value.trim()) d.cfg[f] = e.target.value; else delete d.cfg[f];
      paint();
    });
    let picking = null;
    box.addEventListener('click', e => {
      const t = e.target.closest('[data-pick],[data-rm],[data-mv],[data-a]');
      if (!t) return;
      if (t.dataset.pick) { picking = t.dataset.pick; file.click(); return; }
      if (t.dataset.rm) {
        const [key, i] = t.dataset.rm.split(':');
        if (i == null) delete d.cfg[key];
        else { d.cfg[key].splice(+i, 1); if (!d.cfg[key].length) delete d.cfg[key]; }
        paint(); return;
      }
      if (t.dataset.mv) {
        const [key, i] = t.dataset.mv.split(':'), l = d.cfg[key];
        [l[i - 1], l[i]] = [l[i], l[i - 1]];
        paint(); return;
      }
      if (t.dataset.a === 'reset') { [d.w, d.h] = k.sizes[0]; d.cfg = {}; syncForm(); paint(); XS.ui.toast('已恢复默认，点“保存”后生效'); }
    });
    // 选好图片先裁切（按这个位置的比例），确认后才放进预览
    file.addEventListener('change', async () => {
      const f = file.files[0], key = picking; file.value = '';
      const fd = imgF.find(x => x.k === key);
      if (!f || !fd) return;
      const url = await XS.media.crop(f, { ratio: fd.ratio, out: fd.out, title: '裁切' + fd.label });
      if (!url) return;
      if (fd.t === 'image') d.cfg[key] = url;
      else d.cfg[key] = [...(d.cfg[key] || []), url].slice(0, fd.max);
      paint();
    });
    XS.ui.sheet({ title: `编辑${k.name}`, content: box, doneText: '保存', onDone: () => saveWidget(id, d) });
    syncForm();
    requestAnimationFrame(paint);
  }
  // 保存：尺寸变了先在原位试，放不下就挪到最近的空位 / 后面的页面
  function saveWidget(id, d){
    if (d.cfg.css && !cssBalanced(d.cfg.css)) { XS.ui.toast('CSS 的大括号没有配对，先改好再保存'); return false; }
    const found = findWidget(id);
    if (!found) return true;
    const { page, item } = found, items = L.pages[page];
    const old = { w: item.w, h: item.h, c: item.c, r: item.r };
    let at = page;
    if (d.w !== item.w || d.h !== item.h) {
      if (d.w > COLS || d.h > rows) { XS.ui.toast('屏幕高度不够，放不下这个尺寸'); return false; }
      item.w = d.w; item.h = d.h;
      if (!fits(items, item.c, item.r, item.w, item.h, item)) {
        const f = findFree(items, item.w, item.h, item, { c: item.c, r: item.r });
        if (f) Object.assign(item, f);
        else { removeFrom(items, item); at = placeAnywhere(item, page); }
        if (at < 0) { Object.assign(item, old); items.push(item); XS.ui.toast('放不下这个尺寸'); return false; }
      }
    }
    // 便签内容改了才记新日期
    if (d.kind === 'note' && d.cfg.text && d.cfg.text !== (item.cfg || {}).text) d.cfg.at = Date.now();
    const cfg = cleanCfg(d.kind, d.cfg);
    if (cfg) item.cfg = cfg; else delete item.cfg;
    normalize();
    if (!save()) { XS.ui.toast('本地存储空间不够，图片可能太大'); render(); return false; }
    render(at);
    if (at !== page) XS.ui.toast(`这一页放不下，已移到第 ${at + 1} 页`);
    return true;
  }

  /* ---------- 轻点小组件：按模板和绑定目标打开对应内容 ---------- */
  async function openIn(app, el, page){
    await XS.nav.openApp(app, el);
    if (page && XS.nav.depth() === 1) XS.nav.push(page());
  }
  function noteSheet(id){
    const found = findWidget(id);
    if (!found) return;
    const cfg = found.item.cfg || {};
    const box = XS.ui.h(`<div><label class="field"><span class="sr-only">便签内容</span><textarea maxlength="80" rows="3" placeholder="想记下的一句话">${esc(cfg.text || '')}</textarea></label></div>`);
    XS.ui.sheet({ title: '便签', content: box, doneText: '保存', onDone: () => {
      const d = { kind: 'note', w: found.item.w, h: found.item.h, cfg: { ...cfg } };
      const v = $('textarea', box).value;
      if (v.trim()) d.cfg.text = v; else delete d.cfg.text;
      return saveWidget(id, d);
    }});
  }
  function widgetTap(id, el){
    const found = findWidget(id);
    if (!found) return;
    const { kind, cfg = {} } = found.item;
    if (kind === 'profile') {
      const c = cfg.target && cfg.target !== 'me' && XS.chat && XS.chat.contact(cfg.target);
      if (c) XS.chat.editContact(c, () => render());
      else openIn('settings', el, XS.settingsPages && XS.settingsPages.profile);
    }
    else if (kind === 'polaroid') { if (cfg.imgs) XS.media.viewer(cfg.imgs, 0, cfg.cap || ''); else widgetEditor(id); }
    else if (kind === 'memory') {
      if (cfg.target === 'photos') XS.nav.openApp('photos', el);
      else if (cfg.imgs) XS.media.viewer(cfg.imgs, 0, cfg.date || ''); else widgetEditor(id);
    }
    else if (kind === 'music') XS.nav.openApp('music', el);
    else if (kind === 'note') { if (cfg.target === 'notes') XS.nav.openApp('notes', el); else noteSheet(id); }
    else if (kind === 'chat') {
      const d = XS.widgets.chatData(cfg);
      openIn('chat', el, d && (() => XS.chat.openConv(d.c.id)));
    }
    else if (kind === 'weather') XS.nav.openApp('weather', el);
    else if (kind === 'calendar') XS.nav.openApp('calendar', el);
    else if (kind === 'battery') XS.nav.openApp('settings', el);
    else if (kind === 'photowall') { if (cfg.imgs) XS.media.viewer(cfg.imgs, 0, ''); else widgetEditor(id); }
  }

  /* ---------- 文件夹：在桌面上展开，可改名、拖动排序、拖出 ---------- */
  const findFolder = id => { for (let p = 0; p < L.pages.length; p++) { const item = L.pages[p].find(x => x.t === 'f' && x.id === id); if (item) return { page: p, item }; } return null; };
  let pop = null;
  function closeFolder(){
    if (!pop) return;
    const el = pop; pop = null;
    el.classList.remove('open');
    setTimeout(() => el.remove(), reduced() ? 0 : 300);
  }
  function paintFolder(id){
    const { item } = findFolder(id);
    const nm = $('.fp-name', pop);
    if (document.activeElement !== nm) nm.value = item.name;
    $('.fp-grid', pop).innerHTML = item.apps.map(aid => { const a = XS.apps[aid];
      return `<div class="fp-cell" data-pcell="${aid}"><button class="app tap" data-papp="${aid}" aria-label="${esc(a.name)}">${miniIcon(aid)}<span class="app-label">${esc(a.name)}</span></button></div>`; }).join('');
  }
  // 展开：名称浮在上面（点按可改名），下面一层透亮的玻璃面板放 App；没有底部按钮和说明。
  // 排序 = 按住图标在面板里拖；拖出面板 = 放回桌面 / Dock；从桌面拖 App 到文件夹上 = 加进来
  function openFolder(id){
    if (!findFolder(id)) return;
    closeFolder();
    pop = XS.ui.h(`<div class="fpop" data-fid="${esc(id)}">
      <div class="fp-scrim"></div>
      <label class="fp-namebox"><span class="sr-only">文件夹名称，点按可改名</span><input class="fp-name" maxlength="16" autocomplete="off" enterkeyhint="done"></label>
      <div class="fp-panel" role="dialog" aria-modal="true" aria-label="文件夹内容"><div class="fp-grid"></div></div></div>`);
    root.appendChild(pop);
    paintFolder(id);
    const me = pop, nm = $('.fp-name', me), panel = $('.fp-panel', me), grid = $('.fp-grid', me);
    // 从桌面上这个文件夹的位置弹出来（收起时缩回那里）
    const from = root.querySelector(`[data-f="${CSS.escape(id)}"] .f-box`);
    if (from) {
      const k = scale(), s = from.getBoundingClientRect(), sx = s.left + s.width / 2, sy = s.top + s.height / 2;
      [panel, $('.fp-namebox', me)].forEach(el => {
        const r = el.getBoundingClientRect();
        el.style.transformOrigin = `${(sx - r.left - r.width / 2) / k + el.offsetWidth / 2}px ${(sy - r.top - r.height / 2) / k + el.offsetHeight / 2}px`;
      });
    }
    requestAnimationFrame(() => requestAnimationFrame(() => pop === me && me.classList.add('open')));
    // 改名：输入时不重画（不打断输入法），离开输入框或按回车才保存
    const rename = () => {
      const f = findFolder(id), v = nm.value.trim().slice(0, 16) || '文件夹';
      if (f && f.item.name !== v) { f.item.name = v; save(); render(); }
      nm.value = v;
    };
    nm.addEventListener('change', rename);
    nm.addEventListener('keydown', e => { if (e.key === 'Enter') nm.blur(); });
    let fp = null, fpSuppress = false;
    me.addEventListener('click', e => {
      if (fpSuppress) { fpSuppress = false; return; }
      if (e.target.closest('.fp-scrim')) { closeFolder(); return; }
      const b = e.target.closest('[data-papp]');
      if (b) { closeFolder(); XS.nav.openApp(b.dataset.papp, b); }
    });

    // —— 面板里拖动排序 ——
    const k0 = () => scale();
    // 格子的排版位置（不含正在播放的移位动画），用来判断手指压到了哪一格，避免来回抖
    const slotRect = c => {
      const pr = panel.getBoundingClientRect(), k = k0();
      const left = pr.left + c.offsetLeft * k, top = pr.top + (c.offsetTop - panel.scrollTop) * k;
      return { left, top, right: left + c.offsetWidth * k, bottom: top + c.offsetHeight * k };
    };
    const follow = p => {
      const k = k0();
      p.cell.style.transform = `translate(${(p.lx - p.px) / k - (p.cell.offsetLeft - p.ox)}px,${(p.ly - p.py) / k - (p.cell.offsetTop - p.oy) + (panel.scrollTop - p.st)}px)`;
    };
    // 换位置：其余图标从旧位置弹到新位置（FLIP）
    const reorder = (p, hit) => {
      const cells = [...grid.children], k = k0();
      const before = new Map(cells.map(c => [c, c.getBoundingClientRect()]));
      grid.insertBefore(p.cell, cells.indexOf(p.cell) < cells.indexOf(hit) ? hit.nextSibling : hit);
      cells.forEach(c => {
        if (c === p.cell) return;
        const a = before.get(c), b = c.getBoundingClientRect();
        c.style.transition = 'none';
        c.style.transform = `translate(${(a.left - b.left) / k}px,${(a.top - b.top) / k}px)`;
      });
      void grid.offsetWidth;
      cells.forEach(c => { if (c !== p.cell) { c.style.transition = ''; c.style.transform = ''; } });
      follow(p);
    };
    const commitOrder = () => {
      const f = findFolder(id);
      if (!f) return;
      const order = [...grid.children].map(c => c.dataset.pcell);
      if (order.join() === f.item.apps.join()) return;
      f.item.apps = order;
      normalize(); save(); render();
    };
    const lift = p => {
      if (p.live) return;
      p.live = true; fpSuppress = true;
      p.b.classList.remove('is-pressed');
      p.cell.classList.add('lift'); me.classList.add('sorting');
      p.ox = p.cell.offsetLeft; p.oy = p.cell.offsetTop; p.px = p.lx; p.py = p.ly; p.st = panel.scrollTop;
      try { me.setPointerCapture(p.id); } catch (_) {}
      if (!editing) setEditing(true);
    };
    me.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-papp]');
      if (!b || e.button > 0 || drag || fp) return;
      const p = fp = { b, cell: b.parentNode, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, live: false };
      p.t = setTimeout(() => { if (fp === p) lift(p); }, HOLD_MS);
    });
    me.addEventListener('pointermove', e => {
      const p = fp;
      if (!p || e.pointerId !== p.id) return;
      p.lx = e.clientX; p.ly = e.clientY;
      if (!p.live) {
        const d = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (editing && d > 5) lift(p);
        else { if (d > 10) { clearTimeout(p.t); fp = null; } return; }
      }
      // 拖出面板：交给桌面的拖动，放回桌面 / Dock，或合并进别的文件夹
      const pr = panel.getBoundingClientRect(), m = 14 * k0();
      if (e.clientX < pr.left - m || e.clientX > pr.right + m || e.clientY < pr.top - m || e.clientY > pr.bottom + m) {
        clearTimeout(p.t); fp = null;
        commitOrder();
        beginDrag(p.b, e.clientX, e.clientY, p.id, { kind: 'app', from: 'folder', fid: id, id: p.b.dataset.papp, item: null });
        closeFolder();
        return;
      }
      follow(p);
      const hit = [...grid.children].find(c => c !== p.cell && inside(slotRect(c), e.clientX, e.clientY));
      if (hit) reorder(p, hit);
    });
    const up = e => {
      const p = fp;
      if (!p || e.pointerId !== p.id) return;
      clearTimeout(p.t); fp = null;
      if (!p.live) return;
      // 落位：松手后从手指处弹回自己的格子
      me.classList.remove('sorting');
      p.cell.classList.remove('lift');
      p.cell.style.transform = '';
      commitOrder();
      setTimeout(() => { fpSuppress = false; }, 0);
    };
    me.addEventListener('pointerup', up); me.addEventListener('pointercancel', up);
    me.addEventListener('touchmove', e => { if (fp && fp.live) e.preventDefault(); }, { passive: false });
  }
  // 调整大小：编辑模式下从文件夹右下角拖动，按格子吸附到 1×1 / 2×1 / 2×2；放不下的尺寸标红、松手不生效。
  // 在角上轻点没拖动 = 普通点按（展开文件夹），不切尺寸
  function startResize(fid, e){
    const f = findFolder(fid);
    if (!f) return;
    const it = f.item, items = L.pages[f.page], k = scale();
    const g = gridOf(f.page), hint = document.createElement('div');
    const x0 = e.clientX, y0 = e.clientY;
    let want = [it.w, it.h], moved = false;
    const ok = ([w, h]) => fits(items, it.c, it.r, w, h, it);
    const show = () => {
      hint.className = 'drop-hint wide resize' + (ok(want) ? '' : ' bad');
      hint.style.gridColumn = `${it.c + 1} / span ${want[0]}`; hint.style.gridRow = `${it.r + 1} / span ${want[1]}`;
      if (hint.parentNode !== g) g.appendChild(hint);
    };
    try { root.setPointerCapture(e.pointerId); } catch (_) {}
    const mv = ev => {
      if (ev.pointerId !== e.pointerId) return;
      const dx = (ev.clientX - x0) / k, dy = (ev.clientY - y0) / k;
      if (!moved && Math.hypot(dx, dy) < 8) return;
      moved = true;
      const w = Math.max(1, Math.min(2, it.w + Math.round(dx / M.colW))), h = Math.max(1, Math.min(2, it.h + Math.round(dy / (M.cellH + M.gap))));
      want = FSIZES.find(s => s[0] === w && s[1] === h) || (w === 1 ? [1, 1] : [2, h]);
      show();
    };
    const up = ev => {
      if (ev.pointerId !== e.pointerId) return;
      root.removeEventListener('pointermove', mv); root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', up);
      hint.remove();
      if (!moved) return;   // 没拖动：交给 click 当普通点按
      suppress = true; releaseSuppress();
      if (ev.type === 'pointercancel') return;
      if (want[0] === it.w && want[1] === it.h) return;
      if (!ok(want)) { XS.ui.toast('这里放不下，先把旁边的图标挪开'); return; }
      [it.w, it.h] = want;
      normalize(); save(); render(f.page);
    };
    root.addEventListener('pointermove', mv); root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
  }

  /* ---------- 拖动 ---------- */
  function srcOf(el){
    if (el.dataset.f) {
      for (let p = 0; p < L.pages.length; p++) {
        const item = L.pages[p].find(x => x.t === 'f' && x.id === el.dataset.f);
        if (item) return { kind: 'f', from: 'grid', page: p, item, id: item.id };
      }
      return null;
    }
    if (el.dataset.w) {
      for (let p = 0; p < L.pages.length; p++) {
        const item = L.pages[p].find(x => x.t === 'w' && x.id === el.dataset.w);
        if (item) return { kind: 'w', from: 'grid', page: p, item, id: item.id };
      }
      return null;
    }
    const [where, id] = el.dataset.key.split(':');
    if (where === 'dock') return { kind: 'app', from: 'dock', id };
    for (let p = 0; p < L.pages.length; p++) {
      const item = L.pages[p].find(x => x.t === 'app' && x.id === id);
      if (item) return { kind: 'app', from: 'grid', page: p, item, id };
    }
    return null;
  }
  const inside = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

  // 手指下面是哪里：Dock 的第几个位置，或第几页的哪一格
  function hitTest(x, y){
    const k = scale(), dr = dockEl.getBoundingClientRect();
    if (inside(dr, x, y)) {
      const others = [...dockEl.children].filter(b => b !== drag.el);
      return { to: 'dock', index: others.filter(b => { const r = b.getBoundingClientRect(); return r.left + r.width / 2 < x; }).length };
    }
    if (!inside(pagesEl.getBoundingClientRect(), x, y)) return null;
    const p = curPage(), g = gridOf(p);
    if (!g) return null;
    const gr = g.getBoundingClientRect(), step = M.cellH + M.gap;
    // 小组件和 2×1 / 2×2 文件夹按影子左上角对齐格子；1×1 文件夹和图标按手指所在的格子
    if (drag.src.kind === 'w' || (drag.src.kind === 'f' && drag.src.item.w > 1)) {
      const it = drag.src.item, rr = root.getBoundingClientRect();
      const gx = parseFloat(drag.ghost.style.left) - (gr.left - rr.left) / k - M.padX - M.wmx;
      const gy = parseFloat(drag.ghost.style.top) - (gr.top - rr.top) / k;
      return { to: 'grid', page: p, c: Math.max(0, Math.min(COLS - it.w, Math.round(gx / M.colW))), r: Math.max(0, Math.min(rows - it.h, Math.round(gy / step))) };
    }
    const lx = (x - gr.left) / k - M.padX, ly = (y - gr.top) / k;
    return { to: 'grid', page: p, c: Math.max(0, Math.min(COLS - 1, Math.floor(lx / M.colW))), r: Math.max(0, Math.min(rows - 1, Math.floor((ly + M.gap / 2) / step))) };
  }

  // 把拖动的应用从原处拿走：Dock、文件夹里，或桌面格子
  function detach(src){
    if (src.from === 'dock') removeFrom(L.dock, src.id);
    else if (src.from === 'folder') { const f = L.pages.flat().find(x => x.t === 'f' && x.id === src.fid); if (f) removeFrom(f.apps, src.id); }
    else removeFrom(L.pages[src.page], src.item);
  }
  // 合并候选：手指停在同一页另一个图标 / 文件夹图标的正中心（边长 40% 以内），擦过边缘不算
  function mergeCandidate(x, y, tgt){
    if (!tgt || tgt.to !== 'grid' || drag.src.kind !== 'app') return null;
    const occ = occupantAt(L.pages[tgt.page] || [], tgt.c, tgt.r, drag.src.item);
    if (!occ || occ.t === 'w' || (occ.t === 'f' && occ.apps.includes(drag.src.id))) return null;
    const el = occ.t === 'f' ? root.querySelector(`[data-f="${CSS.escape(occ.id)}"] .f-box`) : root.querySelector(`.home-pages [data-key="app:${occ.id}"] .app-icon`);
    if (!el) return null;
    const r = el.getBoundingClientRect(), zx = r.width * .2, zy = r.height * .2;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return Math.abs(x - cx) <= zx && Math.abs(y - cy) <= zy ? { occ, el } : null;
  }
  // 松手后会发生什么：返回 { apply, cell } 表示可以放，{ msg } 表示放不了（原位退回）
  function resolve(src, tgt){
    if (!tgt) return null;
    if (tgt.to === 'dock') {
      if (src.kind === 'w') return { msg: '小组件不能放进 Dock' };
      if (src.kind === 'f') return { msg: '文件夹不能放进 Dock' };
      if (src.from === 'dock') return { dock: true, apply(){ removeFrom(L.dock, src.id); L.dock.splice(tgt.index, 0, src.id); } };
      if (L.dock.length >= DOCK_MAX) return { msg: `Dock 已满，最多放 ${DOCK_MAX} 个应用` };
      return { dock: true, apply(){ detach(src); L.dock.splice(tgt.index, 0, src.id); } };
    }
    const tp = tgt.page, items = L.pages[tp];
    if (!items) return null;
    const moveTo = (c, r) => () => {
      if (src.from === 'dock' || src.from === 'folder') { detach(src); items.push({ t: 'app', id: src.id, c, r }); return; }
      if (src.page !== tp) { removeFrom(L.pages[src.page], src.item); items.push(src.item); }
      src.item.c = c; src.item.r = r;
    };
    // 在另一个图标 / 文件夹正中心停够时间：松手合并成文件夹，或加进已有文件夹
    if (src.kind === 'app' && tgt.merge) {
      const occ = tgt.merge;
      const res = { merge: occ, apply(){
        detach(src);
        if (occ.t === 'f') { if (!occ.apps.includes(src.id)) occ.apps.push(src.id); res.fid = occ.id; return; }
        const f = { t: 'f', id: XS.uid('f'), name: '文件夹', apps: [occ.id, src.id], c: occ.c, r: occ.r, w: 1, h: 1 };
        items.splice(items.indexOf(occ), 1, f);
        res.fid = f.id;
      }};
      return res;
    }
    if (src.kind === 'w' || src.kind === 'f') {
      const it = src.item;
      return fits(items, tgt.c, tgt.r, it.w, it.h, it) ? { apply: moveTo(tgt.c, tgt.r), cell: { c: tgt.c, r: tgt.r, w: it.w, h: it.h } } : { msg: '这里放不下这个小组件', cell: { c: tgt.c, r: tgt.r, w: it.w, h: it.h }, bad: true };
    }
    const occ = occupantAt(items, tgt.c, tgt.r, src.item);
    const one = (c, r) => ({ c, r, w: 1, h: 1 });
    if (!occ) return { apply: moveTo(tgt.c, tgt.r), cell: one(tgt.c, tgt.r) };
    // 格子里已有图标 / 1×1 文件夹、且是从桌面拖来的：两个互换位置
    if ((occ.t === 'app' || (occ.t === 'f' && occ.w === 1 && occ.h === 1)) && src.from === 'grid') return { cell: one(tgt.c, tgt.r), apply(){
      const sp = src.page, sc = src.item.c, sr = src.item.r;
      moveTo(tgt.c, tgt.r)();
      if (sp !== tp) { removeFrom(items, occ); L.pages[sp].push(occ); }
      occ.c = sc; occ.r = sr;
    }};
    // 落在小组件上、或从 Dock 拖到已有图标的格子：放到这一页离它最近的空格
    const f = findFree(items, 1, 1, src.item, tgt);
    return f ? { apply: moveTo(f.c, f.r), cell: one(f.c, f.r) } : { msg: '这一页已经放满了', bad: true, cell: one(tgt.c, tgt.r) };
  }

  function showHint(res){
    const hint = drag.hint;
    dockEl.classList.toggle('drop-ok', !!(res && res.dock));
    dockEl.classList.toggle('drop-no', !!(res && res.msg && drag.target && drag.target.to === 'dock'));
    if (!res || !res.cell) { hint.remove(); return; }
    const g = gridOf(drag.target.page);
    if (hint.parentNode !== g) g.appendChild(hint);
    const c = res.cell;
    hint.className = 'drop-hint' + (c.w > 1 || c.h > 1 ? ' wide' : '') + (res.bad ? ' bad' : '');
    hint.style.gridColumn = `${c.c + 1} / span ${c.w}`;
    hint.style.gridRow = `${c.r + 1} / span ${c.h}`;
  }

  function beginDrag(el, x, y, pointerId, given){
    const src = given || srcOf(el);
    if (!src) return;
    const k = scale(), r = el.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.remove('is-pressed');
    ghost.classList.add('drag-ghost');
    [ghost, ...ghost.querySelectorAll('[data-key],[data-w],[data-del],[data-appdel],[data-clock],[data-f],[data-fapp],[data-fopen],[data-papp]')].forEach(n => {
      ['data-key', 'data-w', 'data-del', 'data-appdel', 'data-f', 'data-fapp', 'data-fopen', 'data-papp'].forEach(a => n.removeAttribute(a));
    });
    const imgs = ['--w-img', '--w-av'].map(v => [v, el.style.getPropertyValue(v)]);
    ghost.removeAttribute('style');
    imgs.forEach(([v, val]) => { if (val) ghost.style.setProperty(v, val); });
    const left = (r.left - rr.left) / k, top = (r.top - rr.top) / k;
    Object.assign(ghost.style, { left: left + 'px', top: top + 'px', width: r.width / k + 'px', height: r.height / k + 'px' });
    root.appendChild(ghost);
    el.classList.remove('is-pressed');
    el.classList.add('drag-src');
    drag = { el, src, ghost, hint: document.createElement('div'), ox: (x - r.left) / k, oy: (y - r.top) / k, target: null, edgeT: null, x, y, x0: x, y0: y, id: pointerId };
    try { root.setPointerCapture(pointerId); } catch (e) {}
    moveDrag(x, y);
  }

  function flipPage(dir){
    if (!drag) return;
    let p = curPage() + dir;
    if (p < 0) return;
    if (p >= L.pages.length) {
      // 拖到最后一页右边：新开一页（最后一页本来就是空的就不再开）
      if (!L.pages[L.pages.length - 1].length) return;
      L.pages.push([]);
      pagesEl.insertAdjacentHTML('beforeend', pageHtml([], L.pages.length - 1));
      p = L.pages.length - 1;
    }
    setPage(p, true);
    setTimeout(() => { if (drag) { renderDots(); moveDrag(drag.x, drag.y); } }, reduced() ? 20 : 420);
  }

  function moveDrag(x, y){
    const d = drag, k = scale(), rr = root.getBoundingClientRect();
    d.x = x; d.y = y;
    d.ghost.style.left = (x - rr.left) / k - d.ox + 'px';
    d.ghost.style.top = (y - rr.top) / k - d.oy + 'px';
    d.target = hitTest(x, y);
    // 合并：同一个目标连续停住 MERGE_MS 才武装；换目标、离开中心区都会重新计时，所以擦过不会合并
    const mc = mergeCandidate(x, y, d.target);
    if (!mc || !d.mc || mc.occ !== d.mc.occ) {
      clearTimeout(d.mergeT); d.armed = false;
      root.querySelectorAll('.merge-to').forEach(n => n.classList.remove('merge-to'));
      d.mc = mc;
      if (mc) d.mergeT = setTimeout(() => {
        if (drag !== d || !d.mc) return;
        d.armed = true;
        d.mc.el.classList.add('merge-to');
        d.res = resolve(d.src, { ...d.target, merge: d.mc.occ });
        showHint(d.res);
      }, MERGE_MS);
    }
    d.res = resolve(d.src, d.armed && d.mc ? { ...d.target, merge: d.mc.occ } : d.target);
    showHint(d.res);
    // 贴近屏幕左右边缘停一会儿：翻页
    const pr = pagesEl.getBoundingClientRect(), edge = 22 * k;
    const dir = y >= pr.top && y <= pr.bottom ? (x < rr.left + edge ? -1 : x > rr.right - edge ? 1 : 0) : 0;
    if (dir && d.edgeDir !== dir) { clearTimeout(d.edgeT); d.edgeDir = dir; d.edgeT = setTimeout(() => { if (drag) { drag.edgeDir = 0; flipPage(dir); } }, 600); }
    else if (!dir) { clearTimeout(d.edgeT); d.edgeDir = 0; }
  }

  // 把拖动的影子飞到目标元素的位置，然后收起
  function flyTo(ghost, el, done){
    if (!el) { ghost.remove(); done && done(); return; }
    const k = scale(), r = el.getBoundingClientRect(), rr = root.getBoundingClientRect();
    el.classList.add('drag-src');
    ghost.classList.add('fly');
    requestAnimationFrame(() => {
      ghost.style.left = (r.left - rr.left) / k + 'px';
      ghost.style.top = (r.top - rr.top) / k + 'px';
      ghost.style.width = r.width / k + 'px';
      ghost.style.height = r.height / k + 'px';
    });
    setTimeout(() => { ghost.remove(); el.classList.remove('drag-src'); done && done(); }, reduced() ? 0 : 260);
  }

  function endDrag(cancel){
    const d = drag;
    if (!d) return;
    drag = null;
    clearTimeout(d.edgeT); clearTimeout(d.mergeT);
    root.querySelectorAll('.merge-to').forEach(n => n.classList.remove('merge-to'));
    d.hint.remove();
    dockEl.classList.remove('drop-ok', 'drop-no');
    try { root.releasePointerCapture(d.id); } catch (e) {}
    // 长按小组件后原地松手（几乎没动）：退回原位后打开它的编辑面板
    // 长按文件夹后原地松手：打开文件夹（改名、排序、添加）
    const still = !cancel && (d.src.kind === 'w' || d.src.kind === 'f') && Math.hypot(d.x - d.x0, d.y - d.y0) < 8 * scale();
    if (still) { flyTo(d.ghost, d.el, () => { d.el.classList.remove('drag-src'); d.src.kind === 'f' ? openFolder(d.src.id) : widgetEditor(d.src.id); }); return; }
    const res = cancel ? null : d.res;   // 最后一次移动时算好的结果（和松手位置一致）
    if (res && res.apply) {
      res.apply();
      normalize(); save();
      // 空页会被清掉、页码可能前移，所以按 id 找它现在在哪一页
      const t = res.fid ? 'f' : d.src.kind, id = res.fid || d.src.id;
      const at = L.pages.findIndex(items => items.some(x => x.id === id && x.t === t));
      render(res.dock || at < 0 ? Math.min(curPage(), L.pages.length - 1) : at);
      const sel = t === 'app' ? `[data-key="${res.dock ? 'dock' : 'app'}:${id}"]` : `[data-${t}="${CSS.escape(id)}"]`;
      flyTo(d.ghost, root.querySelector(sel));
      return;
    }
    // 放不了 / 取消：回到原位
    if (res && res.msg) XS.ui.toast(res.msg);
    if (d.src.from === 'grid' && curPage() !== d.src.page) setPage(d.src.page);
    // 从文件夹里拖出来又取消：飞回桌面上的那个文件夹
    if (d.src.from === 'folder') { flyTo(d.ghost, root.querySelector(`[data-f="${CSS.escape(d.src.fid)}"]`)); return; }
    flyTo(d.ghost, d.el, () => { d.el.classList.remove('drag-src'); if (L.pages.some(p => !p.length)) render(); });
  }

  /* ---------- 鼠标左右拖动翻页（触摸屏直接用原生滑动） ---------- */
  function startSwipe(x0){
    const s0 = pagesEl.scrollLeft, w = pagesEl.clientWidth, k = scale();
    let moved = false;
    pagesEl.style.scrollSnapType = 'none';
    const mv = e => { const dx = (e.clientX - x0) / k; if (Math.abs(dx) > 4) moved = true; pagesEl.scrollLeft = s0 - dx; };
    const up = e => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      const dx = (e.clientX - x0) / k;
      setPage(Math.round(s0 / w) + (dx < -40 ? 1 : dx > 40 ? -1 : 0), true);
      setTimeout(() => { pagesEl.style.scrollSnapType = ''; }, 450);
      if (moved) { suppress = true; releaseSuppress(); }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }

  /* ---------- 事件 ---------- */
  // 小组件统一交互反馈：按下 0.96 缩进（CSS .widget.is-pressed），松手 spring 回弹；只作用于小组件，不改 app / 文件夹的既有手感
  const pressEl = el => { if (el && el.classList.contains('widget')) el.classList.add('is-pressed'); };
  const unpressEl = el => { if (el && el.classList.contains('widget')) el.classList.remove('is-pressed'); };
  function bind(){
    root.addEventListener('contextmenu', e => e.preventDefault());
    root.addEventListener('pointerdown', e => {
      suppress = false;
      if (e.button > 0 || drag) return;
      if (e.target.closest('.w-del,.app-del,.he-btn,.home-dots,.home-preview,.fpop')) return;
      const fbox = editing && e.target.closest('.f-box');
      if (fbox && inResizeZone(fbox, e.clientX, e.clientY)) { startResize(fbox.closest('[data-f]').dataset.f, e); return; }
      // 大文件夹里的图标：长按拖的是整个文件夹
      const el = e.target.closest('[data-f],[data-key],[data-w]');
      // 预览推荐布局时只能翻页看，不能长按编辑（否则会把预览写进存储）
      if (!el || previewBak !== undefined) { if (e.pointerType === 'mouse') startSwipe(e.clientX); return; }
      press = { el, x: e.clientX, y: e.clientY, id: e.pointerId, mouse: e.pointerType === 'mouse' };
      pressEl(el);
      if (!editing) press.timer = setTimeout(() => {
        const p = press; press = null;
        if (!p) return;
        unpressEl(p.el);
        suppress = true;
        setEditing(true);
        beginDrag(p.el, p.lx || p.x, p.ly || p.y, p.id);
      }, HOLD_MS);
    });
    root.addEventListener('pointermove', e => {
      if (drag) { if (e.pointerId === drag.id) moveDrag(e.clientX, e.clientY); return; }
      if (!press || e.pointerId !== press.id) return;
      const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      press.lx = e.clientX; press.ly = e.clientY;
      if (editing && dist > 5) { const p = press; press = null; suppress = true; unpressEl(p.el); beginDrag(p.el, e.clientX, e.clientY, p.id); }
      else if (!editing && dist > 8) { clearTimeout(press.timer); const p = press; press = null; unpressEl(p.el); if (p.mouse) startSwipe(p.x); }
    });
    const up = cancel => e => {
      if (press && e.pointerId === press.id) { clearTimeout(press.timer); unpressEl(press.el); press = null; }
      if (drag && e.pointerId === drag.id) endDrag(cancel);
      if (suppress) releaseSuppress();
    };
    root.addEventListener('pointerup', up(false));
    root.addEventListener('pointercancel', up(true));
    // 拖动时不让页面跟着滚
    root.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });

    root.addEventListener('click', e => {
      if (suppress) { suppress = false; return; }
      if (previewBak !== undefined && !e.target.closest('[data-dot]')) return;
      if (e.target.closest('.fpop')) return;
      const del = e.target.closest('[data-del]');
      if (del) { removeWidget(del.dataset.del); return; }
      const appdel = e.target.closest('[data-appdel]');
      if (appdel) { removeApp(appdel.dataset.appdel); return; }
      const a = e.target.closest('.he-btn');
      if (a) { a.dataset.a === 'widget' ? widgetSheet() : setEditing(false); return; }
      const dot = e.target.closest('[data-dot]');
      if (dot) { setPage(+dot.dataset.dot, true); return; }
      // 文件夹：大尺寸里的图标直接打开应用；名称、方块空白处展开（编辑模式下点哪里都是展开）
      const fEl = e.target.closest('[data-f]'), fa = e.target.closest('[data-fapp]');
      if (fa && !editing) { XS.nav.openApp(fa.dataset.fapp, fa); return; }
      if (fEl) { openFolder(fEl.dataset.f); return; }
      const b = e.target.closest('[data-app]');
      // 编辑模式下轻点小组件：打开它的编辑面板（按住拖动不会触发）
      const wEl = e.target.closest('[data-w]');
      if (editing && wEl) { widgetEditor(wEl.dataset.w); return; }
      if (editing) { if (!b) setEditing(false); return; }
      if (wEl) { widgetTap(wEl.dataset.w, wEl); return; }
      if (b) XS.nav.openApp(b.dataset.app, b);
    });
    // 只有宽度和上次渲染一致、桌面可见时，滚动位置才代表用户翻到的页
    pagesEl.addEventListener('scroll', () => {
      const w = pagesEl.clientWidth;
      if (!w || w !== pageW || root.closest('[inert]')) return;
      const p = Math.round(pagesEl.scrollLeft / w);
      if (p === cur || p < 0 || p >= L.pages.length) return;
      cur = p;
      dotsEl.querySelectorAll('.dot').forEach((d, i) => d.toggleAttribute('aria-current', i === cur));
    }, { passive: true });
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !root || XS.nav.depth()) return;
    if (pop) closeFolder(); else if (drag) endDrag(true); else if (editing) setEditing(false);
  });
  // 格子区域尺寸变化（窗口缩放、外框切换、从隐藏变为显示）：重新算行数再渲染
  let rt, lastSize = '';
  const onSize = () => {
    if (!pagesEl) return;
    const s = pagesEl.clientWidth + 'x' + pagesEl.clientHeight;
    if (s === lastSize || !pagesEl.clientHeight) return;
    const first = !lastSize; lastSize = s;
    clearTimeout(rt);
    rt = setTimeout(() => { if (root && !drag) { const p = pendingPage; pendingPage = null; render(first ? p : undefined); } }, first ? 0 : 120);
  };
  const ro = new ResizeObserver(onSize);
  // 页面隐藏时 ResizeObserver 不回调，这两个事件兜底
  addEventListener('resize', onSize);
  document.addEventListener('visibilitychange', onSize);

  XS.renderHome = () => {
    base = XS.store.get(KEY, null);
    root = XS.ui.h(`<div class="home">
      <div class="home-pages" aria-label="桌面"></div>
      <div class="home-foot">
        <button class="he-btn tap" data-a="widget">${XS.icon('plus')}<span>添加小组件</span></button>
        <div class="home-dots" aria-label="页面"></div>
        <button class="he-btn strong tap" data-a="done">完成</button></div>
      <nav class="dock" aria-label="常用应用"></nav></div>`);
    pagesEl = $('.home-pages', root); dockEl = $('.dock', root); dotsEl = $('.home-dots', root);
    document.querySelector('.layer-home').replaceChildren(root);
    editing = false; drag = null; press = null; pop = null; L = null; lastSize = ''; cur = 0; pageW = 0; previewBak = undefined;
    bind();
    render(0);
    ro.disconnect(); ro.observe(pagesEl);
  };
})();
