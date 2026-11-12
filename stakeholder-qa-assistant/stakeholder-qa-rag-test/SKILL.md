---
name: stakeholder-qa-rag-test
description: 回答或整理 stakeholders QA assistant 相關問題的專用技能。當使用者要查詢、彙整、比對、解釋、摘要或引用本專案中「利害關係人」教材、外部法規、內部規章、FAQ、系統操作手冊內容時，務必使用此 skill。尤其是涉及金控法第45條、利害關係人交易判斷、授信/授信外交易、建檔及申報範圍、實務案例分析、系統操作流程、FAQ 比對、RAG 驗證，或需要先拆法律要素、再做法域/日期/效力判斷、再依正式化法源資料與既有 RAG 資料交叉回答的題目，應優先使用本 skill。若問題涉及永豐集團、永豐金控與子公司、或子公司間交易，必須先依既定集團架構判斷交易主體是否屬金控及子公司或子公司間交易，再進入法規分析；且只能依既有資料回答，不得自行補充未載明要件。
user-invocable: true
---

# Stakeholder QA RAG Test

此 skill 用於回答本專案 `stakeholders QA assistant` 資料集相關問題。

目前採 **v1 檢索 + v2 正式資料優先** 的過渡架構：
1. **先拆法律要素**
2. **再做法域 / 日期 / 效力判斷**
3. **優先查 v2 正式化資料（若該題已涵蓋）**
4. **不足時再回 v1 RAG JSONL 與原始參考資料**
5. **高風險法律題需做 claim 驗證、人工覆核思維與最終 gate**

> 重要：本 skill 仍不得憑常識補法律要件。
> 若 v2 正式資料未覆蓋、或 v1 / v2 皆不足以完成版本、效力、例外或共同適用判斷，必須明確說明限制，不得自行補完。

---

## 一、適用資料來源

### A. v2 正式化資料（若有覆蓋，優先使用）
- `stakeholders QA assistant/legal_kb_v2/regulation_versions.jsonl`
- `stakeholders QA assistant/legal_kb_v2/citation_graph.jsonl`
- `stakeholders QA assistant/legal_kb_v2/norm_extractions.jsonl`
- `stakeholders QA assistant/legal_kb_v2/claim_validations.jsonl`
- `stakeholders QA assistant/legal_kb_v2/official_source_manifest.json`
- `stakeholders QA assistant/legal_kb_v2/review_policy.json`
- `stakeholders QA assistant/legal_kb_v2/first_batch_scope.md`

### B. 現行回答主資料（v1，仍可回退使用）
- `stakeholders QA assistant/rag_optimized_output/system_operation_kb_rag.jsonl`
- `stakeholders QA assistant/rag_optimized_output/faq_case_kb_rag.jsonl`
- `stakeholders QA assistant/rag_optimized_output/regulation_kb_rag.jsonl`
- `stakeholders QA assistant/rag_optimized_output/training_note_kb_rag.jsonl`
- `stakeholders QA assistant/rag_optimized_output/retrieval_profiles.json`
- `stakeholders QA assistant/rag_optimized_output/retrieval_strategy.md`

### C. 既有補充參考
- `references/group-structure.md`
- `references/kinship-scope-chart.md`
- `references/retrieval-strategy.md`
- `references/test-prompts.md`

### D. v2 規格 / 回答治理 / 評測規格
- `references/legal-kb-schema.md`
- `references/legal-source-filtering.md`
- `references/legal-query-decomposition.md`
- `references/query-normalization-rules.md`
- `references/retrieval-strategy-v2.md`
- `references/legal-rerank-policy.md`
- `references/source-validation-checklist.md`
- `references/norm-extraction-schema.json`
- `references/consistency-check-rules.md`
- `references/claim-validation-schema.json`
- `references/human-review-checklist.md`
- `references/review-decision-policy.md`
- `references/final-answer-gating-rules.md`
- `references/evidence-answer-template.md`
- `references/acceptance-metrics.md`
- `references/eval-design.md`
- `references/error-severity-policy.md`

若上述必要檔案不存在，先明確告知缺少哪個檔案，再停止推論。

---

## 二、核心原則

