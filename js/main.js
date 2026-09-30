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
  // 先播启动画面、进锁屏；解锁进入桌面后才出提示，不遮住启动和锁屏
  XS.lock.start();
  if (!XS.store.persistent) XS.lock.whenOpen(() => XS.ui.toast('当前浏览器不允许本地保存，关闭后数据会丢失', 4000));
  // 更新通知等解锁进入主屏后再弹，不遮锁屏
  XS.lock.whenOpen(() => XS.changelog.maybeShow());
  XS.on('storage:error', () => XS.ui.toast('保存失败：本地空间可能已满'));
})();
