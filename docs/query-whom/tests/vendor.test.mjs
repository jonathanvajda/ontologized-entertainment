import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../',import.meta.url);

test('vendored QR libraries match the exact audited lockfile versions',async()=> {
  for (const [file,packageFile] of [['qrcode.js','qrcode-generator/qrcode.js'],['jsQR.js','jsqr/dist/jsQR.js']]) {
    const vendor=await readFile(new URL('vendor/'+file,root)),locked=await readFile(new URL('node_modules/'+packageFile,root));
    assert(vendor.equals(locked),`${file} differs from its pinned npm source`);
  }
  assert((await readFile(new URL('vendor/QRCODE-LICENSE.txt',root),'utf8')).includes('Permission is hereby granted'));
  assert((await readFile(new URL('vendor/JSQR-LICENSE.txt',root),'utf8')).includes('Apache License'));
});
