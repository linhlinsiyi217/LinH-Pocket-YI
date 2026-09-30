/* 锁屏密码（本机界面锁）
   只是这台设备上「小手机」界面的一把锁：只在本机验证，不连服务器，不保护任何线上账号或数据库，也不加密本地数据。
   不保存明文：xs.v1.passcode = { v, salt, hash, iter, len }，hash 为 PBKDF2-SHA256（加盐、多轮），len 是位数（4 或 6）。
   输错次数和冷却截止时间存在 xs.v1.passcode.guard，刷新、重开都不会清零。
   XS.passcode.pad() 是锁屏和设置共用的数字键盘：输入只留在闭包里，页面上只显示圆点。 */
(function(){
  const KEY = 'passcode', GUARD = 'passcode.guard', LENS = [4, 6], ITER = 150000, FREE = 5;
  const enc = new TextEncoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  // WebCrypto 只在 https / localhost 可用；存储不持久时设了也会在刷新后丢失，不允许开启
  const cryptoOk = !!(window.isSecureContext && window.crypto && crypto.subtle);

  async function derive(code, salt, iter){
    const k = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, 256));
  }
  const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
  const rec = () => { const r = XS.store.get(KEY, null); return r && r.hash && r.salt ? r : null; };
  // 当前密码的位数；早期只有 6 位，没有 len 字段的记录按 6 位算
  const length = () => { const r = rec(); return r && LENS.includes(r.len) ? r.len : 6; };

  // 冷却：前 5 次输错不等待；之后每错一次等待 30 秒、1 分钟、2 分钟……最多 15 分钟
  const guard = () => ({ fails: 0, until: 0, ...XS.store.get(GUARD, {}) });
  const waitMs = () => Math.max(0, guard().until - Date.now());
  const penalty = n => n < FREE ? 0 : Math.min(15 * 60e3, 30e3 * 2 ** (n - FREE));

  async function set(code){
    if (!cryptoOk || !XS.store.persistent) throw new Error('当前浏览器环境不支持设置锁屏密码');
    if (!/^\d+$/.test(code) || !LENS.includes(code.length)) throw new Error('请输入 4 位或 6 位数字');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(code, salt, ITER);
    if (!XS.store.set(KEY, { v: 1, salt: b64(salt), hash, iter: ITER, len: code.length })) throw new Error('保存失败：本地空间可能已满');
    XS.store.remove(GUARD);
    XS.emit('passcode');
  }
  // 返回 { ok } 或 { ok:false, left（还能错几次不用等）, wait（需等待毫秒）, error }
  async function verify(code){
    const r = rec(); if (!r) return { ok: true };
    const w = waitMs(); if (w) return { ok: false, wait: w };
    let ok = false;
    try { ok = same(await derive(code, unb64(r.salt), r.iter), r.hash); }
    catch (e) { return { ok: false, error: '当前浏览器无法验证密码，请用 https 地址打开' }; }
    if (ok) { XS.store.remove(GUARD); return { ok: true }; }
    const g = guard(); g.fails++;
    const pen = penalty(g.fails); g.until = pen ? Date.now() + pen : 0;
    XS.store.set(GUARD, g);
    return { ok: false, left: Math.max(0, FREE - g.fails), wait: pen };
  }
  function clear(){ XS.store.remove(KEY); XS.store.remove(GUARD); XS.emit('passcode'); }

  const secs = ms => Math.ceil(ms / 1000);
  const waitText = ms => { const s = secs(ms); return s >= 60 ? `请在 ${Math.ceil(s / 60)} 分钟后重试` : `请在 ${s} 秒后重试`; };
  // 验证失败时给用户看的一句话
  const failText = r => r.error ? r.error : r.wait ? `密码错误，${waitText(r.wait)}` : r.left > 0 && r.left <= 3 ? `密码错误，还可再试 ${r.left} 次` : '密码错误';

  /* —— 数字键盘 ——
     pad({ title, len, onDone(code), onCancel }) → { el, focus, reset(title, msg), fail(msg), busy(on), setLen(n), destroy }
     len 是要输几位（4 或 6），输满自动提交
     右下角：没输入时是「取消」，有输入时是「删除」；键盘可用数字键、退格、Esc */
  const LETTERS = ['', '', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
  const reduced = () => document.documentElement.dataset.motion === 'reduce';
  function pad({ title, len = 6, onDone, onCancel }){
    const el = XS.ui.h(`<div class="pc" role="group" aria-label="${XS.esc(title)}" tabindex="-1">
      <div class="pc-head">
        <svg class="pc-glyph" viewBox="0 0 20 22" aria-hidden="true"><path d="M5.5 10V7a4.5 4.5 0 0 1 9 0v3"/><rect x="3" y="10" width="14" height="10.5" rx="3"/></svg>
        <p class="pc-title"></p>
        <div class="pc-dots" aria-hidden="true"></div>
        <p class="pc-msg" role="status" aria-live="polite"></p>
      </div>
      <div class="pc-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n =>
        `<button class="pc-key" data-k="${n}" aria-label="${n}"><span>${n}</span>${LETTERS[n] ? `<small aria-hidden="true">${LETTERS[n]}</small>` : ''}</button>`).join('')}
        <span></span><button class="pc-key" data-k="0" aria-label="0"><span>0</span></button>
        <button class="pc-act" data-k="act">取消</button></div></div>`);
    const $ = s => el.querySelector(s);
    const dotsEl = $('.pc-dots'), act = $('[data-k="act"]'), msgEl = $('.pc-msg');
    let buf = '', busy = false, coolT = 0, dots = [];
    const makeDots = () => { dotsEl.innerHTML = '<i></i>'.repeat(len); dots = [...dotsEl.children]; };
    makeDots();

    const paint = () => {
      dots.forEach((d, i) => d.classList.toggle('on', i < buf.length));
      act.textContent = buf ? '删除' : '取消';
      act.setAttribute('aria-label', buf ? '删除一位' : '取消');
      dotsEl.setAttribute('data-n', buf.length);
    };
    const setBusy = on => { busy = on; el.classList.toggle('is-busy', on); };
    const say = (text, err) => { msgEl.textContent = text || ''; msgEl.classList.toggle('err', !!err); };
    // 冷却中：键盘变灰，每秒刷新剩余时间
    const cool = () => {
      clearTimeout(coolT);
      const w = waitMs();
      el.classList.toggle('is-cool', !!w);
      if (!w || !rec()) { if (el.classList.contains('was-cool')) { el.classList.remove('was-cool'); say(''); } return; }
      el.classList.add('was-cool'); say(waitText(w), true);
      coolT = setTimeout(cool, 1000);
    };
    const press = k => {
      if (busy) return;
      if (k === 'act') { if (buf) { buf = buf.slice(0, -1); paint(); } else onCancel && onCancel(); return; }
      if (el.classList.contains('is-cool') || buf.length >= len) return;
      buf += k; paint();
      if (buf.length === len) {
        const code = buf;
        setBusy(true);
        // 让最后一个圆点先亮一下再验证
        setTimeout(async () => { try { await onDone(code); } finally { setBusy(false); } }, 90);
      }
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
    const onKey = e => {
      if (!el.isConnected || el.closest('[inert]') || e.target.closest && e.target.closest('input,textarea')) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); if (buf) press('act'); }
      else if (e.key === 'Escape') { e.preventDefault(); onCancel && onCancel(); }
    };
    document.addEventListener('keydown', onKey);

    const api = {
      el,
      focus: () => el.focus({ preventScroll: true }),
      reset(t, m){ buf = ''; paint(); if (t) $('.pc-title').textContent = t; say(m || ''); cool(); },
      fail(m){
        buf = ''; paint(); say(m, true);
        if (!reduced()) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
        if (navigator.vibrate) try { navigator.vibrate(60); } catch (_) {}
        cool();
      },
      busy: setBusy,
      setLen(n){ if (!LENS.includes(n)) return; len = n; buf = ''; makeDots(); paint(); },
      destroy(){ clearTimeout(coolT); document.removeEventListener('keydown', onKey); buf = ''; }
    };
    el.addEventListener('animationend', () => el.classList.remove('shake'));
    api.reset(title);
    return api;
  }

  XS.passcode = {
    LENS, FREE,
    supported: () => cryptoOk && XS.store.persistent,
    enabled: () => !!rec(),
    length,
    set, verify, clear, pad, failText, waitMs
  };
})();
