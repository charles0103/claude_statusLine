# Claude StatusLine for Windows (Enhanced Version)

這是針對 Windows 環境優化的 Claude Code 狀態列工具，修正了原版在 Windows 上的編碼和錯誤處理問題。

## 預覽

![Status Line Screenshot](docs/screenshot.png)

## 功能特色

- **即時 Context 用量**：顯示當前對話的 token 使用量，附帶彩色進度條
- **API 用量限制**：顯示 5 小時和 7 天的 API 使用率
- **模型資訊**：顯示當前使用的模型（Opus4.5、Sonnet4 等）
- **專案資訊**：顯示當前目錄、Git 分支和未提交的變更數量

## 相較原版的改進

1. **修正 UTF-8 編碼問題**：解決 Windows PowerShell 導致的 `UnicodeEncodeError`。
2. **增強錯誤處理**：處理 API 回應中的 `None` 值，增加日誌記錄。
3. **修正快取格式問題**：確保快取檔案格式固定，避免解析錯誤。

## 系統需求

- **Python 3.8+**
- **git** 在 PATH 中
- **keyring** 套件

## 快速安裝

1. 下載此專案
2. 在 PowerShell 中執行：
   ```powershell
   .\install.ps1
   ```
3. 重啟 Claude Code

## 版本資訊

- **版本**：1.0.1 (Enhanced for Windows)
- **主要改進**：UTF-8 編碼支援、錯誤處理增強、快取格式修正

## License

本專案採用 [MIT License](LICENSE) 授權,歡迎自由使用、修改與散布。
