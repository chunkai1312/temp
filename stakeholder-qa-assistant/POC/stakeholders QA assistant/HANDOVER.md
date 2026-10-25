# stakeholders QA assistant / stakeholder-qa-rag-test 交接說明

## 1. 文件目的

本文件用於交接目前已建立完成的：
- `stakeholders QA assistant` 工作區資料
- `stakeholder-qa-rag-test` skill 規格與其 v1 / v2 混合架構

重點不是介紹單一檔案，而是說明：
1. 這個 skill 現在怎麼運作
2. v1 / v2 各放什麼資料
3. 哪些檔案是核心
4. 後續應如何擴充

---

## 2. 專案目前整體架構

目前專案已從單純的 RAG 測試技能，擴展成一個 **過渡型法律 / 法遵檢索與回答框架**：

- **v1**：既有可用的 RAG 知識庫與檢索配置
- **v2**：新建立的法規治理、結構化抽取、claim 驗證、人工覆核與評測骨架，並已做出第一批正式資料

### 現況一句話總結
目前是：
> **v1 檢索可用、v2 規格完整、v2 第一批正式資料已建立，skill 已升級為「v2 正式資料優先、v1 回退補強」模式。**

---

## 3. Skill 現在怎麼運作

### 對應 skill
- `stakeholder-qa-rag-test`

### skill 本體檔案
- `stakeholder-qa-rag-test/SKILL.md`

### 現行執行流程
目前 `SKILL.md` 已改成以下順序：

1. **先判斷題型**
   - 系統操作題
   - 法規案例題
   - 純法規 / 制度規範題
   - 親等 / 申報範圍題

2. **先拆法律要素**
   - issue
   - law_domain
   - query_date
   - subject / counterparty
   - action / object
   - modality
   - conditions / exceptions / deadlines / legal_effect / liabilities

3. **先做法域 / 日期 / 效力判斷**
   - 依 v2 過濾規則決定可否直接下結論

4. **優先查 v2 正式化資料**
   - 若已正式化條目有覆蓋，就先用 v2

5. **不足時回到 v1 檢索資料**
   - 以既有 JSONL 做補強

6. **高風險法律題走驗證 / gate 思維**
   - claim validation
   - consistency check
   - human review checklist
   - final answer gate

7. **若證據不足，保守回答**
   - `目前無法確定`
   - 或明確揭露版本、例外、主體、法域缺口

---

## 4. v1 / v2 各自放什麼

# 4.1 v1：既有可用 RAG 層

v1 是目前最早可用、已可直接查詢的資料層，放在：

## 核心資料夾
- `stakeholders QA assistant/rag_optimized_output/`

## 主要檔案
- `system_operation_kb_rag.jsonl`
- `faq_case_kb_rag.jsonl`
- `regulation_kb_rag.jsonl`
- `training_note_kb_rag.jsonl`
- `all_kb_rag.jsonl`
- `retrieval_profiles.json`
- `retrieval_strategy.md`

## v1 的用途
- 提供第一線檢索
- 支援系統操作、FAQ 案例、法規、教育訓練資料查找
- 讓 skill 在沒有 v2 正式條目時，仍能作答

## v1 的限制
- 多數條文仍非完整版本化資料
- `official_url`、`effective_date`、`repeal_date` 等欄位不完整
- FAQ / 訓練資料與正式法源混存，需要 skill 額外做位階判斷
- 不可直接視為完整可追溯法規庫

---

# 4.2 v2：治理與正式化資料層

v2 放在：
- `stakeholders QA assistant/legal_kb_v2/`

## 目前已有檔案
- `retrieval_profiles_v2.json`
- `review_policy.json`
- `norm_extraction_schema.json`
- `regulation_versions.jsonl`
- `citation_graph.jsonl`
- `norm_extractions.jsonl`
- `claim_validations.jsonl`
- `official_source_manifest.json`
- `first_batch_scope.md`

## v2 的用途
- 補足 v1 沒有的法規治理概念
- 建立：
  - 版本化法規欄位
  - 結構化抽取
  - claim 驗證
  - citation graph
  - 人工覆核與最終回答 gate
- 讓高風險題不只靠關鍵字檢索，而能做較嚴格的法源控制

## v2 的現況
- 規格檔已完整
- 第一批正式資料已建立
- 但 עדיין不是完整全量法規庫
- 很多條目仍需陸續正式化

---

## 5. 哪些檔案是核心

下面是交接時最需要先理解的核心檔案。

# 5.1 Skill 核心

## `stakeholder-qa-rag-test/SKILL.md`
**最重要檔案。**

