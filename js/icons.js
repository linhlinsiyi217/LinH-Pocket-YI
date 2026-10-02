/* 统一图标库
   系统图标：24×24 画布、线宽 1.6、圆角端点，全部线条绘制，颜色跟随文字。
   应用图标：60×60 完整图标，由底色 + 原创图形组成。不使用 emoji。 */
(function(){
  const P = {
    back:'<path d="M15 5l-7 7 7 7"/>',
    chev:'<path d="M9 5l7 7-7 7"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    resize:'<path d="M19 11v8h-8M19 19l-7-7"/>',
    folder:'<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    close:'<path d="M6 6l12 12M18 6L6 18"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    send:'<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>',
    more:'<circle cx="6" cy="12" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="18" cy="12" r=".9" fill="currentColor"/>',
    edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash:'<path d="M4.5 7h15M10 4h4M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7"/><path d="M10 11v6M14 11v6"/>',
    refresh:'<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
    alert:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.3" r=".6" fill="currentColor"/>',
    // 聊天
    chat:'<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A1.5 1.5 0 0 1 4 15.5z"/>',
    people:'<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.3a5 5 0 0 1 3 5.2"/>',
    person:'<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    personAdd:'<circle cx="10" cy="8.5" r="3.5"/><path d="M3 20a7 7 0 0 1 12.5-4.3"/><path d="M18.5 14v6M15.5 17h6"/>',
    // 设置
    airplane:'<path d="M10.5 3.8c0-1 .7-1.8 1.5-1.8s1.5.8 1.5 1.8V9l7 4.2v2l-7-2.2v4.6l2.2 1.7v1.7L12 20.2l-3.7.8v-1.7l2.2-1.7V13l-7 2.2v-2L10.5 9z"/>',
    plug:'<path d="M9 3v4M15 3v4M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0z"/><path d="M12 16v5"/>',
    wave:'<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3"/>',
    sun:'<circle cx="12" cy="12" r="3.8"/><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3"/>',
    grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
    access:'<circle cx="12" cy="4.8" r="1.6"/><path d="M5 8.5c2.3.8 4.6 1.2 7 1.2s4.7-.4 7-1.2M12 9.7V14M12 14l-3 6.5M12 14l3 6.5"/>',
    lock:'<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><path d="M12 14.6v2"/>',
    bell:'<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
    shield:'<path d="M12 3l7 3v5.5c0 4.3-3 7.8-7 9.5-4-1.7-7-5.2-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    db:'<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>',
    cloud:'<path d="M7 18.5h10.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.6 1.3A3.4 3.4 0 0 0 7 18.5z"/>',
    image:'<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="9.5" r="1.6"/><path d="M4 17l4.5-4.5 3.5 3.5 2.5-2.5L20 19"/>',
    apps:'<rect x="4" y="4" width="7" height="7" rx="2.2"/><rect x="13" y="4" width="7" height="7" rx="2.2"/><rect x="4" y="13" width="7" height="7" rx="2.2"/><circle cx="16.5" cy="16.5" r="3.5"/>',
    type:'<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    palette:'<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-1 .8-1.7 1.8-1.7H17a3.5 3.5 0 0 0 3.5-3.5c0-4.2-3.8-7.5-8.5-7.5z"/><circle cx="7.8" cy="11" r=".9" fill="currentColor"/><circle cx="10.5" cy="7.5" r=".9" fill="currentColor"/><circle cx="15" cy="7.8" r=".9" fill="currentColor"/>',
    glass:'<rect x="3.5" y="6" width="17" height="12" rx="6"/><path d="M8 9.5h5"/>',
    motion:'<path d="M3.5 12h3M3.5 8h5M3.5 16h5"/><circle cx="15.5" cy="12" r="5"/>',
    textsize:'<path d="M3 18l4.5-11L12 18M4.6 14h5.8M14 18l3-7.5 3 7.5M15 15.5h4"/>',
    gear:'<path d="M18.60 10.36L20.88 10.52L20.88 13.48L18.60 13.64L17.83 15.51L19.32 17.23L17.23 19.32L15.51 17.83L13.64 18.60L13.48 20.88L10.52 20.88L10.36 18.60L8.49 17.83L6.77 19.32L4.68 17.23L6.17 15.51L5.40 13.64L3.12 13.48L3.12 10.52L5.40 10.36L6.17 8.49L4.68 6.77L6.77 4.68L8.49 6.17L10.36 5.40L10.52 3.12L13.48 3.12L13.64 5.40L15.51 6.17L17.23 4.68L19.32 6.77L17.83 8.49z"/><circle cx="12" cy="12" r="2.8"/>',
    user:'<circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5a7 7 0 0 1 13 0"/><circle cx="12" cy="12" r="9"/>',
    // 桌面小组件
    music:'<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    note:'<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
    expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
  };
  const ic = (name, cls='') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name]||''}</svg>`;

  // 状态栏图标（实心小图形）
  const status = {
    signal:'<svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>',
    wifi:'<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .5C5.2.5 2.6 1.6.8 3.4L2 4.7a8.5 8.5 0 0 1 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3A6.7 6.7 0 0 0 8 4.1c-1.8 0-3.4.7-4.6 1.8l1.2 1.3c.9-.8 2.1-1.3 3.4-1.3zM8 9.3a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/></svg>',
    plane:'<svg width="16" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3.8c0-1 .7-1.8 1.5-1.8s1.5.8 1.5 1.8V9l7 4.2v2l-7-2.2v4.6l2.2 1.7v1.7L12 20.2l-3.7.8v-1.7l2.2-1.7V13l-7 2.2v-2L10.5 9z"/></svg>',
    battery:'<svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".38"/><rect x="2" y="2" width="18" height="9" rx="2"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" opacity=".4"/></svg>'
  };

  // 应用图标：底色写在 CSS（ai-dark / ai-light / ai-gray），这里只画图形
  const app = {
    chat:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M30 14c-10.5 0-19 7-19 15.6 0 4.9 2.8 9.3 7.1 12.1l-1.6 6.3 7.3-3.9c2 .6 4 .9 6.2.9 10.5 0 19-7 19-15.4S40.5 14 30 14z" fill="#fff"/>
      <circle cx="22.5" cy="29.8" r="2.3" fill="#1C1C1E"/><circle cx="30" cy="29.8" r="2.3" fill="#1C1C1E"/><circle cx="37.5" cy="29.8" r="2.3" fill="#1C1C1E"/></svg>`,
    settings:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r="15.5" fill="none" stroke="#3A3A3C" stroke-width="6.5" stroke-dasharray="5.6 6.57"/>
      <circle cx="30" cy="30" r="14" fill="none" stroke="#3A3A3C" stroke-width="5"/>
      <circle cx="30" cy="30" r="5.4" fill="none" stroke="#3A3A3C" stroke-width="3.2"/></svg>`,
    char:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="17" y="12" width="24" height="31" rx="5" fill="#D8D8DC" transform="rotate(-9 29 27.5)"/>
      <rect x="21" y="17" width="24" height="31" rx="5" fill="#1C1C1E"/>
      <circle cx="33" cy="28" r="4.6" fill="#fff"/>
      <path d="M25.5 42.5a7.5 7.5 0 0 1 15 0" fill="#fff"/></svg>`,
    photos:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="13" y="15" width="34" height="30" rx="6" fill="none" stroke="#1C1C1E" stroke-width="3.2"/>
      <circle cx="23" cy="25" r="3.5" fill="#1C1C1E"/>
      <path d="M14 41l8-8 5 5 4-4 9 9" fill="none" stroke="#1C1C1E" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    camera:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="12" y="19" width="36" height="28" rx="6" fill="none" stroke="#fff" stroke-width="3.2"/>
      <path d="M22 19l3-6h10l3 6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>
      <circle cx="30" cy="33" r="8" fill="none" stroke="#fff" stroke-width="3"/></svg>`,
    music:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M24 40V20l18-3v20" fill="none" stroke="#1C1C1E" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="20" cy="40" r="5" fill="#1C1C1E"/><circle cx="38" cy="37" r="5" fill="#1C1C1E"/></svg>`,
    notes:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M16 12h20l12 12v24a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="none" stroke="#1C1C1E" stroke-width="3.2"/>
      <path d="M36 12v12h12" fill="none" stroke="#1C1C1E" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="M22 32h16M22 38h10" stroke="#1C1C1E" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    calendar:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="13" y="16" width="34" height="32" rx="5" fill="none" stroke="#1C1C1E" stroke-width="3.2"/>
      <path d="M22 12v8M38 12v8M13 26h34" stroke="#1C1C1E" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="22" cy="35" r="1.8" fill="#1C1C1E"/><circle cx="30" cy="35" r="1.8" fill="#1C1C1E"/>
      <circle cx="38" cy="35" r="1.8" fill="#1C1C1E"/><circle cx="22" cy="42" r="1.8" fill="#1C1C1E"/></svg>`,
    weather:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="22" r="7" fill="none" stroke="#3A3A3C" stroke-width="3"/>
      <path d="M30 9v3M30 36v3M48 22h-3M15 22h-3M42.7 12.7l-2.1 2.1M19.4 36l-2.1 2.1M42.7 31.3l-2.1-2.1M19.4 18l-2.1-2.1" stroke="#3A3A3C" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M18 40h18a6 6 0 0 0 0-12 9 9 0 0 0-18 0" fill="none" stroke="#1C1C1E" stroke-width="3"/></svg>`,
    maps:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M30 16c-5.5 0-10 4.5-10 10 0 7.5 10 18 10 18s10-10.5 10-18c0-5.5-4.5-10-10-10z" fill="none" stroke="#1C1C1E" stroke-width="3.2"/>
      <circle cx="30" cy="26" r="4" fill="#1C1C1E"/></svg>`,
    browser:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="12" y="16" width="36" height="28" rx="5" fill="none" stroke="#1C1C1E" stroke-width="3.2"/>
      <path d="M12 24h36" stroke="#1C1C1E" stroke-width="3.2"/>
      <circle cx="18" cy="20" r="1.2" fill="#1C1C1E"/><circle cx="22.5" cy="20" r="1.2" fill="#1C1C1E"/>
      <circle cx="27" cy="20" r="1.2" fill="#1C1C1E"/></svg>`,
    files:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M22 12h10l6 6v24a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="none" stroke="#1C1C1E" stroke-width="3.2"/>
      <path d="M32 12v10h6" fill="none" stroke="#1C1C1E" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="M26 48h12a4 4 0 0 0 4-4V20" fill="none" stroke="#1C1C1E" stroke-width="3.2" stroke-linecap="round"/></svg>`,
    wallet:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="14" y="20" width="32" height="24" rx="4" fill="none" stroke="#1C1C1E" stroke-width="3.2"/>
      <path d="M18 20V16a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v4" fill="none" stroke="#1C1C1E" stroke-width="3.2"/>
      <circle cx="38" cy="32" r="2.5" fill="#1C1C1E"/></svg>`,
    messages:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="13" y="18" width="34" height="26" rx="5" fill="none" stroke="#1C1C1E" stroke-width="3.2"/>
      <path d="M13 24l14 10 3-2 3 2 14-10" fill="none" stroke="#1C1C1E" stroke-width="3" stroke-linejoin="round"/></svg>`,
    phone:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M42 38v5a3 3 0 0 1-3.3 3c-10.3-.9-18.7-7.5-21.5-15A14.8 14.8 0 0 1 15 21a3 3 0 0 1 3-3h5a3 3 0 0 1 3 2.6c.2 1.4.5 2.8 1 4a3 3 0 0 1-.7 3.2l-2.1 2.1a24 24 0 0 0 9 9l2.1-2.1a3 3 0 0 1 3.2-.7c1.2.5 2.6.8 4 1A3 3 0 0 1 45 40z" fill="none" stroke="#1C1C1E" stroke-width="3"/></svg>`,
    library:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M17 14h8v32h-8a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2z" fill="none" stroke="#3A3A3C" stroke-width="3"/>
      <rect x="25" y="14" width="10" height="32" rx="1" fill="none" stroke="#3A3A3C" stroke-width="3"/>
      <path d="M35 14h8a2 2 0 0 1 2 2v28a2 2 0 0 1-2 2h-8V14z" fill="none" stroke="#3A3A3C" stroke-width="3"/>
      <path d="M30 20v8" stroke="#3A3A3C" stroke-width="2" stroke-linecap="round"/></svg>`,
    wechat:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M24 18c-7 0-12.5 4.6-12.5 10.3 0 3.2 1.8 6.1 4.7 7.9l-1.1 4.3 4.8-2.6c1.3.4 2.7.6 4.1.6 7 0 12.5-4.6 12.5-10.3S31 18 24 18z" fill="#3A3A3C"/>
      <circle cx="19" cy="27.5" r="1.6" fill="#fff"/><circle cx="29" cy="27.5" r="1.6" fill="#fff"/>
      <path d="M32 28.5c.8-.2 1.6-.2 2.5-.2 5.8 0 10.5 3.8 10.5 8.5 0 2.6-1.5 5-4 6.5l.9 3.5-4-2.2c-1.1.3-2.2.5-3.4.5-5.8 0-10.5-3.8-10.5-8.5 0-.4 0-.7.1-1.1" fill="#3A3A3C"/>
      <circle cx="38" cy="36.5" r="1.3" fill="#fff"/><circle cx="44.5" cy="36.5" r="1.3" fill="#fff"/></svg>`,
    moments:`<svg viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r="18" fill="none" stroke="#3A3A3C" stroke-width="3"/>
      <circle cx="30" cy="30" r="4" fill="#3A3A3C"/>
      <circle cx="30" cy="15" r="2.5" fill="#3A3A3C"/><circle cx="41.5" cy="21.5" r="2.5" fill="#3A3A3C"/>
      <circle cx="45" cy="30" r="2.5" fill="#3A3A3C"/><circle cx="18.5" cy="38.5" r="2.5" fill="#3A3A3C"/></svg>`
  };

  window.XS = window.XS || {};
  XS.icon = ic; XS.statusIcons = status; XS.appIcons = app;
})();
