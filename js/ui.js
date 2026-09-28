/* 共用交互：按下反馈、提示、底部面板、菜单、确认框、选中块（Tab / 分段选择） */
(function(){
  const ui = XS.ui = {};
  const $ = (sel, root=document) => root.querySelector(sel);
  ui.h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const overlay = () => $('.layer-overlay');
  const reduced = () => document.documentElement.dataset.motion === 'reduce';
  ui.wait = ms => new Promise(r => setTimeout(r, reduced() ? 0 : ms));

  /* 按下反馈：手指一碰就有反应；移动超过 8px 视为滚动，取消 */
  ui.bindPress = root => {
    let el = null, x = 0, y = 0;
    const clear = () => { el && el.classList.remove('is-pressed'); el = null; };
    root.addEventListener('pointerdown', e => {
      el = e.target.closest('.tap, .tap-row');
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') { el = null; return; }
      x = e.clientX; y = e.clientY; el.classList.add('is-pressed');
    }, { passive: true });
    root.addEventListener('pointermove', e => { if (el && Math.hypot(e.clientX - x, e.clientY - y) > 8) clear(); }, { passive: true });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => root.addEventListener(t, clear, { passive: true }));
  };

  /* 顶部提示 */
  let toastTimer;
  ui.toast = (text, ms=2000) => {
    let t = $('.toast', overlay());
    if (!t) { t = ui.h('<div class="toast" role="status" aria-live="polite"></div>'); overlay().appendChild(t); }
    t.textContent = text;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  };

  /* 遮罩 + 弹层的通用开关 */
  function layer(panel, { onClose, closeOnScrim=true } = {}){
    const scrim = ui.h('<div class="scrim"></div>');
    overlay().append(scrim, panel);
    requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('show'); panel.classList.add('show'); }));
    let closed = false;
    const close = async () => {
      if (closed) return; closed = true;
      scrim.classList.remove('show'); panel.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      await ui.wait(380); scrim.remove(); panel.remove();
      onClose && onClose();
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    if (closeOnScrim) scrim.addEventListener('click', close);
    return close;
  }

  /* 底部面板：content 为元素；返回 close */
  ui.sheet = ({ title, content, doneText='完成', onDone, cancelText='取消' }) => {
    const panel = ui.h(`<div class="sheet" role="dialog" aria-modal="true" aria-label="${XS.esc(title)}">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><button class="nav-btn tap" data-a="cancel">${cancelText}</button><h3>${XS.esc(title)}</h3>
      <button class="nav-btn tap" data-a="done">${doneText}</button></div><div class="sheet-body"></div></div>`);
    $('.sheet-body', panel).appendChild(content);
    const close = layer(panel);
    $('[data-a="cancel"]', panel).onclick = close;
    $('[data-a="done"]', panel).onclick = async () => { if (!onDone || (await onDone()) !== false) close(); };
    setTimeout(() => { const f = $('input,textarea', panel); f && f.focus({ preventScroll: true }); }, 420);
    return close;
  };

  /* 弹出菜单：anchor 为触发按钮；items: [{label, icon, danger, onClick}] */
  ui.menu = (anchor, items) => {
    const panel = ui.h('<div class="menu" role="menu"></div>');
    items.forEach(it => {
      const b = ui.h(`<button class="menu-item tap-row${it.danger ? ' danger' : ''}" role="menuitem"><span>${XS.esc(it.label)}</span>${it.icon ? XS.icon(it.icon) : ''}</button>`);
      b.onclick = () => { close(); it.onClick && it.onClick(); };
      panel.appendChild(b);
    });
    const close = layer(panel);
    panel.previousElementSibling.style.background = 'transparent';
    const scr = $('.screen').getBoundingClientRect(), r = anchor.getBoundingClientRect(), k = XS.frameScale || 1;
    panel.style.top = ((r.bottom - scr.top) / k + 6) + 'px';
    panel.style.right = Math.max(10, (scr.right - r.right) / k) + 'px';
    setTimeout(() => { const f = $('.menu-item', panel); f && f.focus({ preventScroll: true }); }, 50);
    return close;
  };

  /* 确认框：返回 Promise<boolean> */
  ui.confirm = ({ title, text='', ok='确定', cancel='取消', danger=false }) => new Promise(resolve => {
    const panel = ui.h(`<div class="alert" role="alertdialog" aria-modal="true"><div class="alert-body"><h3>${XS.esc(title)}</h3>${text ? `<p>${XS.esc(text)}</p>` : ''}</div>
      <div class="alert-actions"><button class="tap-row" data-a="no">${cancel}</button><button class="tap-row strong${danger ? ' danger' : ''}" data-a="yes">${ok}</button></div></div>`);
    let result = false;
    const close = layer(panel, { onClose: () => resolve(result), closeOnScrim: false });
    $('[data-a="no"]', panel).onclick = close;
    $('[data-a="yes"]', panel).onclick = () => { result = true; close(); };
    setTimeout(() => $('[data-a="no"]', panel).focus({ preventScroll: true }), 50);
  });

  /* 选中块：点一下立刻选中；按住拖动时跟手；松手吸附到最近一项 */
  ui.pillTabs = (bar, { itemSel, attr='aria-selected', index=0, onChange }) => {
    const items = [...bar.querySelectorAll(itemSel)];
    let pill = bar.querySelector('.pill');
    if (!pill) { pill = ui.h('<div class="pill" aria-hidden="true"></div>'); bar.prepend(pill); }
    let cur = index, drag = null;
    const inset = () => parseFloat(getComputedStyle(pill).left) || 0;
    const place = (x, w, sx=1, sy=1) => {
      pill.style.width = w + 'px';
      pill.style.setProperty('--x', (x - inset()) + 'px');
      pill.style.setProperty('--sx', sx); pill.style.setProperty('--sy', sy);
    };
    const mark = i => items.forEach((it, j) => it.setAttribute(attr, String(i === j)));
    const toItem = i => place(items[i].offsetLeft, items[i].offsetWidth);
    const select = (i, fire=true) => {
      const changed = i !== cur; cur = i; mark(i); toItem(i);
      if (fire && changed && onChange) onChange(i);
    };
    const localX = e => { const r = bar.getBoundingClientRect(); return (e.clientX - r.left) * (bar.offsetWidth / r.width); };
    const indexAt = x => { let best = 0, d = 1e9; items.forEach((it, i) => { const c = Math.abs(it.offsetLeft + it.offsetWidth / 2 - x); if (c < d) { d = c; best = i; } }); return best; };

    bar.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      const x = localX(e);
      drag = { id: e.pointerId, x0: x, moved: false };
      bar.setPointerCapture(e.pointerId);
      select(indexAt(x));
    });
    bar.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const x = localX(e);
      if (!drag.moved && Math.abs(x - drag.x0) < 6) return;
      drag.moved = true; pill.classList.add('dragging');
      const w = items[cur].offsetWidth, min = items[0].offsetLeft, max = items[items.length - 1].offsetLeft;
      place(Math.max(min, Math.min(max, x - w / 2)), w, 1.06, .94);
      mark(indexAt(x));
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = drag.moved; drag = null;
      pill.classList.remove('dragging');
      if (moved) select(indexAt(localX(e))); else toItem(cur);
    };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    items.forEach((it, i) => {
      it.addEventListener('click', e => { if (e.detail === 0) select(i); }); // 键盘回车/空格
      it.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return; e.preventDefault();
        const n = (cur + d + items.length) % items.length; select(n); items[n].focus();
      });
    });
    // 第一次摆放不播放动画；尺寸变化时重新对齐
    const snap = () => { pill.style.transition = 'none'; toItem(cur); pill.offsetWidth; pill.style.transition = ''; };
    new ResizeObserver(snap).observe(bar);
    mark(cur); snap();
    return { select: i => select(i), get index(){ return cur; } };
  };

  /* 状态栏时间 */
  ui.startStatusbar = () => {
    const sb = $('.statusbar');
    let last = '';
    // 每秒检查一次，分钟或飞行模式变了才重画，和桌面时钟保持同一分钟
    const render = force => {
      const d = new Date(), t = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
      const s = XS.statusIcons, fm = XS.settings.get('flightMode');
      if (force !== true && last === t + fm) return;
      last = t + fm;
      sb.innerHTML = `<span>${t}</span><div class="island"></div><div class="sb-right">${fm ? s.plane : s.signal + s.wifi}${s.battery}</div>`;
    };
    render(true); setInterval(render, 1000);
    XS.on('settings', () => render(true));
  };
})();
