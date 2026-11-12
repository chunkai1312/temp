# Retrieval Strategy v2（Phase 3 規格骨架）

此檔定義 v2 檢索流程的目標架構：在不更動現有 v1 資料的前提下，先建立 **全文/向量雙路召回 → RRF 融合 → 法律重排 → 法源逐項驗證** 的規格。

> 目前狀態：**僅建立 v2 檢索規格骨架，不重建舊資料，不要求現階段真正接上向量索引或法律模型。**

---

## 一、設計目標

v2 檢索流程要解決四類常見錯誤：

1. **只靠關鍵字，漏掉口語問法**
2. **只靠語意相似，抓到錯法域或錯條號**
3. **只找主文，漏掉但書、例外、責任條文**
4. **找到條文卻未逐項驗證，導致結論超出法源支持範圍**

因此，檢索流程分四層：

1. **Pre-filter**：法域 / 日期 / 效力 / 資料層級過濾
2. **Dual Retrieval**：BM25 / sparse + semantic / dense 雙路召回
3. **Fusion + Rerank**：RRF 融合後，再用法律重排縮小候選
4. **Source Validation**：逐項檢查法源是否真的支持結論

---

## 二、總流程

```text
使用者問題
  ↓
法律要素拆解（issue / subject / action / object / modality / exceptions ...）
  ↓
法域 / 日期 / 效力 / 資料層級過濾
  ↓
全文檢索（BM25 / sparse）
  +
向量檢索（dense / semantic）
  ↓
RRF 融合
  ↓
法律重排（legal rerank）
  ↓
逐項法源驗證（source validation）
  ↓
證據式回答 / 或保守回答「目前無法確定」
```

---

## 三、Pre-filter（檢索前過濾）

檢索前必須先依 `references/legal-source-filtering.md` 形成至少以下判斷：

- `law_domain`
- `query_date`
- `requested_time_scope`
- `source_tiers_allowed`
- `version_filter_status`

### 過濾目的
在召回前先排除：
- 錯法域
- 明顯不適用的資料層級
- 已失效或無法確認效力的條文（若可判定）
- 不應優先依賴的 FAQ / 教育訓練資料

### Phase 3 現況限制
由於 v1 仍缺完整版本欄位，現階段多數情況只能做到：
- `applied` 或 `partially_applied`
- 部分情況只能 `not_possible`

因此，v2 規格必須允許「檢索可做，但回答時揭露限制」。

---

## 四、Dual Retrieval（雙路召回）

### A. 全文檢索（BM25 / sparse）

適合抓：
- 法規名稱
- 條號
- 精確術語
- 否定詞
- 但書詞
- 例外詞
- 特定主體/客體名稱

### B. 向量檢索（dense / semantic）

適合抓：
- 口語問法
- 同義詞
- 未使用正式法學術語的問題
- 近義的交易、義務、流程表述

### C. 雙路並行原則
- 不可只依賴 sparse
- 不可只依賴 dense
- 兩路都應保留各自前段候選，再進融合

### D. 初始候選建議
- sparse top_k：20～50
- dense top_k：20～50
- 合併候選總量：50～100

這是為了降低「過早漏掉關鍵法條」的風險。

---

## 五、RRF 融合（Reciprocal Rank Fusion）

### 目的
融合 sparse 與 dense 各自的排序優勢，避免過早偏向單一路徑。

### 基本想法
若某條文在 sparse 與 dense 都表現不錯，排名應被提升；
若只在單一路徑高分，仍可保留，但不宜過早壓過雙方都命中的候選。

### 建議公式
可概念性採用：

```text
RRF score = Σ 1 / (k + rank_i)
```

其中 `k` 為平滑常數，可先用固定值，例如 60。

### 現階段要求
本階段只需把 RRF 視為 **目標融合策略**；若執行環境尚未有真實檢索服務，可先以規格方式描述，不要求實算。

---

## 六、法律重排（Legal Rerank）

