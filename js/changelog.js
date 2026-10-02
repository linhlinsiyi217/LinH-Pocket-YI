/* 更新通知 + 更新日志（弹窗和设置页共用下面的 LOGS）
   版本号格式：v0.中间数字.最后数字（三段）。
   发布规则：
   - 含至少一项【新增】：中间数字 +1，最后数字归 0（如 v0.1.3 → v0.2.0）。
   - 只有【调整】【修复】【补丁】：最后数字 +1（如 v0.1.0 → v0.1.1）。
   - 第一位保持 0，不自行升到 v1.0.0。
   - 一次发布只升一次版本号、只弹一份通知。
   每条内容只写已真实完成并上线的事；没有内容的分类留空数组，不硬凑。
   没有确定的上线日期就不写日期（date 留空），不编造。
   维护方式：发布前改 VERSION，并在 LOGS 顶部加对应版本条目（新的在上）。 */
(function(){
  const esc = XS.esc;
  const $ = (s, r) => (r || document).querySelector(s);

  const VERSION = 'v0.4.0';

  const LOGS = {
    'v0.4.0': {
      date: '2026-10-02',
      note: '小组件更完整，启动画面更简洁',
      added: [
        { t: '更多组件', d: '主屏幕小组件新增极简时钟、天气、日历、电量、照片墙几种预设；照片会自动轮播、音乐封面缓慢旋转、日历高亮今天。数据走统一数据源，时间日期是真实的，天气、音乐、电量先用示例数据，之后可换成真实接口。' },
        { t: '按压反馈', d: '轻点小组件有按下去再回弹的反馈，长按进入编辑、拖动调整，动画只在需要时出现；开启减少动态后会直接显示最终画面。' }
      ],
      adjusted: [
        { t: '启动画面', d: '开机画面改成纯黑白灰、只显示「LinH Pocket YI」项目名，去掉了彩色图标和副标题，画面更干净。' },
        { t: '应用图标', d: '桌面应用图标统一成细线圆角笔画，去掉了之前偏粗的黑线，和聊天、设置、Char 馆保持一套。' }
      ],
      fixed: [],
      patched: []
    },
    'v0.3.0': {
      date: '2026-10-01',
      note: '小组件能自己改，应用能移除和放回',
      added: [
        { t: '定制组件', d: '长按主屏幕进入编辑状态后，轻点小组件就能打开编辑面板：换成小、中、大三种尺寸，改两行显示的文字，上传或更换一张背景图，还能写只作用于这个小组件的 CSS。面板上方实时预览，点“保存”才生效，“恢复默认”一键还原；刷新页面后改动仍在。' },
        { t: '移除应用', d: '主屏幕长按应用图标，点击 × 可以从主屏幕和 Dock 移除，移除后不会自动再次出现；在「设置 › 主屏幕与 App 资源库」里随时可以放回桌面第一个空位。' }
      ],
      adjusted: [
        { t: '空 Dock', d: 'Dock 里的应用全部拖走后，底部的空玻璃条会自动隐藏；长按进入编辑状态时它会重新出现，方便把应用拖回去。' }
      ],
      fixed: [
        { t: '消息重复', d: '和角色聊天时，你刚发的那句话之前会被重复发给 AI 两遍，现在只发一次，回复更贴合前面的对话。' }
      ],
      patched: []
    },
    'v0.2.0': {
      date: '2026-09-30',
      note: '应用图标补齐，聊天更自然',
      added: [
        { t: '应用图标', d: '主屏幕新增 16 个应用图标：相册、相机、音乐、备忘录、日历、天气、地图、浏览器、文件、钱包、短信、电话、书房、微信、朋友圈，统一黑白灰线条风格，暂未开放具体功能。' },
        { t: '聊天活人感', d: '聊天对话加入三层提示词结构（稳定身份、说话风格、时间感知），对话中断超过 12 小时会自然提及时间流逝；允许一两个字的短回复，不再要求 AI 每次都说长句。' }
      ],
      adjusted: [],
      fixed: [],
      patched: []
    },
    'v0.1.0': {
      date: '2026-09-30',
      note: '从这里开始',
      added: [
        { t: '锁屏密码', d: '在 设置 › 密码与安全 可以开启 4 位或 6 位数字密码，解锁进入桌面前要先输入。只锁这台设备上的界面，密码不以明文保存；连续输错多次要等一会儿再试。' },
        { t: '后台保活', d: '在 设置 › 密码与安全 可以开关。开启后播放一段听不见的静音音频，切到后台时不那么容易被系统关掉，但不能保证一定不被关。' },
        { t: '保活引导', d: '设置 › 辅助功能 里有电池优化、后台运行、锁定最近任务、关闭省电模式四份步骤说明，照着在手机系统里设好，可以手动标记完成。' },
        { t: '更新通知', d: '有新版本时，解锁进入桌面后会弹出一次本次更新内容；设置 › 更新日志 里可以随时回看。' }
      ],
      adjusted: [
        { t: 'Dock 长度', d: '底部 Dock 按里面的应用个数变长变短，不再横跨整个屏幕；应用全部移走时保留一小段，方便再拖回来。' },
        { t: '登录设备', d: '设置 › 密码与安全 里加了登录设备入口。账号服务还没有接通，这里会直接写明未接通，暂时不能查看或移除设备。' }
      ],
      fixed: [
        { t: '重复状态栏', d: '在手机浏览器里打开时，顶部不再同时出现系统和小手机自己的两排时间、电量。' }
      ],
      patched: []
    }
  };

  const CATS = [
    { key: 'added',    label: '新增', color: '#34C759' },
    { key: 'adjusted', label: '调整', color: '#0A84FF' },
    { key: 'fixed',    label: '修复', color: '#FF3B30' },
    { key: 'patched',  label: '补丁', color: '#BF5AF2' }
  ];
  const catsOf = log => CATS.filter(c => (log[c.key] || []).length);
  // 版本从新到旧
  const num = v => v.replace(/^v/, '').split('.').map(Number);
  const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; };
  const versions = () => Object.keys(LOGS).sort(cmp);

  const CHEV = '<svg class="cl-chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1.2 1.2L6.8 7l-5.6 5.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SPARK = '<svg class="cl-spark" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c.5 3.4 1.6 4.5 5 5-3.4.5-4.5 1.6-5 5-.5-3.4-1.6-4.5-5-5 3.4-.5 4.5-1.6 5-5z" fill="currentColor"/></svg>';
  let uid = 0;

  // 一条可展开的条目：标题行 + 就地展开的说明（弹窗和设置页共用）
  const item = (it, cls) => {
    const id = 'cl-d' + (++uid);
    return `<div class="cl-item ${cls}">
      <button class="cl-row" aria-expanded="false" aria-controls="${id}"><span class="cl-t">${esc(it.t)}</span>${CHEV}</button>
      <div class="cl-more" id="${id}" aria-hidden="true"><div><p class="cl-d">${esc(it.d)}</p></div></div></div>`;
  };
  const tag = c => `<span class="cl-tag" style="color:${c.color}">【${esc(c.label)}】</span>`;
  const verLine = (ver, log) => `<span class="cl-rule"></span><span>${esc(ver)}${log.date ? ' · ' + esc(log.date) : ''}</span><span class="cl-rule"></span>`;

  // 点标题行：原地展开 / 收起，各条互不影响
  const bindToggle = root => root.addEventListener('click', e => {
    const row = e.target.closest('.cl-row'); if (!row || !root.contains(row)) return;
    const box = row.parentElement, on = !box.classList.contains('open');
    box.classList.toggle('open', on);
    row.setAttribute('aria-expanded', String(on));
    box.querySelector('.cl-more').setAttribute('aria-hidden', String(!on));
  });

  /* —— 弹窗 —— */
  function showDialog(ver){
    const log = LOGS[ver]; if (!log) return;
    const overlay = $('.layer-overlay'); if (!overlay) return;
    const cats = catsOf(log); if (!cats.length) return;
    if ($('.cl-pop', overlay)) return;

    const panel = document.createElement('div');
    panel.className = 'cl-pop';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'cl-pop-title');
    panel.tabIndex = -1;
    panel.innerHTML = `
      <div class="cl-head">
        ${SPARK}
        <h2 class="cl-title" id="cl-pop-title">更新通知</h2>
        <div class="cl-ver">${verLine(ver, log)}</div>
        ${log.note ? `<p class="cl-lead">${esc(log.note)}</p>` : ''}
      </div>
      <div class="cl-body">
        ${cats.map(c => `<section class="cl-sec">${tag(c)}<div class="cl-list">${log[c.key].map(it => item(it, 'flat')).join('')}</div></section>`).join('')}
        <div class="cl-sign"><span>LinH Pocket YI</span><span>@LinH仪</span></div>
      </div>
      <div class="cl-foot"><button class="cl-ok" disabled>我知道了 · 3</button></div>`;

    const scrim = document.createElement('div');
    scrim.className = 'scrim cl-scrim';
    overlay.append(scrim, panel);
    // 弹窗打开时，桌面和应用层不接收焦点
    const behind = ['.layer-home', '.layer-apps'].map(s => $(s)).filter(Boolean);
    behind.forEach(n => { n.inert = true; });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrim.classList.add('show'); panel.classList.add('show');
      panel.focus({ preventScroll: true });
    }));
    bindToggle(panel);

    // 3 秒后才能关闭
    let left = 3;
    const ok = $('.cl-ok', panel);
    const timer = setInterval(() => {
      left--;
      if (left > 0) ok.textContent = `我知道了 · ${left}`;
      else { clearInterval(timer); ok.disabled = false; ok.textContent = '我知道了'; }
    }, 1000);

    ok.addEventListener('click', () => {
      if (ok.disabled) return;
      clearInterval(timer);
      XS.store.set('readVer', ver);
      scrim.classList.remove('show'); panel.classList.remove('show');
      behind.forEach(n => { n.inert = false; });
      setTimeout(() => { scrim.remove(); panel.remove(); }, 360);
    });
  }

  /* —— 解锁后：同一版本只弹一次（main.js 在 XS.lock.whenOpen 里调用） —— */
  function maybeShow(){
    if (XS.store.get('readVer', '') === VERSION) return;
    setTimeout(() => {
      // 等待期间又锁上了，就等下次解锁再弹
      if (XS.lock && XS.lock.state !== 'open') return XS.lock.whenOpen(maybeShow);
      showDialog(VERSION);
    }, 700);
  }

  /* —— 设置 › 更新日志：版本小标题 + 间隔小卡片，详情在卡片内展开 —— */
  function settingsPage(){
    const p = XS.nav.page({ title: '更新日志', grouped: true, back: true, cls: 'set-page cl-log' });
    p.body.innerHTML = versions().map(ver => {
      const log = LOGS[ver], cats = catsOf(log);
      if (!cats.length) return '';
      return `<section class="cl-v">
        <h3 class="cl-v-head"><span class="cl-v-num">${esc(ver)}</span>${ver === VERSION ? '<span class="cl-v-now">当前版本</span>' : ''}</h3>
        ${log.date || log.note ? `<p class="cl-v-sub">${[log.date, log.note].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
        <div class="cl-cards">${cats.map(c => log[c.key].map(it => item(it, 'card').replace('<span class="cl-t">', tag(c) + '<span class="cl-t">')).join('')).join('')}</div>
      </section>`;
    }).join('') + '<div class="cl-sign"><span>LinH Pocket YI</span><span>@LinH仪</span></div>';
    bindToggle(p.body);
    return p.view;
  }

  XS.changelog = { VERSION, LOGS, maybeShow, showDialog, settingsPage };
})();