1. **先拆法律要素，再檢索。** 不可看到關鍵詞就直接查條文。
2. **先做法域 / 日期 / 效力判斷，再引用法源。**
3. **v2 正式化資料優先，v1 作補充與回退。**
4. **外規優先，內規補充；FAQ 與教育訓練只能作輔助。**
5. **圖示與整理資料只能輔助判斷，不得單獨作最終法規結論。**
6. **若問題涉及永豐集團，先做集團主體判斷。** 必須先依 `references/analysis-policy.md` 之「## 集團架構與既定前提（分析前置條件）」確認行為主體、相對人是否屬永豐金控、其子公司，或子公司間交易；不得將「永豐集團」概括視為單一主體。
7. **法規與函釋適用前，必須核對主體歸屬。** 對外部法規、函釋、內規與 FAQ 的適用，需特別注意其規範主體是否確實屬於集團內公司，以及是金控對子公司、子公司對金控，或子公司彼此間之交易關係。
8. **明確列舉之外規門檻，優先於概括性案例類推。** 若已命中主管機關函令明確列舉之主體範圍、交易類型與金額門檻，應先依該明確規則回答，不得先以較一般、較舊或較抽象之 FAQ、教育訓練或類推案例覆蓋其結論。
9. **若涉及金控與其100%子公司或100%子公司間交易，須先檢查 112.12.07 金管銀法字第11202738872號令第一點第（十三）款。** 亦即先確認是否屬「除涉及股權性質之有價證券交易外，金融控股公司與其直接或間接持股百分之百之子公司及該直接或間接持股百分之百子公司間單筆交易金額未超過新臺幣伍仟萬元之交易」；命中時，原則上應優先視為概括授權分析路徑。
10. **若資料不足，必須保守回答。** 可說「目前無法確定」或「提供的資料中沒有相關資訊。」
11. **最終對使用者呈現來源時，只列原始檔名稱，不列 JSONL、chunk id、chunk path。**
12. **高風險法律題不得跳過驗證思維。** 至少檢查主體、要件、例外、法源位階、版本狀態與 claim 支撐度。

---

## 三、回答前固定流程

回答前依序執行：

### Step 1：先判斷題型
分成四類：

#### A. 系統操作題
例如：
- 如何查詢關係人
- 如何新增親屬
- 如何解除申報資料

#### B. 法規案例題
例如：
- 某交易是否構成利害關係人交易
- 是否需提董事會
- 是否屬概括授權

#### C. 純法規 / 制度規範題
例如：
- 金控法第45條第2項有哪些交易類型
- 哪些交易可概括授權
- 哪些情況需要申報

#### D. 親等 / 申報範圍題
例如：
- 配偶的兄弟姊妹算不算
- 岳父母 / 公婆算幾姻
- 哪些業別要納入申報範圍

若問題同時含系統操作與法規判斷，先判斷主問題；若主問題不明，先簡短確認，或先處理風險較高的法規判斷前提。

### Step 2：拆法律要素
依 `references/legal-query-decomposition.md` 至少拆出：
- 爭點 `issue`
- 法域 `law_domain`
- 查詢日期 `query_date`
- 主體 `subject`
- 相對人 `counterparty`
- 行為 `action`
- 客體 `object`
- 規範型態 `modality`
- 成立要件 `conditions`
- 例外 / 但書 `exceptions`
- 期限 `deadlines`
- 法律效果 `legal_effects`
- 責任 `liabilities`

若問題涉及永豐集團，於本步驟額外先拆：
- 是否為永豐金控本身
- 是否為永豐金控之子公司
- 是否為子公司間交易
- 各主體是否確實屬 `references/analysis-policy.md` 所列集團架構範圍

### Step 3：正規化問題
依 `references/query-normalization-rules.md`：
- 保留原始問句
- 統一正式術語
- 補足主體 / 行為 / 客體候選詞
- 保留否定詞、但書詞、例外詞
- 產生擴展關鍵詞

### Step 4：做法源過濾
依 `references/legal-source-filtering.md`：
1. 判斷法域
2. 判斷查詢日期
3. 判斷效力狀態是否可確認
4. 先核對法規、函釋、內規或 FAQ 所指規範主體，與個案中的主體是否一致，特別是是否屬永豐金控、其子公司，或子公司間交易
5. 若屬永豐金控與其100%子公司、或100%子公司間交易，先檢查是否直接命中 `外規-銀` 所載 112.12.07 金管銀法字第11202738872號令第一點第（十三）款之主體範圍、交易性質與 5,000 萬元門檻
6. 決定可用資料層級

#### 過濾結果分三種
- `applied`：有足夠資料完成法域 / 日期 / 效力判斷
- `partially_applied`：僅能部分判斷
- `not_possible`：資料不足，無法完成版本 / 效力過濾

若為高風險法規題且 `not_possible`，原則上不得下確定結論。

