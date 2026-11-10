import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const source=await readFile(new URL('./icons.js',import.meta.url),'utf8');
const {fileIcon}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const cases={markdown:['md','markdown'],python:['py'],javascript:['js','mjs','cjs'],typescript:['ts','tsx'],json:['json'],config:['toml','yml','yaml','ini','cfg','conf'],shell:['ps1','psm1','sh','bash','bat','cmd'],image:['png','jpg','jpeg','gif','svg','webp','ico'],text:['txt','log'],html:['html','htm'],css:['css','scss'],archive:['zip','7z','tar','gz']};
for(const [type,extensions] of Object.entries(cases)) for(const ext of extensions) {
  assert.equal(fileIcon(`test.${ext}`),`mods/my-files/icons/${type}.svg`);
  assert.equal(fileIcon(`TEST.${ext.toUpperCase()}`),`mods/my-files/icons/${type}.svg`);
}
assert.equal(fileIcon('README.MD'),'mods/my-files/icons/markdown.svg');
for(const name of ['LICENSE','LICENSE.md','license-MIT','COPYING','Copying.txt']) assert.equal(fileIcon(name),'mods/my-files/icons/license.svg');
for(const name of ['.gitignore','.gitattributes','.gitmodules','.GITIGNORE']) assert.equal(fileIcon(name),'mods/my-files/icons/git.svg');
for(const name of ['Makefile','file.unknown','','.env']) assert.equal(fileIcon(name),null);
for(const type of [...Object.keys(cases),'license','git']) {
  const path=new URL(`./icons/${type}.svg`,import.meta.url); await access(path);
  const svg=await readFile(path,'utf8'); assert.match(svg,/viewBox="0 0 32 32"/); assert.match(svg,/width="64"/); assert.match(svg,/height="64"/); assert.doesNotMatch(svg,/<text|<script|<image|currentColor/);
}
console.log('通過：全部類型與大小寫、授權檔、Git 隱藏檔、預設圖示、14 個 SVG 資源、32×32 設計網格與 64×64 固有尺寸。');
