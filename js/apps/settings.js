/* 设置：首页（版式沿用已认可的设置页）
   列表小工具 XS.sui 也给其它应用复用 */
(function(){
  const esc = XS.esc;
  const CHEV = '<svg class="row-chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1.2 1.2L6.8 7l-5.6 5.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* 一行：{id, icon, title, sub, value, muted, chev, sw(开关状态), disabled, tag, cls} */
  const row = r => {
    const inner = `${r.icon ? `<span class="row-icon">${XS.icon(r.icon)}</span>` : ''}
      <span class="row-main"><span class="row-title">${esc(r.title)}</span>${r.sub ? `<span class="row-sub">${esc(r.sub)}</span>` : ''}</span>
      ${r.tag ? `<span class="set-tag">${esc(r.tag)}</span>` : ''}
      ${r.value != null ? `<span class="row-value${r.muted ? ' muted' : ''}" data-value>${esc(r.value)}</span>` : ''}
      ${r.sw != null ? `<button class="switch" role="switch" aria-checked="${!!r.sw}" aria-label="${esc(r.title)}"></button>` : ''}
      ${r.chev ? CHEV : ''}`;
    const cls = `row${r.icon ? '' : ' no-icon'} ${r.cls || ''}`;
    return r.sw != null
      ? `<div class="${cls}" data-id="${r.id || ''}" data-search="${esc(r.title)}">${inner}</div>`
      : `<button class="${cls} tap-row" data-id="${r.id || ''}" data-search="${esc(r.title)}"${r.disabled ? ' aria-disabled="true"' : ''}>${inner}</button>`;
  };
  const group = (rows, { label, foot } = {}) =>
    `<div class="group-block">${label ? `<div class="group-label">${esc(label)}</div>` : ''}<div class="group">${rows.map(row).join('')}</div>${foot ? `<div class="group-foot">${esc(foot)}</div>` : ''}</div>`;
  /* 分段选择：options [[值, 文字]] */
  const seg = (title, key, options) => `<div class="seg-row" data-seg="${key}"><div class="row-title">${esc(title)}</div>
    <div class="segmented" role="radiogroup" aria-label="${esc(title)}">${options.map(([v, t]) => `<button class="seg" role="radio" data-v="${v}">${esc(t)}</button>`).join('')}</div></div>`;
  /* 把分段选择和设置项绑定 */
  const bindSeg = (root, key, onPick) => {
    const box = root.querySelector(`[data-seg="${key}"] .segmented`);
    const btns = [...box.querySelectorAll('.seg')];
    const cur = String(XS.settings.get(key));
    XS.ui.pillTabs(box, { itemSel: '.seg', attr: 'aria-checked', index: Math.max(0, btns.findIndex(b => b.dataset.v === cur)),
      onChange: i => { const v = btns[i].dataset.v; onPick ? onPick(v) : XS.settings.set(key, v); } });
  };
  /* 开关：点整行都能切换 */
  const bindSwitch = (root, id, key, after) => {
    const r = root.querySelector(`[data-id="${id}"]`), sw = r.querySelector('.switch');
    r.addEventListener('click', () => {
      const v = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', v); XS.settings.set(key, v); after && after(v);
    });
  };
  XS.sui = { row, group, seg, bindSeg, bindSwitch, CHEV };

  const soon = name => XS.ui.toast(`「${name}」暂未开放`);
  const apiState = () => XS.api.configured() ? '已配置' : '未配置';

  function mount(){
    const p = XS.nav.page({ title: '设置', large: true, grouped: true, back: false, cls: 'set-root' });
    const prof = XS.profile.get();
    p.body.innerHTML = `
      <label class="search">${XS.icon('search')}<input type="search" placeholder="搜索" aria-label="搜索设置"></label>
      <div class="list-wrap">
        <div class="group" data-nosearch><button class="user-card tap-row" data-id="profile">
          <span class="avatar">${prof.name && prof.name !== '我' ? esc(prof.name.slice(0, 1)) : XS.icon('person')}</span>
          <span class="row-main"><span class="name">${esc(prof.name || '我')}</span><span class="sub">本机使用 · 未登录，数据只保存在这台设备</span></span>${CHEV}</button></div>
        ${group([
          { id: 'flight', icon: 'airplane', title: '飞行模式', sw: XS.settings.get('flightMode') },
          { id: 'security', icon: 'lock', title: '密码与安全', value: XS.passcode.enabled() ? '已开启' : '未开启', muted: true, chev: true },
          { id: 'api', icon: 'plug', title: 'API 连接', value: apiState(), chev: true },
          { id: 'voice', icon: 'wave', title: '语音设定', value: '未开放', muted: true, chev: true }
        ])}
        ${group([
          { id: 'general', icon: 'gear', title: '通用', value: '未开放', muted: true, chev: true },
          { id: 'display', icon: 'sun', title: '显示与亮度', chev: true },
          { id: 'homescreen', icon: 'grid', title: '主屏幕与 App 资源库', chev: true },
          { id: 'access', icon: 'access', title: '辅助功能', chev: true }
        ])}
        ${group([
          { id: 'perm', icon: 'shield', title: '应用权限', chev: true },
          { id: 'data', icon: 'db', title: '数据管理', chev: true },
          { id: 'backup', icon: 'cloud', title: '云备份', value: '未开放', muted: true, chev: true }
        ])}
        ${group([
          { id: 'changelog', icon: 'refresh', title: '更新日志', tag: XS.changelog.VERSION, chev: true }
        ])}
        <div class="set-empty" hidden>没有找到相关设置</div>
      </div>`;
    const v = p.view;
    bindSwitch(v, 'flight', 'flightMode', on => XS.ui.toast(on ? '飞行模式已开启：AI 请求已暂停' : '飞行模式已关闭'));

    const names = { voice: '语音设定', general: '通用', backup: '云备份' };
    v.addEventListener('click', e => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      const id = b.dataset.id;
      if (names[id]) return soon(names[id]);
      if (id === 'changelog') return XS.nav.push(XS.changelog.settingsPage());
      const page = XS.settingsPages[id];
      if (page) XS.nav.push(page());
    });

    // 搜索：按名称筛选
    const input = v.querySelector('.search input'), empty = v.querySelector('.set-empty');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let any = false;
      v.querySelectorAll('.group-block').forEach(g => {
        let shown = 0;
        g.querySelectorAll('.row').forEach(r => { const ok = !q || r.dataset.search.toLowerCase().includes(q); r.hidden = !ok; shown += ok; });
        g.hidden = !shown; any = any || shown > 0;
      });
      v.querySelector('[data-nosearch]').hidden = !!q;
      empty.hidden = any;
    });

    // 回到这一页时刷新状态（例如 API 刚填好）
    const refresh = () => {
      const val = v.querySelector('[data-id="api"] [data-value]'); if (val) val.textContent = apiState();
      const sec = v.querySelector('[data-id="security"] [data-value]'); if (sec) sec.textContent = XS.passcode.enabled() ? '已开启' : '未开启';
      const fm = v.querySelector('[data-id="flight"] .switch'); fm.setAttribute('aria-checked', !!XS.settings.get('flightMode'));
      const pr = XS.profile.get(), card = v.querySelector('.user-card');
      card.querySelector('.name').textContent = pr.name || '我';
      card.querySelector('.avatar').innerHTML = pr.name && pr.name !== '我' ? esc(pr.name.slice(0, 1)) : XS.icon('person');
    };
    v.addEventListener('shown', refresh);
    return v;
  }
  XS.apps.settings.mount = mount;
})();
