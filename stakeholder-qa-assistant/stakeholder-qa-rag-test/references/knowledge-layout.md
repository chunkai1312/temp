# Knowledge Layout

此 skill 使用的知識已整理在以下位置：

## 1. 原始檔

`stakeholders QA assistant/`

包含：
- PDF：教育訓練、內規、外規
- DOCX：FAQ、系統操作手冊

## 2. 中間整理結果

`stakeholders_QA_assistant_output/`

### markdown/
每個原始檔對應一份 Markdown。

### chunks/
每個原始檔切成多個 chunk，每個 chunk 有：
- 單獨 markdown 檔
- `_index.json`

### jsonl/
RAG 用結構化資料：
- `rag_documents.jsonl`：文件層級 metadata
- `rag_chunks.jsonl`：chunk 層級資料
- `qa_seed_chunks.jsonl`：QA seed
- `schema.json`：欄位定義
- `summary.json`：總覽

## 3. 建議優先讀取順序

1. `jsonl/summary.json`
2. `jsonl/schema.json`
3. `jsonl/rag_documents.jsonl`
4. `jsonl/rag_chunks.jsonl`
5. 必要時回看 `chunks/` 或 `markdown/`

## 4. chunk 資料的重要欄位

`rag_chunks.jsonl` 常用欄位：

- `id`
- `document_id`
- `source_file`
- `doc_type`
- `title`
- `chunk_title`
- `chunk_index`
- `total_chunks`
- `page_start`
- `page_end`
- `section_title`
- `char_count`
- `text`
- `markdown`
- `chunk_path`
- `markdown_path`
- `retrieval_hints`

## 5. iteration-2 引用規則

- 內部檢索時可使用 chunk / JSONL。
- 對使用者最終回答時，來源只能呈現「原始檔名稱」。
- 不可顯示 chunk id、切塊檔名、JSONL 路徑、markdown path。
