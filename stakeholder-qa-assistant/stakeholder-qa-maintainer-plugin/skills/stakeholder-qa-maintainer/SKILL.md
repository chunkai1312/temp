---
name: stakeholder-qa-maintainer
description: 依完整新版原始文件快照更新 stakeholder-qa-assistant 的 references、來源索引、問題路由、雜湊及版本，建立可獨立驗證與安裝的候選 Plugin。僅在使用者要求維護或發布利害關係人 QA 小幫手時使用；不回答業務問題、不修改原始文件，也不直接覆蓋現行或已安裝版本。
license: UNLICENSED
metadata:
  author: 永豐金控法令遵循處
  version: "0.1.0"
---

# 利害關係人 QA 小幫手更新維護

## 使用邊界

- 只維護 `stakeholder-qa-assistant-plugin`，不回答利害關係人認定、交易或系統操作問題。
- 新版輸入必須是完整來源快照；不要把缺少的檔案推定為「本次沒有更新」。
- 第一次執行只能掃描與提出計畫。在使用者確認文件對應、移除項目、問題路由及建議版本前，不得建立候選版本。
- 所有異動只能寫入 `releases/<版本>/stakeholder-qa-assistant-plugin/`。不得直接修改現行 Plugin、`sources/` 內的來源或 Spade 安裝目錄。
- 文件無法可靠抽取、掃描頁無法視覺核對、來源用途不明或路由無法判斷時停止更新並列出待確認事項。
- 更新報告、驗證結果與原始來源不得放入候選 Plugin。

## 工作目錄

工作目錄名稱不限。預設以目前所在目錄為基準；使用者透過 `--workspace <path>` 指定其他目錄時，所有路徑都以該目錄為基準。工作目錄必須同時包含：

- `stakeholder-qa-assistant-plugin/`：現行問答 Plugin。
- `sources/`：下一版的完整來源快照；來源檔案直接放在此目錄，不得再嵌套子目錄。
- `releases/`：候選版本輸出位置；可由流程建立。

現行來源清單、來源 ID 與雜湊以現行 Plugin 的 `source-index.md` 為準，不需要另建現行來源目錄。

## 更新流程

1. 先讀 [update-policy.md](references/update-policy.md)，再執行 `scripts/scan-sources.mjs --workspace <workspace>`。掃描是唯讀操作。
2. 將掃描結果整理為換版、更名、新增、移除、未變更、可能對應、路由影響與建議版本。沒有差異時停止，不升版也不建立輸出。
3. 對更名且內容異動、新增、移除或路由變更逐項取得確認，依 `update-policy.md` 建立 `stakeholder-qa-update-plan.v1` 計畫。計畫必須標示 `confirmed: true`。
4. 執行 `scripts/prepare-candidate.mjs --workspace <workspace> --plan <計畫檔>`。此步驟只建立候選副本、更新版本與來源索引；尚未代表候選版本可發布。
5. 依 [conversion-rules.md](references/conversion-rules.md) 重新轉換換版及新增文件。相同內容的更名只更新 reference frontmatter。移除來源時同步清除失效 reference 與問題路由。
6. 每個有效 reference 都必須出現在候選 `SKILL.md` 的問題路由或來源連結中。新來源無法納入既有分類時，先取得使用者對新路由的確認。
7. 依 [release-checklist.md](references/release-checklist.md) 完成人工核對，再執行 `scripts/validate-release.mjs --workspace <workspace> --candidate <候選 Plugin>`。
8. 只有驗證通過時才能產生 ZIP。最後回報候選目錄、ZIP、更新報告、驗證結果、版本變更及仍待人工確認事項。

## 停止條件

- 找不到工作目錄的必要子目錄，或現行 Plugin 驗證失敗。
- `sources/` 為空、含不支援格式、含子目錄，或看起來不是完整來源快照。
- 一個新版文件可能對應多個現行來源，或一個現行來源可能被多個新版文件取代。
- 計畫使用重複、已停用或非下一個可用的來源 ID。
- `Minor`、`Major` 或升至 `1.0.0` 尚未明確確認。
- 轉換結果無法保留頁碼、條次、題號、表格、日期、比例或必要操作路徑。
- 驗證失敗。不得在失敗狀態下建立或保留安裝用 ZIP。
