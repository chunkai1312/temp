# 永豐金控利害關係人 QA 助理 Agent Plugin

本專案依 [Agent Plugins 1.0.0](https://agent-plugins.org/specification) 與 [Agent Skills](https://agentskills.io/specification) 建立，採 `Skills-only` 架構。知識內容只來自工作區 `利害關係人QA小幫手外規,內規,操作手冊及問答集/` 內的 `11` 份原始文件，不連接正式資料庫、客戶資料、員工資料或利害關係人管理系統。

此 Plugin 僅供內部知識查詢與作業說明使用，不執行申報、不修改正式系統、不查詢即時資料，也不代表已完成最新法規版本或效力查證。法律、交易或版本敏感問題應由法遵人員依適用日期與正式文件進一步確認。

## 結構

```text
stakeholder-qa-assistant-plugin/
├── README.md
├── plugin.json
└── skills/
    └── stakeholder-qa-assistant/
        ├── SKILL.md
        ├── references/
        │   ├── external-regulation.md
        │   ├── internal-transaction-review.md
        │   ├── internal-registration-reporting.md
        │   ├── reporting-scope.md
        │   ├── training-material.md
        │   ├── faq.md
        │   ├── system-query.md
        │   ├── system-self-data.md
        │   ├── system-non-self-data.md
        │   ├── system-permissions.md
        │   ├── group-structure.md
        │   └── source-index.md
        └── scripts/
            └── validate-plugin.mjs
```

每份原始文件對應一份 Markdown；沒有打包既有 POC 的 RAG JSONL、v2 衍生資料或標準答案。

## 驗證

執行 Plugin 結構與連結驗證：

```bash
node skills/stakeholder-qa-assistant/scripts/validate-plugin.mjs
```

在原始工作區執行時，可加上 `--verify-sources`，核對 `利害關係人QA小幫手外規,內規,操作手冊及問答集/` 的檔案清單與 `SHA-256`：

```bash
node skills/stakeholder-qa-assistant/scripts/validate-plugin.mjs --verify-sources
```

GitHub Copilot CLI 可直接掛載本機 Plugin：

```bash
copilot --plugin-dir ./stakeholder-qa-assistant-plugin plugin list --json
copilot --plugin-dir ./stakeholder-qa-assistant-plugin skill list
```

本專案僅供內部使用。
