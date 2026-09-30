/* 对话页：显示消息、发送、等待回复、失败重试
   接口出错只显示成红色「发送失败」提示，绝不写成对方说的话 */
(function(){
  const esc = XS.esc, data = XS.chat;
  const GAP = 5 * 60 * 1000; // 相隔 5 分钟显示时间

  // 动作描写：*……* 或整行（……）显示为灰色斜体
  const fmt = text => esc(text).split('\n').map(line =>
    /^\s*（[^（）]*）\s*$/.test(line) ? `<span class="act">${line}</span>` : line.replace(/\*([^*\n]+)\*/g, '<span class="act">$1</span>')).join('\n');

  // 使用 lifelike-core.js 构建完整的六层提示词系统
  function buildPrompt(c, msgs, userInput){
    const me = XS.profile.get();

    // 构建角色设定（支持字符串或五层对象格式）
    const characterProfile = c.persona || c.name;

    // 构建用户资料
    const userProfile = me.name ? `用户名字：${me.name}${me.persona ? '\n用户设定：' + me.persona : ''}` : '';

    // 构建历史消息（转换为 lifelike 需要的格式）
    const history = msgs
      .filter(m => m.status !== 'failed')
      .slice(-30)
      .map(m => ({
        role: m.role === 'self' ? 'user' : 'assistant',
        content: m.text
      }));

    // 时间感知层：检查对话间隔
    let activationText = '';
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    if (lastMsg && lastMsg.ts) {
      const gap = Date.now() - lastMsg.ts;
      const hours = gap / (1000 * 60 * 60);
      if (hours > 12) {
        activationText = `距离上次对话已经过了${hours > 24 ? Math.floor(hours / 24) + '天多' : Math.floor(hours) + '小时多'}，可以自然地提及时间流逝。`;
      }
    }

    // 调用 lifelike 核心模块构建完整提示词
    const ctx = XS.lifelike.buildPromptContext({
      characterProfile,
      userProfile,
      worldbookEntries: [],     // 未来可扩展世界书功能
      activePresets: [],         // 未来可扩展预设功能
      calibrations: [],          // 未来可扩展校准功能
      rollingSummary: '',        // 未来可扩展摘要功能
      relevantMemories: [],      // 未来可扩展记忆功能
      history,
      userInput,
      now: new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      activationText,
      styleInFirstUserMessage: false  // 使用 system 字段方式
    });

    return ctx;
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
    const userMsg = allMsgs.find(m => m.id === msgId);
    if (!userMsg) {
      delete data.pending[cid];
      return;
    }

    const ctx = buildPrompt(c, allMsgs.filter(m => m.id !== msgId), userMsg.text);

    try {
      // 使用 lifelike 模块的校验和重试机制
      const reply = await XS.lifelike.requestWithOneRetry(
        async (request) => {
          // 将 ctx.system 和 ctx.messages 转换为现有 API 格式
          const apiMessages = [
            { role: 'system', content: request.system },
            ...request.messages
          ];
          return await XS.api.chat(apiMessages);
        },
        ctx
      );

      delete data.pending[cid];
      const list = mark('ok');
      if (list && data.contact(cid)) {
        list.push({ id: XS.uid('m'), role: 'other', text: reply, ts: Date.now() });
        data.saveMsgs(cid, list);
      }
    } catch (e) {
      delete data.pending[cid];
      mark('failed', { kind: e.kind || 'unknown', message: e.message || '未知错误' });
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
