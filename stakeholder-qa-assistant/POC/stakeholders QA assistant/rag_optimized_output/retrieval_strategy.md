# RAG 最適化版 JSONL + 檢索策略建議

## 1. 產出檔案
- `system_operation_kb_rag.jsonl`：29 筆
- `faq_case_kb_rag.jsonl`：12 筆
- `regulation_kb_rag.jsonl`：42 筆
- `training_note_kb_rag.jsonl`：9 筆
- `all_kb_rag.jsonl`：92 筆
- `retrieval_profiles.json`

## 2. 本次 RAG 最適化重點
1. 為每筆資料新增 `source_priority`、`route_target`、`title_aliases`、`applicable_entity`、`transaction_type`、`law_refs` 等欄位。
2. 每筆同時提供：
   - `retrieval_text_dense`：適合向量檢索
   - `retrieval_text_sparse`：適合 BM25 / 關鍵字檢索
3. FAQ 類資料新增：
   - `case_match_keys`
   - `conclusion_hint`
   - `case_use_rule`
4. 法規類資料新增：
   - `article_key`
   - `doc_level`
   - `use_priority_rule`
5. 教育訓練類資料標記為 `supplement_only`，避免覆蓋正式法源。

## 3. 建議檢索路由

### A. 系統操作 QA 小幫手
**觸發詞**：如何、怎麼、查詢、批次、新增、解除、權限、畫面、系統

**檢索來源**：
1. `system_operation_kb_rag.jsonl`

**建議參數**：
- sparse top-k: 8
- dense top-k: 5
- rerank 後輸出: 3

**回答規則**：
- 僅使用系統操作手冊
- 優先輸出步驟
- 若查無內容，回覆固定 fallback

### B. 法規案例 QA 小幫手（案例優先）
**觸發詞**：是否構成、利害關係人交易、董事會、概括授權、法規、條文、授信、捐贈、交易申報

**檢索順序**：
1. `faq_case_kb_rag.jsonl`
2. `regulation_kb_rag.jsonl`
3. `training_note_kb_rag.jsonl`

**建議參數**：
- FAQ：dense 6 / sparse 8
- Regulation：dense 6 / sparse 8
- Training：dense 2 / sparse 3
- rerank 後整體輸出: 4

**FAQ 套用門檻**：
至少符合下列 3 項中的 2 項：
- `entity_type`
- `transaction_type`
- `law_refs`

若未達門檻，FAQ 僅作參考，不應直接套用結論。

### C. 純法規/制度問答
**適用問題**：
- 某條文規定是什麼？
- 哪些情況需董事會重度決議？
- 哪些交易可概括授權？

**檢索順序**：
1. `regulation_kb_rag.jsonl`
2. `training_note_kb_rag.jsonl`

**回答規則**：
- 外規優先
- 內規補充
- 若有差異需指出差異

### D. 親等 / 申報範圍問題
**檢索順序**：
1. FAQ（尤其親等/範例型案例）
2. 內外規申報範圍
3. 教育訓練補充說明

## 4. 排序建議
最終排序分數可考慮：
- `final_score = semantic_score * 0.55 + keyword_score * 0.30 + metadata_match * 0.15`

其中 `metadata_match` 可依下列加分：
- entity_type 相符：+0.05
- transaction_type 相符：+0.05
- law_refs 有交集：+0.05

## 5. Answer Generation Guardrails
1. **系統操作題**：不得依模型常識補步驟。
2. **法規案例題**：
   - 先下初步結論，再分析。
   - FAQ 僅在相似性足夠時套用。
   - 外規高於內規，高於教育訓練。
3. **查無明確依據時**：必須明示「提供的資料中沒有相關資訊」或既定 fallback。
4. **教育訓練資料**：不得單獨作為推翻外規/內規/FAQ 的依據。

## 6. 實作建議
若要正式上線，建議你的 RAG pipeline 至少做：
1. Query Router
2. Hybrid Search（dense + sparse）
3. Metadata Filter
4. Cross-encoder / reranker
5. Answer Generator with source-priority rules

## 7. 建議實務設定
- Embedding：使用繁中表現穩定之 embedding model
- Chunk 單位：目前以「一筆 SOP / 一條法規 / 一則 FAQ 案例」為主，已適合第一版上線
- 後續可再優化：
  - FAQ 補 `entity_type` 人工校正
  - 法規條次人工校正
  - 親等題獨立建立 `kinship_kb.jsonl`
