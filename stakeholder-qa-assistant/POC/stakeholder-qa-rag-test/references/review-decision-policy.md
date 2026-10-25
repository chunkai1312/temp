# Review Decision Policy v2（Phase 5 規格骨架）

此檔定義人工覆核後的決策規則：哪些情況可以回答、哪些情況只能附保留回答、哪些情況必須退回重做或改答「目前無法確定」。

---

## 一、決策等級

人工覆核後，結果分為四級：

### `approve`
- 可直接進最終回答
- 主要結論均被法源支持
- 無重大版本、例外、主體綁定問題

### `approve_with_caveat`
- 可回答，但必須保留限制或條件
- 例如：版本未完全確認、事實略有缺口、FAQ 僅作輔助

### `revise_and_recheck`
- 不可直接回答
- 需先回修拆題、檢索、抽取、claim 驗證或答案文字後，再次覆核

### `cannot_determine`
- 證據不足或風險過高
- 應直接改採保守回答，例如：`目前無法確定。`

---

## 二、可 `approve` 的最低條件

至少滿足：

1. 主要 claim 皆為 `supported`
2. 重大 claim 無 `risk_flags`
3. `exceptions_checked = true`
4. 高風險現況題之 `version_status` 不得為 `unconfirmed`
5. 回答中的重要結論均有具體 citation 對應
6. 未出現 FAQ / 訓練資料凌駕正式法源之情形

---

## 三、應 `approve_with_caveat` 的常見情況

例如：

1. 問題事實略有缺口，但不影響大方向
2. 版本資料未完全結構化，但現有條文文字足以支持保守結論
3. 需要補一句「若交易時間不同，適用版本可能不同」
4. FAQ / 教育訓練僅作補充，且正式法源仍足夠
5. 屬於輔助性說明，不宜表述為最終法律認定

### 必須加上的內容
- 限制揭露
- 適用前提
- 保守語氣

---

## 四、應 `revise_and_recheck` 的常見情況

例如：

1. 主體抓錯或寫得太含糊
2. 回答沒提到明顯的但書或例外
3. 共同適用條文尚未補齊
4. claim 與 citation 對不齊
5. 回答口氣過度肯定，但支撐度只有 `partially_supported`
6. 外規 / 內規 / FAQ 位階使用不當

---

## 五、應 `cannot_determine` 的常見情況

例如：

1. 高風險現況題，但版本效力無法確認
2. 關鍵例外或但書無法查核
3. 主體、客體或交易行為不明，導致無法判定適用條文
4. 僅有 FAQ、教育訓練或圖示可參考，沒有正式法源
5. 不同法源互相衝突，但尚未能判斷優先適用

---

## 六、輸出到最終回答前的決策摘要

內部可形成：

```json
{
  "review_decision": "approve|approve_with_caveat|revise_and_recheck|cannot_determine",
  "decision_reasons": [],
  "required_caveats": [],
  "must_revise_sections": []
}
```

### 欄位說明
- `decision_reasons`：決策理由
- `required_caveats`：若可附保留回答，列出必須揭露的限制
- `must_revise_sections`：若需重修，指出要回修的模組

---

## 七、給 SKILL 的執行摘要

1. 覆核後不是二分法，而是四級決策
2. 只有 `approve` / `approve_with_caveat` 才能進最終回答
3. `revise_and_recheck` 要先回修再看
4. `cannot_determine` 直接轉保守回答