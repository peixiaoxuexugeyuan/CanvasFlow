/* CanvasFlow's initial workspace for OpenFilm 0.3.2. No project or media data is changed. */
(function () {
  'use strict';
  // Report only the visible project identity, never the editor session key.
  if (typeof window !== 'undefined' && window.parent !== window) {
    let layout='',clip=null,clipProject='',lastReport='';
    const projectId=()=>{const match=/^\/projects\/([^/]+)/.exec(location.pathname);return match?decodeURIComponent(match[1]):'';};
    const tell=(event,data)=>window.parent.postMessage({type:'canvasflow-film-host',event,projectId:projectId(),...data},'*');
    // OpenFilm's supported host API enables its own reference menus and hides the desktop download prompt.
    window.openfilmHost={version:1,name:'CanvasFlow',
      openCanvas:()=>tell('canvas',{}),
      refer:ref=>tell('reference',{ref}),ask:request=>tell('ask',{request}),
      useSkill:skill=>tell('skill',{skill}),
      // Use the native selection callback for mouse, keyboard, multi-selection,
      // deletion and undo alike. A pointerup DOM guess can restore a deselected clip.
      onSelection:selection=>{
        if(selection.projectId!==projectId())return;
        clipProject=selection.projectId;
        clip=selection.refs?.find(ref=>ref.kind==='clip')||null;
        report();
      },
    };
    window.addEventListener?.('message',event=>{
      if(event.source!==window.parent || event.data?.type!=='canvasflow-film-command' || event.data.projectId!==projectId())return;
      if(event.data.action==='canvas')document.querySelector('[data-work-mode="edit"]')?.click();
    });
    function report() {
      const current=projectId();
      if(clipProject!==current){clip=null;clipProject=current;}
      let saved=null;try{const value=localStorage.getItem('openfilm.workspace.current.v2');if(value&&value!==layout){layout=value;saved=JSON.parse(value);}}catch{}
      const next=JSON.stringify({projectId:current,clip,layout});
      if(next===lastReport)return;
      lastReport=next;
      window.parent.postMessage({type:'canvasflow-film-project',projectId:current,clip,layout:saved}, '*');
    }
    report(); setInterval(report, 500);
  }
  const key = 'openfilm.workspace.current.v2';
  const revision = 'canvasflow.editor.layout.v1';
  const pane = panel => ({panel});
  const split = (axis, first, second, ratio, size, anchor = 'first') => ({
    axis, first, second, ratio, ...(size ? {size, anchor} : {}),
  });
  try {
    if (!localStorage.getItem('openfilm.language')) localStorage.setItem('openfilm.language', 'zh-CN');
    if (localStorage.getItem(revision)) return;
    const old = localStorage.getItem(key);
    if (old) localStorage.setItem('canvasflow.editor.previousLayout', old);
    const common = {
      assets: true, layers: false, timeline: true, inspector: false, chat: false,
      libraryDock: 'left', chatSide: 'left', layersSide: 'left', inspectorSide: 'right',
      timelineEdge: 'bottom', assetsWidth: 280, libraryHeight: 260,
      layersWidth: 200, inspectorWidth: 280, timelineHeight: 240, chatWidth: 360,
    };
    // Keep all native panels in the tree, even hidden ones, so Layout controls keep working.
    const viewer = split('x', pane('viewer'), pane('inspector'), .75, 280, 'second');
    const main = split('x', pane('library'), split('x', pane('layers'), viewer, .25, 200), .3, 280);
    const edit = {...common, mode: 'edit', tree:
      split('x', pane('chat'), split('y', main, pane('timeline'), .68), .25, 360)};
    const canvas = {...common, mode: 'canvas', timeline: false, tree: null};
    localStorage.setItem(key, JSON.stringify({version: 2, edit, canvas}));
    localStorage.setItem('openfilm.library.rail', '88');
    localStorage.setItem(revision, '1');
  } catch (_) { /* Browser storage restrictions must not prevent the editor from opening. */ }
})();
