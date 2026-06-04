# InfoGather 地端 HA 版部署配置參考

日期：2026-06-04  
用途：供維運單位評估 InfoGather 地端高可用正式環境的部署拓撲、硬體資源、服務清單、HA 容錯與監控規劃。

## 1. 整體部署架構

地端 HA 版建議將 InfoGather 拆成入口層、應用層、LLM runtime 層、資料層與維運層。核心原則是讓 API、Worker、Copilot CLI Server、Redis 與 MongoDB 不在同一台主機上互相競爭資源，並避免單一節點故障造成整體 ingestion、assistant evaluation 或使用者介面停擺。

### 建議拓撲

```mermaid
flowchart TB
  USERS["Users / Admins"] --> FW["Firewall / WAF"]
  FW --> VIP["Virtual IP / Load Balancer"]
  VIP --> RP1["Reverse Proxy 1\nNginx / HAProxy"]
  VIP --> RP2["Reverse Proxy 2\nNginx / HAProxy"]

  RP1 --> API1["API app replica 1"]
  RP1 --> API2["API app replica 2"]
  RP2 --> API1
  RP2 --> API2

  subgraph APP["Application Tier"]
    API1
    API2
    SCHED["Scheduler active x1\nstandby optional"]
    W1["Worker pool\n10 replicas baseline"]
    W2["Worker scale-out\nup to 20 replicas"]
  end

  subgraph CLI["LLM Runtime Tier"]
    CLILB["Private CLI endpoint\nLB / affinity"]
    CLI1["Copilot CLI 1"]
    CLI2["Copilot CLI 2"]
  end

  subgraph DATA["Data Tier"]
    R1["Redis primary"]
    R2["Redis replica"]
    RS["Redis Sentinel quorum"]
    M1["MongoDB primary"]
    M2["MongoDB secondary"]
    M3["MongoDB secondary"]
  end

  subgraph OPS["Operations Tier"]
    MON["Metrics / Logs / Alerts"]
    BACKUP["Backup storage\nNAS / object storage"]
    VAULT["Secrets manager / vault"]
  end

  API1 --> R1
  API2 --> R1
  API1 --> M1
  API2 --> M1
  API1 --> CLILB
  API2 --> CLILB
  SCHED --> R1
  SCHED --> M1
  W1 --> R1
  W1 --> M1
  W1 --> CLILB
  W2 --> R1
  W2 --> M1
  W2 --> CLILB
  CLILB --> CLI1
  CLILB --> CLI2
  CLI1 --> LLM["OpenAI-compatible\nBYOK provider"]
  CLI2 --> LLM
  R1 --> R2
  RS --> R1
  RS --> R2
  M1 --> M2
  M1 --> M3
  M1 --> BACKUP
  M2 --> BACKUP
  API1 --> MON
  W1 --> MON
  CLILB --> MON
  R1 --> MON
  M1 --> MON
  VAULT --> API1
  VAULT --> W1
  VAULT --> SCHED
```

### 服務角色與連線關係

| 角色 | 建議部署 | 主要用途 | 主要連線依賴 |
|---|---|---|---|
| Reverse Proxy / Load Balancer | 2 台 VM，搭配 VIP / VRRP / 硬體 LB | 對外 HTTPS、TLS termination、路由到 API、健康檢查 | 對外網路、API app `/health` |
| API app | 2 replicas | REST API、SSE、使用者與工作區權限、feeds/articles/assistants/briefs、Agent runtime API | MongoDB、Redis、Copilot CLI、Secrets |
| Worker | baseline 10 replicas，保留擴到 20 | feed/article/assistant/brief/announcement 背景工作 | Redis/BullMQ、MongoDB、Copilot CLI、外部資料來源 |
| Scheduler | active x1 + standby x1 disabled | 到期 feed、brief 排程與 cron producer | MongoDB、Redis |
| Copilot CLI Server | 2 replicas，透過 private CLI VIP 分流 | LLM session orchestration、JSON-RPC / streaming、工具協調、BYOK provider 轉接 | API、Worker、外部 LLM provider、session state |
| Redis / BullMQ | Redis primary + replica，搭配 Sentinel quorum；或 Redis HA appliance | BullMQ queue、cache、refresh token ID state | API、Worker、Scheduler、監控與備份策略 |
| MongoDB | 3-node replica set | articles、assistantarticles、workspaces、users、briefs、notifications 等主資料 | API、Worker、Scheduler、備份 |
| Monitoring / Logging | 獨立維運節點或既有監控平台 | metrics、logs、alerts、dashboard、incident response | 所有 runtime、DB、Redis、CLI |
| Backup / Restore | 獨立 NAS、備份主機或物件儲存 | MongoDB snapshot/dump、設定備份、還原演練 | MongoDB、Redis 視策略、Secrets 設定 |
| Secrets Manager / Vault | 獨立或既有企業平台 | Mongo URI、Redis URL、JWT secrets、OAuth credentials、LLM API keys | API、Worker、Scheduler、Copilot CLI |

### VM 級部署拓樸，建議正式配置