用途：
- 定義 skill 觸發條件
- 定義回答流程
- 定義 v2 優先 / v1 回退邏輯
- 定義高風險題的保守回答原則

如果要理解這個 skill 現在怎麼運作，先看這一份。

---

# 5.2 v1 檢索核心

## `stakeholders QA assistant/rag_optimized_output/retrieval_profiles.json`
用途：
- 現行 v1 路由與 top-k 設定
- 系統操作 / 法規案例 / 純法規 / 親等題的檢索來源與參數

## `stakeholders QA assistant/rag_optimized_output/retrieval_strategy.md`
用途：
- v1 檢索邏輯說明
- FAQ、regulation、training 的相對角色

## `system_operation_kb_rag.jsonl`
用途：
- 系統操作題來源

## `faq_case_kb_rag.jsonl`
用途：
- FAQ / 相似案例來源

## `regulation_kb_rag.jsonl`
用途：
- 外規 / 內規主條文來源

## `training_note_kb_rag.jsonl`
用途：
- 教育訓練補充資料來源

---

# 5.3 v2 正式資料核心

## `legal_kb_v2/regulation_versions.jsonl`
用途：
- v2 版本化法規記錄
- 目前已正式化第一批條文

## `legal_kb_v2/norm_extractions.jsonl`
用途：
- 把法規 / 案例抽成 subject / action / exception / legal_effect 等結構

## `legal_kb_v2/claim_validations.jsonl`
用途：
- 把最終可說出的重要結論拆成 claim，並標註支撐程度與風險旗標

## `legal_kb_v2/citation_graph.jsonl`
用途：
- 補強條文間 / FAQ 與法規間的共同適用、補充、定義依賴關係

## `legal_kb_v2/official_source_manifest.json`
用途：
- 記錄本批正式資料各自對應的來源型態與後續可補的官方來源

## `legal_kb_v2/first_batch_scope.md`
用途：
- 說明第一批正式化涵蓋哪些條目

---

# 5.4 v2 規格檔核心

這些檔案都在 `stakeholder-qa-rag-test/references/`：

## Phase 1 / 2
- `legal-kb-schema.md`
- `legal-source-filtering.md`
- `legal-query-decomposition.md`
- `query-normalization-rules.md`
- `evidence-answer-template.md`
- `acceptance-metrics.md`

## Phase 3
- `retrieval-strategy-v2.md`
- `legal-rerank-policy.md`
- `source-validation-checklist.md`

## Phase 4
- `norm-extraction-schema.json`
- `consistency-check-rules.md`
- `claim-validation-schema.json`

## Phase 5
- `human-review-checklist.md`
- `review-decision-policy.md`
- `final-answer-gating-rules.md`

## Phase 6
- `eval-design.md`
- `error-severity-policy.md`

用途：
- 這些是整個 v2 設計的治理說明書
- 不是第一線回答資料，而是 skill 行為與後續資料工程的基準規格

---

## 6. 第一批正式資料目前涵蓋哪些條目

目前已正式化的條目如下：

### 法規 / 內規
- `reg_004`：內規-交易查詢及判斷 第三條（概括授權）
- `reg_026`：內規-建檔及申報 第六條（建檔範圍）
- `reg_033`：內規-建檔及申報 第十三條（交易申報作業）
- `reg_037`：金管銀法字第11202738872號令（概括授權）
- `reg_039`：金融控股公司法 第四十五條
- `reg_040`：銀行法 第三十二條
- `reg_041`：銀行法 第三十三條
- `reg_042`：銀行法 第七十五條

### FAQ / 案例
- `faq_005`：股票禮品卡 > 5000 萬程序
- `faq_009`：捐贈給利害關係人的程序

### 這代表什麼
表示：
- 遇到這批問題時，skill 現在可以先走 v2 正式資料
- 不再只能依 v1 FAQ 或全文段落臨時拼裝
- 可以用 claim 驗證與 citation graph 輔助保守回答

---

## 7. 評測與樣板檔在哪裡

## 評測 schema
位置：
- `stakeholders QA assistant/evals/`

已有：
- `retrieval_eval_schema.json`
- `extraction_eval_schema.json`
- `answer_grounding_eval_schema.json`
- `high_risk_fail_policy.json`

## sample / template
- `sample_retrieval_cases.jsonl`
- `sample_extraction_cases.jsonl`
- `sample_answer_grounding_cases.jsonl`

用途：
- 後續擴充正式標註集
- 做 retrieval / extraction / answer grounding 測試
- 建立 hard fail 機制

---

## 8. 後續怎麼擴充

目前最建議的擴充順序如下。

# Step 1：擴充第二批正式資料

