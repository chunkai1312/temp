# 永豐金控大額暴險 Agent Plugin

本專案是依 `Agent Plugins 1.0` 建立的靜態知識 Plugin，第一版採 `Skills-only` 架構，不連接正式資料庫、客戶資料或申報系統。

## 目的

- 僅將 `知識庫文件/` 內的 `PDF` 與 `DOCX` 規則整理為可追溯的 `Markdown`。
- 明確區分子公司內部上傳與金控對外申報，避免誤用新臺幣 `30` 億元門檻。
- 分開處理 `A07／表七` 與 `F19／表十九`，避免跨表引用。
- 以測試案例固定申報範圍、表十九與門檻區分等關鍵答案及同義問法。
- 同一份 Plugin 可供支援 `Agent Plugins 1.0` 的 Agent 使用，包括 Codex 與 GitHub Copilot。

## 來源邊界

知識內容只允許引用原始工作區 `知識庫文件/` 目錄內的檔案。其他目錄的文件不得作為知識事實來源；迴歸題目只用於驗收，預期答案仍須完全由 `知識庫文件/` 支持。

## 專案結構

```text
sinopac-large-exposure-plugin/
├── plugin.json
├── skills/
│   └── large-exposure-reporting/
│       ├── SKILL.md
│       ├── references/
│       └── scripts/
└── tests/
    └── regression-cases.json
```

## 驗證

```bash
node skills/large-exposure-reporting/scripts/validate-knowledge.mjs
```

在保留原始工作區的環境中，可加上 `--verify-sources`，核對來源檔案清單及 `SHA-256`：

```bash
node skills/large-exposure-reporting/scripts/validate-knowledge.mjs --verify-sources
```

驗證正式發布條件時，加上 `--release`。目前知識狀態是 `draft-for-review`，因此正式發布驗證會刻意失敗，直到風險管理處完成核准並將狀態改為 `approved`。

```bash
node skills/large-exposure-reporting/scripts/validate-knowledge.mjs --release --verify-sources
```

## 安裝原則

將整個目錄交付給支援 `Agent Plugins 1.0` 的工具。Plugin 的可攜內容只有根目錄的 `plugin.json` 與 `skills/`；不依賴特定平台的 Agent 設定檔。

GitHub Copilot CLI 可用下列指令直接掛載本機目錄並確認 Skill：

```bash
copilot --plugin-dir ./sinopac-large-exposure-plugin plugin list --json
copilot --plugin-dir ./sinopac-large-exposure-plugin skill list
```

## 上線前必要事項

1. 由風險管理處確認 `references/known-conflicts.md` 的三項待確認事項。
2. 核准各知識文件後，將 `status` 改為 `approved`，並更新 `last_reviewed`。
3. 執行一般驗證與 `--release` 驗證。
4. 由業務權責人抽驗 `tests/regression-cases.json` 的迴歸案例，再發布 Plugin 版本。

本專案僅供內部使用，不含任何客戶交易資料，也不執行正式申報。
