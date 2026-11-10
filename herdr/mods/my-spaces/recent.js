// Keep source order; Windows paths are case insensitive, POSIX paths are not.
export function recentFolders(entries, machine = '', home = '') {
  const key = path => {
    const windows = /^[a-z]:[\\/]|^\\\\|^\/\//i.test(path);
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
    return windows ? normalized.toLowerCase() : normalized;
  };
  const seen = new Set(), result = [];
  for (const entry of entries) {
    if (!entry || (entry.machine || '') !== (machine || '')) continue;
    const folder = entry.folder;
    if (typeof folder !== 'string' || !folder.trim() || folder === '~' || /[\r\n\0]/.test(folder)) continue;
    const id = key(folder);
    if ((home && id === key(home)) || seen.has(id)) continue;
    seen.add(id);
    result.push({ folder, name: folder.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || folder });
    if (result.length === 8) break;
  }
  return result;
}