以下拓樸以「地端 HA 正式版」為基準，將服務落到具體 VM。此配置假設維運單位可提供 private network / VLAN、內部 DNS、VIP 或硬體/虛擬 Load Balancer，並可將 MongoDB、Redis、Copilot CLI 與 App/Worker 分散到不同 failure domain。

```mermaid
flowchart TB
  USERS["Users / Admins"] --> FW["Firewall / WAF"]
  FW --> PUBLICVIP["Public VIP\nhttps://infogather.example.com"]

  subgraph EDGE["Edge / DMZ"]
    LB1["vm-lb-01\n2 vCPU / 4 GiB RAM\nNginx or HAProxy\nKeepalived / VRRP\nPublic API VIP + Private CLI VIP"]
    LB2["vm-lb-02\n2 vCPU / 4 GiB RAM\nNginx or HAProxy\nKeepalived / VRRP\nPublic API VIP + Private CLI VIP"]
  end

  subgraph APP["Application VLAN"]
    APP1["vm-app-01\n8 vCPU / 32 GiB RAM\nAPI replica 1\nWorker x3\nBull Board optional"]
    APP2["vm-app-02\n8 vCPU / 32 GiB RAM\nAPI replica 2\nWorker x3\nScheduler standby disabled"]
    APP3["vm-app-03\n8 vCPU / 32 GiB RAM\nWorker x4\nScheduler active x1"]
  end

  subgraph CLITIER["LLM Runtime VLAN"]
    CLIVIP["Private CLI VIP\nCOPILOT_CLI_URL"]
    CLI1["vm-cli-01\n2 vCPU / 4 GiB RAM\nCopilot CLI server 1\nsession state volume"]
    CLI2["vm-cli-02\n2 vCPU / 4 GiB RAM\nCopilot CLI server 2\nsession state volume"]
  end

  subgraph REDISTIER["Redis HA VLAN"]
    REDIS1["vm-redis-01\n4 vCPU / 16 GiB RAM\nRedis primary candidate\nSentinel vote"]
    REDIS2["vm-redis-02\n4 vCPU / 16 GiB RAM\nRedis replica candidate\nSentinel vote"]
    REDIS3["vm-redis-03\n2 vCPU / 8 GiB RAM\nSentinel quorum vote\noptional replica / witness"]
  end

  subgraph MONGOTIER["MongoDB Replica Set VLAN"]
    MONGO1["vm-mongo-01\n4 vCPU / 16 GiB RAM\n1 TB NVMe\nMongoDB primary candidate"]
    MONGO2["vm-mongo-02\n4 vCPU / 16 GiB RAM\n1 TB NVMe\nMongoDB secondary"]
    MONGO3["vm-mongo-03\n4 vCPU / 16 GiB RAM\n1 TB NVMe\nMongoDB secondary"]
  end

  subgraph OPS["Operations VLAN"]
    OPS1["vm-ops-01\n4 vCPU / 16 GiB RAM\nPrometheus / Grafana\nAlertmanager / log collector"]
    BACKUP1["vm-backup-01\n4 vCPU / 16 GiB RAM\n2 TB storage\nMongo backup jobs\nrestore drill workspace"]
    VAULT["Existing Vault / Secrets Manager\nor vm-vault-01 / 02 / 03"]
  end

  LLM["OpenAI-compatible\nBYOK provider"]

  PUBLICVIP --> LB1
  PUBLICVIP --> LB2
  LB1 -->|HTTPS / API / SSE| APP1
  LB1 -->|HTTPS / API / SSE| APP2
  LB2 -->|HTTPS / API / SSE| APP1
  LB2 -->|HTTPS / API / SSE| APP2

  APP1 -->|COPILOT_CLI_URL| CLIVIP
  APP2 -->|COPILOT_CLI_URL| CLIVIP
  APP3 -->|COPILOT_CLI_URL| CLIVIP
  CLIVIP --> CLI1
  CLIVIP --> CLI2
  CLI1 --> LLM
  CLI2 --> LLM

  APP1 -->|Redis URL / Sentinel list| REDIS1
  APP2 -->|Redis URL / Sentinel list| REDIS1
  APP3 -->|Redis URL / Sentinel list| REDIS1
  REDIS1 --> REDIS2
  REDIS1 -. Sentinel quorum .- REDIS3
  REDIS2 -. Sentinel quorum .- REDIS3

  APP1 -->|MongoDB replica set URI| MONGO1
  APP1 -->|MongoDB replica set URI| MONGO2
  APP1 -->|MongoDB replica set URI| MONGO3
  APP2 -->|MongoDB replica set URI| MONGO1
  APP2 -->|MongoDB replica set URI| MONGO2
  APP2 -->|MongoDB replica set URI| MONGO3
  APP3 -->|MongoDB replica set URI| MONGO1
  APP3 -->|MongoDB replica set URI| MONGO2
  APP3 -->|MongoDB replica set URI| MONGO3
  MONGO1 --> MONGO2
  MONGO1 --> MONGO3

  OPS1 -. scrape / logs .-> LB1
  OPS1 -. scrape / logs .-> APP1
  OPS1 -. scrape / logs .-> APP2
  OPS1 -. scrape / logs .-> APP3
  OPS1 -. scrape / logs .-> CLI1
  OPS1 -. scrape / logs .-> REDIS1
  OPS1 -. scrape / logs .-> MONGO1
  BACKUP1 -->|backup / restore drill| MONGO1
  BACKUP1 -->|backup / restore drill| MONGO2
  BACKUP1 -->|backup / restore drill| MONGO3
  VAULT -. secrets .-> APP1
  VAULT -. secrets .-> APP2
  VAULT -. secrets .-> APP3
  VAULT -. secrets .-> CLI1
  VAULT -. secrets .-> CLI2
```

