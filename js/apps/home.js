/* 应用登记 + 桌面（时间、应用格子、Dock）
   每个应用在自己的文件里补上 mount()；没有 mount 的应用点开会提示「暂未开放」 */
(function(){
  XS.apps = {
    chat:     { id: 'chat',     name: '聊天',    icon: 'chat',     variant: 'ai-dark',  dock: true },
    settings: { id: 'settings', name: '设置',    icon: 'settings', variant: 'ai-gray',  dock: true },
    charhall: { id: 'charhall', name: 'Char 馆', icon: 'char',     variant: 'ai-light' }
  };

  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const appBtn = a => `<button class="app tap" data-app="${a.id}" aria-label="${XS.esc(a.name)}">
    <span class="app-icon ${a.variant}">${XS.appIcons[a.icon]}</span><span class="app-label">${XS.esc(a.name)}</span></button>`;

  XS.renderHome = () => {
    const apps = Object.values(XS.apps);
    const home = XS.ui.h(`<div class="home">
      <div class="home-clock" aria-live="off"><div class="t"></div><div class="d"></div></div>
      <div class="home-grid">${apps.filter(a => !a.dock).map(appBtn).join('')}</div>
      <nav class="dock" aria-label="常用应用">${apps.filter(a => a.dock).map(appBtn).join('')}</nav></div>`);
    const t = home.querySelector('.t'), d = home.querySelector('.d');
    const tick = () => {
      const n = new Date();
      t.textContent = n.getHours() + ':' + String(n.getMinutes()).padStart(2, '0');
      d.textContent = `${n.getMonth() + 1}月${n.getDate()}日 星期${WEEK[n.getDay()]}`;
    };
    tick(); setInterval(tick, 15000);
    home.addEventListener('click', e => {
      const b = e.target.closest('[data-app]');
      if (b) XS.nav.openApp(b.dataset.app, b);
    });
    document.querySelector('.layer-home').replaceChildren(home);
  };
})();
