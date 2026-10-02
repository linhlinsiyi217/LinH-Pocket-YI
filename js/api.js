/* AI 接口（OpenAI 兼容格式：地址 + /chat/completions）
   只会把请求发到用户自己在「设置 > API 连接」里填的地址。
   出错时抛出 ApiError，由界面显示成「发送失败」，绝不当作角色说的话。 */
(function(){
  class ApiError extends Error {
    constructor(kind, message){ super(message); this.kind = kind; }
  }
  const endpoint = base => {
    let u = String(base || '').trim().replace(/\/+$/, '');
    if (!/\/chat\/completions$/.test(u)) u += '/chat/completions';
    return u;
  };

  async function chat(messages, { signal, maxTokens } = {}){
    const s = XS.settings.all();
    if (s.flightMode) throw new ApiError('flight', '飞行模式已开启，AI 请求已暂停');
    const { baseUrl, apiKey, model } = s.api;
    if (!baseUrl || !model) throw new ApiError('config', '还没有配置 API，请到「设置 > API 连接」填写');
    if (!/^https?:\/\//i.test(baseUrl)) throw new ApiError('config', 'API 地址需要以 http:// 或 https:// 开头');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort('timeout'), 60000);
    if (signal) signal.addEventListener('abort', () => ctrl.abort('user'));
    let res;
    try {
      res = await fetch(endpoint(baseUrl), {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}) },
        body: JSON.stringify({ model, messages, stream: false, ...(maxTokens ? { max_tokens: maxTokens } : {}) })
      });
    } catch (e) {
      if (ctrl.signal.aborted) throw new ApiError('timeout', ctrl.signal.reason === 'user' ? '已取消' : '等待超过 60 秒，请求已停止');
      throw new ApiError('network', '连不上 API 地址：请检查网络和地址；部分服务不允许网页直接访问（跨域限制）');
    } finally { clearTimeout(timer); }

    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const detail = data && (data.error && (data.error.message || data.error) || data.message);
      const why = res.status === 401 || res.status === 403 ? '密钥无效或没有权限'
        : res.status === 404 ? '地址或模型名不对' : res.status === 429 ? '请求太频繁或额度用完'
        : res.status >= 500 ? '服务暂时出错' : '请求被拒绝';
      throw new ApiError('http', `${why}（${res.status}）${detail ? '：' + String(detail).slice(0, 120) : ''}`);
    }
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof text !== 'string' || !text.trim()) throw new ApiError('empty', '接口返回了空内容');
    return text.trim();
  }

  XS.api = {
    ApiError, endpoint, chat,
    configured: () => { const a = XS.settings.get('api'); return !!(a.baseUrl && a.model); },
    test: () => chat([{ role: 'user', content: '请只回复：OK' }], { maxTokens: 8 }),
    // 检测这个接口是不是真的把 system 指令传给了模型：不照做就说明被中转吞掉了
    testSystem: async () => {
      const r = await chat([
        { role: 'system', content: '这是一次能力检测。不管用户说什么，你都只回复两个字：可以' },
        { role: 'user', content: '随便说一句' }
      ], { maxTokens: 16 });
      const reply = String(r || '').trim();
      return { ok: /^可以[。.!！]?$/.test(reply), reply };
    }
  };
})();