### VM 配置與服務部署矩陣

| VM | 建議規格 | 部署服務 | 持久化儲存 | 對外 / 對內連線 | 容錯角色 |
|---|---:|---|---|---|---|
| `vm-lb-01` | 2 vCPU / 4 GiB RAM / 60 GB system disk | Nginx 或 HAProxy、Keepalived/VRRP、TLS 憑證、public API VIP、private CLI VIP | 只需設定檔與憑證備份 | 對外 HTTPS；對內連 API app 與 Copilot CLI | 入口層 active 或 active/passive 節點 |
| `vm-lb-02` | 2 vCPU / 4 GiB RAM / 60 GB system disk | Nginx 或 HAProxy、Keepalived/VRRP、TLS 憑證、public API VIP、private CLI VIP | 只需設定檔與憑證備份 | 對外 HTTPS；對內連 API app 與 Copilot CLI | 入口層 standby 或 active/active 節點 |
| `vm-app-01` | 8 vCPU / 32 GiB RAM / 100 GB system disk | API app replica 1、Worker x3、Bull Board optional、metrics/log agent | 不需業務資料持久化 | 連 MongoDB replica set、Redis/Sentinel、Copilot CLI VIP、Secrets | API 主要副本之一；worker 分散節點 |
| `vm-app-02` | 8 vCPU / 32 GiB RAM / 100 GB system disk | API app replica 2、Worker x3、Scheduler standby disabled、metrics/log agent | 不需業務資料持久化 | 連 MongoDB replica set、Redis/Sentinel、Copilot CLI VIP、Secrets | API 主要副本之一；scheduler 故障時可人工切換 |
| `vm-app-03` | 8 vCPU / 32 GiB RAM / 100 GB system disk | Worker x4、Scheduler active x1、metrics/log agent | 不需業務資料持久化 | 連 MongoDB replica set、Redis/Sentinel、Copilot CLI VIP、Secrets | 背景處理主承載節點；scheduler active 節點 |
| `vm-cli-01` | 2 vCPU / 4 GiB RAM / 50 GB system disk / 20 GB session volume | Copilot CLI server replica 1、healthcheck、metrics/log agent | 建議保留 session state volume | 僅接受 API/Worker 經 private CLI VIP 連線；對外連 BYOK LLM provider | CLI active 節點之一，需驗證 affinity |
| `vm-cli-02` | 2 vCPU / 4 GiB RAM / 50 GB system disk / 20 GB session volume | Copilot CLI server replica 2、healthcheck、metrics/log agent | 建議保留 session state volume | 僅接受 API/Worker 經 private CLI VIP 連線；對外連 BYOK LLM provider | CLI HA 節點；可 active/active 或 active/standby |
| `vm-mongo-01` | 4 vCPU / 16 GiB RAM / 1 TB NVMe | MongoDB replica set member、primary candidate、backup agent | 必要，NVMe；納入 snapshot/dump | 僅允許 API/Worker/Scheduler、DB 管理與備份節點連線 | MongoDB primary candidate |
| `vm-mongo-02` | 4 vCPU / 16 GiB RAM / 1 TB NVMe | MongoDB replica set member、secondary、backup agent | 必要，NVMe；可作為備份來源 | 僅允許 API/Worker/Scheduler、DB 管理與備份節點連線 | MongoDB secondary；primary 故障時可選舉 |
| `vm-mongo-03` | 4 vCPU / 16 GiB RAM / 1 TB NVMe | MongoDB replica set member、secondary、backup agent | 必要，NVMe；可作為備份來源 | 僅允許 API/Worker/Scheduler、DB 管理與備份節點連線 | MongoDB secondary；維持 majority quorum |
| `vm-redis-01` | 4 vCPU / 16 GiB RAM / 200 GB SSD | Redis primary candidate、Redis Sentinel vote、metrics/log agent | 視 AOF/RDB 策略；保留 Redis config 與必要持久化 | 允許 API/Worker/Scheduler 連線；與 redis 節點 replication | Redis primary candidate |
| `vm-redis-02` | 4 vCPU / 16 GiB RAM / 200 GB SSD | Redis replica candidate、Redis Sentinel vote、metrics/log agent | 視 AOF/RDB 策略；保留 Redis config 與必要持久化 | 允許 API/Worker/Scheduler 連線；與 redis 節點 replication | Redis replica；primary 故障時可升級 |
| `vm-redis-03` | 2 vCPU / 8 GiB RAM / 100 GB SSD | Redis Sentinel quorum vote、optional Redis replica 或 witness、metrics/log agent | Sentinel config；若部署 replica 則依 Redis 持久化策略 | 連 redis-01/02；提供 Sentinel quorum | 第三個 Sentinel vote，避免 2 節點腦裂 |
| `vm-ops-01` | 4 vCPU / 16 GiB RAM / 1 TB storage | Prometheus、Grafana、Alertmanager、log collector 或 forwarder、dashboard | 必要，依 metrics/log retention 調整 | scrape / collect 所有 VM 指標與 logs；發送告警 | 維運觀測節點；可接既有監控平台替代 |
| `vm-backup-01` | 4 vCPU / 16 GiB RAM / 2 TB storage | MongoDB backup job、restore drill workspace、備份校驗、異地同步 client | 必要，建議獨立磁碟、NAS 或物件儲存 | 連 MongoDB secondary 優先；可讀取必要設定與 secrets metadata | 備份與還原演練節點，不應與 primary DB 共用唯一 storage |
| `vm-vault-01`、`vm-vault-02`、`vm-vault-03`，若無既有平台 | 每台 4 vCPU / 8 GiB RAM / 100 GB storage | Vault / Secrets Manager HA、secret rotation、audit log | 必要，依 Vault HA 後端設計 | 僅允許 runtime 與維運節點依權限存取 | 若已有企業 Vault、Key Vault 或密碼管理平台，可不另建 |

