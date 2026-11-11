# InfoGather API 規格附件

日期：2026-11-06　｜　文件屬性：機密文件

本附件列出擬建置的 174 項 API，供需求確認與介面設計使用。正式主機網址於環境規劃時確認。

## 共通規格

- **格式**：使用 HTTPS、JSON 與 UTF-8；日期時間採含時區的 ISO 8601。CSV 匯出使用 `text/csv; charset=utf-8`，SSE 使用 `text/event-stream`。
- **認證**：受保護介面使用 `Authorization: Bearer <token>`，授權整合得使用 `x-api-key`。個人 API Key 的建立及管理須以互動式登入進行，明文僅於建立或輪替時顯示一次。
- **授權**：閱讀者、編輯者及工作空間管理者皆受目標工作空間限制；既有資源寫入另須資源管理權。對話及個人資料限本人；平台管理介面另檢查平台角色。所有查詢及匯出均先套用授權，再篩選、分頁或計算筆數。
- **分頁**：一般列表使用 `offset`、`limit`，預設為 `0`、`20`，`limit` 範圍為 `1～100`；回傳 `data` 與 `pagination`。Agent 歷程使用 `cursor`、`limit`，預設筆數為 `30`，回傳 `items` 與 `nextCursor`。
- **更新**：`PATCH` 僅修改有提供的欄位，僅明列可清除的欄位接受 `null`。必填文字不得為空，引用資源須存在且已獲授權。日期篩選與排序應明訂使用的時間欄位及邊界。
- **狀態**：`200` 表示查詢或同步更新成功，`201` 表示新增，`202` 表示背景工作已受理，`204` 表示成功且無回應本文。背景受理後須另查狀態，建立、生成、發布及 Agent 寫入須避免重複執行。

## 完整介面清單

下表均列完整路徑；大括號代表必填路徑參數。Query 為查詢參數，Body 為 JSON 請求內容；識別值採不透明字串。

### 一、身分登入與個人憑證

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/authentication/microsoft/login`<br>啟動公司身分登入 | 無；應導向指定的公司身分服務。 | 302 導向登入。 | 未登入者可啟動 |
| `GET /api/authentication/microsoft/callback`<br>處理登入回呼 | Query：code、state 或身分服務回傳的錯誤。 | 302 導向平台；失敗應呈現原因。 | 身分服務回呼 |
| `POST /api/auth/refresh-tokens`<br>更新登入憑證 | Body：refreshToken；應檢查有效性及帳戶狀態。 | 200 新的 accessToken 與 refreshToken。 | 持有效更新憑證者 |
| `POST /api/auth/logout`<br>登出 | 無；應清除瀏覽器登入工作階段。 | 204。 | 本人 |
| `GET /api/me`<br>查詢個人資料 | 無。 | 200 個人識別、姓名、平台角色與狀態。 | 本人 |
| `PATCH /api/me`<br>更新個人偏好 | Body：允許編輯的個人偏好；不得變更平台角色。 | 200 更新後個人資料。 | 本人 |
| `GET /api/me/workspaces`<br>列出可用工作空間 | 無。 | 200 工作空間清單與本人角色。 | 本人 |
| `GET /api/me/api-keys`<br>列出憑證 | 無。 | 200 名稱、遮罩、有效期限及撤銷狀態。 | 本人互動式登入 |
| `POST /api/me/api-keys`<br>新增憑證 | Body：name 必填；expiresAt 選填，可為 null。 | 201 憑證資料；明文僅顯示一次。 | 本人互動式登入 |
| `PATCH /api/me/api-keys/{keyId}`<br>編輯憑證資訊 | Body：name、expiresAt 的允許修改欄位。 | 200 更新後資料，不回傳明文。 | 本人互動式登入 |
| `POST /api/me/api-keys/{keyId}/rotate`<br>輪替憑證 | 無；應使舊憑證失效。 | 200 新憑證明文僅顯示一次。 | 本人互動式登入 |
| `PATCH /api/me/api-keys/{keyId}/revoke`<br>撤銷憑證 | 無。 | 200 撤銷後狀態。 | 本人互動式登入 |
| `DELETE /api/me/api-keys/{keyId}`<br>移除憑證紀錄 | 無；移除後不得再供認證使用。 | 204。 | 本人互動式登入 |

### 二、工作空間成員與邀請

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/workspaces/{wsId}`<br>查詢工作空間 | Path：wsId。 | 200 工作空間資料與可執行動作。 | 閱讀者 |
| `GET /api/workspaces/{wsId}/overview`<br>查詢工作空間概況 | Query：適用的統計期間。 | 200 來源、助手及彙報等授權統計。 | 閱讀者 |
| `GET /api/workspaces/{wsId}/members`<br>列出成員 | Query：分頁及必要篩選。 | 200 成員清單與工作空間角色。 | 閱讀者 |
| `POST /api/workspaces/{wsId}/members`<br>加入既有帳戶 | Body：userId、role 必填。 | 201 成員資料。 | 工作空間管理者 |
| `PATCH /api/workspaces/{wsId}/members/{userId}`<br>調整成員角色 | Body：role 必填。 | 200 更新後成員；應檢查管理責任保留條件。 | 工作空間管理者 |
| `DELETE /api/workspaces/{wsId}/members/{userId}`<br>移除成員 | 無；應處理訂閱、資源管理及執行權限的影響。 | 204；不符合移除條件時回傳衝突。 | 工作空間管理者 |
| `DELETE /api/workspaces/{wsId}/members/me`<br>退出工作空間 | 無；應檢查是否仍有必要管理責任。 | 204；不符合退出條件時回傳衝突。 | 本人且為成員 |
| `GET /api/workspaces/{wsId}/invitations`<br>列出待接受邀請 | Query：分頁與狀態。 | 200 邀請清單。 | 工作空間管理者 |
| `POST /api/workspaces/{wsId}/invitations`<br>建立邀請 | Body：role 必填；email、expiresInDays、maxUses 選填。 | 201 邀請連結、效期及使用限制。 | 工作空間管理者 |
| `POST /api/workspaces/{wsId}/invitations/{invitationId}/regenerate`<br>重建邀請連結 | 無；舊邀請代碼應失效。 | 200 新邀請連結。 | 工作空間管理者 |
| `DELETE /api/workspaces/{wsId}/invitations/{invitationId}`<br>撤銷邀請 | 無。 | 204。 | 工作空間管理者 |
| `GET /api/invitations/{token}`<br>查詢邀請資訊 | Path：token；僅呈現接受邀請所需的最少資訊。 | 200 邀請範圍、效期及可接受狀態。 | 持邀請連結者 |
| `POST /api/invitations/{token}/accept`<br>接受邀請 | 無；應檢查登入身分、指定信箱、效期及使用次數。 | 200 加入結果；重複或失效依規則處理。 | 已登入的受邀者 |

