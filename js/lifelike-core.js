/* LinH Pocket YI — 可复用的聊天提示词组装模块。
 * 这是独立模块；接入时由现有 chat-conv.js 调用，不负责发网络请求。
 * BEHAVIOUR 是本项目自己的内置行为指令，随每次 AI 角色请求注入，
 * 角色自己的说话习惯优先于这里的一般建议。 */
(function (global) {
  'use strict';

  const BEHAVIOUR = [
    '你正在以当前角色身份，在手机聊天窗口与用户交流。先读当前角色卡、关系状态、相关记忆、最近对话和用户最新消息，再决定这名角色此刻最可能回应的重点。只输出角色会实际发出的消息，不输出旁白、动作舞台说明、心理分析、规则解释或模型自述。',
    '沿用这名角色自己的词汇、语气、标点、幽默感与边界；不要给所有角色套同一种短句、语气词、昵称或撒娇模板。先回应用户正在说的事，不机械附和，也不把每句话都变成安慰、建议、反问或话题钩子。角色可以有意见、迟疑、拒绝和情绪变化，但变化要由已知情境与性格驱动。用户难过时先认真回应其实际表达，不抢着说教或开玩笑。',
    '按语境决定消息长度：多数时候像正常手机聊天一样简洁；解释复杂事情时允许说完整。自然需要时可分成两三条连续消息，也允许只发一条极短回复；不得为达到固定条数或字数强拆、填充、反复使用“诶/哈哈/呀”。不要强制错字、改口、标点禁令或定期分享场景细节。只有角色确实会告诉用户且信息有依据时才提自己的活动，不把线上聊天写成实时摄像机。',
    '只引用确有来源的共同记忆，不凭空编造过去发生的事、照片、语音、已读、已送达或对方的心理。旧称呼和玩笑只有在此刻相关且对方接受时使用。保持角色、关系、时间与空间连续；无法确定的事实就不要说成确定。输出前检查是否像该角色发的消息、是否接住了本轮话题、是否有无根据的细节和重复套话；有问题则在发送前修正，不把检查过程显示给用户。'
  ].join('\n');

  const DEFAULT_STYLE = [
    '你正在以角色身份在手机里聊天。根据角色卡、当前语境和真实发生过的事自然回复。',
    '保持角色自己的措辞、节奏和情绪；用户说得短，回应也简短；复杂话题要讲完整。',
    '不要替对方编造心理、行动或经历；不要声称发送了尚未真正发送的图片或语音。',
    '只输出要呈现在聊天气泡里的文字，不输出分析、规则清单、旁白或思维链。',
    '确实需要连发几条时，用单独一行三个短横线 --- 分隔，最多三条；不需要就正常写一条。'
  ].join('\n');

  const asText = (value) => String(value == null ? '' : value).trim();
  const joinLines = (parts) => parts.map(asText).filter(Boolean).join('\n\n');

  function timeContext(now, timezone) {
    const date = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(date.getTime())) return '';
    const options = { dateStyle: 'medium', timeStyle: 'short' };
    if (timezone) options.timeZone = timezone;
    try {
      return new Intl.DateTimeFormat('zh-CN', options).format(date);
    } catch (_) {
      return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    }
  }

  // 世界书是具体知识条目；世界卷宗是组织角色与世界的容器，不在这里假装成知识条目。
  function chooseWorldbook(entries, latestMessage, maxEntries = 4) {
    const text = asText(latestMessage).toLocaleLowerCase();
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry && entry.enabled !== false && asText(entry.content))
      .filter((entry) => entry.always === true || (Array.isArray(entry.keywords) &&
        entry.keywords.some((key) => asText(key) && text.includes(asText(key).toLocaleLowerCase()))))
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))
      .slice(0, maxEntries)
      .map((entry) => `【世界书：${asText(entry.name) || '未命名'}】\n${asText(entry.content)}`);
  }

  function activeCalibrations(rows) {
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => row && (row.is_active === true || row.isActive === true))
      .slice(-5)
      .map((row) => asText(row.content || row.text))
      .filter(Boolean);
  }

  // 角色卡：可以是纯文本，也可以是分字段的对象。分字段时按项目现有的用户/角色模型组装。
  const CARD_KEYS = [
    ['name', '名字'], ['persona', '人设'], ['speaking', '说话习惯'],
    ['relation', '关系阶段'], ['taboos', '禁忌'], ['gender', '性别'],
    ['birthday', '生日'], ['hometown', '籍贯']
  ];
  function cardText(card) {
    if (typeof card === 'string') return asText(card);
    if (!card || typeof card !== 'object') return '';
    const rows = CARD_KEYS
      .map(([key, label]) => [label, asText(card[key])])
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}：${value}`);
    // 老格式（五层对象）也认：值不是字符串时按 JSON 收进来
    Object.keys(card).forEach((key) => {
      if (CARD_KEYS.some(([k]) => k === key)) return;
      const value = card[key];
      if (value == null || value === '') return;
      rows.push(`${key}：${typeof value === 'string' ? value : JSON.stringify(value)}`);
    });
    return rows.join('\n');
  }

  function buildPromptContext({
    characterProfile, userProfile = '', worldbookEntries = [], activePresets = [],
    calibrations = [], rollingSummary = '', relevantMemories = [],
    history = [], userInput, now = new Date(), timezone = '',
    activationText = '', style = DEFAULT_STYLE, maxHistoryMessages = 20,
    styleInFirstUserMessage = false
  } = {}) {
    const identity = cardText(characterProfile);
    if (!asText(identity)) throw new Error('缺少角色设定');
    if (!asText(userInput)) throw new Error('缺少当前用户消息');

    const lore = chooseWorldbook(worldbookEntries, userInput);
    const presets = (Array.isArray(activePresets) ? activePresets : [])
      .filter((p) => p && p.enabled !== false)
      .map((p) => asText(p.content || p.text)).filter(Boolean);
    const memory = (Array.isArray(relevantMemories) ? relevantMemories : [])
      .map((m) => asText(typeof m === 'string' ? m : m && (m.content || m.text))).filter(Boolean).slice(0, 8);

    // 稳定层：行为指令 + 角色卡 + 用户资料 + 世界书 + 预设。每次请求都一样。
    const stableSystem = joinLines([
      BEHAVIOUR,
      `【角色卡】\n${asText(identity)}`,
      userProfile && `【已确认的用户资料】\n${asText(userProfile)}`,
      ...lore,
      ...presets,
      ...activeCalibrations(calibrations).map((c) => `【近期有效校准】\n${c}`)
    ]);
    // 变化层：风格提示 + 摘要 + 与本轮有关的记忆 + 真实时间
    const dynamicStyle = joinLines([
      style,
      rollingSummary && `【已存对话摘要】\n${asText(rollingSummary)}`,
      memory.length && `【与本轮有关的长期记忆】\n${memory.join('\n')}`,
      `【当前真实时间】\n${timeContext(now, timezone)}`,
      activationText && `【本轮状态】\n${asText(activationText)}`
    ]);

    // history 只包含当前消息之前的真实对话；不要把最近历史又塞进 style。
    const recent = (Array.isArray(history) ? history : []).slice(-maxHistoryMessages)
      .filter((message) => message && ['user', 'assistant'].includes(message.role) && asText(message.content))
      .map((message) => ({ role: message.role, content: asText(message.content) }));
    const messages = styleInFirstUserMessage && dynamicStyle ?
      [{ role: 'user', content: dynamicStyle }, ...recent] : recent;
    messages.push({ role: 'user', content: asText(userInput) });
    return {
      system: styleInFirstUserMessage ? stableSystem : joinLines([stableSystem, dynamicStyle]),
      messages,
      stableSystem,
      dynamicStyle
    };
  }

  function validateReply(reply) {
    const text = asText(reply);
    if (!text) return { ok: false, reason: 'empty' };
    if (/<\/?(?:thinking|analysis)\b/i.test(text)) return { ok: false, reason: 'internal-tag' };
    if (/^(?:作为(?:一个)?AI|作为语言模型|根据(?:系统)?规则)/u.test(text))
      return { ok: false, reason: 'meta-answer' };
    return { ok: true, text };
  }

  /* 把一条回复拆成多条气泡：只认「单独一行 ---」这种明确分隔，最多三条；
     普通换行一律不切。拆不出来就原样当一条，绝不硬拆。 */
  function splitBubbles(reply, max = 3) {
    const text = asText(reply);
    if (!text) return [];
    if (!/\n\s*-{3,}\s*\n/.test(text)) return [text];
    const parts = text.split(/\n\s*-{3,}\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2 || parts.length > max) return [text];
    return parts;
  }

  // 给现有请求函数的接线示例：只在可判定错误时最多补发一次，不丢失修正原因。
  async function requestWithOneRetry(callModel, context) {
    if (typeof callModel !== 'function') throw new TypeError('callModel 应是现有 API 请求函数');
    let reply = await callModel(context);
    let checked = validateReply(reply);
    if (checked.ok) return checked.text;
    const retryContext = {
      ...context,
      system: joinLines([context.system, `上一次输出无效（${checked.reason}）。只生成角色会发送的聊天文字，不输出内部标签。`])
    };
    reply = await callModel(retryContext);
    checked = validateReply(reply);
    if (checked.ok) return checked.text;
    throw new Error(`模型回复格式错误：${checked.reason}`);
  }

  global.XS = global.XS || {};
  global.XS.lifelike = {
    BEHAVIOUR, DEFAULT_STYLE, buildPromptContext, chooseWorldbook,
    validateReply, requestWithOneRetry, splitBubbles, cardText, timeContext
  };
})(typeof window !== 'undefined' ? window : globalThis);
