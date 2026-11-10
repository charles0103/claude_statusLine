// Only read-only Git commands; no shell interpolation or external helpers.
export const LIMIT = 200;
export const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false"];
export const LOG_FORMAT = "%H%x00%P%x00%D%x00%an%x00%aI%x00%s%x00%B%x00";

export function parseFileChanges(text) {
  if (!text) return [];
  const fields = text.split("\0");
  if (fields.pop() !== "") throw new Error("檔案清單格式不完整");
  const files = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i++];
    if (!/^[A-Z][0-9]*$/.test(status) || !fields[i]) throw new Error("無法解析檔案清單");
    const first = fields[i++];
    if (/^[RC]/.test(status)) {
      if (!fields[i]) throw new Error("重新命名資料不完整");
      files.push({ status: status[0], path: fields[i++], oldPath: first });
    } else files.push({ status: status[0], path: first });
  }
  return files;
}

export async function readFiles(git, commit) {
  const args = ["diff-tree", "--no-commit-id", "-r", "--name-status", "-M", "-z"];
  if (!commit.parents.length) args.push("--root");
  if (commit.parents.length > 1) args.push(commit.parents[0]);
  args.push(commit.hash, "--");
  const result = await git(args);
  if (result.code !== 0) throw new Error("無法讀取提交檔案");
  return parseFileChanges(result.stdout);
}

export function parseRefs(value) {
  return value.split(", ").filter(Boolean).map(raw => {
    const name = raw.replace(/^HEAD -> /, "");
    if (name.startsWith("refs/heads/")) return { name: name.slice(11), kind: "local" };
    if (name.startsWith("refs/remotes/")) return { name: name.slice(13), kind: "remote" };
    if (name.startsWith("tag: refs/tags/")) return { name: name.slice(15), kind: "tag" };
    return { name: name === "HEAD" ? "目前位置" : name, kind: "other" };
  });
}

export function parseLog(text) {
  const fields = text.split("\0"), commits = [];
  for (let i = 0; i + 6 < fields.length; i += 7) {
    const hash = fields[i].trim();
    if (!/^[a-f0-9]{40,64}$/.test(hash)) throw new Error("無法解析提交資料");
    commits.push({ hash, parents: fields[i + 1].split(" ").filter(Boolean),
      refs: parseRefs(fields[i + 2]), author: fields[i + 3], date: fields[i + 4],
      subject: fields[i + 5], message: fields[i + 6].replace(/\n$/, "") });
  }
  return commits;
}

export async function readSummary(git) {
  const repo = await git(["rev-parse", "--git-dir"]);
  if (repo.code !== 0) return { signature: "非儲存庫", error: "此資料夾不是 Git 儲存庫", head: "" };
  const [head, refs, branch] = await Promise.all([
    git(["rev-parse", "--verify", "HEAD"]),
    git(["for-each-ref", "--sort=refname", "--format=%(refname)%00%(objectname)%00%(*objectname)%00%(symref)"]),
    git(["symbolic-ref", "--quiet", "HEAD"]),
  ]);
  if (refs.code !== 0 || branch.code > 1) throw new Error("無法讀取參照");
  return { head: head.code === 0 ? head.stdout.trim() : "", error: "",
    signature: JSON.stringify([repo.stdout, head.code, head.stdout, refs.stdout, branch.stdout]) };
}

export async function readHistory(git, head) {
  const result = await git(["log", "--all", ...(head ? ["HEAD"] : []), "--date-order",
    "--no-color", "--no-show-signature", "--decorate=full", "--encoding=UTF-8",
    `--max-count=${LIMIT}`, `--pretty=format:${LOG_FORMAT}`, "--"]);
  if (result.code !== 0) throw new Error("無法讀取提交歷史");
  return parseLog(result.stdout);
}