### SIT/UAT VM 配置，固定規格

SIT/UAT 可沿用正式 HA 的角色邊界，但降低 App/Worker、Copilot CLI、Redis、Monitoring 與 Backup 的資源。這樣能驗證部署流程、網路隔離、queue、Copilot CLI endpoint、MongoDB replica set 與 Redis failover，同時避免把 SIT/UAT 誤當成正式容量基準。

| VM | SIT/UAT 規格 | 部署服務 | 說明 |
|---|---:|---|---|
| `vm-lb-01` | 2 vCPU / 4 GiB RAM / 60 GB disk | Nginx 或 HAProxy、Keepalived/VRRP、public API VIP、private CLI VIP | 入口 active 節點 |
| `vm-lb-02` | 2 vCPU / 4 GiB RAM / 60 GB disk | Nginx 或 HAProxy、Keepalived/VRRP、public API VIP、private CLI VIP | 入口 standby 節點 |
| `vm-app-01` | 4 vCPU / 16 GiB RAM / 100 GB disk | API replica 1、Worker x2、Bull Board optional、metrics/log agent | SIT/UAT API 與 worker 共用節點 |
| `vm-app-02` | 4 vCPU / 16 GiB RAM / 100 GB disk | API replica 2、Worker x2、Scheduler standby disabled、metrics/log agent | SIT/UAT API 與 worker 共用節點 |
| `vm-app-03` | 4 vCPU / 16 GiB RAM / 100 GB disk | Worker x2、Scheduler active x1、metrics/log agent | SIT/UAT worker 總數固定 6 |
| `vm-cli-01` | 1 vCPU / 2 GiB RAM / 50 GB disk / 10 GB session volume | Copilot CLI server replica 1 | SIT/UAT CLI active 節點 |
| `vm-cli-02` | 1 vCPU / 2 GiB RAM / 50 GB disk / 10 GB session volume | Copilot CLI server replica 2 | SIT/UAT CLI standby 或 active/active 驗證節點 |
| `vm-mongo-01` | 4 vCPU / 16 GiB RAM / 500 GB NVMe | MongoDB replica set member，primary candidate | SIT/UAT MongoDB primary candidate |
| `vm-mongo-02` | 4 vCPU / 16 GiB RAM / 500 GB NVMe | MongoDB replica set member，secondary | SIT/UAT MongoDB secondary |
| `vm-mongo-03` | 4 vCPU / 16 GiB RAM / 500 GB NVMe | MongoDB replica set member，secondary | SIT/UAT MongoDB majority quorum |
| `vm-redis-01` | 2 vCPU / 8 GiB RAM / 100 GB SSD | Redis primary candidate、Sentinel vote | SIT/UAT Redis primary candidate |
| `vm-redis-02` | 2 vCPU / 8 GiB RAM / 100 GB SSD | Redis replica candidate、Sentinel vote | SIT/UAT Redis replica candidate |
| `vm-redis-03` | 2 vCPU / 8 GiB RAM / 100 GB SSD | Redis Sentinel quorum vote | SIT/UAT 第三個 Sentinel vote |
| `vm-ops-01` | 2 vCPU / 8 GiB RAM / 500 GB storage | Prometheus、Grafana、Alertmanager、log collector | SIT/UAT 監控與告警驗證 |
| `vm-backup-01` | 2 vCPU / 8 GiB RAM / 1 TB storage | MongoDB backup job、restore drill workspace | SIT/UAT 備份與還原演練 |
| `vm-vault-01`、`vm-vault-02`、`vm-vault-03`，若無既有平台 | 每台 4 vCPU / 8 GiB RAM / 100 GB storage | Vault / Secrets Manager HA | 若已有企業 Secrets 平台，可不另建 |

### 服務分散原則

