/* 聊天：数据（联系人、消息、未读）+ 首页（消息 / 联系人 / 动态 / 我 四个 Tab）
   每个联系人有固定 ID，消息按 ID 分开保存在 xs.v1.msgs.<ID>，未读按 xs.v1.read.<ID> 记录最后已读时间 */
(function(){
  const esc = XS.esc;
  const data = XS.chat = {
    contacts: () => XS.store.get('contacts', []),
    contact: id => data.contacts().find(c => c.id === id),
    saveContact(c){
      const list = data.contacts(), i = list.findIndex(x => x.id === c.id);
      i < 0 ? list.push(c) : (list[i] = c);
      XS.store.set('contacts', list); XS.emit('chat:change');
    },
    removeContact(id){
      XS.store.set('contacts', data.contacts().filter(c => c.id !== id));
      XS.store.remove('msgs.' + id);
      XS.store.remove('read.' + id);
      XS.emit('chat:change');
    },
    msgs: id => XS.store.get('msgs.' + id, []),
    saveMsgs(id, list){ XS.store.set('msgs.' + id, list); XS.emit('chat:change', id); },
    pending: {},   // 正在等回复的联系人
    // 未读：对方最后一条消息晚于「最后已读时间」就算未读；打开会话时清零
    unread: id => data.msgs(id).filter(m => m.role === 'other' && m.ts > (XS.store.get('read.' + id, 0))).length,
    markRead(id){ XS.store.set('read.' + id, Date.now()); XS.emit('chat:change', id); }
  };

  const initial = name => esc((name || '?').trim().slice(0, 1).toUpperCase());
  // 头像：有上传的图片用图片，否则用名字首字
  data.avatar = (c, cls='') => `<span class="avatar ${cls}" aria-hidden="true">${c && c.avatar ? `<img src="${esc(c.avatar)}" alt="" draggable="false">` : initial(c.name)}</span>`;
  data.typeLabel = c => (c && c.type === 'person') ? '真人用户' : 'AI 角色';
  data.fmtTime = ts => {
    const d = new Date(ts), now = new Date(), hm = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = (day(now) - day(d)) / 864e5;
    return diff === 0 ? hm : diff === 1 ? '昨天 ' + hm : d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}月${d.getDate()}日 ${hm}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  };

  /* 新建 / 编辑联系人：头像、名字、类型、性别、生日、籍贯、人设、禁忌 */
  data.editContact = (c, after) => {
    const isNew = !c;
    const base = c || { id: XS.uid('c'), type: 'ai', avatar: null, gender: '', birthday: '', hometown: '', name: '', persona: '', taboos: '', createdAt: Date.now() };
    const state = { type: base.type || 'ai', gender: base.gender || '', avatar: base.avatar || null };
    const form = XS.ui.h(`<div class="contact-form">
      <div class="cf-row"><span class="cf-label">类型</span>
        <span class="segmented" data-seg="type"><button class="seg" data-v="ai">AI 角色</button><button class="seg" data-v="person">真人用户</button></span></div>
      <div class="cf-row cf-avatar-row">
        <span class="avatar avatar-lg" data-av>${state.avatar ? `<img src="${esc(state.avatar)}" alt="">` : initial(base.name || '')}</span>
        <button class="btn btn-sm btn-plain tap" data-a="pick" type="button">${state.avatar ? '更换头像' : '添加头像'}</button>
      </div>
      <label class="field"><span>名字（必填）</span><input name="name" maxlength="20" value="${esc(base.name || '')}" placeholder="例如：小林"></label>
      <div class="cf-row"><span class="cf-label">性别</span>
        <span class="segmented" data-seg="gender"><button class="seg" data-v="">不填</button><button class="seg" data-v="male">男</button><button class="seg" data-v="female">女</button></span></div>
      <label class="field"><span>生日</span><input name="birthday" type="date" value="${esc(base.birthday || '')}"></label>
      <label class="field"><span>籍贯</span><input name="hometown" maxlength="30" value="${esc(base.hometown || '')}" placeholder="例如：深圳"></label>
      <label class="field"><span>人设</span><textarea name="persona" rows="3" placeholder="性格、说话方式、和你的关系……">${esc(base.persona || '')}</textarea></label>
      <label class="field"><span>禁忌</span><textarea name="taboos" rows="2" placeholder="不能说的话、不能碰的话题（可选）">${esc(base.taboos || '')}</textarea></label>
      <input type="file" accept="image/*" hidden></div>`);
    // 类型 / 性别分段
    ['type', 'gender'].forEach(key => {
      const bar = form.querySelector(`[data-seg="${key}"]`);
      const btns = [...bar.querySelectorAll('.seg')];
      XS.ui.pillTabs(bar, { itemSel: '.seg', attr: 'aria-checked', index: Math.max(0, btns.findIndex(b => b.dataset.v === state[key])), onChange: i => { state[key] = btns[i].dataset.v; } });
    });
    // 头像上传 → 裁切
    const av = form.querySelector('[data-av]'), pick = form.querySelector('[data-a="pick"]'), file = form.querySelector('input[type=file]');
    pick.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      const url = await XS.media.crop(file.files[0], { ratio: 1, out: 320, title: '设置头像' });
      if (url) { state.avatar = url; av.innerHTML = `<img src="${url}" alt="">`; pick.textContent = '更换头像'; }
    });

    XS.ui.sheet({ title: isNew ? '新建联系人' : '编辑联系人', content: form, doneText: isNew ? '添加' : '保存', onDone(){
      const name = form.querySelector('[name=name]').value.trim();
      if (!name) { XS.ui.toast('请填写名字'); return false; }
      const next = { ...base, name, type: state.type, avatar: state.avatar, gender: state.gender,
        birthday: form.querySelector('[name=birthday]').value, hometown: form.querySelector('[name=hometown]').value.trim(),
        persona: form.querySelector('[name=persona]').value.trim(), taboos: form.querySelector('[name=taboos]').value.trim() };
      data.saveContact(next);
      after && after(next);
    }});
  };

  /* 联系人资料页：头像、名字、类型、资料字段；发消息 / 编辑 / 删除 */
  data.openProfile = cid => {
    const p = XS.nav.page({ title: '资料', back: true, cls: 'contact-profile' });
    const v = p.view;
    const render = () => {
      const c = data.contact(cid);
      if (!c) { XS.nav.back(); return; }
      p.setTitle(c.name);
      const facts = [];
      if (c.gender) facts.push(`<div class="row no-icon"><span class="row-main"><span class="row-title">性别</span></span><span class="row-value">${esc({male:'男',female:'女'}[c.gender] || c.gender)}</span></div>`);
      if (c.birthday) facts.push(`<div class="row no-icon"><span class="row-main"><span class="row-title">生日</span></span><span class="row-value">${esc(c.birthday)}</span></div>`);
      if (c.hometown) facts.push(`<div class="row no-icon"><span class="row-main"><span class="row-title">籍贯</span></span><span class="row-value">${esc(c.hometown)}</span></div>`);
      p.body.innerHTML = `
        <div class="pf-head">${data.avatar(c, 'avatar-xl')}<div class="pf-name">${esc(c.name)}</div><div class="pf-type">${esc(data.typeLabel(c))}</div></div>
        <div class="group-block"><div class="group">${XS.sui.row({ id: 'msg', icon: 'chat', title: '发消息', chev: true })}</div></div>
        ${c.persona ? `<div class="group-block"><div class="group-label">人设</div><div class="pf-text">${esc(c.persona)}</div></div>` : ''}
        ${c.taboos ? `<div class="group-block"><div class="group-label">禁忌</div><div class="pf-text">${esc(c.taboos)}</div></div>` : ''}
        ${facts.length ? `<div class="group-block"><div class="group-label">资料</div><div class="group">${facts.join('')}</div></div>` : ''}
        <div class="group-block"><div class="group">
          ${XS.sui.row({ id: 'edit', icon: 'edit', title: '编辑联系人', chev: true })}
          ${XS.sui.row({ id: 'del', icon: 'trash', title: '删除联系人', cls: 'danger' })}
        </div></div>`;
    };
    v.addEventListener('click', async e => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const c = data.contact(cid);
      if (!c) return;
      if (b.dataset.id === 'msg') XS.nav.push(data.openConv(cid));
      else if (b.dataset.id === 'edit') data.editContact(c, () => render());
      else if (b.dataset.id === 'del') {
        // 删除后由 render() 统一退回列表，这里不再 back()，避免连退两层
        if (await XS.ui.confirm({ title: '删除联系人？', text: `「${c.name}」和聊天记录都会被删除，无法恢复。`, ok: '删除', danger: true })) { data.removeContact(cid); }
      }
    });
    const off = XS.on('chat:change', () => { if (!v.isConnected) return off(); render(); });
    v.addEventListener('shown', render);
    render();
    return v;
  };

  function mount(){
    const p = XS.nav.page({ title: '消息', large: true, back: false, cls: 'has-tabbar chat-root',
      right: `<button class="nav-btn tap" data-a="add" aria-label="新建联系人">${XS.icon('plus')}</button>` });
    const v = p.view;
    v.insertAdjacentHTML('beforeend', `<div class="pblur" aria-hidden="true"><i></i><i></i><i></i></div>
      <nav class="tabbar" role="tablist" aria-label="聊天">
        <button class="tab" role="tab" data-t="msgs">${XS.icon('chat')}<span>消息</span></button>
        <button class="tab" role="tab" data-t="contacts">${XS.icon('people')}<span>联系人</span></button>
        <button class="tab" role="tab" data-t="moments">${XS.icon('moments')}<span>动态</span></button>
        <button class="tab" role="tab" data-t="me">${XS.icon('person')}<span>我</span></button></nav>`);
    const TITLES = ['消息', '联系人', '动态', '我'];
    let tab = 0;
    const openConv = c => c && XS.nav.push(data.openConv(c.id));
    const openProfile = c => c && XS.nav.push(data.openProfile(c.id));
    const add = () => data.editContact(null, c => openProfile(c));

    // 搜索框 + 内容容器（切换只换内容，不重建搜索框，输入不丢）
    p.body.innerHTML = `<label class="search chat-search" hidden>${XS.icon('search')}<input type="search" placeholder="搜索" aria-label="搜索"></label><div class="chat-tabs"></div>`;
    const searchBox = p.body.querySelector('.chat-search'), searchInput = p.body.querySelector('.chat-search input'), content = p.body.querySelector('.chat-tabs');

    const renderMsgs = q => {
      const rows = data.contacts().map(c => ({ c, list: data.msgs(c.id) })).filter(x => x.list.length)
        .sort((a, b) => b.list[b.list.length - 1].ts - a.list[a.list.length - 1].ts);
      if (!rows.length) return `<div class="empty">${XS.icon('chat')}<h3>还没有聊天</h3><p>先添加一个联系人，再开始对话。</p><button class="btn btn-primary tap" data-a="add">新建联系人</button></div>`;
      const filtered = q ? rows.filter(x => x.c.name.toLowerCase().includes(q) || String(x.list[x.list.length - 1].text).toLowerCase().includes(q)) : rows;
      if (!filtered.length) return `<div class="empty">${XS.icon('search')}<h3>没有匹配的聊天</h3></div>`;
      return `<div class="chat-list">${filtered.map(({ c, list }) => {
        const last = list[list.length - 1], fail = last.status === 'failed', un = data.unread(c.id);
        const text = data.pending[c.id] ? '对方正在输入…' : fail ? '发送失败：' + last.text : last.text;
        return `<button class="chat-item tap-row" data-conv="${c.id}">${data.avatar(c)}<span class="ci-main"><span class="ci-top"><span class="ci-name">${esc(c.name)}</span>
          ${un ? `<span class="ci-badge">${un}</span>` : ''}<span class="ci-time">${data.fmtTime(last.ts)}</span></span><span class="ci-last${fail ? ' err' : ''}">${esc(text)}</span></span></button>`;
      }).join('')}</div>`;
    };
    const renderContacts = q => {
      const list = data.contacts();
      const filtered = q ? list.filter(c => c.name.toLowerCase().includes(q)) : list;
      return `<div class="chat-list"><button class="chat-add tap-row" data-a="add"><span class="avatar">${XS.icon('personAdd')}</span>新建联系人</button>
        ${filtered.map(c => `<button class="chat-item sm tap-row" data-c="${c.id}">${data.avatar(c)}<span class="ci-main"><span class="ci-top"><span class="ci-name">${esc(c.name)}</span><span class="ci-type">${c.type === 'person' ? '真人' : 'AI'}</span></span>
          <span class="ci-sub">${esc(c.persona || '未填写人设')}</span></span></button>`).join('')}</div>
        ${list.length ? '' : '<div class="group-foot" style="text-align:center">还没有联系人，点上面新建</div>'}`;
    };
    const renderMoments = () => `<div class="empty">${XS.icon('moments')}<h3>还没有动态</h3><p>动态的发布和个人主页会在之后的版本开放。</p></div>`;
    const renderMe = () => {
      const pr = XS.profile.get(), ok = XS.api.configured();
      return `<div class="chat-me"><div class="group-block"><div class="group-label">我的资料</div><div class="group">
          <div class="field-inline"><label for="me-name">名字</label><input id="me-name" name="name" value="${esc(pr.name)}" placeholder="对方怎么称呼你"></div>
          <div class="field-inline top"><label for="me-persona">人设</label><textarea id="me-persona" name="persona" placeholder="可不填">${esc(pr.persona)}</textarea></div>
        </div><div class="group-foot">自动保存，和「设置」里的资料是同一份。</div></div>
        <div class="group-block"><div class="group">${XS.sui.row({ id: 'appearance', icon: 'sun', title: '聊天外观', value: '主题 · 玻璃 · 字号', chev: true })}
          ${XS.sui.row({ id: 'api', icon: 'plug', title: 'API 连接', value: ok ? '已配置' : '未配置', chev: true })}</div>
        <div class="group-foot">${XS.settings.get('flightMode') ? '飞行模式已开启，AI 暂时不会回复。' : '聊天回复来自你在设置里填写的 AI 接口。'}</div></div></div>`;
    };

    const render = () => {
      const showSearch = tab === 0 || tab === 1;
      searchBox.hidden = !showSearch;
      if (showSearch) searchInput.placeholder = tab === 0 ? '搜索消息' : '搜索联系人';
      const q = searchInput.value.trim().toLowerCase();
      content.innerHTML = [renderMsgs, renderContacts, renderMoments, renderMe][tab](q);
    };
    searchInput.addEventListener('input', render);

    const bar = v.querySelector('.tabbar');
    XS.ui.pillTabs(bar, { itemSel: '.tab', onChange: i => {
      tab = i; p.setTitle(TITLES[i]); render(); p.scroll.scrollTop = 0;
      v.querySelector('[data-a="add"]').hidden = (i === 2 || i === 3);
    }});
    v.addEventListener('click', e => {
      const t = e.target.closest('[data-a],[data-c],[data-conv],[data-id]');
      if (!t || t.closest('.tabbar')) return;
      if (t.dataset.a === 'add') add();
      else if (t.dataset.conv) openConv(data.contact(t.dataset.conv));
      else if (t.dataset.c) openProfile(data.contact(t.dataset.c));
      else if (t.dataset.id === 'api') XS.nav.push(XS.settingsPages.api());
      else if (t.dataset.id === 'appearance') XS.nav.push(XS.settingsPages.display());
    });
    p.body.addEventListener('input', e => { if (e.target.name) XS.profile.set({ [e.target.name]: e.target.value }); });
    const off = XS.on('chat:change', () => { if (!v.isConnected) return off(); if (tab !== 2 && tab !== 3) render(); });
    v.addEventListener('shown', render);
    render();
    return v;
  }
  XS.apps.chat.mount = mount;
})();
