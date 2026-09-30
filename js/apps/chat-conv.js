/* 对话页：显示消息、发送、等待回复、失败重试
   接口出错只显示成红色「发送失败」提示，绝不写成对方说的话 */
(function(){
  const esc = XS.esc, data = XS.chat;
  const GAP = 5 * 60 * 1000; // 相隔 5 分钟显示时间

  // 动作描写：*……* 或整行（……）显示为灰色斜体
  const fmt = text => esc(text).split('\n').map(line =>
    /^\s*（[^（）]*）\s*$/.test(line) ? `<span class="act">${line}</span>` : line.replace(/\*([^*\n]+)\*/g, '<span class="act">$1</span>')).join('\n');

  // 构建分层提示词：稳定角色身份 + 当前状态 + 时间感知
  function buildPrompt(c, msgs){
    const me = XS.profile.get();
    const layers = [];

    // 第一层：稳定角色身份（不随对话变化）
    layers.push(`你正在扮演「${c.name}」，和用户在手机聊天软件里一对一聊天。`);
    if (c.persona) layers.push(`角色设定：${c.persona}`);
    layers.push(`用户的名字是「${me.name || '我'}」。${me.persona ? '用户的设定：' + me.persona : ''}`);

    // 第二层：说话风格指导
    layers.push('请始终以角色身份、用第一人称回复，像真实聊天一样简短自然。动作或神态可以写在 *星号* 里。');

    // 第三层：时间感知与上下文连续性
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    if (lastMsg && lastMsg.ts) {
      const gap = Date.now() - lastMsg.ts;
      const hours = gap / (1000 * 60 * 60);
      if (hours > 12) {
        layers.push(`距离上次对话已经过了${hours > 24 ? Math.floor(hours / 24) + '天多' : Math.floor(hours) + '小时多'}，可以自然地提及时间流逝。`);
      }
    }

    return layers.filter(Boolean).join('\n');
  }

  // 校验输出：处理明显错误，不过度限制自然短回复
  function validateOutput(text, characterName){
    if (!text || typeof text !== 'string') return { ok: false, reason: '回复为空' };
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, reason: '回复只有空白' };
    if (trimmed.length > 800) return { ok: false, reason: '回复过长（超过 800 字）' };
    // 不限制短回复：一两个字、单个表情、简单应答都可以
    return { ok: true, text: trimmed };
  }

  // 真正发请求：成功则追加对方消息；失败把这条标记为失败
  async function request(cid, msgId){
    const c = data.contact(cid);
    if (!c || data.pending[cid]) return;
    data.pending[cid] = true;
    const mark = (status, err) => {
      const list = data.msgs(cid), m = list.find(x => x.id === msgId);
      if (!m) return null;
      m.status = status; m.error = err; data.saveMsgs(cid, list); return list;
    };
    mark('sending');
    const allMsgs = data.msgs(cid);
    const history = allMsgs.filter(m => m.status !== 'failed' || m.id === msgId).slice(-30)
      .map(m => ({ role: m.role === 'self' ? 'user' : 'assistant', content: m.text }));

    const systemContent = buildPrompt(c, allMsgs);
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const reply = await XS.api.chat([{ role: 'system', content: systemContent }, ...history]);
        const validation = validateOutput(reply, c.name);

        if (!validation.ok) {
          if (retries < maxRetries) {
            retries++;
            // 重试时加上具体要求
            history.push({ role: 'assistant', content: reply });
            history.push({ role: 'user', content: `上一条回复有问题（${validation.reason}），请重新回复。` });
            continue;
          } else {
            throw new Error(`回复格式问题：${validation.reason}`);
          }
        }

        delete data.pending[cid];
        const list = mark('ok');
        if (list && data.contact(cid)) {
          list.push({ id: XS.uid('m'), role: 'other', text: validation.text, ts: Date.now() });
          data.saveMsgs(cid, list);
        }
        return;
      } catch (e) {
        if (retries < maxRetries && e.kind !== 'config' && e.kind !== 'flight') {
          retries++;
          continue;
        }
        delete data.pending[cid];
        mark('failed', { kind: e.kind || 'unknown', message: e.message || '未知错误' });
        return;
      }
    }
  }

  data.openConv = cid => {
    const c = data.contact(cid);
    const p = XS.nav.page({ title: c.name, back: true, cls: 'conv',
      right: `<button class="nav-btn tap" data-a="more" aria-label="更多">${XS.icon('more')}</button>` });
    const v = p.view;
    v.insertAdjacentHTML('beforeend', `<div class="pblur" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="composer"><textarea rows="1" placeholder="发消息" aria-label="输入消息" enterkeyhint="send"></textarea>
      <button class="send tap" aria-label="发送" disabled>${XS.icon('send')}</button></div>`);
    const ta = v.querySelector('textarea'), sendBtn = v.querySelector('.send');
    let cont = c;

    const render = () => {
      const list = data.msgs(cid);
      let html = '', prevTs = 0;
      if (!list.length) html += `<div class="msg-notice">和「${esc(cont.name)}」的对话从这里开始。回复由你配置的 AI 生成。</div>`;
      list.forEach((m, i) => {
        if (m.ts - prevTs > GAP) html += `<div class="msg-time">${data.fmtTime(m.ts)}</div>`;
        const prev = list[i - 1], next = list[i + 1];
        const first = !prev || prev.role !== m.role || m.ts - prev.ts > GAP;
        const last = !next || next.role !== m.role || next.ts - m.ts > GAP || m.status === 'failed';
        const other = m.role === 'other';
        html += `<div class="msg ${other ? 'other' : 'self'}${first ? ' first' : ''}${last ? ' last' : ''}${m.status === 'sending' ? ' sending' : ''}">
          ${other ? (last ? data.avatar(cont) : '<span class="av-space"></span>') : ''}<div class="bubble">${fmt(m.text)}</div></div>`;
        if (m.status === 'failed') {
          const cfg = m.error && (m.error.kind === 'config' || m.error.kind === 'flight');
          html += `<div class="msg-state err"><button data-retry="${m.id}">${XS.icon('alert')}<span>发送失败 · ${esc(m.error ? m.error.message : '')}${cfg ? '' : ' · 点此重试'}</span></button></div>`;
          if (cfg) html += `<div class="msg-notice">${m.error.kind === 'flight' ? '飞行模式开启中' : 'AI 接口还没配置好'} · <button data-a="goset">去设置</button></div>`;
        }
        prevTs = m.ts;
      });
      if (data.pending[cid]) html += `<div class="msg other first last typing" aria-label="对方正在输入">${data.avatar(cont)}<div class="bubble"><i></i><i></i><i></i></div></div>`;
      p.body.innerHTML = html;
      sync();
    };
    const toBottom = () => { p.scroll.scrollTop = p.scroll.scrollHeight; };
    const sync = () => { sendBtn.disabled = !ta.value.trim() || !!data.pending[cid]; };
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; };

    function send(){
      const text = ta.value.trim();
      if (!text || data.pending[cid]) return;          // 空消息不发，等回复时不重复发
      const m = { id: XS.uid('m'), role: 'self', text, ts: Date.now(), status: 'sending' };
      const list = data.msgs(cid); list.push(m); data.saveMsgs(cid, list);
      ta.value = ''; grow();
      request(cid, m.id);
    }

    ta.addEventListener('input', () => { grow(); sync(); });
    ta.addEventListener('keydown', e => {
      // 电脑上回车发送、Shift+回车换行；输入法选字时不发送
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(); }
    });
    sendBtn.addEventListener('pointerdown', e => e.preventDefault()); // 点发送时不收起键盘
    sendBtn.addEventListener('click', send);
    ta.addEventListener('focus', () => setTimeout(toBottom, 300));

    v.addEventListener('click', async e => {
      const r = e.target.closest('[data-retry]');
      if (r) return request(cid, r.dataset.retry);
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'goset') XS.nav.push(XS.settingsPages.api());
      if (a.dataset.a === 'more') XS.ui.menu(a, [
        { label: '编辑联系人', icon: 'edit', onClick: () => data.editContact(cont, n => { cont = n; p.setTitle(n.name); render(); }) },
        { label: '清空聊天记录', icon: 'trash', danger: true, onClick: async () => {
          if (await XS.ui.confirm({ title: '清空聊天记录？', text: `和「${cont.name}」的全部消息会被删除，无法恢复。`, ok: '清空', danger: true })) data.saveMsgs(cid, []);
        }},
        { label: '删除联系人', icon: 'close', danger: true, onClick: async () => {
          if (await XS.ui.confirm({ title: '删除联系人？', text: `「${cont.name}」和聊天记录都会被删除，无法恢复。`, ok: '删除', danger: true })) { data.removeContact(cid); XS.nav.back(); }
        }}
      ]);
    });

    // 数据变化（发送、收到回复、失败）时刷新；离开页面后自动解绑
    const off = XS.on('chat:change', id => {
      if (!v.isConnected) return off();
      if (id === cid || id === undefined) { const near = p.scroll.scrollHeight - p.scroll.scrollTop - p.scroll.clientHeight < 120; if (data.contact(cid)) { render(); if (near || id === cid) toBottom(); } }
    });
    v.addEventListener('shown', () => { render(); toBottom(); });
    render(); requestAnimationFrame(toBottom);
    return v;
  };
})();
