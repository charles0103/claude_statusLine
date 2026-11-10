# PowerShell 7 與 Codex Windows 沙箱排查紀錄

日期：2026-11-10  
專案：`D:\claude_statusline`  
狀態：**已解決並驗證**

## 摘要

Codex 在 `unelevated` 沙箱啟動 Microsoft Store／MSIX 版 PowerShell 7 時，於建立程序階段失敗，專案指令尚未執行：

```text
CreateProcessAsUserW failed: 5 (存取被拒。)
```

結論分兩層：

1. **啟動失敗**：商店版 `WindowsApps\pwsh.exe` 是 0 位元組的 reparse point（MSIX 別名），沙箱受限權杖無法解析並啟動它。改裝官方 MSI 版 PS7 並放到 PATH 最前面即可。底層 Windows 機制未追蹤至系統事件或原始碼；公開 issue 提供相符案例，但其技術分析不能視為本機已完整驗證的根因。
2. **修好後仍失敗**：Codex 的 app-server 常駐程序在 PATH 修復前啟動，持續沿用舊的 shell 路徑，連工具呼叫明確傳入的 `shell` 參數也被忽略，錯誤訊息因此仍顯示 WindowsApps 路徑。完整結束並重啟所有 Codex 程序後恢復正常。

此問題只出在商店版 PS7 與此沙箱的相容性，並非所有 PS7 都不能在沙箱使用。

## 環境

- Codex CLI：`0.167.0`；Windows 版本：`10.0.26300`。
- Codex 設定：`C:\Users\charles\.codex\config.toml` 的 `[windows] sandbox = "unelevated"`（全程未更動）。
- 商店版入口：`C:\Users\charles\AppData\Local\Microsoft\WindowsApps\pwsh.exe`（含 `Microsoft.PowerShell_8wekyb3d8bbwe` 子目錄的同名別名）。
- 商店版實體目錄：`C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.9.0_x64__8wekyb3d8bbwe`。
- 安裝前不存在：`C:\Program Files\PowerShell\7\pwsh.exe`。

## 對照測試

| 測試 | 結果 |
| --- | --- |
| 沙箱內，商店版 PS7 啟動別名 | `CreateProcessAsUserW failed: 5` |
| 相同入口加入 `-NoProfile` | 同樣失敗，不能歸因於個人啟動腳本 |
| 沙箱外，商店版 PS7 | 可正常讀取專案 |
| `unelevated` 沙箱直接呼叫商店版實體執行檔 | 失敗，錯誤 `-1073283067` |
| `unelevated` 沙箱直接呼叫 Windows PowerShell 5.1 | 成功，退出碼 0 |
| 工具指定 `cmd.exe`，再明確呼叫 PS5.1 | 專案讀取、UTF-8 中文暫存檔寫入／讀回／清除成功 |
| MXC 沙箱啟動商店版 PS7 | 可啟動並讀取專案，但有 FileSystem 初始化警告，未採用 |
| 安裝後，`unelevated` 沙箱直接呼叫 MSI 版 PS7 | 成功，輸出 `MSI_SANDBOX_OK`，退出碼 0 |
| 調整 PATH 後，在 `unelevated` 沙箱呼叫 `pwsh.exe` | 成功，輸出 `MSI_PATH_SANDBOX_OK`，退出碼 0 |

### 工具覆寫 shell 無效的現象

某次對話中，工具參數明確指定 `shell = C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`，錯誤卻仍回報實際啟動 WindowsApps 的 `pwsh.exe`，且 `env_u16_len=5908`（環境區塊與舊程序相同）。因此該次**沒有證據證明 Windows PowerShell 本身被測試到**。判斷依據是：該對話所連的 app-server（PID 36144，`app-server --managed-daemon`，08:58:57 啟動）早於 PATH 修復，shell 選擇由它在啟動時決定。此為依程序時間與命令列的推論，未能直接讀取該 daemon 的環境變數驗證。

### 與其他設定的關係

- `C:\Users\charles\.tmux.conf` 的 `default-shell` 影響 psmux pane；Codex 直接啟動 shell，不經 psmux。
- `D:\stock\.github\workflows\desktop-release.yml` 的 `shell: pwsh` 是 GitHub Actions 設定，不控制本機啟動。
- 沙箱 `setup_error.json` 曾有防火牆設定錯誤，未證實與本次問題相關。

## 修復步驟

### 1. 改用官方 MSI 安裝檔

`winget install --id Microsoft.PowerShell --installer-type wix` 偵測到現有套件，進入升級流程後回報沒有較新版本，未安裝 MSI 版。改為下載官方檔案：

```text
https://github.com/PowerShell/PowerShell/releases/download/v7.6.9/PowerShell-7.6.9-win-x64.msi
```

安裝前驗證：

