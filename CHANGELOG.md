# Claude Code 狀態列修改紀錄

## 2026-11-10 — 新增 Herdr「圖表」面板（git 提交歷史圖）

- 由 Codex 撰寫、Claude 審查驗證；備份於 `herdr/`。
- 右側面板新增「圖表」按鈕：車道線（節點留白、圓角轉彎）、分支徽章合併（`main ↑↓`）、點選提交列出修改檔案。
- 只動自訂檔案（`mods/git-graph`、`mods/my-tabs`、`layouts/my-main.json`），官方版面與 mod 未修改。
- 驗證：`herdr-app check` 通過；`files.test.mjs` 對 `d0b732a` 正確列出 7 個檔案；實機截圖確認展開排版。

## 2026-11-10 — 修復 Codex 沙箱無法啟動 PowerShell（商店版 PS7）

- 現象：Codex `unelevated` 沙箱啟動商店版 `pwsh.exe` 失敗，`CreateProcessAsUserW failed: 5`。
- 處理：改裝官方 MSI 版 PS7.6.9、Machine PATH 置頂，完整重啟 Codex（舊 app-server 會沿用舊 shell 路徑）。
- VS Code 三個終端 profile 由 `source` 改為明確 `path`，統一使用 MSI 版。
- 已驗證沙箱日誌顯示 MSI 版 `SUCCESS`。細節見 `POWERSHELL_SANDBOX_DIAGNOSTIC.md`。
- 不再使用 psmux：已解除安裝（winget）、刪除 `~/.tmux.conf`、移除 VS Code 的 `PowerShell (psmux)` profile。下方 2026-06-15 的 psmux 紀錄僅作歷史保留。

## 2026-06-15 — 修復 psmux 終端中文「複製出去」亂碼

### 問題

在 psmux 終端（VS Code 內，流程 `powershell → psmux → claude`）用滑鼠拖曳複製中文，
**貼到其他地方變亂碼**（UTF-8 位元組被當 Big5 解讀，如 `設定`→`è¨­å®š`）。
方向性：**從 psmux 複製出去 = 壞；從外面貼進 Claude Code = 正常**。

### 排查與根因

- 不經 psmux 的純 PowerShell 複製貼上 → **正常**（排除系統層級單純問題）。
- 按住 **Shift 拖曳**（繞過 psmux、走終端原生選取）複製 → **正常** → 鎖定是 **psmux 的剪貼簿寫入**。
- 根因：psmux 滑鼠複製時**把文字寫成 `CF_TEXT`（ANSI 位元組流，內含 UTF-8 bytes）而非 `CF_UNICODETEXT`**。
  系統 ACP=950(Big5) 解這串 UTF-8 bytes → 亂碼。終端原生複製寫的是 `CF_UNICODETEXT`，故不受影響。
- 與 pane shell 無關：已把 psmux pane 換成 PowerShell 7.6.2（見下）仍不影響此 copy 問題。

### 處理（最終決定：mouse on + 複製按 Shift）

1. **裝 PowerShell 7.6.2**（winget user scope，`...\WindowsApps\pwsh.exe`，與 5.1 並存）——psmux 官方建議 PS7。
2. **`C:\Users\charles\.tmux.conf`** 最終內容：
   ```tmux
   set -g default-shell "C:/Users/charles/AppData/Local/Microsoft/WindowsApps/pwsh.exe"
   set -g mouse on
   # 複製中文時按住 Shift 再拖曳（繞過 psmux、走終端原生選取，寫 Unicode）
   ```
   - `default-shell pwsh`：pane 改用 PS7（UTF-8）。
   - **`mouse on`**：保留 psmux 滑鼠功能（滾輪捲動、點選/拖動窗格）。
   - **日常操作守則**：滾動/窗格用滑鼠正常用；**唯獨「複製中文」要按住 Shift 拖曳**，否則走 psmux 的
     Windows ANSI 剪貼簿會亂碼。
3. 生效：`psmux source-file ~/.tmux.conf`（或重開終端機）。

### 決策過程中排除的方案

