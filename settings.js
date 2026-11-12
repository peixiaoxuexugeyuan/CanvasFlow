





(function () {
  'use strict';

  const CANVAS_PREFS_KEY = 'canvasflow-canvas-prefs';
  const APPEARANCE_KEY = 'canvasflow-appearance';
  const TAB_KEY = 'canvasflow-settings-tab';
  let aboutUpdateCleanup = null;

  const DEFAULT_CANVAS_PREFS = { miniMap: true, gridVisible: true, gridSnap: false, smartGuides: false };

  const ACCENT_PRESETS = ['#fafaf9', '#4c9dff', '#1d9e75', '#ef9f27', '#d4537e', '#7f77dd', '#171717'];

  const AUTH_MODE_OPTIONS = [
    { value: 'bearer', label: 'Bearer Token', hint: 'Authorization: Bearer <API Key>' },
    { value: 'x-api-key', label: 'x-api-key', hint: 'x-api-key: <API Key>' },
    { value: 'api-key', label: 'api-key', hint: 'api-key: <API Key>' },
    { value: 'none', label: '无鉴权', hint: '适用于本机或已由反向代理鉴权的服务' }
  ];

  const PROTOCOL_OPTIONS = [
    { value: 'openai', label: 'OpenAI 兼容', hint: '文本走 /chat/completions；图片端点与参考图形态由「图片传输合同」决定' },
    { value: 'anthropic', label: 'Anthropic Messages', hint: '文本走 /v1/messages；鉴权固定使用 x-api-key' },
    { value: 'dashscope', label: '阿里云百炼 DashScope', hint: '异步任务协议，视频提交走 /services/aigc/video-generation' },
    { value: 'kling', label: '可灵 Kling', hint: 'JWT 鉴权，视频走 /v1/videos/text2video 与 image2video' },
    { value: 'openai-video', label: '通用视频任务 API', hint: '自定义提交与查询端点，按异步任务轮询' }
  ];







  const IMAGE_TRANSPORT_OPTIONS = [
    { value: '', label: '自动推断（推荐）', hint: '按供应商域名与模型名自动选择；默认走标准 OpenAI 图片接口。' },
    { value: 'openai-images', label: 'OpenAI 标准（生成 / 编辑分端点）', hint: '生成走 images/generations，参考图走 images/edits，以 multipart 文件上传。' },
    { value: 'json-image-edits', label: '分离 edits · JSON image / images 字符串', hint: '参考图以 data URI 字符串放在 JSON 的 image（1 张）或 images（多张）字段。' },
    { value: 'grok2api-images', label: '分离 edits · Grok 图片对象', hint: '参考图以 { url } 对象放在 image（1 张）或 images（多张）字段。' },
    { value: 'generation-reference-images', label: '统一 generations · reference_images', hint: '生成与参考图都走 images/generations，参考图放 reference_images 数组。' },
    { value: 'generation-image-urls', label: '统一 generations · image_urls 字符串数组', hint: '生成与参考图都走 images/generations，参考图放 image_urls 数组。' },
    { value: 'generation-images-array', label: '统一 generations · images 字符串数组', hint: '生成与参考图都走 images/generations，参考图放 images 数组。' },
    { value: 'generation-input-image', label: '统一 generations · input_image', hint: '生成与参考图都走 images/generations，参考图放 input_image，仅支持 1 张。' },
    // ★★ 统一媒体端点：不是 images/* 那一族。提交走 POST /v1/media/generate（模型参数放 params），
    //    轮询走 GET /v1/skills/task-status。适合 lk888 这类「明确拒绝 images/* 路由」的平台。
    //    选了它就等于告诉服务端：别探测 images/* 的异步能力，直接按媒体端点走。
    { value: 'media-generate', label: '统一媒体端点（media/generate）', hint: '提交走 POST /v1/media/generate（模型专有参数放 params，按 /v1/skills/models/{模型} 的声明传），轮询走 GET /v1/skills/task-status。适用于拒绝 /v1/images/* 路由的平台。' }
  ];




  const MEDIA_PRESET_OPTIONS = [
    { value: 'auto', label: '自动推断（推荐）', contract: '', hint: '按供应商域名与模型名自动选择；默认走标准 OpenAI 图片接口。' },
    { value: 'openai-standard', label: 'OpenAI 标准', contract: 'openai-images', hint: '生成与编辑使用标准 OpenAI 图片接口；通常无需高级配置。' },
    { value: 'unified-image-urls', label: '统一生成 · image_urls', contract: 'generation-image-urls', hint: '生成与参考图走同一个端点，参考图放 image_urls。' },
    { value: 'unified-images-array', label: '统一生成 · images', contract: 'generation-images-array', hint: '生成与参考图走同一个端点，参考图放 images。' },
    { value: 'custom', label: '自定义合同（用下面的「图片传输合同」）', contract: null, hint: '不在预设覆盖范围内：按「协议兼容 → 图片传输合同」里选的那一项走。' }
  ];


  function presetForTransport(value) {
    const current = String(value ?? '');
    const found = MEDIA_PRESET_OPTIONS.find(option => option.contract !== null && String(option.contract) === current);
    return found ? found.value : 'custom';
  }

  function presetHint(value) {
    return MEDIA_PRESET_OPTIONS.find(option => option.value === value)?.hint || '';
  }

  function imageTransportLabel(value) {
    const option = IMAGE_TRANSPORT_OPTIONS.find(item => item.value === value);
    return option ? option.label : IMAGE_TRANSPORT_OPTIONS[0].label;
  }



  const TEXT_PROTOCOL_OPTIONS = [
    { value: '', label: 'Chat Completions（默认）', hint: '绝大多数网关都支持，走 /chat/completions。' },
    { value: 'responses', label: 'Responses API', hint: '走 /responses，支持 GPT-5 系列与 file_id 参考文件。' }
  ];

  function textProtocolLabel(value) {
    const option = TEXT_PROTOCOL_OPTIONS.find(item => item.value === value);
    return option ? option.label : TEXT_PROTOCOL_OPTIONS[0].label;
  }

  function textProtocolHint(value) {
    const option = TEXT_PROTOCOL_OPTIONS.find(item => item.value === value);
    return option ? option.hint : TEXT_PROTOCOL_OPTIONS[0].hint;
  }

  const MODEL_KIND_OPTIONS = [
    { value: 'i2t', label: '文本' },
    { value: 't2i', label: '图片' },
    { value: 'video', label: '视频' },
    { value: 'tts', label: '音频' }
  ];



  const PROVIDER_PROFILE_OPTIONS = [
    { value: '', label: '自动（按身份推断）' },
    { value: 'openai-standard', label: '标准 OpenAI' },
    { value: 'grok2api', label: 'GROK2API' }
  ];
  // 参考文件传输方式：实际发送时按这个固定次序挑第一个可用的（顺序由后端定，前端只负责展示）。
  const REFERENCE_MODE_OPTIONS = [
    { value: 'data-url', label: 'Base64（推荐）', hint: '直接随请求发送，最适合本地参考文件。' },
    { value: 'file-upload', label: '文件上传', hint: '先调用供应商的上传接口，再提交文件结果。' },
    { value: 'public-url', label: '公网 URL', hint: '供应商直接下载可公开访问的文件地址。' }
  ];
  const REFERENCE_KIND_OPTIONS = [
    { value: 'image', label: '图片' },
    { value: 'video', label: '视频' },
    { value: 'audio', label: '音频' }
  ];
  // 任务模式：空 = 按端点默认（图片同步、视频异步），显式选了就照选的走。
  const TASK_MODE_OPTIONS = [
    { value: 'sync', label: '同步：提交后直接返回结果' },
    { value: 'async', label: '异步：提交后轮询查询' }
  ];
  // 请求形态：决定这个模型走哪条调用路径；选项按模型类别收窄（后端同名白名单）。
  const REQUEST_PROFILE_OPTIONS = [
    { value: 'auto', label: '自动判断' },
    { value: 'chat-image', label: 'Chat 生图' },
    { value: 'async-video-task', label: '异步视频任务' },
    { value: 'openai-audio-speech', label: '标准 Audio Speech' },
    { value: 'openai-audio-generation', label: '兼容 Audio Generations' },
    // ★ 统一媒体端点：有些平台把生图 / 生视频 / 音频收敛到**同一个** `POST /v1/media/generate`。
    //   音频模型选它 —— 这类平台**没有** `/v1/audio/*`（实测 api.lk888.ai），
    //   音乐生成模型（suno-v4.5 等）只从 media/generate 收，走 audio/speech 是路由级 404。
    { value: 'media-generate', label: '统一媒体端点（media/generate）' },
    { value: 'zhongheng-video', label: '特惠1 · 纵横视频接口' },
    { value: 'sanyuan-video', label: '特惠2 · 视频工作流接口' }
  ];


  function requestProfileOptionsFor(kind) {
    const allowed = new Set(['auto']);
    if (kind === 't2i') allowed.add('chat-image');
    if (kind === 'video') { allowed.add('async-video-task'); allowed.add('media-generate'); allowed.add('zhongheng-video'); allowed.add('sanyuan-video'); }
    if (kind === 'tts') {
      allowed.add('openai-audio-speech');
      allowed.add('openai-audio-generation');
      allowed.add('media-generate');
    }
    return REQUEST_PROFILE_OPTIONS.filter(option => allowed.has(option.value));
  }

  function requestProfileLabel(value) {
    return REQUEST_PROFILE_OPTIONS.find(option => option.value === value)?.label || '自动/协议默认';
  }

  function providerProfileLabel(value) {
    return PROVIDER_PROFILE_OPTIONS.find(option => option.value === value)?.label || '自动（按身份推断）';
  }

  function taskModeLabel(value, fallback) {
    const effective = value || fallback;
    return TASK_MODE_OPTIONS.find(option => option.value === effective)?.label || effective;
  }

  function referenceModeLabel(value) {
    return REFERENCE_MODE_OPTIONS.find(option => option.value === value)?.label || value;
  }

  // 参考文件方式的展示文案：没配过 = 只支持 Base64（后端同款默认）
  function referenceModesText(list) {
    const modes = Array.isArray(list) && list.length ? list : ['data-url'];
    return modes.map(referenceModeLabel).join('、');
  }

  const TIMEOUT_FIELDS = [
    { key: 'textExec', label: '文本执行', unit: '秒' },
    { key: 'imageExec', label: '图片执行', unit: '秒' },
    { key: 'videoSubmit', label: '视频提交', unit: '秒' },
    { key: 'imageTotalWait', label: '图片总等待', unit: '分钟' },
    { key: 'videoTotalWait', label: '视频总等待', unit: '分钟' },
    { key: 'statusPoll', label: '单次状态查询', unit: '秒' }
  ];





  const TIMEOUT_FIELD_DEFS = TIMEOUT_FIELDS.map(field => ({
    key: field.key, label: field.label, unit: field.unit, divisor: 1
  }));

  let deps = null;
  let activeTab = 'providers';
  let providerCache = null;
  let expandedProviders = new Set();
  let wizard = null;
  let appSettings = null;
  let toastTimer = null;

  // ---------------------------------------------------------------- 工具

  const $id = id => document.getElementById(id);
  const esc = value => (deps?.escapeHtml ? deps.escapeHtml(value) : String(value ?? ''));
  const toast = (message, icon) => { if (deps?.showToast) deps.showToast(message, icon); };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing */ }
  }

  function panelToast(message) {
    const el = document.querySelector('.settings-toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2200);
  }

  function relativeLuminance(hex) {
    const raw = String(hex || '').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
    if (full.length !== 6) return 0;
    const channel = index => {
      const value = parseInt(full.slice(index, index + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  }

  // 主色上的文字色：亮底用深字、暗底用浅字，避免自定义主色后按钮文字隐形。
  function contrastForeground(hex) {
    return relativeLuminance(hex) > 0.45 ? '#171717' : '#ffffff';
  }

  // 实心色块上的文字：在深字 / 白字之间取对比度更高的那个。
  // 不复用上面的 contrastForeground —— 它的阈值 0.45 会把中间调判成白字：
  // 默认辅助色 #4c9dff 亮度 0.33，白字只有 2.8:1，深字反而是 6.0:1。
  function readableInkFor(hex) {
    return contrastRatio(hex, '#171717') >= contrastRatio(hex, '#ffffff') ? '#171717' : '#ffffff';
  }

  function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  // 「边缘保护」：主色填充的按钮本身没有描边，当主色接近所在主题的背景色时，
  // 按钮会整体融进背景、看不出形状（文字仍然可读）。这里按主题取一个最极端的
  // 基准面算对比度，低于 3:1 就给按钮补一圈内描边（--brand-edge）。
  // 未自定义主色时不写这个变量 → var(--brand-edge, transparent) → 视觉零变化。
  // 阈值取 WCAG 非文本对比度的 3:1：加描边是**无损**的（不动用户选的颜色），可以放宽。
  const EDGE_MIN_RATIO = 3;
  // 「辅助色守护」是**换色**（会丢掉用户选的颜色），代价高，所以只在真的「融进背景」时才做，
  // 阈值取 1.5:1 —— 例如浅色下选默认强调蓝 #4c9dff 对白底是 2.54:1，眼睛能看见，不该被换掉。
  const INK_MIN_RATIO = 1.5;
  const EDGE_SURFACE = { dark: '#1c1c1c', light: '#ffffff' };
  const EDGE_RING = { dark: 'rgba(250,250,249,.45)', light: 'rgba(12,10,9,.45)' };

  function edgeRingFor(accent, themeKey) {
    const surface = EDGE_SURFACE[themeKey] || EDGE_SURFACE.dark;
    if (!accent || contrastRatio(accent, surface) >= EDGE_MIN_RATIO) return '';
    return EDGE_RING[themeKey] || EDGE_RING.dark;
  }

  // 主题自带的强调色（--accent）：两套主题下都跟自己的背景有足够反差，用作兜底色。
  function themeAccent() {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    if (value) return value;
    return document.documentElement.classList.contains('light') ? '#171717' : '#fafaf9';
  }

  // 「辅助色守护」：--brand-2 主要用在描边 / 焦点环 / 选中连线这类「线」上。
  // 线本身就是轮廓，没法像主色那样再补一圈，所以主色用「加描边」、辅助色只能「换色」：
  // 用户选的辅助色与主题基准面几乎同色（< 1.5:1）时，改用主题自带 --accent，
  // 否则不写这个变量 → var(--brand-2-ink, var(--brand-2, var(--accent))) 原样生效。
  function accentInkFor(accent2, themeKey) {
    const surface = EDGE_SURFACE[themeKey] || EDGE_SURFACE.dark;
    if (!accent2 || contrastRatio(accent2, surface) >= INK_MIN_RATIO) return '';
    return themeAccent();
  }

  function hostOf(url) {
    try { return new URL(String(url || '')).host; } catch { return String(url || '').replace(/^https?:\/\//, '').split('/')[0]; }
  }

  // ---------------------------------------------------------------- 外观设置

  function appearanceState() {
    return readJson(APPEARANCE_KEY, {}) || {};
  }

  function currentThemeKey() {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  }

  function applyAppearance() {
    const root = document.documentElement;
    const stored = appearanceState();
    const themeKey = currentThemeKey();
    const saved = stored[themeKey] || {};
    if (saved.accent) {
      root.style.setProperty('--brand', saved.accent);
      root.style.setProperty('--brand-fg', contrastForeground(saved.accent));
      const ring = edgeRingFor(saved.accent, themeKey);
      if (ring) root.style.setProperty('--brand-edge', ring);
      else root.style.removeProperty('--brand-edge');
    } else {
      root.style.removeProperty('--brand');
      root.style.removeProperty('--brand-fg');
      root.style.removeProperty('--brand-edge');
    }
    if (saved.accent2) {
      root.style.setProperty('--brand-2', saved.accent2);
      const ink = accentInkFor(saved.accent2, themeKey);
      if (ink) root.style.setProperty('--brand-2-ink', ink);
      else root.style.removeProperty('--brand-2-ink');
      // 实心按钮（添加供应商 / 向导主按钮）的底色就是 --brand-2，文字必须跟着取反，
      // 否则用户把辅助色选成近黑 → 黑字压黑底，按钮上的字直接消失。
      root.style.setProperty('--brand-2-fg', readableInkFor(saved.accent2));
    } else {
      root.style.removeProperty('--brand-2');
      root.style.removeProperty('--brand-2-ink');
      root.style.removeProperty('--brand-2-fg');
    }
  }

  function setAppearance(patch) {
    const stored = appearanceState();
    const themeKey = currentThemeKey();
    const next = { ...stored, [themeKey]: { ...(stored[themeKey] || {}), ...patch } };
    Object.keys(next[themeKey]).forEach(key => { if (!next[themeKey][key]) delete next[themeKey][key]; });
    if (!Object.keys(next[themeKey]).length) delete next[themeKey];
    writeJson(APPEARANCE_KEY, next);
    applyAppearance();
    return next;
  }

  function resetAppearance() {
    writeJson(APPEARANCE_KEY, {});
    applyAppearance();
  }

  // ---------------------------------------------------------------- 画布偏好

  function canvasPrefs() {
    return { ...DEFAULT_CANVAS_PREFS, ...(readJson(CANVAS_PREFS_KEY, {}) || {}) };
  }

  function setCanvasPref(patch) {
    const next = { ...canvasPrefs(), ...patch };
    writeJson(CANVAS_PREFS_KEY, next);
    applyCanvasPrefs(next);
    return next;
  }

  function applyCanvasPrefs(prefs) {
    const value = prefs || canvasPrefs();
    deps?.onCanvasPrefsChanged?.(value);
    return value;
  }

  // ---------------------------------------------------------------- 面板外壳

  const TAB_DEFS = [
    // ★★ 两个供应商面板（r794，用户需求）：
    //   mainProviders —— 「供应商设置」：模型 ownerId 为空，**所有用户可见、可调用**，仅管理员能改；
    //   providers     —— 「供应商设置」：模型 ownerId = 当前用户，**只有本人可见、可用**，管理员 + VIP 能改。
    //   两者复用同一个渲染函数（`renderProvidersPane`），差别只在作用域 `providerScope`。
    { id: 'mainProviders', label: '供应商设置', roles: ['admin'], icon: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>' },
    { id: 'providers', label: '供应商设置', roles: ['admin', 'vip'], icon: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>' },
    { id: 'previsModels', label: '预演台模型设置', roles: null, icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/>' },
    // 模型管理：画布所有选项面板的「登记表」都在这儿维护（音频规格 / 视频规格 / 摄像机库）。
    // ★ 全局一套、只有管理员 —— 它决定**所有人**看到的面板长什么样，VIP 也不能改。
    { id: 'modelRegistry', label: '模型管理', roles: ['admin'], icon: '<path d="M4 6.5h9M17.5 6.5H20M4 12h4M12.5 12H20M4 17.5h11M19.5 17.5H20"/><circle cx="15" cy="6.5" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="17" cy="17.5" r="2.2"/>' },
    // 模型定价（r884，用户需求）：**位置由用户指定** —— 「模型管理下面、提示词编辑上面」。
    // 与「模型管理」同一条纪律：全局一套、只有管理员（它决定**所有人**被扣多少积分）。
    { id: 'pricing', label: '模型定价', roles: ['admin'], icon: '<path d="M20.4 13.6 13.6 20.4a2 2 0 0 1-2.8 0L3 12.6V3h9.6l7.8 7.8a2 2 0 0 1 0 2.8Z"/><circle cx="7.4" cy="7.4" r="1.7"/>' },
    // 提示词编辑：画布内所有预设的提示词正文统一在这里管理（只对管理员开放）。
    { id: 'prompts', label: '提示词编辑', roles: ['admin'], icon: '<path d="M4 5.5h16M4 10h10M4 14.5h13M4 19h7"/>' },
    { id: 'appearance', label: '外观设置', roles: null, icon: '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"/>' },
    { id: 'startup', label: '启动动画设置', roles: null, icon: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/>' },
    { id: 'general', label: '通用设置', roles: null, icon: '<path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>' },
    { id: 'about', label: '关于 CanvasFlow', roles: null, icon: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>' }
  ];

  /**
   * 当前供应商面板的作用域（r794）。
   * · `global` —— 供应商设置：读写 ownerId 为空的模型；
   * · `mine`   —— 供应商设置：读写 ownerId = 当前用户的模型。
   */
  let providerScope = 'global';

  /** 供应商面板的接口都带 scope：供应商 = global，供应商设置 = mine。 */
  function scopeUrl(url) {
    const u = String(url);
    // ★ 只给「模型注册表」相关接口加 scope —— 别的 admin 接口（提示词、用户…）不吃这个参数，
    //   顺手带上虽然无害，但会让人误以为它们也分作用域。
    if (u.indexOf('/api/admin/ai-models') !== 0 && u.indexOf('/api/admin/provider-models-test') !== 0) return u;
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'scope=' + providerScope;
  }
  /**
   * 供应商面板专用 api。
   * ★★ 这里**必须**用 providerApi，不要直接用 `deps.api` 打 `/api/admin/ai-models` ——
   *    那样会落到默认的 global 作用域，在「供应商设置」里点保存会改到供应商的数据。
   */
  /**
   * ★★ 模型注册表被改动后要**立刻**通知宿主（画布 / 对话式 Agent）刷新。
   *    否则同页面内要等 `startModelRegistrySync` 的 30 秒心跳、或切走窗口再回来才看得到 ——
   *    用户实测：「自动保存了，但不刷新页面就一直不显示」（设置里勾了新模型，Agent 的
   *    「选择模型」浮层里没有它）。
   *    ★ 收口在 providerApi 这一个出口：供应商面板所有写都走它，不会漏掉某条分支。
   *    ★ 必须 debounce：批量删除会连打几十上百次请求，逐次通知 = 逐次重拉模型列表。
   *    ★ 用 window 事件而不是 deps 回调：消费方分布在 app.js 的两个不同闭包里
   *      （画布侧 loadI2tModels / Agent 侧 agentLoadModels），事件天然跨作用域。
   */
  const MODELS_CHANGED_EVENT = 'canvasflow:models-changed';
  let modelsChangedTimer = 0;
  function notifyModelsChanged() {
    clearTimeout(modelsChangedTimer);
    modelsChangedTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent(MODELS_CHANGED_EVENT));
    }, 300);
  }

  const providerApi = async (url, options) => {
    const result = await deps.api(scopeUrl(url), options);
    // 只有「模型注册表」的**写**并且**成功**才算变更；只读请求与失败响应都不通知。
    const method = String(options?.method || 'GET').toUpperCase();
    if (method !== 'GET' && String(url).indexOf('/api/admin/ai-models') === 0 && result && !result.error) {
      notifyModelsChanged();
    }
    return result;
  };

  /**
   * 让 `providerScope` 跟着当前分区走（r794）。
   * ★ 切分区、恢复上次分区都必须调 —— 漏一处就会把供应商的数据画进「供应商设置」。
   */
  function syncProviderScope() {
providerScope='global';providerCache=null;
    }

  function visibleTabs() {
return TAB_DEFS.filter(tab => !['providers','pricing'].includes(tab.id));
    }

  function renderNav() {
    const nav = $id('settingsNav');
    if (!nav) return;
    const tabs = visibleTabs();
    if (!tabs.some(tab => tab.id === activeTab)) activeTab = tabs[0]?.id || 'appearance';
    nav.innerHTML = tabs.map(tab => `<button class="settings-nav-item ${tab.id === activeTab ? 'is-active' : ''}" type="button" data-settings-tab="${tab.id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tab.icon}</svg>
      <span>${tab.id === 'about' ? '关于 <span class="cf-brand-prism">CanvasFlow</span>' : esc(tab.label)}</span>
    </button>`).join('');
    nav.querySelectorAll('[data-settings-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.settingsTab));
    });
  }

  function switchTab(tabId) {
    activeTab = tabId;
    syncProviderScope();
    paneScrollReset = true;               // 换分区从顶部开始
    try { localStorage.setItem(TAB_KEY, tabId); } catch { /* ignore */ }
    renderNav();
    renderPane();
  }

  // 重绘会重建 pane 的 innerHTML → 滚动位置被打回顶部（点「拉取模型列表」后卡片弹回最上面、
  // 用户得重新往下划，就是这个原因）。默认**保留**滚动位置，只有切分区时才重置
  // （paneScrollReset 由 switchTab 置位、这里消费一次）。
  function renderPane() {
    aboutUpdateCleanup?.();
    aboutUpdateCleanup = null;
    const pane = $id('settingsPane');
    if (!pane) return;
    const resetScroll = paneScrollReset;
    paneScrollReset = false;
    if (resetScroll) paneScrollWant = 0;
    const want = paneScrollWant;
    // 重绘是分几步写 DOM 的：pane 先被清空（scrollHeight 塌到视口高度，浏览器把 scrollTop 夹成 0），
    // 内容随后才长回来。所以这几步里产生的 scroll 事件都不是「用户滚动」，用时间窗忽略掉。
    paneScrollIgnoreUntil = performance.now() + 120;
    if (activeTab === 'providers' || activeTab === 'mainProviders') {
      // ★★ 供应商列表是**异步**拉的（loadProviders）：重绘时 pane 里还是「正在读取供应商配置…」
      //    这一行短占位，此刻回填 scrollTop 会被直接夹断成 0 —— 实测「在供应商设置里滚到下半区、
      //    勾一下参考文件卡片就弹回最顶上」的真正原因就在这（向导层那处见 renderWizardLayer）。
      //    列表渲染完再补一次，并把这段的 scroll 事件挡在记忆窗口外，否则夹断产生的 scroll
      //    会被记成「用户滚动」→ 记忆值也被污染成 0。
      Promise.resolve(renderProvidersPane(pane)).then(() => {
        paneScrollIgnoreUntil = performance.now() + 120;
        restorePaneScroll(want);
      });
      renderWizardLayer();
    } else if (activeTab === 'previsModels') renderPrevisModelsPane(pane);
    else if (activeTab === 'appearance') renderAppearancePane(pane);
    else if (activeTab === 'about') renderAboutPane(pane);
    else if (activeTab === 'startup') renderStartupPane(pane);
    else if (activeTab === 'prompts') renderPromptsPane(pane);
    else if (activeTab === 'modelRegistry') renderModelRegistryPane(pane);
    else if (activeTab === 'pricing') renderPricingPane(pane);
    else renderGeneralPane(pane);
    restorePaneScroll(want);
  }

  async function renderPrevisModelsPane(pane) {
    pane.innerHTML='<h2 class="settings-pane-title">预演台模型设置</h2><p class="settings-pane-desc">勾选供应商模型，使其出现在预演台的模型选择中。</p><div data-previs-model-list>正在读取模型…</div>';
    try {
      const payload=await deps.api('/api/previs/models',{throwOnError:true});
      if(activeTab!=='previsModels')return;
      const list=pane.querySelector('[data-previs-model-list]');if(!list)return;
      const models=payload.models||[];
      list.innerHTML=(models.length?models.map(m=>`<label class="settings-previs-model"><input type="checkbox" data-previs-model-id="${esc(m.id)}" ${m.checked?'checked':''} ${!payload.canEdit?'disabled':''}><span><strong>${esc(m.name)}</strong><small>${esc(m.provider)} · ${esc(m.kind)}${!m.enabled?' · 供应商未启用':''}${!m.supportsScene?' · 不支持场景调度':''}</small></span></label>`).join(''):'<div class="settings-empty">供应商中还没有模型</div>')+(payload.canEdit?'<button class="settings-add-btn" type="button" data-previs-model-save>保存预演台模型设置</button>':'<p class="settings-pane-desc">在此配置可用模型。</p>');
      list.querySelector('[data-previs-model-save]')?.addEventListener('click',async e=>{
        const button=e.currentTarget;button.disabled=true;
        try{await deps.api('/api/previs/models',{method:'PUT',throwOnError:true,body:JSON.stringify({selectedIds:[...list.querySelectorAll('input:checked')].map(el=>el.dataset.previsModelId)})});window.dispatchEvent(new CustomEvent('canvasflow:previs-models-changed'));deps.showToast?.('预演台模型设置已保存');}
        catch(error){deps.showToast?.('保存失败：'+error.message);}
        finally{button.disabled=false;}
      });
    }catch(error){if(activeTab==='previsModels')pane.querySelector('[data-previs-model-list]').textContent='模型读取失败：'+error.message;}
  }

  function restorePaneScroll(want) {
    const pane = $id('settingsPane');
    if (!pane) return;
    pane.scrollTop = want;
    if (!want) return;
    // 立即回填会被夹断（内容还没长回来），下一帧再补一次。
    requestAnimationFrame(() => {
      const again = $id('settingsPane');
      if (again) again.scrollTop = want;
    });
  }

  function bindPaneScrollMemory() {
    const pane = $id('settingsPane');
    if (!pane || pane.dataset.scrollBound === '1') return;
    pane.dataset.scrollBound = '1';
    // 只记录「用户真的滚动」：重绘前后那几十毫秒内的 scroll 事件是清空/回填引起的，不算。
    pane.addEventListener('scroll', () => {
      if (performance.now() < paneScrollIgnoreUntil) return;
      paneScrollWant = pane.scrollTop;
    });
  }

  function isOpen() {
    const backdrop = $id('settingsBackdrop');
    return Boolean(backdrop && !backdrop.hidden);
  }

  function open(tab) {
    const backdrop = $id('settingsBackdrop');
    if (!backdrop) return;
    bindPaneScrollMemory();
    if (tab) activeTab = tab;
    else {
      const saved = (() => { try { return localStorage.getItem(TAB_KEY); } catch { return null; } })();
      if (saved && visibleTabs().some(item => item.id === saved)) activeTab = saved;
    }
    syncProviderScope();
    backdrop.hidden = false;
    renderNav();
    renderPane();
  }

  async function close() {
    if (!await flushProviderPatch()) return;
    aboutUpdateCleanup?.();
    aboutUpdateCleanup = null;
    const backdrop = $id('settingsBackdrop');
    $id('aboutUpdatesDialog')?.close();
    if (backdrop) backdrop.hidden = true;
    wizard = null;
    renderWizardLayer();
  }

  function bindShell() {
    const backdrop = $id('settingsBackdrop');
    if (!backdrop || backdrop.dataset.bound) return;
    backdrop.dataset.bound = '1';
    $id('settingsClose')?.addEventListener('click', close);
    backdrop.addEventListener('pointerdown', event => { if (event.target === backdrop) close(); });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !isOpen()) return;
      const updates = $id('aboutUpdatesDialog');
      if (updates?.open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        updates.close();
        return;
      }
      // 先收子面板再收浮层：向导开着时 Esc 只关向导，别把整个偏好设置一起关掉。
      // ★ 和「取消」按钮一样必须 renderPane()：否则列表停在「正在读取供应商配置…」占位上。
      if (wizard) { event.stopPropagation(); wizard = null; renderPane(); return; }
      event.stopPropagation();
      close();
    }, true);
  }








  const PROVIDER_SAVE_DELAY = 600;      
  const LOGO_MAX_EDGE = 128;            // LOGO 先缩到 128px 再转 data URI，避免把大图塞进 JSON
  const LOGO_MAX_CHARS = 300000;
  const ENDPOINT_PLACEHOLDER = {
    imageSubmitPath: '/v1/images/generations',
    imageEditPath: '/v1/images/edits（可选）',
    imageStatusPath: '/v1/images/generations/{task_id}',
    submitPath: '/v1/videos/generations',
    statusPath: '/v1/videos/generations/{task_id}',
    cancelPath: '/v1/tasks/{task_id}/cancel'
  };

  const ICONS = {
    caret: '<path d="M9 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.7 2.4 15.3 0 18M12 3c-2.4 2.7-2.4 15.3 0 18"/>',
    key: '<circle cx="8.5" cy="15.5" r="4.2"/><path d="M11.6 12.4 20 4M17 4h3v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a3 3 0 0 0-3 3v6.5A2.5 2.5 0 0 0 5.5 15"/>',
    trash: '<path d="M4 7h16M9.5 7V4.6h5V7M6.5 7l1 13h9l1-13"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M14.5 5.5 18.5 9.5"/>',
    upload: '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 20h16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    circle: '<circle cx="12" cy="12" r="7.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    sliders: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.6-3.6"/>',
    alert: '<path d="M12 4.5 2.8 20h18.4L12 4.5Z"/><path d="M12 10v4.2M12 17.4h.01"/>'
  };

  const svgIcon = (name, size) => `<svg viewBox="0 0 24 24" width="${size || 14}" height="${size || 14}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  let providerSaveTimer = null;
  const pendingProviderPatches = new Map(); // 每个供应商分别合并，切卡不会丢失上一张的编辑。
  let providerSaveInFlight = null;
  let remoteCandidates = new Map();     // key -> { loading, list, error, notice }（notice = 拉取结果常驻状态条）
  let logoState = new Map();            // key -> { busy, error }
  let renamingKey = '';                 // 头部正在重命名的供应商
  let renamingModelId = '';             // 正在就地重命名的**模型**（r794）
  let endpointAdvancedOpen = new Set();
  let modelDraft = null;                // 内联新增模型草稿 { group, model, name, type }
  let builtInProviderExpanded = false;
  let builtInChildDraft = null;
  const BUILTIN_CONFIG_LABELS = { text: '文本配置', image: '图片配置', video: '视频配置', audio: '音频配置' };
  const BUILTIN_CONFIG_TYPES = { text: 'i2t', image: 't2i', video: 'video', audio: 'tts' };
  function isCanvasFlowProvider(group) {
    return !!group?.builtIn || group?.providerGroup === 'canvasflow';
  }
  let paneScrollReset = false;          // 下一次 renderPane 是否把滚动位置重置到顶部（切换分区时置 true）
  let paneScrollWant = 0;               // 重绘后要还原到的滚动位置（只由用户滚动与切分区维护）
  let paneScrollIgnoreUntil = 0;        // 这段时间内的 scroll 事件是重绘引起的，不当作用户滚动
  let modelFilter = 'all';              // 模型列表筛选：all / enabled / text / image / video / audio
  let modelQuery = '';                  // 模型列表搜索词（按模型 ID 或别名匹配）
  let wizardEndpointsOpen = false;      // 向导「高级端点覆盖」是否展开（重绘要保住）

  // 分组桶 = 名称|BaseURL|协议。它是「这张卡是谁」的唯一标识，也是展开态/候选/草稿的存放键。
  // 坑点：名称、BaseURL、协议都是卡片上的可编辑字段 —— 用户改一个字符桶就变了，
  // 展开态会当场失配（表现成「改 BaseURL 时卡片自己折叠」）。
  // 所以 patchProvider 里有一处「桶变了就把这些状态一起搬家」，改这三个字段时别漏。
  // 也不能拿「首行模型 id」当身份：服务端新增模型是 insert(0)，首行 id 每加一个模型就换一次。
  function providerBucket(source) {
    const baseUrl = String(source.baseUrl || '').trim();
    const protocol = String(source.protocol || 'openai');
    const name = String(source.name ?? source.provider ?? '').trim() || hostOf(baseUrl) || '未命名供应商';
    return `${name}|${baseUrl}|${protocol}`;
  }

  function groupProviders(models, providers) {
    const groups = new Map();
    (models || []).forEach(model => {
      const baseUrl = String(model.baseUrl || '').trim();
      const protocol = String(model.protocol || 'openai');
      const name = String(model.provider || '').trim() || hostOf(baseUrl) || '未命名供应商';
      const key = providerBucket({ name, baseUrl, protocol });
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          baseUrl,
          protocol,
          authMode: model.authMode || 'bearer',
          docsUrl: model.docsUrl || '',
          logoUrl: model.logoUrl || '',
          textProtocol: model.textProtocol || '',
          imageTransport: model.imageTransport || '',
          submitPath: model.submitPath || '',
          statusPath: model.statusPath || '',
          imageSubmitPath: model.imageSubmitPath || '',
          imageEditPath: model.imageEditPath || '',
          // 能力位（r689）：全部按「同组多行」写回，所以组上也要带一份
          providerProfile: model.providerProfile || '',
          referenceInputModes: Array.isArray(model.referenceInputModes) ? [...model.referenceInputModes] : [],
          fileUploadPath: model.fileUploadPath || '',
          fileUploadMediaKinds: Array.isArray(model.fileUploadMediaKinds) ? [...model.fileUploadMediaKinds] : [],
          imageTaskMode: model.imageTaskMode || '',
          imageStatusPath: model.imageStatusPath || '',
          imageCancelPath: model.imageCancelPath || '',
          videoTaskMode: model.videoTaskMode || '',
          videoCancelPath: model.videoCancelPath || '',
          // 独立生成超时（供应商级覆盖）：同组多行写回，所以组上也要带一份。
          // ★ 漏了这行 = 刷新后 group.generationTimeouts 恒为 undefined，
          //   开关又自己弹回「关」—— 而落盘数据其实是好的（典型的「读不出来」而非「没存住」）。
          generationTimeouts: (model.generationTimeouts && typeof model.generationTimeouts === 'object')
            ? { ...model.generationTimeouts } : null,
          name,
          models: []
        });
      }
      groups.get(key).models.push(model);
    });
    (providers || []).forEach(provider => {
      const key = providerBucket({ ...provider, name: provider.provider });
      const group = groups.get(key);
      if (group?.builtIn) return;
      if (isCanvasFlowProvider(provider)) {
        groups.set(key, { ...provider, key, name: provider.provider, providerId: provider.id, models: group?.models || [] });
        return;
      }
      if (group) {
        group.providerId = provider.id;
        group.apiKeySet = provider.apiKeySet;
        group.apiKeyHint = provider.apiKeyHint;
      } else {
        groups.set(key, { ...provider, key, name: provider.provider, providerId: provider.id, models: [] });
      }
    });
    return [...groups.values()].sort((a, b) => Number(!!b.builtIn) - Number(!!a.builtIn));
  }

  async function loadProviders(force) {
    if (providerCache && !force) return providerCache;
    const result = await providerApi('/api/admin/ai-models');
    if (!result || result.error) {
      providerCache = { error: result?.message || '无法读取本地供应商配置', items: [] };
      return providerCache;
    }
    providerCache = { error: '', items: groupProviders(result.models, result.providers) };
    return providerCache;
  }

  function protocolLabel(value) {
    return PROTOCOL_OPTIONS.find(item => item.value === value)?.label || value || 'OpenAI 兼容';
  }

  function authModeLabel(value) {
    return AUTH_MODE_OPTIONS.find(item => item.value === value)?.label || 'Bearer Token';
  }

  function kindLabel(value) {
    return MODEL_KIND_OPTIONS.find(item => item.value === value)?.label || value || '未知';
  }

  async function renderProvidersPane(pane) {
    // ★ 两个分区共用这一个渲染函数，标题 / 说明按作用域区分（r794）
    const isMain = providerScope === 'global';
    const paneSub = isMain
      ? '配置本地工作台使用的模型服务、API 地址和密钥。'
      : '配置本地工作台使用的模型服务、API 地址和密钥。';
    pane.innerHTML = `<header class="settings-pane-head">
      <div>
        <h2 class="settings-pane-title" id="settingsPaneTitle">${isMain ? '供应商设置' : '供应商设置'}</h2>
        <p class="settings-pane-sub">${paneSub}</p>
      </div>
      <button class="settings-add-btn" type="button" id="providerAddBtn">${svgIcon('plus', 14)}<span>添加 OpenAI 兼容商</span></button>
    </header>
    <div id="providerListBox"><div class="settings-empty">正在读取供应商配置…</div></div>
    <div class="settings-toast" role="status" aria-live="polite"></div>`;

    $id('providerAddBtn')?.addEventListener('click', () => startWizard());

    const data = await loadProviders();
    const box = $id('providerListBox');
    // ★★ 只判 box，**不要**因为「向导开着」就早退（历史写法）。向导现在是挂在 body 上的
    //    独立浮层 #providerWizardLayer，填列表不会覆盖它；而早退会让 #providerListBox 永远停在
    //    「正在读取供应商配置…」占位上 —— 取消向导时只移除浮层、不重绘列表，于是整个分区
    //    永久卡在读取中（用户实测踩过）。
    if (!box) return;
    if (data.error) {
      box.innerHTML = `<div class="settings-empty">${esc(data.error)}</div>`;
      return;
    }
    if (!data.items.length) {
      box.innerHTML = `<div class="settings-empty">${isMain
        ? '还没有配置供应商。<br />点击右上角「添加 OpenAI 兼容商」开始配置，配好的模型即可在本地工作台使用。'
        : '你还没有配置自己的供应商。<br />点击右上角「添加 OpenAI 兼容商」开始配置，这些模型只有你自己可见、可用。'}</div>`;
      return;
    }
    const builtin = Object.keys(BUILTIN_CONFIG_LABELS).flatMap(kind =>
      data.items.filter(group => group.builtIn && group.builtInKind === kind));
    builtin.push(...data.items.filter(group => !group.builtIn && isCanvasFlowProvider(group)));
    const custom = data.items.filter(group => !isCanvasFlowProvider(group));
    box.innerHTML = `<div class="provider-list">${builtin.length ? renderBuiltInProviderGroup(builtin) : ''}${custom.map(renderProviderCard).join('')}</div>`;
    box.querySelector('[data-builtin-provider-toggle]')?.addEventListener('click', () => {
      builtInProviderExpanded = !builtInProviderExpanded;
      renderPane();
    });
    bindBuiltInChildForm(box);
    bindProviderCardEvents();
  }

  function renderBuiltInProviderGroup(groups) {
    return `<section class="provider-brand-group ${builtInProviderExpanded ? 'is-expanded' : ''}" aria-label="CanvasFlow 内置供应商">
      <div class="provider-card-header">
        <button class="provider-card-head" type="button" data-builtin-provider-toggle aria-expanded="${builtInProviderExpanded}" aria-controls="builtinProviderConfigs">
          <span class="provider-expand-icon">${svgIcon('caret')}</span>
          ${providerLogoHtml({ builtIn: true }, 'provider-logo--header')}
          <span class="provider-head-copy"><span class="provider-title cf-brand-prism">CanvasFlow</span><span class="provider-subtitle">https://ai.zzzapi.xyz</span></span>
        </button>
        <span class="provider-card-actions"><button class="provider-ghost-btn provider-add-child" type="button" data-provider-add-child ${builtInChildDraft?.saving ? 'disabled' : ''}>${svgIcon('plus', 13)}<span>新增子配置</span></button><span class="provider-builtin-badge" title="内置供应商不可删除">内置</span></span>
      </div>
      ${builtInProviderExpanded ? `<div class="provider-child-list" id="builtinProviderConfigs">${renderBuiltInChildForm()}${groups.map(renderProviderCard).join('')}</div>` : ''}
    </section>`;
  }

  function renderBuiltInChildForm() {
    const draft = builtInChildDraft;
    if (!draft) return '';
    return `<form class="provider-child-form" data-provider-child-form aria-label="新增 CanvasFlow 子配置">
      <div class="provider-child-form-fields">
        <label class="provider-field"><span>配置名称</span><input name="childName" aria-label="子配置名称" required maxlength="30" value="${esc(draft.name)}" placeholder="例如：图片备用配置" ${draft.saving ? 'disabled' : ''} /></label>
        <label class="provider-field"><span>默认模型类型</span><select name="childKind" aria-label="子配置默认模型类型" ${draft.saving ? 'disabled' : ''}>${Object.entries(BUILTIN_CONFIG_LABELS).map(([kind, label]) => `<option value="${kind}" ${draft.kind === kind ? 'selected' : ''}>${label.replace('配置', '')}</option>`).join('')}</select></label>
      </div>
      <p class="provider-child-hint">沿用 CanvasFlow 的接口地址，API Key 和模型列表单独配置。</p>
      ${draft.error ? `<p class="provider-child-error" role="alert">${esc(draft.error)}</p>` : ''}
      <div class="provider-child-form-actions"><button class="provider-ghost-btn" type="button" data-provider-child-cancel ${draft.saving ? 'disabled' : ''}>取消</button><button class="provider-action-btn" type="submit" ${draft.saving ? 'disabled' : ''}>${draft.saving ? '正在添加…' : '添加子配置'}</button></div>
    </form>`;
  }

  function bindBuiltInChildForm(box) {
    box.querySelector('[data-provider-add-child]')?.addEventListener('click', () => {
      builtInProviderExpanded = true;
      builtInChildDraft ||= { name: '', kind: 'text', error: '', saving: false };
      renderPane();
      requestAnimationFrame(() => $id('providerListBox')?.querySelector('[name="childName"]')?.focus());
    });
    const form = box.querySelector('[data-provider-child-form]');
    if (!form) return;
    form.elements.childName.addEventListener('input', event => { builtInChildDraft.name = event.target.value; });
    form.elements.childKind.addEventListener('change', event => { builtInChildDraft.kind = event.target.value; });
    form.querySelector('[data-provider-child-cancel]')?.addEventListener('click', () => {
      builtInChildDraft = null;
      renderPane();
    });
    form.addEventListener('submit', event => { event.preventDefault(); saveBuiltInChild(); });
  }

  async function saveBuiltInChild() {
    const draft = builtInChildDraft;
    if (!draft || draft.saving) return;
    const name = draft.name.trim();
    if (!name) { draft.error = '请输入配置名称'; renderPane(); return; }
    draft.saving = true;
    draft.error = '';
    renderPane();
    try {
      const result = await providerApi('/api/admin/ai-providers', {
        method: 'POST', throwOnError: true, body: JSON.stringify({ provider: name, providerGroup: 'canvasflow',
          configKind: draft.kind, baseUrl: 'https://ai.zzzapi.xyz', docsUrl: 'https://ai.zzzapi.xyz',
          protocol: 'openai', authMode: 'bearer' })
      });
      if (!result?.provider || result.error) throw new Error(result?.message || '添加失败，请重试');
      builtInChildDraft = null;
      builtInProviderExpanded = true;
      providerCache = null;
      expandedProviders.add(providerBucket(result.provider));
      toast('子配置已添加，请填写 API Key 并添加模型', '✓');
    } catch (error) {
      draft.saving = false;
      draft.error = error.message || '添加失败，请重试';
    }
    renderPane();
  }

  function providerFieldValue(group, field) {
    if (field === 'provider') return group.name;
    if (group[field] !== undefined && group[field] !== null) return group[field];
    return (group.models[0] || {})[field] ?? '';
  }

  function providerLetter(group) {
    return esc(String(group.name || '?').trim().slice(0, 1).toUpperCase() || '?');
  }

  function providerLogoHtml(group, extraClass) {
    const cls = `provider-logo${extraClass ? ` ${extraClass}` : ''}`;
    if (isCanvasFlowProvider(group)) return `<span class="${cls} provider-logo--brand"><span class="brand-orb" role="img" aria-label="CanvasFlow Logo"></span></span>`;
    if (group.logoUrl) return `<span class="${cls}"><img src="${esc(group.logoUrl)}" alt="" /></span>`;
    return `<span class="${cls}">${providerLetter(group)}</span>`;
  }

  function apiKeyPlaceholder(group) {
    const first = keyInheritSource(group) || {};
    return first.apiKeySet
      ? `已设置 ${first.apiKeyHint || ''}，留空表示不修改`.trim()
      : '输入供应商提供的密钥';
  }

  function renderSelectOptions(options, current) {
    return (options || []).map(option => `<option value="${esc(option.value)}" ${String(current) === String(option.value) ? 'selected' : ''}>${esc(option.label)}</option>`).join('');
  }

  function renderProviderField(group, field, options) {
    const config = options || {};
    // value 可显式覆盖：任务模式这类字段「空」要显示成实际生效的默认值，不能显示成空选项。
    const value = config.value !== undefined ? config.value : providerFieldValue(group, field);
    const control = config.tag === 'select'
      ? `<select class="provider-select" data-provider-field="${field}">${renderSelectOptions(config.options || [], value)}</select>`
      : `<input type="${config.type || 'text'}" data-provider-field="${field}" value="${esc(value)}" placeholder="${esc(config.placeholder || '')}" autocomplete="off" spellcheck="false" ${config.readonly ? 'readonly' : ''} />`;
    return `<label class="provider-field${config.wide ? ' provider-field--wide' : ''}">
      <span class="${config.iconName ? 'provider-field-icon' : ''}">${config.iconName ? svgIcon(config.iconName) : ''}${esc(config.label)}</span>
      ${control}
      ${config.hint ? `<small class="provider-field-hint">${esc(config.hint)}</small>` : ''}
    </label>`;
  }



  function renderProviderTaskCard(group, kind) {
    const isImage = kind === 'image';
    const modeField = isImage ? 'imageTaskMode' : 'videoTaskMode';
    const fallback = isImage ? 'sync' : 'async';
    const mode = providerFieldValue(group, modeField) || fallback;
    const async = mode === 'async';
    return `<div class="provider-endpoint-card">
      <div class="provider-endpoint-card__title">${isImage ? '图片任务' : '视频任务'}</div>
      ${renderProviderField(group, modeField, { label: '任务模式', tag: 'select', options: TASK_MODE_OPTIONS, value: mode })}
      ${renderProviderField(group, isImage ? 'imageSubmitPath' : 'submitPath', {
        label: '提交接口', placeholder: isImage ? ENDPOINT_PLACEHOLDER.imageSubmitPath : ENDPOINT_PLACEHOLDER.submitPath })}
      ${isImage ? renderProviderField(group, 'imageEditPath', { label: '编辑接口（有参考图）', placeholder: ENDPOINT_PLACEHOLDER.imageEditPath }) : ''}
      ${async ? renderProviderField(group, isImage ? 'imageStatusPath' : 'statusPath', {
        label: '查询接口', placeholder: isImage ? ENDPOINT_PLACEHOLDER.imageStatusPath : ENDPOINT_PLACEHOLDER.statusPath,
        hint: '必须包含 {task_id} 占位符' }) : ''}
      ${async ? renderProviderField(group, isImage ? 'imageCancelPath' : 'videoCancelPath', {
        label: '取消接口（可选）', placeholder: ENDPOINT_PLACEHOLDER.cancelPath }) : ''}
    </div>`;
  }

  function renderProviderReferenceSection(group) {
    const modes = Array.isArray(group.referenceInputModes) ? group.referenceInputModes : [];
    const kinds = Array.isArray(group.fileUploadMediaKinds) ? group.fileUploadMediaKinds : [];
    const uploadOn = modes.includes('file-upload');
    return `<section class="provider-section">
      <header class="provider-section__header"><strong>参考文件</strong><span>勾选供应商支持的方式；一个都不勾等价于只支持 Base64</span></header>
      <div class="provider-reference-grid">
        ${REFERENCE_MODE_OPTIONS.map(option => `<label class="provider-reference ${modes.includes(option.value) ? 'is-selected' : ''}">
          <input type="checkbox" data-provider-reference="${esc(option.value)}" ${modes.includes(option.value) ? 'checked' : ''} />
          <span><b>${esc(option.label)}</b><small>${esc(option.hint)}</small></span>
        </label>`).join('')}
      </div>
      ${uploadOn ? `<div class="provider-upload-config">
        ${renderProviderField(group, 'fileUploadPath', { label: '上传接口', placeholder: '/v1/files/upload' })}
        <fieldset class="provider-upload-kinds">
          <legend>上传文件类型</legend>
          <div class="provider-upload-kind-options">
            ${REFERENCE_KIND_OPTIONS.map(kind => `<label class="${kinds.includes(kind.value) ? 'is-selected' : ''}">
              <input type="checkbox" data-provider-upload-kind="${esc(kind.value)}" ${kinds.includes(kind.value) ? 'checked' : ''} />
              <span>${esc(kind.label)}</span>
            </label>`).join('')}
          </div>
        </fieldset>
      </div>` : ''}
    </section>`;
  }

  function renderProviderCard(group) {
    const isOpen = expandedProviders.has(group.key);
    return `<article class="provider-card ${isOpen ? 'is-expanded' : ''}" data-provider-key="${esc(group.key)}">
      <div class="provider-card-header">
        <button class="provider-card-head" type="button" data-provider-toggle="${esc(group.key)}" aria-expanded="${isOpen ? 'true' : 'false'}">
          <span class="provider-expand-icon">${svgIcon('caret')}</span>
          ${providerLogoHtml(group, 'provider-logo--header')}
          <span class="provider-head-copy">
            ${renamingKey === group.key
              ? `<input class="provider-rename-input" type="text" value="${esc(group.name)}" data-provider-rename="${esc(group.key)}" aria-label="供应商名称" />`
              : `<span class="provider-title">${esc(BUILTIN_CONFIG_LABELS[group.builtInKind] || group.name)}</span>`}
            <span class="provider-subtitle" data-provider-subtitle="${esc(group.key)}">${esc(group.baseUrl || '未填写接口地址')}</span>
          </span>
        </button>
        <span class="provider-card-actions">
          ${group.builtIn ? '<span class="provider-builtin-badge" title="内置供应商不可删除">内置</span>'
            : `<button class="provider-icon-btn" type="button" title="重命名" aria-label="重命名" data-provider-rename-start="${esc(group.key)}">${svgIcon('pencil', 15)}</button>`}
          <button class="provider-icon-btn" type="button" title="复制为新配置" aria-label="复制为新配置" data-provider-copy="${esc(group.key)}">${svgIcon('copy', 15)}</button>
          ${group.builtIn ? '' : `<button class="provider-icon-btn is-danger" type="button" title="删除此供应商" aria-label="删除此供应商" data-provider-delete="${esc(group.key)}">${svgIcon('trash', 15)}</button>`}
        </span>
      </div>
      ${isOpen ? renderProviderBody(group) : ''}
    </article>`;
  }

  function renderProviderBody(group) {
    const remote = remoteCandidates.get(group.key) || null;
    const logo = logoState.get(group.key) || {};
    const preset = providerFieldValue(group, 'imageTransport');
    return `<div class="provider-card-body">
      ${isCanvasFlowProvider(group) ? '' : `<div class="provider-logo-editor">
        ${providerLogoHtml(group, '')}
        <div class="provider-logo-editor__actions">
          <label class="provider-logo-upload">${svgIcon('upload')}<span>${logo.busy ? '上传中' : (group.logoUrl ? '替换 LOGO' : '上传 LOGO')}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" data-provider-logo="${esc(group.key)}" ${logo.busy ? 'disabled' : ''} />
          </label>
          ${group.logoUrl ? `<button class="provider-ghost-btn" type="button" data-provider-logo-remove="${esc(group.key)}">删除</button>` : ''}
          ${logo.error ? `<small class="provider-logo-error">${esc(logo.error)}</small>` : ''}
        </div>
      </div>`}
      <div class="provider-config-stack">
        <section class="provider-section">
          <header class="provider-section__header"><strong>连接信息</strong><span>供应商的 API 地址和访问凭证</span></header>
          <div class="provider-section-grid">
            ${renderProviderField(group, 'baseUrl', { label: 'BaseURL', iconName: 'globe', placeholder: 'https://api.example.com/v1', readonly: isCanvasFlowProvider(group) })}
            ${renderProviderField(group, 'apiKey', { label: 'API Key', iconName: 'key', type: 'password', placeholder: apiKeyPlaceholder(group) })}
            ${renderProviderField(group, 'authMode', { label: '鉴权方式', tag: 'select', options: AUTH_MODE_OPTIONS })}
            ${renderProviderField(group, 'docsUrl', { label: '供应商网址', iconName: 'globe', type: 'url', placeholder: 'https://provider.example', readonly: isCanvasFlowProvider(group) })}
          </div>
        </section>
        <section class="provider-section">
          <header class="provider-section__header"><strong>协议兼容</strong><span>不确定时保持默认</span></header>
          <div class="provider-section-grid">
            ${renderProviderField(group, 'protocol', { label: '请求协议', tag: 'select', options: PROTOCOL_OPTIONS })}
            ${renderProviderField(group, 'textProtocol', { label: '文本协议', tag: 'select', options: TEXT_PROTOCOL_OPTIONS })}
            ${renderProviderField(group, 'providerProfile', { label: '兼容方言', tag: 'select', options: PROVIDER_PROFILE_OPTIONS })}
            ${renderProviderField(group, 'imageTransport', { label: '图片传输合同', tag: 'select', options: IMAGE_TRANSPORT_OPTIONS })}
          </div>
        </section>
        <section class="provider-section">
          <header class="provider-section__header"><strong>生成端点</strong><span>按当前 Provider 统一配置图片和视频的提交、查询地址；未填写时继续使用兼容默认值。</span></header>
          <details class="provider-endpoint-advanced" ${endpointAdvancedOpen.has(group.key) ? 'open' : ''}>
            <summary>高级端点覆盖（可选）</summary>
            <div class="provider-endpoint-grid">
              ${renderProviderTaskCard(group, 'image')}
              ${renderProviderTaskCard(group, 'video')}
            </div>
          </details>
        </section>
        <section class="provider-section">
          <header class="provider-section__header"><strong>图片/视频兼容预设</strong><span>普通供应商直接选择预设；只有文档无法匹配时才展开高级覆盖。</span></header>
          <label class="provider-field provider-field--preset">
            <span>兼容预设</span>
            <select class="provider-select" data-provider-preset>
              ${renderSelectOptions(MEDIA_PRESET_OPTIONS, presetForTransport(preset))}
            </select>
            <small class="provider-field-hint" data-provider-preset-hint>${esc(presetHint(presetForTransport(preset)))}</small>
          </label>
        </section>
        ${renderProviderReferenceSection(group)}
      </div>
      <div class="provider-card-actions-row">
        <button class="provider-action-btn" type="button" data-provider-test="${esc(group.key)}">测试连接</button>
        <button class="provider-action-btn is-primary" type="button" data-provider-fetch="${esc(group.key)}" ${remote?.loading ? 'disabled' : ''}>${remote?.loading ? '获取中…' : '拉取模型列表'}</button>
        <button class="provider-action-btn" type="button" data-provider-deep-test="${esc(group.key)}" title="真实调用各条链路做最小实测，会产生少量费用">实测链路</button>
        ${group.docsUrl ? `<a class="provider-docs-link" href="${esc(group.docsUrl)}" target="_blank" rel="noreferrer">获取 API 凭证 ↗</a>` : ''}
      </div>
      <div class="provider-test-result" data-test-result="${esc(group.key)}"></div>
      ${remote?.notice ? `<div class="provider-fetch-notice ${remote.notice.ok ? 'is-ok' : 'is-fail'}" role="status" aria-live="polite">${svgIcon(remote.notice.ok ? 'check' : 'alert', 14)}<span>${esc(remote.notice.text)}</span></div>` : ''}
      ${renderProviderTimeoutSection(group)}
      ${renderProviderModels(group, remote)}
    </div>`;
  }





  const MODEL_USAGE_OPTIONS = [
    { value: 'text', label: '语言', title: '设为语言模型', kind: 'i2t' },
    { value: 'image', label: '图像', title: '设为图像模型', kind: 't2i' },
    { value: 'video', label: '视频', title: '设为视频模型', kind: 'video' },
    { value: 'audio', label: '音频', title: '设为音频模型', kind: 'tts' }
  ];
  const MODEL_FILTERS = [
    { value: 'all', label: '全部' }, { value: 'enabled', label: '已选' },
    ...MODEL_USAGE_OPTIONS.map(option => ({ value: option.value, label: option.label }))
  ];
  const MODEL_USAGE_TITLES = { text: '语言模型', image: '图片模型', video: '视频模型', audio: '音频模型' };
  const MODEL_ASPECT_VALUES = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
  const MODEL_IMAGE_RESOLUTIONS = ['1024x1024', '1024x1536', '1536x1024'];
  const MODEL_VIDEO_RESOLUTIONS = ['480P', '720P', '768P', '1080P', '4K'];
  const MODEL_VIDEO_MODES = [{ value: 'text-to-video', label: '文生视频' }, { value: 'image-to-video', label: '图生视频' }];
  // ★ r872：时长档位从固定 4 项扩成 1~30 秒全档 —— 接入的模型区间差异很大
  //   （Grok 1~15 / 快乐马 3~15 / 万相3.0 与 Seedance2.5 2~30 / vo3.1 固定 8），
  //   只给 4 项会让「最短/最长」根本表达不出真实区间。
  const MODEL_DURATIONS = Array.from({ length: 30 }, (_, i) => `${i + 1} 秒`);
  const MODEL_QUALITIES = [{ value: 'low', label: '低画质' }, { value: 'standard', label: '标准画质' }, { value: 'high', label: '高画质' }];
  const MODEL_COUNTS = ['1', '2', '3', '4'];
  // 「可用档位」chips 的可选集：与 MODEL_DURATIONS 同源，但数值形态（1~30）。
  const MODEL_DURATION_STEP_VALUES = Array.from({ length: 30 }, (_, i) => String(i + 1));
  const parseDurationStepList = raw => String(raw || '').split(/[,，\s]+/).map(t => t.replace(/[^\d]/g, '')).filter(Boolean);
  // ★ r872：计费方式必须与 server.py 的 `BILLING_MODES` 一致。
  //   「按次 / 按 Token / 按秒」在成本上差一个量级（视频尤其：按秒 = 时长×单价），
  //   以前这个字段**只能显示、不能改**（服务端注释写了"管理员可在面板里改"但没建）→
  //   结果只能手改 JSON，一改批量脚本就把 `per-call` 覆盖回去（本项目刚踩过）。
  const BILLING_MODES = ['per-call', 'per-token', 'per-second'];
  const BILLING_LABEL_OPTIONS = [['per-call', '按次'], ['per-token', '按 Token'], ['per-second', '按秒']];

  const MODEL_PARAM_FIELDS = {
    text: [{ key: 'multimodal', kind: 'check', label: '多模态' }],
    image: [
      { key: 'transport', kind: 'select', label: '图片传输覆盖', inherit: '继承 Provider',
        options: IMAGE_TRANSPORT_OPTIONS.filter(option => option.value).map(option => ({ value: option.value, label: option.label })) },
      { key: 'aspectRatio', kind: 'select', label: '默认比例', options: MODEL_ASPECT_VALUES },
      { key: 'resolution', kind: 'select', label: '默认分辨率', options: MODEL_IMAGE_RESOLUTIONS },
      { key: 'quality', kind: 'select', label: '默认质量', options: MODEL_QUALITIES },
      { key: 'count', kind: 'select', label: '默认数量', options: MODEL_COUNTS }
    ],
    video: [
      { key: 'minDuration', kind: 'select', label: '最短时长', options: MODEL_DURATIONS },
      { key: 'maxDuration', kind: 'select', label: '最长时长', options: MODEL_DURATIONS },
      // ★ r872：上游只认固定档的模型（vo3.1 只认 8s、即梦3.5Pro 只认 4/8/12）在这里勾。
      //   勾了 → 画布规格面板显示**档位按钮**且滑杆只吸附到这些值（防「面板 7s、成片 8s」）。
      //   不勾 → 沿用滑杆（最短~最长区间），适合上游接受任意秒数的模型。
      { key: 'durationSteps', kind: 'durationOption', label: '可用档位', hint: '勾选 = 该模型只认这几个秒数（画布会锁档）；不勾 = 用上面区间自由拖' },
      { key: 'aspectRatio', kind: 'select', label: '默认比例', options: MODEL_ASPECT_VALUES },
      { key: 'resolution', kind: 'select', label: '默认分辨率', options: MODEL_VIDEO_RESOLUTIONS },
      { key: 'mode', kind: 'select', label: '默认模式', options: MODEL_VIDEO_MODES },
      { key: 'duration', kind: 'select', label: '默认时长', options: MODEL_DURATIONS }
    ],
    audio: [{ key: 'requestProfile', kind: 'choice', label: '请求形态', options: REQUEST_PROFILE_OPTIONS }]
  };

  // 用途集合：后端下发 usages；老记录没有这个字段时按单一 type 反推（与后端同一套映射）。
  function modelUsages(model) {
    const raw = Array.isArray(model?.usages) ? model.usages : [];
    const picked = MODEL_USAGE_OPTIONS.map(option => option.value).filter(value => raw.includes(value));
    if (picked.length) return picked;
    const legacy = MODEL_USAGE_OPTIONS.find(option => option.kind === model?.type);
    return legacy ? [legacy.value] : ['text'];
  }

  function modelKindLabel(model) {
    const first = modelUsages(model)[0];
    return MODEL_USAGE_OPTIONS.find(option => option.value === first)?.label || '语言';
  }

  function modelMatchesFilter(model, filter) {
    if (filter === 'enabled') return Boolean(model.enabled);
    if (MODEL_USAGE_OPTIONS.some(option => option.value === filter)) return modelUsages(model).includes(filter);
    return true;
  }

  function filteredProviderModels(group) {
    const query = modelQuery.trim().toLowerCase();
    return (group.models || []).filter(model => {
      if (!modelMatchesFilter(model, modelFilter)) return false;
      if (!query) return true;
      return String(model.model || '').toLowerCase().includes(query) || String(model.name || '').toLowerCase().includes(query);
    });
  }

  // 全局生成超时（通用设置里的那份）—— 带缓存，避免每次展开卡片都打一次接口。
  // ★ 不读 appSettings：那个变量只在「通用设置」标签页渲染时才被赋值，
  //   而在它被赋值之前打开供应商面板是很正常的使用顺序。
  let globalTimeoutsCache = null;
  async function loadGlobalTimeouts() {
    if (globalTimeoutsCache) return globalTimeoutsCache;
    try {
      const data = await deps.api('/api/settings');
      const t = data?.settings?.timeouts;
      if (t && typeof t === 'object') globalTimeoutsCache = t;
    } catch { /* 读不到就返回空，调用方自己兜底 */ }
    return globalTimeoutsCache || {};
  }









  function providerTimeoutOverrides(group) {
    const raw = group?.generationTimeouts;
    if (!raw || typeof raw !== 'object') return null;
    return Object.keys(raw).length ? raw : null;
  }

  function renderProviderTimeoutSection(group) {
    const overrides = providerTimeoutOverrides(group);
    const on = Boolean(overrides);
    // 全局值作为输入框的兜底显示（不填就跟随这个值）。
    // ★ 用同步缓存；缓存为空时输入框会显示空串而不是一个假的 60 ——
    //   「显示空」诚实地表达「我还不知道全局值」，比编一个数字好。
    const globals = globalTimeoutsCache || {};
    const rows = on ? `<div class="provider-timeout-grid">
      ${TIMEOUT_FIELD_DEFS.map(field => {
        const raw = overrides?.[field.key] ?? globals[field.key];
        const shown = raw == null || !Number.isFinite(Number(raw)) ? '' : Math.round(Number(raw) / field.divisor);
        return `<label class="provider-timeout-field">
          <span>${esc(field.label)}</span>
          <span class="provider-timeout-input-wrap">
            <input type="number" min="1" inputmode="numeric" value="${esc(String(shown))}"
              data-provider-timeout="${esc(field.key)}" aria-label="${esc(field.label)}" />
            <small>${esc(field.unit)}</small>
          </span>
        </label>`;
      }).join('')}
    </div>` : '';
    return `<div class="provider-timeout-settings">
      <div class="provider-timeout-header">
        <div>
          <div class="provider-timeout-label">独立生成超时</div>
          <div class="provider-timeout-desc">覆盖通用设置中的生成超时。</div>
        </div>
        <label class="provider-switch">
          <input type="checkbox" data-provider-timeout-switch ${on ? 'checked' : ''} aria-label="独立生成超时" />
          <span class="provider-switch-slider"></span>
        </label>
      </div>
      ${rows}
    </div>`;
  }

  function renderProviderModels(group, remote) {
    const enabledCount = group.models.filter(model => model.enabled).length;
    const draft = modelDraft && modelDraft.group === group ? modelDraft : null;
    // ★★ 「未开通」的数量必须在这里**按 remote 现算** —— 不要引用 `fetchProviderModels` 里的局部变量：
    //    那是另一个函数，作用域不通 → `ReferenceError: unavailableCount is not defined`
    //    整个模型区渲染中断（本轮实测踩到，验证脚本当场抓到）。
    const unavailableCount = remote
      ? (remote.list || []).filter(id => (remote.meta || {})[id]?.available === false).length : 0;
    const candidateIds = filteredRemoteCandidates(remote);
    const addableCount = remoteCandidateTargets(group, remote).length;
    return `<div class="provider-models-section">
      <div class="provider-models-header">
        <span>可用模型列表 (${enabledCount}/${group.models.length} 个)</span>
        <div class="provider-models-actions">
          <button type="button" data-models-all="${esc(group.key)}">全选</button>
          <span>|</span>
          <button type="button" data-models-none="${esc(group.key)}">清空</button>
          <span>|</span>
          <button type="button" class="is-danger" data-models-purge="${esc(group.key)}"
            title="删除本供应商下的全部模型，保留供应商连接信息" ${group.models.length ? '' : 'disabled'}>删除全部</button>
        </div>
      </div>
      <div class="provider-model-filters">
        <div class="provider-model-filter-chips">
          ${MODEL_FILTERS.map(item => `<button type="button" class="provider-model-filter ${modelFilter === item.value ? 'is-active' : ''}" data-model-filter="${esc(item.value)}" aria-pressed="${modelFilter === item.value}">${esc(item.label)}</button>`).join('')}
        </div>
        <label class="provider-model-search">
          <span class="provider-model-search__icon">${svgIcon('search', 14)}</span>
          <input type="search" placeholder="搜索模型 ID 或别名" aria-label="搜索模型 ID 或别名" value="${esc(modelQuery)}" data-model-search />
        </label>
      </div>
      ${renderSelectedModelPills(group)}
      <div class="provider-model-grid" data-model-grid>${renderModelGrid(group)}</div>
      ${draft ? `<div class="provider-model-draft">
        <input type="text" data-draft-model value="${esc(draft.model)}" placeholder="模型标识，如 gpt-image-1" />
        <input type="text" data-draft-name value="${esc(draft.name)}" placeholder="显示名称（可选）" />
        <select data-draft-kind>${MODEL_KIND_OPTIONS.map(option => `<option value="${esc(option.value)}" ${draft.type === option.value ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}</select>
        <button class="provider-action-btn is-primary" type="button" data-model-draft-save>添加</button>
        <button class="provider-ghost-btn" type="button" data-model-draft-cancel>取消</button>
      </div>` : ''}
      <div class="provider-models-footer">
        <button class="provider-ghost-btn" type="button" data-model-add="${esc(group.key)}" ${draft ? 'disabled' : ''}>＋ 添加模型</button>
      </div>
      ${remote?.error ? `<div class="provider-fetch-error">${esc(remote.error)}</div>` : ''}
      ${remote?.list?.length ? `<div class="provider-fetch-result">
        <div class="provider-fetch-head">
          <span>拉取到 ${remote.list.length} 个模型，点一下加入本供应商：</span>
          ${unavailableCount ? `<button class="provider-ghost-btn" type="button" data-models-toggle-unavailable="${esc(group.key)}">${remote.showAll ? '只看已开通' : `显示未开通的 ${unavailableCount} 个`}</button>` : ''}
          <button class="provider-ghost-btn" type="button" data-models-add-all="${esc(group.key)}" ${addableCount ? '' : 'disabled'}>添加筛选结果 (${addableCount})</button>
        </div>
        <div class="provider-remote-filters">
          <label>模型类型<select data-remote-kind aria-label="筛选拉取模型类型"><option value="all">全部类型</option>${MODEL_KIND_OPTIONS.map(kind => `<option value="${esc(kind.value)}" ${remote.filterKind === kind.value ? 'selected' : ''}>${esc(kind.label)}</option>`).join('')}</select></label>
          <label class="provider-remote-search">搜索模型<input type="search" data-remote-search aria-label="搜索拉取模型名称" placeholder="搜索模型 ID 或名称" value="${esc(remote.query || '')}" /></label>
          <span data-remote-count role="status">匹配 ${candidateIds.length} / ${remote.list.length} 个</span>
        </div>
        <div class="provider-fetch-chips">${renderRemoteCandidateChips(remote)}</div>
      </div>` : ''}
    </div>`;
  }

  function filteredRemoteCandidates(remote) {
    if (!remote) return [];
    const query = String(remote.query || '').trim().toLowerCase();
    return (remote.list || []).filter(id => {
      const entry = remote.meta?.[id] || {};
      return (remote.showAll || entry.available !== false)
        && (!remote.filterKind || remote.filterKind === 'all' || candidateKind(entry, id) === remote.filterKind)
        && (!query || `${id} ${entry.name || ''}`.toLowerCase().includes(query));
    });
  }

  function remoteCandidateTargets(group, remote) {
    const known = new Set((group?.models || []).map(model => String(model.model || '')));
    return filteredRemoteCandidates(remote).filter(id => !known.has(id) && remote.meta?.[id]?.available !== false);
  }

  function renderRemoteCandidateChips(remote) {
    const ids = filteredRemoteCandidates(remote);
    if (!ids.length) return '<span class="provider-field-hint">没有匹配的模型，请调整类型或搜索词。</span>';
    return ids.slice(0, 60).map(id => {
      const item = remote.meta?.[id] || {};
      const unavailable = item.available === false;
      const kind = KIND_LABEL[candidateKind(item, id)] || '';
      const title = [item.name && item.name !== id ? item.name : '', unavailable ? '该模型未在你的供应商账号里开通' : ''].filter(Boolean).join(' · ');
      return `<button class="provider-chip${unavailable ? ' is-unavailable' : ''}" type="button" data-model-candidate="${esc(id)}"${title ? ` title="${esc(title)}"` : ''}>${esc(id)}${kind ? `<i>${kind}</i>` : ''}${billingBadge(item.billing)}${unavailable ? '<em>未开通</em>' : ''}</button>`;
    }).join('') + (ids.length > 60 ? '<span class="provider-field-hint">仅显示前 60 个匹配模型；批量添加包含全部筛选结果。</span>' : '');
  }

  function bindRemoteCandidateButtons(card, group) {
    card.querySelectorAll('[data-model-candidate]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.modelCandidate;
        const entry = remoteCandidates.get(group.key)?.meta?.[id] || {};
        modelDraft = { group, model: id, name: entry.name && entry.name !== id ? entry.name : '', type: candidateKind(entry, id) };
        renderPane();
      });
    });
  }

  function refreshRemoteCandidateArea(card, group) {
    const remote = remoteCandidates.get(group.key);
    const area = card.querySelector('.provider-fetch-result');
    if (!remote || !area) return;
    const ids = filteredRemoteCandidates(remote), targets = remoteCandidateTargets(group, remote);
    area.querySelector('.provider-fetch-chips').innerHTML = renderRemoteCandidateChips(remote);
    area.querySelector('[data-remote-count]').textContent = `匹配 ${ids.length} / ${remote.list.length} 个`;
    const add = area.querySelector('[data-models-add-all]');
    add.textContent = `添加筛选结果 (${targets.length})`;
    add.disabled = !targets.length;
    bindRemoteCandidateButtons(area, group);
  }


  function renderSelectedModelPills(group) {
    const picked = (group.models || []).filter(model => model.enabled);
    if (!picked.length) return '';
    return `<div class="provider-selected-models">
      <span class="provider-selected-models__title">已选模型 (${picked.length})</span>
      <div class="provider-selected-models__pills">
        ${picked.map(model => `<button type="button" class="provider-selected-pill" data-model-pill="${esc(model.id)}" title="取消选择 ${esc(model.name || model.model || '')}"><span class="provider-selected-pill__check">${svgIcon('check', 12)}</span>${esc(model.name || model.model || '未命名模型')}<i>×</i></button>`).join('')}
      </div>
    </div>`;
  }

  function renderModelGrid(group) {
    if (!group.models.length) return '<div class="settings-empty">还没有模型。点「拉取模型列表」从供应商读取，或「添加模型」手动填一个。</div>';
    const models = filteredProviderModels(group);
    if (!models.length) return `<div class="settings-empty">${modelQuery.trim() ? '没有匹配的模型' : '当前筛选下没有模型'}</div>`;
    return models.map(renderProviderModelCard).join('');
  }

  function renderProviderModelCard(model) {
    const hint = model.apiKeySet ? `密钥已设置 ${esc(model.apiKeyHint || '')}` : '未设置密钥';
    const usages = modelUsages(model);
    const profile = REQUEST_PROFILE_OPTIONS.some(option => option.value === model.requestProfile) ? (model.requestProfile || 'auto') : 'auto';
    return `<div class="provider-model-card ${model.enabled ? 'is-checked' : ''}" data-model-id="${esc(model.id)}">
      <label class="provider-model-check" title="${model.enabled ? '取消选择' : '选择'}">
        <input type="checkbox" ${model.enabled ? 'checked' : ''} data-model-check="${esc(model.id)}" aria-label="${esc(model.name || model.model || '模型')} 启用" />
        <span class="provider-model-check-box">${svgIcon('check', 11)}</span>
      </label>
      <span class="provider-model-name">
        ${renamingModelId === model.id
          ? `<input class="provider-model-rename-input" type="text" value="${esc(model.name || '')}" data-model-rename-input="${esc(model.id)}" placeholder="${esc(model.model || '显示名称')}" aria-label="模型显示名称" />`
          : `<span class="provider-model-title"><strong>${esc(model.name || model.model || '未命名模型')}</strong><button type="button" class="provider-model-rename" data-model-rename="${esc(model.id)}" title="重命名显示名称" aria-label="重命名显示名称">${svgIcon('pencil', 12)}</button></span>`}
      </span>
      <span class="provider-model-usages">
        ${MODEL_USAGE_OPTIONS.map(option => `<button type="button" class="provider-model-usage ${usages.includes(option.value) ? 'is-active' : ''}" data-model-usage="${esc(model.id)}" data-usage="${esc(option.value)}" aria-pressed="${usages.includes(option.value)}" title="${esc(option.title)}">${esc(option.label)}</button>`).join('')}
      </span>
      <button type="button" class="provider-model-params" data-model-params="${esc(model.id)}" title="参数能力" aria-label="${esc(model.model || '模型')} 参数能力">${svgIcon('sliders', 15)}</button>
      <!-- ★ r889 用户反馈「这个显示有问题」：副标题以前塞在 165px 的名字列里，
           「video-enhance · 密钥已设置 ****abcd」永远只显示到「密钥已设置 …」（蒙版尾号看不见）；
           同时底部三个控件靠 grid 自动排布，「计费方式」下拉被塞进 13px 的复选框列（实测 42px 宽，
           选项文字全挤成一团、基本点不中）。现在**副标题与底部控件各占一整行**。 -->
      <small class="provider-model-sub">${esc(model.model || '—')} · ${hint}${billingBadge(model.billing)}</small>
      <div class="provider-model-controls">
        <select class="provider-select provider-model-billing" data-model-billing="${esc(model.id)}" aria-label="${esc(model.model || '模型')} 计费方式" title="计费方式：按次 / 按 Token / 按秒">${BILLING_MODES.map(value => `<option value="${esc(value)}" ${String(model.billing || 'per-call') === value ? 'selected' : ''}>${esc(BILLING_LABEL[value] || value)}</option>`).join('')}</select>
        <select class="provider-select provider-model-profile" data-model-profile="${esc(model.id)}" aria-label="${esc(model.model || '模型')} 请求形态">${REQUEST_PROFILE_OPTIONS.map(option => `<option value="${esc(option.value)}" ${profile === option.value ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}</select>
        <button class="provider-model-btn is-danger" type="button" title="删除模型" data-model-delete="${esc(model.id)}">${svgIcon('close')}</button>
      </div>
    </div>`;
  }

  // 搜索/筛选只重绘网格与胶囊 —— 整块 renderPane 会把搜索框里的光标踢掉。
  function refreshModelArea(card, group) {
    const grid = card.querySelector('[data-model-grid]');
    if (grid) grid.innerHTML = renderModelGrid(group);
    const section = card.querySelector('.provider-models-section');
    const pills = card.querySelector('.provider-selected-models');
    const nextPills = renderSelectedModelPills(group);
    if (pills && !nextPills) pills.remove();
    else if (pills) pills.outerHTML = nextPills;
    else if (nextPills && section) section.querySelector('.provider-model-filters').insertAdjacentHTML('afterend', nextPills);
    bindModelGrid(card, group);
  }

  function bindModelArea(card, group) {
    card.querySelectorAll('[data-model-filter]').forEach(button => {
      button.addEventListener('click', () => {
        modelFilter = button.dataset.modelFilter || 'all';
        renderPane();
      });
    });
    const search = card.querySelector('[data-model-search]');
    if (search) {
      search.addEventListener('input', () => {
        modelQuery = search.value;
        refreshModelArea(card, group);
      });
    }
    card.querySelector('[data-models-all]')?.addEventListener('click', () => setAllModels(group, true));
    card.querySelector('[data-models-none]')?.addEventListener('click', () => setAllModels(group, false));
    card.querySelector('[data-models-purge]')?.addEventListener('click', () => removeAllModels(group));
    card.querySelector('[data-model-add]')?.addEventListener('click', () => {
      modelDraft = { group, model: '', name: '', type: BUILTIN_CONFIG_TYPES[group.builtInKind || group.configKind] || 'i2t' };
      renderPane();
    });
    card.querySelector('[data-model-draft-save]')?.addEventListener('click', () => saveModelDraft());
    card.querySelector('[data-model-draft-cancel]')?.addEventListener('click', () => { modelDraft = null; renderPane(); });
    bindRemoteCandidateButtons(card, group);
    card.querySelector('[data-remote-kind]')?.addEventListener('change', event => {
      const remote = remoteCandidates.get(group.key);
      if (!remote) return;
      remote.filterKind = event.target.value;
      refreshRemoteCandidateArea(card, group);
    });
    card.querySelector('[data-remote-search]')?.addEventListener('input', event => {
      const remote = remoteCandidates.get(group.key);
      if (!remote) return;
      remote.query = event.target.value;
      refreshRemoteCandidateArea(card, group);
    });
    card.querySelector('[data-models-add-all]')?.addEventListener('click', () => addAllCandidates(group));
    card.querySelector('[data-models-toggle-unavailable]')?.addEventListener('click', () => {
      const current = remoteCandidates.get(group.key);
      if (!current) return;
      remoteCandidates.set(group.key, { ...current, showAll: !current.showAll });
      renderPane();
    });
    bindProviderTimeout(card, group);
    bindModelGrid(card, group);
  }

  // 「独立生成超时」的事件绑定。
  // ★ 身份用闭包持有的 group，**不要拿 data-* 反查** —— 供应商卡片改名/改 BaseURL 时
  //   旧属性会指向过期的桶键（本项目在供应商面板上踩过这个坑）。
  // ★ 开关打开时必须立刻填入**当前生效值**（供应商已有覆盖 → 用它；没有 → 落全局值），
  //   否则用户打开开关会看到 6 个空框，而服务端此刻还在用全局值 —— 界面与行为不一致。
  function bindProviderTimeout(card, group) {
    const section = card.querySelector('.provider-timeout-settings');
    if (!section) return;
    const readField = key => section.querySelector(`[data-provider-timeout="${key}"]`);
    const collect = () => {
      const out = {};
      for (const field of TIMEOUT_FIELD_DEFS) {
        const input = readField(field.key);
        if (!input) continue;
        const raw = Number(input.value);
        // 空 / 非正数 = 该项不覆盖（等同于跟随全局），不入库，避免写进 0 或 NaN 把请求打坏。
        if (!Number.isFinite(raw) || raw <= 0) continue;
        out[field.key] = Math.round(raw * field.divisor);
      }
      return out;
    };

    section.querySelector('[data-provider-timeout-switch]')?.addEventListener('change', async event => {
      const on = Boolean(event.target.checked);
      if (!on) {
        // 关掉 = 删掉整个字段（服务端 normalize 会 pop 掉空对象），回落全局超时。
        const ok = await patchProvider(group, { generationTimeouts: {} });
        panelToast(ok ? '已恢复为通用设置的生成超时' : '保存失败', ok ? '✓' : '');
        if (ok) renderPane();
        return;
      }
      // ★ 全局值必须**按需拉**，不能读 appSettings —— 那个变量只在用户
      //   进过「通用设置」标签页时才被赋值（见 renderGeneralPane 里的 appSettings = data.settings）。
      //   直接用它会让「只开过供应商面板」的用户拿到 undefined → 全部回落到写死的兜底值，
      //   于是**开关一打开就把 6 个超时悄悄改成兜底值**，而用户以为在用全局值。
      //   （实测就是这个 bug：全局是 60/120/180/120/3/20，打开后全变 60。）
      const globals = await loadGlobalTimeouts();
      // ★ 一律用 providerTimeoutOverrides（空对象折算成 null），否则「先关再开」时
      //   group 上残留的 {} 会被当成「已有覆盖」，播种逻辑去看空对象什么都不取。
      const current = providerTimeoutOverrides(group);
      const seeded = {};
      for (const field of TIMEOUT_FIELD_DEFS) {
        const base = current?.[field.key] ?? globals[field.key];
        if (!(Number.isFinite(Number(base)) && Number(base) > 0)) { continue; }
        seeded[field.key] = Math.round(Number(base));
      }
      if (!Object.keys(seeded).length) { panelToast('读不到通用超时设置，请稍后重试'); return; }
      const ok = await patchProvider(group, { generationTimeouts: seeded });
      panelToast(ok ? '已启用独立生成超时' : '保存失败', ok ? '✓' : '');
      if (ok) renderPane();
    });

    // 输入框：失焦时保存（不绑 input —— 边打字边发请求会把半个数字写成超时值）。
    section.querySelectorAll('[data-provider-timeout]').forEach(input => {
      input.addEventListener('change', async () => {
        const payload = collect();
        if (!Object.keys(payload).length) {
          panelToast('至少要填一个有效的超时值');
          renderPane();
          return;
        }
        const ok = await patchProvider(group, { generationTimeouts: payload });
        if (ok) panelToast('超时设置已保存', '✓'); else panelToast('保存失败');
      });
    });
  }

  function bindModelGrid(card, group) {
    const grid = card.querySelector('[data-model-grid]') || card;
    grid.querySelectorAll('[data-model-check]').forEach(box => {
      box.addEventListener('change', () => setModelEnabled(box.dataset.modelCheck, box.checked));
    });
    grid.querySelectorAll('[data-model-usage]').forEach(button => {
      button.addEventListener('click', () => {
        const model = (group.models || []).find(item => item.id === button.dataset.modelUsage);
        if (!model) return;
        const usage = button.dataset.usage;
        const current = modelUsages(model);
        const next = current.includes(usage) ? current.filter(value => value !== usage) : [...current, usage];
        if (!next.length) { panelToast('至少保留一个用途', '!'); return; }
        setModelUsages(model.id, next);
      });
    });
    grid.querySelectorAll('[data-model-params]').forEach(button => {
      button.addEventListener('click', () => {
        const model = (group.models || []).find(item => item.id === button.dataset.modelParams);
        if (model) openModelParams(group, model);
      });
    });
    grid.querySelectorAll('[data-model-profile]').forEach(select => {
      select.addEventListener('change', () => setModelProfile(select.dataset.modelProfile, select.value));
    });
    grid.querySelectorAll('[data-model-billing]').forEach(select => {
      select.addEventListener('change', () => setModelBilling(select.dataset.modelBilling, select.value));
    });
    grid.querySelectorAll('[data-model-delete]').forEach(button => {
      button.addEventListener('click', () => removeModel(button.dataset.modelDelete));
    });
    // 模型「显示名称」就地重命名（r794）：用户靠它区分供应商 / 自己的同名模型
    grid.querySelectorAll('[data-model-rename]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        renamingModelId = button.dataset.modelRename;
        renderPane();
        requestAnimationFrame(() => {
          const input = document.querySelector(`[data-model-rename-input="${CSS.escape(renamingModelId)}"]`);
          if (input) { input.focus(); input.select(); }
        });
      });
    });
    grid.querySelectorAll('[data-model-rename-input]').forEach(input => {
      const commit = () => setModelName(input.dataset.modelRenameInput, input.value);
      input.addEventListener('click', event => event.stopPropagation());
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); commit(); }
        else if (event.key === 'Escape') { renamingModelId = ''; renderPane(); }
      });
      input.addEventListener('blur', commit);
    });
    card.querySelectorAll('[data-model-pill]').forEach(button => {
      button.addEventListener('click', () => setModelEnabled(button.dataset.modelPill, false));
    });
  }

  /**
   * 改模型的**显示名称**（r794）。用户明确要求两个供应商面板都能改名 ——
   * 因为「供应商」和「我的」里可能出现同名模型（都叫 agnes-3.0-flash），靠改名区分。
   * ★ 服务端 `normalize_ai_model(incoming, existing)` 用 existing 兜底，所以只传 name 就够。
   */
  async function setModelName(modelId, name) {
    const next = String(name || '').trim();
    // Enter 提交后 blur 还会再触发一次，用状态守卫挡掉第二次（否则会发两个请求）
    if (renamingModelId !== modelId) return;
    renamingModelId = '';
    if (!next) { renderPane(); return; }
    const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(modelId)}`, {
      method: 'PUT', body: JSON.stringify({ name: next }),
    });
    if (!result || result.error) { panelToast(result?.message || '保存失败', '!'); renderPane(); return; }
    providerCache = null;
    panelToast('模型名称已更新', '✓');
    renderPane();
  }

  async function setModelEnabled(modelId, enabled) {
    const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(modelId)}`, {
      method: 'PUT', body: JSON.stringify({ enabled })
    });
    if (!result || result.error) { panelToast(result?.message || '保存失败', '!'); return; }
    providerCache = null;
    renderPane();
  }

  async function setModelUsages(modelId, usages) {
    const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(modelId)}`, {
      method: 'PUT', body: JSON.stringify({ usages })
    });
    if (!result || result.error) { panelToast(result?.message || '保存失败', '!'); return; }
    providerCache = null;
    panelToast('模型用途已更新', '✓');
    renderPane();
  }



  function modelParamValue(model, usage, key) {
    const bucket = model?.modelParams && typeof model.modelParams === 'object' ? model.modelParams[usage] : null;
    return bucket && typeof bucket === 'object' ? (bucket[key] ?? '') : '';
  }

  function renderModelParamsDialog(model) {
    const usages = modelUsages(model);
    const sections = usages.map(usage => {
      const fields = MODEL_PARAM_FIELDS[usage] || [];
      const rows = fields.map(field => {
        if (field.kind === 'check') {
          const checked = Boolean(modelParamValue(model, usage, field.key));
          return `<label class="provider-params-check ${checked ? 'is-checked' : ''}"><input type="checkbox" ${checked ? 'checked' : ''} data-param-field="${esc(field.key)}" data-param-usage="${esc(usage)}" /><span>${esc(field.label)}</span></label>`;
        }
        if (field.kind === 'choice') {
          const value = String(modelParamValue(model, usage, field.key) || 'auto');
          return `<div class="provider-params-row"><span>${esc(field.label)}</span><div class="provider-params-choice" data-param-choice="${esc(field.key)}" data-param-usage="${esc(usage)}">${field.options.map(option => `<button type="button" class="${value === option.value ? 'is-active' : ''}" data-param-choice-value="${esc(option.value)}" aria-pressed="${value === option.value}">${esc(option.label)}</button>`).join('')}</div></div>`;
        }
        // ★ r872「可用档位」：多选 chips（可多选、可全不选）。值以逗号串存进 modelParams。
        if (field.kind === 'durationOption') {
          const picked = new Set(parseDurationStepList(modelParamValue(model, usage, field.key)));
          return `<div class="provider-params-row provider-params-row--block"><span>${esc(field.label)}${field.hint ? `<i class="provider-params-hint" title="${esc(field.hint)}"></i>` : ''}</span><div class="provider-params-chips" data-param-chips="${esc(field.key)}" data-param-usage="${esc(usage)}">${MODEL_DURATION_STEP_VALUES.map(sec => `<button type="button" class="${picked.has(sec) ? 'is-active' : ''}" data-param-chip-value="${sec}" aria-pressed="${picked.has(sec)}">${sec}s</button>`).join('')}</div><div class="provider-params-chipline" data-param-chip-summary="${esc(field.key)}">${picked.size ? `已选 ${Array.from(picked).sort((a, b) => a - b).join(' / ')} 秒` : '未限制（用上面的区间）'}</div></div>`;
        }
        const value = String(modelParamValue(model, usage, field.key) || '');
        const options = [{ value: '', label: field.inherit || '不设置' }, ...field.options.map(option => typeof option === 'string' ? { value: option, label: option } : option)];
        return `<label class="provider-params-row"><span>${esc(field.label)}</span><select class="provider-select" data-param-field="${esc(field.key)}" data-param-usage="${esc(usage)}">${options.map(option => `<option value="${esc(option.value)}" ${value === option.value ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}</select></label>`;
      }).join('');
      return `<section class="provider-params-section"><h3>${esc(MODEL_USAGE_TITLES[usage] || usage)}</h3><div class="provider-params-fields">${rows}</div></section>`;
    }).join('');
    return `<div class="provider-params-layer" data-params-layer>
      <section class="provider-params-dialog" role="dialog" aria-modal="true" aria-labelledby="providerParamsTitle">
        <header>
          <div><strong id="providerParamsTitle">参数能力</strong><span>${esc(model.model || model.name || '')}</span></div>
          <button type="button" title="关闭" aria-label="关闭参数能力" data-params-close>${svgIcon('close', 16)}</button>
        </header>
        <div class="provider-params-body">${sections || '<div class="settings-empty">这个模型还没有勾选用途。</div>'}</div>
        <footer>
          <div class="provider-params-footer-start"></div>
          <div class="provider-params-footer-actions">
            <button class="provider-ghost-btn" type="button" data-params-cancel>取消</button>
            <button class="provider-action-btn is-primary" type="button" data-params-save>保存</button>
          </div>
        </footer>
      </section>
    </div>`;
  }

  function closeModelParams() {
    document.querySelector('[data-params-layer]')?.remove();
    document.removeEventListener('keydown', onModelParamsKeydown);
  }

  function onModelParamsKeydown(event) {
    if (event.key === 'Escape') closeModelParams();
  }

  function readModelParamsDialog(model) {
    const layer = document.querySelector('[data-params-layer]');
    const params = {};
    MODEL_USAGE_OPTIONS.forEach(option => { params[option.value] = {}; });
    layer?.querySelectorAll('[data-param-field]').forEach(field => {
      const usage = field.dataset.paramUsage;
      if (!params[usage]) params[usage] = {};
      params[usage][field.dataset.paramField] = field.type === 'checkbox' ? field.checked : field.value;
    });
    layer?.querySelectorAll('[data-param-choice]').forEach(group => {
      const usage = group.dataset.paramUsage;
      const active = group.querySelector('button.is-active');
      if (!params[usage]) params[usage] = {};
      params[usage][group.dataset.paramChoice] = active ? active.dataset.paramChoiceValue : '';
    });
    // ★ r872：多选 chips → 逗号串（按数值升序，存"8,12,16"这种形态）。
    layer?.querySelectorAll('[data-param-chips]').forEach(group => {
      const usage = group.dataset.paramUsage;
      const picked = Array.from(group.querySelectorAll('button.is-active')).map(b => b.dataset.paramChipValue).filter(Boolean).sort((a, b) => Number(a) - Number(b));
      if (!params[usage]) params[usage] = {};
      params[usage][group.dataset.paramChips] = picked.join(',');
    });
    return params;
  }

  function openModelParams(group, model) {
    closeModelParams();
    document.body.insertAdjacentHTML('beforeend', renderModelParamsDialog(model));
    const layer = document.querySelector('[data-params-layer]');
    if (!layer) return;
    layer.addEventListener('mousedown', event => { if (event.target === layer) closeModelParams(); });
    layer.querySelector('[data-params-close]')?.addEventListener('click', closeModelParams);
    layer.querySelector('[data-params-cancel]')?.addEventListener('click', closeModelParams);
    layer.querySelectorAll('[data-param-choice] button').forEach(button => {
      button.addEventListener('click', () => {
        button.parentElement.querySelectorAll('button').forEach(item => {
          const active = item === button;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });
      });
    });
    // ★ r872：档位 chips 是**多选**（点一下 toggle），并实时刷新下方汇总行。
    layer.querySelectorAll('[data-param-chips]').forEach(group => {
      group.addEventListener('click', event => {
        const chip = event.target.closest('[data-param-chip-value]');
        if (!chip || !group.contains(chip)) return;
        const active = !chip.classList.contains('is-active');
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-pressed', String(active));
        const summary = layer.querySelector(`[data-param-chip-summary="${group.dataset.paramChips}"]`);
        if (summary) {
          const picked = Array.from(group.querySelectorAll('button.is-active')).map(b => b.dataset.paramChipValue).filter(Boolean).sort((a, b) => Number(a) - Number(b));
          summary.textContent = picked.length ? `已选 ${picked.join(' / ')} 秒` : '未限制（用上面的区间）';
        }
      });
    });
    layer.querySelectorAll('.provider-params-check input').forEach(box => {
      box.addEventListener('change', () => box.closest('.provider-params-check')?.classList.toggle('is-checked', box.checked));
    });
    layer.querySelector('[data-params-save]')?.addEventListener('click', async () => {
      const params = readModelParamsDialog(model);
      const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(model.id)}`, {
        method: 'PUT', body: JSON.stringify({ modelParams: params })
      });
      if (!result || result.error) { panelToast(result?.message || '保存失败', '!'); return; }
      closeModelParams();
      providerCache = null;
      panelToast('参数能力已保存', '✓');
      renderPane();
    });
    document.addEventListener('keydown', onModelParamsKeydown);
  }

  async function setModelProfile(modelId, value) {
    const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(modelId)}`, {
      method: 'PUT', body: JSON.stringify({ requestProfile: value === 'auto' ? '' : value })
    });
    if (!result || result.error) { panelToast(result?.message || '保存失败'); return; }
    providerCache = null;
    panelToast('请求形态已更新', '✓');
    renderPane();
  }

  /** ★ r872：计费方式（按次 / 按 Token / 按秒）。
   *  服务端 `normalize_ai_model()` 只认 `BILLING_MODES` 里的值，乱传会被 `infer_billing` 纠正。 */
  async function setModelBilling(modelId, value) {
    if (!BILLING_MODES.includes(value)) return;
    const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(modelId)}`, {
      method: 'PUT', body: JSON.stringify({ billing: value })
    });
    if (!result || result.error) { panelToast(result?.message || '保存失败'); return; }
    providerCache = null;
    panelToast(`计费方式已改为${BILLING_LABEL[value] || value}`, '✓');
    renderPane();
  }

  function findGroup(key) {
    return (providerCache?.items || []).find(group => group.key === key) || null;
  }

  function bindProviderCardEvents() {
    const pane = $id('settingsPane');
    if (!pane) return;

    // 全部按「卡片 → 分组对象」捕获闭包，不去 DOM 的 data-provider-key 反查。
    // 原因：名称/BaseURL/协议是可编辑字段，桶键会随输入变；反查会拿到过期键 → 静默失效。
    pane.querySelectorAll('.provider-card').forEach(card => {
      const group = findGroup(card.dataset.providerKey);
      if (!group) return;

      card.querySelector('[data-provider-toggle]')?.addEventListener('click', () => {
        if (renamingKey) return;            // 正在重命名时点头部不该顺带折叠
        // ★ 折叠**不清**远程候选池：候选池是「这个供应商的上游有什么」的事实快照，
        //   和展开态无关。清掉会出现「删了模型 → 收起 → 展开 → 还得重拉一次」这种别扭路径。
        if (expandedProviders.has(group.key)) expandedProviders.delete(group.key);
        else expandedProviders.add(group.key);
        renderPane();
      });

      card.querySelector('[data-provider-rename-start]')?.addEventListener('click', () => {
        renamingKey = group.key;
        renderPane();
      });
      const renameInput = card.querySelector('[data-provider-rename]');
      if (renameInput) {
        let committed = false;
        const commit = async () => {
          if (committed) return;
          committed = true;
          const next = renameInput.value.trim();
          renamingKey = '';
          if (!next || next === group.name) { renderPane(); return; }
          if (await patchProvider(group, { provider: next })) panelToast('供应商名称已更新', '✓');
          providerCache = null;
          renderPane();
        };
        renameInput.addEventListener('keydown', event => {
          if (event.key === 'Enter') { event.preventDefault(); commit(); }
        });
        renameInput.addEventListener('blur', commit);
        renameInput.focus();
        renameInput.select();
      }

      card.querySelector('[data-provider-copy]')?.addEventListener('click', () => copyProvider(group));
      card.querySelector('[data-provider-delete]')?.addEventListener('click', () => removeProvider(group));

      // 字段改动：600ms 合并一次 PUT，成功前不整块重绘（重绘会把光标从输入框里踢出去）。
      card.querySelectorAll('[data-provider-field]').forEach(el => {
        if (el.readOnly) return;
        const field = el.dataset.providerField;
        // 任务模式单独处理：它要立刻落盘并重绘（查询/取消接口的显隐跟着模式走），不走防抖。
        if (field === 'imageTaskMode' || field === 'videoTaskMode') return;
        const onChange = () => {
          if (field === 'apiKey') {
            // 服务端从不下发密钥，输入框永远是空的；留空代表「不修改」。
            if (!el.value.trim()) return;
            queueProviderPatch(group, { apiKey: el.value.trim() });
            return;
          }
          const value = el.value.trim();
          if (field === 'baseUrl') {
            const subtitle = card.querySelector('[data-provider-subtitle]');
            if (subtitle) subtitle.textContent = value || '未填写接口地址';
        } else if (field === 'imageTransport') {

          const derived = presetForTransport(el.value);
          const presetSelect = card.querySelector('[data-provider-preset]');
          if (presetSelect) presetSelect.value = derived;
          const hint = card.querySelector('[data-provider-preset-hint]');
          if (hint) hint.textContent = presetHint(derived);
        } else if (field === 'docsUrl') {
            group.docsUrl = value;      // 先更新分组状态再同步链接，否则链接拿到的是上一帧的值
            const row = card.querySelector('.provider-card-actions-row');
            if (row) syncDocsLink(row, value);
          }
          if (field !== 'docsUrl') group[field] = value;
          queueProviderPatch(group, { [field]: value });
        };
        el.addEventListener('input', onChange);
        el.addEventListener('change', onChange);
      });

      const advanced = card.querySelector('.provider-endpoint-advanced');
      advanced?.addEventListener('toggle', () => {
        if (advanced.open) endpointAdvancedOpen.add(group.key); else endpointAdvancedOpen.delete(group.key);
      });

      // 任务模式：离散选择 → 立刻落盘 + 重绘（查询接口 / 取消接口只在异步模式出现）
      card.querySelectorAll('[data-provider-field="imageTaskMode"],[data-provider-field="videoTaskMode"]').forEach(select => {
        select.addEventListener('change', async () => {
          if (await patchProvider(group, { [select.dataset.providerField]: select.value })) panelToast('任务模式已更新', '✓');
          renderPane();
        });
      });

      // 参考文件传输方式：勾选后要立刻显示/隐藏「上传接口 + 上传文件类型」
      card.querySelectorAll('[data-provider-reference]').forEach(box => {
        box.addEventListener('change', async () => {
          const picked = new Set(Array.isArray(group.referenceInputModes) ? group.referenceInputModes : []);
          if (box.checked) picked.add(box.dataset.providerReference); else picked.delete(box.dataset.providerReference);
          const next = REFERENCE_MODE_OPTIONS.map(option => option.value).filter(value => picked.has(value));
          if (await patchProvider(group, { referenceInputModes: next })) panelToast('参考文件方式已更新', '✓');
          renderPane();
        });
      });
      card.querySelectorAll('[data-provider-upload-kind]').forEach(box => {
        box.addEventListener('change', async () => {
          const picked = new Set(Array.isArray(group.fileUploadMediaKinds) ? group.fileUploadMediaKinds : []);
          if (box.checked) picked.add(box.dataset.providerUploadKind); else picked.delete(box.dataset.providerUploadKind);
          const next = REFERENCE_KIND_OPTIONS.map(option => option.value).filter(value => picked.has(value));
          if (await patchProvider(group, { fileUploadMediaKinds: next })) panelToast('上传文件类型已更新', '✓');
          renderPane();
        });
      });

      // 兼容预设：合同的快捷方式 —— 选中就把合同写回去；「自定义合同」不改合同，
      // 直接重绘把下拉弹回推导出来的真实值（否则会出现「显示 custom、实际是别的」的假象）。
      card.querySelector('[data-provider-preset]')?.addEventListener('change', async event => {
        const option = MEDIA_PRESET_OPTIONS.find(item => item.value === event.target.value);
        if (!option || option.contract === null) { renderPane(); return; }
        if (await patchProvider(group, { imageTransport: option.contract })) panelToast('兼容预设已更新', '✓');
        renderPane();
      });

      card.querySelectorAll('[data-provider-logo]').forEach(input => {
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          input.value = '';
          if (file) uploadProviderLogo(group, file);
        });
      });
      card.querySelector('[data-provider-logo-remove]')?.addEventListener('click', async () => {
        if (await patchProvider(group, { logoUrl: '' })) panelToast('LOGO 已删除', '✓');
        renderPane();
      });

      card.querySelector('[data-provider-test]')?.addEventListener('click', () => testProvider(group, card, false));
      card.querySelector('[data-provider-deep-test]')?.addEventListener('click', () => testProvider(group, card, true));
      card.querySelector('[data-provider-fetch]')?.addEventListener('click', () => fetchProviderModels(group));

      bindModelArea(card, group);
    });
  }

  function syncDocsLink(row, href, label) {
    const existing = row.querySelector('.provider-docs-link');
    if (!href) { if (existing) existing.remove(); return; }
    if (existing) { existing.href = href; return; }
    const link = document.createElement('a');
    link.className = 'provider-docs-link';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.href = href;
    link.textContent = label || '获取 API 凭证 ↗';
    row.appendChild(link);
  }

  function queueProviderPatch(group, patch) {
    const key = group.providerId || (group.models || []).map(model => model.id).sort().join('|') || group.key;
    const pending = pendingProviderPatches.get(key) || { group, patch: {} };
    pending.group = group;
    Object.assign(pending.patch, patch);
    pendingProviderPatches.set(key, pending);
    clearTimeout(providerSaveTimer);
    providerSaveTimer = setTimeout(flushProviderPatch, PROVIDER_SAVE_DELAY);
  }

  async function flushProviderPatch() {
    clearTimeout(providerSaveTimer);
    if (providerSaveInFlight) return providerSaveInFlight;
    if (!pendingProviderPatches.size) return true;
    providerSaveInFlight = (async () => {
      const failed = new Map();
      while (pendingProviderPatches.size) {
        const jobs = Array.from(pendingProviderPatches);
        pendingProviderPatches.clear();
        for (const [key, job] of jobs) {
          if (failed.has(key)) job.patch = { ...failed.get(key).patch, ...job.patch };
          let ok = false;
          try { ok = await patchProvider(job.group, job.patch); }
          catch (error) { panelToast(`保存失败：${error.message || '请重试'}`); }
          if (!ok) failed.set(key, job);
          else failed.delete(key);
        }
      }
      // Failed edits remain available for an explicit retry; never spin retries in a loop.
      for (const [key, job] of failed) pendingProviderPatches.set(key, job);
      if (!failed.size) panelToast('供应商配置已保存', '✓');
      return !failed.size;
    })();
    try { return await providerSaveInFlight; }
    finally { providerSaveInFlight = null; }
  }

  async function patchProvider(group, patch) {
    if (!group) return false;
    const previousKey = group.key;
    // 乐观更新：卡片上的副标题/预览要立刻反映新值，不能让用户等一轮请求。
    Object.assign(group, patch);
    if (patch.provider) group.name = patch.provider;
    group.models.forEach(model => Object.assign(model, patch));
    const movedKey = providerBucket(group);
    if (movedKey !== previousKey) {
      // 名称/BaseURL/协议是桶键的组成部分，改完必须把按 key 存的状态一起搬走，
      // 否则卡片会当场折叠、候选列表和草稿凭空消失。
      group.key = movedKey;
      if (expandedProviders.delete(previousKey)) expandedProviders.add(movedKey);
      if (endpointAdvancedOpen.delete(previousKey)) endpointAdvancedOpen.add(movedKey);
      if (remoteCandidates.has(previousKey)) { remoteCandidates.set(movedKey, remoteCandidates.get(previousKey)); remoteCandidates.delete(previousKey); }
      if (logoState.has(previousKey)) { logoState.set(movedKey, logoState.get(previousKey)); logoState.delete(previousKey); }
      if (renamingKey === previousKey) renamingKey = movedKey;
    }
    let failed = '';
    if (group.providerId) {
      const saved = await providerApi(`/api/admin/ai-providers/${encodeURIComponent(group.providerId)}`, {
        method: 'PUT', body: JSON.stringify(patch)
      });
      if (!saved || saved.error) failed = saved?.message || '保存供应商失败';
      else Object.assign(group, { apiKeySet: saved.provider.apiKeySet, apiKeyHint: saved.provider.apiKeyHint });
    }
    for (const model of group.models) {
      if (failed) break;
      const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(model.id)}`, {
        method: 'PUT', body: JSON.stringify(patch)
      });
      if (!result || result.error) { failed = result?.message || '保存失败'; break; }
    }
    if (failed) {
      providerCache = null;               // 乐观更新没法逐字段回滚，直接重取一次
      panelToast(`保存失败：${failed}`);
      renderPane();
      return false;
    }
    return true;
  }



















  function platformTypeToKind(kind) {
    return ({ image: 't2i', video: 'video', audio: 'tts', text: 'i2t',
              chat: 'i2t', llm: 'i2t', music: 'tts', speech: 'tts' })[String(kind || '').trim().toLowerCase()] || '';
  }
  /** 候选模型的类型：平台给了 `type` 就用它，没给才回落到按名字猜。 */
  function candidateKind(entry, id) {
    const declared = platformTypeToKind(entry?.type)
      || (Array.isArray(entry?.usages) ? entry.usages.map(platformTypeToKind).find(Boolean) : '');
    return declared || inferModelKind(id);
  }
  const KIND_LABEL = { t2i: '图片', video: '视频', tts: '音频', i2t: '文本' };

  // 计费方式的中文标注。★ 用户明确要求「区分清楚并标明」：同一家的 `tt-image-2.5`（按次）与
  // `tt-image-2.5-token`（按 Token 计费）是两个不同模型，扣费方式与额度完全不同。
  const BILLING_LABEL = { 'per-call': '按次', 'per-token': '按 Token', 'per-second': '按秒' };
  /** 计费徽标。`per-call` 是默认 → 不加徽标，免得每行都拖一条尾巴。 */
  function billingBadge(billing) {
    const value = String(billing || 'per-call');
    if (value === 'per-call') return '';
    return ` <i class="provider-billing is-${esc(value.replace('per-', ''))}">${esc(BILLING_LABEL[value] || value)}</i>`;
  }

  function inferModelKind(id) {
    const value = String(id || '').toLowerCase();
    const seg = word => new RegExp(`(^|[-_/.])(${word})([-_/.]|$)`);
    // ① 显式模态片段
    if (/(^|[-_/.])(t2v|i2v|v2v|txt2vid|img2vid)([-_/.]|$)|video-to|image-to-video/.test(value)
      || seg('video|vid').test(value)) return 'video';
    if (/(^|[-_/.])(t2i|i2i)([-_/.]|$)|text-to-image/.test(value)
      || seg('image|img').test(value)) return 't2i';
    if (/text-to-speech|text-to-music/.test(value)
      || seg('audio|tts|speech|voice|music|song').test(value)) return 'tts';
    // ② 品牌 / 系列名
    if (/^minimax[-_]h3(?:[-_/.]|$)/.test(value)) return 'video';
    if (/^mj(?:[-_/.\s]|$)|^(?:nano-)?banana-(?:pro|2(?:[.-]\d+)?)(?:[-_/.]|$)/.test(value)) return 't2i';
    if (/veo|sora|kling|pixverse|luma|dreamina|wan2|wanx|seedance|runway|pika|hailuo|vidu|jimeng|cogvideo|hunyuanvideo|ltx|mochi|genmo|framepack|grok-video/.test(value)) return 'video';
    if (/dall-e|flux|stable-diffusion|sdxl|sd3|seedream|imagen|midjourney|nano-banana|gpt-image|qwen-image|kolors|ideogram|recraft|krea|cogview|glm-image|ernie-image|photon|playground/.test(value)) return 't2i';
    if (/suno|udio|mureka|lyria|riffusion|musicgen|stable-audio|ace-step|elevenlabs|playai|kokoro|melotts|cosyvoice|sovits|whisper|fish-speech|bark|tortoise|index-tts/.test(value)) return 'tts';
    // ③ 兜底
    return 'i2t';
  }

  // ★ 密钥继承的「来源行」必须挑一个真的带密钥的，不能盲取 group.models[0]。
  //   group.models 的顺序 = 服务端 /api/admin/ai-models 的返回顺序，而服务端新增时是
  //   insert(0, item) —— 也就是**最近新建的那一行排最前**。
  //   于是 models[0] 经常是「上一次刚拉去、还没来得及配密钥」的空壳；
  //   拿它当来源 → inheritKeyFrom 指向一个没密钥的行 → 服务端查到的 source.apiKey 为空
  //   → 新模型没密钥，而且会一行一行往下传染（看起来就像「拉取了但没加回来」）。
  //   这里按「同组里最近有密钥的一行」挑，全都空时回退第一行（保持老行为，交给服务端处理）。
  function keyInheritSource(group) {
    const models = group?.models || [];
    const provider = group?.providerId && group.apiKeySet
      ? { id: group.providerId, apiKeySet: true, apiKeyHint: group.apiKeyHint } : null;
    if (isCanvasFlowProvider(group)) return provider;
    return models.find(model => model.apiKeySet) || provider || models[0] || null;
  }

  // extra 里的键会覆盖前面的默认值（复制时要用它改掉 provider 名，否则副本会和原供应商并成一张卡）。
  // ★ 能力位必须一起带上：卡片/向导里新增或复制出来的模型行如果漏了这些字段，
  //   新行就会退回默认行为，和同组其它行不一致（改 BaseURL 之后表现会「时好时坏」）。
  function providerCreatePayload(group, row, extra) {
    return {
      provider: group.name, baseUrl: group.baseUrl, docsUrl: group.docsUrl,
      protocol: group.protocol, authMode: group.authMode,
      textProtocol: group.textProtocol, imageTransport: group.imageTransport,
      submitPath: group.submitPath, statusPath: group.statusPath,
      imageSubmitPath: group.imageSubmitPath, imageEditPath: group.imageEditPath,
      logoUrl: group.logoUrl,
      providerProfile: group.providerProfile || '',
      referenceInputModes: [...(group.referenceInputModes || [])],
      fileUploadPath: group.fileUploadPath || '',
      fileUploadMediaKinds: [...(group.fileUploadMediaKinds || [])],
      imageTaskMode: group.imageTaskMode || '',
      imageStatusPath: group.imageStatusPath || '',
      imageCancelPath: group.imageCancelPath || '',
      videoTaskMode: group.videoTaskMode || '',
      videoCancelPath: group.videoCancelPath || '',
      requestProfile: row.requestProfile || '',
      // ★ 供应商级超时必须跟着每一行走：这些设置是**逐行冗余存储**的（没有独立供应商表），
      //   漏了这行的话，给已有供应商「添加模型」时新行会不带覆盖 →
      //   同一个供应商的不同模型拿到不同超时（本用例实测抓到过：新行 null、老行有值）。
      ...(group.generationTimeouts && typeof group.generationTimeouts === 'object'
        ? { generationTimeouts: { ...group.generationTimeouts } } : {}),
      name: row.name || row.model, model: row.model, type: row.type,
      ...(extra || {})
    };
  }

  async function copyProvider(group) {
    if (!group) return;
    const name = `${group.name} 副本`;
    const newIds = [];
    if (group.providerId && (!group.models.length || isCanvasFlowProvider(group))) {
      const result = await providerApi('/api/admin/ai-providers', {
        method: 'POST', body: JSON.stringify({ ...group, provider: name, inheritKeyFrom: group.providerId })
      });
      if (!result || result.error) { panelToast(result?.message || '复制失败'); return; }
      providerCache = null;
      if (!group.models.length) {
        renderPane();
        return;
      }
    }
    for (const model of group.models) {
      // 复制出来的模型一律先停用：同一组 BaseURL+密钥再启用一份会立刻重复计费。
      const result = await providerApi('/api/admin/ai-models', {
        method: 'POST',
        body: JSON.stringify(providerCreatePayload(group,
          { name: model.name || model.model, model: model.model, type: model.type },
          { enabled: false, inheritKeyFrom: model.id, provider: name }))
      });
      if (!result || result.error) { panelToast(result?.message || '复制失败'); break; }
      if (result.model?.id) newIds.push(result.model.id);
    }
    providerCache = null;
    if (newIds.length) {
      expandedProviders.add(providerBucket({ name, baseUrl: group.baseUrl, protocol: group.protocol }));
      panelToast(`已复制为「${name}」（默认停用）`, '✓');
    }
    renderPane();
  }

  async function setAllModels(group, enabled) {
    if (!group) return;
    const targets = group.models.filter(model => Boolean(model.enabled) !== enabled);
    for (const model of targets) {
      await providerApi(`/api/admin/ai-models/${encodeURIComponent(model.id)}`, {
        method: 'PUT', body: JSON.stringify({ enabled })
      });
    }
    providerCache = null;
    panelToast(enabled ? '已启用全部模型' : '已停用全部模型', '✓');
    renderPane();
  }

  async function saveModelDraft() {
    if (!modelDraft) return;
    const group = modelDraft.group;
    const pane = $id('settingsPane');
    const modelId = String(pane?.querySelector('[data-draft-model]')?.value || '').trim();
    if (!modelId) { panelToast('请填写模型标识'); pane?.querySelector('[data-draft-model]')?.focus(); return; }
    if (group.models.some(model => String(model.model || '') === modelId)) { panelToast('这个模型已经在列表里了'); return; }
    const result = await providerApi('/api/admin/ai-models', {
      method: 'POST',
      body: JSON.stringify(providerCreatePayload(group, {
        name: String(pane?.querySelector('[data-draft-name]')?.value || '').trim() || modelId,
        model: modelId,
        type: pane?.querySelector('[data-draft-kind]')?.value || 'i2t'
      }, { enabled: true, inheritKeyFrom: keyInheritSource(group)?.id || '' }))
    });
    if (!result || result.error) { panelToast(result?.message || '添加失败'); return; }
    modelDraft = null;
    providerCache = null;
    panelToast('模型已添加', '✓');
    renderPane();
  }

  // 把候选模型批量加回列表。
  // ★ 语义：这里只按 `model` 字段去重（上游有的就能加回来），所以**删掉的模型重新拉取后能恢复**。
  //   删除 = 「从本列表移除」，不是「永久拉黑」；真要永久不要它，不去点候选即可。
  async function addAllCandidates(group) {
    const remote = remoteCandidates.get(group?.key);
    if (!group || !remote?.list?.length) return;
    const targets = remoteCandidateTargets(group, remote);
    if (!targets.length) { panelToast('当前筛选下没有可添加的模型'); return; }
    // 密钥来源在循环外算一次：循环中新建的行 apiKeySet 是未知的（服务端刚写库），
    // 每轮重算只会拿到陈旧快照，不如一开始就锁一个「确实带密钥」的行。
    const sourceId = keyInheritSource(group)?.id || '';
    let created = 0;
    const createdIds = new Set();
    for (const id of targets) {
      const entry = (remote.meta || {})[id] || {};
      const result = await providerApi('/api/admin/ai-models', {
        method: 'POST',
        body: JSON.stringify(providerCreatePayload(group,
          { name: entry.name && entry.name !== id ? entry.name : id, model: id,
            type: candidateKind(entry, id) },
          { enabled: false, inheritKeyFrom: sourceId }))
      });
      if (!result || result.error) { panelToast(result?.message || '批量添加中断'); break; }
      created += 1;
      createdIds.add(id);
    }
    remoteCandidates.set(group.key, { ...remote, loading: false, list: remote.list.filter(id => !createdIds.has(id)), error: '' });
    providerCache = null;
    if (created) panelToast(`已添加 ${created} 个模型（默认停用，可逐个启用）`, '✓');
    renderPane();
  }

  function shrinkLogo(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('这不是可识别的图片'));
        image.onload = () => {
          // LOGO 只显示 32/48px，先缩到 128px 再内联 —— 否则一张手机照片就是几 MB base64。
          const scale = Math.min(1, LOGO_MAX_EDGE / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadProviderLogo(group, file) {
    const key = group.key;
    logoState.set(key, { busy: true, error: '' });
    renderPane();
    let dataUrl = '';
    try {
      dataUrl = await shrinkLogo(file);
      if (dataUrl.length > LOGO_MAX_CHARS) throw new Error('图片太复杂，请换一张更简洁的图');
    } catch (error) {
      logoState.set(group.key, { busy: false, error: error?.message || 'LOGO 处理失败' });
      renderPane();
      return;
    }
    const ok = await patchProvider(group, { logoUrl: dataUrl });
    logoState.set(group.key, { busy: false, error: ok ? '' : 'LOGO 保存失败' });
    if (ok) panelToast('LOGO 已更新', '✓');
    renderPane();
  }

  async function fetchProviderModels(group) {
    if (!group) return;
    if (!/^https?:\/\/.+/i.test(group.baseUrl || '')) { panelToast('请先填写有效的 BaseURL'); return; }
    // ★ 用「组里任意一行有密钥」判断，别只看 models[0]：第 0 行常是刚建的空壳，
    //   那样会在组里明明有可用密钥时误报「请先填写 API Key」。
    if (group.authMode !== 'none' && !keyInheritSource(group)?.apiKeySet) { panelToast('请先填写 API Key 再拉取模型列表'); return; }
    remoteCandidates.set(group.key, { loading: true, list: [], error: '', notice: null });
    renderPane();
    try {
      // 密钥不下发浏览器，所以这里只传地址，由服务端取该地址已保存的密钥去请求。
      const result = await providerApi('/api/admin/ai-models/fetch-remote', {
        method: 'POST',
        throwOnError: true,
        body: JSON.stringify({ baseUrl: group.baseUrl, apiKey: '', protocol: group.protocol, authMode: group.authMode,
          ...(isCanvasFlowProvider(group) ? { providerId: group.providerId } : {}) })
      });
      // ★ r864：服务端现在返回**对象数组**（`{id, name, type, usages, available}`），
      //   而不是一串裸 id —— 这样面板能标出「哪些其实没开通」「每个是什么模态」。
      //   兼容老服务端：元素是字符串时按裸 id 处理（`available` 未知 → 不标注）。
      const entries = (result?.models || [])
        .map(item => (typeof item === 'string' ? { id: item } : item))
        .filter(item => item && item.id);
      // ★ 已开通的排前面（`/v1/skills/models` 是**平台全量目录** 174 条，只有 19 条已开通 ——
      //   不排序的话前 60 个 chip 里几乎全是"加了也用不了"的）。
      const ordered = [...entries].sort((a, b) => (b.available === true ? 1 : 0) - (a.available === true ? 1 : 0));
      const list = ordered.map(item => String(item.id));
      const meta = Object.fromEntries(ordered.map(item => [String(item.id), item]));
      const availableCount = Number.isInteger(result?.availableCount) ? result.availableCount : null;
      const unavailableCount = availableCount === null ? 0 : Math.max(0, list.length - availableCount);


      remoteCandidates.set(group.key, {
        loading: false, list, meta, showAll: false,
        filterKind: BUILTIN_CONFIG_TYPES[group.builtInKind || group.configKind] || 'all',
        error: list.length ? '' : '供应商没有返回可用的模型列表',
        notice: list.length
          ? { ok: true, text: availableCount === null
              // 老服务端 / 平台没给开通信息 → 老实说「读取到 N 个」，别编。
              ? `模型列表已更新，读取到 ${list.length} 个模型`
              : `读取到 ${list.length} 个模型，其中 ${availableCount} 个已开通`
                + (unavailableCount ? `；另外 ${unavailableCount} 个**未开通**（加了也用不了，已标灰）` : '') }
          : { ok: false, text: '供应商没有返回可用的模型列表' }
      });
    } catch (error) {
      const text = error?.message || '拉取失败，可手动添加模型';
      remoteCandidates.set(group.key, { loading: false, list: [], error: text, notice: { ok: false, text } });
    }
    renderPane();
  }

  async function removeProvider(group) {
    if (!group || group.builtIn) return;
    if (!window.confirm(`删除供应商「${group.name}」及其 ${group.models.length} 个模型？该操作不可撤销。`)) return;
    for (const model of group.models) {
      const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(model.id)}`, { method: 'DELETE', throwOnError: false });
      if (!result?.deleted) { providerCache = null; renderPane(); toast('删除失败，请重试', '!'); return; }
    }
    const data = await providerApi('/api/admin/ai-models');
    const record = data?.providers?.find(item => providerBucket({ ...item, name: item.provider }) === group.key);
    if (record) {
      const result = await providerApi(`/api/admin/ai-providers/${encodeURIComponent(record.id)}`, { method: 'DELETE' });
      if (!result?.deleted) { providerCache = null; renderPane(); toast('删除供应商失败，请重试', '!'); return; }
    }
    providerCache = null;
    expandedProviders.delete(group.key);
    endpointAdvancedOpen.delete(group.key);
    remoteCandidates.delete(group.key);
    logoState.delete(group.key);
    if (modelDraft?.group === group) modelDraft = null;
    toast('供应商已删除', '✓');
    renderPane();
  }

  async function removeModel(modelId) {
    const group = (providerCache?.items || []).find(item => item.models.some(model => model.id === modelId));
    const model = group?.models.find(item => item.id === modelId);
    if (!model) return;
    if (!window.confirm(`删除模型「${model.name || model.model}」？供应商连接信息会保留。`)) return;
    await providerApi(`/api/admin/ai-models/${encodeURIComponent(modelId)}`, { method: 'DELETE', throwOnError: false });
    providerCache = null;
    if (group.models.length <= 1) {
      expandedProviders.delete(group.key);
      endpointAdvancedOpen.delete(group.key);
      remoteCandidates.delete(group.key);
      logoState.delete(group.key);
      if (modelDraft?.group === group) modelDraft = null;
    }
    toast('模型已删除', '✓');
    renderPane();
  }

  /**
   * 「删除全部」：把这个供应商下的模型行逐个删掉。
   * ★★ 必须**串行**：服务端每次 DELETE 都是「读整表 → 去掉一行 → 写整表」（write_scoped_ai_models），
   *    并发打过去会互相覆盖 —— 同时删 178 行最后只会剩下少数几次写的结果。
   * ★ 删到内置默认模型时服务端会把它记进 ai-models-dismissed.json（之后不再自动补回），
   *    所以确认文案里要写清「不会自动恢复」，否则用户重启后会以为删失败了。
   * ★ 连接信息独立保留，清空模型不会删除供应商。
   */
  async function removeAllModels(group) {
    if (!group || !group.models.length) return;
    const total = group.models.length;
    const okConfirm = window.confirm(
      `删除供应商「${group.name}」下的全部 ${total} 个模型？\n\n`
      + '· 保留供应商连接信息\n'
      + '· 内置的默认模型删掉后不会自动恢复\n'
      + '· 此操作不可撤销'
    );
    if (!okConfirm) return;

    const button = document.querySelector(`[data-models-purge="${CSS.escape(group.key)}"]`);
    if (button) { button.disabled = true; button.textContent = '删除中…'; }

    let done = 0, failed = 0;
    for (const model of [...group.models]) {
      const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(model.id)}`, {
        method: 'DELETE', throwOnError: false
      });
      if (result && result.deleted) done += 1; else failed += 1;
    }

    providerCache = null;
    // 清理模型草稿和旧的远程候选，避免显示刚删除的条目。
    expandedProviders.delete(group.key);
    endpointAdvancedOpen.delete(group.key);
    remoteCandidates.delete(group.key);
    logoState.delete(group.key);
    if (modelDraft?.group === group) modelDraft = null;
    renderPane();
    // ★ 顺序：renderPane 会重建 .settings-toast 节点，先 toast 再重绘等于没提示
    panelToast(failed ? `已删除 ${done} 个，${failed} 个失败` : `已删除全部 ${done} 个模型`, failed ? '!' : '✓');
  }

  async function toggleModel(modelId) {
    const group = (providerCache?.items || []).find(item => item.models.some(model => model.id === modelId));
    const model = group?.models.find(item => item.id === modelId);
    if (!model) return;
    const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(modelId)}`, {
      method: 'PUT', body: JSON.stringify({ enabled: !model.enabled })
    });
    if (!result || result.error) { toast(result?.message || '保存失败', '!'); return; }
    providerCache = null;
    renderPane();
  }

  async function testProvider(group, card, deep = false) {
    const box = card?.querySelector('.provider-test-result');
    if (!group || !box) return;
    box.className = 'provider-test-result is-busy';
    box.textContent = deep ? '正在实测各条链路（会产生少量费用）…' : '正在测试连通…';
    let ok = 0;
    let failed = 0;
    const messages = [];
    const rows = [];
    const labelOf = new Map(group.models.map(model => [model.id, model.name || model.model || '未命名模型']));
    if (!group.models.length) {
      box.className = 'provider-test-result is-fail';
      box.textContent = '这个供应商下还没有模型，先「拉取模型列表」或「添加模型」';
      return;
    }
    if (!deep) {


      const batch = await providerApi('/api/admin/provider-models-test', {
        method: 'POST', body: JSON.stringify({ ids: group.models.map(model => model.id) })
      });
      const results = Array.isArray(batch?.results) ? batch.results : [];
      results.forEach(item => {
        if (item?.ok) { ok += 1; return; }
        failed += 1;
        if (item?.message) messages.push(`${labelOf.get(item.id) || item.id}：${item.message}`);
      });
      box.className = `provider-test-result ${failed ? 'is-fail' : 'is-ok'}`;
      box.textContent = failed
        ? `${ok} 个通过 · ${failed} 个失败${messages.length ? `（${messages[0]}）` : ''}`
        : `全部 ${ok} 个模型连通正常`;
      return;
    }
    for (const model of group.models) {
      const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(model.id)}/test`, {
        method: 'POST', body: JSON.stringify({ deep })
      });
      const label = labelOf.get(model.id) || '未命名模型';
      if (result?.ok) ok += 1;
      else { failed += 1; if (result?.message) messages.push(`${label}：${result.message}`); }
      if (deep && Array.isArray(result?.steps)) {
        result.steps.forEach(step => rows.push({ model: label, ...step }));
      }
    }

    // 实测模式：把每一步（连通性 / 各条链路）连同「命中的上游端点」逐条列出来。
    if (deep && rows.length) {
      box.className = `provider-test-result is-detailed ${failed ? 'is-fail' : 'is-ok'}`;
      box.innerHTML = rows.map(row => {
        const mark = row.skipped ? '○' : (row.ok ? '✓' : '✗');
        const cls = row.skipped ? 'is-skip' : (row.ok ? 'is-ok' : 'is-fail');
        const meta = [
          row.endpoint ? `<code>${esc(row.endpoint)}</code>` : '',
          row.transport ? `合同 <code>${esc(row.transport)}</code>` : '',
          row.ms ? `${row.ms} ms` : '',
          row.free ? '免费' : '计费',
        ].filter(Boolean).join(' · ');
        const endpoints = row.endpoints
          ? `<div class="provider-test-endpoints">提交：${(row.endpoints.submit || []).map(u => `<code>${esc(u)}</code>`).join(' ')}<br>查询：${(row.endpoints.status || []).map(u => `<code>${esc(u)}</code>`).join(' ')}</div>`
          : '';
        return `<div class="provider-test-step ${cls}">
          <span class="provider-test-mark">${mark}</span>
          <span class="provider-test-body">
            <strong>${esc(row.model)} · ${esc(row.name)}</strong>
            <small>${esc(row.detail || '')}</small>
            ${meta ? `<small class="provider-test-meta">${meta}</small>` : ''}
            ${endpoints}
          </span>
        </div>`;
      }).join('');
      return;
    }

    box.className = `provider-test-result ${failed ? 'is-fail' : 'is-ok'}`;
    box.textContent = failed
      ? `${ok} 个通过 · ${failed} 个失败${messages.length ? `（${messages[0]}）` : ''}`
      : `全部 ${ok} 个模型连通正常`;
  }











  const WIZARD_STEPS = ['基本信息', '连接协议', '模型能力', '确认'];
  const WIZARD_SUBTITLE = '配置 CanvasFlow 实际提交请求所需的连接、鉴权和模型能力';
  const WIZARD_LOGO_HINT = '支持真实 PNG、JPEG、WebP，最大 2MB；不接受 SVG。界面统一按 48px 预览框等比完整显示。';

  function startWizard() {
    wizard = {
      step: 0,
      error: '',
      logoError: '',
      logoBusy: false,
      modelMessage: '',
      test: { loading: false, ok: false, message: '' },
      remote: { loading: false, list: [], error: '', diagnostics: [] },
      form: {
        name: '', baseUrl: '', docsUrl: '', apiKey: '', logoUrl: '',
        authMode: 'bearer', protocol: 'openai', textProtocol: '',
        submitPath: '', statusPath: '',
        imageTransport: '', imageSubmitPath: '', imageEditPath: '',

        providerProfile: '',
        referenceInputModes: [], fileUploadPath: '', fileUploadMediaKinds: [],
        imageTaskMode: '', imageStatusPath: '', imageCancelPath: '',
        videoTaskMode: '', videoCancelPath: ''
      },
      models: [], modelFilter: 'all', modelSearch: ''
    };
    wizardScrollReset = true;             // 新开的向导从第一步顶部开始
    renderPane();
  }

  function wizardStepValid() {
    if (!wizard) return false;
    if (wizard.step === 0) return Boolean(wizard.form.name.trim());
    if (wizard.step === 1) {
      if (!/^https?:\/\/.+/i.test(wizard.form.baseUrl.trim())) return false;
      if (wizard.form.authMode !== 'none' && !wizard.form.apiKey.trim()) return false;
      return true;
    }
    if (wizard.step === 2) return wizard.models.some(row => row.model.trim() && row.enabled);   
    return true;
  }

  // 向导里的「测试连接」按钮：新建时还没有模型行，所以直接拿表单里的地址 + 密钥去打一次
  // /fetch-remote（它本来就要先连通才能列模型），用它的成功/失败当连通性结论。
  function wizardTestReady() {
    return /^https?:\/\/.+/i.test(wizard.form.baseUrl.trim())
      && (wizard.form.authMode === 'none' || Boolean(wizard.form.apiKey.trim()));
  }

  // 向导层和主面板（settingsPane）一样是「整层 innerHTML 重建」→ 滚动容器
  // `.wizard-dialog__body` 被换成新节点，scrollTop 归零。实测症状：滚到下半区勾一下
  // 「参考文件」的 Base64 卡片，整页弹回最顶上（卡片下方的「测试连接」也跟着跑掉）。
  // 默认**保留**用户当前位置；只有翻页 / 重开向导时才从顶部开始
  // （wizardScrollReset 由 startWizard 与翻页按钮置位、这里消费一次）。
  let wizardScrollReset = true;

  function renderWizardLayer() {
    const existing = $id('providerWizardLayer');
    if (!wizard) { if (existing) existing.remove(); return; }
    readWizardForm();                     // 重绘前先回读 DOM，否则刚敲的字会被这次重绘吃掉
    const prevBody = existing ? existing.querySelector('.wizard-dialog__body') : null;
    const want = (wizardScrollReset || !prevBody) ? 0 : prevBody.scrollTop;
    wizardScrollReset = false;
    const host = existing || document.createElement('div');
    host.id = 'providerWizardLayer';
    host.className = 'wizard-layer';
    host.innerHTML = renderWizardDialog();
    if (!existing) document.body.appendChild(host);
    bindWizardEvents(host);
    // 立即回填会被夹断（新内容还没长回来），下一帧再补一次。
    const body = host.querySelector('.wizard-dialog__body');
    if (!body) return;
    body.scrollTop = want;
    if (!want) return;
    requestAnimationFrame(() => {
      const again = host.querySelector('.wizard-dialog__body');
      if (again) again.scrollTop = want;
    });
  }

  function wizardField(label, control, hint) {
    return `<label class="wizard-field"><span>${esc(label)}</span>${control}${hint ? `<small class="wizard-field-hint">${esc(hint)}</small>` : ''}</label>`;
  }

  function renderWizardBlock(title, hint, body) {
    return `<section class="wizard-block"><header class="wizard-block__header"><strong>${esc(title)}</strong><span>${esc(hint)}</span></header>${body}</section>`;
  }

  function renderWizardDialog() {
    const rail = WIZARD_STEPS.map((label, index) => {
      const cls = index === wizard.step ? 'is-active' : index < wizard.step ? 'is-complete' : '';
      const mark = index < wizard.step ? svgIcon('check', 12) : String(index + 1);
      return `<span class="wizard-step ${cls}"><i>${mark}</i><b>${esc(label)}</b></span>`;
    }).join('');
    return `<section class="wizard-dialog" role="dialog" aria-modal="true" aria-label="添加 OpenAI 兼容商向导">
      <header class="wizard-dialog__header">
        <div><strong>添加 OpenAI 兼容商</strong><span>${esc(WIZARD_SUBTITLE)}</span></div>
      </header>
      <nav class="wizard-dialog__steps" aria-label="配置步骤">${rail}</nav>
      <div class="wizard-dialog__body">${renderWizardStepBody()}</div>
      <footer class="wizard-footer">
        <button class="wizard-btn ghost" type="button" id="wizardCancel">取消</button>
        <span class="wizard-footer__spacer"></span>
        ${wizard.step > 0 ? '<button class="wizard-btn ghost" type="button" id="wizardPrev">上一步</button>' : ''}
        <button class="wizard-btn primary" type="button" id="wizardNext" ${wizardStepValid() ? '' : 'disabled'}>${wizard.step === WIZARD_STEPS.length - 1 ? '完成配置' : '下一步'}</button>
      </footer>
    </section>`;
  }

  function renderWizardStepBody() {
    if (wizard.step === 0) return renderWizardBasics();
    if (wizard.step === 1) return renderWizardConnection();
    if (wizard.step === 2) return renderWizardModels();
    return renderWizardSummary();
  }

  function renderWizardBasics() {
    const letter = esc((wizard.form.name || 'P').trim().slice(0, 1).toUpperCase() || 'P');
    const preview = wizard.form.logoUrl
      ? `<span class="wizard-logo-preview"><img src="${esc(wizard.form.logoUrl)}" alt="" /></span>`
      : `<span class="wizard-logo-preview">${letter}</span>`;
    return `<div class="wizard-section">
      <div class="wizard-logo-row">
        ${preview}
        <label class="wizard-logo-upload">${svgIcon('upload')}<span>${wizard.logoBusy ? '上传中' : (wizard.form.logoUrl ? '替换 LOGO' : '上传 LOGO')}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" id="wizardLogo" ${wizard.logoBusy ? 'disabled' : ''} />
        </label>
        ${wizard.form.logoUrl ? '<button class="wizard-btn ghost" type="button" id="wizardLogoRemove">删除</button>' : ''}
        ${wizard.logoError ? `<small class="wizard-logo-error">${esc(wizard.logoError)}</small>` : ''}
      </div>
      <small class="wizard-hint">${esc(WIZARD_LOGO_HINT)}</small>
      ${wizardField('供应商名称', `<input id="wizardName" type="text" placeholder="例如 DeepSeek 或本地网关" value="${esc(wizard.form.name)}" autocomplete="off" />`)}
    </div>`;
  }

  // 生成端点里的任务卡（向导版）：任务模式 / 提交接口 /（图片）编辑接口 /
  // 查询接口 + 取消接口 —— 后两个只在异步模式出现，与卡片里同一套规则。
  function renderWizardTaskCard(kind) {
    const isImage = kind === 'image';
    const modeField = isImage ? 'imageTaskMode' : 'videoTaskMode';
    const fallback = isImage ? 'sync' : 'async';
    const mode = wizard.form[modeField] || fallback;
    const async = mode === 'async';
    const select = `<select id="${isImage ? 'wizardImageTaskMode' : 'wizardVideoTaskMode'}">${TASK_MODE_OPTIONS.map(option => `<option value="${esc(option.value)}" ${mode === option.value ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}</select>`;
    return `<div class="wizard-endpoint-card">
      <div class="wizard-endpoint-card__title">${isImage ? '图片任务' : '视频任务'}</div>
      ${wizardField('任务模式', select)}
      ${wizardField('提交接口', `<input id="${isImage ? 'wizardImageSubmitPath' : 'wizardSubmitPath'}" value="${esc(wizard.form[isImage ? 'imageSubmitPath' : 'submitPath'])}" placeholder="${esc(isImage ? ENDPOINT_PLACEHOLDER.imageSubmitPath : ENDPOINT_PLACEHOLDER.submitPath)}" />`)}
      ${isImage ? wizardField('编辑接口（有参考图）', `<input id="wizardImageEditPath" value="${esc(wizard.form.imageEditPath)}" placeholder="${esc(ENDPOINT_PLACEHOLDER.imageEditPath)}" />`) : ''}
      ${async ? wizardField('查询接口', `<input id="${isImage ? 'wizardImageStatusPath' : 'wizardStatusPath'}" value="${esc(wizard.form[isImage ? 'imageStatusPath' : 'statusPath'])}" placeholder="${esc(isImage ? ENDPOINT_PLACEHOLDER.imageStatusPath : ENDPOINT_PLACEHOLDER.statusPath)}" />`, '必须包含 {task_id} 占位符') : ''}
      ${async ? wizardField('取消接口（可选）', `<input id="${isImage ? 'wizardImageCancelPath' : 'wizardVideoCancelPath'}" value="${esc(wizard.form[isImage ? 'imageCancelPath' : 'videoCancelPath'])}" placeholder="${esc(ENDPOINT_PLACEHOLDER.cancelPath)}" />`) : ''}
    </div>`;
  }

  function renderWizardReferenceBlock() {
    const modes = wizard.form.referenceInputModes || [];
    const kinds = wizard.form.fileUploadMediaKinds || [];
    const uploadOn = modes.includes('file-upload');
    return renderWizardBlock('参考文件', '勾选供应商支持的方式；一个都不勾等价于只支持 Base64',
      `<div class="wizard-reference-grid">
        ${REFERENCE_MODE_OPTIONS.map(option => `<label class="wizard-reference ${modes.includes(option.value) ? 'is-selected' : ''}">
          <input type="checkbox" data-wizard-reference="${esc(option.value)}" ${modes.includes(option.value) ? 'checked' : ''} />
          <span><b>${esc(option.label)}</b><small>${esc(option.hint)}</small></span>
        </label>`).join('')}
      </div>
      ${uploadOn ? `<div class="wizard-upload-config">
        ${wizardField('上传接口', `<input id="wizardFileUploadPath" value="${esc(wizard.form.fileUploadPath)}" placeholder="/v1/files/upload" />`)}
        <fieldset class="wizard-upload-kinds">
          <legend>上传文件类型</legend>
          <div class="wizard-upload-kind-options">
            ${REFERENCE_KIND_OPTIONS.map(kind => `<label class="${kinds.includes(kind.value) ? 'is-selected' : ''}">
              <input type="checkbox" data-wizard-upload-kind="${esc(kind.value)}" ${kinds.includes(kind.value) ? 'checked' : ''} />
              <span>${esc(kind.label)}</span>
            </label>`).join('')}
          </div>
        </fieldset>
      </div>` : ''}`);
  }

  function renderWizardConnection() {
    const preset = wizard.form.imageTransport || '';
    const authSelect = `<select id="wizardAuthMode">${AUTH_MODE_OPTIONS.map(o => `<option value="${esc(o.value)}" ${wizard.form.authMode === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    const protocolSelect = `<select id="wizardProtocol">${PROTOCOL_OPTIONS.map(o => `<option value="${esc(o.value)}" ${wizard.form.protocol === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    const textSelect = `<select id="wizardTextProtocol">${TEXT_PROTOCOL_OPTIONS.map(o => `<option value="${esc(o.value)}" ${wizard.form.textProtocol === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    const profileSelect = `<select id="wizardProviderProfile">${PROVIDER_PROFILE_OPTIONS.map(o => `<option value="${esc(o.value)}" ${wizard.form.providerProfile === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    const transportSelect = `<select id="wizardImageTransport">${renderSelectOptions(IMAGE_TRANSPORT_OPTIONS, preset)}</select>`;
    const presetValue = presetForTransport(preset);
    const presetSelect = `<select id="wizardPreset">${renderSelectOptions(MEDIA_PRESET_OPTIONS, presetValue)}</select>`;
    return `<div class="wizard-section">
      ${renderWizardBlock('连接信息', '填写供应商提供的 API 地址和凭证', `<div class="wizard-grid">
        ${wizardField('BaseURL', `<input id="wizardBaseUrl" type="url" placeholder="https://api.example.com" value="${esc(wizard.form.baseUrl)}" autocomplete="off" />`)}
        ${wizardField('API Key', `<input id="wizardApiKey" type="password" placeholder="输入供应商提供的密钥" value="${esc(wizard.form.apiKey)}" autocomplete="off" />`)}
        ${wizardField('鉴权方式', authSelect)}
        ${wizardField('供应商网址', `<input id="wizardDocsUrl" type="url" placeholder="https://provider.example" value="${esc(wizard.form.docsUrl)}" autocomplete="off" />`)}
      </div>`)}
      ${renderWizardBlock('图片/视频兼容预设', '普通供应商直接选择预设；只有文档无法匹配时才展开高级覆盖。',
        `<label class="wizard-field wizard-field--preset"><span>兼容预设</span>${presetSelect}
          <small class="wizard-field-hint" id="wizardPresetHint">${esc(presetHint(presetValue))}</small></label>`)}
      ${renderWizardBlock('协议兼容', '不确定时保持默认即可', `<div class="wizard-grid">
        ${wizardField('请求协议', protocolSelect)}
        ${wizardField('文本协议', textSelect)}
        ${wizardField('兼容方言', profileSelect)}
        ${wizardField('图片传输合同', transportSelect)}
      </div>`)}
      ${renderWizardBlock('生成端点', '按当前 Provider 统一配置图片和视频的提交、查询地址。',
        `<details class="wizard-endpoint-advanced" ${wizardEndpointsOpen ? 'open' : ''}>
          <summary>高级端点覆盖（可选）</summary>
          <div class="wizard-endpoint-grid">
            ${renderWizardTaskCard('image')}
            ${renderWizardTaskCard('video')}
          </div>
        </details>`)}
      ${renderWizardReferenceBlock()}
      <div class="wizard-connection">
        <button class="wizard-btn ghost" type="button" id="wizardTestConn" ${wizardTestReady() && !wizard.test.loading ? '' : 'disabled'}>${wizard.test.loading ? '测试中…' : '测试连接'}</button>
        ${wizard.test.message ? `<span class="${wizard.test.ok ? 'is-success' : 'is-error'}">${esc(wizard.test.message)}</span>` : ''}
      </div>
    </div>`;
  }

  function wizardModelMatches(row, kind, query) {
    return (!kind || kind === 'all' || row.type === kind)
      && String(row.model || '').toLowerCase().includes(String(query || '').trim().toLowerCase());
  }

  function selectedWizardModels(models) {
    return models.filter(row => row.enabled && String(row.model || '').trim());
  }

  function wizardCandidates(entries) {
    return entries.map(entry => {
      const id = String(entry?.id || entry?.name || (typeof entry === 'string' ? entry : '')).trim();
      return { model: id, type: candidateKind(entry, id), enabled: false };
    }).filter(row => row.model);
  }

  function applyWizardModelFilters() {
    let visible = 0;
    document.querySelectorAll('#wizardModelList [data-wizard-row]').forEach(element => {
      const row = wizard.models[Number(element.dataset.wizardRow)];
      const matches = Boolean(row && wizardModelMatches(row, wizard.modelFilter, wizard.modelSearch));
      element.hidden = !matches;
      if (matches) visible += 1;
    });
    const count = $id('wizardModelCount');
    if (count) count.textContent = `显示 ${visible} / ${wizard.models.length} 个 · 已选 ${selectedWizardModels(wizard.models).length} 个`;
    const empty = $id('wizardModelFilterEmpty');
    if (empty) empty.hidden = visible > 0 || !wizard.models.length;
  }

  function renderWizardModels() {
    const rows = wizard.models.map((row, index) => `<div class="wizard-model ${row.enabled ? 'is-enabled' : ''}" data-wizard-row="${index}" ${wizardModelMatches(row, wizard.modelFilter, wizard.modelSearch) ? '' : 'hidden'}>
      <label>
        <input type="checkbox" ${row.enabled ? 'checked' : ''} data-wizard-enabled="${index}" />
        <strong data-wizard-model="${index}">${esc(row.model || '未命名模型')}</strong>
      </label>
      <div class="wizard-model-usage">
        ${MODEL_KIND_OPTIONS.map(kind => `<button type="button" class="${row.type === kind.value ? 'is-active' : ''}" aria-pressed="${row.type === kind.value}" data-wizard-kind="${index}" data-kind="${esc(kind.value)}">${esc(kind.label)}</button>`).join('')}
      </div>
      ${(() => {

        const options = requestProfileOptionsFor(row.type);
        const value = options.some(option => option.value === row.requestProfile) ? (row.requestProfile || 'auto') : 'auto';
        return options.length > 1
          ? `<select class="wizard-model-profile" data-wizard-profile="${index}" aria-label="${esc(row.model || '模型')} 请求形态">${options.map(option => `<option value="${esc(option.value)}" ${value === option.value ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}</select>`
          : '<span class="wizard-model-profile-spacer"></span>';
      })()}
      <button class="wizard-model-remove" type="button" title="移除模型" data-wizard-remove="${index}">${svgIcon('close', 13)}</button>
    </div>`).join('');
    return `<div class="wizard-section">
      <div class="wizard-model-tools">
        <button class="wizard-btn ghost" type="button" id="wizardFetchRemote" ${wizard.remote.loading ? 'disabled' : ''}>${wizard.remote.loading ? '读取中…' : '从接口读取模型'}</button>
        <div class="wizard-manual-model">
          <input id="wizardManualModel" aria-label="手工模型 ID" placeholder="手工输入模型 ID" autocomplete="off" />
          <button type="button" title="添加模型" id="wizardAddModel">${svgIcon('plus')}</button>
        </div>
      </div>
      <div class="wizard-model-filters">
        <label>模型类型<select id="wizardModelTypeFilter" aria-label="筛选模型类型">
          <option value="all">全部类型</option>
          ${MODEL_KIND_OPTIONS.map(kind => `<option value="${esc(kind.value)}" ${wizard.modelFilter === kind.value ? 'selected' : ''}>${esc(kind.label)}</option>`).join('')}
        </select></label>
        <label class="wizard-model-search">搜索模型<input id="wizardModelSearch" type="search" aria-label="搜索模型名称" placeholder="输入模型名称或 ID" value="${esc(wizard.modelSearch || '')}" /></label>
        <span id="wizardModelCount" role="status">显示 ${wizard.models.filter(row => wizardModelMatches(row, wizard.modelFilter, wizard.modelSearch)).length} / ${wizard.models.length} 个 · 已选 ${selectedWizardModels(wizard.models).length} 个</span>
      </div>
      <small class="wizard-model-message">勾选模型名称左侧的框才会接入；右侧按钮用于调整模型类型。切换筛选保留已选项。</small>
      ${wizard.modelMessage ? `<small class="wizard-model-message">${esc(wizard.modelMessage)}</small>` : ''}
      ${wizard.models.length ? `<div class="wizard-models" id="wizardModelList">${rows}</div>` : ''}
      <div class="wizard-empty" id="wizardModelFilterEmpty" ${!wizard.models.length || wizard.models.some(row => wizardModelMatches(row, wizard.modelFilter, wizard.modelSearch)) ? 'hidden' : ''}>没有匹配的模型，请调整类型或搜索词。</div>
      ${wizard.models.length ? '' : '<div class="wizard-empty">读取接口模型，或手工录入服务文档中的真实模型 ID。</div>'}
      ${wizard.error ? `<div class="wizard-error">${esc(wizard.error)}</div>` : ''}
      ${wizard.remote.error ? `<div class="wizard-error">${esc(wizard.remote.error)}</div>` : ''}
      ${wizard.remote.error && wizard.remote.diagnostics?.length ? `<div class="wizard-field-hint is-error">探测详情：${wizard.remote.diagnostics.map(item => esc(`${item.url} → ${item.detail}`)).join('<br>')}</div>` : ''}
    </div>`;
  }

  function renderWizardSummary() {
    const enabled = selectedWizardModels(wizard.models);
    const cell = (label, value, cls) => `<div><dt>${esc(label)}</dt><dd class="${cls || ''}">${esc(value)}</dd></div>`;
    return `<div class="wizard-section">
      <div class="wizard-summary">
        <dl>
          ${cell('供应商', wizard.form.name.trim() || '未命名')}
          ${cell('BaseURL', wizard.form.baseUrl.trim() || '未填写')}
          ${cell('供应商网址', wizard.form.docsUrl.trim() || '未设置')}
          ${cell('请求协议', protocolLabel(wizard.form.protocol))}
          ${cell('文本协议', textProtocolLabel(wizard.form.textProtocol))}
          ${cell('兼容方言', providerProfileLabel(wizard.form.providerProfile))}
          ${cell('图片传输', imageTransportLabel(wizard.form.imageTransport))}
          ${cell('图片任务', taskModeLabel(wizard.form.imageTaskMode, 'sync'))}
          ${cell('视频任务', taskModeLabel(wizard.form.videoTaskMode, 'async'))}
          ${cell('参考文件', referenceModesText(wizard.form.referenceInputModes))}
          ${cell('鉴权', authModeLabel(wizard.form.authMode))}
          ${cell('启用模型', `${enabled.length} 个`)}
          ${cell('连接状态', wizard.test.ok ? '已验证通过' : '未验证，保存后可在供应商卡片中重试', wizard.test.ok ? 'is-ok' : 'is-warn')}
        </dl>
        ${enabled.length ? `<div class="wizard-enabled-list">${enabled.map(row => `<span>${esc(row.model)} · ${esc(kindLabel(row.type))}${row.requestProfile && row.requestProfile !== 'auto' ? ` · ${esc(requestProfileLabel(row.requestProfile))}` : ''}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
  }

  // 表单一律以 DOM 为准：重绘前先回读一次，否则任何一次重绘都会把用户刚敲的字丢掉。
  const WIZARD_FORM_IDS = {
    wizardName: 'name', wizardBaseUrl: 'baseUrl', wizardDocsUrl: 'docsUrl', wizardApiKey: 'apiKey',
    wizardSubmitPath: 'submitPath', wizardStatusPath: 'statusPath',
    wizardImageTransport: 'imageTransport', wizardImageSubmitPath: 'imageSubmitPath',
    wizardImageEditPath: 'imageEditPath', wizardTextProtocol: 'textProtocol',
    wizardAuthMode: 'authMode', wizardProtocol: 'protocol',
    wizardProviderProfile: 'providerProfile', wizardFileUploadPath: 'fileUploadPath',
    // 任务模式**故意不在这里**：下拉永远显示「实际生效的模式」（空 = 默认），
    // 回读会把默认值物化成显式配置。只在用户真的改过时才写进表单。
    wizardImageStatusPath: 'imageStatusPath', wizardImageCancelPath: 'imageCancelPath',
    wizardVideoCancelPath: 'videoCancelPath'
  };

  function readWizardForm() {
    if (!wizard) return;
    for (const [id, field] of Object.entries(WIZARD_FORM_IDS)) {
      const el = $id(id);
      if (el) wizard.form[field] = el.value;
    }
  }

  function bindWizardEvents(host) {
    // 表单输入要实时驱动「下一步 / 测试连接」的可用状态，否则用户填完按钮还是灰的。
    const refreshButtons = () => {
      const next = $id('wizardNext');
      if (next) next.disabled = !wizardStepValid();
      const test = $id('wizardTestConn');
      if (test) test.disabled = !wizardTestReady() || wizard.test.loading;
    };
    host.querySelectorAll('#wizardName,#wizardBaseUrl,#wizardDocsUrl,#wizardApiKey,#wizardSubmitPath,#wizardStatusPath,#wizardImageSubmitPath,#wizardImageEditPath').forEach(el => {
      el.addEventListener('input', () => { readWizardForm(); refreshButtons(); });
    });
    host.querySelectorAll('#wizardImageTransport,#wizardTextProtocol,#wizardAuthMode,#wizardProtocol').forEach(el => {
      el.addEventListener('change', () => {
        readWizardForm();
        refreshButtons();
        // 只更新说明文案，不整块重绘（重绘会把焦点从下拉里踢出去）
        if (el.id === 'wizardImageTransport') {

          const derived = presetForTransport(el.value);
          const presetSelect = $id('wizardPreset');
          if (presetSelect) presetSelect.value = derived;
          const hint = $id('wizardPresetHint');
          if (hint) hint.textContent = presetHint(derived);
        } else {
          wizard.test = { loading: false, ok: false, message: '' };   // 连接参数变了，上一次的结论作废
        }
      });
    });
    // 兼容预设：合同的快捷方式。要**同时改 DOM 和表单**再重绘 ——
    // renderWizardLayer 开头会 readWizardForm() 回读 DOM，只改表单会被旧值盖回去。
    $id('wizardPreset')?.addEventListener('change', event => {
      const option = MEDIA_PRESET_OPTIONS.find(item => item.value === event.target.value);
      if (!option || option.contract === null) { renderWizardLayer(); return; }
      const transport = $id('wizardImageTransport');
      if (transport) transport.value = option.contract;
      wizard.form.imageTransport = option.contract;
      renderWizardLayer();
    });

    // LOGO：真文件 → canvas 缩到 128px → data URI（与卡片里的 LOGO 上传同一条路）
    $id('wizardLogo')?.addEventListener('change', async event => {
      const input = event.target;
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      readWizardForm();
      wizard.logoBusy = true;
      wizard.logoError = '';
      renderWizardLayer();
      try {
        const dataUrl = await shrinkLogo(file);
        if (dataUrl.length > LOGO_MAX_CHARS) throw new Error('图片太复杂，请换一张更简洁的图');
        wizard.form.logoUrl = dataUrl;
      } catch (error) {
        wizard.logoError = error?.message || 'LOGO 处理失败';
      }
      wizard.logoBusy = false;
      renderWizardLayer();
    });
    $id('wizardLogoRemove')?.addEventListener('click', () => {
      readWizardForm();
      wizard.form.logoUrl = '';
      wizard.logoError = '';
      renderWizardLayer();
    });

    // 测试连接：新建时还没有模型行可测，所以直接拿表单里的地址 + 密钥打一次 fetch-remote
    // （它本来就得先连通才能列模型），拿它的成败当连通性结论。
    $id('wizardTestConn')?.addEventListener('click', async () => {
      readWizardForm();
      if (!wizardTestReady()) return;
      wizard.test = { loading: true, ok: false, message: '' };
      renderWizardLayer();
      try {
        const result = await providerApi('/api/admin/ai-models/fetch-remote', {
          method: 'POST', throwOnError: true,
          body: JSON.stringify({ baseUrl: wizard.form.baseUrl.trim(), apiKey: wizard.form.apiKey.trim(), protocol: wizard.form.protocol, authMode: wizard.form.authMode })
        });
        const list = (result?.models || []).map(item => item.id || item.name || item).filter(Boolean).map(String);
        wizard.test = { loading: false, ok: true, message: `连接成功，读取到 ${list.length} 个模型` };
        wizard.remote.diagnostics = result?.diagnostics || [];
      } catch (error) {
        wizard.test = { loading: false, ok: false, message: error?.message || '连接失败' };
      }
      renderWizardLayer();
    });

    $id('wizardFetchRemote')?.addEventListener('click', async () => {
      readWizardForm();
      if (!/^https?:\/\/.+/i.test(wizard.form.baseUrl.trim())) { wizard.remote.error = '请先填写有效的 BaseURL'; renderWizardLayer(); return; }
      wizard.remote.loading = true;
      wizard.remote.error = '';
      wizard.remote.diagnostics = [];
      wizard.modelMessage = '';
      renderWizardLayer();
      try {
        // throwOnError：默认的 api() 会把非 2xx 的响应吞成 null，导致上游的真实原因
        // （403 分组停用、404 路径不对…）全被换成一句笼统的兜底文案。
        const result = await providerApi('/api/admin/ai-models/fetch-remote', {
          method: 'POST', throwOnError: true,
          body: JSON.stringify({ baseUrl: wizard.form.baseUrl.trim(), apiKey: wizard.form.apiKey.trim(), protocol: wizard.form.protocol, authMode: wizard.form.authMode })
        });
        const list = wizardCandidates(result?.models || []);
        wizard.remote.diagnostics = result?.diagnostics || [];
        if (!list.length) {
          wizard.remote.error = '供应商没有返回可用的模型列表';
        } else {

          let added = 0;
          for (const row of list) {
            if (wizard.models.some(existing => existing.model === row.model)) continue;
            wizard.models.push(row);
            added += 1;
          }
          wizard.modelMessage = added === list.length
            ? `读取到 ${list.length} 个模型`
            : `读取到 ${list.length} 个模型，其中 ${added} 个是新的`;
        }
      } catch (error) {
        wizard.remote.error = error?.message || '拉取失败，可手动填写模型标识';
        wizard.remote.diagnostics = error?.payload?.diagnostics || [];
      }
      wizard.remote.loading = false;
      renderWizardLayer();
    });

    const addModel = rawId => {
      readWizardForm();
      const value = String(rawId || '').trim();
      if (!value) return;
      if (wizard.models.some(row => row.model === value)) { wizard.error = '这个模型已经在列表里了'; renderWizardLayer(); return; }
      wizard.error = '';

      wizard.models.push({ model: value, type: inferModelKind(value), enabled: true });
      renderWizardLayer();
    };
    $id('wizardAddModel')?.addEventListener('click', () => addModel($id('wizardManualModel')?.value));
    $id('wizardManualModel')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); addModel(event.target.value); }
    });
    $id('wizardModelTypeFilter')?.addEventListener('change', event => {
      wizard.modelFilter = event.target.value;
      applyWizardModelFilters();
    });
    $id('wizardModelSearch')?.addEventListener('input', event => {
      wizard.modelSearch = event.target.value;
      applyWizardModelFilters();
    });
    host.querySelectorAll('[data-wizard-enabled]').forEach(box => {
      box.addEventListener('change', () => {
        const index = Number(box.dataset.wizardEnabled);
        if (wizard.models[index]) wizard.models[index].enabled = box.checked;
        renderWizardLayer();
      });
    });
    host.querySelectorAll('[data-wizard-kind]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = Number(btn.dataset.wizardKind);
        const row = wizard.models[index];
        if (!row) return;
        row.type = btn.dataset.kind;
        // 类别换了以后原来的请求形态可能不再适用 → 回落到 auto，别留一个非法组合
        if (!requestProfileOptionsFor(row.type).some(option => option.value === row.requestProfile)) row.requestProfile = '';
        renderWizardLayer();
      });
    });
    host.querySelectorAll('#wizardImageTaskMode,#wizardVideoTaskMode').forEach(select => {
      select.addEventListener('change', () => {
        readWizardForm();
        // 任务模式只在用户真的选过时才写进表单（否则下拉里的默认值会被物化成显式配置）。
        // 它决定「查询接口 / 取消接口」出不出现，必须重绘。
        wizard.form[select.id === 'wizardImageTaskMode' ? 'imageTaskMode' : 'videoTaskMode'] = select.value;
        renderWizardLayer();
      });
    });
    host.querySelectorAll('[data-wizard-reference]').forEach(box => {
      box.addEventListener('change', () => {
        readWizardForm();
        const picked = new Set(wizard.form.referenceInputModes || []);
        if (box.checked) picked.add(box.dataset.wizardReference); else picked.delete(box.dataset.wizardReference);
        wizard.form.referenceInputModes = REFERENCE_MODE_OPTIONS.map(option => option.value).filter(value => picked.has(value));
        renderWizardLayer();
      });
    });
    host.querySelectorAll('[data-wizard-upload-kind]').forEach(box => {
      box.addEventListener('change', () => {
        readWizardForm();
        const picked = new Set(wizard.form.fileUploadMediaKinds || []);
        if (box.checked) picked.add(box.dataset.wizardUploadKind); else picked.delete(box.dataset.wizardUploadKind);
        wizard.form.fileUploadMediaKinds = REFERENCE_KIND_OPTIONS.map(option => option.value).filter(value => picked.has(value));
        renderWizardLayer();
      });
    });
    host.querySelectorAll('[data-wizard-profile]').forEach(select => {
      select.addEventListener('change', () => {
        const index = Number(select.dataset.wizardProfile);
        if (wizard.models[index]) wizard.models[index].requestProfile = select.value;
        renderWizardLayer();
      });
    });
    host.querySelectorAll('[data-wizard-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        readWizardForm();
        wizard.models.splice(Number(btn.dataset.wizardRemove), 1);
        renderWizardLayer();
      });
    });
    host.querySelector('.wizard-endpoint-advanced')?.addEventListener('toggle', event => {
      wizardEndpointsOpen = event.target.open;
    });

    // ★ 取消 = 关掉向导**并且重绘分区**：只 renderWizardLayer() 的话，列表会停在
    //   「正在读取供应商配置…」占位上（那次加载因为向导开着被早退丢弃了）。
    $id('wizardCancel')?.addEventListener('click', () => { wizard = null; renderPane(); });
    $id('wizardPrev')?.addEventListener('click', () => { readWizardForm(); wizard.step -= 1; wizard.error = ''; wizardScrollReset = true; renderWizardLayer(); });
    $id('wizardNext')?.addEventListener('click', async () => {
      readWizardForm();
      if (!wizardStepValid()) {
        wizard.error = wizard.step === 0 ? '请填写供应商名称'
          : wizard.step === 1 ? '请填写有效的 HTTP/HTTPS BaseURL，并补全 API Key'
            : '至少启用一个模型';
        renderWizardLayer();
        return;
      }
      if (wizard.step < WIZARD_STEPS.length - 1) { wizard.step += 1; wizard.error = ''; wizardScrollReset = true; renderWizardLayer(); return; }
      await saveWizard();
    });
  }

  async function saveWizard() {
    const form = wizard.form;
    const rows = selectedWizardModels(wizard.models);
    if (!rows.length) { wizard.error = '请至少勾选一个要接入的模型'; renderWizardLayer(); return; }
    const baseUrl = form.baseUrl.trim().replace(/\/+$/, '');
    const payloadBase = {
      provider: form.name.trim(),
      baseUrl,
      docsUrl: form.docsUrl.trim(),
      protocol: form.protocol,
      authMode: form.authMode,
      submitPath: form.submitPath.trim(),
      statusPath: form.statusPath.trim(),
      imageTransport: form.imageTransport,
      imageSubmitPath: form.imageSubmitPath.trim(),
      imageEditPath: form.imageEditPath.trim(),
      textProtocol: form.textProtocol,
      logoUrl: form.logoUrl,
      providerProfile: form.providerProfile,
      referenceInputModes: [...(form.referenceInputModes || [])],
      fileUploadPath: form.fileUploadPath.trim(),
      fileUploadMediaKinds: [...(form.fileUploadMediaKinds || [])],
      imageTaskMode: form.imageTaskMode,
      imageStatusPath: form.imageStatusPath.trim(),
      imageCancelPath: form.imageCancelPath.trim(),
      videoTaskMode: form.videoTaskMode,
      videoCancelPath: form.videoCancelPath.trim()
    };
    if (form.apiKey.trim()) payloadBase.apiKey = form.apiKey.trim();

    const button = $id('wizardNext');
    if (button) { button.disabled = true; button.textContent = '保存中…'; }

    let failed = '';
    for (const row of rows) {
      const payload = {
        ...payloadBase, name: row.model.trim(), model: row.model.trim(), type: row.type,
        enabled: Boolean(row.enabled), requestProfile: row.requestProfile || ''
      };
      const result = await providerApi('/api/admin/ai-models', { method: 'POST', body: JSON.stringify(payload) });
      if (!result || result.error) { failed = result?.message || '保存失败'; break; }
    }
    if (failed) {
      wizard.error = failed;
      renderWizardLayer();
      return;
    }
    providerCache = null;
    expandedProviders.add(providerBucket({ name: form.name.trim(), baseUrl, protocol: form.protocol }));
    wizard = null;
    toast('供应商配置已保存', '✓');
    renderPane();
  }

  // ---------------------------------------------------------------- 外观设置

  function renderStartupPane(pane) {
    const startup=window.CanvasFlowStartup;
    if(!startup){pane.innerHTML='<h2 class="settings-pane-title">启动动画设置</h2><p class="settings-empty">启动动画组件未加载，请重新打开应用后重试。</p>';return;}
    const prefs=startup.preferences();
    const options=[{id:'water',title:'水位加载',badge:'默认方案 · 第一版',detail:'三角 Logo 内水位逐渐上涨，完成后回到白色 Logo，再进入工作区。'},
      {id:'flip',title:'水位加载 · 翻转展开',badge:'备用方案',detail:'Logo 水位涨满后翻转 180°，展开为应用窗口；画面由淡到清晰，放大进入工作区。'}];
    pane.innerHTML=`<header class="settings-pane-head"><div><h2 class="settings-pane-title">启动动画设置</h2><p class="settings-pane-sub">选择打开 CanvasFlow 时播放的动画。</p></div></header>
      <section class="settings-section startup-settings-enable"><div><div class="settings-label">播放启动动画</div><div class="settings-desc">关闭后直接进入创作画布。</div></div><label class="startup-settings-toggle"><input type="checkbox" data-startup-enabled ${prefs.enabled?'checked':''} aria-label="播放启动动画"><span></span></label></section>
      <div class="startup-settings-options" role="radiogroup" aria-label="启动动画方案">${options.map(option=>`<article class="startup-settings-card ${prefs.mode===option.id?'is-selected':''}">
        <label class="startup-settings-choice"><input type="radio" name="startup-animation-mode" value="${option.id}" ${prefs.mode===option.id?'checked':''}><span class="startup-settings-thumb is-${option.id}" aria-hidden="true"><span></span></span><span class="startup-settings-copy"><strong>${option.title}</strong><small>${option.badge}</small><span>${option.detail}</span></span></label>
        <button class="settings-add-btn is-ghost" type="button" data-startup-preview="${option.id}">预览动画</button></article>`).join('')}</div>
      <p class="settings-hint">修改后自动保存，下次启动生效。预览不会修改项目；动画播放时可随时跳过。</p><p class="settings-hint" data-startup-save-status role="status" aria-live="polite"></p>
      <button class="settings-reset" type="button" data-startup-reset>恢复默认启动动画</button>`;
    const persist=patch=>{
      if(!startup.savePreferences(patch)){const message=pane.querySelector('[data-startup-save-status]');if(message)message.textContent='设置保存失败，请检查本机存储是否可用。';toast('启动动画设置未保存，请重试','×');return false;}
      return true;
    };
    pane.querySelector('[data-startup-enabled]').addEventListener('change',event=>{
      if(persist({enabled:event.target.checked})){const message=pane.querySelector('[data-startup-save-status]');message.textContent=event.target.checked?'已开启，下次启动生效。':'已关闭，下次启动直接进入画布。';}
      else event.target.checked=!event.target.checked;
    });
    pane.querySelectorAll('input[name="startup-animation-mode"]').forEach(input=>input.addEventListener('change',()=>{
      if(persist({mode:input.value})){renderStartupPane(pane);pane.querySelector('[data-startup-save-status]').textContent='方案已保存，下次启动生效。';pane.querySelector(`input[value="${input.value}"]`)?.focus();}
      else renderStartupPane(pane);
    }));
    pane.querySelectorAll('[data-startup-preview]').forEach(button=>button.addEventListener('click',()=>{void startup.preview(button.dataset.startupPreview);}));
    pane.querySelector('[data-startup-reset]').addEventListener('click',()=>{if(persist({enabled:true,mode:'water'})){renderStartupPane(pane);toast('已恢复默认启动动画','✓');}});
  }

  function renderAppearancePane(pane) {
    const stored = appearanceState();
    const themeKey = currentThemeKey();
    const saved = stored[themeKey] || {};
    const accent = saved.accent || (themeKey === 'light' ? '#171717' : '#e7e5e4');
    const accent2 = saved.accent2 || '#4c9dff';

    pane.innerHTML = `<header class="settings-pane-head">
      <div>
        <h2 class="settings-pane-title">外观设置</h2>
        <p class="settings-pane-sub">调整界面明暗与交互强调色。</p>
      </div>
    </header>
    <section class="settings-section">
      <div class="settings-label">主题模式</div>
      <div class="settings-desc">在深色工作区与明亮工作区之间切换。</div>
      <div class="settings-mode-group">
        <button class="settings-mode-option ${themeKey === 'dark' ? 'is-active' : ''}" type="button" data-theme-mode="dark">深色</button>
        <button class="settings-mode-option ${themeKey === 'light' ? 'is-active' : ''}" type="button" data-theme-mode="light">浅色</button>
      </div>
    </section>
    <section class="settings-section">
      <div class="settings-label">主色</div>
      <div class="settings-desc">用于主按钮、开关和主要操作。修改后按钮上的文字会自动取反以保证可读。</div>
      <div class="settings-color-row">
        <input class="settings-color-input" type="color" id="accentPicker" value="${esc(accent)}" aria-label="主色" />
        <span class="settings-color-hex">${esc(accent)}</span>
        <div class="settings-swatches">${ACCENT_PRESETS.map(color => `<button class="settings-swatch ${color.toLowerCase() === accent.toLowerCase() ? 'is-selected' : ''}" type="button" data-accent-swatch="${color}" style="background:${color}" title="${color}"></button>`).join('')}</div>
      </div>
    </section>
    <section class="settings-section">
      <div class="settings-label">辅助色</div>
      <div class="settings-desc">用于选择边框、焦点环和连接强调。</div>
      <div class="settings-color-row">
        <input class="settings-color-input" type="color" id="accent2Picker" value="${esc(accent2)}" aria-label="辅助色" />
        <span class="settings-color-hex">${esc(accent2)}</span>
        <div class="settings-swatches">${ACCENT_PRESETS.map(color => `<button class="settings-swatch ${color.toLowerCase() === accent2.toLowerCase() ? 'is-selected' : ''}" type="button" data-accent2-swatch="${color}" style="background:${color}" title="${color}"></button>`).join('')}</div>
      </div>
    </section>
    <button class="settings-reset" type="button" id="appearanceReset">恢复默认外观</button>
    <div class="settings-toast" role="status" aria-live="polite"></div>`;

    pane.querySelectorAll('[data-theme-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const wantLight = btn.dataset.themeMode === 'light';
        const isLight = document.documentElement.classList.contains('light');
        if (wantLight !== isLight) {
          document.documentElement.classList.toggle('light', wantLight);
          try { localStorage.setItem('canvasflow-theme', wantLight ? 'light' : 'dark'); } catch { /* ignore */ }
        }
        applyAppearance();
        renderPane();
        toast(wantLight ? '已切换到浅色主题' : '已切换到深色主题', wantLight ? '☀' : '☾');
      });
    });
    const bindColor = (pickerId, swatchAttr, key) => {
      const picker = $id(pickerId);
      picker?.addEventListener('input', event => setAppearance({ [key]: event.target.value }));
      picker?.addEventListener('change', () => renderPane());
      pane.querySelectorAll(`[data-${swatchAttr}-swatch]`).forEach(btn => {
        btn.addEventListener('click', () => {
          setAppearance({ [key]: btn.getAttribute(`data-${swatchAttr}-swatch`) });
          renderPane();
        });
      });
    };
    bindColor('accentPicker', 'accent', 'accent');
    bindColor('accent2Picker', 'accent2', 'accent2');
    $id('appearanceReset')?.addEventListener('click', () => { resetAppearance(); renderPane(); toast('已恢复默认外观', '✓'); });
  }

  // ---------------------------------------------------------------- 通用设置

  function releaseNotesMarkup(id, version = '1.0.0') {
    return `<dialog class="about-updates-dialog" id="${esc(id)}" aria-labelledby="${esc(id)}Title">
        <header class="about-updates-heading"><h3 id="${esc(id)}Title"><span aria-hidden="true">✧</span> 近期更新</h3>
          <button type="button" class="about-dismiss" aria-label="关闭近期更新" data-updates-close>×</button>
        </header>
        <div class="about-updates-scroll" tabindex="0" aria-label="版本更新记录">
          <section class="about-release">
            <header><h4>v${esc(version)}</h4><span class="about-release-status">当前版本</span></header>
            <ul>
              <li><span class="about-change-type">新增</span><span>关闭窗口时可选择收起到系统托盘或直接退出，支持记住选择。</span></li>
              <li><span class="about-change-type">新增</span><span>关于 CanvasFlow 页面与近期更新记录。</span></li>
              <li><span class="about-change-type">新增</span><span>新版本首次启动自动展示近期更新，同一版本不再重复提醒。</span></li>
              <li><span class="about-change-type">新增</span><span>成片工作台接入 OpenFilm 剪辑能力，支持与 AI 助手联动。</span></li>
              <li><span class="about-change-type">改进</span><span>内置 CanvasFlow 供应商支持文本、图片、视频和音频子配置。</span></li>
              <li><span class="about-change-type">修复</span><span>完善项目保存、参考素材传递与生成任务切换时的状态处理。</span></li>
              <li><span class="about-change-type">新增</span><span>无限画布支持文本、图片、视频和音频节点，连接参考素材进行创作。</span></li>
              <li><span class="about-change-type">新增</span><span>素材管理、图片生成台与视频生成台。</span></li>
              <li><span class="about-change-type">新增</span><span>3D 导演台与本地 Blender 建模连接。</span></li>
              <li><span class="about-change-type">改进</span><span>Windows 安装程序支持自选安装位置。</span></li>
            </ul>
          </section>
        </div>
        <footer class="about-updates-footer"><button type="button" class="about-link about-link-primary" data-updates-close>知道了</button></footer>
      </dialog>`;
  }

  function bindReleaseNotesDialog(updates) {
    updates.querySelectorAll('[data-updates-close]').forEach(button => button.addEventListener('click', () => updates.close()));
    updates.addEventListener('click', event => {
      if (event.target !== updates) return;
      const bounds = updates.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) updates.close();
    });
  }

  let releaseNotesScheduled = false;
  function scheduleReleaseNotes() {
    const desktop = window.CanvasFlowDesktop;
    if (releaseNotesScheduled || !desktop?.getInfo || !desktop?.markReleaseNotesShown) return;
    releaseNotesScheduled = true;
    let started = false;
    const observer = new MutationObserver(checkReady);
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ['class', 'data-canvasflow-ready']});
    document.addEventListener('visibilitychange', checkReady);
    function checkReady() {
      if (started || document.documentElement.dataset.canvasflowReady !== 'true' || document.visibilityState === 'hidden') return;
      if (window.CanvasFlowStartup?.isPlaying() || document.documentElement.classList.contains('cf-startup-pending')) return;
      started = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', checkReady);
      void showPendingNotes();
    }
    async function showPendingNotes() {
      try {
        const info = await desktop.getInfo();
        if (!info.releaseNotesPending) return;
        const host = document.createElement('div');
        host.className = 'about-page about-updates-host';
        host.innerHTML = releaseNotesMarkup('startupUpdatesDialog', info.version);
        const updates = host.querySelector('dialog');
        bindReleaseNotesDialog(updates);
        const onKey = event => {
          if (event.key !== 'Escape' || !updates.open) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          updates.close();
        };
        updates.addEventListener('close', () => {
          window.removeEventListener('keydown', onKey, true);
          host.remove();
        }, {once: true});
        document.body.append(host);
        try { updates.showModal(); }
        catch (error) { host.remove(); throw error; }
        window.addEventListener('keydown', onKey, true);
        // Record only after the visible modal was successfully opened.
        await desktop.markReleaseNotesShown(info.version);
      } catch (error) { console.warn('无法完成新版本更新提示：', error); }
    }
    checkReady();
  }

  function bindAboutUpdater(pane) {
    const desktop = window.CanvasFlowDesktop;
    const button = pane.querySelector('[data-check-update]');
    const label = button.querySelector('[data-update-label]');
    const icon = button.querySelector('[data-update-icon]');
    const hint = pane.querySelector('[data-update-status]');
    let current = {status:'idle'}, disposed = false, submitting = false;
    const busyStates = ['checking', 'downloading', 'verifying', 'installing'];
    function paint(value) {
      if (disposed || !value) return;
      current = value;
      const busy = busyStates.includes(value.status);
      button.disabled = busy;
      button.classList.toggle('is-busy', busy);
      button.classList.toggle('about-link-primary', ['available', 'ready', 'downloading', 'verifying', 'installing'].includes(value.status));
      icon.textContent = ['available', 'ready'].includes(value.status) ? '↓' : '↻';
      label.textContent = value.status === 'checking' ? '检查中…'
        : value.status === 'downloading' ? `更新中 ${Math.max(0, Math.min(100, value.progress || 0))}%`
        : value.status === 'verifying' ? '更新中 · 校验文件'
        : value.status === 'installing' ? '更新中…'
        : ['available', 'ready'].includes(value.status) ? `更新到 v${value.version}` : '检查更新';
      hint.textContent = value.message || '';
      hint.hidden = !value.message;
      hint.classList.toggle('is-error', value.status === 'error');
    }
    const available = desktop?.getUpdateState && desktop?.checkForUpdates && desktop?.installUpdate;
    const unsubscribe = available ? desktop.onUpdateStatus?.(paint) : null;
    aboutUpdateCleanup = () => {disposed = true; unsubscribe?.();};
    if (available) desktop.getUpdateState().then(paint).catch(() => paint({status:'error', message:'无法读取更新状态，请重试'}));
    button.addEventListener('click', async () => {
      if (submitting) return;
      if (!available) { paint({status:'unsupported', message:'请在 Windows 安装版中检查和安装更新'}); return; }
      submitting = true;
      try {
        const install = ['available', 'ready'].includes(current.status);
        paint({...current, status:install ? 'downloading' : 'checking', message:''});
        paint(await (install ? desktop.installUpdate() : desktop.checkForUpdates()));
      } catch (error) { paint({status:'error', message:error.message || '更新失败，请重试'}); }
      finally {submitting = false;}
    });
  }

  async function renderAboutPane(pane) {
    pane.innerHTML = `<div class="about-page">
      <header class="settings-pane-head"><h2 class="settings-pane-title">关于 <span class="cf-brand-prism">CanvasFlow</span></h2></header>
      <section class="about-card" aria-label="CanvasFlow 产品信息">
        <div class="about-product">
          <div class="about-identity">
            <span class="about-logo" aria-hidden="true"><span class="brand-orb"></span></span>
            <div><h3 class="cf-brand-prism">CanvasFlow</h3><p class="about-version" data-desktop-version>版本 1.0.0 · 浏览器预览</p></div>
          </div>
          <a class="about-link about-link-primary" href="https://video.zzzapi.xyz/" target="_blank" rel="noopener noreferrer">官方网站 <span aria-hidden="true">↗</span></a>
        </div>
        <div class="about-intro">
          <p class="about-tagline">让灵感，开始流动。</p>
          <p class="about-description">从无限画布到完整影片，将 AI 生成、3D 预演与剪辑连接在同一个创作空间。</p>
          <div class="about-details"><span>项目与素材保存在本机</span><span>支持自定义 AI 供应商</span></div>
        </div>
        <div class="about-actions">
          <button type="button" class="about-link about-link-secondary" data-about-updates><span aria-hidden="true">✧</span> 近期更新</button>
          <span class="about-actions-note">了解 CanvasFlow 的最新变化</span>
          <div class="about-update-control">
            <button type="button" class="about-link about-link-secondary about-update-button" data-check-update><span data-update-icon aria-hidden="true">↻</span><span data-update-label>检查更新</span></button>
            <span class="about-update-status" data-update-status role="status" aria-live="polite" hidden></span>
          </div>
        </div>
        <div class="about-support">
          <span class="about-star" aria-hidden="true">★</span>
          <p>如果 CanvasFlow 帮到了你，请在 GitHub 点个 Star，这对我们意义重大</p>
          <span class="about-repo-status">开源仓库筹备中</span>
          <button type="button" class="about-dismiss" aria-label="关闭支持提示" data-about-dismiss>×</button>
        </div>
      </section>
      ${releaseNotesMarkup('aboutUpdatesDialog')}
    </div>`;
    const updates = pane.querySelector('#aboutUpdatesDialog');
    pane.querySelector('[data-about-updates]').addEventListener('click', () => updates.showModal());
    bindReleaseNotesDialog(updates);
    pane.querySelector('[data-about-dismiss]').addEventListener('click', () => pane.querySelector('.about-support')?.remove());
    bindAboutUpdater(pane);
    if (window.CanvasFlowDesktop?.getInfo) {
      try {
        const info = await window.CanvasFlowDesktop.getInfo();
        const label = pane.querySelector('[data-desktop-version]');
        if (label) label.textContent = '版本 ' + info.version;
      } catch {
        const label = pane.querySelector('[data-desktop-version]');
        if (label) label.textContent = '版本信息暂时无法读取';
      }
    }
  }

  async function renderDesktopCloseSetting(container) {
    const desktop = window.CanvasFlowDesktop;
    if (!desktop?.getInfo || !desktop?.setCloseAction) return;
    container.innerHTML = `<div class="settings-label">关闭主窗口时</div>
      <select aria-label="关闭主窗口时" data-close-action disabled>
        <option value="ask">每次询问</option>
        <option value="tray">收起到系统托盘</option>
        <option value="quit">直接退出</option>
      </select><p class="settings-hint" role="status">正在读取关闭设置…</p>`;
    const select = container.querySelector('select');
    const hint = container.querySelector('[role="status"]');
    try {
      const info = await desktop.getInfo();
      select.value = info.closeAction;
      select.disabled = false;
      hint.textContent = '可在这里更改“不再提醒”后记住的选择。';
      select.addEventListener('change', async () => {
        select.disabled = true;
        try {
          const result = await desktop.setCloseAction(select.value);
          info.closeAction = result.closeAction;
          hint.textContent = '关闭方式已保存';
        } catch {
          select.value = info.closeAction;
          hint.textContent = '保存失败，请重试';
        } finally { select.disabled = false; }
      });
    } catch { hint.textContent = '无法读取关闭设置，请重新打开应用后重试。'; }
  }

  async function renderGeneralPane(pane) {
    const prefs = canvasPrefs();
    // 超时是服务端全局配置：所有登录用户可见，但只有管理员能改。
    const isAdmin = true;
    const rows = [
      { key: 'miniMap', title: '鹰眼缩略图 (MiniMap)', desc: '在画布右下角显示小缩略图以快速辅助定位。' },
      { key: 'gridSnap', title: '吸附网格 (Grid Snapping)', desc: '拖拽节点时，自动按照 40px 的栅格进行物理边界吸附。' },
      { key: 'gridVisible', title: '显示网格 (Grid Visibility)', desc: '仅控制画布背景点阵是否显示，不影响节点拖拽吸附。' },
      { key: 'smartGuides', title: '智能辅助线 (Smart Guides)', desc: '拖动节点时显示对齐辅助线，并在 6px 范围内进行弱吸附。' }
    ];

    pane.innerHTML = `<header class="settings-pane-head">
      <div>
        <h2 class="settings-pane-title">通用设置</h2>
        <p class="settings-pane-sub">调整画布的一些物理特性与交互行为。</p>
      </div>
    </header>
    <section class="settings-section">
      ${rows.map(row => `<div class="settings-toggle-row">
        <div class="settings-toggle-copy"><strong>${esc(row.title)}</strong><small>${esc(row.desc)}</small></div>
        <button class="settings-switch ${prefs[row.key] ? 'is-on' : ''}" type="button" role="switch" aria-checked="${prefs[row.key] ? 'true' : 'false'}" data-pref-toggle="${row.key}"><span></span></button>
      </div>`).join('')}
    </section>
    <section class="settings-section">
      <div class="settings-label">生成任务超时</div>
      <div class="settings-desc">统一控制所有文本、图片和视频生成节点；修改后立即对后续生成生效。</div>
      <div class="settings-timeout-grid" id="timeoutGrid">${TIMEOUT_FIELDS.map(field => `
        <label class="settings-timeout-field" data-timeout-row="${field.key}">
          <span>${esc(field.label)}</span>
          <input type="number" data-timeout="${field.key}" value="" min="1" />
          <em>${esc(field.unit)}</em>
          <button type="button" class="settings-timeout-reset" data-timeout-reset="${field.key}" title="恢复默认值" aria-label="恢复默认值" hidden>↺</button>
        </label>`).join('')}</div>
      <p class="settings-hint" id="timeoutHint">正在读取服务端配置…</p>
    </section>
    <div class="settings-toast" role="status" aria-live="polite"></div>`;

    if (window.CanvasFlowDesktop?.getInfo) {
      const section = document.createElement('section');
      section.className = 'settings-section';
      pane.querySelector('.settings-pane-head').after(section);
      void renderDesktopCloseSetting(section);
    }

    pane.querySelectorAll('[data-pref-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.prefToggle;
        const next = setCanvasPref({ [key]: !canvasPrefs()[key] });
        btn.classList.toggle('is-on', Boolean(next[key]));
        btn.setAttribute('aria-checked', next[key] ? 'true' : 'false');
        panelToast(`${next[key] ? '已开启' : '已关闭'}${key === 'miniMap' ? '鹰眼缩略图' : key === 'gridSnap' ? '吸附网格' : key === 'gridVisible' ? '显示网格' : '智能辅助线'}`);
      });
    });

    const data = await deps.api('/api/settings');
    const hint = $id('timeoutHint');
    const globalTimeouts = data?.settings?.timeouts;
    if (!globalTimeouts || !data?.effective) {
      if (hint) hint.textContent = '无法读取本地服务配置，请检查服务是否启动。';
      return;
    }
    appSettings = data.settings;
    const limits = data.limits || {};
    // ★★ 双作用域（r803）：
    //   · 我的设置 = 全局默认 + **我的**个人覆盖 → 保存只影响自己账号，别人一点感觉都没有；
    //   · 全局默认（仅管理员）= 所有没做个人覆盖的账号的基线。
    //   只落盘「真的被改过」的项：点 ↺ 恢复默认 = 从覆盖层里删掉该键，
    //   以后管理员调全局默认时，没动过的项会自然跟着走。
    let timeoutScope = 'global';
    const timeoutOverrides = { ...(data.mine?.timeouts || {}) };
    const scopeValues = {
      mine: { ...globalTimeouts, ...timeoutOverrides },
      global: { ...globalTimeouts },
    };

    const paintTimeouts = () => {
      TIMEOUT_FIELDS.forEach(field => {
        const input = pane.querySelector(`[data-timeout="${field.key}"]`);
        if (!input) return;
        input.value = String(scopeValues[timeoutScope][field.key] ?? '');
        const range = limits[field.key];
        if (range) { input.min = String(range[0]); input.max = String(range[1]); }
        // 「已自定义」标记与「恢复默认」只在「我的设置」里有意义（全局默认没有覆盖层）。
        const custom = timeoutScope === 'mine' && Object.prototype.hasOwnProperty.call(timeoutOverrides, field.key);
        pane.querySelector(`[data-timeout-row="${field.key}"]`)?.classList.toggle('is-custom', custom);
        const reset = pane.querySelector(`[data-timeout-reset="${field.key}"]`);
        if (reset) reset.hidden = !custom;
      });
      if (hint) hint.textContent = timeoutScope === 'global'
        ? '本地生成任务的默认超时；修改后立即生效。'
        : '本地生成任务的默认超时；修改后立即生效。';
    };

    const applySettingsResult = result => {
      if (!result?.effective) return false;
      scopeValues.global = { ...(result.settings?.timeouts || {}) };
      const mine = { ...(result.mine?.timeouts || {}) };
      Object.keys(timeoutOverrides).forEach(key => delete timeoutOverrides[key]);
      Object.assign(timeoutOverrides, mine);
      scopeValues.mine = { ...scopeValues.global, ...mine };
      appSettings = result.settings;
      paintTimeouts();
      return true;
    };

    // payload = 数值 → 写入该作用域；null → 「我的设置」里恢复默认（从覆盖层移除）。
    const saveTimeout = async (key, payload) => {
      const result = await deps.api(`/api/settings?scope=${timeoutScope}`, {
        method: 'PUT',
        body: JSON.stringify({ timeouts: { [key]: payload } }),
      });
      if (!applySettingsResult(result)) { panelToast('保存失败，请重试'); paintTimeouts(); }
    };

    pane.querySelectorAll('[data-timeout-scope]').forEach(tab => {
      tab.addEventListener('click', () => {
        timeoutScope = tab.dataset.timeoutScope === 'global' ? 'global' : 'mine';
        pane.querySelectorAll('[data-timeout-scope]').forEach(other => {
          const active = other === tab;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        paintTimeouts();
      });
    });

    TIMEOUT_FIELDS.forEach(field => {
      const input = pane.querySelector(`[data-timeout="${field.key}"]`);
      input?.addEventListener('change', async () => {
        await saveTimeout(field.key, Number(input.value));
        panelToast(`${field.label}已更新`);
      });
      const reset = pane.querySelector(`[data-timeout-reset="${field.key}"]`);
      reset?.addEventListener('click', async event => {
        // 按钮在 label 里：别让它冒泡去聚焦输入框、也别触发 label 的默认行为。
        event.preventDefault();
        event.stopPropagation();
        await saveTimeout(field.key, null);
        panelToast(`${field.label}已恢复默认`);
      });
    });
    paintTimeouts();
  }

  // ---------------------------------------------------------------- 提示词编辑（仅管理员）

  /**
   * 画布内**所有预设**的提示词正文统一在这里管理。
   *
   * 产品约定（别改错方向）：
   *   · 只有管理员能打开这个分区、也只有在管理员这里才拿得到正文；
   *   · 普通用户/VIP 在画布内既看不到也改不了提示词，但他们点生成时，
   *     服务端会按节点上的 `presetScene` **直接把正文注入**给模型；
   *   · 与默认值相同的项不会落盘 —— 以后升级默认文案时，没被改过的项会自动跟着变。
   */
  /**
   * ★★★ 智能合成的字段模板 —— 一排可点击的「整块标注」（用户要求）。
   *   · 点一下 → 在光标处插入 `【字段名】`（整块模板，不是零散文字）；
   *   · 退格 / Delete 在标注边界（或标注内部）时**整块删除**，绝不会一个字一个字地啃；
   *   · 六个字段各有自己的颜色，一眼能区分（`.preset-field-chip` 与 `.preset-field-mark` 同色系）。
   *   ★ 字段名与智能合成的模板一一对应：时长 / 画面描述 / 景别 / 光影构图 / 对白旁白 / 音效。
   */
  const PROMPT_FIELD_TOKENS = [
    { name: '时长', cls: 'is-time' },
    { name: '画面描述', cls: 'is-plot' },
    { name: '景别', cls: 'is-size' },
    { name: '光影构图', cls: 'is-light' },
    { name: '对白旁白', cls: 'is-spoken' },
    { name: '音效', cls: 'is-sound' },
  ];
  const PROMPT_FIELD_RE = /【(时长|画面描述|景别|光影构图|对白旁白|音效)】/g;
  const PROMPT_FIELD_CLASS = Object.fromEntries(PROMPT_FIELD_TOKENS.map(field => [field.name, field.cls]));

  /**
   * 把正文渲染成带彩色标注的高亮层。
   * ★ textarea 里仍是**普通纯文本**（`【时长】` 就是四个字符），彩色只是这一层的显示效果 ——
   *   所以保存进库的正文不会被污染，和底部 `#promptInput` 那套镜像层是同一个思路。
   */
  function renderPresetMirror(area, mirror) {
    if (!area || !mirror) return;
    const source = String(area.value || '');
    let out = '';
    let cursor = 0;
    source.replace(PROMPT_FIELD_RE, (full, name, offset) => {
      out += esc(source.slice(cursor, offset));
      out += `<span class="preset-field-mark ${PROMPT_FIELD_CLASS[name] || ''}">${esc(full)}</span>`;
      cursor = offset + full.length;
      return full;
    });
    out += esc(source.slice(cursor));
    mirror.innerHTML = out || '';
    mirror.scrollTop = area.scrollTop;
    mirror.scrollLeft = area.scrollLeft;
  }

  /** 整块删除：光标贴着标注边界（或落在标注内部）时，一次删掉整个 `【字段】`。 */
  function deletePresetField(area, mirror, event) {
    if (!area || (event.key !== 'Backspace' && event.key !== 'Delete')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    if (typeof start !== 'number' || typeof end !== 'number') return;
    const ranges = [];
    String(area.value || '').replace(PROMPT_FIELD_RE, (full, name, offset) => {
      ranges.push({ start: offset, end: offset + full.length });
      return full;
    });
    if (!ranges.length) return;
    let from = null;
    let to = null;
    if (start !== end) {
      const hit = ranges.filter(range => range.start < end && range.end > start);
      if (!hit.length) return;
      from = Math.min(start, hit[0].start);
      to = Math.max(end, hit[hit.length - 1].end);
      if (from === start && to === end) return;
    } else {
      const within = range => start > range.start && start < range.end;
      const target = event.key === 'Backspace'
        ? ranges.find(range => range.end === start || within(range))
        : ranges.find(range => range.start === start || within(range));
      if (!target) return;
      from = target.start;
      to = target.end;
    }
    event.preventDefault();
    area.setRangeText('', from, to, 'end');
    area.dispatchEvent(new Event('input', { bubbles: true }));
    renderPresetMirror(area, mirror);
  }

  // ============================================================ 模型管理（r858）
  // 画布所有选项面板的「登记表」：音频规格（按上游模型）/ 视频规格（全局）/ 摄像机库。
  // ★ 2026-09-25 从 `app.js` 的 AUDIO_SPEC_SCHEMAS / VIDEO_SPEC_* 与 `camera-library.js`
  //   迁到服务端（`server-data/model-specs.json`），画布改读 `/api/model-specs`。
  //   这里就是那份数据的编辑器 —— 改完保存，画布**不用改代码、不用发版**就跟着变。
  // ★★ 保存按 kind 局部提交（服务端 `PUT /api/admin/model-specs` 也是按 kind 替换）：
  //    整份替换的写法会让「改音频」顺手把摄像机库清空 —— 本项目在别处踩过这类覆盖。
  // ★★★ r865：模型来源从「手输上游名」改成**从已启用模型里选**（用户需求）——
  //    手输要求用户记得住上游标识（`seed-audio-1.0` 这种），还得与「供应商设置」里的
  //    「模型标识」逐字一致，错一个字符就报错且看不出原因。现在直接列已启用的模型，
  //    选中后自动带出上游名 + 该模型已有的登记行。
  //    生命周期：模型**停用或删除**后，它在登记表里的行会被服务端连带清掉（见 `prune_model_specs`）——
  //    所以这里下拉里看不到已停用的模型，也不该为它们做配置（做了也永远不会生效）。
  //    ★ 保留手输作为后备：上游有、但本地还没接入的模型（先登记规格、之后再接）仍需这条路。
  let specDraft = null;            // 编辑中的整份登记表（服务端数据的深拷贝）
  let specDirtyKinds = new Set();  // 改过哪些 kind —— 保存时逐个提交
  let specKind = 'audio';
  // ★ r860：图片 / 视频规格也升级成**按模型**登记（与音频同构）→ 每个 kind 各记「正在编辑哪个模型」。
  const specModels = { audio: '', video: '', image: '' };
  // ★ r865：「已启用模型」清单（含未接入登记的），用于「从已启用模型」选择器。
  //   每条 `{model, name, kind, modelId, registered}`；由 `loadEnabledModels()` 填充。
  let specEnabledModels = [];
  let specEnabledLoaded = false;
  let specCameraGroup = 'camera';
  const SPEC_WILDCARD = '*';
  const SPEC_WILDCARD_LABEL = '默认（未登记的模型）';
  // 「已启用模型」选择器里一行的显示文案：展示名（上游名）。展示名可能与上游名相同 → 去重。
  function specEnabledLabel(item) {
    const display = String(item.name || '').trim();
    const upstream = String(item.model || '').trim();
    const reg = item.registered ? '' : ' · 未配置';
    if (!display || display === upstream) return `${upstream}${reg}`;
    return `${display}（${upstream}）${reg}`;
  }
  // 上游模型名 → 该模型在模型表里的 id（「从上游拉取」带上它，服务端据此精确回查密钥）。
  function specEnabledModelId(kind, upstream) {
    const hit = specEnabledModels.find(item => item.kind === kind && item.model === upstream);
    return hit ? String(hit.modelId || '') : '';
  }
  // 按 kind 取「已启用模型」清单（音频规格只列 tts，图片规格只列生图…）。
  function specEnabledFor(kind) {
    return specEnabledModels.filter(item => item.kind === kind);
  }
  // 画布**有专门控件**的语义键：行里写这些 key = 接管对应控件；写别的 key = 模型专有参数。
  const SPEC_SEMANTIC_KEYS = {
    audio: [],
    image: ['aspectRatio', 'resolution', 'quality', 'count'],
    video: ['aspectRatio', 'resolution', 'duration', 'generateAudio', 'count'],
  };
  const SPEC_SEMANTIC_HINT = {
    audio: '',
    image: '比例 / 清晰度 / 画质 / 数量 是画布底栏控件的键 —— 写这几个 key 会接管对应控件；写别的 key（如 <code>version</code>）就是「模型专有参数」，取这里的<strong>默认值</strong>直接进请求体（以前只能直接改 ai-models.json）。',
    video: '比例 / 清晰度 / 数量 是画布底栏控件的键；写别的 key 就是「模型专有参数」，取这里的默认值合并进请求体（当前只对 <code>openai-video</code> 系协议的模型生效 —— 可灵 / 百炼的字段名与层级是平台钉死的，不能改名）。',
  };

  const SPEC_KINDS = [['audio', '音频规格'], ['video', '视频规格'], ['camera', '摄像机库'], ['image', '图片规格']];
  const SPEC_CAMERA_GROUPS = [['camera', '相机'], ['lens', '镜头'], ['focal', '焦距'], ['aperture', '光圈']];

  function specDeepCopy(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  async function renderModelRegistryPane(pane) {
    const isAdmin = true;
    pane.innerHTML = `<header class="settings-pane-head">
      <div>
        <h2 class="settings-pane-title">模型管理</h2>
        <p class="settings-pane-sub">画布上所有选项面板的内容都在这里维护 —— 音频规格 / 视频规格 / 摄像机库 / 图片规格。<strong>改动立即对本地所有项目生效</strong>，不需要改前端代码。</p>
      </div>
      <button class="settings-add-btn" type="button" id="specSaveBtn"><span>保存修改</span></button>
    </header>
    <section class="settings-section" id="specRoot">
      <p class="settings-hint">正在读取登记表…</p>
    </section>
    <div class="settings-toast" role="status" aria-live="polite"></div>`;

    if (!isAdmin) {
      const denied = $id('specRoot');
      if (denied) denied.innerHTML = '<div class="settings-empty">模型管理暂时不可用。</div>';
      return;
    }

    const data = await deps.api('/api/admin/model-specs');
    const root = $id('specRoot');
    if (!root) return;
    const specs = data?.specs;
    if (!specs || typeof specs !== 'object') {
      root.innerHTML = '<div class="settings-empty">无法读取模型配置，请检查本地服务。</div>';
      return;
    }
    specDraft = specDeepCopy(specs);
    specDirtyKinds = new Set();
    // ★ r865：先取「已启用模型」清单再渲染 —— 下拉要按它分组（待配置 / 已配置 / 本地未启用）。
    //   拿不到也不阻断：清单为空时自动回落「只能手输」，面板照常可用。
    await loadEnabledModels(false);
    Object.keys(specModels).forEach(kind => {
      if (!specModels[kind] || !specDraft[kind] || !Object.prototype.hasOwnProperty.call(specDraft[kind], specModels[kind])) {
        specModels[kind] = Object.keys(specDraft[kind] || {})[0] || '';
      }
    });
    renderSpecBody();
    $id('specSaveBtn')?.addEventListener('click', saveModelSpecs);
  }

  function renderSpecBody() {
    const root = $id('specRoot');
    if (!root || !specDraft) return;
    root.innerHTML = `
      <div class="settings-scope-tabs spec-tabs">
        ${SPEC_KINDS.map(([id, label]) => `<button type="button" class="settings-scope-tab${specKind === id ? ' is-active' : ''}" data-spec-kind="${id}">${label}</button>`).join('')}
      </div>
      <div id="specPaneBody"></div>`;
    root.querySelectorAll('[data-spec-kind]').forEach(btn => btn.addEventListener('click', () => {
      specKind = btn.dataset.specKind;
      renderSpecBody();
    }));
    const body = $id('specPaneBody');
    if (!body) return;
    if (specKind === 'camera') renderCameraSpecEditor(body);
    else renderSpecModelEditor(body, specKind);
  }

  function specMarkDirty(kind) {
    specDirtyKinds.add(kind);
  }

  // ---------------------------------------------------------- 「已启用模型」清单（r865）
  /**
   * 把「模型管理」底下拉框的数据源从「手输」换成「已启用模型」。
   *
   * ★★★ 为什么要这一步（用户需求 + 实际踩坑）：
   *   手输上游名要求用户**记得住**而且与「供应商设置」里的「模型标识」逐字一致
   *   （`seed-audio-1.0` / `doubao-tts-2.0`），错一个字符的报错是
   *   「缺少接口地址或 API Key」—— 看起来像密钥问题，其实是名字对不上，非常难自查。
   *   现在直接从已启用的模型里选：**只有画布真正能用的模型才配得上做规格配置**。
   *
   * ★ 分类口径与服务端 `/api/ai/models` 一致：以 `usages` 为准（缺省回落 `type`）。
   *   音频规格列 `audio`、图片规格列 `image`、视频规格列 `video`。
   * ★ 只收 `enabled` 的 —— 停用的模型不会出现在画布选择器里，给它配规格永远不会生效
   *   （服务端也会在停用/删除时把它的登记行清掉，两边口径一致）。
   * ★ 拿不到清单（非管理员 / 接口失败）时静默降级为「只能手输」，不阻断面板。
   */
  async function loadEnabledModels(force) {
    if (specEnabledLoaded && !force) return specEnabledModels;
    let models = [];
    try {
      const cache = await loadProviders(force);
      models = (cache?.items || []).flatMap(group => group.models || []);
    } catch (error) {
      models = [];
    }
    const KIND_BY_USAGE = { audio: 'audio', image: 'image', video: 'video' };
    const KIND_BY_TYPE = { i2t: 'text', t2i: 'image', video: 'video', tts: 'audio' };
    specEnabledModels = models
      .filter(model => model && model.enabled)
      .map(model => {
        const usages = Array.isArray(model.usages) && model.usages.length
          ? model.usages
          : [KIND_BY_TYPE[String(model.type || '')] || ''];
        // 一个模型可能同时属于多种用途（实测 `kling-v3` 既在 t2i 也在 video）→ 每个 kind 各出一行。
        const kinds = [...new Set(usages.map(u => KIND_BY_USAGE[u]).filter(Boolean))];
        return kinds.map(kind => ({
          modelId: String(model.id || ''),
          model: String(model.model || '').trim(),
          name: String(model.name || '').trim(),
          provider: String(model.provider || '').trim(),
          kind,
        }));
      })
      .flat()
      .filter(item => item.model);
    // 标记哪些已经登记过（下拉里显示「· 未配置」，一眼看出还差哪个没配）。
    specEnabledModels.forEach(item => {
      const table = (specDraft && specDraft[item.kind]) || {};
      item.registered = Array.isArray(table[item.model]);
    });
    specEnabledLoaded = true;
    return specEnabledModels;
  }

  // ---------------------------------------------------------- 按模型登记（音频 / 图片 / 视频同构）
  /**
   * 行式「生成提交规格」编辑器 —— 音频 / 图片 / 视频**三类共用同一套 UI**。
   *
   * ★★★ r860：为什么三类要长得一样。它们描述的是同一件事：
   *   「这个模型有哪些提交参数、发什么**上游字段名**、有哪些可选值、默认值是哪个」。
   *   以前只有音频是行式，图片/视频是「全局一套裸值列表」→ 模型专有参数（`tt-image-2.5` 的
   *   `version`、banana-2 的 `imageSize`）根本没地方登记，只能直接改 `ai-models.json`。
   * ★ `'*'`（默认）那一项 = **兜底行**：没登记的模型用它 —— 迁移前那套全局配置就落在那里，
   *   所以升级后行为不突变。
   */
  function renderSpecModelEditor(body, kind) {
    if (!specDraft[kind] || typeof specDraft[kind] !== 'object') specDraft[kind] = {};
    const table = specDraft[kind];
    const registered = Object.keys(table);
    if (!specModels[kind] || !Object.prototype.hasOwnProperty.call(table, specModels[kind])) {
      // ★ r865：默认选中「第一个已启用但还没配置的模型」，而不是登记表里的第一项 ——
      //   用户打开这一页的目的是「给哪个模型配规格」，直接落在待办上最省事。
      const pending = specEnabledFor(kind).find(item => !Array.isArray(table[item.model]));
      specModels[kind] = (pending && pending.model) || registered[0] || '';
    }
    const model = specModels[kind];
    const rows = Array.isArray(table[model]) ? table[model] : [];
    const semantic = SPEC_SEMANTIC_KEYS[kind] || [];
    const subject = kind === 'audio' ? '音频' : kind === 'image' ? '图片' : '视频';
    const enabled = specEnabledFor(kind);
    // ★ 已启用但还没登记的模型 —— 下拉里排在前面并标「未配置」（它们才是要做的事）。
    const pendingModels = enabled.filter(item => !Array.isArray(table[item.model]));
    const enabledNames = enabled.map(item => item.model);
    // 登记表里有、但**已启用清单里没有**的（上游已停用/删除，或纯手输的历史键）——
    //   服务端在停用/删除时会连带清掉，所以这里通常只剩「手输但本地还没接入」的那类，
    //   特意列出来是为了让用户看得见、能自己删。
    const orphan = registered.filter(name => name !== SPEC_WILDCARD && !enabledNames.includes(name));
    const isWildcard = model === SPEC_WILDCARD;
    const modelId = specEnabledModelId(kind, model);
    const desc = kind === 'audio'
      ? '画布上的音频节点按<strong>所选模型</strong>显示规格行 —— 换模型，面板就跟着变。这里登记的就是「每个模型该显示哪几行、每行有哪些选项」。'
      : `画布上的${subject}节点按<strong>所选模型</strong>取规格行。${SPEC_SEMANTIC_HINT[kind] || ''}`;

    body.innerHTML = `
      <div class="settings-desc">${desc}</div>
      <div class="spec-bar">
        <select class="spec-select" id="specModelSelect">
          ${pendingModels.length ? `<optgroup label="已启用 · 待配置（${pendingModels.length}）">
            ${pendingModels.map(item => `<option value="${esc(item.model)}"${item.model === model ? ' selected' : ''}>${esc(specEnabledLabel(item))}</option>`).join('')}
          </optgroup>` : ''}
          ${enabled.filter(item => Array.isArray(table[item.model])).length ? `<optgroup label="已启用 · 已配置">
            ${enabled.filter(item => Array.isArray(table[item.model])).map(item => `<option value="${esc(item.model)}"${item.model === model ? ' selected' : ''}>${esc(specEnabledLabel(item))}（${(table[item.model] || []).length} 行）</option>`).join('')}
          </optgroup>` : ''}
          ${orphan.length ? `<optgroup label="已登记 · 本地未启用（${orphan.length}）">
            ${orphan.map(name => `<option value="${esc(name)}"${name === model ? ' selected' : ''}>${esc(name)}（${(table[name] || []).length} 行）</option>`).join('')}
          </optgroup>` : ''}
          ${SPEC_WILDCARD in table ? `<optgroup label="兜底">
            <option value="${SPEC_WILDCARD}"${isWildcard ? ' selected' : ''}>${esc(SPEC_WILDCARD_LABEL)}（${(table[SPEC_WILDCARD] || []).length} 行）</option>
          </optgroup>` : ''}
          ${(enabled.length || registered.length) ? '' : '<option value="">（没有任何已启用的模型）</option>'}
          ${model && !enabledNames.includes(model) && model !== SPEC_WILDCARD && !orphan.includes(model)
            ? `<optgroup label="当前"><option value="${esc(model)}" selected>${esc(model)}（新增，未保存）</option></optgroup>` : ''}
        </select>
        <button type="button" class="spec-btn" id="specDropModel"${model ? '' : ' disabled'}>删除该模型</button>
        <button type="button" class="spec-btn" id="specFetchUpstream"${model && !isWildcard ? '' : ' disabled'}>从上游拉取</button>
        <button type="button" class="spec-btn" id="specSyncEnabled">同步已启用模型</button>
      </div>
      ${(enabled.length || registered.length) ? '' : '<div class="settings-hint">还没有任何<strong>已启用</strong>的模型 —— 请先到「供应商设置」接入供应商、并在模型列表里启用要用的模型，再回来配置规格。这里只列出已启用的模型。</div>'}
      <details class="spec-manual">
        <summary>手动指定上游模型名（本地还没接入的模型）</summary>
        <div class="spec-bar spec-bar--manual">
          <input class="spec-input spec-input--new" id="specNewModel" placeholder="上游模型名，如 ${kind === 'audio' ? 'suno-v4.5' : kind === 'image' ? 'banana-2' : 'wan-2.1'}" spellcheck="false" />
          <button type="button" class="spec-btn" id="specAddModel">新增模型</button>
          <button type="button" class="spec-btn" id="specAddWildcard"${SPEC_WILDCARD in table ? ' disabled' : ''}>加兜底行</button>
        </div>
        <div class="settings-hint">上游有、但本地还没接入的模型才需要手输。已接入的请直接从上面的下拉里选 —— 手输的名字必须与「模型标识」逐字一致，否则「从上游拉取」会取不到密钥。</div>
      </details>
      ${semantic.length ? `<div class="settings-hint">画布认识的键：${semantic.map(key => `<code>${key}</code>`).join(' / ')} —— 从上游拉回来的 key 是<strong>上游的参数名</strong>；如果它其实就是画布的比例 / 清晰度，请把「属性名」改成上面这几个键，上游字段名留在右边那一栏。</div>` : ''}
      <div class="spec-rows">
        ${rows.length ? rows.map((row, index) => specRowHtml(row, index, semantic)).join('')
                      : `<div class="settings-empty">${isWildcard ? '兜底行是空的 —— 未登记的模型会用画布内置默认。' : '这个模型没有登记任何规格行 —— 画布上它的面板会是空的（与 LibTV 的 <code>settings: null</code> 同义，这是合法的）。'}</div>`}
      </div>
      <button type="button" class="spec-btn spec-btn--wide" id="specAddRow"${model ? '' : ' disabled'}>+ 添加规格行</button>`;

    $id('specModelSelect')?.addEventListener('change', event => {
      specModels[kind] = event.target.value;
      renderSpecBody();
    });
    $id('specDropModel')?.addEventListener('click', () => {
      if (!model) return;
      delete table[model];
      specMarkDirty(kind);
      specModels[kind] = Object.keys(table)[0] || '';
      renderSpecBody();
      panelToast('已删除该模型的登记（记得点「保存修改」）', '!');
    });
    // 「同步已启用模型」：为每个已启用、还没登记的模型**建一个空行组**，
    //   让用户一眼看到「还有哪几个没配」，然后逐个「从上游拉取」。
    $id('specSyncEnabled')?.addEventListener('click', async () => {
      await loadEnabledModels(true);
      const pending = specEnabledFor(kind).filter(item => !Array.isArray(table[item.model]));
      if (!pending.length) { panelToast('所有已启用模型都已登记', '✓'); return; }
      pending.forEach(item => { table[item.model] = []; });
      specMarkDirty(kind);
      specModels[kind] = pending[0].model;
      renderSpecBody();
      panelToast(`已为 ${pending.length} 个已启用模型建立登记（点「从上游拉取」自动填参数）`, '✓');
    });
    $id('specAddModel')?.addEventListener('click', () => {
      const input = $id('specNewModel');
      const name = String(input?.value || '').trim();
      if (!name) { panelToast('请先填写上游模型名', '!'); return; }
      if (!Array.isArray(table[name])) table[name] = [];
      specMarkDirty(kind);
      specModels[kind] = name;
      renderSpecBody();
      panelToast(`已新增「${name}」，可点「从上游拉取」自动填参数`, '✓');
    });
    $id('specAddWildcard')?.addEventListener('click', () => {
      if (!Array.isArray(table[SPEC_WILDCARD])) table[SPEC_WILDCARD] = [];
      specMarkDirty(kind);
      specModels[kind] = SPEC_WILDCARD;
      renderSpecBody();
      panelToast('已加兜底行 —— 未登记的模型会用它', '✓');
    });
    $id('specFetchUpstream')?.addEventListener('click', () => fetchSpecsFromUpstream(model, kind));
    $id('specAddRow')?.addEventListener('click', () => {
      if (!model) return;
      if (!Array.isArray(table[model])) table[model] = [];
      table[model].push({ key: '', label: '', field: '', options: [], default: null });
      specMarkDirty(kind);
      renderSpecBody();
    });
    bindSpecRowEvents(body, () => table[model], kind);
  }

  function specRowHtml(row, index, semanticKeys) {
    const options = Array.isArray(row.options) ? row.options : [];
    // 画布认识的语义键做成 datalist：管理员可以直接选，也可以自己敲（模型专有参数）。
    const listId = `specKeyList-${index}`;
    const list = (semanticKeys || []).length
      ? `<datalist id="${listId}">${semanticKeys.map(key => `<option value="${esc(key)}"></option>`).join('')}</datalist>`
      : '';
    return `<article class="spec-row" data-row="${index}">
      <div class="spec-row-head">
        <input class="spec-input spec-input--label" data-spec-field="label" value="${esc(row.label || '')}" placeholder="显示名（如「生成模式」）" spellcheck="false" />
        <input class="spec-input spec-input--key" data-spec-field="key" value="${esc(row.key || '')}" placeholder="属性名（如 make_instrumental）" spellcheck="false"${list ? ` list="${listId}"` : ''} />${list}
        <input class="spec-input spec-input--key" data-spec-field="field" value="${esc(row.field || '')}" placeholder="上游字段名（留空 = 同属性名）" spellcheck="false" />
        <button type="button" class="spec-btn spec-btn--danger" data-spec-drop-row="${index}">删除</button>
      </div>
      <div class="spec-options">
        ${options.map((option, j) => `<div class="spec-option" data-option="${j}">
          <input class="spec-input spec-input--value" data-spec-field="value" value="${esc(String(option.value ?? ''))}" placeholder="值" spellcheck="false" />
          <input class="spec-input spec-input--olabel" data-spec-field="label" value="${esc(option.label || '')}" placeholder="显示文字" spellcheck="false" />
          <label class="spec-default"><input type="radio" name="specDefault${index}" data-spec-default="${j}"${String(row.default) === String(option.value) ? ' checked' : ''} />默认</label>
          <button type="button" class="spec-btn spec-btn--tiny" data-spec-drop-option="${j}" title="删除这个选项">×</button>
        </div>`).join('')}
        <button type="button" class="spec-btn spec-btn--tiny" data-spec-add-option="${index}">+ 选项</button>
      </div>
    </article>`;
  }

  /** 规格行的输入 / 增删事件。`rowsOf()` 返回当前正在编辑的那个行数组。 */
  function bindSpecRowEvents(body, rowsOf, kind) {
    body.querySelectorAll('[data-spec-field]').forEach(input => {
      input.addEventListener('input', () => {
        const rows = rowsOf();
        const rowEl = input.closest('[data-row]');
        if (!Array.isArray(rows) || !rowEl) return;
        const row = rows[Number(rowEl.dataset.row)];
        if (!row) return;
        const optionEl = input.closest('[data-option]');
        const field = input.dataset.specField;
        const previous = optionEl ? ((row.options || [])[Number(optionEl.dataset.option)] || {})[field]
                                  : row[field];
        let value = input.value;
        // 原来存的是数字就别把它变成字符串 —— `sampleRate: 24000` 发成 `"24000"`
        // 上游可能不认（同一个参数在不同网关上的宽容度不一样，别赌）。
        if (typeof previous === 'number' && value.trim() !== '' && !Number.isNaN(Number(value))) {
          value = Number(value);
        }
        if (optionEl) {
          const option = (row.options || [])[Number(optionEl.dataset.option)];
          if (option) option[field === 'value' ? 'value' : 'label'] = value;
        } else {
          row[field] = value;
        }
        specMarkDirty(kind);
      });
    });
    body.querySelectorAll('[data-spec-default]').forEach(radio => {
      radio.addEventListener('change', () => {
        const rows = rowsOf();
        const rowEl = radio.closest('[data-row]');
        if (!Array.isArray(rows) || !rowEl) return;
        const row = rows[Number(rowEl.dataset.row)];
        const option = row && (row.options || [])[Number(radio.dataset.specDefault)];
        if (!row || !option) return;
        row.default = option.value;
        specMarkDirty(kind);
      });
    });
    body.querySelectorAll('[data-spec-drop-row]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rows = rowsOf();
        if (!Array.isArray(rows)) return;
        rows.splice(Number(btn.dataset.specDropRow), 1);
        specMarkDirty(kind);
        renderSpecBody();
      });
    });
    body.querySelectorAll('[data-spec-add-option]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rows = rowsOf();
        const row = Array.isArray(rows) ? rows[Number(btn.dataset.specAddOption)] : null;
        if (!row) return;
        if (!Array.isArray(row.options)) row.options = [];
        row.options.push({ value: '', label: '' });
        specMarkDirty(kind);
        renderSpecBody();
      });
    });
    body.querySelectorAll('[data-spec-drop-option]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rows = rowsOf();
        const rowEl = btn.closest('[data-row]');
        const row = Array.isArray(rows) && rowEl ? rows[Number(rowEl.dataset.row)] : null;
        if (!row || !Array.isArray(row.options)) return;
        row.options.splice(Number(btn.dataset.specDropOption), 1);
        specMarkDirty(kind);
        renderSpecBody();
      });
    });
  }

  async function fetchSpecsFromUpstream(modelName, kind = 'audio') {
    const name = String(modelName || '').trim();
    if (!name) { panelToast('请先选择或填写上游模型名', '!'); return; }
    panelToast(`正在从上游拉取 ${name} 的参数表…`);
    // ★★★ 带上 modelId（r865）：API Key 不下发浏览器，服务端要自己回查凭据。
    //   只传上游名时它只能靠「模型标识字符串相等」去猜，用户手输的展示名 / 大小写不一致
    //   就会回查落空 → 报「缺少接口地址或 API Key」（用户看到的却是"拉取失败"）。
    //   带上 modelId 是**精确命中**，彻底绕开这层猜测。
    const result = await deps.api('/api/admin/model-specs/fetch-upstream', {
      method: 'POST',
      body: JSON.stringify({ model: name, modelId: specEnabledModelId(kind, name) }),
    });
    if (!result || result.error) { panelToast(result?.message || '拉取失败', '!'); return; }
    const rows = Array.isArray(result.rows) ? result.rows : [];
    if (!rows.length) {
      // ★ 区分「上游确实没有选项参数」与「拉到了但类型都不合适」——
      //   后者在 meta.totalParams 里能看出来，提示要说得准，否则用户以为接口坏了。
      const total = Number(result.meta?.totalParams || 0);
      panelToast(total
        ? `上游声明了 ${total} 个参数，但都不是可配置的选项（或必传文本）`
        : '上游没有返回可用的选项参数（可能这个模型没有 select 类参数）', '!');
      return;
    }
    if (!specDraft[kind] || typeof specDraft[kind] !== 'object') specDraft[kind] = {};
    // ★ 拉回来的 key 以上游名为准（服务端已把登记表的展示名归一成上游 `model`）。
    const key = String(result.model || name).trim();
    specDraft[kind][key] = specDeepCopy(rows);
    specMarkDirty(kind);
    specModels[kind] = key;
    renderSpecBody();
    panelToast(`已拉取 ${rows.length} 行，确认无误后点右上角「保存修改」`, '✓');
  }

  // ---------------------------------------------------------- 摄像机库
  function renderCameraSpecEditor(body) {
    const camera = specDraft.camera && typeof specDraft.camera === 'object' ? specDraft.camera : (specDraft.camera = {});
    if (!SPEC_CAMERA_GROUPS.some(([id]) => id === specCameraGroup)) specCameraGroup = 'camera';
    const items = Array.isArray(camera[specCameraGroup]) ? camera[specCameraGroup] : [];
    body.innerHTML = `
      <div class="settings-desc">图片节点的「摄像机」开关会把这些条目的 <strong>prompt 正文</strong>拼进提示词。带「默认」的那一条是首次打开时的选中项。</div>
      <div class="settings-scope-tabs spec-tabs">
        ${SPEC_CAMERA_GROUPS.map(([id, label]) => `<button type="button" class="settings-scope-tab${specCameraGroup === id ? ' is-active' : ''}" data-camera-group="${id}">${label}（${(camera[id] || []).length}）</button>`).join('')}
      </div>
      <div class="spec-cam-list">
        ${items.length ? items.map((item, index) => `<article class="spec-cam-item" data-cam-row="${index}">
          <div class="spec-row-head">
            <input class="spec-input spec-input--label" data-cam-field="name" value="${esc(item.name || '')}" placeholder="显示名（如 Sony Venice）" spellcheck="false" />
            <input class="spec-input spec-input--key" data-cam-field="key" value="${esc(item.key || '')}" placeholder="标识（留空自动生成）" spellcheck="false" />
            <input class="spec-input spec-input--key" data-cam-field="type" value="${esc(item.type || '')}" placeholder="分类（Digital / Film…）" spellcheck="false" />
            <label class="spec-default"><input type="radio" name="specCamDefault" data-cam-default="${index}"${item.default ? ' checked' : ''} />默认</label>
            <button type="button" class="spec-btn spec-btn--danger" data-cam-drop="${index}">删除</button>
          </div>
          <textarea class="spec-textarea" data-cam-field="prompt" rows="2" spellcheck="false" placeholder="拼进提示词的正文，如「, Hollywood movie style」">${esc(item.prompt || '')}</textarea>
        </article>`).join('') : '<div class="settings-empty">这一组还是空的。</div>'}
      </div>
      <button type="button" class="spec-btn spec-btn--wide" id="specAddCameraItem">+ 添加条目</button>`;

    body.querySelectorAll('[data-camera-group]').forEach(btn => btn.addEventListener('click', () => {
      specCameraGroup = btn.dataset.cameraGroup;
      renderSpecBody();
    }));
    body.querySelectorAll('[data-cam-field]').forEach(input => {
      input.addEventListener('input', () => {
        const rowEl = input.closest('[data-cam-row]');
        if (!rowEl || !Array.isArray(camera[specCameraGroup])) return;
        const item = camera[specCameraGroup][Number(rowEl.dataset.camRow)];
        if (!item) return;
        item[input.dataset.camField] = input.value;
        specMarkDirty('camera');
      });
    });
    body.querySelectorAll('[data-cam-default]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (!Array.isArray(camera[specCameraGroup])) return;
        camera[specCameraGroup].forEach((item, index) => {
          if (Number(radio.dataset.camDefault) === index) item.default = true;
          else delete item.default;
        });
        specMarkDirty('camera');
      });
    });
    body.querySelectorAll('[data-cam-drop]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!Array.isArray(camera[specCameraGroup])) return;
        camera[specCameraGroup].splice(Number(btn.dataset.camDrop), 1);
        specMarkDirty('camera');
        renderSpecBody();
      });
    });
    $id('specAddCameraItem')?.addEventListener('click', () => {
      if (!Array.isArray(camera[specCameraGroup])) camera[specCameraGroup] = [];
      camera[specCameraGroup].push({ key: '', name: '', prompt: '', thumb: '', type: '' });
      specMarkDirty('camera');
      renderSpecBody();
    });
  }

  // ---------------------------------------------------------- 保存
  async function saveModelSpecs() {
    if (!specDraft) return;
    // 只提交改过的 kind —— 一个都没改时按当前子区提交（等于「用服务端归一化后的结果回填」）。
    const kinds = specDirtyKinds.size ? Array.from(specDirtyKinds) : [specKind];
    for (const kind of kinds) {
      const result = await deps.api('/api/admin/model-specs', {
        method: 'PUT',
        body: JSON.stringify({ kind, data: specDraft[kind] }),
      });
      if (!result || result.error) {
        panelToast(result?.message || '保存失败', '!');
        return;
      }
      // 用服务端归一化后的结果回填 —— 被丢弃的脏行会当场消失，看得见才敢信。
      if (result.specs) specDraft[kind] = specDeepCopy(result.specs[kind]);
    }
    specDirtyKinds = new Set();
    // 保存后服务端可能把某些脏行丢掉（归一化）→ 重新校准「每个 kind 正在编辑哪个模型」。
    Object.keys(specModels).forEach(kind => {
      if (!specModels[kind] || !specDraft[kind] || !Object.prototype.hasOwnProperty.call(specDraft[kind], specModels[kind])) {
        specModels[kind] = Object.keys(specDraft[kind] || {})[0] || '';
      }
    });
    renderSpecBody();
    panelToast('登记表已保存，画布会立即同步', '✓');
    // ★ 让画布**立刻**重拉（否则要等 30 秒心跳或切窗口回来）。
    notifyModelsChanged();
  }

  // =========================================================================
  // 模型定价（r884，用户需求）
  //
  // 用户需求原文：「在偏好设置中的模型管理下面提示词编辑上面加入模型定价 —— 从供应商中，
  //   对每个模型单独定价；有按 token 计费，有按次计费；按 token 计费要能**准确扣费**
  //   （上游有些模型先预扣、生成完后多退少补），并且能和上游同步 token 数。」
  //
  // 口径（必须与服务端 `MODEL_PRICING_FIELDS` 一字对应，改一边就要改另一边）：
  //   · 按次    → `perCall`       积分 / 次
  //   · 按 Token → `inputPer1k` / `outputPer1k`   积分 / 千 token（输入、输出**分开**定价）
  //   · 按秒    → `perSecond`     积分 / 秒
  //
  // ★★★ 「全 0 = 未定价 = **完全不扣费**」（不是「扣 0 积分」）—— 所以卡片上必须把「未定价」
  //   标出来并单独筛选，否则管理员会以为"填了 0 就是免费"，其实是根本不计价（等于漏扣）。
  //   判据 `pricingIsSet()` 与服务端 `pricing_is_set()` 必须完全一致。
  // ★ 计费口径本身也能在这里改 —— 定价和口径是同一件事的两半，逼管理员跳回「供应商设置」
  //   改口径是没道理的（本项目「多入口一致性」的教训）。
  // ★ 只读**供应商**（`scope=global`，即 `ownerId` 为空、所有人可见可调的那些模型）。
  // =========================================================================
  let pricingModels = [];
  let pricingDraft = null;        // { [modelId]: { billing, pricing } }
  let pricingDirty = new Set();
  // ★ r888：「已启用」是**范围**，不是定价状态 —— 供应商下有 50+ 个模型，管理员真正要
  //   定价的只有启用的那几个。对齐「模型管理」里的「同步已启用模型」（那里也是先收拢已启用模型）。
  let pricingTab = 'all';         // all | enabled | unpriced | priced
  let pricingQuery = '';
  const PRICING_TABS = [['all', '全部'], ['enabled', '已启用'], ['unpriced', '未定价'], ['priced', '已定价']];

  function emptyPricing() {
    return { perCall: 0, inputPer1k: 0, outputPer1k: 0, perSecond: 0, precharge: true, note: '', updatedAt: '' };
  }

  function normalizePricingDraft(value) {
    const raw = value && typeof value === 'object' ? value : {};
    const number = key => {
      const parsed = Number(raw[key]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
    return {
      cacheReadPer1k: number('cacheReadPer1k'), cacheWritePer1k: number('cacheWritePer1k'), longInputPer1k: number('longInputPer1k'), longOutputPer1k: number('longOutputPer1k'), longCacheReadPer1k: number('longCacheReadPer1k'), longCacheWritePer1k: number('longCacheWritePer1k'),
      perCall: number('perCall'), inputPer1k: number('inputPer1k'),
      outputPer1k: number('outputPer1k'), perSecond: number('perSecond'),
      precharge: raw.precharge !== false,
      note: String(raw.note || '').slice(0, 200),
      updatedAt: String(raw.updatedAt || ''),
    };
  }

  /** 该模型在**当前口径**下是否已定价。★ 必须与服务端 `pricing_is_set()` 判据一致。 */
  function pricingIsSet(billing, pricing) {
    const value = pricing || {};
    if (billing === 'per-token') return Number(value.inputPer1k) > 0 || Number(value.outputPer1k) > 0;
    if (billing === 'per-second') return Number(value.perSecond) > 0;
    return Number(value.perCall) > 0;
  }

  /** 一句话说清「这个模型多少钱」，列表里一眼可读。 */
  function pricingSummary(billing, pricing) {
    if (!pricingIsSet(billing, pricing)) return '未定价（不扣费）';
    if (billing === 'per-token') return `${pricing.inputPer1k} 积分/千输入 · ${pricing.outputPer1k} 积分/千输出`;
    if (billing === 'per-second') return `${pricing.perSecond} 积分/秒`;
    return `${pricing.perCall} 积分/次`;
  }

  function pricingDraftOf(modelId) {
    return pricingDraft && pricingDraft[modelId] ? pricingDraft[modelId] : null;
  }

  function updatePricingCounts() {
    const total = pricingModels.length;
    const priced = pricingModels.filter(model => {
      const draft = pricingDraftOf(model.id);
      return draft && pricingIsSet(draft.billing, draft.pricing);
    }).length;
    const enabled = pricingModels.filter(model => model.enabled).length;
    const labels = {
      all: `全部 ${total}`, enabled: `已启用 ${enabled}`,
      unpriced: `未定价 ${total - priced}`, priced: `已定价 ${priced}`,
    };
    document.querySelectorAll('[data-pricing-filter]').forEach(btn => {
      const label = labels[btn.dataset.pricingFilter];
      if (label) btn.textContent = label;
    });
  }

  /** 页签高亮。★ 单独抽出来：「拉取已启用模型」会主动把范围切到「已启用」，需要复用同一段同步逻辑。 */
  function syncPricingTabs() {
    document.querySelectorAll('[data-pricing-filter]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.pricingFilter === pricingTab);
    });
  }

  function applyPricingVisibility() {
    const list = $id('pricingList');
    if (!list) return;
    let shown = 0;
    list.querySelectorAll('[data-pricing-card]').forEach(card => {
      const draft = pricingDraftOf(card.dataset.pricingCard);
      const set = draft ? pricingIsSet(draft.billing, draft.pricing) : false;
      // ★ `enabled`（模型在不在跑）与 `priced / unpriced`（有没有定价）是两个维度，不能并成一个枚举。
      const passTab = pricingTab === 'all'
        || (pricingTab === 'enabled' ? card.dataset.pricingEnabled === '1'
          : (pricingTab === 'priced' ? set : !set));
      const passQuery = !pricingQuery || String(card.dataset.search || '').includes(pricingQuery);
      card.hidden = !(passTab && passQuery);
      if (!card.hidden) shown += 1;
    });
    const empty = $id('pricingListEmpty');
    if (empty) {
      empty.hidden = shown > 0;
      if (!empty.hidden) {
        // ★ 空态要分清「筛没了」和「真的一个都没启用」—— 后者得给下一步动作（去模型管理启用）。
        empty.textContent = pricingTab === 'enabled'
          ? '供应商下还没有已启用的模型 —— 先去「模型管理」启用，再回来定价。'
          : '没有匹配的模型。换个关键词，或把筛选切回「全部」。';
      }
    }
  }

  function syncPricingCard(card, modelId) {
    const draft = pricingDraftOf(modelId);
    if (!draft) return;
    const summary = card.querySelector('[data-pricing-summary]');
    const set = pricingIsSet(draft.billing, draft.pricing);
    if (summary) {
      summary.textContent = pricingSummary(draft.billing, draft.pricing);
      summary.classList.toggle('is-unpriced', !set);
    }
    card.classList.toggle('is-dirty', pricingDirty.has(modelId));
    const save = $id('pricingSaveBtn');
    if (save) {
      save.classList.toggle('is-dirty', pricingDirty.size > 0);
      const label = save.querySelector('span');
      if (label) label.textContent = pricingDirty.size ? `保存全部修改（${pricingDirty.size}）` : '保存全部修改';
    }
    updatePricingCounts();
    applyPricingVisibility();
  }

  /** 只重画**这一张卡**的字段区 —— 换口径时字段集合会变（按次 1 个输入框、按 Token 2 个 + 开关）。 */
  function renderPricingFields(card, modelId) {
    const body = card.querySelector('[data-pricing-body]');
    const draft = pricingDraftOf(modelId);
    if (!body || !draft) return;
    const pricing = draft.pricing;
    const number = (field, label, step) => `<label class="pricing-field"><span>${esc(label)}</span>
        <input type="number" min="0" step="${step}" inputmode="decimal" data-pricing-num="${field}" value="${pricing[field] || 0}"></label>`;
    let fields;
    if (draft.billing === 'per-token') {
      fields = number('inputPer1k', '积分 / 千输入 token', '0.0000000001')
        + number('outputPer1k', '积分 / 千输出 token', '0.0000000001')
        + `<label class="pricing-switch"><input type="checkbox" data-pricing-precharge${pricing.precharge ? ' checked' : ''}>
             <span>上游先预扣、生成完成后按真实用量多退少补</span></label>`;
    } else if (draft.billing === 'per-second') {
      fields = number('perSecond', '积分 / 秒', '0.0000000001');
    } else {
      fields = number('perCall', '积分 / 次', '0.0000000001');
    }
    if (draft.billing === 'per-token' && (pricing.cacheReadPer1k || pricing.longInputPer1k)) {
      fields += number('cacheReadPer1k', '缓存读取 / 千 Token', '0.0000000001') + number('cacheWritePer1k', '缓存创建 / 千 Token', '0.0000000001');
      if (pricing.longInputPer1k) fields += '<p class="settings-hint">输入超过 272,000 Token：整次请求采用以下长上下文单价</p>'
        + number('longInputPer1k', '长上下文 / 千输入 Token', '0.0000000001') + number('longOutputPer1k', '长上下文 / 千输出 Token', '0.0000000001')
        + number('longCacheReadPer1k', '长上下文 / 千缓存读取', '0.0000000001') + number('longCacheWritePer1k', '长上下文 / 千缓存创建', '0.0000000001');
    }
    body.innerHTML = `<label class="pricing-field pricing-field-billing"><span>计费口径</span>
        <select data-pricing-billing>${BILLING_LABEL_OPTIONS.map(([value, label]) => `<option value="${value}"${value === draft.billing ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      ${fields}
      <label class="pricing-field pricing-field-note"><span>备注</span>
        <input type="text" maxlength="200" data-pricing-note placeholder="例如：按上游 usage 结算 / 上游按次不区分 token" value="${esc(pricing.note)}"></label>`;
  }

  function pricingCardHtml(model) {
    const draft = pricingDraftOf(model.id);
    const search = [model.name, model.model, model.provider].filter(Boolean).join(' ').toLowerCase();
    return `<article class="pricing-card" data-pricing-card="${esc(model.id)}" data-pricing-enabled="${model.enabled ? '1' : '0'}" data-search="${esc(search)}">
      <div class="pricing-card-head">
        <div class="pricing-card-title">
          <strong>${esc(model.name || model.id)}</strong>
          <span>${esc(model.provider || '未标注供应商')} · ${esc(model.model || '')}</span>
        </div>
        ${model.enabled ? '' : '<span class="pricing-card-badge is-off">未启用</span>'}
        <span class="pricing-card-summary${pricingIsSet(draft.billing, draft.pricing) ? '' : ' is-unpriced'}" data-pricing-summary>${esc(pricingSummary(draft.billing, draft.pricing))}</span>
        <!-- ★★★ r889（用户需求）：「上游渠道死了，这个模型卡片一直滞留在这里占位置」——
             每张定价卡都要能**删掉**。删除走的是与「模型管理」同一条服务端链路
             （DELETE /api/admin/ai-models/&lt;id&gt;），删完这个模型从「模型定价 / 模型管理 /
             供应商设置」一起消失，生成时也不再能选到它。 -->
        <button type="button" class="pricing-card-del" data-pricing-delete="${esc(model.id)}" title="删除这个模型（上游渠道停用时用）" aria-label="删除模型 ${esc(model.name || model.id)}">${svgIcon('close')}</button>
      </div>
      <div class="pricing-card-body" data-pricing-body></div>
    </article>`;
  }

  /** 把服务端返回的模型列表灌进状态。
   *  ★ 已在 `pricingDirty` 里的模型**保留本地草稿** —— 「拉取已启用模型」是刷新动作，
   *    不能把管理员改了一半、还没保存的价格静默冲掉。 */
  function applyPricingModels(models) {
    const list = (models || []).filter(model => model && model.id);
    const drafts = pricingDraft || {};
    const next = {};
    list.forEach(model => {
      const kept = pricingDirty.has(model.id) ? drafts[model.id] : null;
      next[model.id] = kept || {
        billing: BILLING_MODES.includes(model.billing) ? model.billing : 'per-call',
        pricing: normalizePricingDraft(model.pricing),
      };
    });
    pricingModels = list;
    pricingDraft = next;
  }

  /** ★ r888「拉取已启用模型」：重新从服务端取一次，并把范围切到「已启用」。
   *  对齐「模型管理」的「同步已启用模型」—— 先收拢真正在跑的模型，别在 50+ 张卡里翻找。 */
  async function pullEnabledPricingModels() {
    const btn = $id('pricingFetchEnabled');
    const label = btn ? btn.querySelector('span') : null;
    if (btn) btn.disabled = true;
    if (label) label.textContent = '拉取中…';
    const result = await providerApi('/api/admin/ai-models');
    if (btn) btn.disabled = false;
    if (label) label.textContent = '拉取已启用模型';
    if (!result || result.error) {
      panelToast(result?.message || '拉取失败，请确认已登录且具备管理员权限');
      return;
    }
    applyPricingModels(result.models || []);
    pricingTab = 'enabled';
    syncPricingTabs();
    updatePricingCounts();
    renderPricingList();
    const enabled = pricingModels.filter(model => model.enabled).length;
    panelToast(enabled
      ? `已拉取 ${enabled} 个已启用模型`
      : '供应商下还没有已启用的模型，请先去「模型管理」启用');
  }

  /**
   * ★★★ r889（用户需求）：「模型定价」里每张卡也要能删 ——
   *   「很多上游渠道死了，这个模型卡片一直滞留在这里占位置」。
   *   ★ 与「模型管理」的 `removeModel()` 是**同一条服务端链路**（DELETE /api/admin/ai-models/<id>），
   *     但**不能复用**它 —— 那个函数靠 `providerCache` 定位模型，而定价面板的状态是
   *     `pricingModels` / `pricingDraft`（两套缓存，各管各的）。
   *   ★ 破坏性操作：删掉后模型从「模型定价 / 模型管理 / 供应商设置」一起消失，必须确认。
   */
  async function removePricingModel(modelId) {
    const model = pricingModels.find(item => item.id === modelId);
    if (!model) return;
    const name = model.name || model.model || modelId;
    const ok = window.confirm(
      `删除模型「${name}」？\n\n`
      + '· 它会从「模型定价」「模型管理」「供应商设置」里一起消失\n'
      + '· 生成时也不再能选到它\n'
      + '· 此操作不可撤销'
    );
    if (!ok) return;
    const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(modelId)}`, { method: 'DELETE', throwOnError: false });
    if (result && result.error) { panelToast(result.message || '删除失败'); return; }
    pricingDirty.delete(modelId);
    // 重建草稿表（`applyPricingModels` 会保留其它仍在 `pricingDirty` 里、没保存的改价）。
    applyPricingModels(pricingModels.filter(item => item.id !== modelId));
    providerCache = null;                  // 供应商面板缓存里还有这个模型
    updatePricingCounts();
    renderPricingList();
    panelToast(`已删除模型「${name}」`);
  }

  function renderPricingList() {
    const list = $id('pricingList');
    if (!list) return;
    list.innerHTML = pricingModels.map(pricingCardHtml).join('') + '<div class="pricing-empty" id="pricingListEmpty" hidden>没有匹配的模型。换个关键词，或把筛选切回「全部」。</div>';
    list.querySelectorAll('[data-pricing-card]').forEach(card => {
      renderPricingFields(card, card.dataset.pricingCard);
      syncPricingCard(card, card.dataset.pricingCard);
    });
    // 事件委托挂在**容器**上（卡片字段区会被整块重画，挂在卡片上会随重画一起丢）。
    if (list.dataset.pricingBound !== '1') {
      list.dataset.pricingBound = '1';
      list.addEventListener('change', event => {
        const card = event.target.closest('[data-pricing-card]');
        const draft = card ? pricingDraftOf(card.dataset.pricingCard) : null;
        if (!draft) return;
        if (event.target.matches('[data-pricing-billing]')) {
          draft.billing = BILLING_MODES.includes(event.target.value) ? event.target.value : 'per-call';
          renderPricingFields(card, card.dataset.pricingCard);
        } else if (event.target.matches('[data-pricing-precharge]')) {
          draft.pricing.precharge = event.target.checked;
        } else {
          return;
        }
        pricingDirty.add(card.dataset.pricingCard);
        syncPricingCard(card, card.dataset.pricingCard);
      });
      list.addEventListener('input', event => {
        const card = event.target.closest('[data-pricing-card]');
        const draft = card ? pricingDraftOf(card.dataset.pricingCard) : null;
        if (!draft) return;
        if (event.target.matches('[data-pricing-num]')) {
          const parsed = Number(event.target.value);
          draft.pricing[event.target.dataset.pricingNum] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        } else if (event.target.matches('[data-pricing-note]')) {
          draft.pricing.note = event.target.value.slice(0, 200);
        } else {
          return;
        }
        pricingDirty.add(card.dataset.pricingCard);
        syncPricingCard(card, card.dataset.pricingCard);
      });
      // ★ r889：删除定价卡（上游渠道停用后清位置）—— 同样用容器委托，卡片整块重画也不会丢监听。
      list.addEventListener('click', event => {
        const button = event.target.closest('[data-pricing-delete]');
        if (button) removePricingModel(button.dataset.pricingDelete);
      });
    }
    applyPricingVisibility();
  }

  async function saveModelPricing() {
    if (!pricingDirty.size) { panelToast('没有需要保存的修改'); return; }
    const ids = [...pricingDirty];
    const btn = $id('pricingSaveBtn');
    const label = btn ? btn.querySelector('span') : null;
    if (btn) btn.disabled = true;
    let done = 0;
    let failed = 0;
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      if (label) label.textContent = `保存中 ${index + 1}/${ids.length}`;
      const draft = pricingDraftOf(id);
      if (!draft) { failed += 1; continue; }
      const result = await providerApi(`/api/admin/ai-models/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ billing: draft.billing, pricing: { ...draft.pricing } }),
      });
      if (result && !result.error) {
        done += 1;
        pricingDirty.delete(id);
        // 用服务端回传的值覆盖草稿（含自动盖的 updatedAt）—— 前端不自己造时间。
        if (result.model && result.model.pricing) draft.pricing = normalizePricingDraft(result.model.pricing);
      } else {
        failed += 1;
      }
    }
    providerCache = null;                  // 供应商面板缓存里还是旧价格
    if (btn) btn.disabled = false;
    // ★★★ 顺序**必须**是「先重绘、后 toast」：`renderPane()` 会重建 pane 的 innerHTML，
    //   连带把 `.settings-toast` 节点换成新的 —— 先 toast 再重绘 = 提示写进了一个马上被丢掉的节点，
    //   表现为「点了保存，价格存上了但界面毫无反应」。（本项目已在删除模型那里踩过一次，这里差点再踩。）
    renderPane();
    panelToast(failed ? `已保存 ${done} 个，${failed} 个失败` : `已保存 ${done} 个模型的定价`, failed ? '!' : '✓');
  }

  async function renderPricingPane(pane) {
    const isAdmin = true;
    pane.innerHTML = `<header class="settings-pane-head">
      <div>
        <h2 class="settings-pane-title">模型定价</h2>
        <p class="settings-pane-sub">1 积分 = ¥1，余额和实扣金额保留两位小数，单价最多保留 10 位小数。原有媒体模型按上游全分组最高组合单价 × 1.2；特惠1按上游积分÷10后×1.2，特惠2按元价×1.2，文本按上游0.12分组价×1.2。<br>从<strong>供应商</strong>逐个模型定价 —— 按次 / 按 Token / 按秒。<strong>全 0 = 未定价 = 完全不扣费</strong>；保存后立即对所有账号生效。按 Token 的模型会按上游真实 <code>usage</code> 结算（先预扣、生成完多退少补）。</p>
      </div>
      <button class="settings-add-btn" type="button" id="pricingSaveBtn"><span>保存全部修改</span></button>
    </header>
    <section class="settings-section" id="pricingRoot">
      <p class="settings-hint">正在读取供应商模型…</p>
    </section>
    <div class="settings-toast" role="status" aria-live="polite"></div>`;

    if (!isAdmin) {
      const denied = $id('pricingRoot');
      if (denied) denied.innerHTML = '<div class="settings-empty">模型定价只有管理员可以查看和修改。</div>';
      return;
    }

    const result = await providerApi('/api/admin/ai-models');
    const root = $id('pricingRoot');
    if (!root) return;
    if (!result || result.error) {
      root.innerHTML = `<div class="settings-empty">${esc(result?.message || '无法读取模型，请检查本地服务。')}</div>`;
      return;
    }
    pricingDirty = new Set();
    applyPricingModels(result.models || []);
    pricingQuery = '';
    root.innerHTML = `
      <div class="pricing-toolbar">
        <div class="settings-scope-tabs pricing-filters">
          ${PRICING_TABS.map(([id]) => `<button type="button" class="settings-scope-tab${pricingTab === id ? ' is-active' : ''}" data-pricing-filter="${id}">${id}</button>`).join('')}
        </div>
        <label class="pricing-search"><span>⌕</span><input type="search" id="pricingSearch" placeholder="搜索模型名称 / 标识 / 供应商"></label>
        <button class="settings-add-btn is-ghost" type="button" id="pricingFetchEnabled"><span>拉取已启用模型</span></button>
      </div>
      <div class="pricing-list" id="pricingList"></div>`;
    root.querySelectorAll('[data-pricing-filter]').forEach(btn => btn.addEventListener('click', () => {
      pricingTab = btn.dataset.pricingFilter;
      syncPricingTabs();
      applyPricingVisibility();
    }));
    const search = $id('pricingSearch');
    if (search) search.addEventListener('input', () => {
      pricingQuery = search.value.trim().toLowerCase();
      applyPricingVisibility();
    });
    updatePricingCounts();
    renderPricingList();
    $id('pricingSaveBtn')?.addEventListener('click', saveModelPricing);
    $id('pricingFetchEnabled')?.addEventListener('click', pullEnabledPricingModels);
  }

  async function renderPromptsPane(pane) {
    const isAdmin = true;
    pane.innerHTML = `<header class="settings-pane-head">
      <div>
        <h2 class="settings-pane-title">提示词编辑</h2>
        <p class="settings-pane-sub">画布内所有预设的提示词都在这里统一管理。编辑文本、图片、音频和视频生成使用的预设提示词。</p>
      </div>
    </header>
    <section class="settings-section" id="presetPromptSection">
      <p class="settings-hint" id="presetPromptHint">正在读取…</p>
    </section>
    <div class="settings-toast" role="status" aria-live="polite"></div>`;

    const section = $id('presetPromptSection');
    const hint = $id('presetPromptHint');
    if (!isAdmin) {
      if (hint) hint.textContent = '提示词编辑暂时不可用。';
      return;
    }

    const render = async () => {
      const data = await deps.api('/api/preset-prompts');
      const prompts = data?.prompts;
      if (!prompts || typeof prompts !== 'object') {
        if (hint) hint.textContent = '无法读取提示词，请确认已登录。';
        return;
      }
      const list = Object.entries(prompts);
      const customCount = list.filter(([, item]) => item.custom).length;
      section.innerHTML = `
        <div class="settings-label">预设提示词（共 ${list.length} 项${customCount ? ` · 其中 ${customCount} 项已自定义` : ''}）</div>
        <div class="settings-desc">改动会立即对所有人生效（全局一套）。清空某一项 = 该项恢复默认；与默认值相同的项不会落盘。</div>
        <div class="preset-prompt-list">
          ${list.map(([scene, item]) => `<article class="preset-prompt-card${item.custom ? ' is-custom' : ''}" data-preset-card="${esc(scene)}">
            <header class="preset-prompt-head">
              <strong>${esc(item.title || scene)}</strong>
              ${item.custom ? '<span class="preset-prompt-badge">已自定义</span>' : ''}
              <small>${esc(item.desc || '')}</small>
            </header>
            <div class="preset-prompt-editor">
              <div class="preset-prompt-mirror" data-preset-mirror="${esc(scene)}" aria-hidden="true"></div>
              <textarea class="preset-prompt-text" data-preset-text="${esc(scene)}" spellcheck="false" rows="5">${esc(item.prompt || '')}</textarea>
            </div>
            <footer class="preset-prompt-foot">
              <div class="preset-prompt-fields">
                ${PROMPT_FIELD_TOKENS.map(field => `<button type="button" class="preset-field-chip ${field.cls}" data-preset-field="${esc(field.name)}" title="插入「${esc(field.name)}」标注（整块插入、整块删除）">${esc(field.name)}</button>`).join('')}
              </div>
              <span class="preset-prompt-count" data-preset-count="${esc(scene)}">${(item.prompt || '').length} 字</span>
            </footer>
          </article>`).join('')}
        </div>
        <div class="preset-prompt-actions">
          <button type="button" class="settings-btn" id="presetSaveBtn">保存修改</button>
          <button type="button" class="settings-btn ghost" id="presetResetAllBtn">全部恢复默认</button>
        </div>`;

      // 字数实时跟手 + 镜像高亮层同步 + 字段标注的整块插入 / 整块删除
      section.querySelectorAll('[data-preset-text]').forEach(area => {
        const card = area.closest('[data-preset-card]');
        const mirror = card?.querySelector('[data-preset-mirror]');
        const sync = () => {
          const count = section.querySelector(`[data-preset-count="${CSS.escape(area.dataset.presetText)}"]`);
          if (count) count.textContent = `${area.value.length} 字`;
          renderPresetMirror(area, mirror);
        };
        area.addEventListener('input', sync);
        area.addEventListener('scroll', () => renderPresetMirror(area, mirror));
        area.addEventListener('keydown', event => deletePresetField(area, mirror, event));
        card?.querySelectorAll('[data-preset-field]').forEach(btn => {
          btn.addEventListener('click', () => {
            // 整块插入：在光标处塞进 `【字段名】`，插完把光标放到标注之后
            const token = `【${btn.dataset.presetField}】`;
            const start = typeof area.selectionStart === 'number' ? area.selectionStart : area.value.length;
            const end = typeof area.selectionEnd === 'number' ? area.selectionEnd : start;
            area.setRangeText(token, start, end, 'end');
            area.dispatchEvent(new Event('input', { bubbles: true }));
            area.focus();
          });
        });
        renderPresetMirror(area, mirror);
      });

      $id('presetSaveBtn')?.addEventListener('click', async () => {
        const promptsNext = {};
        section.querySelectorAll('[data-preset-text]').forEach(area => {
          promptsNext[area.dataset.presetText] = area.value;
        });
        const result = await deps.api('/api/preset-prompts', { method: 'PUT', body: JSON.stringify({ prompts: promptsNext }) });
        if (!result?.ok) { panelToast('保存失败，请重试'); return; }
        panelToast(`已保存（${result.customCount} 项自定义）`);
        await render();
      });

      $id('presetResetAllBtn')?.addEventListener('click', async () => {
        const result = await deps.api('/api/preset-prompts/reset', { method: 'PUT', body: JSON.stringify({}) });
        if (!result?.ok) { panelToast('恢复失败，请重试'); return; }
        panelToast('已全部恢复默认提示词');
        await render();
      });
    };

    await render();
  }

  // ---------------------------------------------------------------- 智能辅助线（供 app.js 调用）

  const GUIDE_TOLERANCE = 6;

  function collectAlignCandidates(excludeNode) {
    return deps.getAlignTargets ? deps.getAlignTargets(excludeNode) : [];
  }

  function computeSmartGuides(node, left, top, width, height) {
    const targets = collectAlignCandidates(node);
    const guides = [];
    if (!targets.length) return { left, top, guides };
    const mineX = [left, left + width / 2, left + width];
    const mineY = [top, top + height / 2, top + height];
    let bestX = null;
    let bestY = null;
    targets.forEach(target => {
      const theirX = [target.left, target.left + target.width / 2, target.left + target.width];
      const theirY = [target.top, target.top + target.height / 2, target.top + target.height];
      mineX.forEach((value, myIndex) => {
        theirX.forEach((other, theirIndex) => {
          const delta = other - value;
          if (Math.abs(delta) <= GUIDE_TOLERANCE && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
            bestX = { delta, position: other, myIndex, theirIndex, target };
          }
        });
      });
      mineY.forEach((value, myIndex) => {
        theirY.forEach((other, theirIndex) => {
          const delta = other - value;
          if (Math.abs(delta) <= GUIDE_TOLERANCE && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
            bestY = { delta, position: other, myIndex, theirIndex, target };
          }
        });
      });
    });
    if (bestX) {
      left += bestX.delta;
      guides.push({ axis: 'x', position: bestX.position, from: Math.min(top, bestX.target.top), to: Math.max(top + height, bestX.target.top + bestX.target.height) });
    }
    if (bestY) {
      top += bestY.delta;
      guides.push({ axis: 'y', position: bestY.position, from: Math.min(left, bestY.target.left), to: Math.max(left + width, bestY.target.left + bestY.target.width) });
    }
    return { left, top, guides };
  }

  function paintGuides(guides) {
    const layer = deps.getGuideLayer ? deps.getGuideLayer() : null;
    if (!layer) return;
    if (!guides?.length) { layer.innerHTML = ''; return; }
    const color = getComputedStyle(document.documentElement).getPropertyValue('--brand-2').trim() || (currentThemeKey() === 'light' ? '#2563eb' : '#fafaf9');
    layer.innerHTML = guides.map(guide => {
      const span = Math.max(0, guide.to - guide.from);
      const style = guide.axis === 'x'
        ? `left:${guide.position}px;top:${guide.from}px;height:${span}px;width:1px`
        : `top:${guide.position}px;left:${guide.from}px;width:${span}px;height:1px`;
      return `<span class="smart-guide" style="${style};background:${color}"></span>`;
    }).join('');
  }

  function clearGuides() {
    const layer = deps.getGuideLayer ? deps.getGuideLayer() : null;
    if (layer) layer.innerHTML = '';
  }

  // ---------------------------------------------------------------- 挂载

  function mount(dependencies) {
    deps = dependencies || {};
    bindShell();
    applyAppearance();
    applyCanvasPrefs();
    scheduleReleaseNotes();
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved) activeTab = saved;
    } catch { /* ignore */ }
  }

  window.CanvasFlowSettings = {
    mount,
    open: tab => open(tab),
    close,
    isOpen,
    applyAppearance,
    applyCanvasPrefs,
    canvasPrefs,
    setCanvasPref,
    computeSmartGuides,
    paintGuides,
    clearGuides,
    invalidateProviders: () => { providerCache = null; }
  };
})();
