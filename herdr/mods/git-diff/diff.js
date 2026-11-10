// Same read-only flags as git-graph/data.js; Herdr isolates each mod's imports.
export const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false"];
export const selectionKey = tab => `git-diff.selection.${tab}`;

export function parseDiff(text, limit = 5000) {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const binary = lines.some(line => /^Binary files .* differ$/.test(line) || line === "GIT binary patch");
  const rows = [];
  let old = 0, next = 0, inHunk = false;
  for (const line of lines.slice(0, limit)) {
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (match) {
      old = Number(match[1]); next = Number(match[2]); inHunk = true;
      rows.push({kind:"hunk",text:line});
    } else if (inHunk && line.startsWith("+")) rows.push({kind:"add",new:next++,text:line.slice(1)});
    else if (inHunk && line.startsWith("-")) rows.push({kind:"delete",old:old++,text:line.slice(1)});
    else if (inHunk && line.startsWith(" ")) rows.push({kind:"context",old:old++,new:next++,text:line.slice(1)});
    else if (line.startsWith("\\ No newline")) rows.push({kind:"note",text:"此行結尾沒有換行字元"});
    else { if (line.startsWith("diff --git")) inHunk = false; rows.push({kind:"meta",text:line}); }
  }
  return {rows,binary,limited:lines.length > limit};
}

export async function readDiff(git, item) {
  if (!/^[0-9a-f]{7,64}$/i.test(item.hash ?? "") || (item.parent && !/^[0-9a-f]{7,64}$/i.test(item.parent)) || !item.path || !item.cwd)
    throw new Error("提交或檔案資訊不完整");
  const paths = [...new Set([item.oldPath,item.path].filter(Boolean))];
  const args = item.parent
    ? ["--literal-pathspecs","diff","--no-color","--no-ext-diff","--no-textconv","-M",item.parent,item.hash,"--",...paths]
    : ["--literal-pathspecs","show","--format=","--root","--no-color","--no-ext-diff","--no-textconv","-M",item.hash,"--",...paths];
  const result = await git(args);
  if (result.code !== 0) throw new Error("無法讀取差異");
  return parseDiff(result.stdout);
}