- API 與 Worker 可以共用 `vm-app-01`、`vm-app-02`、`vm-app-03`，但需設定 CPU/RAM resource limit，避免 worker 尖峰拖慢 API。
- Scheduler 只能有一個 active instance；standby 可預先部署但保持 disabled，故障時再切換。
- Copilot CLI 不建議與 MongoDB 或 Redis 共用 VM；它雖不跑模型推論，但會承擔 session orchestration 與 streaming 穩定性。
- MongoDB 三台 VM 應分散於不同實體主機或虛擬化 failure domain，避免同一宿主故障造成 replica set 失去 majority。
- Redis 固定使用 `vm-redis-01` primary candidate、`vm-redis-02` replica candidate 與 `vm-redis-03` Sentinel quorum vote；正式 HA 配置不採兩台 Redis VM 架構。
- Monitoring、Backup、Secrets 可接既有企業平台；若自建，應避免與 production runtime 或 primary DB 共用唯一主機與磁碟。

## 2. 硬體資源配置

以下規格以目前觀測到的 10 個 worker container、MongoDB 約 1.36 GiB physical size、MongoDB indexes 約 824.84 MiB、Redis current used memory 約 34.35 MiB、Redis peak 約 3.71 GiB，以及 Copilot CLI idle 約 294 MiB 作為基準。正式環境不應直接用 idle memory 推估，必須保留尖峰流量、queue backlog、LLM session concurrency、備份與 HA 容錯空間。

### 節點層級建議

| 節點類型 | SIT/UAT 配置 | 建議正式 HA 配置 | 可擴充配置 | 配置依據 |
|---|---:|---:|---:|---|
| Reverse Proxy / LB 節點 x2 | 每台 2 vCPU / 4 GiB RAM / 60 GB disk | 每台 2 vCPU / 4 GiB RAM / 60 GB disk | 每台 4 vCPU / 8 GiB RAM / 80 GB disk，仍維持 2 台 | HTTPS、SSE connection、TLS、健康檢查與故障切換 |
| App/Worker 節點 x3 | 每台 4 vCPU / 16 GiB RAM / 100 GB disk；worker 總數 6 | 每台 8 vCPU / 32 GiB RAM / 100 GB disk；worker 總數 10 | 每台 16 vCPU / 64 GiB RAM / 200 GB disk；worker 總數 20 | 10 workers baseline、API x2、scheduler、queue consumer 併發、rolling restart headroom |
| Copilot CLI 節點 x2 | 每台 1 vCPU / 2 GiB RAM / 50 GB disk | 每台 2 vCPU / 4 GiB RAM / 50 GB disk / 20 GB session volume | 每台 4 vCPU / 8 GiB RAM / 80 GB disk / 50 GB session volume，3 台 | session concurrency、streaming stability、LLM request rate、HA / affinity |
| MongoDB 節點 x3 | 每台 4 vCPU / 16 GiB RAM / 500 GB NVMe | 每台 4 vCPU / 16 GiB RAM / 1 TB NVMe | 每台 8 vCPU / 32 GiB RAM / 2 TB NVMe | index working set、slow query、connections、備份與 replica set 容錯 |
| Redis HA 節點 x3 | 每台 2 vCPU / 8 GiB RAM / 100 GB SSD | `vm-redis-01` 與 `vm-redis-02` 每台 4 vCPU / 16 GiB RAM / 200 GB SSD；`vm-redis-03` 2 vCPU / 8 GiB RAM / 100 GB SSD | 每台 4 vCPU / 16 GiB RAM / 200 GB SSD，3 台皆可承擔 replica | BullMQ retention、queue backlog、failed jobs、cache、refresh token state |
| Monitoring / Logging 節點 x1 | 2 vCPU / 8 GiB RAM / 500 GB storage | 4 vCPU / 16 GiB RAM / 1 TB storage | 8 vCPU / 32 GiB RAM / 2 TB storage | metrics、logs、dashboard、alert rules、incident analysis |
| Backup / Storage 節點 x1 | 2 vCPU / 8 GiB RAM / 1 TB storage | 4 vCPU / 16 GiB RAM / 2 TB storage | 8 vCPU / 32 GiB RAM / 4 TB storage，另加異地副本 | MongoDB daily snapshot/dump、restore drill、RPO/RTO |

### Runtime 服務資源建議

