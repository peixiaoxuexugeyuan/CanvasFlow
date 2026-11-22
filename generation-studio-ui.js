/* Shared view for the independent image and video studios. */
(() => {
  'use strict';

  const paths = {
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 3 3 5-6 5 6"/>',
    video: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M7 4l3 5m3-5 3 5m-6 4 4 2.5-4 2.5z"/>',
    audio: '<path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4"/>',
    settings: '<path d="M3 7h4m4 0h10M3 17h10m4 0h4"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    spark: '<path d="m13 4 1.8 5.2L20 11l-5.2 1.8L13 18l-1.8-5.2L6 11l5.2-1.8L13 4Zm-8 9 .9 2.6L8.5 16.5l-2.6.9L5 20l-.9-2.6-2.6-.9 2.6-.9L5 13Z"/>',
    chevron: '<path d="m6.5 9 5.5 5.5L17.5 9"/>',
    refresh: '<path d="M20 5v5h-5M4 19v-5h5"/><path d="M5 9a7.5 7.5 0 0 1 12.4-4L20 8m-1 7a7.5 7.5 0 0 1-12.4 4L4 16"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    external: '<path d="M14 3h7v7m-1.5-5.5-9 9M10 5H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4"/>',
    view: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    reuse: '<path d="M5 4v5h5"/><path d="M5.5 8.5A8 8 0 1 1 4.3 15"/>',
    history: '<path d="M3 5v5h5M3.5 9.5a8.5 8.5 0 1 1-.1 5"/><path d="M12 7v5l3.5 2"/>'
  };
  function icon(name) {
    return `<svg class="studio-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
  }

  function examplePrompt(kind) {
    return kind === 'image'
      ? '拍摄一张琥珀色玻璃香水瓶的静物照。瓶身直立，侧面的光穿过玻璃，在台面投下温暖的折射光影。镜头聚焦于瓶身边缘和香水的色泽，背景简洁，保留细腻的玻璃质感。'
      : '远景中，一列火车沿铁轨穿过雪山谷地。镜头从高处缓缓跟随列车，近处的积雪向后掠过，远处的山脊保持清晰。利用山体的阴影和雪面的反光，呈现列车行进的速度与山谷的纵深。';
  }

  function markup(kind) {
    const image = kind === 'image';
    const type = image ? 'image' : 'video';
    const medium = image ? '图片' : '视频';
    const example = image ? '琥珀香水静物' : '雪山列车';
    return `<div class="content-view-inner generation-studio" data-medium="${type}">
      <header class="studio-hero">
        <img class="studio-hero-art" src="/assets/generation-studio/${type}.webp" alt="">
        <div class="studio-hero-copy">
          <div class="studio-hero-title">${icon(type)}<h1>${medium}生成台</h1></div>
          <button type="button" class="studio-hero-sample" data-studio-example>
            <span class="studio-example-name">${example}</span><span class="studio-example-action">使用提示词</span>${icon('arrow')}
          </button>
        </div>
        <button type="button" class="studio-hero-settings" data-provider>${icon('settings')}模型设置</button>
      </header>
      <form class="studio-form">
        ${image ? '' : '<div class="studio-mode-switch" data-mode-switch role="group" aria-label="视频生成方式" hidden></div>'}
        <label class="studio-prompt"><span>提示词</span>
          <textarea name="prompt" rows="3" placeholder="${image ? '描述你想生成的图片…' : '描述场景、主体动作或镜头变化…'}"></textarea>
        </label>
        <div data-references class="studio-references"></div>
        <div class="studio-toolbar">
          <label>模型<select name="model" required><option value="">正在加载…</option></select></label>
          <div class="studio-fields" data-specs></div>
        </div>
        <p class="studio-note" data-model-note></p>
        <div class="studio-form-footer">
          <details data-advanced hidden><summary>${icon('settings')}更多设置${icon('chevron')}</summary><div class="studio-fields" data-more-specs></div></details>
          <button class="studio-submit" type="submit" disabled>${icon('spark')}生成${medium}</button>
        </div>
        <p class="studio-note" role="status" data-submit-status></p>
      </form>
      <section class="studio-result" aria-label="当前结果" data-result hidden>
        <header><h2>当前结果</h2><button class="studio-secondary" data-new-result type="button" hidden>${icon('view')}查看新结果</button></header>
        <div class="studio-media" data-output-media></div>
        <div class="studio-result-footer"><p data-output-caption></p><a class="studio-secondary" data-download>${icon('download')}下载原文件</a></div>
      </section>
      <section class="studio-history" aria-label="工作区任务">
        <header><h2>最近生成 <small data-total></small></h2><button class="studio-secondary" type="button" data-refresh>${icon('refresh')}刷新</button></header>
        <p class="studio-note" role="status" data-history-note></p>
        <div data-history></div>
        <p class="studio-note studio-empty" data-empty><span class="studio-empty-icon">${icon('history')}</span><span data-empty-text>正在加载任务…</span></p>
        <button class="studio-secondary" type="button" data-more hidden>查看更多${icon('chevron')}</button>
      </section>
    </div>`;
  }

  function resultUrl(job, kind) {
    const value = String((kind === 'image' ? job.imageUrl : job.videoUrl) || '');
    if (/^\/media\/[\w.-]+(?:\?[^#]*)?$/.test(value)) return value;
    try {
      const url = new URL(value);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch { /* A task may not have a result yet. */ }
    if (kind === 'image' && typeof job.imageData === 'string'
        && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(job.imageData)) {
      return job.imageData;
    }
    return '';
  }

  function statusText(job, url) {
    if (job.status === 'completed') return url ? '已完成' : '缺少结果文件';
    if (job.status === 'queued') return '排队中';
    if (job.status === 'failed') return job.upstreamCancelled ? '已取消' : '失败';
    if (job.status === 'running') {
      if (job.progress == null || !Number.isFinite(Number(job.progress))) return '生成中';
      return `生成中 · ${Math.round(Math.max(0, Math.min(100, job.progress)))}%`;
    }
    return '处理中';
  }

  function historyController(host, kind, actions = {}) {
    const find = selector => host.querySelector(selector);
    const history = find('[data-history]');
    const preview = find('[data-result]');
    const previewBox = find('[data-output-media]');
    const newResult = find('[data-new-result]');
    const rows = new Map();
    const image = kind === 'image';
    const medium = image ? '图片' : '视频';
    let currentId = '', currentUrl = '', nextId = '';

    function display(entry, bringIntoView = false) {
      if (!entry?.url) return;
      const { job, url } = entry;
      if (currentId !== job.id || currentUrl !== url) {
        const media = document.createElement(image ? 'img' : 'video');
        if (image) media.alt = job.prompt || '生成的图片';
        else {
          media.controls = true;
          media.playsInline = true;
          media.preload = 'metadata';
          media.setAttribute('aria-label', job.prompt || '生成的视频');
        }
        media.src = url;
        previewBox.replaceChildren(media);
        currentId = job.id;
        currentUrl = url;
      }
      preview.hidden = false;
      find('[data-output-caption]').textContent = job.prompt || medium + '结果';
      const link = find('[data-download]');
      link.href = url;
      link.onclick = null;
      const local = url.startsWith('/media/') || /^data:image\//i.test(url);
      const downloadRemote = !image && !local && actions.download;
      if (local || downloadRemote) {
        link.download = '';
        link.removeAttribute('target');
        link.innerHTML = icon('download') + '下载原文件';
        if (downloadRemote) link.onclick = event => {
          event.preventDefault();
          actions.download(job);
        };
      } else {
        link.removeAttribute('download');
        link.target = '_blank';
        link.rel = 'noopener';
        link.innerHTML = icon('external') + '打开原文件';
      }
      nextId = '';
      newResult.hidden = true;
      if (bringIntoView) preview.scrollIntoView({ block: 'nearest' });
    }

    function makeRow() {
      const element = document.createElement('article');
      element.className = 'studio-job';
      element.innerHTML = `<span class="studio-thumb" aria-hidden="true"></span>
        <div class="studio-job-copy"><strong></strong><span></span><p hidden></p></div>
        <div class="studio-job-actions"><button class="studio-secondary" type="button" data-view-job hidden>${icon('view')}查看</button>
        <button class="studio-secondary" type="button" data-lookup hidden>${icon('refresh')}查询结果</button>
        <button class="studio-secondary" type="button" data-reuse>${icon('reuse')}载入参数</button></div>`;
      const entry = {
        element, thumb: element.querySelector('.studio-thumb'), title: element.querySelector('strong'),
        meta: element.querySelector('.studio-job-copy span'), error: element.querySelector('p'),
        view: element.querySelector('[data-view-job]'), lookup: element.querySelector('[data-lookup]'),
        reuse: element.querySelector('[data-reuse]'), job: null, url: ''
      };
      entry.view.onclick = () => display(entry, true);
      entry.reuse.onclick = () => actions.reuse?.(entry.job);
      entry.lookup.onclick = async () => {
        entry.lookup.disabled = true;
        try { await actions.retryLookup(entry.job); }
        catch (error) { find('[data-history-note]').textContent = error.message || '查询失败，请重试。'; }
        finally { entry.lookup.disabled = false; }
      };
      return entry;
    }

    function updateRow(entry, job, modelNames) {
      const url = job.status === 'completed' ? resultUrl(job, kind) : '';
      entry.element.dataset.jobId = job.id;
      entry.element.dataset.status = job.status;
      if (entry.url !== url || !entry.job) {
        if (image && url) {
          const thumbnail = document.createElement('img');
          thumbnail.src = url;
          thumbnail.loading = 'lazy';
          thumbnail.alt = '';
          entry.thumb.replaceChildren(thumbnail);
        } else entry.thumb.innerHTML = icon(image ? 'image' : 'video');
      }
      entry.job = job;
      entry.url = url;
      const title = job.prompt || medium + '任务';
      if (entry.title.textContent !== title) entry.title.textContent = title;
      entry.title.title = title;
      const meta = [statusText(job, url), modelNames.get(job.modelId) || job.modelId].filter(Boolean).join(' · ');
      if (entry.meta.textContent !== meta) entry.meta.textContent = meta;
      const message = job.error || (job.status === 'completed' && !url ? '供应商暂未返回可用的媒体地址。' : '');
      entry.error.hidden = !message;
      if (entry.error.textContent !== message) entry.error.textContent = message;
      entry.view.hidden = !url;
      entry.lookup.hidden = !(!image && job.status === 'completed' && !url && job.providerJobId && actions.retryLookup);
      entry.reuse.hidden = !actions.reuse || (actions.canReuse && !actions.canReuse(job));
    }

    function render(jobs, models = [], options = {}) {
      const names = new Map(models.map(model => [model.id, model.name || model.model]));
      const submitted = new Set(options.submittedIds || []);
      const renderedIds = new Set();
      let candidate;
      for (const job of jobs) {
        if (!job.id || renderedIds.has(job.id)) continue;
        renderedIds.add(job.id);
        const entry = rows.get(job.id) || makeRow();
        const previouslyReady = !!entry.url;
        const wasPending = entry.job && !previouslyReady;
        updateRow(entry, job, names);
        if (!candidate && !previouslyReady && entry.url && (submitted.has(job.id) || wasPending)) candidate = entry;
        rows.set(job.id, entry);
        const position = history.children[renderedIds.size - 1];
        if (position !== entry.element) history.insertBefore(entry.element, position || null);
      }
      for (const [id, entry] of rows) {
        if (!renderedIds.has(id)) { entry.element.remove(); rows.delete(id); }
      }
      const empty = find('[data-empty]');
      empty.querySelector('[data-empty-text]').textContent = `暂无${medium}生成记录`;
      empty.hidden = rows.size > 0;
      find('[data-total]').textContent = String(options.total ?? rows.size);
      const viewing = rows.get(currentId);
      const player = !image && previewBox.querySelector('video');
      const playing = player && !player.paused && !player.ended;
      if (candidate && candidate.job.id !== currentId) {
        if (playing) {
          nextId = candidate.job.id;
          newResult.hidden = false;
        } else display(candidate);
      } else if (viewing?.url && viewing.url !== currentUrl && !playing) {
        display(viewing);
      }
      // Pagination or refresh can drop a row while its result is being watched.
      if (nextId && !rows.has(nextId)) { nextId = ''; newResult.hidden = true; }
    }
    newResult.onclick = () => display(rows.get(nextId), true);
    return { render };
  }

  window.CanvasFlowStudioUI = { markup, examplePrompt, historyController, icon };
})();
