/* 对话页：显示消息、发送、等待回复、失败重试
   接口出错只显示成红色「发送失败」提示，绝不写成对方说的话 */
(function(){
  const esc = XS.esc, data = XS.chat;
  const GAP = 5 * 60 * 1000; // 相隔 5 分钟显示时间

  // 动作描写：*……* 或整行（……）显示为灰色斜体
  const fmt = text => esc(text).split('\n').map(line =>
    /^\s*（[^（）]*）\s*$/.test(line) ? `<span class="act">${line}</span>` : line.replace(/\*([^*\n]+)\*/g, '<span class="act">$1</span>')).join('\n');

  // 使用 lifelike-core.js 组装完整提示词：行为指令 + 角色卡 + 用户资料 + 世界书 + 记忆 + 最近对话
  function buildPrompt(c, msgs, userInput){
    const me = XS.profile.get();

    // 角色卡：名字、人设、说话习惯、关系阶段、禁忌等，按字段交给 lifelike 组装
    const characterProfile = {
      name: c.name, persona: c.persona, speaking: c.speaking,
      relation: c.relation, taboos: c.taboos,
      gender: c.gender, birthday: c.birthday, hometown: c.hometown
    };

    // 用户资料：只送用户自己在「我」里填过的那一份，不猜
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
      worldbookEntries: data.worldbook(),   // 世界书：按本轮话题挑相关的少量条目
      activePresets: [],                     // 预设功能暂未开放
      calibrations: [],                      // 角色纠错（C4）暂未开放
      rollingSummary: '',                    // 摘要功能暂未开放
      relevantMemories: data.memories(c.id), // 长期记忆：没有就传空，不臆造共同经历
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
    // 真人联系人和关掉 AI 的角色不发请求：消息照常留下，绝不会生成假的对方回复
    if (c.type === 'person' || c.aiEnabled === false){
      const list = data.msgs(cid), m = list.find(x => x.id === msgId);
      if (m){ m.status = 'ok'; data.saveMsgs(cid, list); }
      return;
    }
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
        // 需要连发几条时用单独一行 --- 明确分隔；只有 2~3 段才拆，否则原样当一条。
        // 一次全部落库，不做定时逐条刷屏，旧回复不会在新话题里继续冒出来。
        const parts = XS.lifelike.splitBubbles(reply);
        const base = Date.now();
        parts.forEach((part, i) => list.push({ id: XS.uid('m'), role: 'other', text: part, ts: base + i }));
        data.saveMsgs(cid, list);
      }
    } catch (e) {
      delete data.pending[cid];
      mark('failed', { kind: e.kind || 'unknown', message: e.message || '未知错误' });
    }
  }

  // 复制：剪贴板不可用时退回选中复制，两种情况都给提示
  async function copyText(text){
    try {
      await navigator.clipboard.writeText(text);
      XS.ui.toast('已复制');
      return;
    } catch (e) {}
    try {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', '');
      t.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy');
      t.remove();
      XS.ui.toast(ok ? '已复制' : '复制失败，请长按气泡里的文字手动选择');
    } catch (e2) {
      XS.ui.toast('复制失败，请长按气泡里的文字手动选择');
    }
  }

  data.openConv = cid => {
    const c = data.contact(cid);
    if (data.markRead) data.markRead(cid);   // 打开会话即清除未读
    const p = XS.nav.page({ title: data.name(c), back: true, cls: 'conv',
      right: `<button class="nav-btn tap" data-a="find" aria-label="在会话里搜索">${XS.icon('search')}</button>
        <button class="nav-btn tap" data-a="more" aria-label="更多">${XS.icon('more')}</button>` });
    const v = p.view;
    v.insertAdjacentHTML('beforeend', `<div class="pblur" aria-hidden="true"><i></i><i></i><i></i></div>
      <label class="search conv-search" hidden>${XS.icon('search')}<input type="search" placeholder="在会话里搜索" aria-label="在会话里搜索消息">
      <span class="cs-count" data-cs-count></span><button class="cs-x" data-a="findclose" aria-label="结束搜索">${XS.icon('close')}</button></label>
      <div class="composer">
        <div class="q-bar" hidden><span class="q-bar-text"></span><button class="q-bar-x" data-a="unquote" aria-label="取消引用">${XS.icon('close')}</button></div>
        <textarea rows="1" placeholder="发消息" aria-label="输入消息" enterkeyhint="send"></textarea>
        <button class="send tap" aria-label="发送" disabled>${XS.icon('send')}</button></div>`);
    const ta = v.querySelector('textarea'), sendBtn = v.querySelector('.send');
    const qBar = v.querySelector('.q-bar'), qBarText = v.querySelector('.q-bar-text');
    const searchBox = v.querySelector('.conv-search'), searchInput = searchBox.querySelector('input'), csCount = v.querySelector('[data-cs-count]');
    let cont = c;
    let quoting = null;      // 正在引用的那条消息
    let query = '';          // 会话内搜索关键词
    let hitIndex = 0;

    // 引用块：原消息还在就显示它现在的文字，被删掉就明确写「原消息不可用」
    const quoteOf = (m, list) => {
      if (!m.quote) return '';
      const src = list.find(x => x.id === m.quote.id);
      return `<span class="q-quote${src ? '' : ' gone'}">${esc(src ? src.text : '原消息不可用')}</span>`;
    };

    const render = () => {
      const list = data.msgs(cid);
      let html = '', prevTs = 0;
      if (!list.length) html += `<div class="msg-notice">和「${esc(data.name(cont))}」的对话从这里开始。回复由你配置的 AI 生成。</div>`;
      list.forEach((m, i) => {
        if (m.ts - prevTs > GAP) html += `<div class="msg-time">${data.fmtTime(m.ts)}</div>`;
        const prev = list[i - 1], next = list[i + 1];
        const first = !prev || prev.role !== m.role || m.ts - prev.ts > GAP;
        const last = !next || next.role !== m.role || next.ts - m.ts > GAP || m.status === 'failed';
        const other = m.role === 'other';
        html += `<div class="msg ${other ? 'other' : 'self'}${first ? ' first' : ''}${last ? ' last' : ''}${m.status === 'sending' ? ' sending' : ''}" data-mid="${esc(m.id)}">
          ${other ? (last ? data.avatar(cont) : '<span class="av-space"></span>') : ''}<div class="bubble">${quoteOf(m, list)}${fmt(m.text)}</div></div>`;
        if (m.status === 'failed') {
          const cfg = m.error && (m.error.kind === 'config' || m.error.kind === 'flight');
          html += `<div class="msg-state err"><button data-retry="${m.id}">${XS.icon('alert')}<span>发送失败 · ${esc(m.error ? m.error.message : '')}${cfg ? '' : ' · 点此重试'}</span></button></div>`;
          if (cfg) html += `<div class="msg-notice">${m.error.kind === 'flight' ? '飞行模式开启中' : 'AI 接口还没配置好'} · <button data-a="goset">去设置</button></div>`;
        }
        prevTs = m.ts;
      });
      if (data.pending[cid]) html += `<div class="msg other first last typing" aria-label="对方正在输入">${data.avatar(cont)}<div class="bubble"><i></i><i></i><i></i></div></div>`;
      p.body.innerHTML = html;
      applySearch();
      sync();
    };
    // 会话内搜索：命中整条消息就标记出来，并跳到第 n 条
    const hits = () => [...p.body.querySelectorAll('.msg')].filter(el => {
      const b = el.querySelector('.bubble');
      return b && b.textContent.toLowerCase().includes(query);
    });
    function applySearch(){
      p.body.querySelectorAll('.msg.hit').forEach(el => el.classList.remove('hit'));
      if (!query){ csCount.textContent = ''; return; }
      const list = hits();
      if (!list.length){ csCount.textContent = '没有匹配'; return; }
      hitIndex = Math.min(hitIndex, list.length - 1);
      list.forEach(el => el.classList.add('hit'));
      list[hitIndex].classList.add('hit-now');
      csCount.textContent = (hitIndex + 1) + ' / ' + list.length;
    }
    function jumpHit(step){
      const list = hits();
      if (!list.length) return;
      hitIndex = (hitIndex + step + list.length) % list.length;
      applySearch();
      const el = list[hitIndex];
      const top = el.offsetTop - p.scroll.clientHeight / 2 + el.offsetHeight / 2;
      p.scroll.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    const toBottom = () => { p.scroll.scrollTop = p.scroll.scrollHeight; };
    const sync = () => { sendBtn.disabled = !ta.value.trim() || !!data.pending[cid]; };
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; };

    // 引用条：显示要引用的那句话，可以取消
    function setQuote(m){
      quoting = m || null;
      qBar.hidden = !quoting;
      if (quoting) qBarText.textContent = quoting.text.replace(/\s+/g, ' ').slice(0, 60);
      sync();
    }

    function send(){
      const text = ta.value.trim();
      if (!text || data.pending[cid]) return;          // 空消息不发，等回复时不重复发
      const m = { id: XS.uid('m'), role: 'self', text, ts: Date.now(), status: 'sending' };
      if (quoting) m.quote = { id: quoting.id };       // 只记 ID，显示时回查原文
      const list = data.msgs(cid); list.push(m); data.saveMsgs(cid, list);
      ta.value = ''; grow(); setQuote(null);
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

    /* —— 会话内搜索 —— */
    searchInput.addEventListener('input', () => { query = searchInput.value.trim().toLowerCase(); hitIndex = 0; applySearch(); });
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); jumpHit(1); } });
    csCount.addEventListener('click', () => jumpHit(1));

    /* —— 长按消息：引用 / 复制 / 收藏（自己的还能删）——
       手指移动超过 8px 或页面滚动就取消长按，不会误触 */
    let pressT = 0, press = null;
    const clearPress = () => { clearTimeout(pressT); press = null; };
    v.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      if (e.target.closest('.nav-btn, .composer, .conv-search, .menu, .q-bar')) return;
      const b = e.target.closest('.msg .bubble');
      if (!b) return;
      const mid = b.closest('.msg').dataset.mid;
      const m = data.msgs(cid).find(x => x.id === mid);
      if (!m) return;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, m, el: b.closest('.msg') };
      pressT = setTimeout(() => openMsgMenu(press), 450);
    }, true);
    v.addEventListener('pointermove', e => {
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) clearPress();
    }, true);
    ['pointerup', 'pointercancel'].forEach(t => v.addEventListener(t, clearPress, true));
    p.scroll.addEventListener('scroll', clearPress, { passive: true });

    function openMsgMenu(pr){
      if (!pr) return;
      const m = pr.m, el = pr.el;
      clearPress();
      el.classList.add('pressed');
      const fav = data.isFav(cid, m.id);
      XS.ui.menu(el.querySelector('.bubble'), [
        { label: '引用', icon: 'quote', onClick: () => { setQuote(m); ta.focus(); } },
        { label: '复制', icon: 'files', onClick: () => copyText(m.text) },
        { label: fav ? '取消收藏' : '收藏', icon: 'star', onClick: () => {
          if (fav){
            const f = data.favs().find(x => x.cid === cid && x.msgId === m.id);
            if (f) data.removeFav(f.id);
            XS.ui.toast('已取消收藏');
          } else {
            data.addFav({ id: XS.uid('f'), cid, msgId: m.id, text: m.text, ts: Date.now() });
            XS.ui.toast('已收藏');
          }
        } }
      ].concat(m.role === 'self' ? [{
        label: '删除这条消息', icon: 'trash', danger: true, onClick: async () => {
          if (await XS.ui.confirm({ title: '删除这条消息？', text: '只删这一条，其他消息不受影响。', ok: '删除', danger: true }))
            data.saveMsgs(cid, data.msgs(cid).filter(x => x.id !== m.id));
        }
      }] : []));
      setTimeout(() => el.classList.remove('pressed'), 700);
    }

    v.addEventListener('click', async e => {
      const r = e.target.closest('[data-retry]');
      if (r) return request(cid, r.dataset.retry);
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'find'){ searchBox.hidden = false; v.classList.add('searching'); searchInput.focus(); return; }
      if (a.dataset.a === 'findclose'){
        searchBox.hidden = true; v.classList.remove('searching');
        searchInput.value = ''; query = ''; hitIndex = 0; applySearch(); return;
      }
      if (a.dataset.a === 'unquote'){ setQuote(null); return; }
      if (a.dataset.a === 'goset') XS.nav.push(XS.settingsPages.api());
      if (a.dataset.a === 'more') XS.ui.menu(a, [
        { label: '角色记忆', icon: 'note', onClick: () => XS.nav.push(data.openMemories(cid)) },
        { label: '搜索消息', icon: 'search', onClick: () => { searchBox.hidden = false; v.classList.add('searching'); searchInput.focus(); } },
        { label: '编辑联系人', icon: 'edit', onClick: () => data.editContact(cont, n => { cont = n; p.setTitle(data.name(n)); render(); }) },
        { label: '清空聊天记录', icon: 'trash', danger: true, onClick: async () => {
          if (await XS.ui.confirm({ title: '清空聊天记录？', text: `和「${data.name(cont)}」的全部消息会被删除，无法恢复。`, ok: '清空', danger: true })) data.saveMsgs(cid, []);
        }},
        { label: '删除联系人', icon: 'close', danger: true, onClick: async () => {
          if (await XS.ui.confirm({ title: '删除联系人？', text: `「${data.name(cont)}」和聊天记录都会被删除，无法恢复。`, ok: '删除', danger: true })) { data.removeContact(cid); XS.nav.back(); }
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