### Step 5：先查 v2 正式化資料是否有覆蓋
優先檢查：
- `regulation_versions.jsonl`
- `norm_extractions.jsonl`
- `claim_validations.jsonl`
- `citation_graph.jsonl`

#### v2 使用原則
- 若問題可直接對應到 v2 已正式化條目，**優先依 v2 條目、抽取與 claim 驗證回答**。
- 若 v2 條目只覆蓋部分問題，則：
  - 以 v2 作核心法源骨架
  - 再回查 v1 補足細節
- 若 v2 無對應條目，再回到 v1 流程。

### Step 6：不足時再進入既有 v1 檢索
本階段仍使用 v1 檔案補強，不可假裝已完成完整版本法規庫重建。

### Step 7：高風險法律題做驗證與回答 gate 思維
若涉及：
- 禁止規定
- 重大交易
- 董事會核決
- 申報義務
- 責任或法律效果
- 利害關係人交易成立與否

則回答前至少參照：
- `references/source-validation-checklist.md`
- `references/consistency-check-rules.md`
- `references/human-review-checklist.md`
- `references/review-decision-policy.md`
- `references/final-answer-gating-rules.md`

若關鍵 claim 仍屬 `unsupported` / `uncertain` / `version unconfirmed`，應改採保守回答。

---

## 四、各題型檢索路徑

### A. 系統操作題
優先：
- `system_operation_kb_rag.jsonl`

回答時只能依操作手冊內容與既有系統條目作答，不得補充手冊未載明的實務作法。

### B. 法規案例題
優先順序：
1. 若涉及永豐集團，先查 `references/analysis-policy.md` 的「## 集團架構與既定前提（分析前置條件）」確認是否為金控及子公司或子公司間交易
2. 若屬永豐金控與其100%子公司、或100%子公司間交易，優先檢查 `外規-銀` / `regulation_versions.jsonl` / `norm_extractions.jsonl` 中 112.12.07 金管銀法字第11202738872號令第一點第（十三）款是否已直接命中；命中時，應先以概括授權路徑分析
3. 若 v2 已正式化，先查 `claim_validations.jsonl`、`norm_extractions.jsonl`、`regulation_versions.jsonl`
4. 若需確認公司架構、主體層級、直接/間接持股、是否同屬 100% 體系，查 `references/group-structure.md`
5. 再查 `faq_case_kb_rag.jsonl`
6. 若 FAQ 不足，再查 `regulation_kb_rag.jsonl`
7. 最後才用 `training_note_kb_rag.jsonl` 補充提醒

FAQ 僅在相似性足夠時才能當優先案例，不足時不得直接套用。

### C. 純法規 / 制度規範題
優先順序：
1. 若 v2 已正式化，先查 `regulation_versions.jsonl`、`norm_extractions.jsonl`
2. `regulation_kb_rag.jsonl`
3. `training_note_kb_rag.jsonl`

回答時應以外規優先、內規補充；若兩者有差異，須指出差異。

### D. 親等 / 申報範圍題
優先順序：
1. 若 v2 已正式化，先看是否已有對應 claim / extraction
2. `references/kinship-scope-chart.md`
3. `faq_case_kb_rag.jsonl`
4. `regulation_kb_rag.jsonl`
5. `training_note_kb_rag.jsonl`
6. 如涉及系統建檔流程，再補查 `system_operation_kb_rag.jsonl`

注意：`kinship-scope-chart.md` 只用於關係路徑與幾血/幾姻輔助判斷，不得單獨當最終法規結論。

---

## 五、v2 正式化資料的使用方法

### A. `regulation_versions.jsonl`
用來回答：
- 條文主文
- 版本日期線索
- 法規位階
- 例外 / 但書 / 補充規範

### B. `norm_extractions.jsonl`
用來回答：
- 主體是誰
- 規範型態是應為 / 不得為 / 得為 / 定義 / 程序
- 成立要件與例外
- 期限、法律效果、責任

### C. `claim_validations.jsonl`
用來檢查：
- 你準備寫出的具體結論是否已被支持
- 是否有 `risk_flags`
- 是否只能保守表述

### D. `citation_graph.jsonl`
用來判斷：
- 哪些條文需共同適用
- FAQ 是否只能補充、不能單獨下結論
- 哪些內規需由外規補足

---

## 六、檢索方法

### 1. 先用 `grep` 找候選
優先搜尋欄位對應文字：
- `title`
- `title_aliases`
- `keywords`
- `law_refs`
- `retrieval_text_sparse`
- `retrieval_text_dense`
- `content`
- `claim_text`
- `notes`

