---
name: codex
description: Use when the user types /codex to delegate coding work to OpenAI Codex CLI running in a visible Herdr pane beside Claude, with Claude writing the spec and verifying the result
disable-model-invocation: true
---

# 交給 Codex（Herdr 並排協作）

Claude 負責：寫需求書 → 送給 Codex → 等待 → **自己驗證** → 回報。Codex 負責實作。
使用者要能在 Herdr 畫面上看到整個過程，所以 Codex 放在 **Claude 同一個 tab 的右側 pane**。
`/codex` 後面若有文字，那就是第一個任務；之後同一段對話中使用者說「交給 Codex …」都照本流程。

## 1. 找到或開啟 Codex pane

- 自己的終端機：`$env:HC_TERMINAL_ID`（例如 `t8`）。為空 → 不在 Herdr 內，跳到「不在 Herdr 時」。
- `herdr-app ls`（JSON）找出自己所在的 tab 與 pane；同 tab 內 `app` 為 `codex` 的終端機就是 Codex pane，**沿用它**。
- 沒有 → `herdr-app do pane.split --direction right --pane <自己的 pane>`，取回傳的 `terminal`。
- 同 tab 有 pane 但 Codex 已結束（只剩 shell，例如重開機後）→ 直接在該 pane 啟動新的 Codex。

**啟動／送任務一律用 `hc send`，不要用 `--argv` JSON**（PowerShell 會把引號轉義壞，Herdr 只開出空 shell）：

```powershell
# 新啟動（帶第一個任務）
hc send <t> "codex --no-daemon -s workspace-write '請完整閱讀 <需求書絕對路徑> 並照做，最後用繁體中文回報。'"
# Codex 已在執行、閒置中
hc send <t> --if idle '新任務：請完整閱讀 <需求書絕對路徑> 並照做，最後用繁體中文回報。'
```

Codex 的工作目錄是目前專案資料夾；要改專案外的檔案時，用 `--add-dir <資料夾>` 啟動。

## 2. 需求書（寫在 scratchpad，Markdown）

每份都要寫明：
- 目標、背景、可修改的檔案範圍。
- **不可以**：修改範圍外的檔案；切換主題或外觀（使用者受不了白底）；關閉任何 pane／tab／space；對 Claude 的終端機貼上文字；`git commit`／`push`。
- 驗證步驟（建置、測試、檢查指令），要求「實際執行並據實回報，沒跑成功就說沒跑」。
- 回報用繁體中文：改了哪些檔案、驗證結果、需要使用者手動測試的項目。

## 3. 等待（背景，不輪詢）

```powershell
hc wait <t> --timeout 1800; hc read <t> --lines 60
```
以 `run_in_background` 執行，完成會收到通知。等待期間不要另外 sleep 或反覆讀畫面。

## 4. 驗證（不採信 Codex 的回報）

- 自己讀改動的程式碼（`git diff`）、跑專案的建置與測試。
- 動到使用者設定檔前先記下雜湊，完成後比對沒有被意外改動。
- 查 Codex 是否做了禁止的事：讀 `~/.codex/sessions/` 中該 session 的實際指令，而不是只看文字（需求書或程式碼裡出現 `close` 等字樣不算執行）。
- 滑鼠操作（點擊、右鍵、hover）無法用指令觸發 → 請使用者實測，再截圖或讀畫面確認。
- 使用者的 space／pane 數量有變化時，先查清楚是誰造成的，再回報。

## 5. 提交

只有使用者說要提交／推送才做。推送前掃描個資與金鑰，**掃到就停止，不要只印出來**；寫多行中文內容到檔案時用 Edit 工具，不要用含 Windows 路徑的 Python 字串（`\U` 跳脫會失敗）。

## 不在 Herdr 時

改用背景執行（使用者看不到即時過程，要先告知）：
```powershell
Get-Content <需求書> -Raw -Encoding UTF8 | codex exec -C <專案資料夾> -s workspace-write --skip-git-repo-check -o <結果檔> -
```

## 常見錯誤

| 錯誤 | 正確做法 |
|---|---|
| `herdr-app do tab.new --argv '[...]'` 在 PowerShell 失敗 | 先開 pane，再 `hc send` 啟動 Codex |
| 相信 Codex「全部通過」 | 自己重跑測試、看 diff |
| 為了測試切淺色主題 | 不切；需要時先問使用者 |
| 個資掃描結果只印出就繼續 push | 掃到即中止 |
| Codex 驗證時開了測試 pane 沒關／關錯 | 需求書要求「只關自己開的」，事後用 `herdr-app ls` 核對 |
