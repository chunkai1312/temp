# 永豐金控大額暴險 Agent Plugin

本專案依 `Agent Plugins 1.0` 建立，採 `Skills-only` 架構。知識內容只來自工作區 `知識庫文件/` 內的 `5` 份原始文件，不連接正式資料庫、客戶資料或申報系統。

## 結構

```text
sinopac-large-exposure-plugin/
├── plugin.json
└── skills/
    └── large-exposure-reporting/
        ├── SKILL.md
        ├── references/
        │   ├── external-regulation.md
        │   ├── internal-procedure.md
        │   ├── reporting-guide.md
        │   ├── system-operations.md
        │   ├── qa.md
        │   └── source-index.md
        └── scripts/
            └── validate-plugin.mjs
```

每份原始文件對應一份 Markdown；沒有另外建立標準答案或衍生知識文件。

## 驗證

執行 Plugin 結構與連結驗證：

```bash
node skills/large-exposure-reporting/scripts/validate-plugin.mjs
```

在原始工作區執行時，可加上 `--verify-sources`，核對 `知識庫文件/` 的檔案清單與 `SHA-256`：

```bash
node skills/large-exposure-reporting/scripts/validate-plugin.mjs --verify-sources
```

GitHub Copilot CLI 可直接掛載本機 Plugin：

```bash
copilot --plugin-dir ./sinopac-large-exposure-plugin plugin list --json
copilot --plugin-dir ./sinopac-large-exposure-plugin skill list
```

本專案僅供內部使用。