### 三、連接器資料來源與文章

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/data-sources`<br>查詢來源類型 | 無。 | 200 來源類型、名稱與說明。 | 已登入使用者 |
| `GET /api/connectors`<br>查詢連接器資訊 | 無。 | 200 可公開的連接器能力及設定格式。 | 已登入使用者 |
| `GET /api/workspaces/{wsId}/connectors`<br>列出已授權連接器 | Path：wsId。 | 200 授權狀態、來源設定限制及可用性。 | 閱讀者 |
| `GET /api/workspaces/{wsId}/connectors/infominer/channels`<br>查詢可用頻道 | Path：wsId。 | 200 頻道選項及適用限制。 | 閱讀者且獲服務授權 |
| `POST /api/feeds/validate-rss`<br>驗證 RSS | Body：url 必填。 | 200 是否有效及可取得的來源資訊。 | 已登入使用者 |
| `GET /api/feeds`<br>探索可見資料來源 | Query：title、connectorKey、workspace、分頁。 | 200 可見的 Feed 分頁。 | 已登入使用者 |
| `GET /api/workspaces/{wsId}/available-feeds`<br>查詢助手可選來源 | Query：名稱及來源類型。 | 200 工作空間內可選的來源清單。 | 閱讀者 |
| `GET /api/workspaces/{wsId}/feeds`<br>查詢資料來源 | Query：title、connectorKey、isActive、分頁。 | 200 Feed 分頁。 | 閱讀者 |
| `POST /api/workspaces/{wsId}/feeds`<br>建立資料來源 | Body：FeedInput。 | 201 Feed。 | 編輯者 |
| `GET /api/workspaces/{wsId}/feeds/{feedId}`<br>查詢來源詳情 | Path：feedId。 | 200 Feed 與最後處理狀態。 | 閱讀者 |
| `PATCH /api/workspaces/{wsId}/feeds/{feedId}`<br>修改來源或啟停 | Body：FeedInput 的允許修改欄位。 | 200 更新後 Feed。 | 編輯者及資源管理權 |
| `POST /api/workspaces/{wsId}/feeds/{feedId}/run`<br>手動觸發擷取 | 無；應檢查啟用、連接器授權及重複執行。 | 202 來源識別及受理狀態。 | 編輯者及資源管理權 |
| `DELETE /api/workspaces/{wsId}/feeds/{feedId}`<br>刪除資料來源 | 無；應檢查助手引用及刪除影響。 | 204；引用衝突依規則拒絕。 | 編輯者及資源管理權 |
| `DELETE /api/workspaces/{wsId}/feeds/{feedId}/articles/{articleId}`<br>移除來源文章 | Path：articleId。 | 200 移除結果及受影響關聯資訊。 | 編輯者及資源管理權 |
| `GET /api/articles`<br>搜尋文章 | Query：q、feedId、tag、url、from、to、分頁。 | 200 Article 分頁。 | 可見範圍內的使用者 |
| `GET /api/articles/{articleId}`<br>閱讀文章 | Path：articleId。 | 200 Article。 | 具該文章存取權者 |
| `POST /api/articles`<br>建立文章 | Body：link、title、summary、rawContent、tags、publishedAt、feed 必填。 | 201 Article；後續助手評估另行處理。 | 平台管理者 |

### 四、資訊助手與策展

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/assistants`<br>探索可見助手 | Query：名稱、來源、工作空間及分頁。 | 200 可見的 Assistant 分頁。 | 已登入使用者 |
| `GET /api/assistants/{assistantId}`<br>查詢可見助手介紹 | Path：assistantId。 | 200 助手介紹、來源歸屬及訂閱狀態。 | 具可見權限者 |
| `GET /api/workspaces/{wsId}/assistant-sources`<br>列出可用助手來源 | Query：可見性及必要篩選。 | 200 自有與已獲授權的跨空間來源。 | 閱讀者 |
| `POST /api/workspaces/{wsId}/assistant-sources`<br>引入跨空間助手 | Body：assistantId 必填。 | 201 引入關聯；應檢查來源授權。 | 編輯者 |
| `DELETE /api/workspaces/{wsId}/assistant-sources/{assistantId}`<br>移除引入來源 | 無；應檢查彙報引用。 | 204；引用衝突應明確提示。 | 編輯者 |
| `GET /api/workspaces/{wsId}/assistants`<br>查詢助手 | Query：名稱、狀態、來源及分頁。 | 200 Assistant 分頁。 | 閱讀者 |
| `POST /api/workspaces/{wsId}/assistants`<br>建立助手 | Body：AssistantInput。 | 201 Assistant。 | 編輯者 |
| `GET /api/workspaces/{wsId}/assistants/{assistantId}`<br>查詢助手詳情 | Path：assistantId。 | 200 Assistant。 | 閱讀者 |
| `PATCH /api/workspaces/{wsId}/assistants/{assistantId}`<br>編輯助手或啟停 | Body：AssistantInput 的允許修改欄位。 | 200 更新後 Assistant，並保留版本。 | 編輯者及資源管理權 |
| `DELETE /api/workspaces/{wsId}/assistants/{assistantId}`<br>刪除助手 | 無；應檢查彙報引用及來源關聯。 | 204；有衝突時回傳原因。 | 編輯者及資源管理權 |
| `POST /api/workspaces/{wsId}/assistants/generate-instructions`<br>生成收錄指令草稿 | Body：name、description 必填。 | 200 instructions，供編輯採用。 | 編輯者且模型可用 |
| `POST /api/workspaces/{wsId}/assistants/recommend-feeds`<br>推薦資料來源 | Body：助手名稱、描述及指令草稿。 | 200 建議來源、理由與可用性。 | 編輯者且模型可用 |
| `POST /api/workspaces/{wsId}/assistants/{assistantId}/run`<br>補評既有文章 | 無；依有效來源、收錄指令及門檻執行。 | 202 受理結果；避免重複處理。 | 編輯者及資源管理權 |
| `GET /api/workspaces/{wsId}/assistants/{assistantId}/articles`<br>查詢助手文章 | Query：評估狀態、collected、日期、分頁。 | 200 AssistantArticle 分頁。 | 閱讀者 |
| `PATCH /api/workspaces/{wsId}/assistants/{assistantId}/articles/{relationId}/review`<br>人工排除或恢復 | Body：collected、reason 必填。 | 200 更新後關聯與人工調整紀錄。 | 編輯者及資源管理權 |
| `POST /api/workspaces/{wsId}/assistants/{assistantId}/articles/retry`<br>重試失敗評估 | Body：relationshipIds 必填且不得為空。 | 202 接受、略過及拒絕的項目結果。 | 編輯者及資源管理權 |
| `GET /api/workspaces/{wsId}/assistants/{assistantId}/articles/export`<br>匯出助手文章 | Query：閱讀或管理用途及與查詢一致的篩選。 | 200 CSV；管理欄位限具管理權者。 | 依匯出內容檢查權限 |
| `GET /api/workspaces/{wsId}/assistants/{assistantId}/versions`<br>列出定義版本 | Query：分頁。 | 200 版本清單、時間與變更者。 | 具版本查閱權者 |
| `GET /api/workspaces/{wsId}/assistants/{assistantId}/versions/{versionId}`<br>查詢定義版本 | Path：versionId。 | 200 歷史定義內容。 | 具版本查閱權者 |

