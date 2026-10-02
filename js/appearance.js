/* 外观插件引擎：方案（浅色 / 深色…）、整体主题、聊天气泡、聊天背景、头像、底栏、高级 CSS
   数据在 xs.v1.appearance：{ v, active, presets:[{ id, name, data }] }
   规则：
   - 每一段都有独立的 on；关掉就整段回到默认，其余段不受影响。
   - 应用自定义覆盖全局：变量按段写，没开的段根本不写。
   - 高级 CSS 只挂在 .screen 里（用 CSS 嵌套做作用域），并且打开「外观与插件」页时自动
     在 .screen 上挂 xs-safe 停用，所以样式写坏也进得去这个页面。
     地址后面加 ?safe=1 可以整体停用自定义 CSS。 */
(function(){
  const root = document.documentElement;
  const KEY = 'appearance';
  const STYLE_ID = 'xs-appearance-css';

  /* —— 我们可能写上去的变量：每次 apply 前先全部清掉，避免残留 —— */
  const VARS = [
    '--c-bg', '--c-bg-grouped', '--c-surface', '--c-text', '--c-text-secondary', '--c-primary',
    '--home-wall', '--wallpaper', '--chat-bg', '--chat-nav',
    '--bb-other-bg', '--bb-other-img', '--bb-other-text', '--bb-other-ring', '--bb-other-shadow', '--bb-other-radius', '--bb-other-pad', '--bb-other-bw',
    '--bb-self-bg', '--bb-self-img', '--bb-self-text', '--bb-self-ring', '--bb-self-shadow', '--bb-self-radius', '--bb-self-pad', '--bb-self-bw',
    '--av-border', '--av-border-color', '--av-radius',
    '--composer-bg', '--composer-radius',
    '--tabbar-h', '--tabbar-radius', '--tabbar-alpha', '--tabbar-bg'
  ];

  /* —— 默认值（空 / false = 不覆盖，走现有默认） —— */
  const blank = () => ({
    theme:   { on:false, mode:'', bg:'', surface:'', text:'', secondary:'', primary:'', wall:'', wallImg:'' },
    chat:    { on:false, type:'color', color:'', media:'' },
    bubble:  { on:false,
      other: { bg:'', img:'', text:'', radius:'', border:'', borderColor:'', shadow:'', pad:'', tail:false },
      self:  { bg:'', img:'', text:'', radius:'', border:'', borderColor:'', shadow:'', pad:'', tail:false } },
    avatar:  { on:false, border:'', borderColor:'', shape:'' },
    composer:{ on:false, bg:'', radius:'' },
    tabbar:  { on:false, style:'', h:'', radius:'', alpha:'', bg:'' },
    css:     { on:false, global:'', chat:'', left:'', right:'' }
  });
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  // 用 blank() 的形状补齐缺失字段：升级后旧方案不会缺键
  function fill(base, over){
    const out = { ...base };
    if (!isObj(over)) return out;
    for (const k in base){
      const b = base[k], o = over[k];
      if (isObj(b)) out[k] = fill(b, o);
      else if (o !== undefined) out[k] = o;
    }
    return out;
  }

  const DEFAULT_ID = 'p_default';
  const listeners = [];
  let db = load();

  function load(){
    const fallback = { v: 1, active: DEFAULT_ID, presets: [{ id: DEFAULT_ID, name: '默认', data: blank() }] };
    const raw = XS.store.get(KEY, null);
    if (!isObj(raw) || !Array.isArray(raw.presets) || !raw.presets.length) return fallback;
    const presets = raw.presets.filter(p => isObj(p) && p.id)
      .map(p => ({ id: String(p.id), name: String(p.name || '未命名').slice(0, 20), data: fill(blank(), p.data) }));
    if (!presets.length) return fallback;
    if (!presets.some(p => p.id === DEFAULT_ID)) presets.unshift(fallback.presets[0]);
    const active = presets.some(p => p.id === raw.active) ? raw.active : presets[0].id;
    return { v: 1, active, presets };
  }

  function persist(){
    if (!XS.store.set(KEY, db)) XS.ui.toast('保存失败：本地空间可能已满，先少放几张背景图');
    apply();                    // 每次改完立刻把变量重新写一遍，页面和预览同步生效
    XS.emit('appearance');
    listeners.slice().forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }

  const activePreset = () => db.presets.find(p => p.id === db.active) || db.presets[0];
  const data = () => activePreset().data;
  const get = path => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data());

  /* —— 取一段：没开就返回空串，等于「用默认」 —— */
  function val(seg){
    const s = data()[seg];
    return s && s.on ? s : null;
  }

  function write(path, value){
    const keys = path.split('.');
    let o = activePreset().data;
    keys.slice(0, -1).forEach(k => { if (!isObj(o[k])) o[k] = {}; o = o[k]; });
    o[keys[keys.length - 1]] = value;
  }
  function set(path, value){ write(path, value); persist(); }
  function setMany(pairs){ pairs.forEach(([p, v]) => write(p, v)); persist(); }

  /* —— 高级 CSS 的安全检查：括号配平、不能出现标签或 </style> —— */
  function cssSafe(s){
    s = String(s || '');
    if (/<\/?style/i.test(s) || /<[a-z!/]/i.test(s)) return false;
    const n = s.replace(/\/\*[\s\S]*?(\*\/|$)/g, '').replace(/"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/g, '""');
    let d = 0;
    for (const ch of n){ if (ch === '{') d++; else if (ch === '}' && --d < 0) return false; }
    return d === 0;
  }

  let blocks = [];   // 通过校验的自定义 CSS 段，供外观页的实时预览再套一层作用域
  const safeParam = () => new URLSearchParams(location.search).get('safe') === '1';
  const cssBroken = { global: false, chat: false, left: false, right: false };

  // 整段塞进 .screen（CSS 嵌套），作用域就只在手机内部；不支持嵌套的浏览器整段不生效
  const scoped = css => `@supports (selector(&)){.screen:not(.xs-safe){${css}}}`;

  const put = (v, value) => { if (value) root.style.setProperty(v, value); };

  /* —— 把当前方案写到 <html> 的变量和一段 <style> 上 —— */
  function apply(){
    VARS.forEach(v => root.style.removeProperty(v));
    const d = data();

    if (d.theme.on){
      if (d.theme.bg){ put('--c-bg', d.theme.bg); put('--c-bg-grouped', d.theme.bg); }
      put('--c-surface', d.theme.surface);
      put('--c-text', d.theme.text);
      put('--c-text-secondary', d.theme.secondary);
      put('--c-primary', d.theme.primary);
      // 桌面壁纸：有图用图，没图用色
      const wall = d.theme.wallImg ? `url("${d.theme.wallImg}")` : d.theme.wall;
      put('--home-wall', wall);
      put('--wallpaper', wall);
    }
    if (d.chat.on){
      // 图片：聊天区铺图，但导航栏保持实色，避免顶部一道半透明的图
      put('--chat-bg', d.chat.media ? `url("${d.chat.media}")` : d.chat.color);
      put('--chat-nav', d.chat.media ? '' : d.chat.color);
    }

    const B = d.bubble;
    if (B.on){
      const side = (k, o) => {
        // 图片气泡：九宫格拉伸，四角不变形（border-image），有图就不吃纯色和圆角
        if (o.img){
          put(`--bb-${k}-img`, `url("${o.img}")`);
          put(`--bb-${k}-bw`, '12px');   // 九宫格的边宽：四角按这个尺寸切出来，不跟着文字拉伸
        } else put(`--bb-${k}-bg`, o.bg);
        put(`--bb-${k}-text`, o.text);
        put(`--bb-${k}-shadow`, o.shadow);
        put(`--bb-${k}-radius`, o.radius === '' ? '' : o.radius + 'px');
        put(`--bb-${k}-pad`, o.pad);
        // 描边写成内圈阴影，不改变气泡的盒子尺寸
        if (o.border !== '' && o.border !== undefined) put(`--bb-${k}-ring`, `inset 0 0 0 ${o.border}px ${o.borderColor || 'rgba(0,0,0,.12)'}`);
        else put(`--bb-${k}-ring`, o.borderColor ? `inset 0 0 0 0.5px ${o.borderColor}` : '');
      };
      side('other', B.other); side('self', B.self);
      root.dataset.bbTailOther = B.other.tail ? 'on' : 'off';
      root.dataset.bbTailSelf = B.self.tail ? 'on' : 'off';
    } else {
      delete root.dataset.bbTailOther; delete root.dataset.bbTailSelf;
    }

    if (d.avatar.on){
      if (d.avatar.border) put('--av-border', d.avatar.border + 'px');
      put('--av-border-color', d.avatar.borderColor);
      if (d.avatar.shape !== '') put('--av-radius', d.avatar.shape);
    }
    if (d.composer.on){ put('--composer-bg', d.composer.bg); put('--composer-radius', d.composer.radius ? d.composer.radius + 'px' : ''); }
    if (d.tabbar.on){
      if (d.tabbar.style) root.dataset.tabStyle = d.tabbar.style;
      put('--tabbar-h', d.tabbar.h ? d.tabbar.h + 'px' : '');
      put('--tabbar-radius', d.tabbar.radius ? d.tabbar.radius + 'px' : '');
      put('--tabbar-alpha', d.tabbar.alpha === '' ? '' : d.tabbar.alpha);
      put('--tabbar-bg', d.tabbar.bg);
    } else {
      delete root.dataset.tabStyle;
    }

    /* —— 高级 CSS —— */
    let el = document.getElementById(STYLE_ID);
    if (!el){ el = document.createElement('style'); el.id = STYLE_ID; document.head.appendChild(el); }
    let out = '';
    blocks = [];
    ['global','chat','left','right'].forEach(k => { cssBroken[k] = false; });
    if (d.css.on && !safeParam()){
      let bad = false;
      ['global','chat','left','right'].forEach(k => {
        const src = d.css[k];
        if (!src || !src.trim()) return;
        if (!cssSafe(src)){ cssBroken[k] = true; bad = true; return; }
        blocks.push(src);
        out += scoped(src);
      });
      if (bad) XS.ui.toast('有一段自定义 CSS 括号不配平，已跳过那一段');
    }
    el.textContent = out;
  }

  /* —— 方案管理 —— */
  const presets = () => db.presets.map(p => ({ id: p.id, name: p.name }));
  const current = () => ({ id: activePreset().id, name: activePreset().name });
  function usePreset(id){
    if (!db.presets.some(p => p.id === id)) return;
    db.active = id;
    persist(); apply();
    const mode = get('theme.mode');
    if (mode) XS.settings.set('theme', mode);   // 方案里带了明暗，就跟着切
  }
  function addPreset(name){
    if (db.presets.length >= 12) { XS.ui.toast('方案最多 12 套'); return null; }
    const p = { id: XS.uid('p'), name: String(name || '新方案').slice(0, 20), data: blank() };
    db.presets.push(p); db.active = p.id; persist(); apply();
    return p.id;
  }
  function duplicatePreset(){
    if (db.presets.length >= 12) { XS.ui.toast('方案最多 12 套'); return null; }
    const src = activePreset();
    const p = { id: XS.uid('p'), name: (src.name + ' 副本').slice(0, 20), data: clone(src.data) };
    db.presets.push(p); db.active = p.id; persist(); apply();
    return p.id;
  }
  function renamePreset(id, name){
    const p = db.presets.find(x => x.id === id); if (!p) return;
    const n = String(name || '').trim().slice(0, 20);
    if (n) { p.name = n; persist(); }
  }
  function removePreset(id){
    if (id === DEFAULT_ID) { XS.ui.toast('默认方案不能删除'); return; }
    if (db.presets.length <= 1) { XS.ui.toast('至少保留一套方案'); return; }
    db.presets = db.presets.filter(p => p.id !== id);
    if (db.active === id) db.active = db.presets[0].id;
    persist(); apply();
  }
  function resetSection(seg){ activePreset().data[seg] = blank()[seg]; persist(); apply(); }
  function resetAll(){ activePreset().data = blank(); persist(); apply(); }

  /* —— 导出 / 导入 —— */
  const exportText = () => JSON.stringify(
    { app: 'LinH Pocket YI', kind: 'appearance', v: 1, presets: db.presets, active: db.active }, null, 2);

  // 导入失败绝不覆盖原配置：先整体解析校验通过，才替换
  function importText(text){
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: '不是合法的 JSON' }; }
    const list = obj && (Array.isArray(obj.presets) ? obj.presets : (obj.data ? [obj] : null));
    if (!list || !list.length) return { ok: false, error: '找不到方案数据' };
    const incoming = list.filter(p => isObj(p) && isObj(p.data)).map(p => ({
      id: String(p.id || XS.uid('p')),
      name: String(p.name || '导入的方案').slice(0, 20),
      data: fill(blank(), p.data)
    }));
    if (!incoming.length) return { ok: false, error: '方案是空的或格式不对' };
    // 默认方案是本地固定的那一个：导入里有就沿用导入的，没有就补回本地的，避免出现两个「默认」
    const seen = new Set(db.presets.filter(p => p.id !== DEFAULT_ID).map(p => p.id));
    incoming.forEach(p => { if (p.id !== DEFAULT_ID && seen.has(p.id)) p.id = XS.uid('p'); seen.add(p.id); });
    if (!incoming.some(p => p.id === DEFAULT_ID))
      incoming.unshift({ id: DEFAULT_ID, name: '默认', data: blank() });
    db.presets = incoming.slice(0, 12);
    db.active = db.presets.some(p => p.id === incoming[0].id) ? incoming[0].id : db.presets[0].id;
    persist(); apply();
    return { ok: true, count: incoming.length };
  }

  /* —— 外观页打开时停用高级 CSS，保证这个页面永远进得去 —— */
  let safeDepth = 0;
  function safe(on){
    safeDepth = Math.max(0, safeDepth + (on ? 1 : -1));
    const screen = document.querySelector('.screen');
    if (screen) screen.classList.toggle('xs-safe', safeDepth > 0 || safeParam());
  }
  if (safeParam()){
    const mark = () => { const s = document.querySelector('.screen'); if (s) s.classList.add('xs-safe'); };
    document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mark) : mark();
  }

  XS.appearance = {
    blank, apply, get, val, set, setMany,
    presets, current, usePreset, addPreset, duplicatePreset, renamePreset, removePreset,
    resetSection, resetAll, exportText, importText,
    cssSafe, cssBroken, safeParam, safe, DEFAULT_ID, cssBlocks: () => blocks.slice(),
    on: fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
  };
  apply();
})();
