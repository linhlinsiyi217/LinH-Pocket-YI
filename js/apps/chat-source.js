/* 聊天界面源码：两份可复制、可编辑、可恢复的聊天页 CSS 模板
   作用域只到对话页 .conv，和「高级 CSS」分开、不会互相覆盖。
   用户可以复制给 AI 改，再粘回来预览、保存；出错自动回退，另有 ?safe=1 兜底。 */
(function(){
  const NL = '\n';

  const TPL_AVATAR = [
    '/* 聊天界面 · 带头像版',
    '   可用选择器（都稳定，不看临时 DOM 层级）：',
    '   .conv                              整个对话页',
    '   .msg[data-side="other"|"self"]     对方 / 自己的消息行',
    '   .msg[data-first="true"]            同一发送者连续消息的第一条（其余为 false）',
    '   .msg[data-last="true"]             一组里的最后一条',
    '   .avatar / .av-space                头像 / 头像占位（占位保住气泡不左右跳）',
    '   .bubble                            气泡',
    '   .q-quote                           引用摘录',
    '   .msg-time / .msg-notice            时间条 / 系统提示',
    '   .composer / .conv .navbar          底部输入栏 / 顶栏',
    '   改完点「保存」才写入；出错会自动回退，不会锁住页面。 */',
    '',
    '.msg { gap: 8px; }',
    '.msg[data-first="true"] { margin-top: 9px; }',
    '.avatar { --av-size: 32px; }',
    '.bubble {',
    '  max-width: 72%;',
    '  padding: 8px 12px;',
    '  border-radius: 18px;',
    '  line-height: 1.42;',
    '}',
    '.msg[data-side="other"] .bubble {',
    '  background: #ffffff;',
    '  box-shadow: inset 0 0 0 .5px rgba(0, 0, 0, .1), 0 1px 2px rgba(0, 0, 0, .03);',
    '}',
    '.msg[data-side="self"] .bubble { background: #f0f0f2; }',
    '.q-quote { color: #8a8a8e; border-left: 2px solid #c7c7cc; }'
  ].join(NL);

  const TPL_PLAIN = [
    '/* 聊天界面 · 无头像版（仿短信）',
    '   和带头像版只有两点不同：不显示头像、气泡可用宽度更大。',
    '   选择器和带头像版完全一样，见那一份的注释。 */',
    '',
    '.msg { gap: 0; }',
    '.msg .avatar, .msg .av-space { display: none; }',
    '.msg[data-first="true"] { margin-top: 9px; }',
    '.bubble {',
    '  max-width: 82%;',
    '  padding: 8px 12px;',
    '  border-radius: 16px;',
    '  line-height: 1.42;',
    '}',
    '.msg[data-side="other"] .bubble {',
    '  background: #ffffff;',
    '  box-shadow: inset 0 0 0 .5px rgba(0, 0, 0, .1);',
    '}',
    '.msg[data-side="self"] .bubble { background: #f0f0f2; }'
  ].join(NL);

  const TPL = { avatar: TPL_AVATAR, plain: TPL_PLAIN };

  XS.appearancePages.chatSource = () => {
    const U = XS.appearancePages.ui, A = U.A, esc = U.esc;
    const p = U.page('聊天界面源码', 'ap-src');
    let mode = A.get('css.srcMode') || 'avatar';

    const ta = () => p.body.querySelector('.ap-src-text');
    const say = (text, bad) => {
      const el = p.body.querySelector('[data-msg]');
      if (el){ el.textContent = text; el.classList.toggle('bad', !!bad); }
    };
    let refresh = () => {};

    const render = () => {
      const saved = A.get('css.srcCode') || '';
      const shown = saved.trim() ? saved : TPL[mode];
      p.body.innerHTML = ''
        + '<div class="group-block"><div class="group">' + U.swRow('启用自定义聊天源码', 'css.srcOn') + '</div>'
        + '<div class="group-foot">只作用于聊天的对话页，不碰设置、桌面和其他应用，'
        + '和「高级 CSS」是两套作用域、不会互相覆盖。关掉这里只停用这一份。'
        + '万一样式写坏进不去，网址后面加 <code>?safe=1</code> 打开即可全部停用。</div></div>'
        + '<div class="group-block"><div class="group-label">用哪一份</div><div class="group">'
        + U.segRow('模板', '__srcmode', [['avatar', '带头像'], ['plain', '无头像']])
        + '</div><div class="group-foot">切换只换编辑框里的模板，不影响已保存的内容，除非你点「保存」。</div></div>'
        + '<div class="group-block"><div class="group-label">源码</div>'
        + '<div class="ap-css-box"><textarea class="ap-css-text ap-src-text" rows="14" spellcheck="false" '
        + 'aria-label="聊天界面源码">' + esc(shown) + '</textarea>'
        + '<p class="ap-css-msg" data-msg></p>'
        + '<div class="ap-css-acts">'
        + '<button class="btn btn-sm btn-plain tap" data-src="copy">复制源码</button>'
        + '<button class="btn btn-sm btn-plain tap" data-src="import">粘贴导入</button>'
        + '<button class="btn btn-sm btn-plain tap" data-src="preview">预览</button>'
        + '<button class="btn btn-sm btn-primary tap" data-src="save">保存</button>'
        + '<button class="btn btn-sm btn-plain tap" data-src="reset">恢复模板</button>'
        + '<button class="btn btn-sm btn-plain tap" data-src="off">关闭自定义</button>'
        + '</div></div></div>';
      // 模板分段：不走 A.set（__srcmode 不是配置项），只切本地状态
      const bar = p.body.querySelector('[data-segrow="__srcmode"] .segmented');
      const segs = [...bar.querySelectorAll('.seg')];
      segs.forEach(b => {
        b.setAttribute('aria-checked', String(b.dataset.v === mode));
        b.addEventListener('click', () => {
          if (b.dataset.v === mode) return;
          mode = b.dataset.v;
          segs.forEach(x => x.setAttribute('aria-checked', String(x === b)));
          if (!(A.get('css.srcCode') || '').trim()) ta().value = TPL[mode];
          A.set('css.srcMode', mode);
        });
      });
      U.bindSw(p.body, 'css.srcOn', () => { refresh(); });
    };

    p.body.addEventListener('click', async e => {
      const b = e.target.closest('[data-src]');
      if (!b) return;
      const act = b.dataset.src;
      const val = ta().value;
      if (act === 'copy'){
        try { await navigator.clipboard.writeText(val); say('已复制，可以粘给 AI 改'); }
        catch (err) { ta().select(); say('复制不了，已帮你选中，手动复制即可'); }
        return;
      }
      if (act === 'import'){ ta().focus(); ta().select(); say('已选中输入框，粘贴后点「预览」看看效果'); return; }
      if (act === 'preview'){
        const ok = A.cssSafe(val);
        say(ok ? '这一段可以解析，看上面的预览' : '括号不配平或有标签，保存会被拒绝', !ok);
        if (ok){
          const h = document.querySelector('.ap-prev-host');
          if (h) h.innerHTML = U.previewHtml()
            + '<style>@supports (selector(&)){.ap-scope .conv{' + val + '}}</style>';
        }
        return;
      }
      if (act === 'save'){
        if (val.trim() && !A.cssSafe(val)){ say('括号不配平或有标签，没有保存', true); return; }
        A.setMany([['css.srcCode', val], ['css.srcMode', mode], ['css.srcOn', true]]);
        say(val.trim() ? '已保存，聊天页即刻生效' : '已清空，聊天页回到默认');
        refresh();
        return;
      }
      if (act === 'reset'){ ta().value = TPL[mode]; say('已恢复这一份的默认模板，点「保存」才生效'); return; }
      if (act === 'off'){ A.set('css.srcOn', false); say('已关闭自定义聊天源码，聊天页回到默认'); refresh(); }
    });

    render();
    refresh = U.withPreview(p);
    return p.view;
  };
})();
