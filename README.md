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

在 `settings.json` 加入（或更新既有的）`statusLine` 欄位：

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

## 舊版（已停用）

`context-bar.py`、`update-usage-cache.py`、`install.ps1` 為早期針對 Windows 修正編碼與錯誤處理的 Python 版狀態列工具（v1.0.1），已由 cship 取代，保留僅供參考。

## License

本專案採用 [MIT License](LICENSE) 授權，歡迎自由使用、修改與散布。
