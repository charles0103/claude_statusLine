import { View, div, svg, PathBuilder } from "gpui-kit";
import { v_flex, h_flex, Scrollbar } from "gpui-base";
import { focused, spaces, panes, exec, theme, settings, run, shared, setShared } from "herdr";
const selectionKey = tab => `git-diff.selection.${tab}`;
import { layoutLanes } from "./lanes.js";
import { READ, LIMIT, readSummary, readHistory, readFiles } from "./data.js";

function location() {
  const f = focused(), all = spaces();
  const space = all.find(s => s.id === f?.space) || all.find(s => s.active);
  const list = panes();
  const pane = list.find(p => p.pane === f?.pane);
  const fallback = list.find(p => p.tab === f?.tab && p.cwd)
    || list.find(p => space?.tabs.some(tab => tab.id === p.tab) && p.cwd);
  const block = f?.pane === null && f?.terminal;
  const on = block ? (f.terminal.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  const cwd = pane?.cwd || f?.cwd || fallback?.cwd || space?.folder;
  // Focusing a diff pane in the same tab must keep the expanded commit visible.
  return { cwd, on, key: JSON.stringify([cwd, on, f?.space, f?.tab]) };
}

const ROW = 28, STEP = 24;
const x = lane => 10 + lane * STEP;
// Keep branch colors vivid independently of the terminal's ANSI palette.
const palette = () => settings().dark
  ? ["#42a5ff", "#ffbd16", "#ed48a6", "#46d39a", "#b18cff", "#ff845c", "#38d5e6"]
  : ["#006fce", "#9b6800", "#c02580", "#087e52", "#7846c4", "#bd481c", "#007f91"];
const refColor = (ref, t) => {
  const colors = palette();
  return ref.kind === "local" ? colors[0] : ref.kind === "remote" ? colors[5] : ref.kind === "tag" ? colors[1] : t.muted;
};

function badges(refs) {
  const visible = refs.filter(ref => !ref.name.endsWith("/HEAD"));
  const locals = visible.filter(ref => ref.kind === "local");
  const remoteName = ref => ref.name.slice(ref.name.indexOf("/") + 1);
  return [...locals, ...visible.filter(ref => ref.kind !== "local")]
    .filter(ref => !(ref.kind === "remote" && locals.some(local => local.name === remoteName(ref))))
    .map(ref => {
      const remotes = ref.kind === "local"
        ? visible.filter(remote => remote.kind === "remote" && remoteName(remote) === ref.name) : [];
      return { ...ref, synced: remotes.length > 0,
        label: ref.name + (remotes.length ? " ↑↓" : ""),
        tooltip: [ref.name, ...remotes.map(remote => remote.name)].join("\n") + (remotes.length ? "\n與遠端同步" : "") };
    });
}
const badgeWidth = badge => [...badge.label].reduce((sum, c) => sum + (c.charCodeAt(0) > 255 ? 11 : 6.5), 14);

export default class GitGraph extends View {
  init(_props, cx) {
    this.rows = []; this.context = null; this.serial = 0;
    this.fileCache = new Map(); this.fileRepo = null;
    this.error = ""; this.head = ""; this.open = null; this.loading = false;
    this.refresh(cx);
    cx.timer.every(5000, cx => this.refresh(cx));
  }

  refresh(cx, force = false) {
    const target = location();
    const repo = JSON.stringify([target.on, target.cwd]);
    if (repo !== this.fileRepo) { this.fileRepo = repo; this.fileCache = new Map(); }
    if (target.key !== this.context) {
      this.context = target.key; this.serial++; this.pending = null;
      this.signature = null; this.rows = []; this.head = ""; this.open = null;
      this.error = target.cwd ? "" : "請先選擇有資料夾的終端機";
      this.loading = Boolean(target.cwd);
    }
    if (!target.cwd || this.pending !== null) return;
    const token = ++this.serial;
    this.pending = token;
    if (force) { this.loading = true; cx.notify(); }
    const current = () => this.serial === token && location().key === target.key;
    const git = args => exec("git", [...READ, ...args], { cwd: target.cwd, on: target.on });
    cx.spawn(async cx => {
      let changed = false;
      try {
        const summary = await readSummary(git);
        if (!current()) return;
        if (!force && summary.signature === this.signature && !this.error) return;
        const commits = summary.error ? [] : await readHistory(git, summary.head);
        if (!current()) return;
        const display = JSON.stringify([commits, summary.head, summary.error]);
        changed = display !== this.display || this.error !== summary.error;
        this.display = display; this.signature = summary.signature;
        this.rows = layoutLanes(commits); this.head = summary.head; this.error = summary.error;
        if (!commits.some(c => c.hash === this.open)) this.open = null;
      } catch {
        if (!current()) return;
        const message = "無法讀取 Git 資料，請確認 Git、資料夾與機器連線後重新整理";
        changed = this.error !== message || this.rows.length > 0;
        this.error = message; this.rows = []; this.signature = null;
      } finally {
        if (this.pending === token) this.pending = null;
        if (current()) {
          changed = changed || this.loading;
          this.loading = false;
          if (changed) cx.notify();
        }
      }
    });
  }

  graph(row, width, t, continuation = false) {
    const colors = palette(t);
    const graph = div().w(width).flex_none().relative();
    if (!continuation) graph.h(ROW);
    const edges = continuation
      ? row.after.flatMap((slot, lane) => slot ? [{ from: lane, to: lane, start: 0, end: 1, color: slot.color }] : [])
      : row.edges;
    for (const edge of edges) {
      const from = x(edge.from), to = x(edge.to);
      const path = PathBuilder.stroke(2.2);
      if (continuation || from === to) {
        path.move_to(from, `${edge.start * 100}%`).line_to(to, `${edge.end * 100}%`);
      } else {
        const start = edge.start * ROW, end = edge.end * ROW;
        const direction = Math.sign(to - from), radius = 5;
        path.move_to(from, start);
        if (edge.start === 0.5) {
          path.line_to(to - direction * radius, start)
            .curve_to(to, start + radius, to, start).line_to(to, end);
        } else {
          path.line_to(from, end - radius)
            .curve_to(from + direction * radius, end, from, end).line_to(to, end);
        }
      }
      graph.child(window.paint_path(path.build(), colors[edge.color % colors.length]).absolute().inset_0().size_full());
    }
    if (!continuation) {
      const head = row.commit.hash === this.head, radius = head ? 5.5 : 4;
      const halo = radius + 2.5;
      graph.child(div().absolute().left(x(row.lane) - halo).top(ROW / 2 - halo)
        .w(halo * 2).h(halo * 2).rounded_full().bg(t.background));
      graph.child(div().absolute().left(x(row.lane) - radius).top(ROW / 2 - radius)
        .w(radius * 2).h(radius * 2).rounded_full()
        .bg(head ? t.background : colors[row.color % colors.length])
        .when(head, e => e.border(2).border_color(colors[row.color % colors.length])));
    }
    return graph;
  }

  expand(commit, cx) {
    this.open = this.open === commit.hash ? null : commit.hash;
    if (this.open && !this.fileCache.has(commit.hash)) {
      const target = location(), cache = this.fileCache;
      const entry = { loading: true, files: [], error: "" };
      cache.set(commit.hash, entry);
      cx.spawn(async cx => {
        try {
          entry.files = await readFiles(args => exec("git", [...READ, ...args], { cwd: target.cwd, on: target.on }), commit);
        } catch { entry.error = "無法載入檔案清單，請確認儲存庫與連線後再試。"; }
        finally { entry.loading = false; if (this.fileCache === cache) cx.notify(); }
      });
    }
    cx.notify();
  }

  details(commit, t) {
    const entry = this.fileCache.get(commit.hash);
    const colors = palette(), statusColors = { M: colors[1], A: colors[3], D: settings().dark ? "#ff626c" : "#c52636", R: colors[0] };
    const names = { M: "修改", A: "新增", D: "刪除", R: "重新命名" };
    const list = v_flex().flex_1().min_w(0).py(3).pr(8).text_size(12);
    if (!entry || entry.loading) return list.child(div().py(6).text_color(t.muted).child("載入檔案中…"));
    if (entry.error) return list.child(div().py(6).whitespace_normal().text_color(t.muted).child(entry.error));
    if (!entry.files.length) return list.child(div().py(6).text_color(t.muted).child("此提交沒有檔案變更"));
    for (const file of entry.files.slice(0, 300)) {
      const slash = file.path.lastIndexOf("/"), name = file.path.slice(slash + 1), folder = slash < 0 ? "" : file.path.slice(0, slash);
      const ext = name.split(".").pop().toLowerCase();
      const iconColor = /^(png|jpg|svg|gif|webp)$/.test(ext) ? colors[4] : ext === "py" ? colors[0] : ext === "ps1" ? colors[6] : t.muted;
      const tab = focused()?.tab, selection = shared(selectionKey(tab));
      const selected = panes().some(p => p.tab === tab && p.mod === "git-diff") && selection?.hash === commit.hash && selection?.path === file.path && selection?.cwd === location().cwd;
      list.child(h_flex().id(`file-${commit.hash}-${file.path}`).h(23).flex_none().gap(6).items_center().rounded(3).cursor_pointer()
        .when(selected, el => el.bg(t.selected))
        .on_click(() => {
          const f = focused(), target = location(), existing = panes().find(p => p.tab === f.tab && p.mod === "git-diff");
          const item = {tab:f.tab,cwd:target.cwd,on:target.on,hash:commit.hash,parent:commit.parents[0] ?? "",path:file.path,oldPath:file.oldPath ?? "",status:file.status,subject:commit.subject};
          setShared(selectionKey(f.tab),item);
          if (existing) run("pane.focus",{pane:existing.pane});
          else run("pane.split",{direction:"right",mod:"git-diff",props:item});
        })
        .hover(s => s.bg(t.hover)).tooltip(`${names[file.status] ?? file.status}：${file.oldPath ? file.oldPath + " → " : ""}${file.path}`)
        .child(svg("mods/files/file.svg").size(12).flex_none().text_color(iconColor))
        .child(div().min_w(0).truncate().child(file.oldPath ? `${file.oldPath} → ${file.path}` : name))
        .when(Boolean(folder) && !file.oldPath, el => el.child(div().min_w(0).truncate().text_size(10).text_color(t.muted).child(folder)))
        .child(div().flex_1())
        .child(div().flex_none().text_size(11).text_color(statusColors[file.status] ?? t.muted).child(file.status)));
    }
    if (entry.files.length > 300) list.child(div().py(5).text_color(t.muted).child(`另有 ${entry.files.length - 300} 個檔案未列出`));
    return list;
  }

  render(cx) {
    if (location().key !== this.context) this.refresh(cx);
    const t = theme(), width = Math.max(24, ...this.rows.map(row => row.width * STEP + 8));
    return v_flex().id("git-graph").size_full().min_h(0).rounded(10).overflow_hidden()
      .on_size_change((size, cx) => { if (this.panelWidth !== size.width) { this.panelWidth = size.width; cx.notify(); } })
      .bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(svg("mods/git-graph/git-graph.svg").w(16).h(16).text_color(t.muted))
        .child(div().font_semibold().child("圖表"))
        .child(div().text_size(10).text_color(t.muted).child(`${this.rows.length} 筆提交`))
        .child(div().flex_1())
        .child(div().id("graph-refresh").px(6).py(4).rounded(4).cursor_pointer()
          .hover(s => s.bg(t.hover)).tooltip("重新整理提交歷史")
          .on_click((_event, cx) => this.refresh(cx, true))
          .child(this.loading ? "載入中…" : "重新整理")))
      .child(div().flex_1().min_h(0).relative()
        .child(v_flex().id("graph-list").absolute().inset_0().overflow_scroll().py(6)
          .children(this.rows.map(row => {
            const c = row.commit, expanded = this.open === c.hash;
            const allBadges = badges(c.refs), shownBadges = [];
            const budget = Math.max(80, (this.panelWidth ?? 368) - width - 160);
            let used = 0;
            for (const badge of allBadges) {
              const next = badgeWidth(badge) + 3;
              if (shownBadges.length && used + next + 32 > budget) break;
              shownBadges.push(badge); used += next;
            }
            const remaining = allBadges.length - shownBadges.length;
            return v_flex().w_full().min_w(width + 160 + used + (remaining ? 32 : 0)).flex_none()
              .child(h_flex().id(`commit-${c.hash}`).w_full().h(ROW).flex_none().items_center().pr(8)
                .cursor_pointer().when(expanded, e => e.bg(t.selected)).hover(s => s.bg(t.hover))
                .tooltip(`完整雜湊值：${c.hash}\n作者：${c.author}\n日期：${c.date.replace("T", " ")}\n分支／標籤：${c.refs.filter(ref => !ref.name.endsWith("/HEAD")).map(ref => ref.name).join("、") || "無"}\n\n${c.message}`)
                .on_click((_event, cx) => this.expand(c, cx))
                .child(this.graph(row, width, t))
                .child(div().flex_1().min_w(140).truncate().when(c.hash === this.head, e => e.font_semibold())
                  .child(c.subject || "（無提交訊息）"))
                .child(h_flex().flex_none().gap(3).ml(6)
                  .children(shownBadges.map(ref => div().flex_none().whitespace_nowrap().px(5).py(1).rounded(7).border_1()
                    .bg(`${refColor(ref, t)}22`).border_color(refColor(ref, t)).text_color(refColor(ref, t))
                    .text_size(10).tooltip(ref.tooltip)
                    .child(ref.label)))
                  .when(remaining > 0, el => el.child(div().flex_none().px(5).py(1).rounded(7)
                    .bg(t.raised).text_color(t.muted).text_size(10).whitespace_nowrap()
                    .tooltip(allBadges.map(ref => ref.tooltip).join("\n")).child(`+${remaining}`)))))
              .when(expanded, e => e.child(h_flex().w_full().items_stretch().bg(t.raised)
                .child(this.graph(row, width, t, true)).child(this.details(c, t))));
          }))
          .when(!this.rows.length, e => e.child(div().p(14).whitespace_normal().text_color(t.muted)
            .child(this.error || (this.loading ? "正在載入提交歷史…" : "此儲存庫尚無提交")))))
        .child(Scrollbar.vertical("graph-list").absolute().inset_0())
        .child(Scrollbar.horizontal("graph-list").absolute().inset_0()))
      .when(this.rows.length === LIMIT, e => e.child(div().px(12).py(5).text_size(10).text_color(t.dim)
        .child(`僅顯示最近 ${LIMIT} 筆提交；底部線段可能延伸至更早的歷史`)));
  }
}
