import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const source = await readFile(new URL('./diff.js',import.meta.url),'utf8');
const {parseDiff,readDiff,READ} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const parsed = parseDiff('--- a/test\n+++ b/test\n@@ -2,2 +2,2 @@\n 中文\n-old\n+新文字\n\\ No newline at end of file\n@@ -10 +12 @@\n-x\n+y\n');
assert.deepEqual(parsed.rows.filter(r=>r.kind==='context'),[{kind:'context',old:2,new:2,text:'中文'}]);
assert.deepEqual(parsed.rows.filter(r=>r.kind==='add').map(r=>[r.new,r.text]),[[3,'新文字'],[12,'y']]);
assert.deepEqual(parsed.rows.filter(r=>r.kind==='delete').map(r=>r.old),[3,10]);
assert.equal(parsed.rows.filter(r=>r.kind==='note').length,1);
assert.equal(parseDiff('@@ -0,0 +1,2 @@\n+a\n+b\n').rows.at(-1).new,2);
assert.equal(parseDiff('@@ -1,2 +0,0 @@\n-a\n-b\n').rows.at(-1).old,2);
assert.equal(parseDiff('similarity index 100%\nrename from old\nrename to new\n').rows.length,3);
assert.equal(parseDiff('Binary files a/a.png and b/a.png differ\n').binary,true);
assert.equal(parseDiff('x\n'.repeat(5001)).rows.length,5000);
assert.equal(parseDiff('x\n'.repeat(5001)).limited,true);
assert.deepEqual(parseDiff('').rows,[]);
const calls=[]; const git=async args=>{calls.push(args);return {code:0,stdout:''};};
const item={cwd:'fixture',hash:'abcdef1',parent:'1234567',path:'new 名.txt',oldPath:'old 名.txt'};
await readDiff(git,item); await readDiff(git,{...item,parent:''});
assert.deepEqual(calls[0].slice(-3),['--','old 名.txt','new 名.txt']);
assert.ok(calls[0].includes('--no-ext-diff') && calls[0].includes('--no-textconv'));
assert.ok(calls[1].includes('show') && calls[1].includes('--root'));
console.log('PASS: modification/add/delete/rename, multiple hunks, no newline, Unicode, binary, limit, read-only arguments');
if(process.argv[2]) {
  const real=async args=>{const r=spawnSync('git',[...READ,...args],{cwd:process.argv[2],encoding:'utf8'}); if(r.error) throw r.error; return {code:r.status,stdout:r.stdout};};
  for(const path of ['README.md','.gitignore']) {
    const diff=await readDiff(real,{...item,cwd:process.argv[2],hash:'d0b732a358e9d219f496cb1c3004177941f7e862',parent:'f8d3d05627efabf33c0e2715ff8cded3b20be4a6',path,oldPath:''});
    assert.ok(diff.rows.some(r=>r.kind==='add'));
    console.log(`PASS: real ${path}, ${diff.rows.length} rows`);
  }
  const root=spawnSync('git',[...READ,'rev-list','--max-parents=0','HEAD'],{cwd:process.argv[2],encoding:'utf8'}).stdout.trim().split('\n')[0];
  const files=spawnSync('git',[...READ,'ls-tree','--name-only',root],{cwd:process.argv[2],encoding:'utf8'}).stdout.trim().split('\n');
  const rootDiff=await readDiff(real,{...item,cwd:process.argv[2],hash:root,parent:'',path:files[0],oldPath:''});
  assert.ok(rootDiff.rows.some(r=>r.kind==='add')); console.log('PASS: real root commit');
}
