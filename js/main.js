/* 启动 */
(function(){
  XS.theme.apply();
  XS.theme.frame();
  XS.ui.startStatusbar();
  XS.ui.bindPress(document.querySelector('.screen'));
  XS.nav.bindHomeBar(document.querySelector('.home-bar'));
  // 刷新页面后回到桌面，清掉旧的历史状态
  if (history.state && history.state.xs) history.replaceState(null, '');
  XS.renderHome();
  if (!XS.store.persistent) XS.ui.toast('当前浏览器不允许本地保存，关闭后数据会丢失', 4000);
  XS.on('storage:error', () => XS.ui.toast('保存失败：本地空间可能已满'));
})();
