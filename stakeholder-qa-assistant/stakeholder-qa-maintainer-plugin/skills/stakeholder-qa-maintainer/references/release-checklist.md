# 發布前檢查

## 來源與內容

- 新版快照中的每個檔案都有且只有一個有效來源 ID。
- 每個有效來源都有對應 reference，已停用來源沒有殘留 reference。
- 新增、移除、更名與換版內容均已列入更新報告。
- 異動文件已完成格式別核對，掃描頁、操作畫面及組織圖已視覺檢查。
- `source_file`、`SHA-256`、轉換日期及 Markdown 對應一致。

## Skill 與版本

- 每個有效 reference 都出現在 `SKILL.md` 的問題路由或來源連結。
- 已移除來源沒有失效連結或殘留回答規則。
- `plugin.json` 與 `SKILL.md` 版本一致，版本等級符合更新政策。
- `Minor`、`Major` 或升至 `1.0.0` 已取得確認。

## 驗證與交付

- 候選目錄位於 `releases/<版本>/`，現行 Plugin 與 `sources/` 內的原始來源未被修改。
- 候選 Plugin validator 通過。
- `validate-release.mjs` 的錯誤數為零。
- 安裝用 ZIP 只包含完整的 `stakeholder-qa-assistant-plugin/` 根目錄。
- `update-report.md` 與 `validation-result.json` 位於 Plugin 外部。
- 抽樣問題引用新版有效來源，不引用已停用來源。
