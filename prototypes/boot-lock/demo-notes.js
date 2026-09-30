/* ⚠ 演示数据：只给锁屏原型看排版用，没有接入任何真实应用。
   正式接入时，锁屏从项目统一的通知状态读取（尚未实现，这里先约定形状），不在锁屏里写死内容：
   {
     id,                  // 唯一 ID
     app,                 // 来源应用 id，对应 XS.apps（home.js）里的登记
     kind,                // 'message' = 聊天消息（显示联系人）；'app' = 其他应用通知（显示应用图标和名字）
     contact: { id, name },   // kind 为 message 时：联系人（头像用名字首字，和聊天里一致）
     title,               // kind 为 app 时：通知标题（可空）
     text,                // 消息预览 / 通知内容
     at                   // 时间戳
   }
   这里的 minutesAgo 只是为了演示“现在 / 几分钟前”，正式数据用 at。 */
window.DEMO_APPS = {
  // 与正式项目 XS.apps 的名字、图标、底色保持一致
  chat:     { name: '聊天', icon: 'chat',     variant: 'ai-dark' },
  settings: { name: '设置', icon: 'settings', variant: 'ai-gray' }
};
window.DEMO_NOTES = [
  { id: 'd1', app: 'chat',     kind: 'message', contact: { id: 'c_lin', name: '小林' }, text: '晚上一起去看展吗？我把票买好了', minutesAgo: 0 },
  { id: 'd2', app: 'settings', kind: 'app', title: '已更新到 v0.1.0', text: '轻点查看本次更新内容', minutesAgo: 3 },
  { id: 'd3', app: 'chat',     kind: 'message', contact: { id: 'c_you', name: '阿柚' }, text: '到家了记得说一声～', minutesAgo: 12 },
  { id: 'd4', app: 'chat',     kind: 'message', contact: { id: 'c_lin', name: '小林' }, text: '对了，是七点那场，别迟到哦', minutesAgo: 26 },
  { id: 'd5', app: 'settings', kind: 'app', title: '桌面布局已备份', text: '可以在设置里恢复之前的图标排列', minutesAgo: 48 },
  { id: 'd6', app: 'chat',     kind: 'message', contact: { id: 'c_you', name: '阿柚' }, text: '周末的照片发你啦，有空看看', minutesAgo: 95 }
];
