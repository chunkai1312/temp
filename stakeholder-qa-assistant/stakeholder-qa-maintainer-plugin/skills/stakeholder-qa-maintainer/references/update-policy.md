# 更新政策

## 來源快照與對應

`sources/` 是下一版的完整來源集合，來源檔案必須直接放在此目錄。現行來源清單與雜湊由現行 Plugin 的 `source-index.md` 取得。掃描依下列順序判斷：

1. 檔名相同：雜湊相同為未變更，雜湊不同為換版。
2. 檔名不同但雜湊相同：視為更名，保留來源 ID 與 Markdown 檔名。
3. 其餘未配對檔案：分別列為新增與移除，並提供同副檔名的名稱相似度建議；不得自動合併為換版。

更名且內容異動時，必須由使用者確認新版文件取代哪一個來源 ID。

## 來源 ID

- 換版與更名保留原來源 ID。
- 新來源使用有效與已停用來源中的最大編號加一，格式為 `SRC-xxx`。
- 多個新來源依確認計畫中的來源 ID 遞增配置。
- 已停用來源 ID 永不重複使用。
- 移除來源保留於 `source-index.md` 的「已停用來源」，記錄原始檔名、停用日期及原因。

## Reference 與路由

- 換版與更名保留既有 Markdown 檔名。
- 新 reference 使用小寫英文、數字與連字號，副檔名固定為 `.md`。
- 新 reference 必須加入 `SKILL.md` 的問題路由或來源連結。
- 移除 reference 時必須同步移除所有失效連結；若因此移除既有問題類型，視為不相容能力變更。
- 不從原始文件推導新的回答政策。來源優先順序、衝突處理或回答邊界的改動必須另行確認。

## 兩階段 SemVer

試行期 `0.x`：

- 既有來源換版、更名或文字修正，且路由與能力不變：增加 `Patch`。
- 新增／移除來源、調整問題路由或新增能力：增加 `Minor` 並歸零 `Patch`。
- 升至 `1.0.0` 必須明確標示 `promoteToStable: true` 並取得確認。

正式版 `1.x` 之後：

- 內容修正或來源換版，支援範圍不變：增加 `Patch`。
- 向下相容地新增來源、問題類型或能力：增加 `Minor`。
- 移除既有能力，或改變 Skill 名稱、安裝方式、設定格式、引用契約或產出結構：增加 `Major`。

掃描結果只提供建議版本。建立候選版本時，`Patch` 可依已確認計畫採用；`Minor`、`Major` 與 `1.0.0` 必須在計畫中明確確認。

## 已確認計畫格式

```json
{
  "schemaVersion": "stakeholder-qa-update-plan.v1",
  "confirmed": true,
  "currentVersion": "0.1.2",
  "nextVersion": "0.2.0",
  "versionReason": "新增一份來源文件",
  "routeChangesConfirmed": true,
  "breakingChange": false,
  "promoteToStable": false,
  "changes": [
    {
      "action": "replace",
      "sourceId": "SRC-006",
      "currentFile": "利害關係人常見問答集-更新3.docx",
      "incomingFile": "利害關係人常見問答集-更新4.docx",
      "markdown": "faq.md"
    },
    {
      "action": "add",
      "sourceId": "SRC-012",
      "incomingFile": "新增作業說明.pdf",
      "markdown": "additional-procedure.md",
      "route": "建檔與申報"
    },
    {
      "action": "remove",
      "sourceId": "SRC-005",
      "currentFile": "(金控)利害關係人教育訓練.pdf",
      "markdown": "training-material.md",
      "reason": "新版完整來源快照已不再納入"
    }
  ]
}
```

`action` 只允許 `replace`、`rename`、`add`、`remove`。檔案欄位只能填入檔名，不得包含絕對路徑或 `..`。
