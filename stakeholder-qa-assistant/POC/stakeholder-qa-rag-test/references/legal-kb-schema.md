# Legal KB Schema v2（Phase 1 規格骨架）

此檔定義 **版本化、可追溯法規資料庫** 的目標欄位與最低治理要求。

> 目前狀態：**僅建立 v2 規格骨架，不重建既有 v1 JSONL。**
> 現行 skill 執行時，仍以工作區既有 `rag_optimized_output/*.jsonl` 為主；若 v1 資料缺少某些 v2 必要欄位，回答時必須明確標示「無法確認」而非自行補完。

---

## 一、設計目標

法規庫應同時滿足：

1. **可信**：能追到官方來源與更新時間。
2. **可追溯**：每個結論能回扣到具體法規版本與條文位置。
3. **可版本化**：同一法規不同時間點可並存，不以覆蓋方式更新。
4. **可過濾**：檢索前能依法域、查詢日期、效力狀態篩選。
5. **可驗證**：能檢查但書、例外、授權依據、責任條文是否完整。

---

## 二、核心實體

### 1. Article Record
每一筆法規條文或規範單元至少應是一筆 record。

### 2. Version Record
同一法規不同版本應有不同 `version_id`，不可只留最新版本。

### 3. Citation Graph
法條間引用、授權、上下位法關係應可單獨儲存，避免只留在自然語言文字中。

---

## 三、建議欄位

以下欄位為 v2 目標欄位。若某欄位暫無資料，應明確留空，不可虛構。

```json
{
  "record_id": "",
  "version_id": "",
  "law_domain": "",
  "regulator": "",
  "jurisdiction": "",
  "law_name": "",
  "article": "",
  "paragraph": "",
  "subparagraph": "",
  "item": "",
  "article_display": "",
  "version_status": "effective|historical|repealed|pending|unconfirmed",
  "promulgation_date": "",
  "effective_date": "",
  "repeal_date": "",
  "query_valid_from": "",
  "query_valid_to": "",
  "hierarchy_level": "constitution|statute|regulation|order|internal_rule|faq|training_note|reference",
  "parent_law": [],
  "delegation_basis": [],
  "cross_references": [],
  "definitions": [],
  "conditions": [],
  "exceptions": [],
  "provisos": [],
  "supplementary_provisions": [],
  "official_url": "",
  "official_source_text": "",
  "source_last_checked_at": "",
  "updated_at": "",
  "content": "",
  "citation": {},
  "keywords": [],
  "retrieval_text_sparse": "",
  "retrieval_text_dense": ""
}
```

---

## 四、欄位說明

### 基本識別
- `record_id`：條文單元唯一識別碼。
- `version_id`：同一法規不同版本的唯一識別碼。
- `law_name`：法規名稱。
- `article / paragraph / subparagraph / item`：條、項、款、目拆解欄位。
- `article_display`：顯示用完整條號。

### 法源與管轄
- `law_domain`：法域，例如金控、銀行、證券、個資、公司治理等。
- `regulator`：主管機關。
- `jurisdiction`：法域/司法轄區。
- `hierarchy_level`：法規位階或資料層級。

### 版本與效力
- `version_status`：
  - `effective`：查詢日有效
  - `historical`：歷史版本
  - `repealed`：已廢止
  - `pending`：已公布未生效或待定
  - `unconfirmed`：現階段資料不足，無法確認
- `promulgation_date`：公布日期
- `effective_date`：施行日期
- `repeal_date`：廢止日期
- `query_valid_from / query_valid_to`：供查詢系統直接比較的有效區間

### 法理結構
- `parent_law`：上位法或母法
- `delegation_basis`：授權依據
- `cross_references`：引用條文
- `definitions`：定義條款
- `conditions`：成立要件
- `exceptions`：例外
- `provisos`：但書
- `supplementary_provisions`：附則/附帶規定

### 可追溯性
- `official_url`：官方來源網址
- `official_source_text`：官方來源之關鍵標識或擷取片段
- `source_last_checked_at`：最後查核時間
- `updated_at`：本地資料更新時間
- `citation`：來源檔案、章節、頁碼、段落等定位資訊

---

## 五、最低治理規則

1. **不得只保存最新版本。**
2. **不得把歷史版本與現行版本混成同一筆。**
3. **若無法確認效力狀態，必須標 `unconfirmed`。**
4. **若無官方來源網址，需明確標示為非官方整理資料。**
5. **但書、例外、責任條文不得只放在自由文字中，應可結構化抽取。**

---

## 六、v1 → v2 相容映射（暫行）

在 v2 尚未重建前，可暫時從 v1 既有欄位推估部分欄位，但只能做「保守推估」，不可假裝已完整版本化：

- `law_name` ← v1 `law_name`
- `article_display` ← v1 `article_display` 或 `article_key`
- `hierarchy_level` ← 依 `doc_level` / `source_type` 粗分
- `cross_references` ← v1 `law_refs`
- `citation` ← v1 `citation`
- `content` ← v1 `content`
- `version_status` ← 若 v1 僅有條文內嵌「某年某月某日修正」而無完整版本區間，原則上標 `unconfirmed`

---

## 七、Phase 1 限制

本階段僅建立規格骨架，因此：

- 尚未建立完整歷史版本法規庫
- 尚未建立正式 citation graph 檔
- 尚未建立官方來源批次更新流程
- skill 可要求先做法域/日期/效力判斷，但遇到 v1 資料不足時，必須明講限制

---

## 八、後續建議產物

後續如進入資料重建階段，建議新增：

- `legal_kb_v2/regulation_versions.jsonl`
- `legal_kb_v2/citation_graph.jsonl`
- `legal_kb_v2/official_source_manifest.json`
- `legal_kb_v2/authority_index.json`
