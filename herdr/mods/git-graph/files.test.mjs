import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const source = await readFile(new URL('./data.js', import.meta.url), 'utf8');
const { parseFileChanges, readFiles, READ, readHistory } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const input = ['M','README.md','A','中文 檔案.txt','D','old file.txt','R100','舊 名.txt','docs/新 名.txt',''].join('\0');
assert.deepEqual(parseFileChanges(input), [
  {status:'M',path:'README.md'}, {status:'A',path:'中文 檔案.txt'},
  {status:'D',path:'old file.txt'}, {status:'R',oldPath:'舊 名.txt',path:'docs/新 名.txt'}
]);
assert.deepEqual(parseFileChanges(''), []);
assert.throws(() => parseFileChanges('R100\0old\0'));
assert.throws(() => parseFileChanges('M\0missing terminator'));
const calls = [];
const git = async args => { calls.push(args); return {code:0,stdout:input}; };
for (const parents of [[], ['first'], ['first','second']]) await readFiles(git, {hash:'commit',parents});
const base = ['diff-tree','--no-commit-id','-r','--name-status','-M','-z'];
assert.deepEqual(calls[0], [...base,'--root','commit','--']);
assert.deepEqual(calls[1], [...base,'commit','--']);
assert.deepEqual(calls[2], [...base,'first','commit','--']);
await assert.rejects(readFiles(async () => ({code:1}), {hash:'commit',parents:[]}));
console.log('PASS: M/A/D/R100, Unicode/spaces, empty/malformed output, normal/root/first-parent merge, Git failure');
// Exercise the actual click handler without native UI automation.
const main = await readFile(new URL('./main.js', import.meta.url), 'utf8');
const method = main.slice(main.indexOf('  expand(commit, cx)'), main.indexOf('\n  details(commit, t)'));
let reads = 0;
const tasks = [];
const target = {cwd:'fixture',on:null};
const Expand = new Function('location','readFiles','exec','READ', `return class { ${method} };`)(
  () => target, readFiles, async (_program,args,options) => {
    reads++; assert.deepEqual(args.slice(0, READ.length), READ); assert.equal(options.cwd,'fixture');
    return {code:0,stdout:input};
  }, READ);
const view = new Expand(); view.open = null; view.fileCache = new Map();
const cx = {notify() {}, spawn(task) {tasks.push(task(cx));}};
const fixture = {hash:'commit',parents:['first','second']};
view.expand(fixture,cx);
assert.equal(view.open,'commit'); assert.equal(view.fileCache.get('commit').loading,true);
await Promise.all(tasks);
assert.equal(view.fileCache.get('commit').files.length,4);
assert.equal(view.fileCache.get('commit').loading,false);
view.expand(fixture,cx); assert.equal(view.open,null);
view.expand(fixture,cx); assert.equal(view.open,'commit'); assert.equal(reads,1);
console.log('PASS: actual expand handler, loading state, file result, collapse/reopen memory cache, READ arguments');
if (process.argv[2]) {
  const realGit = async args => {
    const result = spawnSync('git', [...READ, ...args], {cwd:process.argv[2],encoding:'utf8'});
    return {code:result.status,stdout:result.stdout};
  };
  const commits = await readHistory(realGit, 'HEAD');
  const commit = commits.find(c => c.hash.startsWith('d0b732a'));
  assert.ok(commit && commit.parents.length > 1);
  const files = await readFiles(realGit, commit);
  assert.deepEqual(files.map(f => [f.path,f.status]), [
    ['.gitignore','M'], ['LICENSE','A'], ['README.md','M'], ['context-bar.py','A'],
    ['docs/screenshot.png','A'], ['install.ps1','A'], ['update-usage-cache.py','A']
  ]);
  console.log('PASS: real merge d0b732a, all seven expected files and statuses');
}
