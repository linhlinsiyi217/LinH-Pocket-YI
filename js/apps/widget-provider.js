/* 小组件统一数据源（WidgetProvider）
   组件只读 provider 返回的数据，不关心数据来自真实系统/API 还是 Mock；
   以后把 Mock 换成真实 API，只改这个文件，组件 UI 与布局不用动。 */
(function(){
  const pad = n => String(n).padStart(2, '0');
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const md = d => `${d.getMonth() + 1}月${d.getDate()}日`;
  const hm = d => d.getHours() + ':' + pad(d.getMinutes());
  const greet = h => h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';

  /* —— 真实系统时间 / 日历 —— */
  const time = {
    id: 'time', mock: false,
    get(){
      const n = new Date();
      return { t: hm(n), w: '星期' + WEEK[n.getDay()], md: md(n), day: String(n.getDate()),
        ym: `${n.getFullYear()}年${n.getMonth() + 1}月`, wd: `${md(n)} 星期${WEEK[n.getDay()]}`, g: greet(n.getHours()) };
    }
  };

  // 日历：给出本月网格（每周 7 格，空位是 null），组件按今天的日期高亮
  const date = {
    id: 'date', mock: false,
    get(){
      const n = new Date();
      const y = n.getFullYear(), m = n.getMonth();
      const first = new Date(y, m, 1).getDay();          // 本月 1 号是星期几
      const days = new Date(y, m + 1, 0).getDate();       // 本月天数
      const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
      const weeks = [];
      for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
      return { month: `${m + 1}月`, year: y, today: n.getDate(), weeks,
        weekday: '星期' + WEEK[n.getDay()], md: md(n) };
    }
  };

  /* —— Mock 数据源（后续替换成真实 API / 系统数据，只改这里） —— */
  // 天气：字段对齐真实接口（温度 / 天气 / 高低 / 地点 / 代码），组件只读这些字段
  const weather = {
    id: 'weather', mock: true,
    get(){ return { temp: 21, code: 'cloudy', cond: '多云', high: 25, low: 17, loc: '深圳' }; }
  };
  // 音乐播放状态：Mock（后续接真实播放器）；歌曲封面/曲名/歌手仍是用户自己填的配置
  const music = {
    id: 'music', mock: true,
    get(){ return { progress: .34, current: '1:24', duration: '4:06' }; }
  };
  // 电量：后续可换成 navigator.getBattery()，结构不变
  const battery = {
    id: 'battery', mock: true,
    get(){ return { level: 78, charging: false }; }
  };

  XS.widgetProviders = { time, date, weather, music, battery };
  // 统一读取入口：XS.provider.get('weather') —— 组件不直接拿 Mock，也不写死数据
  XS.provider = {
    get(id){ const p = XS.widgetProviders[id]; return p ? p.get() : null; },
    isMock(id){ const p = XS.widgetProviders[id]; return !!(p && p.mock); }
  };
})();
