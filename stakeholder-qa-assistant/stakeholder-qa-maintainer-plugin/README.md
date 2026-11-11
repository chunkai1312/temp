# 利害關係人 QA 小幫手更新維護 Plugin

本 Plugin 採 `Skills-only` 架構，用於比較完整新版來源快照、建立新的 `stakeholder-qa-assistant-plugin` 候選目錄、驗證來源追溯資訊並產生安裝用 ZIP。它不回答利害關係人業務問題，也不直接修改現行 Plugin、原始文件或 Spade 已安裝版本。

## 工作目錄

```text
<workspace>/
├── stakeholder-qa-assistant-plugin/
├── sources/
└── releases/
```

`<workspace>/` 只是工作目錄代號，實際目錄名稱不限。使用者可透過 `--workspace <path>` 指定任意工作目錄；未指定時，則使用目前所在目錄。

`sources/` 直接放置下一版的完整來源快照，不再包含其他子目錄，也不是只放異動檔案。相較現行 Plugin 的 `source-index.md` 缺少的檔案，會列為待移除來源。

## 使用流程

1. 將完整新版來源集合放入 `sources/`。
2. 先要求 `stakeholder-qa-maintainer` 掃描差異，不修改任何檔案。
3. 確認換版、更名、新增、移除、問題路由與建議版本。
4. 確認後建立候選 Plugin，依差異重新轉換 reference。
5. 驗證候選版本，產生 ZIP、更新報告與驗證結果。

範例：

```text
請使用 stakeholder-qa-maintainer 檢查 sources 的完整來源快照，先列出差異，不要修改現行 Skill。
```

確認差異後：

```text
依確認後的更新計畫建立候選版本，完成 reference 轉換與驗證，不要覆蓋現行 Plugin。
```

## Scripts

唯讀掃描：

```bash
node skills/stakeholder-qa-maintainer/scripts/scan-sources.mjs --workspace /path/to/workspace
```

依已確認的計畫建立候選目錄：

```bash
node skills/stakeholder-qa-maintainer/scripts/prepare-candidate.mjs \
  --workspace /path/to/workspace \
  --plan /path/to/update-plan.json
```

完成 reference 與路由調整後執行驗證及封裝：

```bash
node skills/stakeholder-qa-maintainer/scripts/validate-release.mjs \
  --workspace /path/to/workspace \
  --candidate /path/to/workspace/releases/0.2.0/stakeholder-qa-assistant-plugin
```

本 Plugin 僅供內部使用。
