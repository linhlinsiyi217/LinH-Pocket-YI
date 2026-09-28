/* 应用登记 + 桌面（分页格子、小组件、Dock、长按编辑与拖动）
   每个应用在自己的文件里补上 mount()；没有 mount 的应用点开会提示「暂未开放」
   桌面布局保存在 xs.v1.home：{ v, pages: [[格子项]], dock: [应用 id] }
   格子项：{ t:'app', id, c, r } 或 { t:'w', id, kind, c, r, w, h }（c 列、r 行，从 0 开始） */
(function(){
  XS.apps = {
    chat:     { id: 'chat',     name: '聊天',    icon: 'chat',     variant: 'ai-dark',  dock: true },
    settings: { id: 'settings', name: '设置',    icon: 'settings', variant: 'ai-gray',  dock: true },
    charhall: { id: 'charhall', name: 'Char 馆', icon: 'char',     variant: 'ai-light' }
  };

  const COLS = 4, DOCK_MAX = 4, KEY = 'home', HOLD_MS = 450;
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const WIDGETS = {
    clock:     { name: '时钟',     w: 2, h: 2 },
    clockWide: { name: '时钟（宽）', w: 4, h: 2 },
    date:      { name: '日历',     w: 2, h: 2 }
  };
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
  const defaults = () => ({ v: 1,
    pages: [[{ t: 'w', id: 'w_clock', kind: 'clockWide', c: 0, r: 0, w: 4, h: 2 }, { t: 'app', id: 'charhall', c: 0, r: 2 }]],
    dock: Object.values(XS.apps).filter(a => a.dock).map(a => a.id) });
  const size = it => it.t === 'w' ? [it.w, it.h] : [1, 1];
  const removeFrom = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); };
  const clone = o => o == null ? null : JSON.parse(JSON.stringify(o));
  // base = 已保存的布局；每次渲染都从它重新整理出 L，窗口暂时变矮时挪动的位置不会写回
  let base = null;
  const save = () => { base = clone(L); XS.store.set(KEY, L); };

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
    const k = WIDGETS[o.kind];
    if (o.t === 'w' && k) return { t: 'w', id: String(o.id || XS.uid('w')), kind: o.kind, c, r, w: k.w, h: k.h };
    return null;
  }
  // 读取后整理：去掉未知应用、重复项、重叠项；超出当前行数的挪到空位；漏掉的应用补回桌面
  function normalize(){
    if (!L || !Array.isArray(L.pages)) L = defaults();
    const seen = new Set();
    L.dock = (Array.isArray(L.dock) ? L.dock : []).filter((id, i, a) => XS.apps[id] && a.indexOf(id) === i).slice(0, DOCK_MAX);
    L.dock.forEach(id => seen.add(id));
    const overflow = [], wids = new Set();
    L.pages = L.pages.map(items => {
      const out = [];
      (Array.isArray(items) ? items : []).forEach(raw => {
        const it = sanitize(raw);
        if (!it) return;
        if (it.t === 'app') { if (seen.has(it.id)) return; seen.add(it.id); }
        else { if (wids.has(it.id)) it.id = XS.uid('w'); wids.add(it.id); }
        const [w, h] = size(it);
        fits(out, it.c, it.r, w, h) ? out.push(it) : overflow.push(it);
      });
      return out;
    });
    Object.keys(XS.apps).forEach(id => { if (!seen.has(id)) overflow.push({ t: 'app', id, c: 0, r: 0 }); });
    if (!L.pages.length) L.pages.push([]);
    overflow.forEach(it => placeAnywhere(it, 0));
    L.pages = L.pages.filter(p => p.length);
    if (!L.pages.length) L.pages.push([]);
    L.v = 1;
  }

  /* ---------- 渲染 ---------- */
  const appBtn = (a, key, style='') => `<button class="app tap" data-app="${a.id}" data-key="${key}" aria-label="${esc(a.name)}"${style ? ` style="${style}"` : ''}>
    <span class="app-icon ${a.variant}">${XS.appIcons[a.icon]}</span><span class="app-label">${esc(a.name)}</span></button>`;
  const widgetBody = kind => ({
    clock:     '<div class="w-top"><span data-clock="w"></span><span data-clock="md"></span></div><div class="w-time" data-clock="t"></div>',
    clockWide: '<div class="w-time" data-clock="t"></div><div class="w-side"><div class="w-week" data-clock="w"></div><div class="w-date" data-clock="md"></div></div>',
    date:      '<div class="w-week" data-clock="w"></div><div class="w-day" data-clock="day"></div><div class="w-date" data-clock="ym"></div>'
  })[kind];
  const widgetHtml = it => `<div class="widget wk-${it.kind}" data-w="${esc(it.id)}" role="group" aria-label="${WIDGETS[it.kind].name}小组件"
    style="grid-column:${it.c + 1} / span ${it.w};grid-row:${it.r + 1} / span ${it.h}">
    <button class="w-del tap" data-del="${esc(it.id)}" aria-label="移除${WIDGETS[it.kind].name}小组件">${XS.icon('close')}</button>${widgetBody(it.kind)}</div>`;

  const curPage = () => pagesEl && pagesEl.clientWidth ? Math.round(pagesEl.scrollLeft / pagesEl.clientWidth) : 0;
  const gridOf = p => pagesEl.children[p] && pagesEl.children[p].firstElementChild;
  const pageHtml = (items, p) => `<div class="home-page" data-page="${p}"><div class="home-grid">${items.map(it => it.t === 'app'
    ? appBtn(XS.apps[it.id], 'app:' + it.id, `grid-column:${it.c + 1};grid-row:${it.r + 1}`) : widgetHtml(it)).join('')}</div></div>`;

  // 按可用高度算行数，并把剩余高度平均分给行间距，让每一页的格子都铺满、对齐
  function measure(){
    const cs = getComputedStyle(root);
    const cellH = parseFloat(cs.getPropertyValue('--cell-h')) || 84;
    const minGap = parseFloat(cs.getPropertyValue('--grid-gap-min')) || 14;
    const padX = parseFloat(cs.getPropertyValue('--grid-px')) || 14;
    const icon = parseFloat(cs.getPropertyValue('--app-icon')) || 60;
    const H = pagesEl.clientHeight, W = pagesEl.clientWidth;
    if (!H || !W) return false;   // 还没排版（页面隐藏中）：先不算，等 ResizeObserver 有了尺寸再渲染
    rows =Math.max(3, Math.min(7, Math.floor((H + minGap) / (cellH + minGap))));
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
    pagesEl.innerHTML = L.pages.map(pageHtml).join('');
    dockEl.innerHTML = L.dock.map(id => appBtn(XS.apps[id], 'dock:' + id)).join('');
    pagesEl.scrollLeft = p * pagesEl.clientWidth;
    renderDots();
    tick(true);
  }

  /* ---------- 时钟：每秒检查，分钟变了才改文字 ---------- */
  let lastKey = '';
  function tick(force){
    if (!root) return;
    const n = new Date(), key = `${n.getDate()}-${n.getHours()}-${n.getMinutes()}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    const v = {
      t: n.getHours() + ':' + String(n.getMinutes()).padStart(2, '0'),
      w: '星期' + WEEK[n.getDay()],
      md: `${n.getMonth() + 1}月${n.getDate()}日`,
      day: String(n.getDate()),
      ym: `${n.getFullYear()}年${n.getMonth() + 1}月`
    };
    root.querySelectorAll('[data-clock]').forEach(el => { el.textContent = v[el.dataset.clock]; });
  }
  setInterval(tick, 1000);

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
  function addWidget(kind){
    const k = WIDGETS[kind], it = { t: 'w', id: XS.uid('w'), kind, c: 0, r: 0, w: k.w, h: k.h };
    const p = placeAnywhere(it, curPage());
    if (p < 0) { XS.ui.toast('屏幕太小，放不下这个小组件'); return; }
    save(); render(p);
    XS.ui.toast(`已添加到第 ${p + 1} 页`);
  }
  function widgetSheet(){
    const list = XS.ui.h(`<div class="wpick">${Object.entries(WIDGETS).map(([kind, k]) => `<button class="wpick-item tap-row" data-kind="${kind}">
      <span class="wpick-shape" style="--w:${k.w};--h:${k.h}" aria-hidden="true"></span>
      <span class="wpick-text"><span class="wpick-name">${k.name}</span><span class="wpick-sub">占 ${k.w} × ${k.h} 格</span></span></button>`).join('')}
      <p class="wpick-hint">只会放进空着的格子，不会盖住图标。当前页放不下时会放到后面的页面。</p></div>`);
    const close = XS.ui.sheet({ title: '添加小组件', content: list, doneText: '完成' });
    list.addEventListener('click', e => {
      const b = e.target.closest('[data-kind]');
      if (b) { close(); addWidget(b.dataset.kind); }
    });
  }

  /* ---------- 拖动 ---------- */
  function srcOf(el){
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
    if (drag.src.kind === 'w') {
      const it = drag.src.item, rr = root.getBoundingClientRect();
      const gx = parseFloat(drag.ghost.style.left) - (gr.left - rr.left) / k - M.padX - M.wmx;
      const gy = parseFloat(drag.ghost.style.top) - (gr.top - rr.top) / k;
      return { to: 'grid', page: p, c: Math.max(0, Math.min(COLS - it.w, Math.round(gx / M.colW))), r: Math.max(0, Math.min(rows - it.h, Math.round(gy / step))) };
    }
    const lx = (x - gr.left) / k - M.padX, ly = (y - gr.top) / k;
    return { to: 'grid', page: p, c: Math.max(0, Math.min(COLS - 1, Math.floor(lx / M.colW))), r: Math.max(0, Math.min(rows - 1, Math.floor((ly + M.gap / 2) / step))) };
  }

  // 松手后会发生什么：返回 { apply, cell } 表示可以放，{ msg } 表示放不了（原位退回）
  function resolve(src, tgt){
    if (!tgt) return null;
    if (tgt.to === 'dock') {
      if (src.kind === 'w') return { msg: '小组件不能放进 Dock' };
      if (src.from === 'dock') return { dock: true, apply(){ removeFrom(L.dock, src.id); L.dock.splice(tgt.index, 0, src.id); } };
      if (L.dock.length >= DOCK_MAX) return { msg: `Dock 已满，最多放 ${DOCK_MAX} 个应用` };
      return { dock: true, apply(){ removeFrom(L.pages[src.page], src.item); L.dock.splice(tgt.index, 0, src.id); } };
    }
    const tp = tgt.page, items = L.pages[tp];
    if (!items) return null;
    const moveTo = (c, r) => () => {
      if (src.from === 'dock') { removeFrom(L.dock, src.id); items.push({ t: 'app', id: src.id, c, r }); return; }
      if (src.page !== tp) { removeFrom(L.pages[src.page], src.item); items.push(src.item); }
      src.item.c = c; src.item.r = r;
    };
    if (src.kind === 'w') {
      const it = src.item;
      return fits(items, tgt.c, tgt.r, it.w, it.h, it) ? { apply: moveTo(tgt.c, tgt.r), cell: { c: tgt.c, r: tgt.r, w: it.w, h: it.h } } : { msg: '这里放不下这个小组件', cell: { c: tgt.c, r: tgt.r, w: it.w, h: it.h }, bad: true };
    }
    const occ = occupantAt(items, tgt.c, tgt.r, src.item);
    const one = (c, r) => ({ c, r, w: 1, h: 1 });
    if (!occ) return { apply: moveTo(tgt.c, tgt.r), cell: one(tgt.c, tgt.r) };
    // 格子里已有图标、且是从桌面拖来的：两个互换位置
    if (occ.t === 'app' && src.from === 'grid') return { cell: one(tgt.c, tgt.r), apply(){
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

  function beginDrag(el, x, y, pointerId){
    const src = srcOf(el);
    if (!src) return;
    const k = scale(), r = el.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.remove('is-pressed');
    ghost.classList.add('drag-ghost');
    [ghost, ...ghost.querySelectorAll('[data-key],[data-w],[data-del],[data-clock]')].forEach(n => {
      n.removeAttribute('data-key'); n.removeAttribute('data-w'); n.removeAttribute('data-del');
    });
    ghost.removeAttribute('style');
    const left = (r.left - rr.left) / k, top = (r.top - rr.top) / k;
    Object.assign(ghost.style, { left: left + 'px', top: top + 'px', width: r.width / k + 'px', height: r.height / k + 'px' });
    root.appendChild(ghost);
    el.classList.remove('is-pressed');
    el.classList.add('drag-src');
    drag = { el, src, ghost, hint: document.createElement('div'), ox: (x - r.left) / k, oy: (y - r.top) / k, target: null, edgeT: null, x, y, id: pointerId };
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
    pagesEl.scrollTo({ left: p * pagesEl.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
    setTimeout(() => { if (drag) { renderDots(); moveDrag(drag.x, drag.y); } }, reduced() ? 20 : 420);
  }

  function moveDrag(x, y){
    const d = drag, k = scale(), rr = root.getBoundingClientRect();
    d.x = x; d.y = y;
    d.ghost.style.left = (x - rr.left) / k - d.ox + 'px';
    d.ghost.style.top = (y - rr.top) / k - d.oy + 'px';
    d.target = hitTest(x, y);
    d.res = resolve(d.src, d.target);
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
    clearTimeout(d.edgeT);
    d.hint.remove();
    dockEl.classList.remove('drop-ok', 'drop-no');
    try { root.releasePointerCapture(d.id); } catch (e) {}
    const res = cancel ? null : d.res;   // 最后一次移动时算好的结果（和松手位置一致）
    if (res && res.apply) {
      res.apply();
      normalize(); save();
      // 空页会被清掉、页码可能前移，所以按 id 找它现在在哪一页
      const at = L.pages.findIndex(items => items.some(x => x.id === d.src.id && x.t === (d.src.kind === 'w' ? 'w' : 'app')));
      render(res.dock || at < 0 ? Math.min(curPage(), L.pages.length - 1) : at);
      const sel = d.src.kind === 'w' ? `[data-w="${CSS.escape(d.src.id)}"]` : `[data-key="${res.dock ? 'dock' : 'app'}:${d.src.id}"]`;
      flyTo(d.ghost, root.querySelector(sel));
      return;
    }
    // 放不了 / 取消：回到原位
    if (res && res.msg) XS.ui.toast(res.msg);
    if (d.src.from === 'grid' && curPage() !== d.src.page) pagesEl.scrollLeft = d.src.page * pagesEl.clientWidth;
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
      let p = Math.round(s0 / w) + (dx < -40 ? 1 : dx > 40 ? -1 : 0);
      p = Math.max(0, Math.min(L.pages.length - 1, p));
      pagesEl.scrollTo({ left: p * w, behavior: reduced() ? 'auto' : 'smooth' });
      setTimeout(() => { pagesEl.style.scrollSnapType = ''; }, 450);
      if (moved) { suppress = true; releaseSuppress(); }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }

  /* ---------- 事件 ---------- */
  function bind(){
    root.addEventListener('contextmenu', e => e.preventDefault());
    root.addEventListener('pointerdown', e => {
      suppress = false;
      if (e.button > 0 || drag) return;
      if (e.target.closest('.w-del,.he-btn,.home-dots')) return;
      const el = e.target.closest('[data-key],[data-w]');
      if (!el) { if (e.pointerType === 'mouse') startSwipe(e.clientX); return; }
      press = { el, x: e.clientX, y: e.clientY, id: e.pointerId, mouse: e.pointerType === 'mouse' };
      if (!editing) press.timer = setTimeout(() => {
        const p = press; press = null;
        if (!p) return;
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
      if (editing && dist > 5) { const p = press; press = null; suppress = true; beginDrag(p.el, e.clientX, e.clientY, p.id); }
      else if (!editing && dist > 8) { clearTimeout(press.timer); const p = press; press = null; if (p.mouse) startSwipe(p.x); }
    });
    const up = cancel => e => {
      if (press && e.pointerId === press.id) { clearTimeout(press.timer); press = null; }
      if (drag && e.pointerId === drag.id) endDrag(cancel);
      if (suppress) releaseSuppress();
    };
    root.addEventListener('pointerup', up(false));
    root.addEventListener('pointercancel', up(true));
    // 拖动时不让页面跟着滚
    root.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });

    root.addEventListener('click', e => {
      if (suppress) { suppress = false; return; }
      const del = e.target.closest('[data-del]');
      if (del) { removeWidget(del.dataset.del); return; }
      const a = e.target.closest('.he-btn');
      if (a) { a.dataset.a === 'widget' ? widgetSheet() : setEditing(false); return; }
      const dot = e.target.closest('[data-dot]');
      if (dot) { pagesEl.scrollTo({ left: dot.dataset.dot * pagesEl.clientWidth, behavior: reduced() ? 'auto' : 'smooth' }); return; }
      const b = e.target.closest('[data-app]');
      if (editing) { if (!b && !e.target.closest('.widget')) setEditing(false); return; }
      if (b) XS.nav.openApp(b.dataset.app, b);
    });
    pagesEl.addEventListener('scroll', () => {
      const cur = curPage();
      dotsEl.querySelectorAll('.dot').forEach((d, i) => d.toggleAttribute('aria-current', i === cur));
    }, { passive: true });
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !root || XS.nav.depth()) return;
    if (drag) endDrag(true); else if (editing) setEditing(false);
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
    editing = false; drag = null; press = null; L = null; lastSize = '';
    bind();
    render(0);
    ro.disconnect(); ro.observe(pagesEl);
  };
})();
