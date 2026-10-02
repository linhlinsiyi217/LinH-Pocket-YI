/* 活人感 v2：把模型输出变成「逐条消息」的纯函数
   来源是用户《活人感.docx》整理出的 v2 模块，按本仓库的数据结构接线。
   只接在 AI 角色的请求链路上；真人联系人绝不经过这里。
   要点：请求模型返回 JSON 的 messages 数组，每项一条真实聊天消息；
   模型没按格式返回时，按自然段与句末标点兜底拆分，一个字都不丢。 */
(function(){
  const limit = (value, size) => String(value == null ? '' : value).trim().slice(0, size);
  const unique = (items, key) => {
    const seen = new Set();
    return items.filter(item => {
      const id = String(key(item));
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const HUMANLIKE_BASE = [
    '你是当前角色，在手机上和对方私聊。只写这个角色真正发送的消息，不写第三人称旁白、心理描写、动作括号、模型说明或剧情段落。角色资料用于决定口吻，不是模仿它的叙述格式。',
    '先接住对方刚说的话，再按这个角色的性格回应。短称呼、问候或一句闲聊通常只需一两句；对方明确要求解释或讨论复杂事时才展开。不要每次都激动、撒娇、反问或用颜文字。不要凭空补出亲密关系、经历、天气、地点和看见对方的细节。过去的聊天若有夸张舞台描写或重复口癖，不要模仿那种格式。',
    '输出严格为 JSON：{"messages":["第一条实际发出的聊天文字","第二条聊天文字"]}。按真实对话节奏决定条数；一句话可以只有一条，需要接着补充时再分条。每项是一条独立聊天气泡，内容必须有实质话语，不能把每个短语切碎。不要在 JSON 外写任何内容。'
  ].join('\n');

  function formatItems(items, maxItems, maxChars, getId, getText){
    return unique(Array.isArray(items) ? items.filter(Boolean) : [], getId)
      .slice(0, maxItems).map(x => limit(getText(x), maxChars)).filter(Boolean);
  }

  function buildCharacterSystemPrompt({ character, userProfile, relationship,
    selectedWorldbook = [], selectedMemories = [], now = new Date(), extraRules = '' } = {}){
    if (!character || !character.id || !character.name) throw new Error('缺少角色 ID 或名称');
    const at = now instanceof Date ? now : new Date(now);
    if (!Number.isFinite(at.getTime())) throw new Error('无效的当前时间');
    // 世界书只从已有数据源里挑相关条目，这里不新建、不拷贝全部
    const lore = formatItems(selectedWorldbook, 6, 480,
      x => x.id != null ? x.id : (x.title != null ? x.title : x.content),
      x => `${x.title ? x.title + '：' : ''}${x.content != null ? x.content : (x.text || '')}`);
    const memories = formatItems(selectedMemories, 8, 260,
      x => x.id != null ? x.id : x.content,
      x => x.content != null ? x.content : (x.text || ''));
    const parts = [
      HUMANLIKE_BASE,
      `当前角色：${limit(character.name, 80)}；角色 ID：${limit(character.id, 100)}。`,
      `角色卡：${limit(character.persona != null ? character.persona : character.description, 3000) || '未填写'}。`,
      character.speechStyle && `角色自己的说话方式：${limit(character.speechStyle, 700)}。`,
      relationship && `已保存的关系状态：${limit(relationship, 600)}。`,
      userProfile && `用户自愿提供的资料：${limit(userProfile, 650)}。`,
      `当前时间：${at.toISOString()}。没有可靠来源就不要推断地点、天气或活动。`,
      lore.length && `相关世界书条目：\n${lore.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      memories.length && `相关记忆：\n${memories.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      extraRules && `此角色已确认的额外规则：${limit(extraRules, 800)}。`
    ];
    return parts.filter(Boolean).join('\n\n');
  }

  function buildHumanlikeMessages({ character, userProfile, relationship, selectedWorldbook,
    selectedMemories, history = [], latestUserMessage, now, extraRules } = {}){
    if (!latestUserMessage || !latestUserMessage.content || !latestUserMessage.content.trim())
      throw new Error('用户消息为空');
    const system = buildCharacterSystemPrompt({
      character, userProfile, relationship, selectedWorldbook, selectedMemories, now, extraRules
    });
    const recent = (Array.isArray(history) ? history : [])
      .filter(x => x && (x.role === 'user' || x.role === 'assistant')
        && typeof x.content === 'string' && x.content.trim()
        && (!latestUserMessage.id || x.id !== latestUserMessage.id))
      .slice(-16)
      .map(x => ({ role: x.role, content: limit(x.content, 2000) }));
    if (recent.length && recent[recent.length - 1].role === 'user'
      && recent[recent.length - 1].content === limit(latestUserMessage.content, 4000)) recent.pop();
    return [
      { role: 'system', content: system },
      ...recent,
      { role: 'user', content: limit(latestUserMessage.content, 4000) }
    ];
  }

  /* 兜底：模型没按 JSON 返回时，按自然段和句末标点拆成多条，
     每一段都保留，绝不做成一个大气泡，也不丢字。 */
  function splitNatural(text){
    const paragraphs = String(text || '').split(/\n\s*\n|\n+/).map(x => x.trim()).filter(Boolean);
    const out = [];
    for (const paragraph of paragraphs){
      if (paragraph.length <= 110){ out.push(paragraph); continue; }
      const sentences = paragraph.match(/[^。！？!?]+[。！？!?]*|[^。！？!?]+$/gu) || [paragraph];
      let bubble = '';
      for (const sentence of sentences){
        if (bubble && (bubble + sentence).length > 110){ out.push(bubble.trim()); bubble = ''; }
        if (sentence.length <= 110){ bubble += sentence; continue; }
        if (bubble){ out.push(bubble.trim()); bubble = ''; }
        for (let i = 0; i < sentence.length; i += 110) out.push(sentence.slice(i, i + 110).trim());
      }
      if (bubble.trim()) out.push(bubble.trim());
    }
    return out.filter(Boolean);
  }

  /* 把一次模型返回转成多条消息：认 JSON 的 messages 数组，否则按自然段兜底 */
  function parseCharacterReply(raw){
    const text = String(raw == null ? '' : raw).trim();
    if (!text) throw new Error('模型返回了空内容');
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
      const data = JSON.parse(jsonText);
      if (data && Array.isArray(data.messages)){
        const messages = data.messages.map(x => typeof x === 'string' ? x.trim() : '').filter(Boolean);
        if (messages.length) return messages.reduce((acc, s) => acc.concat(splitNatural(s)), []);
      }
    } catch (e) { /* 模型返回的是普通文字，走下面的兜底 */ }
    return splitNatural(text);
  }

  XS.humanlike = { HUMANLIKE_BASE, buildCharacterSystemPrompt, buildHumanlikeMessages, parseCharacterReply, splitNatural };
})();
