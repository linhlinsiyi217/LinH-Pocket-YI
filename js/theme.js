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
    // 高级自定义（预留）：只有设置了才覆盖默认
    const c = s.custom || {};
    c.wallpaper ? root.style.setProperty('--wallpaper', c.wallpaper) : root.style.removeProperty('--wallpaper');
    c.font ? root.style.setProperty('--font', c.font) : root.style.removeProperty('--font');
    const meta = document.querySelector('meta[name="theme-color"]');
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

  XS.theme = { apply, frame };
  XS.on('settings', apply);
  mqDark.addEventListener('change', apply);
  mqReduce.addEventListener('change', apply);
  addEventListener('resize', frame);
})();