- **`mouse off`**（曾短暫採用）：免按 Shift 但失去全部滑鼠功能 → 使用者想保留滑鼠，故放棄。
- **`set -g set-clipboard on`（OSC52）**：實測**無效**。VS Code 本機終端 2024-06 起已內建支援 OSC52 寫入
  （預設開、僅 Remote SSH 忽略），故 VS Code 端沒問題；但 **psmux 的滑鼠複製寫死走 Windows 剪貼簿(`-w`)，
  不會因 set-clipboard on 改用 OSC52**（OSC52 只轉發 pane 內 app 自己發的）。已是最新版 v3.3.6，無更新版可修。
- **開全域 Beta UTF-8（ACP 950→65001）**：可讓滑鼠複製完全正常且免 Shift，但掃描已安裝軟體後評估**風險過高**：
  使用者有 **大昌e指發（券商下單）、HiCOS 健保卡/憑證元件、ZWCAD 2021、百度网盘/淘宝/阿里旺旺（簡中 GBK）、
  Unicode-At-on(BIG5)、Ruby 1.8.6** 等 Big5/GBK 老程式，開 UTF-8 後高機率亂碼。雖可逆，但券商+健保卡剛好
  最會出事又最重要，故不採用。

## 2026-06-15 — context bar 加上「CTX」標籤

第 2 行的 context bar 百分比前面加 `CTX ` 標示為上下文使用率（`cship.toml`）：

```toml
[cship.context_bar]
symbol  = "CTX "
format  = "[$symbol$value]($style)"
```

⚠️ **坑：只設 `symbol` 不會顯示**——cship 的 `[cship.context_bar]` 預設 `format` 沒引用 `$symbol`，
必須同時設 `format = "[$symbol$value]($style)"`（`$value` = 視覺 bar + 百分比合一）才會帶出標籤。
驗證：`cship explain` 顯示 `cship.context_bar  CTX ░░░░░░░░░░ 6%`。

## 2026-06-15 — 修復 cship「少一行」：starship passthrough 失效

### 問題

cship statusline 在 Claude Code 內只顯示**第 2 行**（cship 原生模組：model/cost/context bar/usage），
**第 1 行（目錄/git 分支/版本）完全消失**。

### 根本原因

第 1 行原本是 `$directory$git_branch$git_status$python$nodejs$rust`，這些**全是 starship passthrough token**
（cship 不原生支援，必須呼叫 `starship` binary 渲染）。實測 `which starship` → `command not found`：
- starship 1.25.1 **有裝**（winget），binary 在
  `C:\Users\charles\AppData\Local\Microsoft\WinGet\Packages\Starship.Starship_..._8wekyb3d8bbwe\starship.exe`
- 且該目錄**早已在 user PATH 的登錄檔**裡
- 但 **Claude Code 這個 process 是在 starship 加進 PATH 之前啟動的**，繼承了舊環境變數 → 它生出的 cship 子程序找不到 starship → 第 1 行渲染成空字串 → 整行消失。
- 環境變數變更不會套用到已執行的程序，故「PATH 設了卻沒生效」。

### 修復

1. **第 1 行改用 `$starship_prompt`**（`cship.toml`）——官方推薦寫法，一次帶過完整 starship prompt。
2. **重啟 Claude Code（與終端機）**——讓它重新繼承含 starship 的 PATH。PATH 本身不需再改（已在登錄檔）。

修復後輸出：
```
openclaw on  main                  ← 第 1 行（$starship_prompt：目錄 + git 分支）
🤖 Opus 4.8  💰 $0.42  ░░░░░░░░░░ 0%  ← 第 2 行
```

### 注意（demo 的 v1.94.0 / 21:21 為何在 openclaw 不出現，非 bug）

- **版本號 v1.94.0** = starship `package` 模組，讀 `Cargo.toml`/`package.json`/`pyproject.toml` 版本。
  openclaw 無任何 manifest → 不顯示；在 node/rust 專案會自動出現。demo 的 cship 是 Rust 專案才有。
  ⚠️ **釐清：第 1 行的 `v1.94.0` 是「專案套件版本」，不是 Claude Code 版本。** demo 第二張圖的
  `Claude Code v2.1.139` 是 Claude Code 對話標頭自己畫的（非 statusline）。cship 所有原生 token
  （`cship explain` + README 確認）**沒有任何「Claude Code 版本」模組**，第 1 行本來就無法顯示 CC 版本。