| 服務 | SIT/UAT 配置 | 建議正式 HA 配置 | 可擴充配置 | 備註 |
|---|---:|---:|---:|---|
| API app | 2 replicas，每個 1 vCPU / 2 GiB RAM | 2 replicas，每個 2 vCPU / 4 GiB RAM | 3 replicas，每個 2 vCPU / 4 GiB RAM | API 層多為 I/O bound，但 SSE 與 Agent runtime 需保留 connection headroom |
| Worker | 6 replicas，每個 1 vCPU / 1 GiB RAM | 10 replicas，每個 1 vCPU / 1 GiB RAM | 20 replicas，每個 1 vCPU / 1 GiB RAM；必要時拆 queue-specific workers | worker 數量應由 queue depth、job duration、LLM 429/5xx 共同決定 |
| Scheduler | 1 active，每個 0.5 vCPU / 512 MiB RAM | 1 active + 1 standby，每個 1 vCPU / 1 GiB RAM | active/passive，避免 active/active 重複 enqueue | scheduler 應維持 singleton，除非有明確分散式鎖與去重機制 |
| Copilot CLI Server | 2 replicas，每個 1 vCPU / 2 GiB RAM | 2 replicas，每個 2 vCPU / 4 GiB RAM | 3 replicas，每個 4 vCPU / 8 GiB RAM | 不執行模型推論，但承擔 session orchestration、streaming 與工具協調 |
| Redis | primary/replica/sentinel 共 3 節點；主要節點 2 vCPU / 8 GiB RAM | primary/replica/sentinel 共 3 節點；主要節點 4 vCPU / 16 GiB RAM | 3 節點皆 4 vCPU / 16 GiB RAM，或後續改 Redis Cluster | Redis current memory 很低，但 history peak 達 3.71 GiB，仍需保留 backlog 與 retention headroom |
| MongoDB | 3 節點，每個 4 vCPU / 16 GiB RAM / 500 GB NVMe | 3 節點，每個 4 vCPU / 16 GiB RAM / 1 TB NVMe | 3 節點，每個 8 vCPU / 32 GiB RAM / 2 TB NVMe | 目前資料不大，但 articles index 約 741 MiB，需預留成長與查詢 working set |

### 配置依據摘要

| 估算因素 | 對配置的影響 | 維運判斷方式 |
|---|---|---|
| 10 worker baseline | 決定 App/Worker 節點 CPU/RAM、Redis queue 壓力、MongoDB connections、Copilot CLI session 數 | 觀察 queue depth、job duration、active jobs、worker restart |
| queue depth / backlog | 決定 worker 是否擴到 20、Redis RAM 是否提高 | waiting 持續上升、prioritized jobs 堆積、job duration 變長 |
| LLM request rate | 決定 Copilot CLI replicas、connection affinity、LLM backoff/throttle | Copilot CLI session latency、LLM 429/5xx、timeout、cost per day |
| MongoDB working set | 決定 MongoDB RAM、IOPS、index tuning | slow query、index size、cache hit、connections、replication lag |
| Redis retention / failed jobs | 決定 Redis RAM 與 cleanup policy | Redis used memory、evictions、failed/completed job history、latency |
| HA 容錯需求 | 決定節點數、replica set、Sentinel quorum、LB/VIP | 是否可承受單一節點維護或故障、RPO/RTO 目標 |

## 3. 部署服務清單

| 服務 | 必要副本 | 用途 | 持久化需求 | 建議部署方式 | 是否可共用節點 |
|---|---:|---|---|---|---|
| Reverse Proxy / Nginx / HAProxy | 2 | HTTPS、反向代理、API health routing、SSE passthrough | 不需要；保留設定檔備份 | 獨立入口節點，搭配 VIP / VRRP 或硬體 LB | 可與 WAF/LB 共用，不建議與 DB 共用 |
| API app | 2 | REST API、SSE、Swagger optional、使用者流量、Agent API | 不需要本地持久化 | App/Worker 節點或獨立 app node pool | 可與 worker 共用 App/Worker 節點 |
| Worker | 10 baseline | queue consumers，處理 feed/article/assistant/brief/announcement | 不需要本地持久化 | App/Worker 節點，固定分散到 3 台 | 可與 API 共用，但需 resource limit |
| Scheduler | 1 active | cron producer，enqueue due feeds / briefs | 不需要本地持久化 | App/Worker 節點；standby 可同 image 預備 | 可共用，但必須避免多 active |
| Copilot CLI Server | 2 | LLM session orchestration、JSON-RPC / streaming、provider bridge | 建議保存 session state；active/active 需 affinity 或共享策略 | 優先獨立部署，透過 private endpoint 提供 API/Worker 使用 | 不建議與 MongoDB/Redis 共用；小型環境可與 app node 共用但需資源隔離 |
| MongoDB primary/secondary | 3 | 主資料庫 replica set | 必要；NVMe SSD，定期備份 | 獨立 DB 節點 | 不建議共用 |
| Redis primary/replica | 3 | BullMQ queue、cache、refresh token ID state | 視策略啟用 AOF/RDB；保留備份或重建程序 | 獨立 Redis 節點或 Redis HA appliance | 不建議與 API/Worker 共用正式資源 |
| Redis Sentinel | 3 votes | Redis failover quorum | 不需要大量 storage | 可部署於 Redis 節點或 App/Worker 節點 | 可共用，但需跨節點分散 |
| Monitoring | 1 | Prometheus/Grafana、logs、alerts、dashboard | 必要；依 retention 規劃 storage | 維運節點或既有監控平台 | 可與 logging 共用 |
| Log aggregation | 1 | API/worker/DB/Redis/CLI logs | 必要；依 log retention 規劃 | 維運節點或既有 SIEM/ELK/Loki | 可與 monitoring 共用，正式大流量建議拆分 |
| Backup job / repository | 1 | MongoDB dump/snapshot、設定與 secrets metadata 備份、restore drill | 必要；獨立儲存與權限 | 獨立備份主機、NAS 或物件儲存 | 不建議與 primary DB 共用唯一磁碟 |
| Secrets Manager / Vault | 3，若無既有平台 | 管理 Mongo/Redis/LLM/OAuth/JWT secrets | 必要 | 既有企業平台或獨立部署 | 可用既有平台；不建議把 secrets 放在 compose env 明文長期維護 |
| Bull Board / Queue dashboard | 1，可掛在 API 並加 basic auth | queue depth、failed jobs、runtime visibility | 不需要 | 僅內網或 VPN 開放 | 可掛 API，但 production 必須啟用認證 |