### 五、訂閱書籤與收藏集

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/me/assistants`<br>列出已訂閱助手 | Query：分頁及必要篩選。 | 200 助手訂閱清單。 | 本人 |
| `POST /api/me/assistants/{assistantId}/subscribe`<br>訂閱助手 | 無；應檢查助手可見性。 | 200 訂閱結果；重複請求不重複建立。 | 本人 |
| `DELETE /api/me/assistants/{assistantId}/subscribe`<br>取消訂閱 | 無。 | 204。 | 本人 |
| `GET /api/me/feeds/followed`<br>列出已追蹤來源 | Query：分頁。 | 200 來源追蹤清單。 | 本人 |
| `POST /api/me/feeds/{feedId}/follow`<br>追蹤資料來源 | 無；應檢查來源可見性。 | 200 追蹤結果。 | 本人 |
| `DELETE /api/me/feeds/{feedId}/follow`<br>取消追蹤來源 | 無。 | 204。 | 本人 |
| `GET /api/me/curated-articles`<br>查詢個人精選 | Query：keyword、助手、來源、日期、分頁。 | 200 訂閱助手的有效收錄文章。 | 本人 |
| `GET /api/me/bookmarks`<br>查詢書籤 | Query：keyword、collectionId、日期、分頁。 | 200 Bookmark 分頁。 | 本人 |
| `POST /api/me/bookmarks`<br>加入書籤 | Body：article 必填；collectionIds 選填。 | 201 Bookmark；重複加入不重複建檔。 | 本人且可存取文章 |
| `DELETE /api/me/bookmarks/{bookmarkId}`<br>移除書籤 | 無。 | 204；應移除其收藏集關聯。 | 本人 |
| `PATCH /api/me/bookmarks/{bookmarkId}/collections`<br>調整書籤分類 | Body：collectionIds 必填，可為空陣列。 | 200 更新後 Bookmark。 | 本人 |
| `POST /api/me/bookmarks/check`<br>批次查詢收藏狀態 | Body：articleIds 必填。 | 200 bookmarkedArticleIds，列出已收藏的文章識別。 | 本人 |
| `GET /api/me/collections`<br>列出收藏集 | 無。 | 200 Collection 清單。 | 本人 |
| `POST /api/me/collections`<br>建立收藏集 | Body：name 必填。 | 201 Collection。 | 本人 |
| `GET /api/me/collections/{collectionId}`<br>查詢收藏集 | Query：分頁及內容篩選。 | 200 收藏集資訊與可存取文章。 | 本人 |
| `PATCH /api/me/collections/{collectionId}`<br>編輯收藏集 | Body：name 必填。 | 200 Collection。 | 本人 |
| `DELETE /api/me/collections/{collectionId}`<br>刪除收藏集 | 無；僅移除分類及關聯，不刪除文章或書籤。 | 204。 | 本人 |
| `GET /api/me/collections/{collectionId}/export`<br>匯出收藏集 | Query：與收藏集查詢一致的內容篩選。 | 200 CSV。 | 本人 |

### 六、洞見彙報與刊期

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/workspaces/{wsId}/briefs`<br>查詢彙報定義 | Query：名稱、isActive、分頁。 | 200 Brief 分頁。 | 閱讀者 |
| `POST /api/workspaces/{wsId}/briefs`<br>建立彙報 | Body：BriefInput。 | 201 Brief。 | 編輯者 |
| `GET /api/workspaces/{wsId}/briefs/{briefId}`<br>查詢彙報詳情 | Path：briefId。 | 200 Brief 與來源可用性。 | 閱讀者 |
| `PATCH /api/workspaces/{wsId}/briefs/{briefId}`<br>編輯彙報或排程 | Body：BriefInput 的允許修改欄位。 | 200 更新後 Brief，並保留版本。 | 編輯者及資源管理權 |
| `DELETE /api/workspaces/{wsId}/briefs/{briefId}`<br>刪除彙報定義 | 無；應明訂刊期與歷史紀錄的保留影響。 | 204；執行中衝突應明確處理。 | 編輯者及資源管理權 |
| `POST /api/workspaces/{wsId}/briefs/generate-instructions`<br>生成彙報指令草稿 | Body：name、description 必填。 | 200 instructions。 | 編輯者且模型可用 |
| `POST /api/workspaces/{wsId}/briefs/{briefId}/run`<br>手動生成彙報 | 無；依指令、回溯範圍及來源執行。 | 202 executionId 及 queued 狀態。 | 編輯者及資源管理權 |
| `GET /api/workspaces/{wsId}/briefs/{briefId}/executions`<br>查詢執行紀錄 | Query：狀態、日期、分頁。 | 200 BriefExecution 分頁。 | 閱讀者 |
| `GET /api/workspaces/{wsId}/briefs/{briefId}/executions/{executionId}`<br>查詢生成狀態 | Path：executionId。 | 200 BriefExecution 與結果識別。 | 閱讀者 |
| `GET /api/workspaces/{wsId}/briefs/{briefId}/issues`<br>閱讀彙報刊期 | Query：生成日期區間、分頁。 | 200 BriefIssue 分頁，包含刊期內容。 | 閱讀者 |
| `PATCH /api/workspaces/{wsId}/briefs/{briefId}/issues/{issueId}`<br>編輯刊期內容 | Body：editedContent；null 表示恢復採用 AI 原稿。 | 200 更新後 BriefIssue。 | 編輯者及資源管理權 |
| `DELETE /api/workspaces/{wsId}/briefs/{briefId}/issues/{issueId}`<br>刪除刊期 | Path：issueId。 | 204；應留下必要操作紀錄。 | 編輯者及資源管理權 |
| `GET /api/workspaces/{wsId}/briefs/{briefId}/versions`<br>列出定義版本 | Query：分頁。 | 200 版本清單。 | 具版本查閱權者 |
| `GET /api/workspaces/{wsId}/briefs/{briefId}/versions/{versionId}`<br>查詢定義版本 | Path：versionId。 | 200 歷史定義內容。 | 具版本查閱權者 |