優先挑：
- 高風險條文
- 常問案例
- 需要共同適用的條文
- 親等 / 建檔 / 申報 / 董事會核決相關條文

### 建議下一批候選
- `faq_006`
- `faq_008`
- `faq_010`
- `faq_012`
- `reg_038`
- 其他與金融控股公司法第44條、第45條密切連動條文

### 擴充時要更新的檔
- `regulation_versions.jsonl`
- `citation_graph.jsonl`
- `norm_extractions.jsonl`
- `claim_validations.jsonl`
- `official_source_manifest.json`

---

# Step 2：補官方來源

目前部分條目仍保守標：
- `unconfirmed`
- `partially_confirmed`

若要提高可信度，建議逐步補：
- `official_url`
- `source_last_checked_at`
- 公布 / 施行 / 廢止日期
- query_valid_from / query_valid_to

這一步會讓 v2 真正接近「版本化法規資料庫」。

---

# Step 3：把更多題目納入 claim 驗證

每做一批正式化條目，就應同步補：
- 對應 `norm_extractions`
- 對應 `claim_validations`

原則：
> 不要只有條文資料，沒有可用於最終回答 gate 的 claim 資料。

---

# Step 4：擴充 eval 標註集

當正式條目累積到一定程度後，建議開始做：
- retrieval must-have / must-not-cite 標註
- extraction 欄位 gold label
- answer grounding 標註

如此才有辦法量化：
- Recall@20 / 50 / 100
- 各欄位 F1
- citation support rate
- unsupported claim rate
- wrong version rate

---

# Step 5：若未來要工程化

如果未來要真的接成系統或 pipeline，應再往下做：
- 正式向量索引
- 正式 BM25 index
- RRF 實作
- legal reranker
- claim validation 自動評分腳本
- review / gate 自動化流程

目前這些還是 **規格層 + 部分正式資料層**，尚不是完整自動系統。

---

## 9. 交接時最常見的誤解

### 誤解 1：v2 已經全量完成
不是。
目前是：
- v2 規格完整
- 第一批正式資料完成
- 但非全量法規庫

### 誤解 2：v1 可以直接當正式法源庫
不可以。
v1 可檢索、可回答，但仍需：
- 法源位階判斷
- 版本保守揭露
- FAQ / training 降權處理

### 誤解 3：FAQ 可以直接當法律結論
不可以。
FAQ 只能：
- 作案例參考
- 作程序輔助
- 或與正式條文共同使用

### 誤解 4：已有 claim validation 就代表 fully automated
不代表。
目前 claim validation 仍是資料與規格層成果，不是完整自動判分引擎。

---

## 10. 交接建議閱讀順序

如果是新接手的人，建議依這個順序看：

1. `stakeholder-qa-rag-test/SKILL.md`
2. `stakeholders QA assistant/legal_kb_v2/first_batch_scope.md`
3. `regulation_versions.jsonl`
4. `norm_extractions.jsonl`
5. `claim_validations.jsonl`
6. `citation_graph.jsonl`
7. `rag_optimized_output/retrieval_profiles.json`
8. `rag_optimized_output/retrieval_strategy.md`
9. `references/` 內各 phase 規格檔
10. `evals/` 內 schema 與 sample cases

---

## 11. 一句話交接摘要

如果要非常短地對同仁說明，可以用這句：

> 這個專案現在是「v1 可回答、v2 可治理」的混合架構；skill 會優先用 v2 正式資料，再回到 v1 補強，高風險法律題則必須經過 claim 驗證與保守回答 gate。

---

## 12. 本文件對應查證來源

- `stakeholder-qa-rag-test/SKILL.md`
- `stakeholders QA assistant/rag_optimized_output/retrieval_profiles.json`
- `stakeholders QA assistant/rag_optimized_output/retrieval_strategy.md`
- `stakeholders QA assistant/legal_kb_v2/first_batch_scope.md`
- `stakeholders QA assistant/legal_kb_v2/regulation_versions.jsonl`
- `stakeholders QA assistant/legal_kb_v2/citation_graph.jsonl`
- `stakeholders QA assistant/legal_kb_v2/norm_extractions.jsonl`
- `stakeholders QA assistant/legal_kb_v2/claim_validations.jsonl`
- `stakeholders QA assistant/legal_kb_v2/official_source_manifest.json`
- `stakeholders QA assistant/legal_kb_v2/review_policy.json`
- `stakeholders QA assistant/evals/retrieval_eval_schema.json`
- `stakeholders QA assistant/evals/extraction_eval_schema.json`
- `stakeholders QA assistant/evals/answer_grounding_eval_schema.json`
- `stakeholders QA assistant/evals/high_risk_fail_policy.json`
