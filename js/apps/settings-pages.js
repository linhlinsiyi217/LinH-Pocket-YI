/* 设置的子页面：个人资料、API 连接、显示与亮度、辅助功能、应用权限、密码与安全、数据管理 */
(function(){
  const { group, seg, bindSeg, bindSwitch } = XS.sui;
  const esc = XS.esc;
  const page = (title, html) => {
    const p = XS.nav.page({ title, grouped: true, back: true, cls: 'set-page' });
    p.body.innerHTML = html;
    return p;
  };
  const inline = (label, name, value, { type='text', ph='' } = {}) =>
    `<div class="field-inline"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"></div>`;

  const pages = XS.settingsPages = {};

  pages.profile = () => {
    const pr = XS.profile.get();
    const p = page('我的资料', `
      <div class="group-block"><div class="group">
        ${inline('名字', 'name', pr.name, { ph: '聊天里对方怎么称呼你' })}
        <div class="field-inline top"><label for="f-persona">人设</label><textarea id="f-persona" name="persona" placeholder="可不填。例如：大学生，喜欢猫">${esc(pr.persona)}</textarea></div>
      </div><div class="group-foot">会告诉聊天里的角色你是谁。只保存在这台设备，自动保存。</div></div>`);
    p.body.addEventListener('input', e => XS.profile.set({ [e.target.name]: e.target.value }));
    return p.view;
  };

  pages.api = () => {
    const a = XS.settings.get('api');
    const p = page('API 连接', `
      <div class="group-block"><div class="group-label">接口（OpenAI 兼容格式）</div><div class="group">
        ${inline('地址', 'baseUrl', a.baseUrl, { type: 'url', ph: 'https://api.example.com/v1' })}
        ${inline('密钥', 'apiKey', a.apiKey, { type: 'password', ph: 'sk-...' })}
        ${inline('模型', 'model', a.model, { ph: '例如 gpt-4o-mini' })}
      </div><div class="group-foot">自动保存。密钥以明文保存在这台设备的浏览器里，只会发送到你填写的地址。</div></div>
      <div class="group-block"><div class="group">${XS.sui.row({ id: 'test', title: '测试连接', cls: 'link center' })}</div></div>
      <div class="set-status" role="status" aria-live="polite"></div>`);
    const st = p.body.querySelector('.set-status');
    const show = (cls, icon, text) => { st.className = 'set-status ' + cls; st.innerHTML = (icon ? XS.icon(icon) : '') + `<span>${esc(text)}</span>`; };
    p.body.addEventListener('input', e => { XS.settings.set('api.' + e.target.name, e.target.value.trim()); st.innerHTML = ''; });
    let testing = false;
    p.body.querySelector('[data-id="test"]').addEventListener('click', async () => {
      if (testing) return;
      testing = true; show('busy', '', '正在测试…');
      try { const r = await XS.api.test(); show('ok', 'check', '连接成功，模型回复：' + r.slice(0, 40)); }
      catch (e) { show('err', 'alert', XS.api.configured() ? e.message : '请先填写上面的地址和模型'); }
      testing = false;
    });
    return p.view;
  };

  pages.display = () => {
    const p = page('显示与亮度', `
      <div class="group-block"><div class="group">
        ${seg('外观', 'theme', [['light', '浅色'], ['dark', '深色'], ['system', '跟随系统']])}
        ${seg('玻璃质感', 'glass', [['default', '默认'], ['soft', '柔和'], ['clear', '通透'], ['off', '关闭']])}
        ${XS.sui.row({ id: 'pblur', title: '渐进模糊', sw: XS.settings.get('pblur') })}
      </div><div class="group-foot">玻璃和渐进模糊只用在底部 Tab、Dock、输入框、菜单这些悬浮区域。手机卡顿时可以关闭。</div></div>
      <div class="group-block"><div class="group-label">高级自定义</div><div class="group">
        ${[['image', '壁纸'], ['apps', '应用图标'], ['type', '字体'], ['palette', '颜色']].map(([icon, title]) =>
          XS.sui.row({ id: 'c-' + icon, icon, title, tag: '即将支持', disabled: true })).join('')}
      </div></div>
      <div class="group-block"><div class="group">${XS.sui.row({ id: 'reset', title: '恢复默认外观', cls: 'link center' })}</div></div>`);
    bindSeg(p.body, 'theme'); bindSeg(p.body, 'glass');
    bindSwitch(p.body, 'pblur', 'pblur');
    p.body.querySelector('[data-id="reset"]').addEventListener('click', async () => {
      if (!(await XS.ui.confirm({ title: '恢复默认外观？', text: '外观、玻璃、动态效果和文字大小会回到默认，聊天记录不受影响。', ok: '恢复' }))) return;
      XS.settings.resetAppearance();
      XS.nav.back(); XS.ui.toast('已恢复默认外观');
    });
    return p.view;
  };

  /* 引导设置：统一定义，供多个页面复用；面向一加 Ace 5 至尊版 / ColorOS 16 */
  const GUIDES = [
    ['saver', '关闭省电模式', ['打开手机「设置」', '进入「电池」', '关闭「省电模式」和「超级省电」', '检查「自动开启省电」设置（如有）']],
    ['background', '后台运行权限', ['打开「设置」→「应用管理」', '找到承载小手机的浏览器或应用', '进入「应用信息」', '开启「允许后台活动」']],
    ['battery', '电池优化与自启动', ['在「应用信息」页面', '点击「电池」或「电池优化」', '选择「不受限制」或「无限制」', '检查「自启动」是否允许']],
    ['recent', '锁定最近任务', ['打开手机多任务界面（最近任务）', '找到承载小手机的应用卡片', '下拉该卡片', '看到锁图标即锁定成功']],
    ['standby', '睡眠待机优化（可选）', ['打开「设置」→「电池」', '查看「睡眠待机优化」或类似选项', '如果小手机后台仍被清理，可尝试调整']]
  ];

  pages.access = () => {
    const guideDone = id => !!XS.settings.get('guide.' + id);
    const guideRow = ([id, title]) => guideDone(id)
      ? `<div class="row no-icon guide-row" data-guide="${id}"><span class="row-main"><span class="row-title">${esc(title)}</span></span><span class="guide-done">${XS.icon('check')}已完成</span></div>`
      : `<div class="row no-icon guide-row" data-guide="${id}"><span class="row-main"><span class="row-title">${esc(title)}</span></span>
          <button class="guide-btn" data-view="${id}">查看</button>${guideSeen(id) ? `<button class="guide-btn ok" data-ok="${id}">我开好了</button>` : ''}</div>`;
    const guideSeen = id => !!XS.settings.get('guideSeen.' + id);
    const renderGuides = () => GUIDES.map(guideRow).join('');

    const p = page('辅助功能', `
      <div class="group-block"><div class="group">
        ${seg('动态效果', 'motion', [['system', '跟随系统'], ['reduce', '减少'], ['full', '完整']])}
      </div><div class="group-foot">选择「减少」后，页面切换和选中块会直接到位，不再滑动。</div></div>
      <div class="group-block"><div class="group-label">文字大小</div><div class="group">
        ${seg('大小', 'textScale', [['0.9', '小'], ['1', '标准'], ['1.1', '大'], ['1.2', '特大']])}
        <div class="set-preview">这是一段预览文字。<small>聊天、设置等页面的文字会一起变化。</small></div>
      </div></div>
      <div class="group-block"><div class="group-label">引导设置</div><div class="group" data-guides>
        ${renderGuides()}
      </div><div class="group-foot">按引导在手机系统里设置好，小手机在后台才不容易被关掉。「后台保活」开关在 设置 › 密码与安全。</div></div>`);
    bindSeg(p.body, 'motion');
    bindSeg(p.body, 'textScale', v => XS.settings.set('textScale', parseFloat(v)));

    /* 引导弹窗 */
    const overlay = p.body.querySelector('.layer-overlay') || document.querySelector('.layer-overlay');
    const openGuide = id => {
      const g = GUIDES.find(x => x[0] === id); if (!g) return;
      XS.settings.set('guideSeen.' + id, true);
      const el = XS.ui.h(`<div class="gd-mask" role="dialog" aria-modal="true" aria-label="${esc(g[1])}">
        <div class="gd-panel">
          <div class="gd-body">
            <h3 class="gd-title">${esc(g[1])}</h3>
            <ol class="gd-steps">${g[2].map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          </div>
          <div class="gd-foot"><button class="gd-ok">我知道了</button></div>
        </div></div>`);
      const close = () => { el.classList.add('out'); setTimeout(() => { el.remove(); refreshGuides(); }, 180); };
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('.gd-ok')) close(); });
      overlay.append(el);
      requestAnimationFrame(() => el.classList.add('in'));
    };
    const refreshGuides = () => { const box = p.body.querySelector('[data-guides]'); if (box) box.innerHTML = renderGuides(); };
    p.body.addEventListener('click', e => {
      const v = e.target.closest('[data-view]'); if (v) return openGuide(v.dataset.view);
      const ok = e.target.closest('[data-ok]');
      if (ok) { XS.settings.set('guide.' + ok.dataset.ok, true); refreshGuides(); XS.ui.toast('已标记完成'); }
    });
    p.view.addEventListener('shown', refreshGuides);
    return p.view;
  };

  /* 主屏幕与 App 资源库：查看并恢复被长按移除的应用 */
  pages.homescreen = () => {
    const p = page('主屏幕与 App 资源库', '<div data-hs></div>');
    const box = p.body.querySelector('[data-hs]');
    const render = () => {
      const pv = `<div class="group-block"><div class="group"><button class="row tap" data-pvlayout><span class="row-main"><span class="row-title">预览推荐布局</span></span></button></div>
        <div class="group-foot">先在桌面上看效果，选“保留”才替换当前排列，选“取消”原样恢复。</div></div>`;
      const ids = [...XS.homeApi.getRemovedApps()].filter(id => XS.apps[id]);
      box.innerHTML = pv + (ids.length
        ? `<div class="group-block"><div class="group-label">已从主屏幕移除</div><div class="group">
            ${ids.map(id => { const a = XS.apps[id];
              return `<div class="row"><span class="perm-app"><span class="app-icon ${a.variant}">${XS.appIcons[a.icon]}</span></span>
                <span class="row-main"><span class="row-title">${esc(a.name)}</span></span>
                <button class="guide-btn" data-restore="${id}">放回桌面</button></div>`;
            }).join('')}
          </div><div class="group-foot">在主屏幕长按图标、点 × 可以移除；这里可以随时放回，会放在桌面第一个空位。</div></div>`
        : `<div class="group-block"><div class="group">${XS.sui.row({ title: '没有被移除的应用', muted: true })}</div>
            <div class="group-foot">在主屏幕长按图标、点 × 可以把应用从桌面和 Dock 移除，移除后会出现在这里。</div></div>`);
    };
    render();
    box.addEventListener('click', e => {
      if (e.target.closest('[data-pvlayout]')) { XS.nav.home(); setTimeout(XS.homeApi.previewDefault, 380); return; }
      const b = e.target.closest('[data-restore]');
      if (!b) return;
      const id = b.dataset.restore, name = XS.apps[id] ? XS.apps[id].name : '';
      XS.homeApi.restoreApp(id);
      render();
      XS.ui.toast(`已把「${name}」放回桌面`);
    });
    return p.view;
  };

  pages.perm = () => {
    const info = [
      ['chat', '使用：本地存储（联系人、聊天记录）、网络（只在发送消息时请求你配置的 API）'],
      ['settings', '使用：本地存储（设置、API 配置）'],
      ['charhall', '暂未开放，不使用任何权限']
    ];
    const p = page('应用权限', `<div class="group-block"><div class="group">${info.map(([id, text]) => {
      const a = XS.apps[id];
      return `<div class="row"><span class="perm-app"><span class="app-icon ${a.variant}">${XS.appIcons[a.icon]}</span></span>
        <span class="row-main"><span class="row-title">${esc(a.name)}</span><span class="row-sub" style="white-space:normal">${esc(text)}</span></span></div>`;
    }).join('')}</div><div class="group-foot">小手机不读取通讯录、相册、定位、麦克风。</div></div>`);
    return p.view;
  };

  /* —— 密码与安全：本机界面锁（js/passcode.js）+ 后台保活（js/keepalive.js）+ 登录设备 —— */
  pages.security = () => {
    const pc = XS.passcode;
    const p = page('密码与安全', '<div data-sec></div>');
    const box = p.body.querySelector('[data-sec]');

    /* 引导行渲染 */
    const guideDone = id => !!XS.settings.get('guide.' + id);
    const guideSeen = id => !!XS.settings.get('guideSeen.' + id);
    const guideRow = ([id, title]) => guideDone(id)
      ? `<div class="row no-icon guide-row" data-guide="${id}"><span class="row-main"><span class="row-title">${esc(title)}</span></span><span class="guide-done">${XS.icon('check')}已完成</span></div>`
      : `<div class="row no-icon guide-row" data-guide="${id}"><span class="row-main"><span class="row-title">${esc(title)}</span></span>
          <button class="guide-btn" data-view="${id}">查看</button>${guideSeen(id) ? `<button class="guide-btn ok" data-ok="${id}">我已设置</button>` : ''}</div>`;
    const renderGuides = () => GUIDES.map(guideRow).join('');

    const render = () => {
      const on = pc.enabled(), ok = pc.supported();
      box.innerHTML = `
        <div class="group-block"><div class="group-label">锁屏密码</div><div class="group">
          ${XS.sui.row({ title: '锁屏密码', value: on ? `已开启 · ${pc.length()} 位数字` : '未开启', muted: !on })}
          ${on
            ? XS.sui.row({ id: 'change', title: '更改密码', cls: 'link' }) + XS.sui.row({ id: 'off', title: '关闭锁屏密码', cls: 'link' })
            : XS.sui.row({ id: 'set', title: '设置锁屏密码', cls: 'link', disabled: !ok })}
        </div><div class="group-foot">${ok
          ? `可选 4 位或 6 位数字。这是这台设备上「小手机」界面的本机锁：开启后，解锁进入主屏幕前需要输入密码。它不连接服务器，不保护任何线上账号或数据库，也不会加密本地数据，和将来的账号登录密码无关。密码不以明文保存，只保存加盐后的校验值。连续输错 ${pc.FREE} 次后需要等待一段时间再试。忘记密码只能在浏览器里清除本站数据，聊天记录等会一起删除。`
          : '当前浏览器环境不能安全保存密码（需要 https 地址，并允许本地存储），暂时无法开启。'}</div></div>
        <div class="group-block"><div class="group-label">后台保活</div><div class="group">
          ${XS.sui.row({ id: 'ka', title: '后台保活', sw: XS.settings.get('keepAlive') !== false })}
        </div><div class="group-foot">开启后会循环播放一段静音音频，让浏览器把小手机当作正在播放，降低切到后台后被清理的概率，但不能保证一定不被关掉：系统省电、清理后台或其他 App 播放声音时仍可能停下。播放期间锁屏或通知栏可能显示播放控件。</div></div>
        <div class="group-block"><div class="group-label">手机系统设置引导</div><div class="group" data-sec-guides>
          ${renderGuides()}
        </div><div class="group-foot">按引导在手机系统侧设置好，可降低被清理的概率。网页无法替你关闭安卓省电模式，也无法检查系统权限，需要手动完成；这些设置不能保证网页永久留在后台，也不能保证锁屏后定时运行 AI。菜单名称以实际手机显示为准。</div></div>
        <div class="group-block"><div class="group-label">账号</div><div class="group">
          ${XS.sui.row({ id: 'devices', title: '登录设备', value: '未接通', muted: true, chev: true })}
        </div></div>`;
      bindSwitch(box, 'ka', 'keepAlive', v => window.toggleKeepAlive && window.toggleKeepAlive(v));
    };
    render();
    box.addEventListener('click', e => {
      const b = e.target.closest('button[data-id]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
      if (b.dataset.id === 'devices') return XS.nav.push(devicesPage());
      if (['set', 'change', 'off'].includes(b.dataset.id)) XS.nav.push(codeFlow(b.dataset.id));
      /* 引导查看和完成 */
      const v = e.target.closest('[data-view]'); if (v) return openGuide(v.dataset.view);
      const ok = e.target.closest('[data-ok]');
      if (ok) { XS.settings.set('guide.' + ok.dataset.ok, true); render(); XS.ui.toast('已标记完成'); }
    });
    /* 引导弹窗 */
    const overlay = p.view.closest('.layer-page')?.querySelector('.layer-overlay') || document.querySelector('.layer-overlay');
    const openGuide = id => {
      const g = GUIDES.find(x => x[0] === id); if (!g) return;
      XS.settings.set('guideSeen.' + id, true);
      const el = XS.ui.h(`<div class="gd-mask" role="dialog" aria-modal="true" aria-label="${esc(g[1])}">
        <div class="gd-panel">
          <div class="gd-body">
            <h3 class="gd-title">${esc(g[1])}</h3>
            <ol class="gd-steps">${g[2].map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          </div>
          <div class="gd-foot"><button class="gd-ok">我知道了</button></div>
        </div></div>`);
      const close = () => { el.classList.add('out'); setTimeout(() => { el.remove(); render(); }, 180); };
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('.gd-ok')) close(); });
      overlay.append(el);
      requestAnimationFrame(() => el.classList.add('in'));
    };
    p.view.addEventListener('shown', render);
    return p.view;
  };

  /* 登录设备：账号登录还没有接进小手机（auth/ 里只有未配置的登录页草稿，没有后端），
     这里只如实说明缺什么，不显示任何设备列表、不模拟三台上限 */
  function devicesPage(){
    const miss = [
      ['账号服务', '还没有配置账号后端，无法登录，也没有地方记录登录过的设备。'],
      ['登录入口', '小手机里还没有登录和退出，现在用的都是这台设备本地的数据。'],
      ['设备记录', '需要由后端记下每次登录的设备，并在移除时真正让那台设备退出、释放名额。']
    ];
    const p = page('登录设备', `
      <div class="group-block"><div class="group">
        ${XS.sui.row({ title: '登录后可管理设备', sub: '接通账号后，这里会显示已登录的设备数量、当前设备、系统和最近活动时间，最多保留 3 台，可以移除其他设备。', cls: 'wrap' })}
      </div></div>
      <div class="group-block"><div class="group-label">目前还缺</div><div class="group">
        ${miss.map(([t, s]) => XS.sui.row({ title: t, sub: s, value: '未接通', muted: true, cls: 'wrap' })).join('')}
      </div><div class="group-foot">锁屏密码只锁这台设备上的小手机界面，不是账号登录密码。</div></div>`);
    p.view.querySelectorAll('.row').forEach(r => r.setAttribute('tabindex', '-1'));
    return p.view;
  }

  /* 设置 / 更改 / 关闭密码的输入页：mode = set | change | off
     旧密码先验证；新密码可选 4 位或 6 位，输两次对比一致才保存。输入内容只在闭包里，不写日志 */
  function codeFlow(mode){
    const pc = XS.passcode;
    const titles = { set: '设置密码', change: '更改密码', off: '关闭密码' };
    const p = XS.nav.page({ title: titles[mode], grouped: true, back: true, cls: 'set-page pc-page' });
    let step = mode === 'set' ? 'new' : 'old', first = '', len = mode === 'set' ? 6 : pc.length();
    const prompt = () => ({ old: '输入当前密码', new: `输入新的 ${len} 位密码`, again: '再次输入新密码' })[step];
    // 只在输入新密码那一步显示「改用 4 / 6 位」
    const opt = XS.ui.h('<button class="pc-opt" type="button"></button>');
    const syncOpt = () => { opt.hidden = step !== 'new'; opt.textContent = `改用 ${len === 6 ? 4 : 6} 位数字密码`; };
    const go = (s, fail) => { step = s; pad.setLen(s === 'old' ? pc.length() : len); pad.reset(prompt()); if (fail) pad.fail(fail); syncOpt(); };
    const pad = pc.pad({ title: prompt(), len, onCancel: () => XS.nav.back(), onDone: async code => {
      if (step === 'old') {
        const r = await pc.verify(code);
        if (!r.ok) return pad.fail(pc.failText(r));
        if (mode === 'off') { pc.clear(); XS.nav.back(); XS.ui.toast('锁屏密码已关闭'); return; }
        len = pc.length(); go('new');
      } else if (step === 'new') {
        first = code; go('again');
      } else {
        if (code !== first) { first = ''; go('new', '两次输入不一致，请重新设置'); return; }
        first = '';
        try { await pc.set(code); } catch (e) { go('new', e.message); return; }
        XS.nav.back(); XS.ui.toast(mode === 'set' ? '锁屏密码已开启' : '密码已更改');
      }
    } });
    opt.addEventListener('click', () => { if (step !== 'new') return; len = len === 6 ? 4 : 6; go('new'); });
    p.body.append(pad.el, opt);
    syncOpt();
    p.view.addEventListener('shown', () => pad.focus());
    // 离开页面时清掉键盘监听和暂存的第一次输入
    new MutationObserver((_, ob) => { if (!p.view.isConnected) { pad.destroy(); first = ''; ob.disconnect(); } }).observe(document.querySelector('.layer-apps'), { childList: true });
    return p.view;
  }

  pages.data = () => {
    const contacts = XS.store.get('contacts', []);
    let msgs = 0; contacts.forEach(c => { msgs += XS.store.get('msgs.' + c.id, []).length; });
    const kb = (XS.store.usage() / 1024).toFixed(1);
    const p = page('数据管理', `<div class="group-block"><div class="group">
      ${XS.sui.row({ title: '本地已用空间', value: kb + ' KB' })}
      ${XS.sui.row({ title: '联系人', value: contacts.length + ' 个' })}
      ${XS.sui.row({ title: '聊天消息', value: msgs + ' 条' })}
      ${XS.sui.row({ title: '保存方式', value: XS.store.persistent ? '本机浏览器' : '临时（不会保存）' })}
    </div><div class="group-foot">数据只在这台设备的浏览器里。清除浏览器数据会一起删除。导出与导入备份暂未开放。</div></div>`);
    p.view.querySelectorAll('.row').forEach(r => r.setAttribute('tabindex', '-1'));
    return p.view;
  };
})();