### 七、通知與平台公告

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/me/notifications`<br>查詢通知 | Query：已讀狀態、範圍、日期及分頁。 | 200 Notification 分頁。 | 本人 |
| `GET /api/me/notifications/unread-count`<br>查詢未讀數 | Query：與通知列表一致的範圍。 | 200 count。 | 本人 |
| `PATCH /api/me/notifications/{notificationId}/read`<br>標記已讀 | 無。 | 200 已讀狀態及 readAt。 | 本人 |
| `PATCH /api/me/notifications/read-all`<br>全部標記已讀 | Query：欲更新的通知範圍。 | 200 更新筆數。 | 本人 |
| `GET /api/admin/announcements`<br>查詢公告 | Query：狀態、日期及分頁。 | 200 Announcement 分頁。 | 平台管理者 |
| `POST /api/admin/announcements`<br>建立公告草稿 | Body：title、message、severity 必填。 | 201 Announcement。 | 平台管理者 |
| `GET /api/admin/announcements/{announcementId}`<br>查詢公告詳情 | Path：announcementId。 | 200 Announcement。 | 平台管理者 |
| `PATCH /api/admin/announcements/{announcementId}`<br>編輯公告草稿 | Body：title、message、severity 的修改欄位。 | 200 更新後 Announcement。 | 平台管理者 |
| `DELETE /api/admin/announcements/{announcementId}`<br>刪除公告 | 無；已發布內容的刪除限制應明訂。 | 204。 | 平台管理者 |
| `POST /api/admin/announcements/{announcementId}/publish`<br>發布公告 | 無；應檢查狀態並避免重複發送。 | 202 公告識別與發布處理狀態。 | 平台管理者 |

### 八、Agent 對話與操作確認

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/agent/sessions`<br>查詢本人對話 | Query：scope、workspaceId、archived、cursor、limit。 | 200 Session 游標分頁。 | 本人且範圍有效 |
| `POST /api/agent/sessions`<br>建立對話 | Body：SessionInput。 | 201 Session；重複 requestId 回傳同一結果。 | 本人且範圍與計費授權有效 |
| `GET /api/agent/sessions/{sessionId}`<br>查詢對話狀態 | Path：sessionId。 | 200 Session、可用能力及限制原因。 | 本人 |
| `PATCH /api/agent/sessions/{sessionId}`<br>更名或封存對話 | Body：title、archived 的修改欄位。 | 200 Session。 | 本人 |
| `DELETE /api/agent/sessions/{sessionId}`<br>永久刪除對話 | 無；應與可恢復的封存操作區分。 | 204；執行中等衝突回傳 409。 | 本人且符合刪除條件 |
| `GET /api/agent/sessions/{sessionId}/messages`<br>查詢訊息歷程 | Query：cursor、limit。 | 200 Message 游標分頁。 | 本人 |
| `GET /api/agent/sessions/{sessionId}/runs`<br>查詢執行歷程 | Query：cursor、limit。 | 200 Run 游標分頁。 | 本人 |
| `POST /api/agent/sessions/{sessionId}/runs`<br>提交需求並開始執行 | Body：RunInput。 | 202 Run 與提交的 Message。 | 本人且仍具資料、模型及預算權限 |
| `GET /api/agent/runs/{runId}`<br>取得目前執行快照 | Path：runId。 | 200 Run、訊息、待確認操作及佇列。 | 對話本人 |
| `POST /api/agent/runs/{runId}/messages`<br>追加訊息 | Body：requestId、prompt 必填；deliveryMode 選填。 | 202 訊息受理結果與識別。 | 對話本人 |
| `GET /api/agent/runs/{runId}/queue`<br>查詢待處理輸入 | Path：runId。 | 200 佇列項目及處理狀態。 | 對話本人 |
| `DELETE /api/agent/runs/{runId}/queue/{queueItemId}`<br>移除待處理輸入 | Path：queueItemId；不得誤刪已執行內容。 | 204；狀態衝突回傳 409。 | 對話本人 |
| `POST /api/agent/runs/{runId}/cancel`<br>取消執行 | 無；已完成的業務寫入應保留。 | 202 取消受理；終止結果由狀態回報。 | 對話本人 |
| `GET /api/agent/runs/{runId}/permissions`<br>取得待確認操作 | Path：runId。 | 200 Permission 清單及影響預覽。 | 對話本人 |
| `POST /api/agent/runs/{runId}/permissions/{permissionId}/respond`<br>同意或拒絕操作 | Body：decision 必填；confirmationText、feedback 視條件提供。 | 200 確認結果；不等同業務操作完成。 | 對話本人且仍有操作權 |
| `GET /api/agent/runs/{runId}/events`<br>接收進度與回覆 | Accept：text/event-stream。 | 200 SSE 事件串流。 | 對話本人 |

