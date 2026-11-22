/* Independent image and video generation share workspace jobs and canvas model adapters. */
(() => {
  'use strict';
  const memoryDrafts = new Map();
  const sending = new Set();
  const formatGroup = { image: 'images', video: 'videos', audio: 'music' };
  const mediaNames = { image: '图片', video: '视频', audio: '音频' };
  const copy = (value) => JSON.parse(JSON.stringify(value));
  function element(tag, text) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    return el;
  }
  function button(text, action) {
    const el = element('button', text);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  }
  function readDraft(key) {
    if (memoryDrafts.has(key)) return memoryDrafts.get(key);
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch {
      return {};
    }
  }
  function webUrl(value) {
    try {
      const u = new URL(value);
      return /^https?:$/.test(u.protocol) && !u.username && !u.password;
    } catch {
      return false;
    }
  }
  function usableReference(value) {
    return typeof value === 'string' && (/^\/media\/[\w.-]+$/.test(value) || webUrl(value));
  }
  function addUploadButton(host, slot, selected) {
    const input = element('input');
    input.type = 'file';
    input.hidden = true;
    input.multiple = slot.max > 1;
    input.accept = slot.kinds.map((k) => window.CanvasFlowFileFormats.accept(formatGroup[k])).join(',');
    input.addEventListener('change', () => {
      if (input.files?.length) selected(Array.from(input.files));
    });
    host.append(button('本机上传', () => input.click()), input);
  }
  function pickMaterial(host, slot, request, fromLink) {
    const dialog = element('dialog');
    dialog.className = 'studio-material-picker';
    const heading = element('header');
    const label = fromLink ? '添加' + slot.label + '链接' : '选择' + slot.label;
    dialog.setAttribute('aria-label', label);
    heading.append(
      element('strong', label),
      button('关闭', () => dialog.close())
    );
    const input = element('input');
    input.type = fromLink ? 'url' : 'search';
    input.placeholder = fromLink ? 'https://…' : '搜索工作区素材';
    input.setAttribute('aria-label', fromLink ? slot.label + '链接' : '搜索工作区素材');
    const list = element('div');
    list.className = 'studio-material-list';
    const note = element('p');
    note.setAttribute('role', 'status');
    dialog.append(heading, input, list, note);
    host.append(dialog);
    return new Promise((resolve) => {
      let selected = null,
        rows = [];
      function finish(row) {
        selected = row;
        dialog.close();
      }
      function paint() {
        const query = input.value.trim().toLowerCase();
        list.replaceChildren();
        const filtered = rows.filter((r) => !query || r.name?.toLowerCase().includes(query));
        for (const row of filtered) {
          const b = button(row.name || mediaNames[row.kind], () => finish(row));
          const src = row.thumbnail || (row.kind === 'image' && row.url);
          if (src && (usableReference(src) || /^data:image\//.test(src))) {
            const img = element('img');
            img.src = src;
            img.loading = 'lazy';
            img.alt = '';
            b.prepend(img);
          }
          list.append(b);
        }
        note.textContent = filtered.length
          ? ''
          : query
            ? '没有匹配的素材。'
            : slot.urlOnly
              ? '暂无可用的链接素材，可直接填写供应商能访问的素材链接。'
              : '当前工作区还没有这类素材，可从本机上传。';
      }
      dialog.addEventListener(
        'close',
        () => {
          dialog.remove();
          resolve(selected);
        },
        { once: true }
      );
      dialog.addEventListener('click', (e) => {
        if (
          e.target === dialog &&
          (e.offsetX < 0 ||
            e.offsetY < 0 ||
            e.offsetX > dialog.clientWidth ||
            e.offsetY > dialog.clientHeight)
        )
          dialog.close();
      });
      dialog.showModal();
      input.focus();
      if (fromLink) {
        const add = () => {
          const url = input.value.trim();
          if (!webUrl(url) || url.length > 4000) {
            note.textContent = '请输入有效的 HTTP(S) 素材直链。';
            return;
          }
          finish({ kind: slot.kinds[0], url, name: slot.label + '链接' });
        };
        dialog.append(button('添加', add));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        });
      } else {
        if (!slot.urlOnly) addUploadButton(dialog, slot, finish);
        note.textContent = '正在读取素材…';
        input.addEventListener('input', paint);
        request('/api/workspace/materials')
          .then((result) => {
            if (!dialog.open) return;
            rows = (result.materials || []).filter(
              (r) =>
                slot.kinds.includes(r.kind) &&
                (slot.urlOnly ? webUrl(r.url) : r.deferred || usableReference(r.url))
            );
            paint();
          })
          .catch((error) => {
            if (dialog.open) note.textContent = error.message;
          });
      }
    });
  }
  function mount(host, kind, deps) {
    const { active, request, key, loadModels, makeAdapter, upload, openProviders } = deps;
    const ui = window.CanvasFlowStudioUI;
    host.innerHTML = ui.markup(kind);
    const find = (s) => host.querySelector(s),
      form = find('.studio-form'),
      prompt = form.elements.prompt,
      model = form.elements.model;
    const send = form.querySelector('[type=submit]'),
      status = find('[data-submit-status]'),
      modelNote = find('[data-model-note]');
    const advanced = find('[data-more-specs]'),
      modeSwitch = find('[data-mode-switch]'),
      refArea = find('[data-references]'),
      more = find('[data-more]');
    let draft = readDraft(key);
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) draft = {};
    draft.variants ||= {};
    prompt.value = draft.prompt || '';
    let adapter = null,
      models = [],
      uploading = false,
      loading = true,
      modelVersion = 0,
      closed = false;
    let rows = [],
      total = 0,
      timer,
      pollIndex = 0,
      historyBusy = false,
      historyPending = false;
    let submittedIds = [],
      saveTimer;
    const live = () => !closed && active();
    const variant = () => (draft.variants[draft.modelId] ||= { settings: {}, refs: {} });
    function save() {
      clearTimeout(saveTimer);
      draft.prompt = prompt.value;
      try {
        localStorage.setItem(key, JSON.stringify(draft));
        memoryDrafts.delete(key);
      } catch {
        memoryDrafts.set(key, draft);
        status.textContent = '当前存储空间不足，草稿仅保留到关闭应用。';
      }
    }
    prompt.addEventListener('input', () => {
      draft.prompt = prompt.value;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 200);
    });
    find('[data-studio-example]').addEventListener('click', () => {
      const example = ui.examplePrompt(kind);
      if (!prompt.value.includes(example)) {
        const separator = prompt.value && !prompt.value.endsWith('\n') ? '\n' : '';
        prompt.value += separator + example;
        prompt.dispatchEvent(new Event('input', { bubbles: true }));
      }
      prompt.focus();
      prompt.setSelectionRange(prompt.value.length, prompt.value.length);
    });
    function lock() {
      const locked = uploading || sending.has(key);
      send.disabled = locked || loading || !adapter;
      model.disabled = locked || loading || !models.length;
      form
        .querySelectorAll('[data-studio-field], [data-mode-switch] button, [data-references] button')
        .forEach((el) => (el.disabled = locked));
    }
    function syncLock(event) {
      if (live() && event.detail?.key === key) {
        lock();
        submittedIds = Array.from(new Set([...event.detail.ids, ...submittedIds])).slice(0, 24);
        void refreshHistory();
      }
    }
    window.addEventListener('canvasflow:studio-submit', syncLock);
    const fields = () => adapter?.fieldsFor?.(variant().settings) || adapter?.fields || [];
    const slots = () => adapter?.references(variant().settings) || [];
    function defaults() {
      const v = variant();
      for (const field of fields())
        if (v.settings[field.key] == null && field.default != null) v.settings[field.key] = field.default;
      if (adapter?.normalize) v.settings = adapter.normalize(v.settings);
    }
    function fieldNode(field) {
      const label = element('label');
      const caption = element('span', field.label);
      caption.className = 'studio-field-label';
      label.append(caption);
      const v = variant(),
        options = field.options || [];
      let input;
      if (options.length) {
        input = element('select');
        options.forEach((o) => input.add(new Option(o.label ?? String(o.value), String(o.value))));
        let chosen =
          options.find((o) => String(o.value) === String(v.settings[field.key])) ||
          options.find((o) => String(o.value) === String(field.default)) ||
          options[0];
        input.value = String(chosen.value);
        v.settings[field.key] = chosen.value;
      } else {
        input = element(field.inputType === 'textarea' ? 'textarea' : 'input');
        if (input.tagName === 'INPUT') input.type = field.inputType || 'text';
        for (const attr of ['min', 'max', 'step', 'placeholder'])
          if (field[attr] != null) input[attr] = field[attr];
        if (input.type === 'checkbox')
          input.checked = v.settings[field.key] === true || v.settings[field.key] === 'true';
        else input.value = v.settings[field.key] ?? '';
      }
      input.name = field.key;
      if (field.key === 'referenceMode') input.setAttribute('aria-label', field.label);
      input.dataset.studioField = field.key;
      const write = () => {
        v.settings[field.key] =
          input.type === 'checkbox'
            ? input.checked
            : options.length
              ? options.find((o) => String(o.value) === input.value).value
              : input.value;
        save();
      };
      if (!options.length && input.type !== 'checkbox') input.addEventListener('input', write);
      input.addEventListener('change', () => {
        write();
        if (options.length || input.type === 'checkbox') {
          renderControls();
          form.elements.namedItem(field.key)?.focus();
        }
      });
      label.append(input);
      return label;
    }
    function showModeSwitch(field, select) {
      const options = Array.from(select.options);
      const preferred = ['text2video', 'frames2video', 'mixed2video', 'singleImage2video']
        .map((value) => options.find((option) => option.value === value))
        .filter(Boolean);
      const quick = [...preferred, ...options.filter((option) => !preferred.includes(option))].slice(0, 4);
      const caption = element('span', field.label);
      caption.className = 'studio-mode-label';
      modeSwitch.hidden = false;
      modeSwitch.append(caption);
      const focusChoice = () => modeSwitch.querySelector('[aria-pressed="true"]')?.focus();
      for (const option of quick) {
        const choice = button(option.label, () => {
          if (select.value === option.value) return;
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          focusChoice();
        });
        choice.className = 'studio-mode-choice';
        choice.setAttribute('aria-pressed', String(select.value === option.value));
        modeSwitch.append(choice);
      }
      if (quick.length === options.length) {
        select.className = 'studio-mode-native-only';
        select.tabIndex = -1;
        select.addEventListener('change', focusChoice);
        modeSwitch.append(select);
        return;
      }
      const more = element('span');
      more.className = 'studio-mode-more';
      const selected = select.selectedOptions[0];
      const extraSelected = !quick.includes(selected);
      const moreText = element('span', extraSelected ? selected.label : '更多模式');
      moreText.className = 'studio-mode-more-text';
      moreText.setAttribute('aria-hidden', 'true');
      more.classList.toggle('is-selected', extraSelected);
      more.innerHTML = ui.icon('chevron');
      more.prepend(moreText);
      more.append(select);
      modeSwitch.append(more);
    }
    function renderControls() {
      const specs = find('[data-specs]');
      specs.replaceChildren();
      advanced.replaceChildren();
      if (modeSwitch) {
        modeSwitch.replaceChildren();
        modeSwitch.hidden = true;
      }
      if (adapter) {
        defaults();
        fields()
          .filter((f) => !f.visible || f.visible(variant().settings))
          .forEach((f) => {
            const node = fieldNode(f);
            if (modeSwitch && f.key === 'referenceMode' && f.options?.length > 1) {
              showModeSwitch(f, node.querySelector('select'));
            } else {
              (f.advanced ? advanced : specs).append(node);
            }
          });
      }
      const details = advanced.closest('details');
      if (details) details.hidden = !advanced.childElementCount;
      renderRefs();
      lock();
    }
    function renderRefs() {
      refArea.replaceChildren();
      for (const slot of slots()) {
        const v = variant(),
          items = v.refs[slot.key] || [];
        const section = element('section');
        section.className = 'studio-ref-slot';
        section.dataset.slot = slot.key;
        section.dataset.kind = slot.kinds[0];
        section.setAttribute('aria-label', slot.label);
        const title = element('strong');
        title.className = 'studio-ref-title';
        title.innerHTML = ui.icon(slot.kinds[0]);
        title.append(element('span', slot.label));
        if (slot.min > 0) {
          const required = element('small', '（必填）');
          required.className = 'studio-ref-required';
          title.append(required);
        }
        const chips = element('div');
        chips.className = 'studio-ref-chips';
        items.forEach((r, i) => {
          const chip = element('span');
          chip.className = 'studio-ref-chip';
          if (r.kind === 'image' && usableReference(r.url)) {
            const img = element('img');
            img.src = r.url;
            img.alt = '';
            chip.append(img);
          }
          chip.append(element('span', r.name || mediaNames[r.kind]));
          if (i > 0)
            chip.append(
              button('前移', () => {
                [items[i - 1], items[i]] = [items[i], items[i - 1]];
                save();
                renderRefs();
              })
            );
          const remove = button('×', () => {
            items.splice(i, 1);
            save();
            renderRefs();
          });
          remove.setAttribute('aria-label', '移除' + (r.name || slot.label));
          chip.append(remove);
          chips.append(chip);
        });
        const actions = element('div');
        actions.className = 'studio-ref-actions';
        if (items.length < slot.max || slot.max === 1) {
          actions.append(button('素材库', () => selectRef(slot, false)));
          if (slot.urlOnly || slot.allowLink) actions.append(button('填写链接', () => selectRef(slot, true)));
          if (!slot.urlOnly) addUploadButton(actions, slot, (files) => addRefs(slot, files));
        }
        section.append(title, chips, actions);
        refArea.append(section);
      }
      if (kind === 'video' && adapter && variant().settings.referenceMode === 'text2video') {
        const modes = fields().find((f) => f.key === 'referenceMode')?.options || [];
        const quickMode = ['singleImage2video', 'image2video'].find((mode) => modes.some((o) => o.value === mode));
        if (quickMode) {
          const caption = quickMode === 'singleImage2video' ? '添加首帧' : '添加参考图';
          const addReference = button(caption, () => {
            variant().settings.referenceMode = quickMode;
            renderControls();
            save();
            const slot = slots()[0];
            if (slot) void selectRef(slot, false);
          });
          addReference.setAttribute('aria-label', caption);
          refArea.append(addReference);
        }
      }
    }
    async function selectRef(slot, link) {
      const origin = variant(),
        picked = await pickMaterial(host, slot, request, link);
      if (picked && live() && origin === variant() && slots().some((s) => s.key === slot.key))
        await addRefs(slot, Array.isArray(picked) ? picked : [picked]);
    }
    async function addRefs(slot, entries) {
      if (!live() || uploading || sending.has(key)) return;
      const v = variant(),
        original = v.refs[slot.key] || [];
      const items = slot.max === 1 ? [] : original.slice();
      if (items.length + entries.length > slot.max) {
        status.textContent = slot.label + '最多支持 ' + slot.max + ' 项。';
        return;
      }
      uploading = true;
      lock();
      status.textContent = '正在读取参考素材…';
      let added = 0,
        currentName = '';
      try {
        for (const entry of entries) {
          if (!(entry instanceof File)) continue;
          currentName = entry.name;
          if (slot.maxBytes && entry.size > slot.maxBytes)
            throw Error('文件超过 ' + Math.round(slot.maxBytes / 1024 / 1024) + ' MB，请压缩后再选择。');
          const group = window.CanvasFlowFileFormats.kindFor(entry);
          if (!slot.kinds.some((k) => formatGroup[k] === group))
            throw Error('素材类型与' + slot.label + '不匹配。');
          await window.CanvasFlowFileFormats.validate(entry, group);
        }
        for (const entry of entries) {
          if (!live()) return;
          let { url, name, kind: mediaKind } = entry;
          currentName = name || slot.label;
          if (entry instanceof File) {
            const group = window.CanvasFlowFileFormats.kindFor(entry);
            mediaKind = Object.keys(formatGroup).find((k) => formatGroup[k] === group);
            url = (await upload(entry))?.url;
          } else if (entry.deferred) {
            const result = await request('/api/workspace/materials/' + encodeURIComponent(entry.id));
            if (!live()) return;
            url = result.material?.url;
            if (typeof url === 'string' && url.startsWith('data:' + mediaKind + '/')) {
              const blob = await (await fetch(url)).blob();
              if (!live()) return;
              url = (await upload(new File([blob], name || slot.label, { type: blob.type })))?.url;
            }
          }
          if (!usableReference(url) || !slot.kinds.includes(mediaKind) || (slot.urlOnly && !webUrl(url)))
            throw Error('该素材地址不能用于' + slot.label + '。');
          if (!items.some((r) => r.url === url)) {
            items.push({ url, kind: mediaKind, name: String(name || slot.label).slice(0, 160) });
            added++;
          }
        }
        if (live()) {
          v.refs[slot.key] = items;
          save();
          status.textContent = '';
        }
      } catch (e) {
        if (live()) {
          if (added) {
            v.refs[slot.key] = items;
            save();
          }
          status.textContent = (added ? '已添加 ' + added + ' 项。' : '') + currentName + '：' + e.message;
        }
      } finally {
        uploading = false;
        if (live()) {
          renderRefs();
          lock();
        }
      }
    }
    function applyModel(id) {
      draft.modelId = id;
      const m = models.find((item) => item.id === id);
      adapter = m ? makeAdapter(m) : null;
      modelNote.textContent = m ? '' : '请在供应商设置中启用可用的生成模型。';
      renderControls();
    }
    async function reloadModels() {
      const version = ++modelVersion;
      loading = true;
      lock();
      try {
        const result = await loadModels();
        if (!live() || version !== modelVersion) return;
        models = result?.models?.[kind === 'image' ? 't2i' : 'video'] || [];
        model.replaceChildren(...models.map((m) => new Option(m.name || m.model || m.id, m.id)));
        if (!models.length) model.add(new Option('暂无可用模型', ''));
        model.value = models.some((m) => m.id === draft.modelId) ? draft.modelId : models[0]?.id || '';
        applyModel(model.value);
      } catch (e) {
        if (live() && version === modelVersion) {
          adapter = null;
          models = [];
          model.replaceChildren(new Option('模型未加载', ''));
          renderControls();
          modelNote.replaceChildren(element('span', e.message + ' '), button('重新加载', reloadModels));
        }
      } finally {
        if (live() && version === modelVersion) {
          loading = false;
          lock();
        }
      }
    }
    model.addEventListener('change', () => {
      applyModel(model.value);
      save();
      status.textContent = '';
    });
    function reuse(job) {
      if (uploading || sending.has(key)) return;
      const modelEntry = models.find((m) => m.id === job.modelId);
      if (!modelEntry) {
        status.textContent = '此任务的模型已不可用。可在供应商设置中重新启用。';
        return;
      }
      const s = job.studioDraft || makeAdapter(modelEntry).restoreLegacy?.(job);
      model.value = job.modelId;
      draft.modelId = job.modelId;
      draft.variants[job.modelId] = {
        settings: copy(s?.settings || job.generationSettings || {}),
        refs: copy(s?.refs || {})
      };
      prompt.value = s?.prompt ?? job.prompt ?? '';
      applyModel(job.modelId);
      save();
      status.textContent = job.studioDraft && !job.studioDraftPartial
        ? '已载入设置，可修改后生成。'
        : '已载入可恢复的参数，请核对设置和参考素材。';
      prompt.focus();
    }
    const history = ui.historyController(host, kind, {
      reuse,
      download: deps.download,
      retryLookup: async (job) => {
        try {
          await request('/api/jobs/' + encodeURIComponent(job.id) + '?recoverMedia=1');
          if (live()) void refreshHistory();
        } catch (e) {
          if (live()) status.textContent = e.message;
        }
      }
    });
    const historyNote = find('[data-history-note]') || status;
    function paintHistory() {
      history.render(rows, models, { total, submittedIds });
      more.hidden = rows.length >= total;
    }
    async function refreshHistory(sync = false, append = false) {
      if (!live()) return;
      if (historyBusy) {
        historyPending = true;
        return;
      }
      historyBusy = true;
      more.disabled = true;
      clearTimeout(timer);
      const path = '/api/jobs?kind=' + kind + '&view=studio';
      try {
        if (sync) {
          const pending = await request(path + '&status=active&limit=1&offset=' + pollIndex);
          pollIndex = (pollIndex + 1) % Math.max(1, pending.total);
          if (live() && pending.jobs[0])
            await request('/api/jobs/' + encodeURIComponent(pending.jobs[0].id) + '?view=studio');
        }
        if (!live()) return;
        const wanted = Math.max(12, rows.length + (append ? 12 : 0));
        const fresh = [];
        let activeCount = 0,
          available = 0;
        do {
          const limit = Math.min(200, wanted - fresh.length);
          const page = await request(path + '&limit=' + limit + '&offset=' + fresh.length);
          if (!live()) return;
          available = page.total || 0;
          activeCount = page.activeCount || 0;
          fresh.push(...page.jobs);
          if (page.jobs.length < limit) break;
        } while (fresh.length < Math.min(wanted, available));
        total = available;
        rows = Array.from(new Map(fresh.map((job) => [job.id, job])).values());
        paintHistory();
        if (historyNote !== status) historyNote.textContent = '';
        timer = setTimeout(() => refreshHistory(Boolean(activeCount)), activeCount ? 3500 : 15000);
      } catch (e) {
        if (live()) {
          historyNote.textContent = e.message || '任务记录加载失败，请刷新。';
          timer = setTimeout(() => refreshHistory(), 7000);
        }
      } finally {
        historyBusy = false;
        if (live()) {
          more.disabled = false;
          if (historyPending) {
            historyPending = false;
            void refreshHistory();
          }
        }
      }
    }
    async function submit(event) {
      event.preventDefault();
      if (!live() || !adapter || send.disabled || sending.has(key)) return;
      const userText = prompt.value.trim(),
        v = variant(),
        settings = copy(v.settings);
      const refs = {};
      for (const slot of slots()) {
        const items = v.refs[slot.key] || [];
        if (
          items.length > slot.max ||
          items.some(
            (r) => !slot.kinds.includes(r.kind) || !usableReference(r.url) || (slot.urlOnly && !webUrl(r.url))
          )
        ) {
          status.textContent = '请检查「' + slot.label + '」的数量、类型和素材地址。';
          return;
        }
        refs[slot.key] = copy(items);
      }
      if (!userText && !Object.values(refs).some((items) => items.length)) {
        status.textContent = kind === 'image' ? '请输入提示词或添加参考图片。' : '请输入视频提示词。';
        prompt.focus();
        return;
      }
      const reason = adapter.validate?.(settings, refs, userText);
      if (reason) {
        status.textContent = reason;
        return;
      }
      const count = adapter.submissionCount?.(settings) || 1;
      const selected = adapter,
        id = draft.modelId;
      let accepted = 0;
      const report = (message) => {
        if (live()) status.textContent = message;
        else deps.notify?.(message);
      };
      sending.add(key);
      lock();
      save();
      try {
        const payload = selected.preparePayload
          ? await selected.preparePayload(settings, refs, userText)
          : selected.payload(settings, refs, userText);
        const snapshot = { prompt: userText, settings, refs };
        for (let i = 0; i < count; i++) {
          if (!deps.sameWorkspace()) {
            report('已切换工作区，本批已提交 ' + accepted + ' / ' + count + ' 个任务。');
            return;
          }
          status.textContent =
            count > 1 ? '正在提交第 ' + (i + 1) + ' / ' + count + ' 个任务…' : '正在提交任务…';
          const body = { modelId: id, prompt: userText, ...payload, studioDraft: snapshot };
          if (kind === 'image') body.asyncTask = true;
          const result = await request(kind === 'image' ? '/api/ai/image-generate' : '/api/generate', {
            method: 'POST',
            body: JSON.stringify(body)
          });
          const jobId = result?.jobId || result?.job?.id;
          if (!jobId) throw Error('未收到任务编号，请先刷新记录确认提交结果。');
          submittedIds = [jobId, ...submittedIds].slice(0, 24);
          if (result?.job?.status === 'failed')
            throw Error(result.job.error || '供应商返回任务失败，请查看记录。');
          accepted++;
        }
        report(accepted + ' 个' + (kind === 'image' ? '图片' : '视频') + '任务已提交。');
      } catch (e) {
        report((accepted ? '已有 ' + accepted + ' 个任务提交成功。' : '') + (e.message || '提交失败'));
      } finally {
        sending.delete(key);
        window.dispatchEvent(new CustomEvent('canvasflow:studio-submit', {detail: {key, ids: submittedIds}}));
      }
    }
    form.addEventListener('submit', submit);
    prompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    find('[data-provider]').addEventListener('click', openProviders);
    find('[data-refresh]').addEventListener('click', () => refreshHistory(true));
    more.addEventListener('click', () => refreshHistory(false, true));
    window.addEventListener('canvasflow:models-changed', reloadModels);
    window.addEventListener('pagehide', save);
    void reloadModels();
    void refreshHistory();
    return () => {
      closed = true;
      save();
      clearTimeout(timer);
      host.querySelectorAll('dialog.studio-material-picker[open]').forEach((d) => d.close());
      window.removeEventListener('pagehide', save);
      window.removeEventListener('canvasflow:studio-submit', syncLock);
      window.removeEventListener('canvasflow:models-changed', reloadModels);
    };
  }
  window.CanvasFlowGenerationStudio = { mount };
})();
