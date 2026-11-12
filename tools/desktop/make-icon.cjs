'use strict';
// Reuse the existing triangle brand mark; no wordmark in the executable icon.
const fs = require('node:fs'), path = require('node:path');
const sharp = require(process.env.CANVASFLOW_SHARP || 'sharp');
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="58" fill="#111111"/><path d="M56 190 128 56l72 134z" fill="#fafaf9"/></svg>`);
(async () => {
  const sizes = [16,24,32,48,64,128,256];
  const images = await Promise.all(sizes.map(size => sharp(svg).resize(size,size).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * sizes.length); header.writeUInt16LE(1,2); header.writeUInt16LE(sizes.length,4);
  let offset = header.length;
  for (let i=0;i<sizes.length;i++) {
    const start = 6 + i*16; header[start] = sizes[i] % 256; header[start+1] = sizes[i] % 256;
    header.writeUInt16LE(1,start+4); header.writeUInt16LE(32,start+6); header.writeUInt32LE(images[i].length,start+8); header.writeUInt32LE(offset,start+12); offset += images[i].length;
  }
  fs.writeFileSync(path.join(__dirname,'app/icon.ico'), Buffer.concat([header,...images]));
  fs.writeFileSync(path.join(__dirname,'app/icon.png'), images.at(-1));
})().catch(error => {console.error(error);process.exitCode=1;});
