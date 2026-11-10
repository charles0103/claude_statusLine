function normalize(path) {
  const value = path.replace(/\\/g, "/");
  const prefix = value.startsWith("//") ? "//" : value.startsWith("/") ? "/" : "";
  const parts = [];
  for (const part of value.slice(prefix.length).split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." && parts.length && !parts.at(-1).endsWith(":")) parts.pop();
    else if (part !== "..") parts.push(part);
  }
  return prefix + parts.join("/");
}

export function formatMention(path, cwd) {
  if (typeof path !== "string" || !path || /[\r\n\0]/.test(path)) throw new Error("此路徑含有無法安全插入的字元");
  const absolute = normalize(path), base = typeof cwd === "string" && cwd ? normalize(cwd) : "";
  const windows = /^[A-Za-z]:/.test(absolute) || absolute.startsWith("//");
  const compare = value => windows ? value.toLowerCase() : value;
  const prefix = base.endsWith("/") ? base : base + "/";
  let result = absolute;
  if (base && compare(absolute) === compare(base)) result = ".";
  else if (base && compare(absolute).startsWith(compare(prefix))) result = absolute.slice(prefix.length);
  if (/[\s"]/.test(result)) result = '"' + result.replace(/"/g, '\\"') + '"';
  return "@" + result + " ";
}

export function chooseTerminal(panes, tab, recent) {
  const terminals = panes.filter(p => p.tab === tab && p.terminal);
  const agents = terminals.filter(p => p.program?.agent);
  return agents.find(p => p.focused) || agents.find(p => p.terminal === recent) || agents[0] || terminals.find(p => p.focused) || null;
}
