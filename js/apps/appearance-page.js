/* 外观与插件：入口「我 → 外观与插件」
   根页面只放方案和六个分类入口，每个分类是一个独立页面，各自只放本类设置，不用上下翻很久。
   每页顶部有常驻预览（可收起），改完立刻看到效果。
   打开本页时会在 .screen 上挂 xs-safe 停用高级 CSS，所以自定义样式写坏也进得来；
   预览区单独再套一层作用域，实时看到效果。 */
(function(){
  const esc = XS.esc, A = XS.appearance;
  const page = (title, cls) => XS.nav.page({ title, grouped: true, back: true, cls: 'set-page ap-page ' + (cls || '') });

  /* ============================ 通用控件 ============================ */
  const segRow = (label, path, options) => {
    const cur = String(A.get(path) == null ? '' : A.get(path));
    return `<div class="ap-row" data-segrow="${esc(path)}"><span class="ap-label">${esc(label)}</span>
      <span class="segmented" role="radiogroup" aria-label="${esc(label)}">${options.map(([v, t]) =>
        `<button class="seg" role="radio" data-v="${esc(v)}" aria-checked="${String(v) === cur}">${esc(t)}</button>`).join('')}</span></div>`;
  };
  const bindSeg = (root, path, onChange) => {
    const bar = root.querySelector(`[data-segrow="${CSS.escape(path)}"] .segmented`);
    if (!bar) return;
    const btns = [...bar.querySelectorAll('.seg')];
    btns.forEach(b => b.addEventListener('click', () => {
      if (b.getAttribute('aria-checked') === 'true') return;
      btns.forEach(x => x.setAttribute('aria-checked', String(x === b)));
      A.set(path, b.dataset.v);
      onChange && onChange();
    }));
  };
  const textRow = (label, path, ph) => `<label class="ap-row"><span class="ap-label">${esc(label)}</span>
    <input class="ap-input" data-text="${esc(path)}" value="${esc(A.get(path) || '')}" placeholder="${esc(ph || '')}"></label>`;
  const bindText = (root, path, onChange) => {
    const el = root.querySelector(`[data-text="${CSS.escape(path)}"]`); if (!el) return;
    el.addEventListener('input', () => { A.set(path, el.value.trim()); onChange && onChange(); });
  };
  const rangeRow = (label, path, min, max, step, unit) => {
    const v = A.get(path);
    const empty = v === '' || v == null;
    return `<label class="ap-row"><span class="ap-label">${esc(label)}</span>
      <span class="ap-range"><input type="range" data-range="${esc(path)}" min="${min}" max="${max}" step="${step}" value="${empty ? min : v}" aria-label="${esc(label)}">
      <b data-rangeval="${esc(path)}">${empty ? '默认' : v + (unit || '')}</b></span></label>`;
  };
  const bindRange = (root, path, unit, onChange) => {
    const el = root.querySelector(`[data-range="${CSS.escape(path)}"]`); if (!el) return;
    const out = root.querySelector(`[data-rangeval="${CSS.escape(path)}"]`);
    el.addEventListener('input', () => {
      const v = Number(el.value);
      A.set(path, v);
      if (out) out.textContent = v + (unit || '');
      onChange && onChange();
    });
  };
  const swRow = (label, path) => {
    const on = !!A.get(path);
    return `<div class="row ap-swrow" data-sw="${esc(path)}"><span class="row-main"><span class="row-title">${esc(label)}</span></span>
      <button class="switch" role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button></div>`;
  };
  const bindSw = (root, path, onChange) => {
    const r = root.querySelector(`[data-sw="${CSS.escape(path)}"]`); if (!r) return;
    const sw = r.querySelector('.switch');
    r.addEventListener('click', () => {
      const v = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(v));
      A.set(path, v);
      onChange && onChange();
    });
  };

  /* —— 颜色：色块 + 色值；点色块开取色面板（色相 / 饱和度 / 明度 / 透明度四个滑块） —— */
  const colorRow = (label, path, fallback) => {
    const cur = A.get(path);
    return `<div class="ap-row"><span class="ap-label">${esc(label)}</span>
      <span class="ap-color">
        <button class="ap-swatch${cur ? '' : ' is-default'}" data-swatch="${esc(path)}" data-fallback="${esc(fallback || '#FFFFFF')}"
          aria-label="选择${esc(label)}"${cur ? ` style="--sw:${esc(cur)}"` : ''}></button>
        <span class="ap-cval" data-cval="${esc(path)}">${cur ? esc(cur) : '默认'}</span>
        <button class="ap-mini" data-clear="${esc(path)}" aria-label="清除${esc(label)}">${XS.icon('close')}</button>
      </span></div>`;
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (d){
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  };
  const hslCss = (h, s, l, a) => a >= 1 ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${Math.round(a * 100) / 100})`;

  const QUICK = [
    ['#000000', '黑'], ['#3C3C43', '深灰'], ['#8A8A8E', '灰'], ['#C7C7CC', '浅灰'],
    ['#FFFFFF', '白'], ['#0A84FF', '蓝'], ['#34C759', '绿'], ['#FF3B30', '红'],
    ['#FF9500', '橙'], ['#BF5AF2', '紫'], ['#FF2D92', '玫红'], ['#00C7BE', '青']
  ];

  function pickColor(path, label, fallback, onChange){
    const cur = A.get(path);
    const seed = cur || fallback || '#FFFFFF';
    const rgb = A.toRgb(seed) || { r: 255, g: 255, b: 255, a: 1 };
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const st = { h: hsl.h, s: hsl.s, l: hsl.l, a: rgb.a };
    const value = () => hslCss(st.h, st.s, st.l, st.a);

    const box = XS.ui.h(`<div class="ap-pick">
      <div class="ap-pick-top"><span class="ap-pick-chip"><i data-chip></i></span><code class="ap-pick-val" data-val></code></div>
      <div class="ap-pick-sliders">
        <label class="ap-pick-row"><span>色相</span><input type="range" data-k="h" min="0" max="360" step="1" aria-label="色相"><b data-out="h"></b></label>
        <label class="ap-pick-row"><span>饱和度</span><input type="range" data-k="s" min="0" max="100" step="1" aria-label="饱和度"><b data-out="s"></b></label>
        <label class="ap-pick-row"><span>明度</span><input type="range" data-k="l" min="0" max="100" step="1" aria-label="明度"><b data-out="l"></b></label>
        <label class="ap-pick-row"><span>透明度</span><input type="range" data-k="a" min="0" max="100" step="1" aria-label="透明度"><b data-out="a"></b></label>
      </div>
      <div class="ap-pick-quick" role="group" aria-label="常用颜色">${QUICK.map(([v, n]) =>
        `<button class="ap-q" data-q="${v}" style="--q:${v}" aria-label="${n}"></button>`).join('')}</div>
      <p class="ap-pick-tip">按钮色可以拉到很高饱和度；按钮上的字会按底色深浅自动取黑或白，保证读得清。</p>
    </div>`);

    const chip = box.querySelector('[data-chip]');
    const valEl = box.querySelector('[data-val]');
    const sliders = k => box.querySelector(`[data-k="${k}"]`);
    const outs = k => box.querySelector(`[data-out="${k}"]`);

    function paint(){
      const css = value();
      chip.style.background = css;
      valEl.textContent = css;
      const { h, s, l } = st;
      // 滑块轨道跟着当前颜色走，拖到哪一段一眼能看出来
      sliders('h').style.setProperty('--track', 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)');
      sliders('s').style.setProperty('--track', `linear-gradient(to right,hsl(${h},0%,${l}%),hsl(${h},100%,${l}%))`);
      sliders('l').style.setProperty('--track', `linear-gradient(to right,#000,hsl(${h},${s}%,50%),#fff)`);
      sliders('a').style.setProperty('--track', `linear-gradient(to right,hsla(${h},${s}%,${l}%,0),hsl(${h},${s}%,${l}%))`);
      ['h','s','l'].forEach(k => { outs(k).textContent = st[k] + (k === 'h' ? '°' : '%'); });
      outs('a').textContent = Math.round(st.a * 100) + '%';
      sliders('a').value = Math.round(st.a * 100);
    }
    ['h','s','l','a'].forEach(k => {
      sliders(k).value = k === 'a' ? Math.round(st.a * 100) : st[k];
      sliders(k).addEventListener('input', () => {
        st[k] = k === 'a' ? Number(sliders(k).value) / 100 : Number(sliders(k).value);
        paint();
      });
    });
    box.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
      const c = A.toRgb(b.dataset.q); if (!c) return;
      const n = rgbToHsl(c.r, c.g, c.b);
      st.h = n.h; st.s = n.s; st.l = n.l; st.a = 1; paint();
    }));
    paint();

    XS.ui.sheet({ title: label, content: box, doneText: '完成', onDone(){
      A.set(path, value());
      onChange && onChange();
    }});
  }

  // 改完把色块和色值一起刷新（不整页重建，免得滚动位置和焦点跑掉）
  const syncColorRow = (root, path) => {
    const cur = A.get(path);
    const sw = root.querySelector(`[data-swatch="${CSS.escape(path)}"]`);
    const val = root.querySelector(`[data-cval="${CSS.escape(path)}"]`);
    if (sw){
      if (cur){ sw.style.setProperty('--sw', cur); sw.classList.remove('is-default'); }
      else { sw.style.removeProperty('--sw'); sw.classList.add('is-default'); }
    }
    if (val) val.textContent = cur || '默认';
  };
  const bindColor = (root, path, fallback, onChange) => {
    const sw = root.querySelector(`[data-swatch="${CSS.escape(path)}"]`);
    const clr = root.querySelector(`[data-clear="${CSS.escape(path)}"]`);
    const after = () => { syncColorRow(root, path); onChange && onChange(); };
    if (sw) sw.addEventListener('click', () => pickColor(path, sw.getAttribute('aria-label').replace(/^选择/, ''), fallback, after));
    if (clr) clr.addEventListener('click', () => { A.set(path, ''); after(); });
  };

  /* —— 图片：上传 → 裁切 → 存成 dataURL —— */
  const imgRow = (label, path, ratio) => {
    const cur = A.get(path);
    return `<div class="ap-row ap-imgrow"><span class="ap-label">${esc(label)}</span>
      <span class="ap-imgctl"><span class="ap-thumb"${cur ? ` style="background-image:url('${esc(cur)}')"` : ''}></span>
      <button class="btn btn-sm btn-plain tap" data-pick="${esc(path)}">${cur ? '更换图片' : '选择图片'}</button>
      ${cur ? `<button class="ap-mini" data-imgclear="${esc(path)}" aria-label="清除${esc(label)}">${XS.icon('close')}</button>` : ''}</span></div>`;
  };
  function bindImg(root, path, ratio, onChange){
    const btn = root.querySelector(`[data-pick="${CSS.escape(path)}"]`);
    if (btn) btn.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.addEventListener('change', async () => {
        if (!inp.files[0]) return;
        const url = await XS.media.crop(inp.files[0], { ratio, out: ratio >= 1.5 ? 720 : 480, title: '选择图片' });
        if (url){ A.set(path, url); onChange && onChange(); }
      });
      inp.click();
    });
    const clr = root.querySelector(`[data-imgclear="${CSS.escape(path)}"]`);
    if (clr) clr.addEventListener('click', () => { A.set(path, ''); onChange && onChange(); });
  }

  /* ============================ 常驻预览 ============================ */
  let prevOpen = true;   // 预览展开 / 收起，只在本次会话里记住
  const previewHtml = () => `<div class="ap-prev">
      <div class="ap-prev-head">
        <span>预览</span><span class="ap-prev-tip">示例消息，不是真实聊天</span>
        <button class="ap-prev-toggle tap" data-prevtoggle aria-expanded="${prevOpen}">${prevOpen ? '收起' : '展开'}</button>
      </div>
      <div class="ap-scope"${prevOpen ? '' : ' hidden'}>
        <div class="ap-chat">
          <div class="msg-time">今天 14:20</div>
          <div class="msg other first"><span class="avatar" style="--av:32px">林</span><div class="bubble">在吗</div></div>
          <div class="msg self"><div class="bubble">在的。今晚有空的话我们聊聊上次那个方案吧，我整理了几点想法，想听听你怎么看。</div></div>
          <div class="msg other"><span class="av-space"></span><div class="bubble"><span class="ap-quote">对方引用了你的一条消息</span>我看一下，晚点回你</div></div>
          <div class="msg-state err"><span class="ap-fail">${XS.icon('alert')}<span>发送失败 · 点此重试</span></span></div>
        </div>
        <div class="ap-tabbar" aria-hidden="true"><span class="on">消息</span><span>联系人</span><span>动态</span><span>我</span></div>
      </div>
    </div>`;
  const previewStyle = draft => {
    if (!A.get('css.on')) return '';
    const list = draft ? ['global','chat','left','right'].map(k => draft[k]) : A.cssBlocks();
    return list.filter(v => v && v.trim() && A.cssSafe(v))
      .map(css => `@supports (selector(&)){.ap-scope{${css}}}`).join('');
  };
  const mountPreview = (host, draft) => { host.innerHTML = previewHtml() + `<style>${previewStyle(draft)}</style>`; };

  /* 所有外观页共用：预览是标题栏下面的固定一段（页面用 flex 纵向排列），
     可收起，返回 refresh。 */
  function withPreview(p, draft){
    const host = document.createElement('div');
    host.className = 'ap-prev-host';
    p.view.insertBefore(host, p.body.parentNode);   // .scroll 之前、.navbar 之后
    const fit = () => mountPreview(host, draft);
    fit();
    p.view.addEventListener('click', e => {
      if (!e.target.closest('[data-prevtoggle]')) return;
      prevOpen = !prevOpen;
      fit();
    });
    return fit;
  }

  /* ============================ 方案 ============================ */
  const presetsBlock = () => {
    const list = A.presets(), cur = A.current();
    return `<div class="group-block"><div class="group-label">方案</div><div class="group">
      ${list.map(p => `<button class="row ap-preset tap-row" data-preset="${esc(p.id)}"${p.id === cur.id ? ' aria-current="true"' : ''}>
        <span class="row-main"><span class="row-title">${esc(p.name)}</span>${p.id === A.DEFAULT_ID ? '<span class="row-sub">没有任何自定义的原始外观</span>' : ''}</span>
        ${p.id === cur.id ? `<span class="ap-now">${XS.icon('check')}使用中</span>` : ''}</button>`).join('')}
    </div><div class="group-foot">切换方案立刻换成那一套外观；方案里带了明暗，也会跟着切。</div></div>`;
  };
  const bindPresets = (root, after) => {
    root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      if (b.getAttribute('aria-current') === 'true') return;
      A.usePreset(b.dataset.preset);
      after && after();
    }));
  };

  /* ============================ 导出 / 导入 ============================ */
  function exportSheet(){
    const text = A.exportText();
    const box = XS.ui.h(`<div class="ap-io"><p class="ap-io-tip">下面是整套外观配置。复制保存好，换设备时粘回去就能还原。</p>
      <textarea class="ap-io-text" readonly rows="8">${esc(text)}</textarea>
      <button class="btn btn-primary tap ap-io-copy" type="button">复制到剪贴板</button>
      <p class="ap-io-tip" data-msg></p></div>`);
    const ta = box.querySelector('textarea'), msg = box.querySelector('[data-msg]');
    box.querySelector('.ap-io-copy').addEventListener('click', async () => {
      ta.select();
      try { await navigator.clipboard.writeText(text); msg.textContent = '已复制'; }
      catch (e) { msg.textContent = '复制不了，请长按上面的文字手动复制'; }
      setTimeout(() => { msg.textContent = ''; }, 2500);
    });
    XS.ui.sheet({ title: '导出配置', content: box, doneText: '完成' });
  }
  function importSheet(after){
    const box = XS.ui.h(`<div class="ap-io"><p class="ap-io-tip">把导出的内容粘到下面。格式不对不会覆盖现在的配置。</p>
      <textarea class="ap-io-text" rows="8" placeholder="粘贴导出的 JSON"></textarea>
      <p class="ap-io-tip" data-msg></p></div>`);
    const ta = box.querySelector('textarea'), msg = box.querySelector('[data-msg]');
    XS.ui.sheet({ title: '导入配置', content: box, doneText: '导入', onDone(){
      const r = A.importText(ta.value.trim());
      if (!r.ok){ msg.textContent = '导入失败：' + r.error + '（原配置没动）'; return false; }
      XS.ui.toast('已导入 ' + r.count + ' 套方案');
      after && after();
    }});
  }

  /* ============================ 页面 ============================ */
  const pages = {};

  /* 根页面：只放方案和分类入口 */
  pages.root = () => {
    const p = page('外观与插件', 'ap-root');
    const GROUPS = [
      ['theme', '整体主题', 'sun', '颜色、明暗、桌面背景'],
      ['bubble', '聊天气泡', 'chat', '左右两侧的背景、文字、圆角、尾巴'],
      ['chatbg', '聊天背景', 'image', '对话页的视频、图片或纯色'],
      ['avatar', '头像与图标', 'person', '头像形状与描边'],
      ['tabbar', '底部导航', 'grid', '两种内置样式、高度、圆角、透明度'],
      ['css', '高级 CSS', 'code', '按分段写自定义样式']
    ];
    p.body.innerHTML = `
      <div data-presets>${presetsBlock()}</div>
      <div class="group-block"><div class="group-label">分类设置</div><div class="group">
        ${GROUPS.map(([id, title, icon, sub]) => XS.sui.row({
          id, icon, title, sub, chev: true, value: (id === 'css' ? (A.get('css.on') ? '已启用' : '未启用') : (A.get(id + '.on') ? '已自定义' : '默认'))
        })).join('')}
      </div><div class="group-foot">每一类都能单独开、单独关。关掉某一类，只恢复那一类的默认，其他类不动。</div></div>
      <div class="group-block"><div class="group-label">配置</div><div class="group">
        ${XS.sui.row({ id: 'newp', icon: 'plus', title: '新建方案' })}
        ${XS.sui.row({ id: 'export', icon: 'download', title: '导出配置' })}
        ${XS.sui.row({ id: 'import', icon: 'upload', title: '导入配置' })}
        ${XS.sui.row({ id: 'reset', title: '恢复本方案全部默认', cls: 'link center' })}
        ${A.current().id !== A.DEFAULT_ID ? XS.sui.row({ id: 'delp', title: '删除本方案', cls: 'link center danger' }) : ''}
      </div><div class="group-foot">外观只写在这台设备的浏览器里，不会上传。自定义 CSS 只作用在小手机内部；
        万一样式写坏进不来，在网址后面加 <code>?safe=1</code> 打开就能停用全部自定义样式。</div></div>`;

    const refresh = withPreview(p);
    bindPresets(p.body, () => sync());

    const sync = () => {
      p.body.querySelector('[data-presets]').innerHTML = presetsBlock();
      bindPresets(p.body, () => sync());
      p.body.querySelectorAll('[data-id]').forEach(b => {
        const k = b.dataset.id, v = b.querySelector('[data-value]');
        if (!v) return;
        if (k === 'css') v.textContent = A.get('css.on') ? '已启用' : '未启用';
        else if (['theme','bubble','chatbg','avatar','tabbar'].includes(k))
          v.textContent = A.get((k === 'chatbg' ? 'chat' : k) + '.on') ? '已自定义' : '默认';
      });
      refresh();
    };
    p.view.addEventListener('click', e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      const id = b.dataset.id;
      const open = { theme: pages.theme, bubble: pages.bubble, chatbg: pages.chatbg, avatar: pages.avatar, tabbar: pages.tabbar, css: pages.css }[id];
      if (open) { XS.nav.push(open()); return; }
      if (id === 'export') exportSheet();
      else if (id === 'import') importSheet(() => sync());
      else if (id === 'newp') {
        const box = XS.ui.h(`<label class="field"><span>方案名称</span><input maxlength="20" placeholder="例如 深色夜读" value=""></label>`);
        XS.ui.sheet({ title: '新建方案', content: box, doneText: '新建', onDone(){ A.addPreset(box.querySelector('input').value.trim() || '新方案'); sync(); } });
      }
      else if (id === 'reset') XS.ui.confirm({ title: '恢复本方案默认？', text: '当前方案里的外观设置都会清掉，其他方案不动。', ok: '恢复', danger: true })
        .then(ok => { if (ok){ A.resetAll(); sync(); } });
      else if (id === 'delp') XS.ui.confirm({ title: '删除本方案？', text: '「' + A.current().name + '」的外观设置会被删除，无法恢复。', ok: '删除', danger: true })
        .then(ok => { if (ok){ A.removePreset(A.current().id); sync(); } });
    });
    const off = A.on(() => { if (!p.view.isConnected) return off(); sync(); });
    return p.view;
  };

  /* 整体主题 */
  pages.theme = () => {
    const p = page('整体主题');
    const render = () => {
      p.body.innerHTML = `
        <div class="group-block"><div class="group">${swRow('启用整体主题', 'theme.on')}</div>
          <div class="group-foot">关掉就整段回到默认；下面每一项留空只影响那一项。</div></div>
        <div class="group-block"><div class="group-label">明暗</div><div class="group">
          ${segRow('模式', 'theme.mode', [['', '不改'], ['light', '浅色'], ['dark', '深色'], ['system', '跟随系统']])}
        </div><div class="group-foot">方案自带明暗时，切换方案会一起切换浅色 / 深色。</div></div>
        <div class="group-block"><div class="group-label">颜色</div><div class="group">
          ${colorRow('页面底色', 'theme.bg', '#FFFFFF')}
          ${colorRow('卡片面', 'theme.surface', '#FFFFFF')}
          ${colorRow('正文颜色', 'theme.text', '#000000')}
          ${colorRow('次要文字', 'theme.secondary', '#8A8A8E')}
          ${colorRow('主按钮', 'theme.primary', '#1C1C1E')}
        </div><div class="group-foot">主按钮可以拉到高饱和度；按钮上的字会按底色深浅自动取黑或白。
          深色模式下这些颜色同样生效，请自己在深色下确认对比度。</div></div>
        <div class="group-block"><div class="group-label">桌面背景</div><div class="group">
          ${textRow('背景视频地址', 'theme.wallVideo', 'https://… 或项目内文件名')}
          ${imgRow('背景图', 'theme.wallImg', 1.9)}
          ${colorRow('背景色', 'theme.wall', '#FFFFFF')}
        </div><div class="group-foot">优先级：视频 &gt; 图片 &gt; 纯色。视频按地址引用，不转成数据存进本地——本地存储放不下视频。</div></div>`;
      const refresh = withPreview(p);
      bindSw(p.body, 'theme.on', refresh);
      bindSeg(p.body, 'theme.mode', () => { const m = A.get('theme.mode'); if (m) XS.settings.set('theme', m); refresh(); });
      [['bg','#FFFFFF'],['surface','#FFFFFF'],['text','#000000'],['secondary','#8A8A8E'],['primary','#1C1C1E'],['wall','#FFFFFF']]
        .forEach(([k, fb]) => bindColor(p.body, 'theme.' + k, fb, refresh));
      bindText(p.body, 'theme.wallVideo', refresh);
      bindImg(p.body, 'theme.wallImg', 1.9, render);
      return refresh;
    };
    let refresh = render();
    const off = A.on(() => { if (!p.view.isConnected) return off(); refresh(); });
    return p.view;
  };

  /* 聊天气泡 */
  const bubbleFields = side => `
    ${colorRow('背景色', `bubble.${side}.bg`, side === 'other' ? '#FFFFFF' : '#F0F0F2')}
    ${imgRow('背景图（九宫格）', `bubble.${side}.img`, 1.6)}
    ${colorRow('文字颜色', `bubble.${side}.text`, side === 'other' ? '#000000' : '#000000')}
    ${rangeRow('圆角', `bubble.${side}.radius`, 0, 28, 1, 'px')}
    ${rangeRow('描边粗细', `bubble.${side}.border`, 0, 3, 0.5, 'px')}
    ${colorRow('描边颜色', `bubble.${side}.borderColor`, '#000000')}
    ${segRow('阴影', `bubble.${side}.shadow`, [['', '默认'], ['0 0 0 rgba(0,0,0,0)', '无'], ['0 1px 2px rgba(0,0,0,.06)', '轻'], ['0 2px 8px rgba(0,0,0,.10)', '中'], ['0 6px 18px rgba(0,0,0,.16)', '强']])}
    ${textRow('内边距', `bubble.${side}.pad`, '例如 9px 13px')}
    ${swRow('小尾巴', `bubble.${side}.tail`)}`;

  pages.bubble = () => {
    const p = page('聊天气泡');
    let side = 'other';
    const render = () => {
      const s = side;
      p.body.innerHTML = `
        <div class="group-block"><div class="group">${swRow('启用气泡自定义', 'bubble.on')}</div>
          <div class="group-foot">关掉整段回到默认：对方左白细边、自己右浅灰实底。</div></div>
        <div class="group-block"><div class="ap-row"><span class="ap-label">设置哪一侧</span>
          <span class="segmented" role="radiogroup" aria-label="设置哪一侧">
            <button class="seg" role="radio" data-side="other" aria-checked="${s === 'other'}">对方（左）</button>
            <button class="seg" role="radio" data-side="self" aria-checked="${s === 'self'}">自己（右）</button>
          </span></div></div>
        <div class="group-block"><div class="group-label">${s === 'other' ? '对方（左）' : '自己（右）'} · 只改这一侧</div><div class="group">
          ${bubbleFields(s)}
        </div><div class="group-foot">背景图和背景色同时存在时以图为准。图片按九宫格拉伸，四角不变形，因此圆角对图片气泡不生效。</div></div>
        <div class="group-block"><div class="group">
          ${XS.sui.row({ id: 'resetSide', title: '恢复这一侧的默认', cls: 'link center' })}
        </div></div>`;
      const refresh = withPreview(p);
      bindSw(p.body, 'bubble.on', refresh);
      p.body.querySelectorAll('[data-side]').forEach(b => b.addEventListener('click', () => { side = b.dataset.side; render(); }));
      ['bg','text','borderColor'].forEach(k => bindColor(p.body, `bubble.${s}.${k}`, k === 'borderColor' ? '#000000' : (s === 'other' ? '#FFFFFF' : '#F0F0F2'), refresh));
      ['radius','border'].forEach(k => bindRange(p.body, `bubble.${s}.${k}`, 'px', refresh));
      bindSeg(p.body, `bubble.${s}.shadow`, refresh);
      bindText(p.body, `bubble.${s}.pad`, refresh);
      bindSw(p.body, `bubble.${s}.tail`, refresh);
      bindImg(p.body, `bubble.${s}.img`, 1.6, render);
      p.body.querySelector('[data-id="resetSide"]').addEventListener('click', () => {
        const blank = A.blank().bubble[s];
        A.setMany(Object.keys(blank).map(k => [`bubble.${s}.${k}`, blank[k]]));
        render();
      });
      return refresh;
    };
    let refresh = render();
    const off = A.on(() => { if (!p.view.isConnected) return off(); refresh(); });
    return p.view;
  };

  /* 聊天背景 */
  pages.chatbg = () => {
    const p = page('聊天背景');
    const render = () => {
      p.body.innerHTML = `
        <div class="group-block"><div class="group">${swRow('启用聊天背景', 'chat.on')}</div>
          <div class="group-foot">只影响聊天对话页，其他页面不受影响。</div></div>
        <div class="group-block"><div class="group">
          ${textRow('背景视频地址', 'chat.video', 'https://… 或项目内文件名')}
          ${imgRow('背景图', 'chat.media', 1.0)}
          ${colorRow('背景色', 'chat.color', '#FFFFFF')}
        </div><div class="group-foot">优先级：视频 &gt; 图片 &gt; 纯色。视频按地址引用，不转成数据存进本地。
          图和视频都铺满对话区并裁切，不会被拉变形；开启「减少动态效果」时视频只停在第一帧。</div></div>`;
      const refresh = withPreview(p);
      bindSw(p.body, 'chat.on', refresh);
      bindText(p.body, 'chat.video', refresh);
      bindColor(p.body, 'chat.color', '#FFFFFF', refresh);
      bindImg(p.body, 'chat.media', 1.0, render);
      return refresh;
    };
    let refresh = render();
    const off = A.on(() => { if (!p.view.isConnected) return off(); refresh(); });
    return p.view;
  };

  /* 头像与图标 */
  pages.avatar = () => {
    const p = page('头像与图标');
    p.body.innerHTML = `
      <div class="group-block"><div class="group">${swRow('启用头像自定义', 'avatar.on')}</div></div>
      <div class="group-block"><div class="group">
        ${segRow('形状', 'avatar.shape', [['', '默认'], ['50%', '圆形'], ['14px', '圆角方形'], ['6px', '方形']])}
        ${rangeRow('描边粗细', 'avatar.border', 0, 4, 0.5, 'px')}
        ${colorRow('描边颜色', 'avatar.borderColor', '#000000')}
      </div><div class="group-foot">只作用于聊天里的头像。应用图标不做任何滤镜处理，保持原来的样子。</div></div>`;
    const refresh = withPreview(p);
    bindSw(p.body, 'avatar.on', refresh);
    bindSeg(p.body, 'avatar.shape', refresh);
    bindRange(p.body, 'avatar.border', 'px', refresh);
    bindColor(p.body, 'avatar.borderColor', '#000000', refresh);
    const off = A.on(() => { if (!p.view.isConnected) return off(); refresh(); });
    return p.view;
  };

  /* 底部导航 */
  pages.tabbar = () => {
    const p = page('底部导航');
    p.body.innerHTML = `
      <div class="group-block"><div class="group">${swRow('启用底部导航自定义', 'tabbar.on')}</div>
        <div class="group-foot">底部导航是聊天首页那一条。两种内置样式，图标线宽和选中块不变。</div></div>
      <div class="group-block"><div class="group">
        ${segRow('样式', 'tabbar.style', [['', '默认'], ['glass', '轻玻璃浮层'], ['flat', '极简贴底']])}
        ${rangeRow('高度', 'tabbar.h', 48, 76, 2, 'px')}
        ${rangeRow('圆角', 'tabbar.radius', 0, 34, 1, 'px')}
        ${rangeRow('透明度', 'tabbar.alpha', 0.4, 1, 0.05, '')}
        ${colorRow('底色', 'tabbar.bg', '#FFFFFF')}
      </div><div class="group-foot">「极简贴底」通到底部并去掉阴影，只留一条上边线，圆角对它不生效。内容区会自动让出高度，不会挡住消息。</div></div>`;
    const refresh = withPreview(p);
    bindSw(p.body, 'tabbar.on', refresh);
    bindSeg(p.body, 'tabbar.style', refresh);
    bindRange(p.body, 'tabbar.h', 'px', refresh);
    bindRange(p.body, 'tabbar.radius', 'px', refresh);
    bindRange(p.body, 'tabbar.alpha', '', refresh);
    bindColor(p.body, 'tabbar.bg', '#FFFFFF', refresh);
    const off = A.on(() => { if (!p.view.isConnected) return off(); refresh(); });
    return p.view;
  };

  /* 高级 CSS */
  const CSS_PARTS = [
    { k: 'global', label: '全局', tip: '整个小手机内部（不含系统状态栏）' },
    { k: 'chat',   label: '聊天页', tip: '只作用在对话页，选择器建议以 .conv 开头' },
    { k: 'left',   label: '气泡 · 对方（左）', tip: '对应 .msg.other .bubble' },
    { k: 'right',  label: '气泡 · 自己（右）', tip: '对应 .msg.self .bubble' }
  ];
  const CSS_TEMPLATE = {
    global: `.screen{ }                        /* 最外层：整台小手机的容器 */\n.home{ }                          /* 桌面 */\n.navbar{ }                        /* 顶部标题栏 */\n.tabbar{ }                        /* 底部导航 */\n.row{ }                           /* 设置里的列表行 */`,
    chat:   `.conv{ }                          /* 对话页整体 */\n.conv .scroll{ }                  /* 对话滚动区 */\n.msg-time{ }                      /* 时间小字 */\n.composer{ }                      /* 底部输入栏 */\n.composer textarea{ }             /* 输入框 */`,
    left:   `.msg.other .bubble{ }               /* 对方气泡外框 */\n.msg.other.last .bubble::after{ }  /* 小尾巴（开启后才有） */`,
    right:  `.msg.self .bubble{ }                /* 自己气泡外框 */\n.msg.self.last .bubble::after{ }   /* 小尾巴（开启后才有） */`
  };

  pages.css = () => {
    const p = page('高级 CSS', 'ap-css');
    const draft = { global: A.get('css.global') || '', chat: A.get('css.chat') || '', left: A.get('css.left') || '', right: A.get('css.right') || '' };
    p.body.innerHTML = `
      <div class="group-block"><div class="group">${swRow('启用自定义 CSS', 'css.on')}</div>
        <div class="group-foot">下面编辑的内容<b>先只做预览</b>，点「保存本段」才写进正式配置。作用范围只有小手机内部，
        不会影响浏览器和「外观与插件」这个入口本身。</div></div>
      <div class="group-block"><div class="group">
        ${XS.sui.row({ id: 'insert', icon: 'plus', title: '插入默认模板', sub: '把光标所在那一段的原始选择器填进去', chev: true })}
      </div></div>
      ${CSS_PARTS.map(pt => `
        <div class="group-block"><div class="group-label">${esc(pt.label)}</div>
          <div class="ap-css-box" data-part="${pt.k}">
            <p class="ap-css-tip">${esc(pt.tip)}</p>
            <textarea class="ap-css-text" rows="6" spellcheck="false" aria-label="${esc(pt.label)} 自定义 CSS">${esc(draft[pt.k])}</textarea>
            <p class="ap-css-msg" data-msg="${pt.k}"></p>
            <div class="ap-css-acts">
              <button class="btn btn-sm btn-plain tap" data-preview="${pt.k}">预览</button>
              <button class="btn btn-sm btn-primary tap" data-save="${pt.k}">保存本段</button>
              <button class="btn btn-sm btn-plain tap" data-revert="${pt.k}">撤销改动</button>
              <button class="btn btn-sm btn-plain tap" data-clear="${pt.k}">清空本段</button>
            </div>
          </div>
        </div>`).join('')}
      <div class="group-block"><div class="group-foot">
        保存时会检查括号是否配平、有没有写标签，不合法的那一段不会生效，其他段不受影响。
        如果整个页面被样式挡住进不来，在网址后面加 <code>?safe=1</code> 打开即可停用全部自定义样式。
      </div></div>`;

    const refresh = withPreview(p, draft);
    bindSw(p.body, 'css.on', refresh);

    const ta = k => p.body.querySelector(`[data-part="${k}"] textarea`);
    const say = (k, text, bad) => {
      const el = p.body.querySelector(`[data-msg="${k}"]`);
      if (el){ el.textContent = text; el.classList.toggle('bad', !!bad); }
    };
    p.body.addEventListener('click', e => {
      const b = e.target.closest('[data-preview],[data-save],[data-revert],[data-clear],[data-id]');
      if (!b) return;
      if (b.dataset.id === 'insert'){
        const active = document.activeElement;
        const k = CSS_PARTS.map(x => x.k).find(x => ta(x) === active) || 'global';
        ta(k).value = CSS_TEMPLATE[k]; draft[k] = ta(k).value;
        say(k, '已插入模板，改完点「保存本段」');
        refresh();
        return;
      }
      const k = b.dataset.preview || b.dataset.save || b.dataset.revert || b.dataset.clear;
      if (!k) return;
      if (b.dataset.preview){
        draft[k] = ta(k).value;
        const ok = A.cssSafe(draft[k]);
        say(k, ok ? '这一段可以正常解析' : '括号不配平，保存会被跳过', !ok);
        refresh();
      } else if (b.dataset.save){
        const v = ta(k).value;
        if (v.trim() && !A.cssSafe(v)){ say(k, '括号不配平或有标签，没有保存', true); return; }
        draft[k] = v;
        A.setMany([['css.' + k, v], ['css.on', true]]);
        say(k, v.trim() ? '已保存' : '这一段已清空');
        refresh();
      } else if (b.dataset.revert){
        ta(k).value = A.get('css.' + k) || '';
        draft[k] = ta(k).value;
        say(k, '已回到上次保存的内容');
        refresh();
      } else if (b.dataset.clear){
        ta(k).value = ''; draft[k] = '';
        A.setMany([['css.' + k, '']]);
        say(k, '已清空（其他段不动）');
        refresh();
      }
    });
    const off = A.on(() => { if (!p.view.isConnected) return off(); refresh(); });
    return p.view;
  };

  /* 打开外观页期间停用高级 CSS，保证这个入口永远点得进来 */
  XS.appearancePages = pages;
  XS.appearancePages.open = () => {
    const v = pages.root();
    A.safe(true);
    const layer = document.querySelector('.layer-apps');
    const obs = new MutationObserver(() => {
      if (!v.isConnected){ obs.disconnect(); A.safe(false); }
    });
    obs.observe(layer, { childList: true, subtree: true });
    return v;
  };
})();
