/* 后台保活：循环播放一段静音音频，让浏览器把小手机页面当作「正在播放媒体」，降低后台被清理的概率
   独立的 <audio> 元素，和聊天语音（XS 内其它播放逻辑）完全分离，互不占通道
   开关存在 XS.settings 的 keepAlive，设置页通过 window.toggleKeepAlive() 控制 */
(function(){
  // 同站的 10 秒静音 WAV（8kHz 8 位单声道，约 80KB），循环播放；仓库是私有的，不能走 jsDelivr
  const KEEPALIVE_AUDIO_URL = 'audio/silence.wav';

  let audio = null, enabled = false, intentionalPause = false;

  function ensure(){
    if (audio) return audio;
    audio = document.createElement('audio');
    audio.src = KEEPALIVE_AUDIO_URL;
    audio.autoplay = true;
    audio.loop = true;
    audio.preload = 'auto';
    audio.setAttribute('aria-hidden', 'true');
    audio.style.display = 'none';
    document.body.append(audio);
    // 意外暂停（非主动关闭）时自动恢复
    audio.addEventListener('pause', () => {
      if (enabled && !intentionalPause) play();
    });
    return audio;
  }

  function play(){
    const a = ensure();
    intentionalPause = false;
    const p = a.play();
    if (p && p.catch) p.catch(() => { /* 浏览器要求先有一次用户交互，等下一次点击时再试 */ });
  }

  function stop(){
    if (!audio) return;
    intentionalPause = true;
    audio.pause();
  }

  /* 供设置页开关调用 */
  window.toggleKeepAlive = function(on){
    enabled = !!on;
    XS.settings.set('keepAlive', enabled);
    enabled ? play() : stop();
  };

  /* 页面重新可见时，若应播而停了，恢复播放 */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && enabled && audio && audio.paused) play();
  });

  /* 首次用户交互时补一次 play（自动播放策略要求） */
  const kick = () => { if (enabled) play(); };
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
    document.addEventListener(ev, kick, { passive: true }));

  /* 初始化：默认开启 */
  enabled = XS.settings.get('keepAlive') !== false;
  ensure();
  if (enabled) play();
})();