### 九、平台帳戶與工作空間管理

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/admin/users/overview`<br>查詢帳戶管理清單 | Query：帳戶狀態、角色、關鍵字及分頁。 | 200 帳戶與使用概況。 | 平台管理者 |
| `GET /api/admin/users/{userId}/disable-impact`<br>預覽停用影響 | Path：userId。 | 200 受影響資源及管理責任。 | 平台管理者 |
| `PATCH /api/admin/users/{userId}/access`<br>調整帳戶狀態與平台角色 | Body：角色、啟用狀態及必要確認資訊。 | 200 更新結果；受保護管理條件不得被破壞。 | 平台管理者 |
| `GET /api/admin/workspaces`<br>列出工作空間 | Query：名稱、狀態及分頁。 | 200 工作空間分頁。 | 平台管理者 |
| `POST /api/admin/workspaces`<br>建立工作空間 | Body：name 必填；slug、description 選填。 | 201 工作空間資料。 | 平台管理者 |
| `GET /api/admin/workspaces/{wsId}`<br>查詢工作空間管理資料 | Path：wsId。 | 200 工作空間與管理資訊。 | 平台管理者 |
| `PATCH /api/admin/workspaces/{wsId}`<br>編輯工作空間 | Body：名稱、說明及允許修改的管理設定。 | 200 更新後資料。 | 平台管理者 |
| `DELETE /api/admin/workspaces/{wsId}`<br>刪除工作空間 | 無；應確認成員、資源與執行工作影響。 | 204；衝突時回傳阻擋原因。 | 平台管理者 |
| `POST /api/admin/invitations`<br>建立平台加入邀請 | Body：指定身分、有效期限及使用限制。 | 201 平台邀請連結。 | 平台管理者 |
| `GET /api/admin/invitations`<br>查詢平台邀請 | Query：狀態及分頁。 | 200 平台邀請清單。 | 平台管理者 |
| `DELETE /api/admin/invitations/{invitationId}`<br>撤銷平台邀請 | 無。 | 204。 | 平台管理者 |

### 十、連接器與資訊服務管理

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/admin/connectors`<br>查詢連接器設定 | 無。 | 200 連接器、啟用狀態與授權概況。 | 平台管理者 |
| `PATCH /api/admin/connectors/{connectorKey}`<br>修改或停用連接器 | Body：啟用狀態及允許修改的設定。 | 200 更新結果及受影響來源資訊。 | 平台管理者 |
| `GET /api/admin/connectors/{connectorKey}/workspaces`<br>查詢工作空間授權 | Path：connectorKey。 | 200 授權清單。 | 平台管理者 |
| `POST /api/admin/connectors/{connectorKey}/workspaces/{wsId}`<br>授予連接器使用權 | Body：服務方案與適用限制，依類型定義。 | 201 工作空間授權。 | 平台管理者 |
| `DELETE /api/admin/connectors/{connectorKey}/workspaces/{wsId}`<br>撤銷連接器使用權 | 無；應停用受影響來源並通知相關對象。 | 204。 | 平台管理者 |
| `GET /api/admin/connectors/infominer/plans`<br>查詢資訊服務方案 | 無。 | 200 方案與頻道限制。 | 平台管理者 |
| `POST /api/admin/connectors/infominer/plans`<br>建立資訊服務方案 | Body：方案識別、名稱及可用範圍。 | 201 服務方案。 | 平台管理者 |
| `PUT /api/admin/connectors/infominer/plans/{planKey}`<br>更新資訊服務方案 | Body：完整方案設定。 | 200 更新後服務方案。 | 平台管理者 |
| `DELETE /api/admin/connectors/infominer/plans/{planKey}`<br>刪除資訊服務方案 | 無；應檢查既有授權引用。 | 204；引用衝突回傳 409。 | 平台管理者 |

