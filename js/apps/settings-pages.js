/* 设置的子页面：个人资料、API 连接、显示与亮度、辅助功能、应用权限、数据管理 */
(function(){
  const { group, seg, bindSeg, bindSwitch } = XS.sui;
  const esc = XS.esc;
  const page = (title, html) => {
    const p = XS.nav.page({ title, grouped: true, backText: '设置', cls: 'set-page' });
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

  pages.access = () => {
    const p = page('辅助功能', `
      <div class="group-block"><div class="group">
        ${seg('动态效果', 'motion', [['system', '跟随系统'], ['reduce', '减少'], ['full', '完整']])}
      </div><div class="group-foot">选择「减少」后，页面切换和选中块会直接到位，不再滑动。</div></div>
      <div class="group-block"><div class="group-label">文字大小</div><div class="group">
        ${seg('大小', 'textScale', [['0.9', '小'], ['1', '标准'], ['1.1', '大'], ['1.2', '特大']])}
        <div class="set-preview">这是一段预览文字。<small>聊天、设置等页面的文字会一起变化。</small></div>
      </div></div>`);
    bindSeg(p.body, 'motion');
    bindSeg(p.body, 'textScale', v => XS.settings.set('textScale', parseFloat(v)));
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