## 4. HA 與容錯設計

### API app

- API 固定 2 replicas，放在不同 App/Worker 節點。
- Reverse Proxy 或 LB 以 `GET /health` 做 readiness check；異常時自動摘除。
- API 本身應維持 stateless，session、cache 與 queue state 交給 Redis/MongoDB。
- Rolling restart 時需提供 graceful shutdown，避免 SSE 與 DB/Redis connection 被硬切。

### Worker

- baseline 維持 10 replicas，固定分散於 3 台 App/Worker 節點。
- worker 是主要吞吐旋鈕；擴充應依 queue depth、job duration、LLM provider 429/5xx 與 Copilot CLI latency 判斷。
- 若特定 queue 長期積壓，可評估 queue-specific worker pools，而不是只盲目增加所有 worker。
- 停止或滾動更新時需保留 grace period，讓 active jobs 正常完成或回到 queue。

### Scheduler

- scheduler 建議維持 active x1，避免重複 enqueue cron jobs。
- 可準備 standby instance，但預設不 active；故障時由維運或平台切換。
- 若未來要 active/active，必須先確認分散式鎖、job idempotency 與重複排程去重策略。

### Copilot CLI Server

- Copilot CLI 固定 2 replicas，透過 private LB / internal endpoint 提供給 API 與 Worker。
- 若採 active/active，需驗證 connection affinity 或 session state 策略，避免 streaming session 中斷或狀態不一致。
- 若 LLM request rate 高，建議將 API chat traffic 與 worker evaluation traffic 拆成不同 CLI endpoint，降低互相影響。
- CLI 需納入 healthcheck、restart policy、session latency dashboard 與 error rate 告警。

### MongoDB

- 建議 3-node replica set，primary + 2 secondaries，分散於不同實體主機或虛擬化 failure domain。
- 寫入建議採 majority write concern；讀取預設走 primary，必要時再評估 read preference。
- 定期備份 primary 或 secondary，並固定做 restore drill。
- 監控 replication lag、oplog window、connections、slow query、disk usage 與 index growth。

### Redis / BullMQ

- Redis 固定採 primary + replica + 第三個 Sentinel vote；若使用企業既有 Redis HA appliance，需提供等效 3 votes 或等效仲裁能力。
- Redis 同時承載 BullMQ、cache 與 refresh token ID state，正式環境禁止使用 `FLUSHDB`、`FLUSHALL` 或 broad key deletion。
- BullMQ completed/failed history 必須透過 retention policy 與 BullMQ API 清理，不可直接刪 Redis key prefix。
- 是否啟用 AOF/RDB 需依 queue 可重建程度決定；即使 queue 可重建，也應保留 failure log 與 operational record。

### 主要單點故障與改善建議

| 風險 | 影響 | 改善建議 |
|---|---|---|
| 單一 Reverse Proxy / LB | 使用者無法進入系統 | 2 台 reverse proxy + VIP / VRRP，或硬體/虛擬 LB HA |
| API 單副本 | API deploy 或故障時服務中斷 | API 固定 x2，LB healthcheck 自動摘除異常節點 |
| Worker 集中於單一節點 | 背景處理停擺或 backlog 快速上升 | 10 workers 固定分散到 3 台節點，擴充配置為 20 workers |
| Scheduler 無 standby | 到期 feed/brief 無法 enqueue | standby 預備與明確切換程序；避免多 active |
| Copilot CLI 單點 | Agent chat、article extraction、assistant evaluation 受影響 | CLI 固定 x2、private LB、session affinity |
| MongoDB 單機 | 主資料不可用或資料遺失風險 | 3-node replica set、daily backup、restore drill |
| Redis 單機 | queue/cache/token state 受影響 | primary/replica + Sentinel，保留 failover runbook |
| Backup 與 DB 共用唯一 storage | DB 主機故障時備份也不可用 | 獨立 NAS/備份主機/異地保存，定期還原演練 |
| 外部 LLM provider 不穩 | LLM jobs timeout、429、成本或延遲上升 | backoff/throttle、rate limit dashboard、provider fallback 評估 |

## 5. 維運與監控建議

正式環境不應只依據閒置資源估算。現況 worker 與 Copilot CLI idle memory 看起來不高，但 ingestion 尖峰、assistant evaluation、queue backlog、LLM request rate 與 HA failover 都會放大資源需求。維運監控應以「使用者體驗、queue 吞吐、資料層健康、LLM runtime 穩定性」作為主要判斷依據。

### 關鍵監控指標與建議告警

