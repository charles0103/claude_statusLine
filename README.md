# Claude Code StatusLine 設定備份

Claude Code 狀態列的個人設定備份與新電腦安裝步驟。

> **目前使用版本：[cship](https://github.com/stephenleo/cship)**（Rust 編譯、相容 Starship 設定格式）。
> 本 repo 早期的 Python 版工具（`context-bar.py`）已停用，檔案保留在原處僅供參考，見文末「舊版（已停用）」。

## 預覽

第一行由 Starship 渲染（目錄、Git 分支、Node 版本），第二行是 cship 原生模組（模型、費用、Context 用量進度條、5h/7d API 用量）。

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

### 3. 安裝 cship（在 Git Bash 中執行）

```bash
curl -fsSL https://cship.dev/install.sh | bash
```

安裝腳本會自動：
- 下載執行檔到 `~/.local/bin/cship`
- 建立起始設定檔 `~/.config/cship.toml`
- 寫入 `~/.claude/settings.json` 的 `statusLine` 設定：

```json
"statusLine": {
  "type": "command",
  "command": "C:/Users/<使用者>/.local/bin/cship.exe"
}
```

### 4. 套用本 repo 的自訂設定檔

把本 repo 的 [`cship.toml`](./cship.toml) 複製到 `C:\Users\<使用者>\.config\cship.toml`（覆蓋安裝腳本產生的起始設定）。

此設定包含：
- 第一行：`$starship_prompt` 完整 Starship passthrough
- 第二行：模型（🤖）、費用（💰，$2 黃色警戒／$5 紅色）、CTX 進度條（40% 黃色／70% 紅色）、5h／7d API 用量（60% 黃色／80% 紅色）

### 5. 重啟 Claude Code

狀態列即生效。

## 常用指令

```powershell
cship --version    # 版本
cship explain      # 顯示每個模組目前的渲染值與設定來源（調整樣式時好用）
cship uninstall    # 移除執行檔並清掉 settings.json 設定
```

## 舊版（已停用）

`context-bar.py`、`update-usage-cache.py`、`install.ps1` 為早期針對 Windows 修正編碼與錯誤處理的 Python 版狀態列工具（v1.0.1），已由 cship 取代，保留僅供參考。

## License

本專案採用 [MIT License](LICENSE) 授權，歡迎自由使用、修改與散布。
