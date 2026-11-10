export function tipLines(kind, value) {
  if (kind === 'commit') return [
    {text:`${value.hash.slice(0, 8)} · 作者：${value.author} · 日期：${value.date.replace('T', ' ')}`, bold:true},
    ...value.refs.filter(r => !r.name.endsWith('/HEAD')).map(r => ({text:r.name, kind:r.kind})),
    {text:value.message || value.subject || '（無提交訊息）', gap:true}
  ];
  if (kind === 'badge') return value.flatMap(ref => ref.tooltip.split('\n').map(text => ({text, kind:ref.kind})));
  if (kind === 'file') return [{text:`${({M:'修改',A:'新增',D:'刪除',R:'重新命名',C:'複製',T:'類型變更'})[value.status] || value.status}：${value.oldPath ? value.oldPath + ' → ' : ''}${value.path}`}];
  return [{text:'重新整理提交歷史'}];
}

// A generation invalidates delayed callbacks after leave, scrolling or clicking.
export class HoverTip {
  constructor() { this.generation = 0; this.active = null; this.visible = null; }
  enter(id, lines) { this.active = {id, lines}; this.visible = null; return ++this.generation; }
  reveal(token) { if (token !== this.generation || !this.active) return false; this.visible = this.active; return true; }
  clear(id) {
    if (id && this.active?.id !== id) return false;
    const changed = !!this.visible;
    this.active = this.visible = null; this.generation++;
    return changed;
  }
}

export function tipPlacement(panelHeight, rowTop, rowBottom, height) {
  const below = Math.max(0, panelHeight - rowBottom - 12), above = Math.max(0, rowTop - 12);
  const up = height > below && above > below;
  const available = up ? above : below;
  return {top: up ? Math.max(6, rowTop - Math.min(height, available) - 6) : Math.max(6, rowBottom + 6), maxHeight:available};
}
