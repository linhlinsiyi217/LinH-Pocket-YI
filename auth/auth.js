/* LinH Pocket YI · 登录 / 注册 / 设置密码 / 无权限（Supabase Auth）
   流程：注册页填邮箱 + QQ + 邀请码 → 服务端预检邀请码 → 发验证邮件
        → 邮件链接打开设置密码页 → 服务端原子核销邀请码并写入 users（开通白名单）→ 设置密码 → 进入小手机
   防二传：邀请码只在服务端函数 redeem_invite 里核销（见 supabase-setup.sql），
        一次 UPDATE ... WHERE is_used = false 抢占，同一个码只可能成功一次，并绑定到这个账号和 QQ 号。
        前端的所有检查只是提示用，不能当作安全边界。 */
const SUPABASE_URL = 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'

;(function () {
  const HOME = '../index.html'            // 登录成功后进入的小手机主页
  const PENDING_KEY = 'xs.auth.pending'   // 注册时填的 QQ 号和邀请码，等邮件验证后再核销

  const $ = s => document.querySelector(s)
  const configured = !/^YOUR_/.test(SUPABASE_URL) && !/^YOUR_/.test(SUPABASE_ANON_KEY)
  const sb = configured && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        // implicit：邮件链接在别的浏览器里打开也能直接登录（PKCE 要求同一浏览器）
        auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true }
      })
    : null

  /* —— 校验 —— */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const checkEmail = v => !v ? '请填写邮箱地址' : EMAIL_RE.test(v) ? '' : '邮箱格式不正确'
  const checkQQ = v => !v ? '请填写 QQ 号' : /^\d+$/.test(v) ? (/^[1-9]\d{4,10}$/.test(v) ? '' : 'QQ 号一般是 5～11 位数字') : 'QQ 号只能是数字'
  const checkInviteFormat = v => !v ? '请填写邀请码' : /\s/.test(v) ? '邀请码里不能有空格' : ''
  const checkPassword = v => !v ? '请设置密码' : v.length < 6 ? '密码至少 6 位' : ''

  function setError(input, msg) {
    const field = input.closest('.field'), err = field.querySelector('.err')
    field.classList.toggle('is-error', !!msg)
    input.setAttribute('aria-invalid', msg ? 'true' : 'false')
    err.textContent = msg || ''
    return !msg
  }
  // 出错后，用户一改这一栏就把提示去掉
  const clearOnInput = form => form.addEventListener('input', e => { if (e.target.matches('input')) setError(e.target, '') })
  const focusFirstError = form => { const bad = form.querySelector('[aria-invalid="true"]'); bad && bad.focus() }
  function formMsg(form, text, kind) { const m = form.querySelector('.form-msg'); m.textContent = text || ''; m.dataset.kind = kind || '' }
  function busy(btn, on, text) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent
    btn.disabled = on; btn.textContent = on ? text : btn.dataset.label
    btn.setAttribute('aria-busy', on ? 'true' : 'false')
  }
  function needSb(form) {
    if (sb) return true
    formMsg(form, configured ? '网络不太好，登录服务没有加载出来，请刷新重试' : '还没有填写 Supabase 配置（auth.js 顶部）', 'error')
    return false
  }
  function authError(err) {
    const m = String((err && err.message) || '')
    if (/Invalid login credentials/i.test(m)) return '邮箱或密码不正确'
    if (/Email not confirmed/i.test(m)) return '邮箱还没有验证，请先点开验证邮件'
    if (/rate limit|too many|security purposes/i.test(m)) return '操作太频繁了，请稍后再试'
    if (/Failed to fetch|NetworkError|network/i.test(m)) return '网络连接失败，请检查网络后重试'
    if (/should be different/i.test(m)) return '新密码不能和旧密码一样'
    if (/Password should be at least/i.test(m)) return '密码至少 6 位'
    return '出了点问题，请稍后再试'
  }
  // 当前账号是否已开通（只能读到自己那一行，由 RLS 保证）
  async function isWhitelisted(userId) {
    const { data, error } = await sb.from('users').select('is_whitelisted').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return !!(data && data.is_whitelisted)
  }

  /* —— 页面切换：淡出后再跳转；进入页面的淡入写在 CSS 里 —— */
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  function go(url) {
    if (reduced()) { location.href = url; return }
    document.body.classList.add('is-leaving')
    setTimeout(() => { location.href = url }, 240)
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-nav]')
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault(); go(a.getAttribute('href'))
  })
  // 从浏览器返回时页面可能来自缓存，去掉淡出状态
  addEventListener('pageshow', () => document.body.classList.remove('is-leaving'))

  /* —— 登录页 —— */
  function initLogin() {
    const form = $('#login-form'), email = form.email, pw = form.password, btn = form.querySelector('button')
    clearOnInput(form)
    form.addEventListener('submit', async e => {
      e.preventDefault(); formMsg(form)
      const ok = [setError(email, checkEmail(email.value.trim())), setError(pw, pw.value ? '' : '请输入密码')].every(Boolean)
      if (!ok) { focusFirstError(form); return }
      if (!needSb(form)) return
      busy(btn, true, '正在登录…')
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value })
        if (error) throw error
        go(await isWhitelisted(data.user.id) ? HOME : 'denied.html')
      } catch (err) {
        formMsg(form, authError(err), 'error'); busy(btn, false)
      }
    })
  }

  /* —— 注册页 —— */
  function initRegister() {
    const form = $('#register-form'), email = form.email, qq = form.qq, invite = form.invite, btn = form.querySelector('button')
    clearOnInput(form)
    form.addEventListener('submit', async e => {
      e.preventDefault(); formMsg(form)
      const v = { email: email.value.trim().toLowerCase(), qq: qq.value.trim(), invite: invite.value.trim() }
      const ok = [setError(email, checkEmail(v.email)), setError(qq, checkQQ(v.qq)), setError(invite, checkInviteFormat(v.invite))].every(Boolean)
      if (!ok) { focusFirstError(form); return }
      if (!needSb(form)) return
      busy(btn, true, '正在核对邀请码…')
      try {
        // 预检：邀请码不存在或已被用过就直接拦下，不发邮件（真正的核销在设置密码时由服务端完成）
        const { data: valid, error: rpcErr } = await sb.rpc('check_invite', { p_code: v.invite })
        if (rpcErr) throw rpcErr
        if (!valid) { busy(btn, false); setError(invite, '邀请码无效或已被使用'); invite.focus(); return }

        busy(btn, true, '正在发送验证邮件…')
        const redirect = new URL('set_password.html', location.href).href   // 需要加进 Supabase 的 Redirect URLs
        const { error } = await sb.auth.signInWithOtp({
          email: v.email,
          options: { emailRedirectTo: redirect, shouldCreateUser: true, data: { qq_number: v.qq, invite_code: v.invite } }
        })
        if (error) throw error
        // 同一浏览器打开邮件时优先用这份（比账号元数据新）；换浏览器时用元数据
        try { localStorage.setItem(PENDING_KEY, JSON.stringify(v)) } catch (_) {}
        $('#sent-email').textContent = v.email
        $('#register-view').hidden = true; $('#sent-view').hidden = false
        $('#sent-view h1').focus()
      } catch (err) {
        formMsg(form, authError(err), 'error'); busy(btn, false)
      }
    })
  }

  /* —— 设置密码页：必须是从验证邮件打开（URL 里带登录凭证） —— */
  async function initSetPassword() {
    const form = $('#password-form'), pw = form.password, pw2 = form.password2, btn = form.querySelector('button')
    const expired = () => { $('#password-view').hidden = true; $('#expired-view').hidden = false; $('#expired-view h1').focus() }
    clearOnInput(form)
    if (!needSb(form)) return
    const { data: { session } } = await sb.auth.getSession()
    if (location.hash) history.replaceState(null, '', location.pathname + location.search)   // 凭证不要留在地址栏
    if (!session) { expired(); return }
    btn.disabled = false

    form.addEventListener('submit', async e => {
      e.preventDefault(); formMsg(form)
      const ok = [setError(pw, checkPassword(pw.value)),
        setError(pw2, !pw2.value ? '请再输一次密码' : pw2.value !== pw.value ? '两次输入的密码不一致' : '')].every(Boolean)
      if (!ok) { focusFirstError(form); return }

      let pending = null
      try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') } catch (_) {}
      const meta = session.user.user_metadata || {}
      const sameEmail = pending && pending.email === String(session.user.email || '').toLowerCase()
      const qq = sameEmail ? pending.qq : meta.qq_number
      const code = sameEmail ? pending.invite : meta.invite_code

      busy(btn, true, '正在开通…')
      try {
        // 先核销邀请码、开通账号，成功后才设置密码；邀请码已被别人用掉时不会得到可登录的密码
        const { data: result, error: rpcErr } = await sb.rpc('redeem_invite', { p_code: code || '', p_qq: qq || '' })
        if (rpcErr) throw rpcErr
        const MSG = {
          invalid_code: '邀请码无效或已被使用，请用新的邀请码重新注册',
          qq_taken: '这个 QQ 号已经绑定了别的账号',
          bad_qq: 'QQ 号格式不正确，请重新注册',
          not_confirmed: '邮箱还没有验证，请从验证邮件打开这个页面'
        }
        if (result !== 'ok' && result !== 'already_registered') { formMsg(form, MSG[result] || '开通失败，请稍后再试', 'error'); busy(btn, false); return }

        busy(btn, true, '正在保存密码…')
        const { error } = await sb.auth.updateUser({ password: pw.value })
        if (error) throw error
        try { localStorage.removeItem(PENDING_KEY) } catch (_) {}
        go(await isWhitelisted(session.user.id) ? HOME : 'denied.html')
      } catch (err) {
        formMsg(form, authError(err), 'error'); busy(btn, false)
      }
    })
  }

  /* —— 无权限页 —— */
  function initDenied() {
    $('[data-action="switch"]').addEventListener('click', async () => {
      try { sb && await sb.auth.signOut() } catch (_) {}
      go('login.html')
    })
  }

  /* —— 给小手机主页用的门卫（可选）：未登录去登录页，未开通去无权限页
     只是体验上的跳转；真正的数据保护要靠 Supabase 的 RLS —— */
  window.XSAuth = {
    client: sb,
    async requireAccess(base = 'auth/') {
      if (!sb) return false
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { location.replace(base + 'login.html'); return false }
      if (!(await isWhitelisted(session.user.id))) { location.replace(base + 'denied.html'); return false }
      return true
    },
    signOut: () => sb && sb.auth.signOut()
  }

  const page = document.body.dataset.page
  if (page === 'login') initLogin()
  else if (page === 'register') initRegister()
  else if (page === 'set-password') initSetPassword()
  else if (page === 'denied') initDenied()
})()
