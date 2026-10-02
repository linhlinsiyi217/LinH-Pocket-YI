/* 核心：命名空间、事件、本地存储、设置
   所有数据只保存在这台设备的浏览器 localStorage（前缀 xs.v1.）。 */
(function(){
  const XS = window.XS = window.XS || {};
  const PREFIX = 'xs.v1.';

  // 事件总线
  const handlers = {};
  XS.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); return () => XS.off(ev, fn); };
  XS.off = (ev, fn) => { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); };
  XS.emit = (ev, data) => (handlers[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

  // 存储：localStorage 不可用时退回内存（并提示不会保存）
  const mem = {};
  let persistent = true;
  try { localStorage.setItem(PREFIX + '_t', '1'); localStorage.removeItem(PREFIX + '_t'); }
  catch (e) { persistent = false; }
  XS.store = {
    persistent,
    get(key, fallback){
      try {
        const raw = persistent ? localStorage.getItem(PREFIX + key) : mem[key];
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value){
      const raw = JSON.stringify(value);
      try { persistent ? localStorage.setItem(PREFIX + key, raw) : (mem[key] = raw); return true; }
      catch (e) { XS.emit('storage:error', e); return false; }
    },
    remove(key){ persistent ? localStorage.removeItem(PREFIX + key) : delete mem[key]; },
    usage(){ // 估算占用字节
      let n = 0;
      if (!persistent) return 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(PREFIX)) n += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
      return n;
    }
  };

  XS.uid = (p='id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  XS.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const merge = (base, over) => {
    const out = Array.isArray(base) ? base.slice() : { ...base };
    if (!isObj(over)) return out;
    for (const k in over) out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
    return out;
  };

  // 设置：默认值 = 当前认可的风格
  const DEFAULTS = {
    theme: 'light',      // light | dark | system
    glass: 'default',    // default | soft | clear | off
    pblur: true,         // 渐进模糊
    motion: 'system',    // system | reduce | full
    textScale: 1,        // 0.9 ~ 1.2
    flightMode: false,   // 开启后暂停所有 AI 请求
    replyMode: 'manual', // manual = 点「让 AI 回复」才回；auto = 发出消息就回
    api: { baseUrl: '', apiKey: '', model: '', temperature: '', maxHistory: '', timeout: 60 },
    // 语音：STT 和 TTS 各自一份，不和聊天 API 混用密钥
    voice: { stt: { baseUrl: '', apiKey: '', model: '' }, tts: { baseUrl: '', apiKey: '', model: '', voice: '' }, lang: 'zh-CN', autoplay: false },
    // 图片生成：独立一份配置
    image: { baseUrl: '', apiKey: '', model: '', size: '1024x1024', count: 1, style: '', negative: '', steps: '', cfg: '', seed: '' },
    custom: { wallpaper: null, icons: null, font: null, accent: null } // 高级自定义（预留）
  };
  let settings = merge(DEFAULTS, XS.store.get('settings', {}));
  // 旧版「自动锁定」已移除，清掉早先保存的选项
  if ('autoLock' in settings) { delete settings.autoLock; XS.store.set('settings', settings); }

  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  XS.settings = {
    DEFAULTS,
    all: () => settings,
    get: path => getPath(settings, path),
    set(path, value){
      const keys = path.split('.');
      const next = merge(settings, {});
      let o = next;
      keys.slice(0, -1).forEach(k => { o[k] = isObj(o[k]) ? { ...o[k] } : {}; o = o[k]; });
      o[keys[keys.length - 1]] = value;
      settings = next;
      XS.store.set('settings', settings);
      XS.emit('settings', { path, value });
    },
    resetAppearance(){
      ['theme','glass','pblur','motion','textScale'].forEach(k => { settings[k] = DEFAULTS[k]; });
      settings.custom = { ...DEFAULTS.custom };
      XS.store.set('settings', settings);
      XS.emit('settings', { path: '*' });
    }
  };

  // 用户资料（聊天里的「我」）
  XS.profile = {
    get: () => merge({ name: '我', persona: '' }, XS.store.get('profile', {})),
    set(p){ XS.store.set('profile', merge(XS.profile.get(), p)); XS.emit('profile'); }
  };
})();
