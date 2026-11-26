const assert = require('node:assert/strict');

// Check the layer the user actually sees. A transparent overlay on top of the
// original opaque photo still leaves the backdrop in the editor.
function previewHasCutout(source) {
  const box = document.querySelector('dialog[open] .rs-image-box');
  const original = box?.querySelector('img[alt="角色预览"]');
  if (!original?.currentSrc.endsWith(source)) return false;
  const surface = document.createElement('canvas');
  surface.width = 64;
  surface.height = 64;
  const ctx = surface.getContext('2d', {willReadFrequently:true});
  for (const layer of box.querySelectorAll('img,canvas')) {
    const style = getComputedStyle(layer);
    if (layer.hidden || style.display === 'none' || style.visibility === 'hidden' || !Number(style.opacity)) continue;
    if (layer instanceof HTMLImageElement && (!layer.complete || !layer.naturalWidth)) return false;
    ctx.drawImage(layer, 0, 0, 64, 64);
  }
  const rgba = ctx.getImageData(0, 0, 64, 64).data;
  let transparent = 0, opaque = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 24) transparent++;
    if (rgba[i] > 230) opaque++;
  }
  return transparent > 220 && opaque > 200;
}

module.exports = async function checkRoleCutouts({page, modal, api, headers, openLibrary, historical}) {
  const customId = 'char-uploaded-foreground-test';
  const upload = await page.evaluate(async () => {
    const image = new Image();
    image.src = 'assets/role-studio/subjects/024-2.webp';
    await image.decode();
    const surface = document.createElement('canvas');
    surface.width = 384;
    surface.height = 512;
    const ctx = surface.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 384, 512);
    gradient.addColorStop(0, '#92739a');
    gradient.addColorStop(.5, '#92b7ac');
    gradient.addColorStop(1, '#356075');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 384, 512);
    ctx.drawImage(image, 0, 0, 384, 512);
    return surface.toDataURL('image/jpeg').split(',')[1];
  });
  const {media} = await api('POST','/api/media',{
    headers:{...headers,'Content-Type':'image/jpeg','X-Media-Name':'portrait.jpg','X-Media-Type':'image/jpeg'},
    data:Buffer.from(upload,'base64'),
  });
  const record = {id:customId,name:'上传角色抠图测试',value:'单人',images:[media.url,historical,'','']};
  await api('PUT','/api/preset-roles/record?scope=mine',{data:{id:customId,record,expectedRevision:''}});
  await page.reload();
  await page.locator('[data-node-id="original-note"]').waitFor();
  const library = page.locator('#roleLibraryModal.open');
  const open = async (scope,id) => {
    if (!await library.isVisible()) await openLibrary();
    await page.locator('[data-role-scope="'+scope+'"]').click();
    await page.locator('[data-role-select="'+id+'"]').click();
    await page.locator('#roleLibraryMain [data-role-style="'+id+'"]').click();
    await modal.waitFor();
  };
  const verify = source => page.waitForFunction(previewHasCutout, source, {timeout:60000,polling:200});
  const back = () => modal.locator('[data-action=back]').click();
  const framing = view => modal.locator('[data-action="'+view+'"]').click();
  await open('official','libtv-052');
  await verify('052-2.jpg');
  await framing('full');
  await verify('052-1.jpg');
  await back();
  await open('mine',customId);
  await verify(media.url);
  await framing('full');
  await framing('half');
  await verify(media.url);
  const slider = modal.locator('.rs-slider input').first();
  await slider.press('ArrowRight');
  await verify(media.url);
  await modal.locator('[data-action=undo]').click();
  await framing('full');
  await verify(media.url);
  await back();
  const records = (await api('GET','/api/preset-roles')).mine;
  assert.deepEqual(records.custom.find(r=>r.id===customId).images,record.images);
  await api('PUT','/api/preset-roles/record?scope=mine',{data:{
    id:customId, remove:true, expectedRevision:records.recordRevisions[customId],
  }});
  await page.locator('[data-role-scope=official]').click();
  await page.locator('[data-role-select="libtv-024"]').click();
};
