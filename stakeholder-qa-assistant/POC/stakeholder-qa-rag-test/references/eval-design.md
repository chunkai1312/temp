# Eval Design v2（Phase 6 規格骨架）

此檔定義 v2 法規檢索系統的評測設計原則，將評測分成 **檢索、結構化抽取、回答 grounding** 三層，並保留高風險 hard fail 機制。

> 目前狀態：**先建立評測與標註骨架，不要求現階段已完成完整標註資料集或自動評分 pipeline。**

---

## 一、評測目標

不要只看「答案像不像人工答案」，而要回答三件事：

1. **有沒有把關鍵法源找回來？**
2. **有沒有把法條中的主體、要件、例外、責任抽對？**
3. **最後寫出的結論是否真的被法源支持？**

---

## 二、三層評測架構

### Layer 1：檢索層
評估是否找回正確條文、但書、例外、責任條文與共同適用條文。

### Layer 2：結構化抽取層
評估抽取出的 `subject / counterparty / modality / action / object / conditions / exceptions / deadline / legal_effect / liability` 是否正確。

### Layer 3：回答層
評估答案是否逐項引用、引用是否真的支持結論、是否誤用版本、是否有未被法源支持的陳述。

---

## 三、測試資料集建議切分

### 1. 開發集（dev）
- 用於調整 retrieval、rerank、抽取規則
- 可反覆查看答案與標註

### 2. 驗證集（validation）
- 用於迭代期間比較版本
- 不應只看單題表現

### 3. 保留測試集（holdout）
- 用於最終驗收
- 不應在規則調整過程中反覆手動 overfit

---

## 四、題型覆蓋要求

評測題目至少涵蓋：

1. 系統操作題
2. 純法規 / 制度規範題
3. 法規案例題
4. 親等 / 申報範圍題
5. 混合題（法規 + 系統）
6. 高風險題（版本、但書、責任、重大交易、禁止規定）

---

## 五、標註單位

### 檢索層標註單位
每題至少標：
- 必要法源（must-have sources）
- 次要補充法源（good-to-have sources）
- 禁止誤引法源（must-not-cite sources）

### 抽取層標註單位
每題至少標：
- 正確 `subject`
- 正確 `action`
- 正確 `modality`
- 關鍵 `conditions`
- 關鍵 `exceptions`
- 關鍵 `legal_effect` / `liability`

### 回答層標註單位
每題至少標：
- 可接受結論範圍
- 必須揭露的前提或限制
- 必須引用的法源
- 不可出現的 unsupported claim

---

## 六、評測輸出原則

每層評測都應同時產出：

1. **整體指標**
2. **逐題結果**
3. **重大錯誤清單**
4. **高風險題通過率**

避免只有平均分數，卻看不到哪類錯誤最危險。

---

## 七、建議輸出摘要

```json
{
  "retrieval": {
    "recall_at_20": 0.0,
    "recall_at_50": 0.0,
    "precision_at_10": 0.0,
    "ndcg": 0.0,
    "critical_source_miss_rate": 0.0
  },
  "extraction": {
    "subject_f1": 0.0,
    "conditions_f1": 0.0,
    "exceptions_f1": 0.0
  },
  "answer": {
    "citation_completeness": 0.0,
    "citation_support_rate": 0.0,
    "unsupported_claim_rate": 0.0,
    "wrong_version_rate": 0.0
  },
  "hard_fail_count": 0
}
```

---

## 八、給 SKILL / 後續 pipeline 的執行摘要

1. 評測至少分三層，不可只做最終答案比對
2. 每題要有 must-have / must-not-cite 標註
3. 高風險題要單獨看，不可被平均分數稀釋
4. Hard fail 一旦出現，不應直接上線