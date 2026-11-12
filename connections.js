(function () {
  'use strict';
  function start() {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const stage = $('#canvasStage');
    const wrap = $('#canvasWrap');
    const layer = $('#connectionLayer');
    if (!stage || !wrap || !layer) return;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    // 删除徽标单独一层：连线层 z-index:1 位于节点(z-index:2)之下，徽标跟随指针会钻到卡片背后；
    // 用一个更高层级的覆盖层承载徽标，保证它始终浮在节点之上且可点。
    const badgeLayer = document.createElementNS(SVG_NS, 'svg');
    badgeLayer.setAttribute('class', 'connection-layer edge-badge-layer');
    badgeLayer.setAttribute('id', 'edgeBadgeLayer');
    badgeLayer.setAttribute('aria-hidden', 'true');
    stage.appendChild(badgeLayer);
    const storageKey = 'canvasflow-connections';
    const defaultEdges = () => ([
      { id: 'edge-prompt-model', source: 'prompt-1', target: 'model-1' },
      { id: 'edge-model-output', source: 'model-1', target: 'output-1' },
    ]);
    const state = { edges: [], active: null, selectedEdgeId: null, selectedNodeId: null, selectedNodeIds: new Set(), pendingPort: null, removeAnchor: null };

    const toast = (message, icon = '⌁') => {
      const box = $('#toast');
      if (!box) return;
      const text = $('#toastText');
      const mark = $('.toast-icon');
      if (text) text.textContent = message;
      if (mark) mark.textContent = icon;
      box.classList.add('show');
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => box.classList.remove('show'), 2200);
    };

    // Let the host app snapshot history before an edge mutation so Ctrl+Z can undo a connect/disconnect.
    function notifyWillChange() {
      document.dispatchEvent(new CustomEvent('canvasflow:connections-will-change', { detail: { edges: state.edges.slice() } }));
    }
    function notifyChange() {
      document.dispatchEvent(new CustomEvent('canvasflow:connections-change', { detail: { edges: state.edges.slice() } }));
    }
    function save({ notify = true } = {}) {
      try { localStorage.setItem(storageKey, JSON.stringify(state.edges)); } catch { /* private mode */ }
      if (notify) notifyChange();
    }
    function normalize(input) {
      const seen = new Set();
      return (Array.isArray(input) ? input : []).reduce((list, edge) => {
        if (!edge) return list;
        const source = String(edge.source ?? '').trim();
        const target = String(edge.target ?? '').trim();
        if (!source || !target || source === target) return list;
        const key = source + '->' + target;
        if (seen.has(key)) return list;
        seen.add(key);
        list.push({ id: String(edge.id || makeId()), source, target });
        return list;
      }, []);
    }
    function makeId() { return 'edge-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
    function load() {
      const pending = window.__canvasflowPendingEdges;
      if (Array.isArray(pending)) {
        state.edges = normalize(pending);
        delete window.__canvasflowPendingEdges;
        return;
      }
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { /* ignore */ }
      state.edges = Array.isArray(saved) ? normalize(saved) : defaultEdges();
    }
    function nodeMap() {
      const map = new Map();
      $$('#canvasStage > .flow-node[data-node-id]').forEach(node => map.set(node.dataset.nodeId, node));


      $$('#canvasStage > .group-frame[data-node-id]').forEach(frame => map.set(frame.dataset.nodeId, frame));
      return map;
    }
    function getNode(id) { return nodeMap().get(id) || null; }
    function stageMatrix() {
      const transform = getComputedStyle(stage).transform;
      return transform && transform !== 'none' ? new DOMMatrix(transform) : new DOMMatrix();
    }
    function toStageSpace(clientX, clientY) {
      const bounds = wrap.getBoundingClientRect();
      const matrix = stageMatrix();
      return { x: (clientX - bounds.left - matrix.e) / (matrix.a || 1), y: (clientY - bounds.top - matrix.f) / (matrix.d || 1) };
    }
    function point(port) {


      const home = port.__magnetHome;
      if (home) return toStageSpace(home.x, home.y);
      const box = port.getBoundingClientRect();
      return toStageSpace(box.left + box.width / 2, box.top + box.height / 2);
    }
    function bendAmount(from, to) {


      const dx = to.x - from.x;
      return dx >= 0 ? dx * 0.5 : 6.25 * Math.sqrt(-dx);
    }
    function curve(a, b) {
      const bend = Math.max(50, bendAmount(a, b));
      return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`;
    }




    const FLOW = {
      PERIOD: 2200, FPS_MS: 1000 / 30, PHASES: [.16, .5, .84],
      SAMPLES: 26, LENGTH: .16, WIDTH: 2.35,
      raf: null, last: 0, time: 0, updaters: new Set(),
    };
    function bezierOf(a, b) {
      const bend = Math.max(50, bendAmount(a, b));
      return { s: a, c1: { x: a.x + bend, y: a.y }, c2: { x: b.x - bend, y: b.y }, t: b };
    }
    function bezierPoint(bz, t) {
      const mt = 1 - t, a = mt * mt, c = t * t;
      return {
        x: a * mt * bz.s.x + 3 * a * t * bz.c1.x + 3 * mt * c * bz.c2.x + c * t * bz.t.x,
        y: a * mt * bz.s.y + 3 * a * t * bz.c1.y + 3 * mt * c * bz.c2.y + c * t * bz.t.y,
      };
    }
    function bezierLength(bz) {

      let length = 0, prev = bezierPoint(bz, 0);
      for (let i = 1; i <= 40; i++) {
        const pt = bezierPoint(bz, i / 40);
        length += Math.hypot(pt.x - prev.x, pt.y - prev.y);
        prev = pt;
      }
      return length;
    }
    function bandLength(bz) {

      return Math.min(.16, Math.max(.07, 190 / Math.max(1, bezierLength(bz))));
    }
    function flowBandPath(bz, headT, length) {
      const tailT = Math.max(0, headT - length);
      if (headT - tailT < .018) return null;
      let d = '';
      for (let i = 0; i <= FLOW.SAMPLES; i++) {
        const p = bezierPoint(bz, tailT + (headT - tailT) * i / FLOW.SAMPLES);
        d += (i === 0 ? 'M' : 'L') + ' ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ' ';
      }
      return d;
    }
    function flowFrame(now) {
      if (now - FLOW.last >= FLOW.FPS_MS) {
        FLOW.last = now;
        FLOW.time = (now % FLOW.PERIOD) / FLOW.PERIOD;
        FLOW.updaters.forEach(update => update(FLOW.time));
      }
      FLOW.raf = requestAnimationFrame(flowFrame);
    }
    function ensureFlowLoop() {
      if (FLOW.raf === null) { FLOW.last = 0; FLOW.raf = requestAnimationFrame(flowFrame); }
    }
    function stopFlowLoopIfIdle() {
      if (!FLOW.updaters.size && FLOW.raf !== null) { cancelAnimationFrame(FLOW.raf); FLOW.raf = null; }
    }
    function makeFlowDefs(uniqueId) {
      const defs = document.createElementNS(SVG_NS, 'defs');
      const filter = document.createElementNS(SVG_NS, 'filter');
      filter.setAttribute('id', 'edge-glow-' + uniqueId);
      filter.setAttribute('filterUnits', 'userSpaceOnUse');
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      // userSpaceOnUse 下百分比无效：必须给绝对坐标。覆盖整个画布工作区（stage 空间
      // 可能含远负坐标），用超大区域避免滤镜裁掉长边流带的后半段。
      filter.setAttribute('x', '-20000'); filter.setAttribute('y', '-20000');
      filter.setAttribute('width', '60000'); filter.setAttribute('height', '60000');
      const mk = (tag, attrs) => { const el = document.createElementNS(SVG_NS, tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
      filter.append(
        mk('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '2.4', result: 'bO' }),
        mk('feFlood', { 'flood-color': 'currentColor', 'flood-opacity': '.36', result: 'fO' }),
        mk('feComposite', { in: 'bO', in2: 'fO', operator: 'in', result: 'gO' }),
        mk('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '0.9', result: 'bI' }),
        mk('feFlood', { 'flood-color': 'currentColor', 'flood-opacity': '.66', result: 'fI' }),
        mk('feComposite', { in: 'bI', in2: 'fI', operator: 'in', result: 'gI' }),
      );
      const merge = document.createElementNS(SVG_NS, 'feMerge');
      ['gO', 'gI', 'SourceGraphic'].forEach(inName => merge.appendChild(mk('feMergeNode', { in: inName })));
      filter.appendChild(merge);
      defs.appendChild(filter);
      return defs;
    }
    function makeFlowBands(group, bz, uniqueId) {
      const defs = makeFlowDefs(uniqueId);
      const length = bandLength(bz);
      const gradId = 'edge-grad-' + uniqueId;
      // 每条流带独立渐变（见下）；此处的 defs 只承载辉光滤镜。
      group.appendChild(defs);
      const wrapEl = document.createElementNS(SVG_NS, 'g');
      wrapEl.setAttribute('class', 'edge-flow-bands');
      group.appendChild(wrapEl);
      FLOW.PHASES.forEach((phase, index) => {

        const bandGrad = document.createElementNS(SVG_NS, 'linearGradient');
        const bandGradId = `${gradId}-${index}`;
        bandGrad.setAttribute('id', bandGradId);
        bandGrad.setAttribute('gradientUnits', 'userSpaceOnUse');
        const stopTail = document.createElementNS(SVG_NS, 'stop');
        stopTail.setAttribute('offset', '0%');
        stopTail.setAttribute('class', 'edge-flow-stop-tail');
        const stopHead = document.createElementNS(SVG_NS, 'stop');
        stopHead.setAttribute('offset', '100%');
        stopHead.setAttribute('class', 'edge-flow-stop-head');
        bandGrad.append(stopTail, stopHead);
        defs.appendChild(bandGrad);

        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', `url(#${bandGradId})`);
        path.setAttribute('stroke-width', String(FLOW.WIDTH));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('class', 'edge-flow-band');
        path.setAttribute('filter', `url(#edge-glow-${uniqueId})`);
        wrapEl.appendChild(path);
        const update = time => {
          const headT = (time + phase) % 1;
          const d = flowBandPath(bz, headT, length);
          path.setAttribute('d', d || '');
          if (!d) return;
          const tail = bezierPoint(bz, Math.max(0, headT - length));
          const head = bezierPoint(bz, headT);
          // 渐变定义域外推 60%：弯弧段的点在 tail→head 直线上的投影短于直线距离，
          // 不外推时弧段末端会落在渐变窗口外（pad=透明）→ 流光只显示一半。
          const dx = head.x - tail.x, dy = head.y - tail.y;
          bandGrad.setAttribute('x1', (tail.x - dx * .6).toFixed(2));
          bandGrad.setAttribute('y1', (tail.y - dy * .6).toFixed(2));
          bandGrad.setAttribute('x2', (head.x + dx * .6).toFixed(2));
          bandGrad.setAttribute('y2', (head.y + dy * .6).toFixed(2));
        };
        update(FLOW.time);
        FLOW.updaters.add(update);
      });
      ensureFlowLoop();
    }

    function pruneMissing() {
      const nodes = nodeMap();
      const before = state.edges.length;
      state.edges = state.edges.filter(edge => nodes.has(edge.source) && nodes.has(edge.target));
      if (before !== state.edges.length) {
        if (state.selectedEdgeId && !state.edges.some(edge => edge.id === state.selectedEdgeId)) state.selectedEdgeId = null;
        save();
        return true;
      }
      return false;
    }

    function draw(pointer) {
      // While the canvas is display:none every port rect reads 0, which would collapse every
      // curve into a single point. Keep the last good paths and wait for the canvas to be
      // shown again (openCanvas triggers a redraw once layout is back).
      if (stage.offsetParent === null || wrap.getBoundingClientRect().width === 0) return;
      pruneMissing();
      const nodes = nodeMap();
      // 全量重绘前清空旧流带更新器，避免 rAF 引用已销毁的 path。
      FLOW.updaters.clear();
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      while (badgeLayer.firstChild) badgeLayer.removeChild(badgeLayer.firstChild);
      state.edges.forEach(edge => {
        const sourcePort = nodes.get(edge.source)?.querySelector('.port-right');
        const targetPort = nodes.get(edge.target)?.querySelector('.port-left');
        if (!sourcePort || !targetPort) return;
        const from = point(sourcePort);
        const to = point(targetPort);
        const d = curve(from, to);
        const isSelected = state.selectedEdgeId === edge.id;
        const isRelated = state.selectedNodeIds.size > 0 && (state.selectedNodeIds.has(edge.source) || state.selectedNodeIds.has(edge.target));
        const group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('class', 'edge-group' + (isSelected ? ' selected' : isRelated ? ' related' : ''));
        group.dataset.edgeId = edge.id;
        const hit = document.createElementNS(SVG_NS, 'path');
        hit.setAttribute('class', 'edge-hit');
        hit.setAttribute('d', d);
        hit.dataset.edgeId = edge.id;
        const line = document.createElementNS(SVG_NS, 'path');
        line.setAttribute('class', 'edge-path' + (isSelected ? ' selected' : isRelated ? ' related' : ''));
        line.setAttribute('d', d);
        line.dataset.edgeId = edge.id;
        const edgeIdSafe = edge.id.replace(/[^a-z0-9-]/gi, '');
        hit.addEventListener('pointerenter', () => {
          group.classList.add('is-hot');
          // hover 边时补建流带（无则创建，有则显形）——离开后由 CSS 隐藏
          if (!group.querySelector('.edge-flow-bands')) makeFlowBands(group, bezierOf(from, to), edgeIdSafe);
        });
        hit.addEventListener('pointerleave', () => group.classList.remove('is-hot'));
        group.appendChild(hit);
        group.appendChild(line);
        layer.appendChild(group);
        // 原版交互：流光只在 hover 该边 / 选中该边 / 选中其关联卡片时显示（.is-hot/.selected/.related 承载显隐）
        if (isSelected || isRelated) makeFlowBands(group, bezierOf(from, to), edge.id.replace(/[^a-z0-9-]/gi, ''));
        if (state.selectedEdgeId === edge.id) {
          // 删除徽标：选中时钉在「点击位置」并固定不动（不跟随鼠标），取消选中即消失。
          // 没有锚点（程序化选中）时退回连线中点，保证始终可见可点。
          const anchor = (state.removeAnchor && state.removeAnchor.edgeId === edge.id)
            ? { x: state.removeAnchor.x, y: state.removeAnchor.y }
            : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
          const badge = document.createElementNS(SVG_NS, 'circle');
          badge.setAttribute('class', 'edge-remove');
          badge.setAttribute('cx', anchor.x); badge.setAttribute('cy', anchor.y); badge.setAttribute('r', 11);
          badge.dataset.edgeRemove = edge.id;
          badgeLayer.appendChild(badge);
          const cross = document.createElementNS(SVG_NS, 'text');
          cross.setAttribute('class', 'edge-remove-text');
          cross.setAttribute('x', anchor.x); cross.setAttribute('y', anchor.y + 4);
          cross.dataset.edgeRemove = edge.id;
          cross.textContent = '×';
          badgeLayer.appendChild(cross);
        }
      });
      stopFlowLoopIfIdle();
      if (state.active) {
        const preview = document.createElementNS(SVG_NS, 'path');
        const locked = Boolean(state.active.snapPort);
        preview.setAttribute('class', 'edge-path edge-preview' + (locked ? ' snapped' : ''));
        const start = point(state.active.port);
        const end = state.active.view || (pointer ? toStageSpace(pointer.x, pointer.y) : start);
        preview.setAttribute('d', state.active.direction === 'in' ? curve(end, start) : curve(start, end));
        layer.appendChild(preview);
      }
    }

    // 说明：删除徽标不跟随鼠标——选中连线时钉在点击位置（state.removeAnchor），之后固定不动。
    // 因此徽标只占连线附近一小块，指针移开后自然不再遮挡，「点空白处取消选中」得以保留。

    // A plain click on a port (no drag) opens the host app's quick menu instead of leaving a
    // half-started connection behind. The port stays "pending" so clicking a second port still
    // completes a connection the old way.
    function notifyPortMenu(port, clientX, clientY) {
      const node = port?.closest('.flow-node');
      if (!node) return;
      state.pendingPort = port;
      port.classList.add('port-pending');
      const rect = port.getBoundingClientRect();
      document.dispatchEvent(new CustomEvent('canvasflow:port-menu', {
        detail: {
          nodeId: node.dataset.nodeId,
          direction: portDirection(port),
          clientX,
          clientY,
          portLeft: rect.left,
          portRight: rect.right,
          portTop: rect.top,
          portBottom: rect.bottom,
        },
      }));
    }
    function clearPortPending() {
      if (state.pendingPort) state.pendingPort.classList.remove('port-pending');
      state.pendingPort = null;
    }
    function clearActive() {
      state.active?.port.classList.remove('connecting');
      state.active = null;
      stopDragLoop();
      clearSnapHighlight();
      $$('.flow-node.connection-drop-target').forEach(node => node.classList.remove('connection-drop-target'));
      draw();
      clearPortPending();
      document.dispatchEvent(new CustomEvent('canvasflow:port-menu-close'));
    }

    function portDirection(port) { return port.classList.contains('port-right') ? 'out' : 'in'; }

    function connect(first, second) {
      const firstDir = portDirection(first);
      const secondDir = portDirection(second);
      if (firstDir === secondDir) { toast('请把输出端（右侧）连到输入端（左侧）', '↔'); return false; }
      const sourceNode = (firstDir === 'out' ? first : second).closest('.flow-node, .group-frame');
      const targetNode = (firstDir === 'out' ? second : first).closest('.flow-node, .group-frame');
      if (!sourceNode || !targetNode) { toast('这两个端口不能连接', '↔'); return false; }
      const source = sourceNode.dataset.nodeId;
      const target = targetNode.dataset.nodeId;
      if (!source || !target || source === target) { toast('不能连接到自己', '↔'); return false; }
      if (state.edges.some(edge => edge.source === source && edge.target === target)) { toast('这条连线已经存在'); return false; }
      if (createsCycle(source, target)) { toast('不能形成循环连线', '↔'); return false; }
      notifyWillChange();
      state.edges.push({ id: makeId(), source, target });
      save(); draw();
      toast('节点已连接', '⌁');
      return true;
    }

    function createsCycle(source, target) {
      const stack = [target];
      const seen = new Set();
      while (stack.length) {
        const current = stack.pop();
        if (current === source) return true;
        if (seen.has(current)) continue;
        seen.add(current);
        state.edges.filter(edge => edge.source === current).forEach(edge => stack.push(edge.target));
      }
      return false;
    }







    const SNAP = { LOCK: 34, ATTRACT: 80, EASE: 0.35, PULL: 0.55 };

    // 与 connect() 同源的「可连接性」判定，但无副作用（不弹 toast、不写入）。
    function wouldConnect(first, second) {
      if (!first || !second) return null;
      const firstDir = portDirection(first);
      if (firstDir === portDirection(second)) return null;
      const sourceNode = (firstDir === 'out' ? first : second).closest('.flow-node, .group-frame');
      const targetNode = (firstDir === 'out' ? second : first).closest('.flow-node, .group-frame');
      if (!sourceNode || !targetNode) return null;
      const source = sourceNode.dataset.nodeId;
      const target = targetNode.dataset.nodeId;
      if (!source || !target || source === target) return null;
      if (state.edges.some(edge => edge.source === source && edge.target === target)) return null;
      if (createsCycle(source, target)) return null;
      return { source, target };
    }

    function portCenterClient(port) {
      const box = port.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }






    function selectionContext() {
      return {
        frame: document.querySelector('.group-frame.is-selected'),
        node: document.querySelector('.flow-node.selected'),
      };
    }
    function portPriority(port, ctx) {
      const owner = port.closest('.flow-node, .group-frame');
      if (!owner) return 9;
      const isContainer = owner.classList.contains('group-frame');
      if (ctx.frame) return (isContainer && owner === ctx.frame) ? 0 : 9;
      if (ctx.node) {
        if (!isContainer && owner === ctx.node) return 0;
        return isContainer ? 3 : 1;
      }
      return isContainer ? 2 : 1;
    }

    // 在指针附近挑选「最近的有效目标端口」：先比优先级，同优先级再比距离；
    // 阈值外/被排除者直接跳过，最后才跑昂贵的环路校验。
    function nearestTargetPort(clientX, clientY) {
      const active = state.active;
      if (!active) return null;
      const selector = active.direction === 'out' ? '.port-left' : '.port-right';
      const sourceNode = active.port.closest('.flow-node, .group-frame');
      const ctx = selectionContext();
      let best = null, bestDist = Infinity, bestTier = Infinity;
      nodeMap().forEach(node => {
        if (node === sourceNode) return;
        const port = node.querySelector(selector);
        if (!port) return;
        const tier = portPriority(port, ctx);
        if (tier >= 9 || tier > bestTier) return;
        const center = portCenterClient(port);
        const dist = Math.hypot(clientX - center.x, clientY - center.y);
        if (dist > SNAP.ATTRACT) return;
        if (tier === bestTier && dist >= bestDist) return;
        if (!wouldConnect(active.port, port)) return;
        bestTier = tier; bestDist = dist; best = port;
      });
      return best ? { port: best, distance: bestDist } : null;
    }

    function setSnapHighlight(port, locked) {
      $$('.port-snap-target').forEach(el => { if (el !== port) el.classList.remove('port-snap-target', 'is-locked'); });
      if (!port) return;
      port.classList.add('port-snap-target');
      port.classList.toggle('is-locked', Boolean(locked));
    }
    function clearSnapHighlight() {
      $$('.port-snap-target').forEach(el => el.classList.remove('port-snap-target', 'is-locked'));
    }

    // 计算拖拽端点本帧应到达的舞台坐标（含吸附/磁力牵引）与吸附信息。
    function resolveDragTarget(clientX, clientY) {
      const raw = toStageSpace(clientX, clientY);
      const candidate = nearestTargetPort(clientX, clientY);
      if (!candidate) return { point: raw, snap: null };
      const center = point(candidate.port);
      if (candidate.distance <= SNAP.LOCK) return { point: center, snap: { port: candidate.port, locked: true } };
      const ratio = (SNAP.ATTRACT - candidate.distance) / (SNAP.ATTRACT - SNAP.LOCK);
      const pull = ratio * SNAP.PULL;
      return {
        point: { x: raw.x + (center.x - raw.x) * pull, y: raw.y + (center.y - raw.y) * pull },
        snap: { port: candidate.port, locked: false },
      };
    }

    // 拖拽期缓动循环：预览端点按帧缓动逼近目标点，避免吸附瞬间硬跳。
    let dragRaf = null;
    function ensureDragLoop() { if (dragRaf === null && state.active) dragRaf = requestAnimationFrame(dragFrame); }
    function stopDragLoop() { if (dragRaf !== null) { cancelAnimationFrame(dragRaf); dragRaf = null; } }
    function dragFrame() {
      dragRaf = null;
      const active = state.active;
      if (!active) return;
      const view = active.view, target = active.target || view;
      view.x += (target.x - view.x) * SNAP.EASE;
      view.y += (target.y - view.y) * SNAP.EASE;
      draw();
      if (Math.hypot(target.x - view.x, target.y - view.y) > 0.35) dragRaf = requestAnimationFrame(dragFrame);
    }















    const MAGNET = { RADIUS: 48, OUTER_TOL: 8 };
    let magnetPort = null;

    function portRectCenter(port) {
      const box = port.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
    function magnetHome(port) { return port.__magnetHome || portRectCenter(port); }

    function applyMagnet(port, clientX, clientY) {
      const home = port.__magnetHome;
      if (!home) return;
      const matrix = stageMatrix();
      const sx = matrix.a || 1, sy = matrix.d || 1;
      const dx = (clientX - home.x) / sx, dy = (clientY - home.y) / sy;
      // 必须带上 base 的 translateY(-50%)，否则会丢掉垂直居中。
      port.style.transform = `translateY(-50%) translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    }
    function releasePort(port) {
      if (!port) return;
      port.style.transform = '';
      port.classList.remove('port-magnetic');
      delete port.__magnetHome;
    }
    function releaseMagnet() {
      if (!magnetPort) return;
      const port = magnetPort;
      magnetPort = null;
      releasePort(port);
    }
    function updateMagnet(clientX, clientY, buttons) {
      if (state.active || buttons !== 0) { releaseMagnet(); return; }
      if (document.querySelector('.port-quick-menu.open')) { releaseMagnet(); return; }
      const bounds = wrap.getBoundingClientRect();
      if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) { releaseMagnet(); return; }
      const ctx = selectionContext();
      let best = null, bestDist = Infinity, bestHome = null, bestTier = Infinity;
      nodeMap().forEach(node => {
        node.querySelectorAll('.port').forEach(port => {
          const tier = portPriority(port, ctx);
          if (tier >= 9 || tier > bestTier) return;
          const home = magnetHome(port);
          const dist = Math.hypot(clientX - home.x, clientY - home.y);
          if (dist > MAGNET.RADIUS) return;
          if (tier === bestTier && dist >= bestDist) return;
          const outer = port.classList.contains('port-left')
            ? clientX <= home.x + MAGNET.OUTER_TOL
            : clientX >= home.x - MAGNET.OUTER_TOL;
          if (!outer) return;
          bestTier = tier; bestDist = dist; best = port; bestHome = home;
        });
      });
      if (!best) { releaseMagnet(); return; }
      if (magnetPort && magnetPort !== best) releasePort(magnetPort);
      if (!best.__magnetHome) best.__magnetHome = bestHome;
      magnetPort = best;
      best.classList.add('port-magnetic');
      applyMagnet(best, clientX, clientY);
    }

    function beginOrFinish(port, event) {
      if (state.active && state.active.port !== port) { connect(state.active.port, port); clearActive(); return; }
      if (state.active?.port === port) { clearActive(); toast('已取消连线'); return; }
      // A quick menu is open for another port: treat this click as "finish the connection".
      if (state.pendingPort && state.pendingPort !== port) {
        const from = state.pendingPort;
        clearActive();
        connect(from, port);
        return;
      }
      state.selectedEdgeId = null;
      state.selectedNodeId = null;
      state.selectedNodeIds.clear();
      state.removeAnchor = null;
      clearPortPending();
      document.dispatchEvent(new CustomEvent('canvasflow:port-menu-close'));
      const origin = point(port);
      state.active = { port, direction: portDirection(port), nodeId: port.closest('.flow-node')?.dataset.nodeId, startX: event.clientX, startY: event.clientY, hinted: false, view: { ...origin }, target: { ...origin }, snapPort: null, snapHinted: false };
      port.classList.add('connecting');
      draw({ x: event.clientX, y: event.clientY });
    }

    function portDown(event) {
      event.preventDefault();
      event.stopPropagation();
      beginOrFinish(event.currentTarget, event);
    }

    function attachPorts(node) {
      node.querySelectorAll('.port').forEach(port => {
        if (port.dataset.connectionBound) return;
        port.dataset.connectionBound = '1';
        port.addEventListener('pointerdown', portDown);
      });
    }

    // 可连接实体 = 节点卡片 + 块组「整体卡片」——两者都带 .port-left / .port-right，
    // nodeMap() 也早就把组框注册进去了。但这里原先只遍历 .flow-node，
    // 组框的端口因此从没绑上 pointerdown：看着有、点不动。补上。
    function attachConnectablePorts() {
      $$('#canvasStage > .flow-node, #canvasStage > .group-frame').forEach(attachPorts);
    }

    function removeEdge(edgeId, { silent = false } = {}) {
      if (!state.edges.some(edge => edge.id === edgeId)) return false;
      notifyWillChange();
      const before = state.edges.length;
      state.edges = state.edges.filter(edge => edge.id !== edgeId);
      if (before === state.edges.length) return false;
      if (state.selectedEdgeId === edgeId) state.selectedEdgeId = null;
      save(); draw();
      if (!silent) toast('已删除这条连线', '⌫');
      return true;
    }

    function removeEdgesForNode(nodeId) {
      const before = state.edges.length;
      state.edges = state.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
      if (before === state.edges.length) return 0;
      if (state.selectedEdgeId && !state.edges.some(edge => edge.id === state.selectedEdgeId)) state.selectedEdgeId = null;
      save(); draw();
      return before - state.edges.length;
    }

    function observe() {
      attachConnectablePorts();
      // Loading a project or undoing removes every node and immediately re-adds nodes that may
      // reuse the same ids in one synchronous batch. Defer cleanup to a microtask and only drop
      // edges for ids that are genuinely gone once that batch has settled.
      let queued = false;
      const observer = new MutationObserver(records => {
        const removed = new Set();
        records.forEach(record => record.removedNodes.forEach(node => {
          if (node.nodeType === 1 && node.matches?.('.flow-node') && node.dataset.nodeId) removed.add(node.dataset.nodeId);
        }));
        attachConnectablePorts();
        if (!queued) {
          queued = true;
          queueMicrotask(() => {
            queued = false;
            const nodes = nodeMap();
            removed.forEach(nodeId => { if (!nodes.has(nodeId)) removeEdgesForNode(nodeId); });
            draw();
          });
        }
      });
      observer.observe(stage, { childList: true, subtree: false });
    }

    document.addEventListener('pointermove', event => {
      // 空闲时走「磁性连接点」，拖拽连线时走下面的连线吸附——两者互斥。
      if (!state.active) { updateMagnet(event.clientX, event.clientY, event.buttons); return; }
      if (!state.active.hinted && Math.hypot(event.clientX - state.active.startX, event.clientY - state.active.startY) >= 8) {
        state.active.hinted = true;
        toast('拖到目标卡片或端口完成连接', '⌁');
      }
      // 端点自动吸附：解析本帧目标点（含就近选择 / 磁力牵引），交给缓动循环平滑逼近。
      const resolved = resolveDragTarget(event.clientX, event.clientY);
      state.active.target = resolved.point;
      state.active.snapPort = resolved.snap?.locked ? resolved.snap.port : null;
      setSnapHighlight(resolved.snap?.port || null, resolved.snap?.locked);
      if (resolved.snap?.locked && !state.active.snapHinted) {
        state.active.snapHinted = true;
        toast('已吸附到目标端口，松开即可连接', '⌁');
      }
      ensureDragLoop();
      const sourceNode = state.active.port.closest('.flow-node');
      const hoverNode = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.flow-node');
      $$('.flow-node.connection-drop-target').forEach(node => { if (node !== hoverNode) node.classList.remove('connection-drop-target'); });
      if (hoverNode && hoverNode !== sourceNode) hoverNode.classList.add('connection-drop-target');
    });
    document.addEventListener('pointerup', event => {
      if (!state.active) return;
      const active = state.active;
      // 吸附锁定优先：指针在吸附阈值内时直接连到最近的有效目标端口（无需精确落在端口上）。
      if (active.snapPort && active.snapPort.isConnected && wouldConnect(active.port, active.snapPort)) {
        connect(active.port, active.snapPort);
        clearActive();
        return;
      }
      const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.port');
      if (hit && hit !== active.port) { connect(active.port, hit); clearActive(); return; }
      // Released anywhere over a card body: connect to that card using the matching port
      // (dropping from an output port lands on its input port and vice versa).
      const dropNode = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.flow-node, .group-frame');
      if (dropNode && !dropNode.contains(active.port)) {
        const wanted = active.direction === 'out' ? '.port-left' : '.port-right';
        const port = dropNode.querySelector(wanted);
        if (port) { connect(active.port, port); clearActive(); return; }
      }
      // A plain click always releases on top of the port it started from, so the distance test has to
      // run before the "released on the same port" branch, otherwise the quick menu never opens.
      const distance = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
      if (distance < 8) {
        const port = active.port;
        clearActive();
        window.setTimeout(() => notifyPortMenu(port, event.clientX, event.clientY), 0);
        return;
      }
      if (hit === active.port) { draw({ x: event.clientX, y: event.clientY }); return; }
      // 拖到画布空白处松手：交给宿主应用弹出「创建节点」菜单，在落点生成并自动连线。
      const dropSpace = toStageSpace(event.clientX, event.clientY);
      document.dispatchEvent(new CustomEvent('canvasflow:port-drop-canvas', {
        detail: {
          port: active.port,
          nodeId: active.nodeId,
          direction: active.direction,
          stageX: dropSpace.x,
          stageY: dropSpace.y,
          clientX: event.clientX,
          clientY: event.clientY,
        },
      }));
      clearActive();
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (state.active) { clearActive(); toast('已取消连线'); return; }
      // 取消选中连线 → 删除徽标随之消失（与「点空白处取消选中」互为补充）。
      if (state.selectedEdgeId) { state.selectedEdgeId = null; state.removeAnchor = null; draw(); toast('已取消选中连线', '⌁'); }
    });
    layer.addEventListener('pointerdown', event => {
      const removeTarget = event.target?.dataset?.edgeRemove;
      if (removeTarget) { event.preventDefault(); event.stopPropagation(); removeEdge(removeTarget); return; }
      const edgeId = event.target?.dataset?.edgeId;
      if (!edgeId) return;
      event.preventDefault(); event.stopPropagation();
      state.selectedEdgeId = state.selectedEdgeId === edgeId ? null : edgeId;
      state.selectedNodeId = null;
      // 删除徽标钉在「点击位置」（stage 坐标），之后固定不动、不跟随鼠标；取消选中即清除。
      const anchorPoint = toStageSpace(event.clientX, event.clientY);
      state.removeAnchor = state.selectedEdgeId === edgeId ? { edgeId, x: anchorPoint.x, y: anchorPoint.y } : null;
      draw();
      if (state.selectedEdgeId) toast('已选中连线，按 Delete 或点击 × 删除', '⌁');
    });
    layer.addEventListener('dblclick', event => {
      const edgeId = event.target?.dataset?.edgeId;
      if (edgeId) { event.preventDefault(); event.stopPropagation(); removeEdge(edgeId); }
    });
    // 徽标在独立覆盖层里，点击删除要在这里接（不能依赖连线层的事件冒泡）。
    badgeLayer.addEventListener('pointerdown', event => {
      const removeTarget = event.target?.dataset?.edgeRemove;
      if (!removeTarget) return;
      event.preventDefault(); event.stopPropagation();
      removeEdge(removeTarget);
    });
    wrap.addEventListener('pointerdown', event => {
      if (event.target.closest('.flow-node, .canvas-toolbar, .mini-map, #connectionLayer')) return;
      if (state.selectedEdgeId || state.selectedNodeId || state.selectedNodeIds.size) { state.selectedEdgeId = null; state.selectedNodeId = null; state.selectedNodeIds.clear(); draw(); }
    });
    window.addEventListener('resize', () => { releaseMagnet(); draw(); });
    // 磁性连接点的让位规则：按下鼠标（含节点拖拽/连线起点）/ 滚轮缩放 / 指针离开文档 / 窗口失焦 → 立即弹回原位。
    document.addEventListener('pointerdown', () => releaseMagnet(), true);
    document.addEventListener('wheel', () => releaseMagnet(), { passive: true });
    // 指针离开画布 / 窗口失焦 → 只释放磁性连接点；删除徽标是钉住的，不随鼠标离开而消失。
    document.addEventListener('pointerleave', () => releaseMagnet());
    window.addEventListener('blur', () => releaseMagnet());

    window.CanvasFlowConnections = {
      draw,
      connect,
      removeEdge,
      removeEdgesForNode,
      getEdges: () => state.edges.map(edge => ({ ...edge })),
      getSelectedEdgeId: () => state.selectedEdgeId,
      setSelectedNode: nodeId => {
        state.selectedNodeId = nodeId ? String(nodeId) : null;
        state.selectedNodeIds = new Set(state.selectedNodeId ? [state.selectedNodeId] : []);
        state.selectedEdgeId = null;
        draw();
      },
      setSelectedNodes: nodeIds => {
        state.selectedNodeIds = new Set((Array.isArray(nodeIds) ? nodeIds : []).filter(Boolean).map(String));
        state.selectedNodeId = [...state.selectedNodeIds][0] || null;
        state.selectedEdgeId = null;
        draw();
      },
      clearSelection: () => { state.selectedNodeId = null; state.selectedNodeIds.clear(); state.selectedEdgeId = null; draw(); },
      cancelConnection: clearActive,
      clearPortPending,
      magnet: {
        radius: MAGNET.RADIUS,
        release: releaseMagnet,
        active: () => (magnetPort ? { nodeId: magnetPort.closest('.flow-node')?.dataset.nodeId, side: portDirection(magnetPort), transform: magnetPort.style.transform } : null),
      },
      setEdges: edges => { state.edges = normalize(edges); state.selectedEdgeId = null; save(); draw(); },
      reset: () => { state.edges = defaultEdges(); state.selectedEdgeId = null; save(); draw(); },
    };

    state.selectedNodeId = $('.flow-node.selected')?.dataset.nodeId || null;
    if (state.selectedNodeId) state.selectedNodeIds.add(state.selectedNodeId);
    load();
    observe();
    draw();
    // A second pass after fonts/layout settle keeps the curves anchored to the real port positions.
    requestAnimationFrame(() => draw());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
