/* 外观与插件：入口「我 → 外观与插件」
   分组：方案 / 整体主题 / 聊天气泡 / 聊天背景 / 头像与图标 / 底部导航 / 高级 CSS
   打开本页时会在 .screen 上挂 xs-safe 停用高级 CSS，所以自定义样式写坏也进得来；
   页面里的预览区单独再套一层作用域，实时看到效果。 */
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
  const colorRow = (label, path) => `<div class="ap-row"><span class="ap-label">${esc(label)}</span>
    <span class="ap-color"><input type="color" data-color="${esc(path)}" value="${hexOr(A.get(path))}" aria-label="${esc(label)}">
    <input class="ap-input ap-hex" data-hex="${esc(path)}" value="${esc(A.get(path) || '')}" placeholder="留空 = 默认" aria-label="${esc(label)}色值">
    <button class="ap-mini" data-clear="${esc(path)}" aria-label="清除${esc(label)}">${XS.icon('close')}</button></span></div>`;
  const hexOr = v => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#ffffff');
  const bindColor = (root, path, onChange) => {
    const c = root.querySelector(`[data-color="${CSS.escape(path)}"]`);
    const h = root.querySelector(`[data-hex="${CSS.escape(path)}"]`);
    const x = root.querySelector(`[data-clear="${CSS.escape(path)}"]`);
    if (c) c.addEventListener('input', () => { A.set(path, c.value); if (h) h.value = c.value; onChange && onChange(); });
    if (h) h.addEventListener('input', () => {
      const v = h.value.trim();
      A.set(path, v);
      if (c && /^#[0-9a-f]{6}$/i.test(v)) c.value = v;
      onChange && onChange();
    });
    if (x) x.addEventListener('click', () => { A.set(path, ''); if (h) h.value = ''; onChange && onChange(); });
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
    // range 一动就当成设了值；想回到「默认」用整段的重置
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

  /* ============================ 实时预览 ============================ */
  // 用真实的 .msg / .bubble / .avatar 结构，所以变量和自定义 CSS 都能看到效果
  const previewHtml = () => `<div class="ap-prev">
      <div class="ap-prev-head"><span>预览</span><span class="ap-prev-tip">示例消息，不是真实聊天</span></div>
      <div class="ap-scope">
        <div class="ap-chat">
          <div class="msg-time">今天 14:20</div>
          <div class="msg other first"><span class="avatar" style="--av:32px">林</span><div class="bubble">在吗</div></div>
          <div class="msg self"><div class="bubble">在的。今晚有空的话我们聊聊上次那个方案吧，我整理了几点想法，想听听你怎么看。</div></div>
          <div class="msg other"><span class="av-space"></span><div class="bubble"><span class="ap-quote">对方引用了你的一条消息</span>我看一下，晚点回你</div></div>
          <div class="msg self"><div class="bubble">好，不急</div></div>
          <div class="msg-state err"><span class="ap-fail">${XS.icon('alert')}<span>发送失败 · 点此重试</span></span></div>
        </div>
        <div class="ap-tabbar" aria-hidden="true"><span class="on">消息</span><span>联系人</span><span>动态</span><span>我</span></div>
      </div>
    </div>`;
  // 预览自己带一份自定义 CSS（作用域收到 .ap-scope 里），所以本页开着 xs-safe 也看得到效果
  const previewStyle = draft => {
    if (!A.get('css.on')) return '';
    const list = draft ? ['global','chat','left','right'].map(k => draft[k]) : A.cssBlocks();
    return list.filter(v => v && v.trim() && A.cssSafe(v))
      .map(css => `@supports (selector(&)){.ap-scope{${css}}}`).join('');
  };
  const mountPreview = (host, draft) => { host.innerHTML = previewHtml() + `<style>${previewStyle(draft)}</style>`; };
  const tick = () => { const host = document.querySelector('.ap-prev-host'); if (host) mountPreview(host); };

  /* ============================ 方案 ============================ */
  const presetsBlock = () => {
    const list = A.presets(), cur = A.current();
    return `<div class="group-block"><div class="group-label">方案</div><div class="group">
      ${list.map(p => `<button class="row ap-preset tap-row" data-preset="${esc(p.id)}"${p.id === cur.id ? ' aria-current="true"' : ''}>
        <span class="row-main"><span class="row-title">${esc(p.name)}</span>${p.id === A.DEFAULT_ID ? '<span class="row-sub">没有任何自定义的原始外观</span>' : ''}</span>
        ${p.id === cur.id ? `<span class="ap-now">${XS.icon('check')}使用中</span>` : ''}</button>`).join('')}
    </div><div class="group-foot">切换方案会立刻换成那一套外观；方案里带了明暗，也会跟着切。</div></div>`;
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

  pages.root = () => {
    const p = page('外观与插件', 'ap-root');
    const groupRows = () => ['theme','bubble','chat','avatar','tabbar','css'].map(k => {
      const on = !!A.get(k + '.on');
      const label = { theme:'整体主题', bubble:'聊天气泡', chat:'聊天背景', avatar:'头像与图标', tabbar:'底部导航', css:'高级 CSS' }[k];
      const icon = { theme:'sun', bubble:'chat', chat:'image', avatar:'person', tabbar:'grid', css:'code' }[k];
      const id = k === 'chat' ? 'chatbg' : k;
      const value = k === 'css' ? (on ? '已启用' : '未启用') : (on ? '已自定义' : '默认');
      return XS.sui.row({ id, icon, title: label, value, chev: true });
    }).join('');

    p.body.innerHTML = `
      <div class="ap-prev-host"></div>
      <div data-presets>${presetsBlock()}</div>
      <div class="group-block"><div class="group">${groupRows()}</div>
        <div class="group-foot">每一段都能单独开、单独关。关掉某一段，只恢复那一段的默认，其他段不动。</div></div>
      <div class="group-block"><div class="group">
        ${XS.sui.row({ id: 'export', icon: 'download', title: '导出配置' })}
        ${XS.sui.row({ id: 'import', icon: 'upload', title: '导入配置' })}
      </div></div>
      <div class="group-block"><div class="group">
        ${XS.sui.row({ id: 'newp', icon: 'plus', title: '新建方案' })}
      </div><div class="group-foot">默认方案始终保留；当前这套方案里的自定义可以一键恢复默认，别的方案不动。</div></div>
      <div class="group-block"><div class="group">
        ${XS.sui.row({ id: 'reset', title: '恢复本方案全部默认', cls: 'link center' })}
        ${A.current().id !== A.DEFAULT_ID ? XS.sui.row({ id: 'delp', title: '删除本方案', cls: 'link center danger' }) : ''}
      </div></div>
      <div class="group-block"><div class="group-foot">
        外观只写在这台设备的浏览器里，不会上传。自定义 CSS 只作用在小手机内部；
        万一样式写坏进不来，在网址后面加 <code>?safe=1</code> 打开就能停用全部自定义样式。
      </div></div>`;

    mountPreview(p.body.querySelector('.ap-prev-host'));
    bindPresets(p.body, () => sync());

    const sync = () => {
      p.body.querySelector('[data-presets]').innerHTML = presetsBlock();
      bindPresets(p.body, () => sync());
      p.body.querySelectorAll('[data-id]').forEach(b => {
        const k = b.dataset.id === 'chatbg' ? 'chat' : b.dataset.id;
        const v = b.querySelector('[data-value]');
        if (v && ['theme','bubble','chat','avatar','tabbar','css'].includes(k))
          v.textContent = k === 'css' ? (A.get(k + '.on') ? '已启用' : '未启用') : (A.get(k + '.on') ? '已自定义' : '默认');
      });
      tick();
    };
    p.view.addEventListener('click', e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      const id = b.dataset.id;
      if (id === 'theme') XS.nav.push(pages.theme());
      else if (id === 'bubble') XS.nav.push(pages.bubble());
      else if (id === 'chatbg') XS.nav.push(pages.chatbg());
      else if (id === 'avatar') XS.nav.push(pages.avatar());
      else if (id === 'tabbar') XS.nav.push(pages.tabbar());
      else if (id === 'css') XS.nav.push(pages.css());
      else if (id === 'export') exportSheet();
      else if (id === 'import') importSheet(() => sync());
      else if (id === 'newp') {
        const box = XS.ui.h(`<label class="field"><span>方案名称</span><input maxlength="20" placeholder="例如 深色夜读" value=""></label>`);
        XS.ui.sheet({ title: '新建方案', content: box, doneText: '新建', onDone(){ A.addPreset(box.querySelector('input').value.trim() || '新方案'); sync(); } });
      }
      else if (id === 'reset') XS.ui.confirm({ title: '恢复本方案默认？', text: '当前方案里的主题、气泡、背景、头像和底栏自定义都会清掉，其他方案不动。', ok: '恢复', danger: true })
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
        <div class="ap-prev-host"></div>
        <div class="group-block"><div class="group">${swRow('启用整体主题', 'theme.on')}</div>
          <div class="group-foot">关掉就整段回到默认；下面每一项留空只影响那一项。</div></div>
        <div class="group-block"><div class="group-label">明暗</div><div class="group">
          ${segRow('模式', 'theme.mode', [['', '不改'], ['light', '浅色'], ['dark', '深色'], ['system', '跟随系统']])}
        </div><div class="group-foot">方案自带明暗时，切换方案会一起切换浅色 / 深色。</div></div>
        <div class="group-block"><div class="group-label">颜色</div><div class="group">
          ${colorRow('页面底色', 'theme.bg')}
          ${colorRow('卡片面', 'theme.surface')}
          ${colorRow('正文颜色', 'theme.text')}
          ${colorRow('次要文字', 'theme.secondary')}
          ${colorRow('主按钮', 'theme.primary')}
        </div><div class="group-foot">深色模式下这些颜色同样生效，请自己在深色下确认对比度。</div></div>
        <div class="group-block"><div class="group-label">桌面背景</div><div class="group">
          ${textRow('背景视频地址', 'theme.wallVideo', 'https://… 或项目内文件名')}
          ${imgRow('背景图', 'theme.wallImg', 1.9)}
          ${colorRow('背景色', 'theme.wall')}
        </div><div class="group-foot">优先级：视频 &gt; 图片 &gt; 纯色。视频按地址引用，不转成数据存进本地——本地存储放不下视频。都留空就是现在的纯白 / 纯黑桌面。</div></div>`;
      mountPreview(p.body.querySelector('.ap-prev-host'));
      bindSw(p.body, 'theme.on', tick);
      bindSeg(p.body, 'theme.mode', () => { const m = A.get('theme.mode'); if (m) XS.settings.set('theme', m); tick(); });
      ['bg','surface','text','secondary','primary','wall'].forEach(k => bindColor(p.body, 'theme.' + k, tick));
      bindText(p.body, 'theme.wallVideo', tick);
      bindImg(p.body, 'theme.wallImg', 1.9, render);
    };
    render();
    const off = A.on(() => { if (!p.view.isConnected) return off(); tick(); });
    return p.view;
  };

  /* 聊天气泡 */
  const bubbleFields = side => `
    ${colorRow('背景色', `bubble.${side}.bg`)}
    ${imgRow('背景图（九宫格）', `bubble.${side}.img`, 1.6)}
    ${colorRow('文字颜色', `bubble.${side}.text`)}
    ${rangeRow('圆角', `bubble.${side}.radius`, 0, 28, 1, 'px')}
    ${rangeRow('描边粗细', `bubble.${side}.border`, 0, 3, 0.5, 'px')}
    ${colorRow('描边颜色', `bubble.${side}.borderColor`)}
    ${segRow('阴影', `bubble.${side}.shadow`, [['', '默认'], ['0 0 0 rgba(0,0,0,0)', '无'], ['0 1px 2px rgba(0,0,0,.06)', '轻'], ['0 2px 8px rgba(0,0,0,.10)', '中'], ['0 6px 18px rgba(0,0,0,.16)', '强']])}
    ${textRow('内边距', `bubble.${side}.pad`, '例如 9px 13px')}
    ${swRow('小尾巴', `bubble.${side}.tail`)}`;

  pages.bubble = () => {
    const p = page('聊天气泡');
    let side = 'other';
    const render = () => {
      const s = side;
      p.body.innerHTML = `
        <div class="ap-prev-host"></div>
        <div class="group-block"><div class="group">${swRow('启用气泡自定义', 'bubble.on')}</div>
          <div class="group-foot">关掉整段回到默认：对方左白细边、自己右浅灰实底。</div></div>
        <div class="group-block"><div class="ap-row"><span class="ap-label">设置哪一侧</span>
          <span class="segmented" role="radiogroup" aria-label="设置哪一侧">
            <button class="seg" role="radio" data-side="other" aria-checked="${s === 'other'}">对方（左）</button>
            <button class="seg" role="radio" data-side="self" aria-checked="${s === 'self'}">自己（右）</button>
          </span></div></div>
        <div class="group-block"><div class="group-label">${s === 'other' ? '对方（左）' : '自己（右）'}</div><div class="group">
          ${bubbleFields(s)}
        </div><div class="group-foot">背景图和背景色同时存在时以图为准。图片按九宫格拉伸，四角不变形，因此圆角对图片气泡不生效。</div></div>
        <div class="group-block"><div class="group">
          ${XS.sui.row({ id: 'resetSide', title: '恢复这一侧的默认', cls: 'link center' })}
        </div></div>`;
      mountPreview(p.body.querySelector('.ap-prev-host'));
      bindSw(p.body, 'bubble.on', tick);
      p.body.querySelectorAll('[data-side]').forEach(b => b.addEventListener('click', () => { side = b.dataset.side; render(); }));
      ['bg','text','borderColor'].forEach(k => bindColor(p.body, `bubble.${s}.${k}`, tick));
      ['radius','border'].forEach(k => bindRange(p.body, `bubble.${s}.${k}`, 'px', tick));
      bindSeg(p.body, `bubble.${s}.shadow`, tick);
      bindText(p.body, `bubble.${s}.pad`, tick);
      bindSw(p.body, `bubble.${s}.tail`, tick);
      bindImg(p.body, `bubble.${s}.img`, 1.6, render);
      p.body.querySelector('[data-id="resetSide"]').addEventListener('click', () => {
        const blank = A.blank().bubble[s];
        A.setMany(Object.keys(blank).map(k => [`bubble.${s}.${k}`, blank[k]]));
        render();
      });
    };
    render();
    const off = A.on(() => { if (!p.view.isConnected) return off(); tick(); });
    return p.view;
  };

  /* 聊天背景 */
  pages.chatbg = () => {
    const p = page('聊天背景');
    const render = () => {
      p.body.innerHTML = `
        <div class="ap-prev-host"></div>
        <div class="group-block"><div class="group">${swRow('启用聊天背景', 'chat.on')}</div>
          <div class="group-foot">只影响聊天对话页，其他页面不受影响。</div></div>
        <div class="group-block"><div class="group">
          ${textRow('背景视频地址', 'chat.video', 'https://… 或项目内文件名')}
          ${imgRow('背景图', 'chat.media', 1.0)}
          ${colorRow('背景色', 'chat.color')}
        </div><div class="group-foot">优先级：视频 &gt; 图片 &gt; 纯色。视频按地址引用，不转成数据存进本地。图和视频都铺满对话区并裁切，不会被拉变形；开启「减少动态效果」时视频只停在第一帧。</div></div>`;
      mountPreview(p.body.querySelector('.ap-prev-host'));
      bindSw(p.body, 'chat.on', tick);
      bindText(p.body, 'chat.video', tick);
      bindColor(p.body, 'chat.color', tick);
      bindImg(p.body, 'chat.media', 1.0, render);
    };
    render();
    const off = A.on(() => { if (!p.view.isConnected) return off(); tick(); });
    return p.view;
  };

  /* 头像与图标 */
  pages.avatar = () => {
    const p = page('头像与图标');
    p.body.innerHTML = `
      <div class="ap-prev-host"></div>
      <div class="group-block"><div class="group">${swRow('启用头像自定义', 'avatar.on')}</div></div>
      <div class="group-block"><div class="group">
        ${segRow('形状', 'avatar.shape', [['', '默认'], ['50%', '圆形'], ['14px', '圆角方形'], ['6px', '方形']])}
        ${rangeRow('描边粗细', 'avatar.border', 0, 4, 0.5, 'px')}
        ${colorRow('描边颜色', 'avatar.borderColor')}
      </div><div class="group-foot">只作用于聊天里的头像。应用图标不做任何滤镜处理，保持原来的样子。</div></div>`;
    mountPreview(p.body.querySelector('.ap-prev-host'));
    bindSw(p.body, 'avatar.on', tick);
    bindSeg(p.body, 'avatar.shape', tick);
    bindRange(p.body, 'avatar.border', 'px', tick);
    bindColor(p.body, 'avatar.borderColor', tick);
    const off = A.on(() => { if (!p.view.isConnected) return off(); tick(); });
    return p.view;
  };

  /* 底部导航 */
  pages.tabbar = () => {
    const p = page('底部导航');
    p.body.innerHTML = `
      <div class="ap-prev-host"></div>
      <div class="group-block"><div class="group">${swRow('启用底部导航自定义', 'tabbar.on')}</div>
        <div class="group-foot">底部导航是聊天首页那一条。两种内置样式，图标线宽和选中块不变。</div></div>
      <div class="group-block"><div class="group">
        ${segRow('样式', 'tabbar.style', [['', '默认'], ['glass', '轻玻璃浮层'], ['flat', '极简贴底']])}
        ${rangeRow('高度', 'tabbar.h', 48, 76, 2, 'px')}
        ${rangeRow('圆角', 'tabbar.radius', 0, 34, 1, 'px')}
        ${rangeRow('透明度', 'tabbar.alpha', 0.4, 1, 0.05, '')}
        ${colorRow('底色', 'tabbar.bg')}
      </div><div class="group-foot">「极简贴底」通到底部并去掉阴影，只留一条上边线，圆角对它不生效。内容区会自动让出高度，不会挡住消息。</div></div>`;
    mountPreview(p.body.querySelector('.ap-prev-host'));
    bindSw(p.body, 'tabbar.on', tick);
    bindSeg(p.body, 'tabbar.style', tick);
    bindRange(p.body, 'tabbar.h', 'px', tick);
    bindRange(p.body, 'tabbar.radius', 'px', tick);
    bindRange(p.body, 'tabbar.alpha', '', tick);
    bindColor(p.body, 'tabbar.bg', tick);
    const off = A.on(() => { if (!p.view.isConnected) return off(); tick(); });
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
      <div class="ap-prev-host"></div>
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

    mountPreview(p.body.querySelector('.ap-prev-host'));
    bindSw(p.body, 'css.on', tick);

    const ta = k => p.body.querySelector(`[data-part="${k}"] textarea`);
    const say = (k, text, bad) => {
      const el = p.body.querySelector(`[data-msg="${k}"]`);
      if (el){ el.textContent = text; el.classList.toggle('bad', !!bad); }
    };
    const paint = () => {
      const host = p.body.querySelector('.ap-prev-host');
      mountPreview(host, draft);
    };

    p.body.addEventListener('click', e => {
      const b = e.target.closest('[data-preview],[data-save],[data-revert],[data-clear],[data-id]');
      if (!b) return;
      if (b.dataset.id === 'insert'){
        const active = document.activeElement;
        const k = CSS_PARTS.map(x => x.k).find(x => ta(x) === active) || 'global';
        ta(k).value = CSS_TEMPLATE[k]; draft[k] = ta(k).value;
        say(k, '已插入模板，改完点「保存本段」');
        paint();
        return;
      }
      const k = b.dataset.preview || b.dataset.save || b.dataset.revert || b.dataset.clear;
      if (!k) return;
      if (b.dataset.preview){
        draft[k] = ta(k).value;
        const ok = A.cssSafe(draft[k]);
        say(k, ok ? '这一段可以正常解析' : '括号不配平，保存会被跳过', !ok);
        paint();
      } else if (b.dataset.save){
        const v = ta(k).value;
        if (v.trim() && !A.cssSafe(v)){ say(k, '括号不配平或有标签，没有保存', true); return; }
        draft[k] = v;
        A.setMany([['css.' + k, v], ['css.on', true]]);
        say(k, v.trim() ? '已保存' : '这一段已清空');
        tick();
      } else if (b.dataset.revert){
        ta(k).value = A.get('css.' + k) || '';
        draft[k] = ta(k).value;
        say(k, '已回到上次保存的内容');
        paint();
      } else if (b.dataset.clear){
        ta(k).value = ''; draft[k] = '';
        A.setMany([['css.' + k, '']]);
        say(k, '已清空（其他段不动）');
        tick();
      }
    });
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