### 2. 再用 `read` 精讀命中內容
不要一開始整份讀完大型 JSONL。

### 3. 檢索時要保留的重要訊號
- 條號
- 主體
- 主體是否屬永豐金控、其子公司，或子公司間交易
- 客體
- 交易類型
- 規範型態（應為 / 不得為 / 得為 / 權利 / 定義 / 程序）
- 例外 / 但書
- 期限
- 法律效果 / 責任
- 版本或修正線索
- 是否為 `supported / partially_supported / uncertain`

---

## 七、v1 / v2 混用時的保守規則

### 若 v2 有正式條目
可優先依 v2 的：
- `version_status`
- `conditions`
- `exceptions`
- `legal_effect`
- `claim support`

若 v2 或外規已明確列出可直接適用之主體範圍、交易類型與金額門檻，例如 112.12.07 金管銀法字第11202738872號令第一點第（十三）款，則應優先依該明確規則判斷，不得先用較一般的 IT 整合、共同採購、共同參與交易或其他類推案例，把案件改判為非概括授權。

若個案同時可能落入較一般的案例型描述（如 IT 整合、共同採購、費用分攤）與較明確的主管機關列舉門檻規則，應以後者優先，不得以前者排除概括授權之適用。
### 若 v2 沒有正式條目或只覆蓋部分內容
則須回 v1 補強，但仍要明說：
- 本次部分依 v2 正式化資料
- 部分依既有 v1 條文 / FAQ / 手冊補充
- 若版本或例外未能完整確認，結論僅能保守表述

### 若只剩 v1 可用
由於 v1 雖可利用部分欄位：
- `law_name`
- `article_key`
- `article_display`
- `law_refs`
- `citation`
- `source_priority`
- `doc_level`
- `source_type`
- `content`

但若缺少：
- `official_url`
- `promulgation_date`
- `effective_date`
- `repeal_date`
- `version_status`
- `query_valid_from / query_valid_to`

則**不得宣稱已完成完整版本法源驗證**。回答時應明講：
- 本次係依現有整理資料與條文內容作保守判斷
- 版本效力未必已完整驗證
- 若時間點不同，適用結論可能改變

---

## 八、回答規則

### A. 系統操作題
- 只依操作手冊回答
- 以步驟整理
- 不得補充手冊未載明的操作
- 若查無資料，可回：
  - `抱歉，檔案中未包含相關資訊，建議洽詢法遵處，謝謝您。`

### B. 法規案例題
輸出順序：
1. 初步結論
2. 適用前提
3. 後續分析與說明
4. 例外 / 但書
5. 法源依據
6. 資訊不足或待確認事項

若使用者未要求長文，盡量控制在精簡、可核對的長度。

### C. 純法規 / 制度規範題
依 `references/evidence-answer-template.md`，至少交代：
- 問題重述
- 規範摘要
- 適用前提
- 例外與但書
- 法源依據
- 資訊不足處

### D. 親等 / 申報範圍題
建議順序：
1. 先回答關係路徑
2. 再回答幾血 / 幾姻
3. 再區分金控 / 銀行 / 證券等是否納入
4. 若要正式建檔或法規適用，必須再回正式資料確認

---

## 九、共通禁止事項

1. 不得引用不存在的條文。
2. 不得把 FAQ 直接當成本案結論，除非相似性足夠，且已與正式法源核對。
3. 不得讓教育訓練資料凌駕正式外規 / 內規。
4. 不得把圖示整理當成最終法規結論。
5. 不得在已命中明確外規門檻時，仍以較抽象、較舊或較一般化的案例事實類推，推翻外規明文可得之概括授權結論。
6. 不得將較一般的 IT 整合、共同採購、費用分攤或共同參與交易案例，優先於已直接命中的主管機關列舉門檻規則。
7. 不得因常識補上資料未載明的要件、例外、責任或罰則。
7. 不得把條文內的修正日期線索，誤當成完整版本效力驗證結果。
8. 不得把 `partially_supported` / `uncertain` 的 claim 包裝成完全確定結論。

---

## 十、查無資料或驗證不足時的處理

若檢索後沒有足夠依據：
- 先明說：`提供的資料中沒有相關資訊。`
- 若屬操作題，可改用：
  - `抱歉，檔案中未包含相關資訊，建議洽詢法遵處，謝謝您。`
- 若屬法規題或案例題：
  - 不得硬下結論
  - 應明說目前資料不足、法域不明、版本效力未能完整確認、例外未能核實，或尚難判定

