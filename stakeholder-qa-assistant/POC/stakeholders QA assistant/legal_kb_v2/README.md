# legal_kb_v2 sample / template files

此資料夾目前放的是 **sample / template 骨架**，用途是讓後續版本化法規庫、結構化抽取與 claim validation 有可直接複製的範例。

## 已提供檔案
- `regulation_versions.sample.jsonl`：版本化法規條文樣板
- `citation_graph.sample.jsonl`：法條引用 / 授權 / 共同適用關係樣板
- `norm_extractions.sample.jsonl`：結構化抽取樣板
- `claim_validations.sample.jsonl`：逐項 claim 驗證樣板
- `official_source_manifest.sample.json`：官方來源追蹤樣板

## 使用方式
1. 先複製 `.sample` 檔成正式資料檔
2. 再依實際法規與標註結果填值
3. 無法確認的欄位請保留空值或使用 `unconfirmed`，不要虛構

## 注意
- 這些 sample 僅示範欄位結構，不代表已完成正式法規驗證。
- 其中日期、版本、support 狀態等欄位，後續應依正式來源重建與校正。