- SHA256 與官方發布資訊一致：`50D33C7494AAF82B987CFD4DE3F232D04F91FDD4C0DEECA8A669CCED3E7CF8F9`
- Authenticode：`Valid`，簽署者為 Microsoft Corporation。

安裝參數 `ADD_PATH=1`、`ENABLE_PSREMOTING=0`、`/qn`、`/norestart`，退出碼 0，安裝位置 `C:\Program Files\PowerShell\7\pwsh.exe`。

### 2. 調整 Machine PATH

安裝後 WindowsApps 仍排在 MSI 目錄之前。已將 `C:\Program Files\PowerShell\7` 移到 **Machine PATH 最前面**並移除重複項，未修改 User PATH。`where.exe pwsh` 順序：

```text
C:\Program Files\PowerShell\7\pwsh.exe
C:\Users\charles\AppData\Local\Microsoft\WindowsApps\pwsh.exe
```

備份檔：`C:\Users\charles\AppData\Local\Temp\powershell-path-backup-20261110-092734.json`。此備份建立於 MSI 安裝後、PATH 重排前，並非安裝前的完整備份，且暫存資料夾可能被清理。

### 3. 完整重啟 Codex

僅關閉聊天視窗或重啟 herdr 都不足以替換舊 app-server。需結束下列程序後重新開啟：

```powershell
Get-Process codex,codex-code-mode-host,codex-computer-use-swift,ChatGPT -ErrorAction SilentlyContinue | Stop-Process -Force
```

`codex-windows-sandbox-service` 是沙箱的 Windows 服務，不需結束，重啟後自動接上。若重啟後仍殘留舊程序，重新開機最乾淨。

### 4. VS Code 終端機改用 MSI 版

VS Code 的 `source: "PowerShell"` 自動偵測選到了商店版（`shellIntegration.ps1` 由 WindowsApps 的 pwsh 載入）。已將 `%APPDATA%\Code\User\settings.json` 內三個 profile（`PowerShell`、`PowerShell (psmux)`、`MiniMax 2.7 (國際版)`）的 `source` 改為：

```json
"path": "C:\\Program Files\\PowerShell\\7\\pwsh.exe"
```

`args` 保持不變。已開啟的終端機需關閉重開才會生效。

## 驗證結果

Codex 重啟後，`C:\Users\charles\.codex\.sandbox\sandbox.2026-11-10.log` 記錄：

```text
12:23:25 MXC availability: true / Windows sandbox selection: unelevated
12:23:53 START:   C:\Program Files\PowerShell\7\pwsh.exe -Command ... Get-Command pwsh ... $PSHOME ...
12:23:53 SUCCESS: C:\Program Files\PowerShell\7\pwsh.exe -Command ...
12:25:05 SUCCESS: C:\Program Files\PowerShell\7\pwsh.exe -Command ...
```

- 新 app-server 啟動後的 shell 呼叫皆使用 MSI 版 PS7，並成功。
- `CreateProcessAsUserW failed: 5` 不再出現，沙箱模式仍為 `unelevated`。
- daemon 日誌另有一行無害警告：`windows_wsl_setup_acknowledged is ignored`（`config.toml` 內 Codex 不認得的舊設定，可自行刪除）。

## 注意事項

- **不要刪除** WindowsApps 下的 `pwsh.exe`：它是商店版入口，刪除不會修正問題，也可能破壞商店版。
- 日後 winget 升級 PowerShell 可能再裝回 MSIX 版（7.6.0 起預設），應指定 `--installer-type wix` 或直接用 MSI，並確認 MSI 目錄仍在 PATH 最前面。
- `.tmux.conf` 的 `default-shell` 仍指向商店版路徑，未更動；若要全面統一，可改為 `C:/Program Files/PowerShell/7/pwsh.exe`。
- 撤回 PATH 重排：參考備份 JSON 的 `Machine` 值，以管理員權限還原；若備份後又改過 PATH，先比較差異。此操作不會解除安裝 MSI 版。

## 參考來源（查閱於 2026-11-10）

1. [Codex issue #35871：商店版 pwsh 與 Windows 沙箱啟動失敗](https://github.com/openai/codex/issues/35871)：使用者回報 MSI 版優先於 PATH 後，`unelevated` 測試成功；對 0.159.2 的分析不能直接套用到後續版本。
2. [Microsoft：在 Windows 安裝 PowerShell](https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows?view=powershell-7.6)：7.6.0 起 winget 預設 MSIX，MSI 可指定 `--installer-type wix` 或直接下載。
3. [PowerShell 7.6.9 官方發布頁](https://github.com/PowerShell/PowerShell/releases/tag/v7.6.9)：官方 MSI 與 SHA256 來源。
4. [OpenAI：Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox)：MXC、elevated、unelevated 與診斷方式。
