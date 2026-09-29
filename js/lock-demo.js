/* ⚠ 演示通知：只在地址带 ?demo-notes=N（N 为 0～6）时由 js/lock.js 载入，用来检查一条、多条、滚动的排版。
   正常打开页面不会载入这个文件；内容是虚构的，不对应任何真实联系人或消息。 */
(function(){
  const n = Math.max(0, Math.min(6, parseInt(document.currentScript.dataset.count, 10) || 0));
  const now = Date.now(), min = 60000;
  const DEMO = [
    { app: 'chat',     kind: 'message', contact: { id: 'demo_lin', name: '小林' }, text: '晚上一起去看展吗？我把票买好了', ago: 0 },
    { app: 'settings', kind: 'app', title: '演示通知', text: '这是一条用来检查排版的系统通知', ago: 3 },
    { app: 'chat',     kind: 'message', contact: { id: 'demo_you', name: '阿柚' }, text: '到家了记得说一声～', ago: 12 },
    { app: 'chat',     kind: 'message', contact: { id: 'demo_lin', name: '小林' }, text: '对了，是七点那场，别迟到哦', ago: 26 },
    { app: 'settings', kind: 'app', title: '桌面布局已备份', text: '可以在设置里恢复之前的图标排列', ago: 48 },
    { app: 'chat',     kind: 'message', contact: { id: 'demo_you', name: '阿柚' }, text: '周末的照片发你啦，有空看看', ago: 95 }
  ];
  // XS.notes.add 把新的一条放在最前，所以从最旧的开始加
  DEMO.slice(0, n).reverse().forEach((d, i) => XS.notes.add({ id: 'demo' + i, app: d.app, kind: d.kind, contact: d.contact, title: d.title, text: d.text, at: now - d.ago * min }));
})();
