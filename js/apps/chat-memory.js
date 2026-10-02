/* 角色记忆：按联系人分开的长期记忆，用户可以查看、修改、删除
   没有记忆就传空，不臆造共同经历。
   世界书不在聊天里建第二套入口或数据——已有独立来源，AI 只按角色和话题读取相关条目。 */
(function(){
  const esc = XS.esc, data = XS.chat;
  const page = (title, cls) => XS.nav.page({ title, grouped: true, back: true, cls: 'set-page ' + (cls || '') });

  data.openMemories = cid => {
    const p = page('角色记忆', 'mem-page');
    const render = () => {
      const c = data.contact(cid);
      if (!c){ XS.nav.back(); return; }
      const list = data.memories(cid);
      p.body.innerHTML = ''
        + '<div class="group-block"><div class="group">'
        + XS.sui.row({ id: 'add', icon: 'plus', title: '添加一条记忆' })
        + '</div><div class="group-foot">每轮只会挑和当前话题相关的少量条目发给 AI；留空就是没有共同记忆。</div></div>'
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
      if (b.dataset.id === 'add'){ editMemory(cid, null, render); return; }
      const m = data.memories(cid).find(x => x.id === b.dataset.mem);
      if (!m) return;
      XS.ui.menu(b, [
        { label: '修改', icon: 'edit', onClick: () => editMemory(cid, m, render) },
        { label: '删除', icon: 'trash', danger: true, onClick: async () => {
          const ok = await XS.ui.confirm({ title: '删除这条记忆？', text: '删掉后 AI 不会再记得这件事。', ok: '删除', danger: true });
          if (ok){ data.saveMemories(cid, data.memories(cid).filter(x => x.id !== m.id)); render(); }
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
})();
