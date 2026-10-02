/* 桌面小组件模板：外观（body）、可编辑字段（fields）、默认尺寸（sizes）
   格子、拖动、编辑面板、点按跳转在 js/apps/home.js；这里只管“长什么样、能改什么”
   只读真实数据：聊天卡读现有会话，人物卡读“我的资料”或绑定的联系人，没有数据就显示空状态，不伪造内容 */
(function(){
  const esc = XS.esc;
  const ic = n => XS.icon(n);
  const img = (src, cls) => src ? `<img class="${cls}" src="${esc(src)}" alt="" draggable="false">` : '';
  const initial = s => esc(String(s || '?').trim().slice(0, 1).toUpperCase());
  const md = d => `${d.getMonth() + 1}月${d.getDate()}日`;

  // 时间类文字由 home.js 每分钟刷新：data-clock 的值就是这里的键；真实时间统一走 provider（widget-provider.js）
  const clockValues = () => XS.widgetProviders.time.get();

  const contacts = () => XS.chat ? XS.chat.contacts() : [];
  const lastMsg = id => { const l = XS.chat ? XS.chat.msgs(id) : []; return l[l.length - 1] || null; };
  // 绑定目标：人物卡 = 我 / 某个联系人；聊天卡 = 最近的会话 / 某个联系人
  const contactOpts = () => contacts().map(c => [c.id, c.name]);
  function profileData(cfg){
    const c = cfg.target && cfg.target !== 'me' ? contacts().find(x => x.id === cfg.target) : null;
    const me = XS.profile.get();
    const name = cfg.name || (c ? c.name : me.name && me.name !== '我' ? me.name : '我');
    return { c, name, acct: cfg.acct || '', bio: cfg.bio || '' };
  }
  function chatData(cfg){
    let c = null;
    if (cfg.target && cfg.target !== 'recent') c = contacts().find(x => x.id === cfg.target) || null;
    else c = contacts().map(x => ({ x, m: lastMsg(x.id) })).filter(o => o.m).sort((a, b) => b.m.ts - a.m.ts).map(o => o.x)[0] || null;
    return c ? { c, m: lastMsg(c.id) } : null;
  }
  const chatLine = (c, m) => !m ? '还没有消息，轻点开始聊天' : XS.chat.pending[c.id] ? '对方正在输入…' : (m.role === 'self' ? '我：' : '') + m.text;

  const K = {};
  /* 1. 人物卡：有封面是横幅英雄图（头像跨线压在下沿），没封面就居中头像/字标 + 名字 + 一句简介；
     空状态（默认“我”）不做空封面 + 默认圆头，只放字标、名字和一句“轻点编辑资料” */
  K.profile = { name: '人物卡', desc: '封面、头像、名字和一句简介，点按打开资料或角色', sizes: [[4, 2], [4, 4], [2, 2]],
    fields: [
      { k: 'img', t: 'image', label: '封面', ratio: 2.4, out: 900 },
      { k: 'av', t: 'image', label: '头像', ratio: 1, out: 320 },
      { k: 'name', t: 'text', label: '名字', max: 24, ph: () => profileData({}).name },
      { k: 'acct', t: 'text', label: '账号', max: 24, ph: () => '例如 @LinH' },
      { k: 'bio', t: 'text', label: '简介', max: 40, ph: () => '一句话介绍' },
      { k: 'target', t: 'target', label: '点按打开', opts: () => [['me', '我的资料'], ...contactOpts()] }
    ],
    body(cfg){
      const p = profileData(cfg);
      const hasCover = !!cfg.img;
      const av = cfg.av ? img(cfg.av, 'w-fill') : `<span class="w-mono">${initial(p.name)}</span>`;
      const bio = p.bio ? `<div class="w-bio">${esc(p.bio)}</div>` : '';
      return `<div class="w-p${hasCover ? ' w-p-cover' : ''}">
        ${hasCover ? `<div class="w-cover">${img(cfg.img, 'w-fill')}</div>` : ''}
        <div class="w-avatar">${av}</div>
        <div class="w-p-body"><div class="w-name">${esc(p.name)}</div>${p.acct ? `<div class="w-acct">${esc(p.acct)}</div>` : ''}${bio}</div>
      </div>`;
    } };
  /* 2. 照片卡：有照片时整卡铺满，照片是主角，标题浮在左下角；没照片时克制地邀请添加 */
  K.polaroid = { name: '照片卡', desc: '一张或多张照片，点按全屏预览', sizes: [[2, 2]],
    fields: [
      { k: 'imgs', t: 'images', label: '照片', max: 6, ratio: 1, out: 640 },
      { k: 'cap', t: 'text', label: '标题', max: 16, ph: () => '留空显示今天日期' }
    ],
    body(cfg){
      const list = cfg.imgs || [];
      if (!list.length) return `<span class="w-add"><span class="w-add-ring">${ic('plus')}</span></span>`;
      const slides = list.map((src, i) => img(src, `w-fill w-slide${i ? '' : ' on'}`)).join('');
      const cap = cfg.cap ? `<span>${esc(cfg.cap)}</span>` : `<span data-clock="md"></span>`;
      return `<div class="w-photo">${slides}${list.length > 1 ? `<span class="w-count">${list.length}</span>` : ''}</div>
        <div class="w-cap">${cap}</div>`;
    } };
  /* 3. 双格回忆：两张照片错位排在白底卡里，细线分隔，角落日期和一句话 */
  K.memory = { name: '双格回忆', desc: '两张照片错位排列，配日期和一句话', sizes: [[4, 2]],
    fields: [
      { k: 'imgs', t: 'images', label: '照片', max: 2, ratio: .8, out: 480 },
      { k: 'date', t: 'text', label: '日期', max: 16, ph: () => '例如 2026.05.20' },
      { k: 'text', t: 'text', label: '一句话', max: 30, ph: () => '留一句话给这天' },
      { k: 'target', t: 'target', label: '点按打开', opts: () => [['view', '照片预览'], ['photos', '相册']] }
    ],
    body(cfg){
      const [a, b] = cfg.imgs || [];
      const slot = (src, n) => `<div class="w-slot w-slot${n}">${src ? img(src, 'w-fill') : ic('image')}</div>`;
      return `${slot(a, 1)}${slot(b, 2)}<div class="w-mtext"><div class="w-mdate">${esc(cfg.date || '')}</div>
        <div class="w-mline">${esc(cfg.text || (a || b ? '' : '长按编辑，放两张照片'))}</div></div>`;
    } };
  /* 4. 音乐：封面 + 曲名 / 歌手 + 播放键；没有歌曲时也保持完整卡面（封面占位、曲名、播放键都在，只是停在“未在播放”）。
     项目还没有播放器，播放键是视觉控件，点按整卡打开音乐 */
  K.music = { name: '音乐', desc: '封面、曲名、歌手和播放键，点按打开音乐', sizes: [[2, 2], [4, 1]],
    fields: [
      { k: 'img', t: 'image', label: '封面', ratio: 1, out: 480 },
      { k: 'title', t: 'text', label: '曲名', max: 24, ph: () => '未在播放' },
      { k: 'artist', t: 'text', label: '歌手', max: 24, ph: () => '例如 林海' }
    ],
    body(cfg){
      const on = !!(cfg.title || cfg.img);
      const cover = cfg.img ? img(cfg.img, 'w-fill') : ic('music');
      const artist = cfg.artist ? `<div class="w-artist">${esc(cfg.artist)}</div>` : '';
      const play = `<span class="w-play${on ? '' : ' is-off'}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span>`;
      const bar = on ? `<div class="w-bar"><i style="width:${Math.round(XS.provider.get('music').progress * 100)}%"></i></div>` : '';
      return `<div class="w-cover-sq${on ? ' is-on' : ''}">${cover}</div>
        <div class="w-foot"><div class="w-minfo"><div class="w-title">${esc(cfg.title || '未在播放')}</div>${artist}</div>${play}</div>${bar}`;
    } };
  /* 5. 便签：低矮纸条，左边小图标 + 日期，右边最多两行文字 */
  K.note = { name: '便签', desc: '一句话便签，点按直接修改', sizes: [[4, 1], [2, 2]],
    fields: [
      { k: 'text', t: 'area', label: '内容', max: 80, ph: () => '想记下的一句话' },
      { k: 'target', t: 'target', label: '点按', opts: () => [['edit', '直接编辑'], ['notes', '打开备忘录']] }
    ],
    body(cfg){
      const d = cfg.at ? new Date(cfg.at) : null;
      return `<div class="w-nside">${ic('edit')}<span>${d ? md(d) : ''}</span></div>
        <div class="w-ntext${cfg.text ? '' : ' is-ph'}">${esc(cfg.text || '轻点写一句话')}</div>`;
    } };
  /* 6. 日期时间：直接排在壁纸上，不占半屏 */
  K.time = { name: '日期时间', desc: '当前时间，可带日期和问候', sizes: [[4, 1], [2, 1]],
    fields: [{ k: 'style', t: 'seg', label: '样式', opts: [['full', '时间＋日期'], ['time', '只显示时间']] }],
    body(cfg){
      return cfg.style === 'time' ? '<div class="w-t" data-clock="t"></div>'
        : '<div class="w-t" data-clock="t"></div><div class="w-tside"><div class="w-g" data-clock="g"></div><div class="w-d" data-clock="wd"></div></div>';
    } };
  /* 7. 聊天入口：最近会话或指定联系人；没有会话时是“开始聊天” */
  K.chat = { name: '聊天', desc: '最近的会话，点按直接进入', sizes: [[2, 2], [4, 1]],
    fields: [{ k: 'target', t: 'target', label: '显示', opts: () => [['recent', '最近的会话'], ...contactOpts()] }],
    body(cfg){
      const d = chatData(cfg);
      if (!d) return `<div class="w-chat-empty">${ic('chat')}<span>开始聊天</span></div>`;
      return `<div class="w-chead"><span class="w-cav">${initial(d.c.name)}</span><span class="w-cname">${esc(d.c.name)}</span>
        ${d.m ? `<span class="w-ctime">${esc(XS.chat.fmtTime(d.m.ts))}</span>` : ''}</div><div class="w-cline">${esc(chatLine(d.c, d.m))}</div>`;
    } };

  /* —— 新预设：数据全部来自 Provider（widget-provider.js），组件不写死数据 —— */
  /* 8. 极简时钟：真实系统时间 */
  K.clockMin = { name: '极简时钟', desc: '时间＋日期，只留核心信息', sizes: [[2, 2], [4, 2]],
    body(){
      return `<div class="wcm-t" data-clock="t"></div><div class="wcm-d"><span data-clock="w"></span><span data-clock="md"></span></div>`;
    } };
  /* 9. 天气：数据来自 provider（当前为 Mock，后续接真实 API） */
  K.weather = { name: '天气', desc: '当前温度与天气，点按打开天气', sizes: [[2, 2], [4, 2]],
    body(){
      const w = XS.provider.get('weather');
      return `<div class="wv-temp">${w.temp}<i>°</i></div>
        <div class="wv-cond">${esc(w.cond)}<span class="wv-loc">${esc(w.loc)}</span></div>
        <div class="wv-range">最高 ${w.high}°　最低 ${w.low}°</div>`;
    } };
  /* 10. 日历：真实本月日历，今天高亮 */
  K.calendar = { name: '日历', desc: '本月日历，今天高亮，点按打开日历', sizes: [[2, 2], [4, 2]],
    body(){
      const d = XS.provider.get('date');
      const rows = d.weeks.map(wk => `<div class="wcal-row">${wk.map(n => n == null ? '<i></i>' : `<b${n === d.today ? ' class="on"' : ''}>${n}</b>`).join('')}</div>`).join('');
      return `<div class="wcal-head">${d.month}</div>${rows}`;
    } };
  /* 12. 电量：数据来自 provider（当前为 Mock，后续可换 navigator.getBattery()） */
  K.battery = { name: '电量', desc: '设备电量，点按打开设置', sizes: [[2, 2], [4, 1]],
    body(){
      const b = XS.provider.get('battery');
      return `<div class="wbt-num">${b.level}<i>%</i></div>
        <div class="wbt-bar"><i style="width:${b.level}%"></i></div>${b.charging ? '<div class="wbt-ch">充电中</div>' : ''}`;
    } };
  /* 13. 照片墙：多张照片拼墙，点按全屏预览 */
  K.photowall = { name: '照片墙', desc: '多张照片拼成一面墙，点按全屏预览', sizes: [[2, 2], [4, 2]],
    fields: [{ k: 'imgs', t: 'images', label: '照片', max: 4, ratio: 1, out: 640 }],
    body(cfg){
      const list = cfg.imgs || [];
      if (!list.length) return `<span class="w-add"><span class="w-add-ring">${ic('plus')}</span></span>`;
      const n = Math.min(list.length, 4);
      return list.slice(0, 4).map((src, i) => `<span class="wpw-cell wpw-${n}-${i}">${img(src, 'w-fill')}</span>`).join('');
    } };

  /* 旧版小组件：保留给已有布局，不在选择器里出现；外观跟着新卡面走 */
  const LEGACY_F = [{ k: 'l1', t: 'text', label: '第一行', max: 40, ph: () => '自动' }, { k: 'l2', t: 'text', label: '第二行', max: 40, ph: () => '自动' },
    { k: 'img', t: 'image', label: '背景图', ratio: 1, out: 720 }];
  const line = (n, key, cls) => `<div class="${cls}" data-line="${n}" data-clock="${key}"></div>`;
  K.clock = { name: '时钟', legacy: true, sizes: [[2, 2], [4, 2], [4, 4]], fields: LEGACY_F,
    body: () => `<div class="w-top">${line(1, 'w', 'w-week')}${line(2, 'md', 'w-date')}</div><div class="w-time" data-clock="t"></div>` };
  K.clockWide = { ...K.clock, name: '时钟（宽）', sizes: [[4, 2], [2, 2], [4, 4]] };
  K.date = { name: '日历', legacy: true, sizes: [[2, 2], [4, 2], [4, 4]], fields: LEGACY_F,
    body: () => `${line(1, 'w', 'w-week')}<div class="w-day" data-clock="day"></div>${line(2, 'ym', 'w-date')}` };

  // 按字段表整理配置：只留认识的字段，文字截长度，图片必须是 dataURL
  const isImg = s => typeof s === 'string' && /^data:image\//.test(s);
  function clean(kind, c){
    if (!c || typeof c !== 'object') return null;
    // 旧版个人卡片用 l1 / l2 存名字和签名
    if (kind === 'profile') { if (c.l1 && !c.name) c = { ...c, name: c.l1 }; if (c.l2 && !c.bio) c = { ...c, bio: c.l2 }; }
    const out = {};
    (K[kind].fields || []).forEach(f => {
      const v = c[f.k];
      if (f.t === 'text' || f.t === 'area') { if (typeof v === 'string' && v.trim()) out[f.k] = v.slice(0, f.max); }
      else if (f.t === 'image') { if (isImg(v)) out[f.k] = v; }
      else if (f.t === 'images') { if (Array.isArray(v)) { const l = v.filter(isImg).slice(0, f.max); if (l.length) out[f.k] = l; } }
      else if (f.t === 'seg') { if (f.opts.some(o => o[0] === v)) out[f.k] = v; }
      else if (f.t === 'target') { if (typeof v === 'string' && /^[\w-]{1,64}$/.test(v)) out[f.k] = v; }
    });
    if (kind === 'note' && out.text && Number.isFinite(c.at)) out.at = c.at;
    if (typeof c.css === 'string' && c.css.trim()) out.css = c.css.slice(0, 4000);
    return Object.keys(out).length ? out : null;
  }

  XS.widgets = { kinds: K, clean, clockValues, profileData, chatData };
})();
