# Claude Code StatusLine 設定備份

Claude Code 狀態列的個人設定備份與新電腦安裝步驟。

> **目前使用版本：[cship](https://github.com/stephenleo/cship)**（Rust 編譯、相容 Starship 設定格式）。
> 本 repo 早期的 Python 版工具（`context-bar.py`）已於 2026-06-15 停用，檔案保留在原處僅供參考，見文末「舊版（已停用）」。
> 從舊版到 cship 的完整變更與排查過程見 [CHANGELOG.md](./CHANGELOG.md)。

## 預覽

第一行由 Starship 渲染（目錄、Git 分支、Node 版本），第二行是 cship 原生模組（模型、費用、Context 用量進度條、5h/7d API 用量）。

## 架構

```
Claude Code
  └─ settings.json: statusLine.command → cship.exe
       ├─ 第 1 行: $starship_prompt（呼叫外部 starship binary，顯示目錄 / git 分支等）
       └─ 第 2 行: cship 原生模組
            ├─ $cship.model         模型名稱（🤖 Sonnet 5）
            ├─ $cship.cost          本次 session 花費（💰 $0.00）
            ├─ $cship.context_bar   context 使用率條（CTX ░░░░░░░░░░ 0%）
            └─ $cship.usage_limits  5h / 7d 額度用量（⏰ 5h 17% (2h11m) 📅 7d 4% (2d5h)）
```

## 檔案

| 檔案 | 對應實際路徑 | 說明 |
|---|---|---|
| `cship.toml` | `C:\Users\<user>\.config\cship.toml` | cship 主設定：模組樣式、警戒閾值、格式字串 |
| `settings.snippet.json` | `~/.claude/settings.json` 的 `statusLine` 區塊 | 指定 Claude Code 呼叫 cship.exe |
| `CHANGELOG.md` | — | 從舊版 context-bar.py 到 cship 的完整變更與排查紀錄 |
| `POWERSHELL_SANDBOX_DIAGNOSTIC.md` | — | Codex 沙箱無法啟動商店版 PowerShell 7 的排查與修復 |
| `herdr/` | `C:\Users\<user>\.config\herdr-app\` | Herdr app 的自訂「圖表」面板（git 提交歷史圖），見下方「Herdr 圖表面板」 |
| `claude/skills/codex/SKILL.md` | `~/.claude/skills/codex/SKILL.md` | `/codex` skill：在 Herdr 中把工作交給 Codex，見下方「/codex skill」 |

## /codex skill（選用）

在 Claude Code 輸入 `/codex`（或 `/codex <任務>`），Claude 會在**同一個 Herdr tab 的右側 pane** 開啟或沿用 Codex，寫需求書交給 Codex 實作，背景等待後由 Claude 自行驗證（看 diff、跑測試、查 Codex 實際執行的指令），使用者說要提交才提交。整個過程可在 Codex pane 即時看到，也能直接在該 pane 對 Codex 插話。

- 設定 `disable-model-invocation: true`：只有輸入 `/codex` 才載入，平常不佔上下文。
- 需在 Herdr 終端機內執行 Claude Code；不在 Herdr 時改用背景 `codex exec`（看不到即時過程）。
- 安裝：`Copy-Item -Recurse claude\skills\codex "$env:USERPROFILE\.claude\skills\"`，之後新開的 Claude Code 對話即可使用。

## Herdr 圖表面板（選用）

在 [Herdr](https://herdr.dev) 標籤列把 Changes 換成一顆「Git」按鈕（與 Files 並列）：右側面板上方 Changes、下方「圖表」，中間分隔線可拖曳，仿 VS Code 原始碼控制畫面。圖表功能：

- 分支車道線、節點留白、圓角轉彎；HEAD 為空心圓。
- 分支徽章：同步的本地／遠端分支合併成 `main ↑↓`，隱藏 `origin/HEAD`，放不下時收合為 `+N`。
- 點選提交展開修改的檔案（`M`／`A`／`D`／`R` 上色），合併提交與第一父提交比較。
- 點選檔案在終端機右側開 diff pane（雙欄行號、紅綠底色、長行自動換行）；點其他檔案沿用同一個 pane，關掉後終端機恢復全寬。
- 滑鼠停留顯示高對比提示卡（深藍底、亮藍邊框、白字），取代 Herdr 內建對比過低的 tooltip。
- 只執行唯讀 git 指令；每 5 秒檢查一次，有變化才重新載入。

另外 Files 面板新增「插入到對話」：對檔案按右鍵選「插入到對話」或 Alt＋點擊，就在目前分頁的 AI agent（Claude Code、Codex）輸入框插入 `@相對路徑 `，不會自動送出。Herdr 的 mod 介面不支援拖曳來源，因此以此取代 VS Code 的拖曳檔案；借用剪貼簿貼上，約 300ms 後還原原本的文字剪貼簿。

Spaces 側欄的「+」改為先彈出選單（仿 VS Code 開啟資料夾）：最近的資料夾（最多 8 筆，來自 Herdr 的 recent 與目前各 space）、「開啟資料夾…」（Windows 選擇資料夾視窗）、「從家目錄開始」。新 space 的終端機直接從選定資料夾開始。快捷鍵 `ctrl-shift-n` 與 `keys.json` 維持原樣；其他機器的 space 不提供本機資料夾選擇視窗。

| 備份檔案 | 說明 |
|---|---|
| `herdr/mods/git-graph/` | 圖表面板本體（`main.js` 畫面、`lanes.js` 車道配置、`data.js` git 讀取、`tips.js` 提示卡、`files.test.mjs`／`tips.test.mjs` 測試） |
| `herdr/mods/git-diff/` | diff pane（`main.js` 畫面、`diff.js` 讀取與解析、`diff.test.mjs` 測試） |
| `herdr/mods/my-tabs/` | 官方 `tabs` 的複本：Changes 按鈕換成「Git」（開啟 Changes＋圖表上下並排） |
| `herdr/mods/my-pane/` | 官方 `pane`（pane 標題列）的複本：git-diff pane 標題顯示「差異 · 檔名」，其他 pane 不變 |
| `herdr/mods/my-files/` | 官方 `files` 的複本：右鍵／Alt＋點擊「插入到對話」（`mention.js` 路徑格式、`mention.test.mjs` 測試）；依檔案類型顯示彩色圖示（`icons/` 14 個自繪 SVG、`icons.js` 對應規則、`icons.test.mjs` 測試） |
| `herdr/mods/my-spaces/` | 官方 `spaces`（左側側欄）的複本：「+」先開選單選資料夾（`recent.js` 最近資料夾整理、`recent.test.mjs` 測試） |
| `herdr/layouts/my-main.json` | 官方 `main` 版面的複本：右側面板的 Changes 與 `git-graph` 包成上下並排的 `git` 區塊、標籤列改用 `my-tabs`、pane 標題列改用 `my-pane`、Files 改用 `my-files`、Spaces 側欄改用 `my-spaces` |

安裝（Herdr 執行中即可，存檔即生效）：

```powershell
$h = "$env:USERPROFILE\.config\herdr-app"
Copy-Item -Recurse herdr\mods\git-graph, herdr\mods\git-diff, herdr\mods\my-tabs, herdr\mods\my-pane, herdr\mods\my-files, herdr\mods\my-spaces "$h\mods\"
Copy-Item herdr\layouts\my-main.json "$h\layouts\"
herdr-app check "$h\mods\git-graph"
herdr-app check "$h\mods\git-diff"
herdr-app check "$h\mods\my-tabs"
herdr-app check "$h\mods\my-pane"
herdr-app check "$h\mods\my-files"
herdr-app check "$h\mods\my-spaces"
herdr-app do layout.switch --name my-main
```

- 官方版面與 mod 不會被修改；Herdr 更新後若官方 `main`／`tabs`／`pane`／`files`／`spaces` 有新功能，需重新 `layout.clone`／`mod.clone` 再套用上述改動。
- 切回原版：`ctrl-shift-l`；移除：刪掉上表七項。
- 測試：`node herdr\mods\git-graph\files.test.mjs <repo 路徑>`、`node herdr\mods\git-diff\diff.test.mjs`、`node herdr\mods\my-files\mention.test.mjs`、`node herdr\mods\my-files\icons.test.mjs`、`node herdr\mods\my-spaces\recent.test.mjs`、`node herdr\mods\git-graph\tips.test.mjs`

### Herdr 更新後的檢查

```powershell
.\herdr\check-herdr.ps1                  # 一般檢查
.\herdr\check-herdr.ps1 -UpdateBaseline  # 重新 clone 並套用改動後，更新官方基準
```

檢查 Herdr 狀態、六個自訂 mod 的 `herdr-app check`、`my-main.json` 與 `*.error`、六組 Node 測試（圖表、diff、插入到對話、檔案圖示、最近資料夾、圖表提示卡）（❌ 時 exit 1，可按 `ctrl-shift-l` 切回官方版面暫時恢復）；並以 `herdr/official-baseline.json`（只存官方檔案雜湊）偵測官方 `main`／`tabs`／`pane`／`files`／`spaces` 是否更新、Herdr 與 repo 備份是否一致（⚠️ 僅提醒）。

## 新電腦安裝步驟（Windows）

### 1. 安裝 Nerd Font 字型（狀態列圖示需要）

```powershell
winget install DEVCOM.JetBrainsMonoNerdFont
```

安裝後在 Windows Terminal 設定中選用該字型。

### 2. 安裝 Starship（渲染第一行）

```powershell
winget install Starship.Starship
```

Starship 使用預設設定即可，不需要 `starship.toml`。

### 3. 安裝 cship

官方 install script 目前**不支援 Windows**（`uname -s` 偵測到 `MINGW64_NT-*` 會直接印出 `Unsupported OS` 並中止，沒有 Windows 分支）。在 macOS / Linux 上可直接：

```bash
curl -fsSL https://cship.dev/install.sh | bash
```

**Windows 需手動安裝**（在 Git Bash 中執行）：

```bash
# 1. 確認 CPU 架構（一般桌機/筆電是 x86_64 → x86_64-pc-windows-msvc；ARM 裝置用 aarch64-pc-windows-msvc）
mkdir -p ~/.local/bin
curl -fsSL "https://github.com/stephenleo/cship/releases/latest/download/cship-x86_64-pc-windows-msvc.exe" -o ~/.local/bin/cship.exe
~/.local/bin/cship.exe --version   # 確認可執行
```

確認 `%USERPROFILE%\.local\bin` 已加入 PATH（新裝的 Windows 通常需要手動加，Windows 上的 PATH 不會被安裝流程自動寫入）。

安裝腳本（含手動安裝）都不會建立設定檔或改 `settings.json`（若 `statusLine` 已存在會直接跳過，不會覆蓋），這兩步在 Windows 上一律要手動做，見步驟 4、5。

### 4. 套用本 repo 的自訂設定檔

把本 repo 的 [`cship.toml`](./cship.toml) 複製到 `C:\Users\<使用者>\.config\cship.toml`（覆蓋安裝腳本產生的起始設定）。

此設定包含：
- 第一行：`$starship_prompt` 完整 Starship passthrough
- 第二行：模型（🤖）、費用（💰，$2 黃色警戒／$5 紅色）、CTX 進度條（40% 黃色／70% 紅色）、5h／7d API 用量（60% 黃色／80% 紅色）

### 5. 寫入 `~/.claude/settings.json`

在 `settings.json` 加入（或更新既有的）`statusLine` 欄位，可直接參考 [`settings.snippet.json`](./settings.snippet.json)（將路徑中的 `<YOUR_USERNAME>` 換成實際帳號）：

```json
"statusLine": {
  "type": "command",
  "command": "cship.exe"
}
```

前提是 `~/.local/bin` 已在 PATH 中（見步驟 3）；若不確定，可改用絕對路徑 `C:/Users/<使用者>/.local/bin/cship.exe`。

### 6. 重新開啟 Claude Code / 終端機

**必須整個重開終端機（不是只重開 Claude Code）**，新的程序才會繼承到含 `~/.local/bin` 的 PATH。只重開 Claude Code、沒關終端機的話，狀態列仍會沿用舊設定或找不到指令。

## 常用指令

```powershell
cship --version    # 版本
cship explain      # 顯示每個模組目前的渲染值與設定來源（調整樣式時好用）
cship uninstall    # 移除執行檔並清掉 settings.json 設定
```

## 已知坑（詳見 CHANGELOG）

- `[cship.context_bar]` 只設 `symbol` 不會顯示，必須同時設 `format = "[$symbol$value]($style)"`。
- 手動用 stdin 測試 cship 輸出時，**不能用 PowerShell pipeline**（UTF-16 編碼會讓 cship 的 Rust JSON parser 直接失敗），要用 Git Bash 送純 UTF-8。
- 若 starship 是後裝的，Claude Code 進程需要重新繼承含 starship 的 PATH，否則第 1 行會空白消失（見 CHANGELOG「starship passthrough 失效」條目）。
- Windows 請使用 MSI 版 PowerShell 7，不要用商店版（MSIX），否則 Codex 沙箱會出現 `CreateProcessAsUserW failed: 5`（見 `POWERSHELL_SANDBOX_DIAGNOSTIC.md`）。

## 舊版（已停用）

`context-bar.py`、`update-usage-cache.py`、`install.ps1` 為早期針對 Windows 修正編碼與錯誤處理的 Python 版狀態列工具（v1.0.1），已由 cship 取代，保留僅供參考。

## License

本專案採用 [MIT License](LICENSE) 授權，歡迎自由使用、修改與散布。
