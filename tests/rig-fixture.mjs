import fs from 'node:fs';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
export async function loadRig(path){
 const file=fs.readFileSync(path);const len=file.readUInt32LE(12),j=JSON.parse(file.subarray(20,20+len).toString());
 delete j.images;delete j.textures;delete j.samplers;j.materials=[{pbrMetallicRoughness:{baseColorFactor:[.31,.56,.97,1],metallicFactor:0,roughnessFactor:.7}}];
 for(const mesh of j.meshes||[])for(const p of mesh.primitives||[])p.material=0;
 const json=Buffer.from(JSON.stringify(j));const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);const binary=file.subarray(20+len);const out=Buffer.alloc(20+padded.length+binary.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);binary.copy(out,20+padded.length);
 return await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}
