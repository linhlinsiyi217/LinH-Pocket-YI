/* 桌面小组件用的图片工具：裁切（拖动 + 缩放，按固定比例输出）、全屏照片预览（左右滑动）
   都挂在弹层上，叠在编辑面板之上；Esc 只关最上面这一层 */
(function(){
  const $ = (s, r) => (r || document).querySelector(s);
  const overlay = () => $('.layer-overlay');
  const reduced = () => document.documentElement.dataset.motion === 'reduce';
  const scale = () => XS.frameScale || 1;
  const wait = ms => new Promise(r => setTimeout(r, reduced() ? 0 : ms));

  // 叠加层：淡入淡出；返回 close。Esc 在捕获阶段拦下，不会顺带关掉下面的编辑面板
  function stack(panel, onClose){
    overlay().appendChild(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('show')));
    let closed = false;
    const close = async () => {
      if (closed) return; closed = true;
      removeEventListener('keydown', onKey, true);
      panel.classList.remove('show');
      await wait(280); panel.remove();
      onClose && onClose();
    };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
    addEventListener('keydown', onKey, true);
    return close;
  }

  function readImage(file){
    return new Promise((ok, fail) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => ok({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('bad image')); };
      img.src = url;
    });
  }

  /* 裁切：ratio = 宽 / 高，out = 输出宽度（像素）。返回 Promise<dataURL | null> */
  async function crop(file, { ratio = 1, out = 720, title = '裁切图片' } = {}){
    let src;
    try { src = await readImage(file); } catch (e) { XS.ui.toast('这张图片读不出来，换一张试试'); return null; }
    const { img, url } = src;
    return new Promise(resolve => {
      const panel = XS.ui.h(`<div class="crop" role="dialog" aria-modal="true" aria-label="${XS.esc(title)}">
        <div class="crop-head"><button class="nav-btn tap" data-a="cancel">取消</button><h3>${XS.esc(title)}</h3><button class="nav-btn tap strong" data-a="ok">完成</button></div>
        <div class="crop-stage"><div class="crop-frame" style="aspect-ratio:${ratio}"><img alt="" draggable="false"></div></div>
        <label class="crop-zoom"><span class="sr-only">缩放</span>${XS.icon('image')}<input type="range" min="1" max="4" step="0.01" value="1" aria-label="缩放"></label>
        <p class="crop-tip">拖动调整位置，双指或滑块缩放</p></div>`);
      const frame = $('.crop-frame', panel), pic = $('img', frame), zoom = $('input', panel);
      pic.src = url;
      let fw = 0, fh = 0, base = 1, z = 1, ox = 0, oy = 0, result = null;
      // 图片始终盖满取景框：算出最小缩放，再限制平移范围
      const clamp = () => {
        const w = img.width * base * z, h = img.height * base * z;
        ox = Math.min(0, Math.max(fw - w, ox)); oy = Math.min(0, Math.max(fh - h, oy));
      };
      const draw = () => { clamp(); pic.style.transform = `translate3d(${ox}px,${oy}px,0) scale(${base * z})`; };
      const layout = () => {
        const r = frame.getBoundingClientRect(), k = scale();
        const nw = r.width / k, nh = r.height / k;
        if (!nw || !nh) return;
        const cx = fw ? (fw / 2 - ox) / (base * z) : img.width / 2, cy = fh ? (fh / 2 - oy) / (base * z) : img.height / 2;
        fw = nw; fh = nh; base = Math.max(fw / img.width, fh / img.height);
        ox = fw / 2 - cx * base * z; oy = fh / 2 - cy * base * z;
        draw();
      };
      const zoomTo = (nz, px = fw / 2, py = fh / 2) => {
        nz = Math.max(1, Math.min(4, nz));
        const ix = (px - ox) / (base * z), iy = (py - oy) / (base * z);
        z = nz; ox = px - ix * base * z; oy = py - iy * base * z;
        zoom.value = z; draw();
      };
      const pts = new Map();
      let last = null;
      const local = e => { const r = frame.getBoundingClientRect(), k = scale(); return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }; };
      frame.addEventListener('pointerdown', e => { frame.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); last = null; });
      frame.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return;
        const prev = pts.get(e.pointerId), cur = local(e);
        pts.set(e.pointerId, cur);
        if (pts.size === 1) { ox += cur.x - prev.x; oy += cur.y - prev.y; draw(); return; }
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (last) zoomTo(z * d / last, (a.x + b.x) / 2, (a.y + b.y) / 2);
        last = d;
      });
      const up = e => { pts.delete(e.pointerId); last = null; };
      frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up);
      frame.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoomTo(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), p.x, p.y); }, { passive: false });
      zoom.addEventListener('input', () => zoomTo(+zoom.value));
      const ro = new ResizeObserver(layout);
      const close = stack(panel, () => { ro.disconnect(); URL.revokeObjectURL(url); resolve(result); });
      ro.observe(frame);
      $('[data-a="cancel"]', panel).onclick = close;
      $('[data-a="ok"]', panel).onclick = () => {
        const s = base * z, cv = document.createElement('canvas');
        cv.width = Math.round(out); cv.height = Math.round(out / ratio);
        const g = cv.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, -ox / s, -oy / s, fw / s, fh / s, 0, 0, cv.width, cv.height);
        result = cv.toDataURL('image/jpeg', .85);
        close();
      };
    });
  }

  /* 照片预览：左右滑动，Esc / 关闭键退出，方向键切换 */
  function viewer(imgs, start = 0, caption = ''){
    if (!imgs || !imgs.length) return;
    const panel = XS.ui.h(`<div class="pview" role="dialog" aria-modal="true" aria-label="照片预览">
      <div class="pview-track">${imgs.map((src, i) => `<figure class="pview-slide"><img src="${XS.esc(src)}" alt="第 ${i + 1} 张照片"></figure>`).join('')}</div>
      <div class="pview-bar"><span class="pview-cap"></span><button class="pview-close tap" aria-label="关闭预览">${XS.icon('close')}</button></div></div>`);
    const track = $('.pview-track', panel), cap = $('.pview-cap', panel);
    const cur = () => Math.round(track.scrollLeft / (track.clientWidth || 1));
    const label = () => { cap.textContent = (caption ? caption + '  ' : '') + (imgs.length > 1 ? `${cur() + 1} / ${imgs.length}` : ''); };
    const go = i => track.scrollTo({ left: Math.max(0, Math.min(imgs.length - 1, i)) * track.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
    track.addEventListener('scroll', label, { passive: true });
    const onKey = e => { if (e.key === 'ArrowRight') go(cur() + 1); else if (e.key === 'ArrowLeft') go(cur() - 1); };
    addEventListener('keydown', onKey);
    const close = stack(panel, () => removeEventListener('keydown', onKey));
    $('.pview-close', panel).onclick = close;
    requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; label(); });
  }

  XS.media = { crop, viewer };
})();