若 review / gate 思維下屬：
- `cannot_determine`
- 或關鍵 gate 未通過

則建議改答：
- `目前無法確定。`
- `依現有資料尚難作成確定判斷。`

---

## 十一、來源呈現規則

最終對使用者只列原始檔名稱，例如：
- `(金控)利害關係人教育訓練.pdf`
- `外規-銀.pdf`
- `內規-交易查詢及判斷.pdf`
- `內規-建檔及申報.pdf`
- `利害關係人常見問答集-更新.docx`
- `金控利害關係人管理系統操作手冊 -貳、查詢篇.docx`

不要顯示：
- JSONL 路徑
- chunk id
- chunk path
- markdown path
- 切塊檔名
- internal record_id / claim_id / extraction_id

---

## 十二、送出前檢查

送出前確認：
- 是否已先拆法律要素
- 若涉及永豐集團，是否已先依 `references/analysis-policy.md` 的「## 集團架構與既定前提（分析前置條件）」確認主體歸屬
- 是否已先做法域 / 日期 / 效力判斷
- 是否已核對法規、函釋、內規或 FAQ 的規範主體與個案主體一致
- 若屬永豐金控與其100%子公司、或100%子公司間交易，是否已先檢查 112.12.07 金管銀法字第11202738872號令第一點第（十三）款
- 是否先查過 v2 正式資料是否有覆蓋
- 是否清楚揭露這次是用 v2、v1，或兩者混用
- 是否把 FAQ / 教育訓練 / 圖示放在正確層級
- 是否在命中明確外規門檻時，誤用較一般化案例或補充資料推翻其結論
- 是否漏掉主體、例外、但書、期限或法律效果
- 是否有任何結論未被法源支持
- 是否有高風險 claim 仍屬 uncertain 卻寫成肯定語氣
- 是否只呈現原始檔名稱，而未顯示 JSONL / chunk / 切塊資訊

---

## 十三、建議回歸測試 Prompt

### 測試 1：100% 子公司間、5,000 萬以下，應優先走概括授權
**Prompt**
> 永豐銀行及永豐金證券共同採購資訊系統，與外部資訊廠商簽署同一份合約，契約總金額1,000萬元，永豐銀行分攤600萬元，永豐金證券分攤400萬元。請問此交易是否屬概括授權交易？相關程序為何？

**預期驗證點**
- 先辨識永豐銀行、永豐金證券均屬永豐金控 100% 子公司。
- 先檢查 112.12.07 金管銀法字第11202738872號令第一點第（十三）款，而非先用一般 IT 整合或共同採購案例覆蓋。
- 若確認非屬股權性質之有價證券交易，且單筆交易金額未超過 5,000 萬元，應優先走概括授權分析路徑。
- 回答中應明確說明：命中第（十三）款後，不應再先以較一般案例把案件改判為非概括授權。

### 測試 2：避免一般案例錯誤覆蓋明確外規門檻
**Prompt**
> 永豐金控100%持股的兩家子公司共同向外部廠商採購軟體服務，契約總金額2,000萬元。雖然這看起來像IT整合或費用分攤案件，但是否仍應先適用112.12.07金管銀法字第11202738872號令第一點第（十三）款判斷是否屬概括授權？

**預期驗證點**
- 應明確回答：是，必須先檢查第（十三）款。
- 不得先以「IT整合通常屬重大交易」之類一般化敘述直接下結論。
- 應強調：當案件同時可能符合一般案例描述與明確列舉門檻時，應以後者優先。
- 應保留必要前提：仍須確認是否為非股權性質之有價證券交易，以及主體確屬100%持股體系。

## 十四、補充資源

- `references/legal-kb-schema.md`
- `references/legal-source-filtering.md`
- `references/legal-query-decomposition.md`
- `references/query-normalization-rules.md`
- `references/retrieval-strategy-v2.md`
- `references/legal-rerank-policy.md`
- `references/source-validation-checklist.md`
- `references/norm-extraction-schema.json`
- `references/consistency-check-rules.md`
- `references/claim-validation-schema.json`
- `references/human-review-checklist.md`
- `references/review-decision-policy.md`
- `references/final-answer-gating-rules.md`
- `references/evidence-answer-template.md`
- `references/acceptance-metrics.md`
- `references/eval-design.md`
- `references/error-severity-policy.md`
- `references/group-structure.md`
- `references/kinship-scope-chart.md`
- `references/retrieval-strategy.md`
- `references/test-prompts.md`
