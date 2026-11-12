# Final Answer Gating Rules v2（Phase 5 規格骨架）

此檔定義在最終答案送出前，必須通過哪些 gate。

---

## 一、最終 gate 的目的

最終 gate 是最後一道防線，用來阻止以下情況直接送出：

1. 沒有被法源支持的結論
2. 漏掉關鍵例外或但書的肯定答案
3. 引用版本不明法條回答現況高風險題
4. 主要依賴 FAQ / 教育訓練 / 圖示的正式法律結論
5. 人工覆核尚未通過卻直接輸出

---

## 二、最終 gate 前提

進入最終 gate 前，至少應具備：

- 問題拆解結果
- 法域 / 日期 / 效力過濾結果
- 檢索與重排摘要
- 結構化抽取結果
- claim validation 結果
- review decision

若缺任一項，原則上不得輸出高風險法律結論。

---

## 三、必須通過的 gate

### Gate 1：Review decision gate
- `review_decision` 必須為：
  - `approve`
  - 或 `approve_with_caveat`

若為：
- `revise_and_recheck`
- `cannot_determine`

則不得輸出確定答案。

### Gate 2：Claim support gate
- 主要 claim 不得為 `unsupported`
- 高風險 claim 不得為 `uncertain`

### Gate 3：Exception gate
- 若題目涉及成立要件、禁止規定、例外或排除條款，則 `exceptions_checked` 必須為 `true`

### Gate 4：Version gate
- 高風險現況題：`version_status` 不得為 `unconfirmed`
- 若無法確認，應改答：`目前無法確定。`

### Gate 5：Authority gate
- 正式法律結論不得只依賴：
  - FAQ
  - 教育訓練
  - 圖示整理

### Gate 6：Citation alignment gate
- 每項重要結論都應有對應 citation
- 若 citation 僅 `context_only`，不得拿來支撐完整結論

---

## 四、最終輸出型態

依 gate 結果，最終回答只允許三種型態：

### 1. 正常證據式回答
條件：
- gates 全數通過
- review decision = `approve`

### 2. 附保留條件的證據式回答
條件：
- review decision = `approve_with_caveat`
- 需於答案中明列限制、前提、版本或事實缺口

### 3. 保守拒絕確定回答
條件：
- 任一關鍵 gate 未通過
- 或 `cannot_determine`

建議語句：
- `目前無法確定。`
- `依現有資料尚難作成確定判斷。`
- `因版本效力／例外條款／主體事實仍未能確認，暫不宜下確定結論。`

---

## 五、禁止輸出的情況

以下情況即使使用者催促，也不應直接給肯定結論：

1. 高風險題目但版本不明
2. 關鍵但書未檢查
3. 主要 claim 無正式法源支撐
4. review decision 尚未通過
5. 結論只有 FAQ / 教育訓練 / 圖示支撐

---

## 六、內部最終 gate 摘要

```json
{
  "gate_passed": true,
  "final_answer_mode": "evidence_answer|evidence_answer_with_caveat|cannot_determine",
  "failed_gates": [],
  "required_disclosures": []
}
```

---

## 七、給 SKILL 的執行摘要

1. 最終回答前一定要過 gate
2. 只有 `approve` / `approve_with_caveat` 才能往下
3. 高風險現況題最怕版本不明與例外未檢查
4. gate 不過就改答「目前無法確定」