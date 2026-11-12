'use strict';
const path = require('node:path');
function sameOrigin(value, origin) {
  try { const url = new URL(value); return url.origin === origin && !url.username && !url.password; }
  catch { return false; }
}
function externalURL(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && value.length < 8192 ? url.href : null;
  } catch { return null; }
}
function downloadName(value) {
  let name=path.basename(String(value || 'CanvasFlow-download').replaceAll('\\', '/')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0,180).replace(/[. ]+$/g,'');
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name='CanvasFlow-'+name;
  return name || 'CanvasFlow-download';
}
function parseDesktopConfig(text) {
  const value=JSON.parse(String(text).replace(/^\uFEFF/,''));
  if (!value || typeof value!=='object' || Array.isArray(value)) throw Error('桌面配置必须是对象');
  for (const field of ['dataDirectory','backendDirectory']) {
    if (value[field]!==undefined && (typeof value[field]!=='string' || !value[field].trim() || /[\x00-\x1f]/.test(value[field]))) throw Error(field+' 必须是有效的文件夹路径');
  }
  if (value.port!==undefined && (!Number.isInteger(value.port) || value.port<1 || value.port>65535)) throw Error('port 必须是 1–65535 之间的整数');
  if (value.startupPath!==undefined && typeof value.startupPath!=='string') throw Error('startupPath 必须是页面路径字符串');
  return value;
}
function startupPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f]/.test(value)) return '/';
  try { return new URL(value, 'http://127.0.0.1').origin === 'http://127.0.0.1' ? value : '/'; }
  catch { return '/'; }
}
module.exports = {sameOrigin, externalURL, downloadName, startupPath, parseDesktopConfig};