### 十一、模型服務與用量管理

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/admin/llm/connections`<br>列出集中管理連線 | 無。 | 200 LlmConnection 清單；不含明文憑證。 | 平台管理者 |
| `POST /api/admin/llm/connections`<br>建立模型服務連線 | Body：label、providerType、baseUrl、apiKey、selectedModels。 | 201 LlmConnection。 | 平台管理者 |
| `GET /api/admin/llm/connections/{connectionId}`<br>查詢連線詳情 | Path：connectionId。 | 200 LlmConnection。 | 平台管理者 |
| `PATCH /api/admin/llm/connections/{connectionId}`<br>編輯連線資訊 | Body：label 等允許修改的資訊。 | 200 更新後 LlmConnection。 | 平台管理者 |
| `POST /api/admin/llm/connections/{connectionId}/verify`<br>驗證服務連線 | 無；應說明驗證是否產生推論費用。 | 200 驗證狀態與安全的失敗資訊。 | 平台管理者 |
| `GET /api/admin/llm/connections/{connectionId}/models`<br>查詢可選模型 | Path：connectionId。 | 200 模型識別、能力與價格對應狀態。 | 平台管理者 |
| `PUT /api/admin/llm/connections/{connectionId}/models`<br>設定可用模型 | Body：selectedModels，列出模型及定價對應。 | 200 更新後模型設定。 | 平台管理者 |
| `POST /api/admin/llm/connections/{connectionId}/api-key`<br>更新服務憑證 | Body：apiKey 必填。 | 200 更新結果與遮罩資訊。 | 平台管理者 |
| `GET /api/admin/llm/connections/{connectionId}/impact`<br>預覽停用或封存影響 | Query：預計操作。 | 200 受影響工作空間與確認依據。 | 平台管理者 |
| `POST /api/admin/llm/connections/{connectionId}/disable`<br>停用模型服務連線 | Body：影響預覽版本與必要確認資訊。 | 200 停用狀態。 | 平台管理者 |
| `POST /api/admin/llm/connections/{connectionId}/reenable`<br>重新啟用連線 | 無；應重新檢查連線可用性。 | 200 啟用狀態。 | 平台管理者 |
| `POST /api/admin/llm/connections/{connectionId}/archive`<br>封存連線 | Body：影響預覽版本與必要確認資訊；應清除有效憑證。 | 200 封存狀態。 | 平台管理者 |
| `GET /api/admin/llm/connections/{connectionId}/workspaces`<br>查詢已授權工作空間 | Path：connectionId。 | 200 工作空間授權清單。 | 平台管理者 |
| `POST /api/admin/llm/connections/{connectionId}/workspaces/{wsId}`<br>授予工作空間使用權 | Path：connectionId、wsId。 | 201 工作空間授權。 | 平台管理者 |
| `GET /api/admin/llm/connections/{connectionId}/workspaces/{wsId}/impact`<br>預覽撤銷授權影響 | Path：connectionId、wsId。 | 200 影響範圍與預覽版本。 | 平台管理者 |
| `DELETE /api/admin/llm/connections/{connectionId}/workspaces/{wsId}`<br>撤銷模型服務授權 | 必要時提供影響預覽版本與確認資訊。 | 204。 | 平台管理者 |
| `GET /api/workspaces/{wsId}/llm/availability`<br>查詢模型可用性 | Path：wsId。 | 200 是否可用、可選模型與限制原因。 | 閱讀者 |
| `GET /api/workspaces/{wsId}/llm/usage`<br>查詢工作空間用量 | Query：日期、功能、模型及分頁。 | 200 token、費用及估算完整性。 | 工作空間管理者 |
| `GET /api/workspaces/{wsId}/llm/usage-summary`<br>查詢用量摘要 | Query：日期區間。 | 200 用量、費用與預算狀態。 | 工作空間管理者 |
| `GET /api/admin/workspaces/{wsId}/llm/settings`<br>查詢模型與預算設定 | Path：wsId。 | 200 LlmSettings。 | 平台管理者 |
| `PUT /api/admin/workspaces/{wsId}/llm/settings`<br>設定模型與預算 | Body：LlmSettingsInput。 | 200 更新後 LlmSettings。 | 平台管理者 |
| `PATCH /api/admin/workspaces/{wsId}/llm/settings`<br>調整模型或預算 | Body：LlmSettingsInput 的修改欄位。 | 200 更新後 LlmSettings。 | 平台管理者 |
| `POST /api/admin/workspaces/{wsId}/llm/settings/verify`<br>驗證工作空間模型設定 | 無。 | 200 驗證結果與限制原因。 | 平台管理者 |
| `POST /api/admin/workspaces/{wsId}/llm/settings/disable`<br>停用工作空間模型 | 無；應提示受影響的 AI 功能。 | 200 停用後狀態。 | 平台管理者 |
| `GET /api/admin/llm/usage`<br>查詢平台模型用量 | Query：工作空間、日期、功能、模型及分頁。 | 200 跨工作空間用量與費用。 | 平台管理者 |
| `GET /api/admin/llm/pricing`<br>查詢模型定價版本 | Query：供應商、模型及生效期間。 | 200 單價、幣別及版本資訊。 | 平台管理者 |
| `POST /api/admin/llm/pricing`<br>建立定價版本 | Body：模型、幣別、輸入輸出 token 單價及生效時間。 | 201 新版本；既有用量計價依據應保留。 | 平台管理者 |

### 十二、管理紀錄與資料保留

| 介面與用途 | 主要輸入 | 預期回應 | 權限 |
| --- | --- | --- | --- |
| `GET /api/admin/audit`<br>查詢管理活動 | Query：操作者、事件、資源、日期及分頁。 | 200 管理紀錄分頁。 | 平台管理者 |
| `GET /api/admin/audit/{auditId}`<br>查詢管理事件詳情 | Path：auditId。 | 200 事件、目標與安全的變更摘要。 | 平台管理者 |
| `GET /api/admin/audit/export`<br>匯出管理紀錄 | Query：與管理紀錄查詢一致的篩選。 | 200 CSV。 | 平台管理者 |
| `GET /api/admin/login-events`<br>查詢登入紀錄 | Query：帳戶、結果、日期及分頁。 | 200 登入紀錄分頁。 | 平台管理者 |
| `GET /api/admin/data-management/retention-policies`<br>查詢資料保留政策 | 無。 | 200 政策、期限及保護條件。 | 平台管理者 |
| `PATCH /api/admin/data-management/retention-policies/{policyKey}`<br>調整保留政策 | Body：啟用狀態、保留期限等允許設定。 | 200 更新後政策。 | 平台管理者 |
| `POST /api/admin/data-management/retention-policies/{policyKey}/preview`<br>預覽清理候選範圍 | Body：評估基準時間等條件。 | 200 候選筆數、範圍與受保護項目；不得執行刪除。 | 平台管理者 |

## 主要請求資料契約

### FeedInput 資料來源

| 欄位 | 型別 | 必填 | 需求與驗證規則 |
| --- | --- | --- | --- |
| title | string | 是 | 資料來源名稱，不得為空。 |
| connectorKey | string | 是 | rss、search 或 infominer；必須為工作空間已獲授權且啟用的連接器。 |
| sourceConfig | object | 是 | 依 connectorKey 驗證專屬欄位，不同來源設定不得混用。 |
| isActive | boolean | 否 | 是否啟用；停用後應停止安排新的擷取。 |

### AssistantInput 資訊助手

| 欄位 | 型別 | 必填 | 需求與驗證規則 |
| --- | --- | --- | --- |
| name | string | 是 | 資訊助手名稱，不得為空。 |
| description | string | 是 | 說明追蹤主題與用途，不得為空。 |
| instructions | string | 是 | 文章收錄與排除指令，不得為空。 |
| feedIds | string[] | 是 | 至少一個可用且具使用權的資料來源。 |
| scoreThreshold | number | 否 | 0～1；未提供時採核定的預設門檻，回應應呈現有效值。 |
| isActive | boolean | 否 | 是否持續評估文章。 |

### BriefInput 洞見彙報

| 欄位 | 型別 | 必填 | 需求與驗證規則 |
| --- | --- | --- | --- |
| name | string | 是 | 彙報名稱，不得為空。 |
| description | string | 否 | 彙報用途與內容說明。 |
| instructions | string | 是 | 指定報告重點及輸出格式，不得為空。 |
| assistantIds | string[] | 是 | 至少一個可用且具來源授權的助手。 |
| lookbackDays | integer | 否 | 文章回溯天數，範圍 1～90；預設天數應於需求確認時核定。 |
| isActive | boolean | 否 | 彙報是否啟用。 |
| schedule | object | 否 | 未啟用排程時仍可依權限手動生成；啟用時須符合下述排程規則。 |

### SessionInput 與 RunInput 對話輸入

| 契約 | 必填欄位 | 選填欄位與規則 |
| --- | --- | --- |
| SessionInput | requestId: string、scope: string、billingWorkspaceId: string | scope 為 personal、workspace 或 admin。workspace 情境必填 workspaceId；title 選填。範圍及費用歸屬須分別驗證。 |
| RunInput | requestId: string、prompt: string | mode 可為 ask、refine 或 evaluate；context 可帶入頁面及目標識別，僅供確認情境，不能作為授權依據。 |
| 追加訊息 | requestId: string、prompt: string | deliveryMode 可為 enqueue 或 immediate；應說明待處理輸入與即時指示的狀態。 |
| 操作確認 | decision: string | decision 為 approve-once 或 reject；敏感操作依回傳要求提供 confirmationText，feedback 為選填意見。 |

### LlmSettingsInput 模型與預算

| 欄位 | 型別 | 需求與驗證規則 |
| --- | --- | --- |
| connectionId | string | 完整設定時必填，須為已授權予工作空間且可用的連線。 |
| defaultModel | string | 完整設定時必填，須在該連線允許的模型清單內。 |
| taskModels | object | 選填；按文章整理、助手評估、彙報及指令輔助等任務指定模型。 |
| budget | object | 選填；包含 monthlyBudgetUsd、resetDayOfMonth、enforcementMode、notifyThresholdPercent。 |

### 補充驗證規則

- **來源設定**：RSS 須提供有效 `url`；搜尋來源須有 `query`，並依能力提供主題、回溯範圍與國別；Infominer 須符合已授權的方案與頻道。來源檢查頻率與查詢回溯範圍分別管理。
- **彙報排程**：`lookbackDays` 範圍為 `1～90`。`schedule` 包含 `enabled`、`frequency` 與 `hour`；頻率為 `daily`、`weekly` 或 `monthly`，時為 `0～23`。每週另填 `dayOfWeek`，以 `1～7` 代表星期一至星期日；每月另填 `dayOfMonth`，範圍為 `1～28`。時區於設計階段確認，回應應提供 `nextRunAt`，未排程為 `null`。
- **對話輸入**：`scope` 為 `personal`、`workspace` 或 `admin`；工作空間情境的 `workspaceId` 與 `billingWorkspaceId` 應一致。資料權限與費用歸屬分別驗證，建立後如需變更範圍，應另建對話。`mode` 可為 `ask`、`refine` 或 `evaluate`；追加輸入的 `deliveryMode` 為 `enqueue` 或 `immediate`。
- **操作確認**：`decision` 為 `approve-once` 或 `reject`，依要求提供 `confirmationText`，`feedback` 選填。確認須綁定特定執行、工具與目標，核准後仍檢查權限及資源狀態，過期或拒絕的確認不得重用。
- **預算**：`budget` 可包含 `monthlyBudgetUsd`、`resetDayOfMonth`、`enforcementMode` 與 `notifyThresholdPercent`。金額採十進位字串，`null` 表示未設額度；處理模式為 `none`、`notify` 或 `block`，告警百分比為 `1～100`。費用應附估算完整性與計價依據，未知值與零費用應分別呈現。

## 回應與背景工作

資源回應應包含識別、適用的建立與更新時間；工作空間資源另含 `workspaceId`。回應、匯出及錯誤均不得揭露原始憑證、內部堆疊或非必要個人資料。

| 類型 | 主要回應內容 |
| --- | --- |
| 一般分頁 | `data` 與 `pagination`；後者包含 `offset`、`limit`、`count`、`total`、`hasMore`、`nextOffset`。 |
| Agent 游標分頁 | `items` 與 `nextCursor`；無下一頁時游標為 `null`。 |
| 來源與文章 | 來源設定、最後擷取與下次執行資訊；文章標題、來源、摘要、本文、標籤及發布與收錄時間。 |
| 助手與評估 | 助手定義、有效門檻與版本；文章評分、理由、AI 原始判斷、有效收錄結果及人工調整紀錄。 |
| 書籤與收藏集 | 書籤與文章關聯、收藏分類、加入時間；收藏集名稱、文章數及更新時間。 |
| 彙報與刊期 | 彙報定義、執行狀態、原因與刊期識別；刊期保存 AI 原稿、`editedContent`、涵蓋期間與生成資訊。 |
| 通知與公告 | 標題、訊息、類型、資源導向及時間；通知含 `readAt`，公告含嚴重程度與發布狀態。 |
| 對話與執行 | 範圍、費用歸屬、對話與執行識別、訊息、狀態、待確認操作、佇列及限制原因。 |
| 模型與用量 | 可用連線、模型、預算、功能歸屬、token、`costUsd`、`costQuality` 及計價版本。 |

- 彙報執行狀態為 `queued`、`running`、`completed`、`skipped`、`failed`；無符合條件文章時應回報 `skipped` 及原因。
- Agent 應區分 `accepted`、`running`、`waiting_for_permission`、`cancelling`、`finalizing`、`recovering`，以及 `completed`、`failed`、`cancelled`、`interrupted` 等終止結果。取消停止後續處理，已完成的業務寫入仍保留。
- 相同使用者及操作範圍內，相同 `requestId` 與內容應回傳原受理結果；相同識別搭配不同內容應拒絕。寫入結果不確定時先查證，再決定是否重試。

## SSE 事件

每筆事件應包含 `type`、`sessionId`、`runId` 與 `data`。

| 事件 | 內容 |
| --- | --- |
| `run.snapshot` | 執行快照、訊息、待確認操作及佇列。 |
| `run.status` | 目前執行狀態與原因。 |
| `message.submitted`、`message.delta`、`message.updated` | 訊息受理、增量與完整更新。 |
| `tool.updated` | 工具進度與可安全呈現的結果。 |
| `permission.requested`、`permission.completed` | 待確認操作、影響預覽與核准或拒絕狀態。 |
| `queue.updated`、`run.finished` | 待處理輸入與執行終止結果。 |

連線須有維持與逾時規則；重連以最新快照、持久化紀錄及待確認操作恢復畫面。關閉面板或斷線不代表取消，核准操作也不代表業務寫入完成。

## 錯誤與整合驗證

錯誤回應須有 `statusCode`、`code`、`message` 及 `requestId`，欄位錯誤應指出原因。

| HTTP 狀態 | 情境 |
| --- | --- |
| `400` | 欄位格式、必填或範圍錯誤。 |
| `401`、`403`、`404` | 認證無效、權限或授權不足、資源不存在或不可見。 |
| `402` | 工作空間 AI 預算達限或無法使用。 |
| `409`、`410` | 重複執行、引用或確認衝突、對話無法恢復。 |
| `412`、`422` | 模型連線不可用或模型設定無效。 |
| `429` | 請求頻率或外部額度達限。 |
| `500`、`502`、`503` | 系統錯誤、外部服務失敗或暫時不可用。 |

- 查詢得依退避規則重試；建立、生成、發布與寫入應使用冪等識別或先查證結果，批次重試須逐項回報。
- CSV 匯出須沿用查詢的授權與篩選條件，正確處理分隔符號、引號、換行、日期、空值及安全檔名；管理欄位限具權限者取得。
- 介面驗證應涵蓋正常輸入、無權存取、無效識別、狀態衝突與重複請求；整合驗證涵蓋來源擷取、助手收錄、彙報與通知，以及 Agent 確認後的實際操作結果。