RRF 後的候選通常仍過多，需再縮至約 10～20 筆候選法源。

### 重排目的
重排不只看語意相似，而是要判斷：
- 是否真在處理同一法律爭點
- 是否屬正確主體 / 客體
- 是否為正確法域
- 是否含成立要件、例外、責任
- 是否需與其他條文共同適用

### 候選保留數建議
- rerank input：50～100
- rerank output：10～20

### 現階段可接受的 fallback
若尚未接法律領域模型，可先採：
- 條號命中加權
- 主體 / 客體一致加權
- 法域一致加權
- 有例外 / 但書 / 責任條文者加權
- 上下位法 / 引用關係加權

但回答時不可把這種 heuristic 說成已使用正式法律模型重排。

---

## 七、法源逐項驗證（Source Validation）

重排完成後，不可直接回答，必須逐項驗證法源是否支撐要回答的內容。

### 至少要驗證的項目
1. 主體是否正確
2. 相對人 / 客體是否正確
3. 行為類型是否正確
4. 規範型態是否正確（應為 / 不得為 / 得為 / 權利）
5. 成立要件是否完整
6. 例外 / 但書是否已查核
7. 責任或法律效果是否真適用
8. 版本與效力是否可確認

### 驗證結果分級
- `supported`：法源明確支持
- `partially_supported`：只支持部分
- `unsupported`：法源不支持
- `uncertain_due_to_version`：版本效力未能確認
- `uncertain_due_to_missing_facts`：事實不足

若關鍵結論是 `unsupported` 或 `uncertain_due_to_version`，不得下確定結論。

---

## 八、資料層級優先序

回答時仍遵守：
1. 外部法規 / 官方法令 / 主管機關函令
2. 內規
3. FAQ
4. 教育訓練
5. 圖示 / 輔助整理

### 重要原則
- FAQ 可作案例比對，不可取代正式法源
- 教育訓練不可推翻法規或內規
- 圖示不可單獨形成法規結論

---

## 九、Phase 3 與現有 v1 的接軌方式

本階段不改舊資料，因此：

### 可沿用 v1 的欄位
- `title`
- `title_aliases`
- `keywords`
- `law_refs`
- `retrieval_text_sparse`
- `retrieval_text_dense`
- `content`
- `source_priority`
- `doc_level`
- `source_type`
- `applicable_entity`

### 暫時做不到的事
- 依完整版本區間做精準過濾
- 依官方來源資料做 version-aware rerank
- 依 citation graph 做完整共同適用圖譜檢查

因此，對使用者應保守表述為：
- 已依現有資料做法域/內容層級判斷
- 但版本效力與引用關係仍可能未完整驗證

---

## 十、輸出到回答階段前的內部摘要

進入回答前，內部應至少形成：

```json
{
  "pre_filter": {
    "law_domain": "",
    "query_date": "",
    "version_filter_status": "applied|partially_applied|not_possible"
  },
  "retrieval": {
    "sparse_used": true,
    "dense_used": true,
    "fusion_method": "rrf",
    "candidate_pool_size": 0,
    "reranked_to": 0
  },
  "validation": {
    "overall_status": "supported|partially_supported|unsupported|uncertain",
    "major_risks": []
  }
}
```

---

## 十一、何時必須保守回答

符合下列任一情況：
- 關鍵例外 / 但書未查核
- 主體或客體匹配不穩定
- 不同法條可能共同適用但尚未驗證
- 只有 FAQ / 教育訓練資料支撐
- 版本效力無法確認
- 高風險題目但 validation 非 `supported`

則應回答：
- `目前無法確定。`
- 或等價保守表述，並說明缺口在哪裡。

---

## 十二、給 SKILL 的執行摘要

1. 先拆法律要素
2. 先做法域 / 日期 / 效力過濾
3. 再走 sparse + dense 雙路召回
4. 用 RRF 融合
5. 再做法律重排
6. 再逐項法源驗證
7. 驗證不足時改為保守回答