- **時間 21:21** = starship `time` 模組，**預設關閉**，需建 `starship.toml` 設 `[time] disabled=false` 才有
  （會同時影響終端機 shell prompt）。本次**決定不開**，保持現狀。

## 2026-06-15 — 改用 cship 並記錄手動測試方式

### 變更

狀態列從自製 `context-bar.py` 換成 **cship**（github.com/stephenleo/cship，Rust statusline 渲染器）。
- binary：`C:\Users\charles\.local\bin\cship.exe`
- 設定檔：`C:\Users\charles\.config\cship.toml`（`lines` 定義兩行）
- `~/.claude/settings.json` 的 `statusLine.command` 指向 cship.exe
- 第 1 行為 starship passthrough（目錄/git/runtime），第 2 行為 cship 原生模組（model/cost/context bar/5h+7d 用量）

### 手動測試 cship 輸出（重點：UTF-8 繞法）

在 Claude Code 外手動驗證 cship 兩行輸出，**必須用純 UTF-8 pipeline**，不能用 PowerShell：

- PowerShell 5.1 pipeline 會把字串以 **UTF-16（含 BOM）** 送進 stdin，cship 用 Rust 讀 stdin 會報
  `failed to parse Claude Code session JSON: expected value at line 1 column 1`（null byte 害的）。
- 正確測法（用 Git Bash / Bash tool）：

  ```bash
  echo '{"hook_event_name":"Status","model":{"id":"claude-opus-4-8","display_name":"Opus 4.8"},"workspace":{"current_dir":"D:/openclaw","project_dir":"D:/openclaw"},"cost":{"total_cost_usd":0.42,"total_duration_ms":120000},"context":{"used_tokens":35000,"max_tokens":200000}}' | "C:/Users/charles/.local/bin/cship.exe"
  ```

- 預期輸出（範例）：`🤖 Opus 4.8  💰 $0.42  ░░░░░░░░░░ 0%`
- 純管線測試下**第 1 行（starship passthrough）不會渲染**（缺 git/目錄上下文），context_bar / usage_limits 數值也要餵對應欄位才顯示，**皆屬正常，非 bug**。
- 此 UTF-16 編碼坑與舊 `context-bar.py` 的假性 `?` 同源（見下方 2026-06-10 條目）。

## 2026-06-10 — 修正 Fable 5 模型顯示為「?」

### 問題

切換到最新模型 **Fable 5** 後,狀態列的模型名稱顯示為 `?`。

### 原因

狀態列腳本 `C:\Users\charles\.claude\scripts\context-bar.py` 中的 `get_short_model()` 只比對 `opus`、`sonnet`、`haiku` 等關鍵字,新模型 ID `claude-fable-5` 全部比對不到,落入最後的 fallback 回傳 `'?'`。

### 修改內容

1. **新增 Fable 判斷**:model ID 含 `fable` 時顯示 `Fable5`。
2. **新增 Opus 4.8 判斷**:model ID 含 `opus` 且版本為 `4.8` / `4-8` 時顯示 `Opus4.8`。
3. **改善 fallback**:`get_short_model()` 新增 `display_name` 參數;遇到不認識的模型時,改用 Claude Code 傳入的 `display_name`(去除空格)顯示,而非 `?`。未來推出新模型不需再修改腳本。

### 修改檔案

- `C:\Users\charles\.claude\scripts\context-bar.py`
  - `get_short_model()`:新增 `fable`、`opus 4.8` 判斷與 `display_name` fallback。
  - `main()`:讀取 `model.display_name` 並傳入 `get_short_model()`。

### 驗證

以模擬的 Claude Code stdin JSON 測試:

```
{"model":{"id":"claude-fable-5[1m]","display_name":"Fable 5"}, ...}
```

輸出正確顯示:

```
Fable5 │ claude_statusline │ Ctx ▓░░░░░░░ 1% 10k/1000k │ 5h ... │ 7d ...
```

> 注意:在 PowerShell 用 `Get-Content | python` 管線測試會因編碼問題出現假性 `?`,
> 需改用 `cmd /c "python script.py < file.json"` 重導向測試。
> Claude Code 本身直接餵 stdin,不受此影響。
