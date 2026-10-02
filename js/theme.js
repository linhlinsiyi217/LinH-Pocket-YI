/* 外观：把设置写到 <html> 的 data-* 属性和 CSS 变量上 */
(function(){
  const root = document.documentElement;
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');

  function apply(){
    const s = XS.settings.all();
    const dark = s.theme === 'dark' || (s.theme === 'system' && mqDark.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.glass = s.glass;
    root.dataset.pblur = s.pblur ? 'on' : 'off';
    root.dataset.motion = s.motion === 'reduce' || (s.motion === 'system' && mqReduce.matches) ? 'reduce' : 'full';
    root.style.setProperty('--font-scale', s.textScale);
    // 壁纸已交给「外观与插件」管理，这里不再动 --wallpaper / --home-wall
    const c = s.custom || {};
    c.font ? root.style.setProperty('--font', c.font) : root.style.removeProperty('--font');
    const meta = document.querySelector('meta[name="theme-color"]');
    // 和桌面壁纸顶部同色，全屏 / 安装后系统状态栏不会出现一条色差
    if (meta) meta.content = dark ? '#000000' : '#FFFFFF';
  }

  // 电脑上显示手机外框，手机上直接全屏
  function frame(){
    const full = innerWidth <= 500 || matchMedia('(pointer: coarse)').matches;
    root.dataset.frame = full ? 'full' : 'device';
    // 显示模式：fullscreen（安装后系统栏全隐，假状态栏是唯一一层）>
    // standalone（安装后系统状态栏由系统画，页面里那条收起）> browser（普通浏览器）
    root.dataset.dm = matchMedia('(display-mode: fullscreen)').matches ? 'fullscreen'
      : matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser';
    const dev = document.querySelector('.device');
    if (!dev) return;
    if (full) { dev.style.transform = ''; XS.frameScale = 1; return; }
    const k = Math.min(1, (innerHeight - 32) / 864, (innerWidth - 32) / 410);
    XS.frameScale = k;
    dev.style.transform = `translate(-50%, -50%) scale(${k})`;
  }

  /* 键盘与真实视口高度：
     .device 用 position:fixed;inset:0，高度跟「布局视口」走；iOS 上键盘弹出时布局视口不变，
     输入框会被键盘盖住。这里把 visualViewport 的实际高度写进 --vv-h，让整台手机跟着收。
     双指放大时不跟着改（否则缩放会把界面也缩掉）。 */
  function viewport(){
    const vv = window.visualViewport;
    if (vv && vv.scale > 1.01) return;
    const h = vv ? vv.height : innerHeight;
    root.style.setProperty('--vv-h', Math.round(h) + 'px');
    // iOS：键盘弹出时布局视口不缩，两者差值很大；安卓会一起缩，差值接近 0
    const kb = !!(vv && innerHeight - vv.height > 120);
    if (kb) root.dataset.kb = 'on'; else delete root.dataset.kb;
  }

  XS.theme = { apply, frame, viewport };
  XS.on('settings', apply);
  mqDark.addEventListener('change', apply);
  mqReduce.addEventListener('change', apply);
  addEventListener('resize', frame);
  addEventListener('resize', viewport);
  if (window.visualViewport){
    visualViewport.addEventListener('resize', viewport);
    visualViewport.addEventListener('scroll', viewport);
  }
  viewport();
})();
