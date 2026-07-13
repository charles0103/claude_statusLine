# claude_statusline

Claude Code 狀態列設定，目前採用 [cship](https://cship.dev)（Rust 寫的 statusline 渲染器）+ [starship](https://starship.rs) 組合。

> **取代說明**：GitHub 上舊版 repo 是自製的 `context-bar.py`（Python 腳本）。該腳本已於
> 2026-06-15 停用，改用 cship，本 repo 為目前實際生效的設定。細節與排查過程見 [CHANGELOG.md](./CHANGELOG.md)。

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

## 安裝

1. 安裝 cship（binary 放到 `~/.local/bin/cship.exe`）與 starship（`winget install Starship.Starship`）。
2. 將 `cship.toml` 複製到 `~/.config/cship.toml`。
3. 在 `~/.claude/settings.json` 加入 `settings.snippet.json` 中的 `statusLine` 區塊（將路徑中的
   `<YOUR_USERNAME>` 換成實際帳號）。
4. **重啟 Claude Code 與終端機**——若 starship 是後裝的，Claude Code 進程需要重新繼承含 starship 的 PATH，
   否則第 1 行會空白消失（詳見 CHANGELOG「starship passthrough 失效」條目）。

## 已知坑（詳見 CHANGELOG）

- `[cship.context_bar]` 只設 `symbol` 不會顯示，必須同時設 `format = "[$symbol$value]($style)"`。
- 手動用 stdin 測試 cship 輸出時，**不能用 PowerShell pipeline**（UTF-16 編碼會讓 cship 的 Rust JSON
  parser 直接失敗），要用 Git Bash 送純 UTF-8。
- psmux 終端滑鼠複製中文會亂碼（`CF_TEXT` vs `CF_UNICODETEXT` 問題），與 statusline 本身無關但同批排查記錄在 CHANGELOG。
