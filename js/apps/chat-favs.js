/* 收藏页：长按消息收藏下来的内容在这里
   跨刷新保留，显示收藏时的原文和来自哪个联系人；可以不进会话直接删掉 */
(function(){
  const esc = XS.esc, data = XS.chat;

  data.openFavs = () => {
    const p = XS.nav.page({ title: '收藏', back: true, cls: 'fav-page' });
    const render = () => {
      const list = data.favs();
      if (!list.length){
        p.body.innerHTML = '<div class="empty">' + XS.icon('folder')
          + '<h3>还没有收藏</h3><p>在聊天里长按一条消息，选「收藏」就会出现在这里。</p></div>';
        return;
      }
      p.body.innerHTML = '<div class="fav-list">' + list.map(f => {
        const c = data.contact(f.cid);
        const who = c ? data.name(c) : '已删除的联系人';
        return '<div class="fav-item">'
          + '<div class="fav-head"><span class="fav-who">' + esc(who) + '</span>'
          + '<span class="fav-time">' + data.fmtTime(f.ts) + '</span></div>'
          + '<p class="fav-text">' + esc(f.text) + '</p>'
          + '<div class="fav-acts">'
          + (c ? '<button class="fav-btn" data-goto="' + esc(f.cid) + '">打开会话</button>' : '')
          + '<button class="fav-btn danger" data-delfav="' + esc(f.id) + '">删除</button>'
          + '</div></div>';
      }).join('') + '</div>';
    };
    p.view.addEventListener('click', async e => {
      const g = e.target.closest('[data-goto]'), d = e.target.closest('[data-delfav]');
      if (g){
        const c = data.contact(g.dataset.goto);
        if (c) XS.nav.push(data.openConv(c.id));
        return;
      }
      if (d){
        const ok = await XS.ui.confirm({ title: '删除这条收藏？', text: '只删收藏，聊天记录不受影响。', ok: '删除', danger: true });
        if (ok){ data.removeFav(d.dataset.delfav); render(); }
      }
    });
    const off = XS.on('chat:change', () => { if (!p.view.isConnected) return off(); render(); });
    p.view.addEventListener('shown', render);
    render();
    return p.view;
  };
})();
