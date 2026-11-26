(() => {
  'use strict';
  const entries = [];
  let defaults = {}, overrides = new Map(), revision = 0;
  const fields = new Map();
  for (const mode of window.CanvasFlowRoleModes) {
    for (const tab of mode.tabs) {
      for (const field of tab.fields) fields.set([mode.id, tab.id, field.id].join('.'), field);
    }
  }
  const ready = location.protocol === 'file:' ? Promise.resolve() : fetch('role-studio-prompts.json')
    .then(response => response.ok ? response.json() : null)
    .then(catalog => {
      if (!catalog || !Object.keys(catalog).length) return;
      defaults = catalog;
      entries.splice(0, entries.length, ...Object.entries(catalog).map(([key, row]) => ({key, ...row})));
    }).catch(() => {});

  function setOverrides(table) {
    const next = new Map(Object.entries(table || {})
      .filter(([, row]) => row?.custom && typeof row.prompt === 'string' && row.prompt.trim())
      .map(([key, row]) => [key, row.prompt]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    if (!entries.length && table) {
      entries.push(...Object.entries(table).map(([key, row]) => ({key, ...row})));
    }
    if (next.size === overrides.size && [...next].every(([key,text]) => overrides.get(key) === text)) return;
    overrides = next;
    revision++;
    window.dispatchEvent(new Event('canvasflow:role-prompts-changed'));
  }
  function format(key, values, fallback) {
    const template = overrides.get(key) ?? defaults[key]?.prompt ?? fallback;
    return template.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(values, name) ? String(values[name]) : token);
  }
  function selectedText(key, field, selected) {
    const label = field.labels?.[selected] ?? (selected === true ? '开启' : String(selected));
    const preset = 'preset.' + key + '.' + selected;
    return format(preset, {field:field.label, value:label}, '{value}');
  }
  function fieldText(key, field, selected) {
    const text = selectedText(key, field, selected);
    return format('field.' + key, {field:field.label, value:text}, field.label + '：{value}');
  }
  function stepText(key, field, selected) {
    return format('step.' + key, {field:field.label.replace(/预设$/, ''), value:selectedText(key, field, selected)},
      '仅调整{field}为「{value}」，保持角色身份和其他外观细节。');
  }
  function signature(controls, outfits) {
    if (!overrides.size) return '';
    controls = controls || {};
    const relevant = [];
    let marks;
    for (const [key, template] of overrides) {
      const [kind, mode, tab, id, ...option] = key.split('.');
      const fieldKey = [mode, tab, id].join('.');
      if (key === 'marks.item' || fieldKey === 'features.marks.mark') {
        if (!marks) {
          try { marks = JSON.parse(controls['features.marks.items'] || 'null'); } catch {}
          if (!Array.isArray(marks)) marks = [{preset:controls['features.marks.mark']}];
        }
        if (!marks.some(item => item?.preset && (kind === 'marks' || item.preset === option.join('.')))) continue;
      } else if (kind === 'ai') {
        if (!outfits?.length && !controls['outfit.ai.outfitNotes']) continue;
        const skill = controls['outfit.ai.stylingSkill'] ?? fields.get('outfit.ai.stylingSkill')?.default;
        if (skill !== (key === 'ai.replicate' ? '妆造复刻' : '人设定制造型')) continue;
      } else {
        const field = fields.get(fieldKey);
        if (!field) continue;
        const condition = field.activeWhen;
        if (condition) {
          const parent = [mode, tab, condition.id].join('.');
          const value = controls[parent] ?? fields.get(parent)?.default;
          if (Object.hasOwn(condition, 'not') ? value === condition.not : value !== condition.value) continue;
        }
        if (!Object.hasOwn(controls, fieldKey) && !(condition && (field.read || id.endsWith('Strength')))) continue;
        if (kind === 'preset' && String(controls[fieldKey] ?? field.default) !== option.join('.')) continue;
      }
      relevant.push([key, template]);
    }
    return relevant.length ? JSON.stringify(relevant) : '';
  }
  window.CanvasFlowRolePrompts = {ready, entries, setOverrides, format, selectedText, fieldText, stepText, signature,
    get revision() {return revision;},
    hasOverride:key => overrides.has(key)};
})();
