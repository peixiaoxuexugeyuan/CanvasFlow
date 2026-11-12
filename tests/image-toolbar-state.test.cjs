const fs = require('node:fs'), vm = require('node:vm');
const test = require('node:test'), assert = require('node:assert/strict');
const acorn = require('../tools/release/node_modules/acorn');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const functions = {};
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration') functions[node.id.name] = source.slice(node.start, node.end);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(acorn.parse(source, {ecmaVersion: 'latest'}));

function fixture() {
  const buttons = Array.from({length: 14}, () => ({hidden: false, disabled: true, hasAttribute: () => false}));
  const toolbar = {hidden: false, querySelector: () => null};
  function imageNode() {
    const preview = {dataset: {}, style: {}, classList: {add() {}}, querySelector: () => null};
    return {dataset: {node: 'image'}, preview,
      matches: selector => selector === '.image-node',
      querySelector: selector => selector === '.media-preview' ? preview : null};
  }
  const node = imageNode();
  const scope = {Image: class {}, document: {contains: () => true}, selected: node,
    $: selector => selector === '#nodeQuickToolbar' ? toolbar : null,
    $$: () => buttons, singleSelectedNode: () => scope.selected};
  vm.createContext(scope);
  vm.runInContext(['nodeImageHandles', 'nodeHasUsableImage', 'quickToolbarGroup',
    'syncQuickToolbarLabels', 'refreshQuickToolbarState', 'setMediaNodeImage',
    'setMediaNodeImageUrl'].map(name => functions[name]).join('\n'), scope);
  return {scope, node, buttons, imageNode};
}

test('uploading into a selected empty image node immediately enables every image tool', () => {
  const {scope, node, buttons} = fixture();
  scope.refreshQuickToolbarState();
  assert.ok(buttons.every(button => button.disabled));
  scope.setMediaNodeImage(node, 'data:image/png;base64,AQ==', 'upload.png', 'asset-1');
  assert.ok(buttons.every(button => !button.disabled));
});

test('restoring a selected image from a media URL immediately enables its tools', () => {
  const {scope, node, buttons} = fixture();
  scope.setMediaNodeImageUrl(node, '/media/restored.png', 'restored.png');
  assert.ok(buttons.every(button => !button.disabled));
});

test('a background image update does not enable tools for a selected empty node', () => {
  const {scope, buttons, imageNode} = fixture();
  scope.setMediaNodeImage(imageNode(), 'data:image/png;base64,AQ==', 'background.png');
  assert.ok(buttons.every(button => button.disabled));
});

test('cancelling or passing an invalid image leaves empty-node tools disabled', () => {
  const {scope, node, buttons} = fixture();
  scope.setMediaNodeImage(node, '', 'cancelled.png');
  scope.setMediaNodeImageUrl(node, '', 'cancelled.png');
  assert.ok(buttons.every(button => button.disabled));
});
