'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {sameOrigin, externalURL, downloadName, startupPath, parseDesktopConfig} = require('../tools/desktop/app/policy.cjs');
test('desktop navigation never trusts origin prefixes, credentials, files or script protocols', () => {
  const origin = 'http://127.0.0.1:5173';
  assert(sameOrigin(origin+'/?project=one',origin));
  for (const url of [origin+'.evil.test','http://127.0.0.1:5174/','http://bad:secret@127.0.0.1:5173/','file:///C:/Windows','javascript:alert(1)','data:text/html,test']) assert(!sameOrigin(url,origin));
  for (const url of ['file:///C:/Windows','javascript:alert(1)','ms-msdt:test','https://user:pass@example.com/']) assert.equal(externalURL(url),null);
  assert.equal(externalURL('https://example.com/help'),'https://example.com/help');
});

test('Windows reserved device names and trailing dots are made safe before the save dialog', () => {
  for (const name of ['CON.json','aux.png','LPT1.glb','COM9.wav','NUL']) {
    assert(!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(downloadName(name)),name);
  }
  assert.equal(downloadName('export.json.  '),'export.json');
});
test('desktop config accepts UTF-8 BOM and rejects invalid path/port types with useful errors', () => {
  assert.equal(parseDesktopConfig('\ufeff{"dataDirectory":"./data"}').dataDirectory,'./data');
  for (const value of [[],null,{dataDirectory:123},{backendDirectory:{}},{port:'5173'},{port:0},{port:65536}]) {
    assert.throws(()=>parseDesktopConfig(JSON.stringify(value)));
  }
  assert.equal(parseDesktopConfig('{"port":5280}').port,5280);
});
test('current and future Windows shortcuts use the exact product name', () => {
  const product=require('../tools/desktop/app/product.cjs');
  const installer=require('../tools/desktop/windows-installer-config.cjs');
  assert.equal(product.name,'CanvasFlow');assert.equal(product.shortcutName,'CanvasFlow');
  assert.equal(installer.productName,'CanvasFlow');assert.equal(installer.nsis.shortcutName,'CanvasFlow');
});
test('restored desktop routes and download names cannot escape their intended origin/path', () => {
  for (const route of ['//example.com','/\\example.com','http://example.com','javascript:test','/\n/evil']) assert.equal(startupPath(route),'/');
  assert.equal(startupPath('/?project=existing'),'/?project=existing');
  assert.equal(downloadName('../../secret.json'),'secret.json');
  assert.equal(downloadName('C:\\Users\\test\\export.json'),'export.json');
  assert.equal(downloadName('bad:name?.png'),'bad_name_.png');
});
