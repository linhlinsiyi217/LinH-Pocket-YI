/* 页面导航：打开应用（从图标放大）、进入下一页（从右滑入）、返回、回桌面
   与浏览器历史同步：安卓返回键 = 返回上一页 */
(function(){
  const nav = XS.nav = {};
  const stack = [];           // 当前应用里打开的页面，stack[0] 是应用首页
  let origin = null;          // 打开应用时图标的中心点
  let busy = false;
  const layer = () => document.querySelector('.layer-apps');
  const dur = ms => document.documentElement.dataset.motion === 'reduce' ? 1 : ms;
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  const anim = (el, kf, ms) => el.animate(kf, { duration: dur(ms), easing: EASE, fill: 'both' }).finished.then(a => a.cancel()).catch(() => {});
  const homeBar = on => { const b = document.querySelector('.home-bar'); if (b) b.hidden = !on; };

  function iconOrigin(el){
    if (!el) return '50% 50%';
    const s = document.querySelector('.screen').getBoundingClientRect(), r = el.getBoundingClientRect(), k = XS.frameScale || 1;
    return `${(r.left + r.width / 2 - s.left) / k}px ${(r.top + r.height / 2 - s.top) / k}px`;
  }

  nav.openApp = async (id, iconEl) => {
    const app = XS.apps[id];
    if (!app) return;
    if (!app.mount) { XS.ui.toast(`「${app.name}」还在开发中，暂未开放`); return; }
    if (busy || stack.length) return;
    busy = true;
    const view = app.mount();
    origin = iconOrigin(iconEl && iconEl.querySelector('.app-icon'));
    view.style.transformOrigin = origin;
    layer().appendChild(view);
    stack.push(view);
    history.pushState({ xs: 1 }, '');
    homeBar(true);
    await anim(view, [{ transform: 'scale(.14)', opacity: 0, borderRadius: '60px' }, { transform: 'none', opacity: 1, borderRadius: '0px' }], 460);
    busy = false;
    view.dispatchEvent(new Event('shown'));
  };

  nav.push = async view => {
    if (busy) return;
    busy = true;
    const prev = stack[stack.length - 1];
    layer().appendChild(view);
    stack.push(view);
    history.pushState({ xs: stack.length }, '');
    view.style.boxShadow = '-8px 0 24px rgba(0,0,0,.06)';
    await Promise.all([
      anim(view, [{ transform: 'translate3d(100%,0,0)' }, { transform: 'none' }], 420),
      anim(prev, [{ transform: 'none' }, { transform: 'translate3d(-28%,0,0)' }], 420)
    ]);
    view.style.boxShadow = '';
    prev.style.visibility = 'hidden';
    busy = false;
    view.dispatchEvent(new Event('shown'));
  };

  async function popOne(){
    const top = stack.pop(), prev = stack[stack.length - 1];
    prev.style.visibility = '';
    await Promise.all([
      anim(top, [{ transform: 'none' }, { transform: 'translate3d(100%,0,0)' }], 380),
      anim(prev, [{ transform: 'translate3d(-28%,0,0)' }, { transform: 'none' }], 380)
    ]);
    top.remove();
    prev.dispatchEvent(new Event('shown'));
  }

  async function closeApp(){
    const views = stack.splice(0);
    const topView = views[views.length - 1];
    views.slice(0, -1).forEach(v => v.remove());
    topView.style.transformOrigin = origin || '50% 50%';
    homeBar(false);
    await anim(topView, [{ transform: 'none', opacity: 1, borderRadius: '0px' }, { transform: 'scale(.14)', opacity: 0, borderRadius: '60px' }], 400);
    topView.remove();
    XS.emit('home');
  }

  // 历史记录变化（返回键 / 返回按钮 / 回桌面）
  addEventListener('popstate', async e => {
    const target = (e.state && e.state.xs) || 0;
    if (!stack.length) return;
    busy = true;
    if (target === 0) await closeApp();
    else while (stack.length > target) await popOne();
    busy = false;
  });

  nav.back = () => { if (!busy && stack.length) history.back(); };
  nav.home = () => { if (!busy && stack.length) history.go(-stack.length); };
  nav.depth = () => stack.length;

  /* 标准页面：导航栏 + 可滚动内容（可选大标题） */
  nav.page = ({ title='', large=false, grouped=false, back=true, backText='', right='', cls='' }) => {
    const v = XS.ui.h(`<section class="view${grouped ? ' grouped' : ''} ${cls}" aria-label="${XS.esc(title)}">
      <header class="navbar${large ? '' : ' always'}"><div class="navbar-inner">
        <div class="nav-left">${back ? `<button class="nav-btn nav-back tap" aria-label="返回">${XS.icon('back')}${backText ? `<span>${XS.esc(backText)}</span>` : ''}</button>` : ''}</div>
        <div class="nav-title">${XS.esc(title)}</div><div class="nav-right">${right}</div></div></header>
      <div class="scroll">${large ? `<h1 class="large-title">${XS.esc(title)}</h1>` : ''}<div class="page-body"></div></div></section>`);
    const navbar = v.querySelector('.navbar'), scroll = v.querySelector('.scroll');
    const limit = large ? 38 : 2;
    scroll.addEventListener('scroll', () => navbar.classList.toggle('scrolled', scroll.scrollTop > limit), { passive: true });
    const b = v.querySelector('.nav-back'); if (b) b.onclick = nav.back;
    return { view: v, navbar, scroll, body: v.querySelector('.page-body'), setTitle(t){ v.querySelectorAll('.nav-title,.large-title').forEach(n => n.textContent = t); } };
  };

  /* 底部横条：点一下或向上滑 = 回桌面 */
  nav.bindHomeBar = bar => {
    let y0 = null;
    bar.addEventListener('pointerdown', e => { y0 = e.clientY; bar.setPointerCapture(e.pointerId); });
    bar.addEventListener('pointerup', e => { if (y0 != null && y0 - e.clientY > -6) nav.home(); y0 = null; });
    bar.addEventListener('pointercancel', () => { y0 = null; });
    bar.setAttribute('role', 'button'); bar.setAttribute('aria-label', '回到桌面'); bar.tabIndex = 0;
    bar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') nav.home(); });
  };
})();
