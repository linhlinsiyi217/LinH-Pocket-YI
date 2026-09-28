/* 聊天：数据（联系人、消息）+ 首页（消息 / 联系人 / 我 三个 Tab）
   每个联系人有固定 ID，消息按 ID 分开保存在 xs.v1.msgs.<ID> */
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
      XS.store.remove('msgs.' + id); XS.emit('chat:change');
    },
    msgs: id => XS.store.get('msgs.' + id, []),
    saveMsgs(id, list){ XS.store.set('msgs.' + id, list); XS.emit('chat:change', id); },
    pending: {}   // 正在等回复的联系人
  };

  const initial = name => esc((name || '?').trim().slice(0, 1).toUpperCase());
  data.avatar = (c, cls='') => `<span class="avatar ${cls}" aria-hidden="true">${initial(c.name)}</span>`;
  data.fmtTime = ts => {
    const d = new Date(ts), now = new Date(), hm = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = (day(now) - day(d)) / 864e5;
    return diff === 0 ? hm : diff === 1 ? '昨天 ' + hm : d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}月${d.getDate()}日 ${hm}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  };

  /* 新建 / 编辑联系人 */
  data.editContact = (c, after) => {
    const form = XS.ui.h(`<div>
      <label class="field"><span>名字（必填）</span><input name="name" maxlength="20" value="${esc(c ? c.name : '')}" placeholder="例如：小林"></label>
      <label class="field"><span>人设（可不填）</span><textarea name="persona" placeholder="性格、说话方式、和你的关系……">${esc(c ? c.persona : '')}</textarea>
      <span class="hint">会作为角色设定发给你配置的 AI。</span></label></div>`);
    XS.ui.sheet({ title: c ? '编辑联系人' : '新建联系人', content: form, doneText: c ? '保存' : '添加', onDone(){
      const name = form.querySelector('[name=name]').value.trim();
      if (!name) { XS.ui.toast('请填写名字'); return false; }
      const next = { ...(c || { id: XS.uid('c'), createdAt: Date.now() }), name, persona: form.querySelector('[name=persona]').value.trim() };
      data.saveContact(next);
      after && after(next);
    }});
  };

  function mount(){
    const p = XS.nav.page({ title: '消息', large: true, back: false, cls: 'has-tabbar chat-root',
      right: `<button class="nav-btn tap" data-a="add" aria-label="新建联系人">${XS.icon('plus')}</button>` });
    const v = p.view;
    v.insertAdjacentHTML('beforeend', `<div class="pblur" aria-hidden="true"><i></i><i></i><i></i></div>
      <nav class="tabbar" role="tablist" aria-label="聊天">
        <button class="tab" role="tab" data-t="msgs">${XS.icon('chat')}<span>消息</span></button>
        <button class="tab" role="tab" data-t="contacts">${XS.icon('people')}<span>联系人</span></button>
        <button class="tab" role="tab" data-t="me">${XS.icon('person')}<span>我</span></button></nav>`);
    const TITLES = ['消息', '联系人', '我'];
    let tab = 0;
    const open = c => XS.nav.push(XS.chat.openConv(c.id));
    const add = () => data.editContact(null, c => open(c));

    const renderMsgs = () => {
      const rows = data.contacts().map(c => ({ c, list: data.msgs(c.id) })).filter(x => x.list.length)
        .sort((a, b) => b.list[b.list.length - 1].ts - a.list[a.list.length - 1].ts);
      if (!rows.length) return `<div class="empty">${XS.icon('chat')}<h3>还没有聊天</h3><p>先添加一个联系人，再开始对话。</p><button class="btn btn-primary tap" data-a="add">新建联系人</button></div>`;
      return `<div class="chat-list">${rows.map(({ c, list }) => {
        const last = list[list.length - 1], fail = last.status === 'failed';
        const text = data.pending[c.id] ? '对方正在输入…' : fail ? '发送失败：' + last.text : last.text;
        return `<button class="chat-item tap-row" data-c="${c.id}">${data.avatar(c)}<span class="ci-main"><span class="ci-top"><span class="ci-name">${esc(c.name)}</span>
          <span class="ci-time">${data.fmtTime(last.ts)}</span></span><span class="ci-last${fail ? ' err' : ''}">${esc(text)}</span></span></button>`;
      }).join('')}</div>`;
    };
    const renderContacts = () => {
      const list = data.contacts();
      return `<div class="chat-list"><button class="chat-add tap-row" data-a="add"><span class="avatar">${XS.icon('personAdd')}</span>新建联系人</button>
        ${list.map(c => `<button class="chat-item sm tap-row" data-c="${c.id}">${data.avatar(c)}<span class="ci-main"><span class="ci-name">${esc(c.name)}</span>
          <span class="ci-sub">${esc(c.persona || '未填写人设')}</span></span></button>`).join('')}</div>
        ${list.length ? '' : '<div class="group-foot" style="text-align:center">还没有联系人</div>'}`;
    };
    const renderMe = () => {
      const pr = XS.profile.get(), ok = XS.api.configured();
      return `<div class="chat-me"><div class="group-block"><div class="group-label">我的资料</div><div class="group">
          <div class="field-inline"><label for="me-name">名字</label><input id="me-name" name="name" value="${esc(pr.name)}" placeholder="对方怎么称呼你"></div>
          <div class="field-inline top"><label for="me-persona">人设</label><textarea id="me-persona" name="persona" placeholder="可不填">${esc(pr.persona)}</textarea></div>
        </div><div class="group-foot">自动保存，和「设置」里的资料是同一份。</div></div>
        <div class="group-block"><div class="group">${XS.sui.row({ id: 'api', icon: 'plug', title: 'API 连接', value: ok ? '已配置' : '未配置', chev: true })}</div>
        <div class="group-foot">${XS.settings.get('flightMode') ? '飞行模式已开启，AI 暂时不会回复。' : '聊天回复来自你在设置里填写的 AI 接口。'}</div></div></div>`;
    };
    const render = () => { p.body.innerHTML = [renderMsgs, renderContacts, renderMe][tab](); };

    const bar = v.querySelector('.tabbar');
    XS.ui.pillTabs(bar, { itemSel: '.tab', onChange: i => {
      tab = i; p.setTitle(TITLES[i]); render(); p.scroll.scrollTop = 0;
      v.querySelector('[data-a="add"]').hidden = i === 2;
    }});
    v.addEventListener('click', e => {
      const t = e.target.closest('[data-a],[data-c],[data-id]');
      if (!t || t.closest('.tabbar')) return;
      if (t.dataset.a === 'add') add();
      else if (t.dataset.c) open(data.contact(t.dataset.c));
      else if (t.dataset.id === 'api') XS.nav.push(XS.settingsPages.api());
    });
    p.body.addEventListener('input', e => { if (e.target.name) XS.profile.set({ [e.target.name]: e.target.value }); });
    const off = XS.on('chat:change', () => { if (!v.isConnected) return off(); if (tab !== 2) render(); });
    v.addEventListener('shown', render);
    render();
    return v;
  }
  XS.apps.chat.mount = mount;
})();
