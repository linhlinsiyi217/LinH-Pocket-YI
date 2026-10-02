/* 角色记忆 与 世界书
   记忆：按联系人分开的长期记忆，用户可以查看、修改、删除；没填就不往请求里塞。
   世界书：AI 可按关键词检索的设定条目，和角色卡分开，不是一个大文本框。 */
(function(){
  const esc = XS.esc, data = XS.chat;
  const page = (title, cls) => XS.nav.page({ title, grouped: true, back: true, cls: 'set-page ' + (cls || '') });

  /* ============================ 角色记忆 ============================ */
  data.openMemories = cid => {
    const p = page('角色记忆', 'mem-page');
    const render = () => {
      const c = data.contact(cid);
      if (!c){ XS.nav.back(); return; }
      const list = data.memories(cid);
      p.body.innerHTML = ''
        + '<div class="group-block"><div class="group-foot">这里写的是角色真的知道的事。'
        + '每轮只会挑和当前话题相关的少量条目发给 AI；留空就是没有共同记忆，'
        + '角色不会凭空编造你们之间发生过的事。</div></div>'
        + '<div class="group-block"><div class="group">'
        + XS.sui.row({ id: 'add', icon: 'plus', title: '添加一条记忆' })
        + '</div></div>'
        + (list.length
          ? '<div class="group-block"><div class="group-label">' + list.length + ' 条</div><div class="group">'
            + list.map(m => '<button class="row mem-row tap-row" data-mem="' + esc(m.id) + '">'
              + '<span class="row-main"><span class="mem-text">' + esc(m.text) + '</span>'
              + '<span class="row-sub">' + data.fmtTime(m.ts) + '</span></span></button>').join('')
            + '</div></div>'
          : '<div class="group-block"><div class="group-foot">还没有记忆，点上面添加。</div></div>');
    };
    p.view.addEventListener('click', async e => {
      const b = e.target.closest('[data-id],[data-mem]');
      if (!b) return;
      if (b.dataset.id === 'add'){
        editMemory(cid, null, render);
        return;
      }
      const m = data.memories(cid).find(x => x.id === b.dataset.mem);
      if (!m) return;
      XS.ui.menu(b, [
        { label: '修改', icon: 'edit', onClick: () => editMemory(cid, m, render) },
        { label: '删除', icon: 'trash', danger: true, onClick: async () => {
          if (await XS.ui.confirm({ title: '删除这条记忆？', text: '删掉后 AI 不会再记得这件事。', ok: '删除', danger: true })){
            data.saveMemories(cid, data.memories(cid).filter(x => x.id !== m.id));
            render();
          }
        } }
      ]);
    });
    const off = XS.on('chat:change', () => { if (!p.view.isConnected) return off(); render(); });
    p.view.addEventListener('shown', render);
    render();
    return p.view;
  };

  function editMemory(cid, m, after){
    const box = XS.ui.h('<label class="field"><span>记忆内容</span><textarea rows="3" maxlength="200" placeholder="例如：约好周六一起去看展">'
      + esc(m ? m.text : '') + '</textarea></label>');
    XS.ui.sheet({ title: m ? '修改记忆' : '添加记忆', content: box, doneText: '保存', onDone(){
      const text = box.querySelector('textarea').value.trim();
      if (!text){ XS.ui.toast('内容不能为空'); return false; }
      const list = data.memories(cid);
      if (m){ const it = list.find(x => x.id === m.id); if (it){ it.text = text; it.ts = Date.now(); } }
      else list.unshift({ id: XS.uid('mem'), text, ts: Date.now() });
      data.saveMemories(cid, list);
      after && after();
    }});
  }

  /* ============================ 世界书 ============================ */
  data.openWorldbook = () => {
    const p = page('世界书', 'wb-page');
    const render = () => {
      const list = data.worldbook();
      p.body.innerHTML = ''
        + '<div class="group-block"><div class="group-foot">世界书是 AI 可以检索的设定条目，和角色卡分开。'
        + '每轮只会挑关键词命中的少量条目（最多 4 条）；勾了「总是带上」的每轮都会带。'
        + '这里不是放长篇设定的地方，一条写一件事。</div></div>'
        + '<div class="group-block"><div class="group">'
        + XS.sui.row({ id: 'add', icon: 'plus', title: '添加条目' })
        + '</div></div>'
        + (list.length
          ? list.map(w => '<div class="group-block"><div class="group-label">' + esc(w.name || '未命名') + '</div><div class="group">'
            + '<div class="row no-icon wb-row"><span class="row-main"><span class="wb-text">' + esc(w.content) + '</span>'
            + '<span class="row-sub">' + (w.keywords && w.keywords.length ? '关键词：' + esc(w.keywords.join('、')) : '没有关键词')
            + (w.always ? ' · 总是带上' : '') + '</span></span>'
            + '<button class="switch" role="switch" data-wb="' + esc(w.id) + '" aria-checked="' + (w.enabled !== false) + '" aria-label="启用这条世界书"></button>'
            + '<button class="ap-mini" data-wbedit="' + esc(w.id) + '" aria-label="编辑">' + XS.icon('edit') + '</button>'
            + '<button class="ap-mini" data-wbdel="' + esc(w.id) + '" aria-label="删除">' + XS.icon('trash') + '</button>'
            + '</div></div></div>').join('')
          : '<div class="group-foot">还没有条目，点上面添加。</div>')
        + '<div class="group-block"><div class="group-foot">删除条目只影响 AI 的参考，聊天记录不动。</div></div>';
    };
    p.view.addEventListener('click', async e => {
      const add = e.target.closest('[data-id="add"]');
      if (add){ editEntry(null, render); return; }
      const sw = e.target.closest('[data-wb]');
      if (sw){
        const list = data.worldbook(), w = list.find(x => x.id === sw.dataset.wb);
        if (w){ w.enabled = w.enabled === false; data.saveWorldbook(list); render(); }
        return;
      }
      const ed = e.target.closest('[data-wbedit]');
      if (ed){
        const w = data.worldbook().find(x => x.id === ed.dataset.wbedit);
        if (w) editEntry(w, render);
        return;
      }
      const del = e.target.closest('[data-wbdel]');
      if (del){
        if (await XS.ui.confirm({ title: '删除这条世界书？', text: '只影响 AI 的参考，聊天记录不动。', ok: '删除', danger: true })){
          data.saveWorldbook(data.worldbook().filter(x => x.id !== del.dataset.wbdel));
          render();
        }
      }
    });
    const off = XS.on('chat:change', () => { if (!p.view.isConnected) return off(); render(); });
    p.view.addEventListener('shown', render);
    render();
    return p.view;
  };

  function editEntry(w, after){
    const box = XS.ui.h('<div class="wb-form">'
      + '<label class="field"><span>名称</span><input maxlength="20" value="' + esc(w ? w.name : '') + '" placeholder="例如：住的城市"></label>'
      + '<label class="field"><span>内容</span><textarea rows="3" maxlength="300" placeholder="一条写一件事">' + esc(w ? w.content : '') + '</textarea></label>'
      + '<label class="field"><span>关键词</span><input maxlength="60" value="' + esc(w && w.keywords ? w.keywords.join('、') : '') + '" placeholder="用、分开，命中才带上"></label>'
      + '<div class="cf-row ap-row"><span class="ap-label">总是带上</span><span class="switch" data-sw="always" role="switch" aria-checked="' + !!(w && w.always) + '" aria-label="总是带上"></span></div>'
      + '</div>');
    box.querySelector('[data-sw=always]').parentElement.addEventListener('click', function(){
      const sw = this.querySelector('[data-sw=always]');
      sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
    });
    XS.ui.sheet({ title: w ? '编辑条目' : '添加条目', content: box, doneText: '保存', onDone(){
      const name = box.querySelector('input').value.trim();
      const content = box.querySelector('textarea').value.trim();
      if (!content){ XS.ui.toast('内容不能为空'); return false; }
      const kw = box.querySelectorAll('input')[1].value.split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean).slice(0, 8);
      const always = box.querySelector('[data-sw=always]').getAttribute('aria-checked') === 'true';
      const list = data.worldbook();
      if (w){ const it = list.find(x => x.id === w.id); if (it){ it.name = name; it.content = content; it.keywords = kw; it.always = always; } }
      else list.push({ id: XS.uid('wb'), name, content, keywords: kw, always, enabled: true });
      data.saveWorldbook(list);
      after && after();
    }});
  }
})();
