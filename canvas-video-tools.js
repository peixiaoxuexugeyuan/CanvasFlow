/* Video analysis and depth extraction use the source selected when the dialog opened. */
(() => {
  'use strict';
  const pending = new WeakSet();
  const description = '你是影视分镜师。请写一段可以直接用于视频生成的中文提示词，按时间先后交代可见的主体、动作、场景、景别、镜头运动、光线和风格。只描述素材中有依据的内容。';
  const keyPrefix = 'canvasflow-video-prompt-v1:';
  const maxAutoFrames = 12;
  const frameDataLimit = 6_000_000; // Encoded image budget shared with the local FFmpeg sampler.

  function readChoice(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch { return {}; }
  }
  function sampleCount(seconds) {
    return Math.max(2, Math.min(maxAutoFrames, Math.ceil(seconds * 2)));
  }
  function waitForMedia(video, event, start) {
    return new Promise((resolve, reject) => {
      function finish(failure) {
        clearTimeout(timer);
        video.removeEventListener(event, ready);
        video.removeEventListener('error', failed);
        failure ? reject(failure) : resolve();
      }
      const ready = () => finish();
      const failed = () => finish(new Error('无法解码视频画面，请先将视频下载或导入项目后重试。'));
      const timer = setTimeout(() => finish(new Error('视频读取超时，请检查素材后重试。')), 20000);
      video.addEventListener(event, ready, {once:true});
      video.addEventListener('error', failed, {once:true});
      try { start(); } catch (error) { finish(error); }
    });
  }
  function encodeFrame(video, canvas, ctx, budget) {
    let scale = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight));
    for (;;) {
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);
      const image = canvas.toDataURL('image/jpeg', 0.8);
      if (image.length <= budget) return image;
      if (width === 1 && height === 1) throw new Error('视频帧编码失败。');
      scale *= 0.9 * Math.sqrt(budget / image.length);
    }
  }
  async function sampleFrames(options, report, requestedCount) {
    // An independent decoder keeps seeking off the playing canvas node.
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    try {
      await waitForMedia(video, 'loadeddata', () => { video.src = options.sourceUrl; });
      const start = options.trim?.start ?? 0;
      const end = Math.min(options.trim?.end ?? video.duration, video.duration);
      if (!(end > start) || !Number.isFinite(end)) throw new Error('无法确定视频的有效时长。');
      const count = requestedCount ?? sampleCount(end - start);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('当前浏览器无法读取视频帧。');
      const referenceImages = [], times = [];
      for (let index = 0; index < count; index++) {
        options.check();
        report('正在截取第 ' + (index + 1) + ' / ' + count + ' 帧…');
        const timestamp = start + (index + 0.5) * (end - start) / count;
        await waitForMedia(video, 'seeked', () => { video.currentTime = timestamp; });
        referenceImages.push(encodeFrame(video, canvas, ctx, frameDataLimit / count));
        times.push(timestamp);
      }
      return {referenceImages, times};
    } finally {
      video.removeAttribute('src');
      video.load();
    }
  }

  async function open(options) {
    if (pending.has(options.owner)) return options.notify('此节点的任务正在提交，请稍候。');
    if (document.querySelector('.cv-tool-dialog[open]')) return;
    const image = options.toolId === 'image-to-prompt';
    const videoPrompt = options.toolId === 'video-to-prompt';
    const reverse = image || videoPrompt;
    const key = (image ? 'canvasflow-image-prompt-v1:' : keyPrefix) + options.preferenceKey;
    const choice = readChoice(key);
    const preferences = (videoPrompt && window.CanvasFlowReversePreferences?.read()) || {};
    const frameCount = preferences.frameCount ?? null;
    const selectedModels = {};
    const dialog = document.createElement('dialog');
    dialog.className = 'cv-tool-dialog';
    dialog.setAttribute('aria-labelledby', 'cv-tool-heading');
    dialog.innerHTML = `<form>
      <header><h2 id="cv-tool-heading"></h2><button type="button" class="cv-close" aria-label="关闭">×</button></header>
      <div class="cv-body"><p class="cv-source"></p>
      ${videoPrompt ? `<fieldset class="cv-mode"><legend>提交方式</legend><div class="cv-segment">
        <label><input type="radio" name="mode" value="frames">截取帧</label>
        <label><input type="radio" name="mode" value="video">整段视频</label></div></fieldset>` : ''}
      ${reverse ? `<label class="cv-model">分析模型<select name="model" required></select></label>` :
      `<p class="cv-help">火山 AI MediaKit 支持最长 10 分钟、最高 2K 的视频。确认后会将所选视频或片段发给火山，服务商可能按用量收费。提取的深度视频会添加到画布，可连接到支持视频参考的生成节点。</p>
        <button type="button" class="cv-open-settings" hidden>前往偏好设置</button>`}
      ${reverse ? '<p class="cv-help" aria-live="polite"></p>' : ''}
      <p class="cv-status" role="status" aria-live="polite"></p></div>
      <footer><button type="button" class="cv-cancel">取消</button><button class="cv-submit" type="submit" disabled></button></footer></form>`;
    const find = selector => dialog.querySelector(selector);
    const title = reverse ? '提示词反推' : '深度动作捕捉';
    find('h2').textContent = title;
    find('.cv-source').textContent = options.label + ' · ' + (image ? '当前图片' : options.trim
      ? '仅处理截取区间 ' + options.trim.start.toFixed(2) + '–' + options.trim.end.toFixed(2) + ' 秒'
      : '处理范围：完整视频');
    const submit = find('.cv-submit'), status = find('.cv-status');
    submit.textContent = reverse ? '确认反推' : '确认提取';
    const select = find('select');
    let catalog = {}, ready = false, configured = false, busy = false, finishedText = '';
    const report = message => { status.textContent = message; };
    const mode = () => image ? 'image' : find('[name="mode"]:checked')?.value || '';
    function update() {
      if (finishedText) {
        submit.disabled = busy;
        return;
      }
      if (reverse) {
        const activeMode = mode();
        const full = activeMode === 'video';
        const models = !activeMode ? [] : full ? catalog.videoUnderstanding || [] : catalog.i2t || [];
        const configuredModel = full ? preferences.videoModelId : preferences.frameModelId;
        const preferred = selectedModels[activeMode] || configuredModel || choice[activeMode];
        select.replaceChildren(...models.map(item => new Option(item.name || item.id, item.id)));
        if (models.some(item => item.id === preferred)) select.value = preferred;
        else if (models.length && configuredModel) {
          select.insertBefore(new Option('请选择兼容模型', ''), select.firstChild);
          select.value = '';
        }
        if (!models.length) select.add(new Option(!activeMode ? '请先选择提交方式' : '没有兼容模型', ''));
        select.disabled = busy || !models.length;
        find('.cv-help').textContent = image ? '确认后将当前图片发送给所选模型，生成可编辑的图像提示词。供应商可能按用量收费。'
          : !activeMode ? '请选择希望提交给模型的素材形式。两种方式均可能产生模型费用。'
          : full ? '会将所选范围的视频文件（含原有音轨）提交给视频理解模型。文件大小和时长须符合供应商限制，可能按时长或用量收费。'
          : (frameCount === null ? '按每秒约 2 帧在所选范围内均匀截取，最少 2 帧、最多 12 帧。'
            : '将在所选范围内均匀截取 ' + frameCount + ' 帧。')
            + '仅发送画面，不含音轨。供应商可能按图片或用量收费。快速动作和转场可能被略过。';
        submit.disabled = busy || !ready || !select.value;
        if (ready && activeMode && configuredModel && !select.value) {
          report('默认' + (full ? '整段视频' : '截取帧') + '模型已不可用。' + (models.length
            ? '请为本次反推手动选择兼容模型。' : '请先在供应商设置中启用兼容模型，或切换提交方式。'));
        } else if (ready && activeMode && !models.length) report(image ? '请在供应商设置中启用支持图片理解的模型。'
          : full ? '请在供应商设置中启用支持整段视频输入的模型，或手动选择截取帧。'
          : '请在供应商设置中启用支持图片理解的模型，或手动选择整段视频。');
      } else {
        submit.disabled = busy || !configured || !ready;
      }
    }
    const close = () => dialog.close();
    find('.cv-close').onclick = find('.cv-cancel').onclick = close;
    dialog.addEventListener('close', () => { if (!dialog.open) dialog.remove(); });
    if (reverse) {
      if (videoPrompt && ['video','frames'].includes(choice.mode)) find('[value="' + choice.mode + '"]').checked = true;
      dialog.addEventListener('change', event => {
        if (event.target.name === 'mode') { report(''); choice.mode = mode(); update(); }
        if (event.target === select && select.value) {
          selectedModels[mode()] = select.value;
          report('');
          update();
        }
      });
    }
    function lock(value, allowBackground = false) {
      busy = value;
      for (const element of dialog.querySelectorAll('button,input,select')) element.disabled = value;
      find('.cv-close').disabled = false;
      find('.cv-cancel').disabled = false;
      find('.cv-cancel').textContent = value && allowBackground ? '后台继续' : value ? '关闭' : '取消';
      if (!value) update();
    }
    function post(path, payload) {
      return options.request(path, {method:'POST', body:JSON.stringify(payload)});
    }
    if (!reverse) {
      find('.cv-open-settings').onclick = () => {
        const preferences = window.CanvasFlowSettings;
        if (!preferences?.open) return report('请打开偏好设置中的「深度动作捕捉」。');
        dialog.close();
        document.getElementById('settingsBackdrop')?.addEventListener('canvasflow:settings-closed', () => {
          try { options.check(); } catch { return; }
          open(options);
        }, {once:true});
        preferences.open('mediaKit');
      };
    }
    find('form').onsubmit = async event => {
      event.preventDefault();
      if (busy || submit.disabled) return;
      const selectedMode = mode(), modelId = select?.value;
      pending.add(options.owner);
      lock(true, true);
      try {
        if (finishedText) {
          const saved = await options.writeText(finishedText);
          options.notify(saved ? '反推结果已保存到来源项目。' : '提示词已写入画布，请查看项目保存状态。');
          dialog.close();
          return;
        }
        options.check();
        if (reverse) {
          await options.beginReverse?.();
          choice.mode = selectedMode;
          choice[selectedMode] = modelId;
          try { localStorage.setItem(key, JSON.stringify(choice)); } catch {}
          let result;
          const media = {projectId:options.projectId, videoUrl:options.sourceUrl,
            ...(options.trim && {trimStart:options.trim.start, trimEnd:options.trim.end})};
          if (image) {
            report('正在分析当前图片…');
            const reference = await options.readImage();
            result = await post('/api/ai/text-generate', {modelId, projectId:options.projectId, referenceImages:[reference],
              prompt:'请根据这张图片写一段可直接用于图像生成的中文提示词。描述可见的主体及其姿态、服饰、环境、构图、视角、光线、色彩与画面风格，仅输出提示词正文。'});
          } else if (selectedMode === 'frames') {
            let frames;
            if (new URL(options.sourceUrl, location.href).origin === location.origin) {
              try { frames = await sampleFrames(options, report, frameCount); } catch { options.check(); }
            }
            if (!frames) {
              report('正在通过本地视频工具截取画面…');
              frames = await post('/api/ai/video-prompt-frames', frameCount === null ? media : {...media, frameCount});
            }
            if (!Array.isArray(frames?.referenceImages) || !frames.referenceImages.length
              || (frameCount === null ? frames.referenceImages.length > maxAutoFrames : frames.referenceImages.length !== frameCount)
              || frames.referenceImages.length !== frames.times?.length || !frames.times.every(Number.isFinite)) {
              throw new Error('未能读取带时间信息的视频帧，请检查视频和截取范围后重试。');
            }
            // Match the server's frame budget, leaving room for metadata in the 8 MB text endpoint.
            if (frames.referenceImages.reduce((size, frame) => size + frame.length, 0) > frameDataLimit) {
              throw new Error('截取的画面超过传输上限，请在偏好设置中减少截取画面数后重试。');
            }
            const labels = frames.times.map(time => time.toFixed(2) + ' 秒');
            options.check();
            report('正在分析所选画面…');
            result = await post('/api/ai/text-generate', {modelId, projectId:options.projectId, purpose:'video_prompt_frames', referenceImages:frames.referenceImages,
              prompt:description + '\n按顺序提供的视频帧时间点：' + labels.join('、') + '。这些帧没有音轨，请勿推测台词或声音。'});
          } else {
            report('正在提交视频并等待模型分析…');
            result = await post('/api/ai/video-to-prompt', {mode:'video',modelId,...media});
          }
          const text = result?.text?.trim();
          if (!text) throw new Error('模型没有返回提示词。');
          finishedText = text;
          const saved = await options.writeText(text);
          options.notify(saved === false ? '提示词已写入画布，项目保存未完成，请查看保存状态。' : '反推结果已写入相连的文本节点。');
        } else {
          report('正在提交深度提取任务…');
          await options.submitDepth();
          options.notify('已提交深度提取，可在结果节点查看进度。');
        }
        dialog.close();
      } catch (error) {
        const message = error.message || '任务未完成，请重试。';
        if (finishedText) {
          if (!dialog.open) { document.body.append(dialog); dialog.showModal(); }
          let copy = find('textarea');
          if (!copy) {
            copy = document.createElement('textarea');
            copy.readOnly = true;
            copy.setAttribute('aria-label','已生成的提示词');
            status.after(copy);
          }
          copy.value = finishedText;
          submit.textContent = '重试保存结果';
          report('提示词已生成，可复制或重试保存。' + message);
        } else if (dialog.open) report(message); else options.notify(message);
      }
      finally { pending.delete(options.owner); lock(false); }
    };
    document.body.append(dialog);
    update();
    dialog.showModal();
    report('正在读取配置…');
    try {
      const data = await options.request(reverse ? '/api/ai/models' : '/api/media-tools/depth/settings');
      if (!dialog.open) return;
      ready = true;
      if (reverse) catalog = data?.models || {};
      else {
        if (typeof data?.configured !== 'boolean') throw new Error('无法读取 MediaKit 凭据状态');
        configured = data.configured;
        find('.cv-open-settings').hidden = configured;
      }
      report(!reverse && !configured ? '请先在偏好设置的「深度动作捕捉」中配置 MediaKit 凭据。' : '');
      update();
    } catch (error) {
      if (!dialog.open) return;
      if (!reverse) find('.cv-open-settings').hidden = false;
      report(error.message || '配置读取失败。');
    }
  }
  window.CanvasVideoTools = {open};
})();