| 類別 | 指標 | 建議告警門檻 | 維運意義 |
|---|---|---|---|
| Node | CPU、RAM、load average、disk usage、disk I/O wait | CPU > 70% 持續 15 分鐘、RAM > 80%、disk > 70%、I/O wait 持續升高 | 判斷節點是否需要擴容或分流 |
| API | p95 latency、5xx rate、SSE disconnect、request rate | p95 > 1s、5xx > 1%、SSE disconnect 異常升高 | 判斷 API replicas、DB/Redis/CLI 依賴是否異常 |
| Worker | queue depth、active jobs、job duration、failed rate、restart count | waiting > 1,000 或持續上升、failed rate > 5%、job duration p95 明顯升高 | 判斷是否需擴 worker、調整 queue 或處理外部瓶頸 |
| BullMQ | waiting/active/delayed/prioritized/completed/failed counts | prioritized jobs 長時間不降、failed jobs 快速累積 | 判斷 queue 是否積壓或 processor 是否異常 |
| Redis | used memory、memory fragmentation、evictions、ops/sec、latency、replication health | memory > 75%、evictions > 0、replica lag、latency spike | 判斷 Redis RAM、retention、failover 是否健康 |
| MongoDB | slow query、connections、index size、working set、replication lag、oplog window、disk usage | slow query 增加、connections > 80%、replication lag 上升、disk > 70% | 判斷 query/index、RAM、IOPS 與備份風險 |
| Copilot CLI | session latency、active sessions、error rate、restart count、connection count | p95 latency > 2s、error > 1%、restart、connection spike | 判斷 CLI replicas、affinity、LLM runtime 是否不足 |
| LLM provider | latency、429/5xx、timeout、cost per day | 出現 429、5xx 升高、每日成本超標 | 判斷是否需 backoff、throttle、分流或調整 provider 配額 |
| Backup | backup success、backup duration、restore drill result、RPO/RTO | backup failed、restore drill 未通過、duration 異常拉長 | 確認資料保護是否可用，不只看排程是否存在 |
| Security | login failures、admin audit、secret rotation、TLS cert expiry | 異常登入、權限異動、憑證即將過期 | 降低帳號、憑證與維運風險 |

### 維運建議

1. 建立 baseline dashboard：固定包含 API latency、queue depth、job duration、Redis memory、Mongo slow query、Copilot CLI latency 與 LLM 429/5xx。
2. 建立容量決策門檻：worker 擴充以 queue depth 與 job duration 為主，不只看 CPU。
3. 建立 failover runbook：Reverse Proxy、API、Worker、Copilot CLI、Redis、MongoDB 都需有故障切換與回復流程。
4. 建立 backup / restore drill：MongoDB 每日備份一次，並每季演練還原一次；沒有演練就不能視為已達成 RPO/RTO。
5. 建立 Redis cleanup 原則：BullMQ history cleanup 必須使用 BullMQ API 與 retention policy，避免 Redis-wide deletion。
6. 建立 Copilot CLI dashboard：追蹤 session latency、active sessions、error rate、restart 與 LLM provider error。
7. 建立部署 grace period：API、Worker、Scheduler rolling restart 時需保留足夠時間關閉 MongoDB、Redis 與 active jobs。
8. 建立容量複核週期：正式上線後每 4 週複核資料成長、index size、queue backlog、LLM 成本與 node headroom。

## 6. 建議落地順序

| 階段 | 工作項目 | 完成判斷 |
|---|---|---|
| 1. 基礎設施準備 | 建立 LB/Reverse Proxy、App/Worker 節點、MongoDB RS、Redis HA、Copilot CLI 節點、監控與備份儲存 | 所有節點可互通，private network 與 firewall policy 完成 |
| 2. Runtime 部署 | 部署 API x2、Worker x10、Scheduler x1、Copilot CLI x2，設定 `COPILOT_CLI_URL` private endpoint | API `/health` 正常，worker 可消化 queue，scheduler 無重複 enqueue |
| 3. 資料與 queue 驗證 | 驗證 MongoDB replica set、Redis failover、BullMQ retention、queue dashboard | replica/failover 正常，Redis memory 與 queue counts 可觀測 |
| 4. 壓測與瓶頸確認 | 執行 ingestion、article processing、assistant evaluation 壓測 | queue depth 可回落，job duration 可接受，CLI/LLM 無大量 timeout/429 |
| 5. 備份與 DR 演練 | 執行 MongoDB restore drill、Redis recovery procedure、服務節點故障演練 | RPO/RTO 可被驗證，維運 runbook 可操作 |
| 6. 正式切換 | DNS/LB 切換，開啟正式監控與告警 | 服務穩定，告警可用，容量 headroom 符合預期 |

## 7. 維運評估結論

地端 HA 版建議以 `App/Worker 節點 x3 + Copilot CLI x2 + MongoDB replica set x3 + Redis HA x3 + Reverse Proxy/LB x2 + 獨立監控/備份` 作為正式規劃基準。

SIT/UAT 部署可以先讓 API 與 Worker 共用 App/Worker 節點，但 MongoDB、Redis、Copilot CLI 與入口層仍應維持獨立角色，避免同機資源競爭與單點故障。正式容量調整不應只看目前 idle CPU/RAM，而應依 queue depth、job duration、MongoDB working set、Redis memory、Copilot CLI session latency、LLM provider 429/5xx 與 HA failover 測試結果共同判斷。