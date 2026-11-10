import { View, div } from "gpui-kit";
import { v_flex, h_flex, Scrollbar } from "gpui-base";
import { props, shared, setShared, focused, theme, settings, exec, nextCommand } from "herdr";
import { READ, readDiff, selectionKey } from "./diff.js";

export default class GitDiff extends View {
  init(_props, cx) {
    this.tab = props()?.tab ?? focused()?.tab;
    this.key = selectionKey(this.tab); this.serial = 0;
    this.result = {rows:[]}; this.error = "";
    if (props()?.hash) setShared(this.key, {...props(),tab:this.tab});
    this.load(cx);
    cx.spawn(async cx => { for (;;) {
      const command = await nextCommand();
      if (!command.startsWith("show:")) continue;
      try { const item = JSON.parse(command.slice(5)); if (item.tab === this.tab) setShared(this.key,item); }
      catch { this.error = "無法解析提交資訊"; cx.notify(); }
    } });
  }
  load(cx) {
    const item = shared(this.key) ?? props() ?? {}, signature = JSON.stringify(item);
    if (signature === this.signature) return;
    this.signature = signature; this.item = item; const token = ++this.serial;
    this.result = {rows:[]}; this.error = ""; this.loading = Boolean(item.hash);
    if (!item.hash) return;
    cx.spawn(async cx => {
      try {
        const result = await readDiff(args => exec("git",[...READ,...args],{cwd:item.cwd,on:item.on ?? null}),item);
        if (token === this.serial) this.result = result;
      } catch { if (token === this.serial) this.error = "無法載入 diff，請確認儲存庫、提交與機器連線後重新選擇檔案。"; }
      finally { if (token === this.serial) { this.loading = false; cx.notify(); } }
    });
  }
  render(cx) {
    this.load(cx);
    const t = theme(), item = this.item ?? {}, dark = settings().dark;
    const labels = {M:"修改",A:"新增",D:"刪除",R:"重新命名",C:"複製"};
    const message = this.loading ? "載入 diff 中…" : this.error || (this.result.binary ? "二進位檔案已變更，無法逐行比較" : !item.hash ? "請從圖表選擇檔案" : !this.result.rows.length ? "此檔案沒有文字差異" : "");
    return v_flex().size_full().min_w(0).min_h(0).bg(t.background).text_color(t.foreground)
      .child(v_flex().flex_none().p(12).gap(5).border_b(1).border_color(t.border)
        .child(div().font_semibold().whitespace_normal().child(item.oldPath ? `${item.oldPath} → ${item.path}` : item.path ?? "提交差異"))
        .child(div().text_size(11).text_color(t.muted).whitespace_normal().child(`${labels[item.status] ?? item.status ?? ""}  ${(item.hash ?? "").slice(0,7)}  ${item.subject ?? ""}`))
        .child(div().text_size(11).text_color(t.muted).child(item.parent ? "與第一個父提交比較" : "根提交")))
      .child(div().flex_1().min_h(0).relative()
        .child(v_flex().id("git-diff-lines").absolute().inset_0().overflow_y_scroll().font_family(settings().font_family ?? "JetBrains Mono").text_size(12).line_height("21px")
          .when(Boolean(message), el => el.child(div().p(14).whitespace_normal().text_color(t.muted).child(message)))
          .when(!message, el => el.children(this.result.rows.map((row,i) => h_flex().id(`diff-line-${i}`).w_full().min_w(0).min_h(21).flex_none().items_start()
            .bg(row.kind === "add" ? (dark ? "#248a4938" : "#30a35024") : row.kind === "delete" ? (dark ? "#d6424b38" : "#db354224") : t.background)
            .child(div().w(44).flex_none().text_color(dark ? t.dim : "#626975").child(row.old === undefined ? "" : String(row.old)))
            .child(div().w(44).flex_none().text_color(dark ? t.dim : "#626975").child(row.new === undefined ? "" : String(row.new)))
            .child(div().w(16).flex_none().text_color(t.foreground).child(row.kind === "add" ? "+" : row.kind === "delete" ? "−" : ""))
            .child(div().flex_1().min_w(0).pr(10).whitespace_normal().text_color(["hunk","meta","note"].includes(row.kind) ? t.muted : t.foreground).child(row.text.replace(/\t/g,"    ")))))))
        .child(Scrollbar.vertical("git-diff-lines").absolute().inset_0()))
      .when(this.result.limited, el => el.child(div().p(8).text_size(11).text_color(t.muted).child("diff 過長，只顯示前 5000 行")));
  }
}
