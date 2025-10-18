# 🚀 VSCode-Kafka-Client: Product Roadmap & Strategy

**Version**: 2.1 (Phase 1 Complete)
**Last Updated**: October 18, 2025
**Status**: ✅ Phase 1 Complete - Ready for v0.10.0 Release
**Owner**: Product Team

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Market Positioning & Competitive Analysis](#market-positioning--competitive-analysis)
3. [User Personas & Requirements](#user-personas--requirements)
4. [Product Roadmap](#product-roadmap)
5. [Connection Management Enhancements](#connection-management-enhancements)
6. [Security Considerations](#security-considerations)
7. [Technical Implementation Guide](#technical-implementation-guide)
8. [Testing Strategy & Test Cases](#testing-strategy--test-cases)
9. [Success Metrics & KPIs](#success-metrics--kpis)
10. [Risk Management](#risk-management)
11. [Appendix: Deferred Features](#appendix-deferred-features)

---

## 📌 Executive Summary

### 🎯 **Vision**
> **"The Developer-First Kafka IDE — Manage Kafka without leaving your code"**

### 🔥 **Top 3 Priorities (Next 90 Days)**

1. **Schema Registry Integration** (Sprint 1, Week 3-5)
   - **Why**: 🔴 Blocking 30% of users; all competitors have it
   - **Impact**: Unlocks data engineers, enables Avro/Protobuf workflows
   - **Effort**: 24h (incl. security)

2. **Message Search & Filters** (Sprint 1, Week 3-5)
   - **Why**: 🔴 Debugging workflow broken; 60% user demand
   - **Impact**: Core developer workflow; search by key/offset/timestamp
   - **Effort**: 13h (incl. security)

3. **Scalable List Views** (Sprint 2, Week 6-8)
   - **Why**: 🔴 Extension crashes with 1000+ topics
   - **Impact**: Enables enterprise adoption; ops team workflows
   - **Effort**: 21h (incl. security)

### 📅 **Release Timeline**

```
Week 1-2:   v0.8.9 (Hotfix)     → ✅ DONE - Fixed UX (sorting, search focus)
Week 3-10:  v0.10.0 (Major)     → ✅ DONE - Schema + Search + Scale (Developer Essentials)
Week 11-16: v0.11.0 (Major)     → Code Export + AI (Unique Differentiators)
```

### 🎯 **What Makes Us Different**

| Feature | Us | Conduktor | Lenses | AKHQ | Kpow |
|---------|-----|-----------|--------|------|------|
| **IDE Integration** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **AI-Assisted Config** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Code Export** (v0.11) | ⏳ | ❌ | ❌ | ❌ | ❌ |
| **Free & Open Source** | ✅ | ❌ ($600/yr) | ❌ ($$$$) | ✅ | ❌ ($$) |
| **Schema Registry** | ✅ v0.10 | ✅ | ✅ | ✅ | ✅ |
| **Message Search** | ✅ v0.10 | ✅ | ✅ | ✅ | ✅ |

**Tagline**: *"The only Kafka tool that lives in your IDE — produce, consume, debug, and generate code without context switching."*

---

## 📊 Market Positioning & Competitive Analysis

### 🏆 **Competitive Feature Matrix**

| Feature Category | VSCode Ext | Conduktor | Lenses | AKHQ | Kpow | Offset Explorer | **Market Gap** |
|-----------------|------------|-----------|--------|------|------|-----------------|----------------|
| **🔧 Core Operations** |
| Topic CRUD | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Competitive |
| Message Produce/Consume | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Competitive |
| Consumer Group Mgmt | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Competitive |
| ACL Management | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ✅ **Ahead** |
| Broker Monitoring | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ Competitive |
| **🎨 UX & Navigation** |
| Multi-Cluster | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Competitive |
| Topic Search & Focus | ✅ v0.8.9 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Competitive |
| Message Search/Filter | ✅ v0.10 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Competitive |
| Lag Monitoring/Alerts | ✅ v0.10 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ Competitive |
| Partition Navigation | ✅ v0.10 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Competitive |
| Scalability (1k+ topics) | ✅ v0.10 | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ Competitive |
| **📦 Data Quality** |
| Schema Registry | ✅ v0.10 | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ Competitive |
| Avro/Protobuf/JSON | ⚠️ Service Only | ✅ | ✅ | ✅ | ✅ | ⚠️ | 🟡 **Behind** (Phase 1B) |
| Data Masking | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | 🟢 Niche (defer) |
| **💻 Developer Experience** |
| IDE Integration | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟢 **UNIQUE** |
| Message Templates | ✅ (4 types) | ❌ | ❌ | ❌ | ❌ | ❌ | 🟢 **UNIQUE** |
| AI-Assisted Config | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟢 **UNIQUE** |
| Code Export | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟢 **UNIQUE** (v1.0) |
| **🏢 Enterprise** |
| RBAC/SSO | N/A | ✅ | ✅ | ⚠️ | ✅ | ❌ | 🟢 Out of scope (VSCode handles) |
| Audit Logs | ✅ Basic | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ Competitive |
| Kafka Connect | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | 🟡 Nice-to-have (defer) |

### 📊 **Market Research Insights**

Based on analysis of Conduktor, Lenses, AKHQ, Kpow, and Offset Explorer:

**✅ Table Stakes (Must-Have)**:
- Topic/partition management ✅ (we have)
- Consumer group monitoring ✅ (we have)
- Message produce/consume ✅ (we have)
- Schema Registry ❌ (CRITICAL GAP)
- Message search/filter ❌ (CRITICAL GAP)

**🟢 Differentiators (Nice-to-Have)**:
- IDE integration ✅ (UNIQUE)
- AI assistance ✅ (UNIQUE)
- Code generation ⏳ (v1.0)

**🟡 Enterprise Features (Out of Scope)**:
- RBAC/SSO (VSCode handles auth)
- Data masking (compliance feature)
- Kafka Connect UI (dedicated tools exist)

### 🎯 **Strategic Positioning**

**Target Market**: Individual developers & small teams (10-100 engineers)
**Anti-Target**: Enterprise ops teams with dedicated Kafka admins (use Confluent Control Center)

**Positioning Statement**:
> *"For backend developers who work with Kafka daily, VSCode-Kafka-Client is the only IDE-native tool that lets you produce, consume, and debug Kafka messages without leaving your code editor — unlike Conduktor or Offset Explorer which require constant context switching."*

---

## 👥 User Personas & Requirements

### **Persona 1: Backend Developer (60% of users)** 🎯 **PRIMARY**

**Profile**:
- **Name**: Alex (Backend Engineer)
- **Job**: Build Node.js/Java microservices that use Kafka
- **Daily Workflow**: Code → test locally → check Kafka → repeat
- **Tools**: VSCode, Docker, Postman, Git

**Pain Points**:
1. ❌ "I have to switch to Offset Explorer to verify my message was produced"
2. ❌ "I can't remember Avro schema formats — keep Googling examples"
3. ❌ "Searching for a topic in a 500-topic cluster takes forever"
4. ❌ "I waste time rewriting test messages into production code"

**Must-Have Features**:
| Feature | Priority | Why | Timeline |
|---------|----------|-----|----------|
| Message Search | 🔴 Critical | "Did my order-123 message arrive?" | Sprint 1 |
| Schema Registry | 🔴 Critical | "Validate Avro before producing" | Sprint 1 |
| Topic Search (focus) | 🔴 Critical | "Find topics fast" | Phase 0 |
| Code Export | 🟢 High | "Copy produce() to my app" | v1.0 |
| Message Templates | ✅ Have | "Pre-fill common payloads" | ✅ Done |

**User Story**:
> "As a backend developer, I want to produce a test message, search for it by key, validate its schema, and then export the working code to my application — all without leaving VSCode."

---

### **Persona 2: DevOps/SRE (30% of users)** 🎯 **SECONDARY**

**Profile**:
- **Name**: Jordan (Site Reliability Engineer)
- **Job**: Monitor Kafka clusters, troubleshoot production issues
- **Daily Workflow**: Alerts → investigate lag → reset offsets → repeat
- **Tools**: Grafana, Prometheus, kubectl, VSCode

**Pain Points**:
1. ❌ "Consumer lag alerts are manual — I find out when users complain"
2. ❌ "Can't drill down to see which partition is lagging"
3. ❌ "Resetting offsets requires remembering CLI syntax"
4. ❌ "Large clusters (1000+ topics) crash the extension"

**Must-Have Features**:
| Feature | Priority | Why | Timeline |
|---------|----------|-----|----------|
| Partition Navigation | 🔴 Critical | "Show leader/replicas/ISR" | Sprint 2 |
| Scalable List Views | 🔴 Critical | "Handle 1000+ topics" | Sprint 2 |
| Lag Alerts | 🟡 High | "Proactive monitoring" | Sprint 3 |
| Offset Reset UI | ✅ Have | "No CLI needed" | ✅ Done |
| Metrics Export | 🟢 Medium | "Export to Grafana" | Phase 2 |

**User Story**:
> "As an SRE, I want to get proactive lag alerts, drill down to partition-level details, and reset offsets through a UI — so I can troubleshoot issues faster during incidents."

---

### **Persona 3: Data Engineer (10% of users)** 🎯 **TERTIARY**

**Profile**:
- **Name**: Sam (Data Engineer)
- **Job**: Build data pipelines with Avro/Protobuf schemas
- **Daily Workflow**: Design schema → register → test → deploy
- **Tools**: Confluent Schema Registry, Airflow, dbt

**Pain Points**:
1. ❌ "No Schema Registry integration in VSCode extensions"
2. ❌ "Can't validate Avro schemas before producing"
3. ❌ "Have to use curl commands for schema management"

**Must-Have Features**:
| Feature | Priority | Why | Timeline |
|---------|----------|-----|----------|
| Schema Registry | 🔴 Critical | "Manage schemas in IDE" | Sprint 1 |
| Avro/Protobuf Support | 🔴 Critical | "Validate before producing" | Sprint 1 |
| Schema Versioning | 🟡 High | "View history" | v1.1 |
| Kafka Connect | 🟢 Low | "Deploy connectors" | Defer to v2.0 |

**User Story**:
> "As a data engineer, I want to create and validate Avro schemas in VSCode, produce messages that conform to those schemas, and see validation errors before they hit production."

---

## 🗺️ Product Roadmap

### **Phase 0: Pre-Launch Fixes (v0.8.9)** — **1 week** (7h)

> **Goal**: Fix **broken UX** that users complain about today — don't build new features on broken foundations

| ID | Feature | User Complaint | Effort | Priority | Security |
|----|---------|----------------|--------|----------|----------|
| 2.2 | **Topic Sorting** | "Can't find topics in unsorted mess" | 2h | 🔴 Blocker | - |
| 2.3 | **Search Focus (TreeView.reveal)** | "Search doesn't focus results" | 3h | 🔴 Blocker | - |
| SEC-LOG | **Logger Sanitization** | "Security audit before launch" | 2h | 🔴 Blocker | SEC-2.1-1 |

**Implementation**:

```typescript
// 2.2 Topic Sorting (src/providers/kafkaExplorerProvider.ts)
const topics = await admin.listTopics();
topics.sort((a, b) => a.localeCompare(b)); // Simple alphabetical
// Add setting: kafka.topicSortBy: 'name' | 'partitions'

// 2.3 Search Focus
await this.treeView.reveal(foundNode, { select: true, focus: true });

// SEC-LOG Logger Sanitization (src/infrastructure/Logger.ts)
private sanitize(data: any): any {
  const SENSITIVE = ['saslPassword', 'sslPassword', 'awsSecretAccessKey', 'principal'];
  if (typeof data === 'object') {
    for (const key of SENSITIVE) {
      if (key in data) data[key] = '[REDACTED]';
    }
  }
  return data;
}
```

**Testing**:
- Manual: Verify sorted topics, search focuses correctly
- Security: Grep logs for "saslPassword" → should return zero matches

**Release**: v0.8.9 (Hotfix) — **Ship by Week 2**

---

### **Phase 1: Developer Essentials (v0.9.0)** — **8 weeks** (87h)

> **Goal**: Close critical market gaps — make extension **useful for daily dev work** (80% of use cases)

---

#### **Sprint 1 (Week 3-5): Schema Registry + Message Search** 🔥

**Objective**: Enable data teams & debugging workflows

| ID | Feature | User Story | Effort | Security | Total |
|----|---------|------------|--------|----------|-------|
| **3.1** | **Schema Registry Integration** | "Validate Avro before producing" | 16h | +8h (SEC-3.1) | **24h** |
| **1.2.1** | **Message Search/Filter** | "Find message by key/timestamp" | 11h | +2h (SEC-1.2) | **13h** |
| **Total** | | | **27h** | **+10h** | **37h** |

**Deliverables**:
1. Schema Registry service (Confluent/MSK compatible)
2. Schema viewer in topic details
3. Avro/Protobuf validation in producer
4. Message search bar (key/offset/timestamp filters)
5. Seek to timestamp via `Admin.fetchTopicOffsetsByTimestamp()`

**Implementation Details**:

**3.1 Schema Registry** (24h):
```typescript
// NEW: src/services/SchemaRegistryService.ts
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';

export class SchemaRegistryService {
  private registry: SchemaRegistry;

  constructor(url: string, auth: { username: string; password: string }) {
    // SEC-3.1-1: Store credentials in CredentialManager (SecretStorage)
    // SEC-3.1-3: Enforce HTTPS
    if (!url.startsWith('https://')) {
      throw new Error('Schema Registry must use HTTPS');
    }

    this.registry = new SchemaRegistry({
      host: url,
      auth: { username: auth.username, password: auth.password }
    });
  }

  async getLatestSchema(subject: string): Promise<Schema> {
    // SEC-3.1-5: Audit schema fetches
    AuditLog.success(AuditOperation.SCHEMA_FETCHED, clusterName, subject);
    return await this.registry.getLatestSchemaId(subject);
  }

  async validateMessage(subject: string, payload: any): Promise<boolean> {
    const schema = await this.getLatestSchema(subject);
    return await this.registry.encode(schema.id, payload);
  }
}

// EXTEND: src/infrastructure/CredentialManager.ts
export interface StoredCredentials {
  saslPassword?: string;
  // ... existing
  schemaRegistryApiKey?: string;      // SEC-3.1-1
  schemaRegistryApiSecret?: string;   // SEC-3.1-1
}
```

**1.2.1 Message Search** (13h):
```typescript
// EXTEND: src/views/MessageConsumerWebview.ts
// Add search bar HTML:
<input type="text" id="searchKey" placeholder="Search by key (regex)">
<input type="number" id="searchOffset" placeholder="Seek to offset">
<input type="datetime-local" id="searchTimestamp" placeholder="Seek to timestamp">

// Client-side filtering (SEC-1.2-1: never send regex to Kafka)
function filterMessages(messages, filters) {
  return messages.filter(msg => {
    if (filters.key && !new RegExp(filters.key).test(msg.key)) return false;
    if (filters.offset && msg.offset < filters.offset) return false;
    return true;
  });
}

// Server-side: Seek to timestamp
async function seekToTimestamp(topic: string, timestamp: number) {
  const offsets = await admin.fetchTopicOffsetsByTimestamp(topic, timestamp);
  consumer.seek({ topic, partition: 0, offset: offsets[0].offset });
}
```

**Security Requirements** (Sprint 1):
| ID | Requirement | Implementation | Effort |
|----|-------------|----------------|--------|
| SEC-3.1-1 | Store SR credentials securely | Extend `CredentialManager` | 2h |
| SEC-3.1-2 | Redact schema field values | Show types only, not examples | 3h |
| SEC-3.1-3 | Require HTTPS for SR | Validate URL starts with https:// | 1h |
| SEC-3.1-4 | Cache schemas securely | Use `globalState`, not workspace | 2h |
| SEC-1.2-1 | Client-side regex only | Filter after fetch, never send to Kafka | 0h (design) |
| SEC-1.2-2 | Warn on PII search | If term looks like email/CC | 2h |

**Testing**:
- Schema Registry: Connect to Confluent Cloud + MSK; validate Avro/Protobuf
- Message Search: 10,000 messages; search by key/offset/timestamp; no performance degradation
- Security: SR credentials not in logs; HTTPS enforced; no XSS in search

**User Impact**: 🔥 **Massive**
- Unlocks 30% of users (data engineers)
- Closes gap with Conduktor/Lenses
- Enables debugging workflows (60% user request)

---

#### **Sprint 2 (Week 6-8): Partitions + Scalability** 🔥

**Objective**: Unblock ops teams & handle large clusters

| ID | Feature | User Story | Effort | Security | Total |
|----|---------|------------|--------|----------|-------|
| **3.6** | **Partition Navigation** | "Show partition leaders/replicas" | 10h | +3h (SEC-3.6) | **13h** |
| **3.7** | **Scalable List Views** | "Handle 1000+ topics without crash" | 14h | +7h (SEC-3.7) | **21h** |
| **Total** | | | **24h** | **+10h** | **34h** |

**Deliverables**:
1. Expandable partition nodes in tree view
2. Partition details (leader, replicas, ISR, lag)
3. Right-click actions: "View Offsets", "Reassign Leader"
4. Webview for large topic lists (pagination)
5. Threshold warning: "1500 topics — view in page"

**Implementation Details**:

**3.6 Partition Navigation** (13h):
```typescript
// EXTEND: src/providers/kafkaExplorerProvider.ts
class PartitionsTreeItem extends vscode.TreeItem {
  constructor(topicName: string, clusterName: string) {
    super('Partitions', vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'partitionsContainer';
  }

  async getChildren(): Promise<TreeItem[]> {
    const metadata = await admin.fetchTopicMetadata({ topics: [topicName] });
    return metadata.topics[0].partitions.map(p => new PartitionTreeItem({
      partition: p.partitionId,
      leader: p.leader,
      replicas: p.replicas,
      isr: p.isr
    }));
  }
}

// NEW: src/commands/partitionCommands.ts
export async function viewPartitionOffsets(node: PartitionTreeItem) {
  const offsets = await admin.fetchTopicOffsets(node.topicName);
  const partition = offsets.find(o => o.partition === node.partitionId);

  vscode.window.showInformationMessage(
    `Partition ${node.partitionId}: Low ${partition.low}, High ${partition.high}`
  );
}
```

**3.7 Scalable List Views** (21h):
```typescript
// NEW: src/views/TopicsWebview.ts
export class TopicsWebview {
  private readonly THRESHOLD = 50; // kafka.explorer.largeListThreshold setting

  async show(clusterName: string, topics: string[]) {
    if (topics.length > this.THRESHOLD) {
      // Show warning in tree + open webview
      return this.showLargeListWebview(topics);
    }
    // Normal tree view
  }

  private getHtmlContent(topics: string[]): string {
    // SEC-3.7-1: Escape HTML
    const rows = topics.map(topic => `
      <tr>
        <td>${escapeHtml(topic)}</td>
        <td><button onclick="viewTopic('${escapeHtml(topic)}')">View</button></td>
      </tr>
    `).join('');

    return `
      <table>
        <thead><tr><th>Topic</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <!-- SEC-3.7-2: Pagination (load 100 at a time) -->
      <button onclick="loadMore()">Load More</button>
    `;
  }
}
```

**Security Requirements** (Sprint 2):
| ID | Requirement | Implementation | Effort |
|----|-------------|----------------|--------|
| SEC-3.6-1 | Obfuscate broker IPs | Show "Broker 1, 2, 3" not IP addresses | 2h |
| SEC-3.6-2 | Audit partition views | Log `PARTITION_VIEWED` | 1h |
| SEC-3.7-1 | Escape HTML in webviews | Use `escapeHtml()` for all user data | 2h |
| SEC-3.7-2 | Paginate webview data | Load 100 items at a time | 4h |
| SEC-3.7-4 | Validate webview messages | Whitelist commands | 1h |

**Testing**:
- Partitions: Expand topic → see all partitions; right-click → view offsets
- Scalability: Load 1000 topics in <3s; 2000 topics → webview; search 5000 topics
- Performance: VSCode memory <500MB with 1k topics loaded
- Security: XSS test with topic name `<script>alert(1)</script>` → should be escaped

**User Impact**: 🔥 **Critical**
- Unblocks ops teams (40% of users)
- Enables enterprise adoption (large clusters)
- Matches Conduktor/AKHQ performance

---

#### **Sprint 3 (Week 9-10): Lag Alerts + Polish** 🟡

**Objective**: Proactive monitoring & producer enhancements

| ID | Feature | User Story | Effort | Security | Total |
|----|---------|------------|--------|----------|-------|
| **3.2** | **Lag Monitoring & Alerts** | "Get notified when lag is critical" | 10h | +3h (SEC-3.2) | **13h** |
| **1.1.1** | **Producer Enhancements** | "GZIP compression + Avro template" | 3h | - | **3h** |
| **Total** | | | **13h** | **+3h** | **16h** |

**Deliverables**:
1. Configurable lag thresholds (warning: 1k, critical: 10k)
2. Toast notifications for lag alerts
3. Visual lag indicators in tree (color-coded consumer groups)
4. "Mute Alerts" button
5. GZIP compression dropdown in producer
6. Avro message template (ties to 3.1 Schema Registry)

**Implementation Details**:

**3.2 Lag Alerts** (13h):
```typescript
// EXTEND: src/views/clusterDashboardWebview.ts
export class LagMonitor {
  private thresholds = { warning: 1000, critical: 10000 }; // kafka.lagThresholds setting
  private lastAlertTime = new Map<string, number>();

  async monitorLag(clusterName: string) {
    setInterval(async () => {
      const groups = await admin.listGroups();

      for (const group of groups.groups) {
        const offsets = await admin.fetchOffsets({
          groupId: group.groupId,
          resolveOffsets: true
        });

        const lag = this.calculateLag(offsets);

        // SEC-3.2-1: Throttle alerts (max 1 per 5 mins per cluster)
        if (this.shouldAlert(clusterName, lag)) {
          vscode.window.showWarningMessage(
            `⚠️ Lag critical: ${group.groupId} (${lag} messages)`,
            'View Group', 'Mute Alerts'
          );
        }
      }
    }, 30000); // Poll every 30s
  }

  private shouldAlert(cluster: string, lag: number): boolean {
    const lastAlert = this.lastAlertTime.get(cluster) || 0;
    const now = Date.now();
    if (now - lastAlert < 300000) return false; // 5 min throttle

    if (lag >= this.thresholds.critical) {
      this.lastAlertTime.set(cluster, now);
      return true;
    }
    return false;
  }
}
```

**1.1.1 Producer Enhancements** (3h):
```typescript
// EXTEND: src/views/MessageProducerWebview.ts
// Add dropdown in HTML:
<select id="compression">
  <option value="none">No Compression</option>
  <option value="gzip">GZIP</option>
  <!-- NOTE: Snappy/LZ4/ZSTD require external codecs (not natively supported) -->
</select>

// Add Avro template (ties to 3.1 Schema Registry):
const templates = {
  // ... existing (simple, user-event, order, iot-telemetry)
  'avro-user': {
    key: 'user-001',
    value: JSON.stringify({
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: new Date().toISOString()
    }),
    headers: { 'content-type': 'application/avro' }
  }
};
```

**Security Requirements** (Sprint 3):
| ID | Requirement | Implementation | Effort |
|----|-------------|----------------|--------|
| SEC-3.2-1 | Throttle alerts | Max 1 toast per cluster per 5 mins | 1h |
| SEC-3.2-2 | Aggregate alerts | "3 groups lagging" instead of 3 toasts | 2h |
| SEC-3.2-3 | User opt-in | Default `kafka.lagAlerts: false` | 0.5h |

**Testing**:
- Lag Alerts: Simulate lag > 10k; verify toast appears; verify throttling (no spam)
- Producer: Produce with GZIP; verify compression applied; load Avro template
- Security: Alerts don't reveal sensitive topology details

**User Impact**: 🟡 **High**
- Proactive ops (20% user request)
- Matches Kpow/Lenses alerting
- Improved producer UX

---

**Phase 1 Summary**:
- **Total Effort**: 87 hours (~2 devs for 8 weeks at 50% allocation)
- **Security Overhead**: +29 hours (included in total)
- **Release**: v0.9.0 (Major) — **"Production-Ready: Schema, Search, Scale"**
- **Banner**: *"Now with Schema Registry, Message Search, and Enterprise Scalability"*

---

### **Phase 2: Developer Superpowers (v1.0.0)** — **6 weeks** (41h)

> **Goal**: Add **unique features** competitors don't have (differentiation)

---

#### **Sprint 4 (Week 11-13): Code Export + AI** 🟢 **UNIQUE**

**Objective**: Differentiate from all competitors

| ID | Feature | User Story | Competitive Edge | Effort |
|----|---------|------------|------------------|--------|
| **NEW-1** | **Export to Code** | "Copy produce() to my app" | ❌ **Nobody has this** | 12h |
| **2.4** | **AI for Cursor** | "AI suggestions in Cursor IDE" | ❌ **Only we have AI** | 6h |
| **1.4.2** | **Logs Panel** | "Filterable debug logs" | ⚠️ Basic in tools | 4h |
| **Total** | | | | **22h** |

**Deliverables**:
1. "Export to Code" button in producer/consumer webviews
2. Support Node.js, Python, Java, Go
3. AI fallback for Cursor IDE
4. Dedicated logs panel (filter by level, search)

**Implementation Details**:

**NEW-1: Code Export** (12h):
```typescript
// NEW: src/services/CodeExportService.ts
export class CodeExportService {
  exportProducer(config: ProducerConfig, language: 'nodejs' | 'python' | 'java' | 'go'): string {
    switch (language) {
      case 'nodejs':
        return `
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: '${config.clientId}',
  brokers: ${JSON.stringify(config.brokers)},
  ${config.sasl ? `sasl: ${JSON.stringify(config.sasl)},` : ''}
  ${config.ssl ? `ssl: true,` : ''}
});

const producer = kafka.producer();
await producer.connect();

await producer.send({
  topic: '${config.topic}',
  messages: [
    {
      key: '${config.message.key}',
      value: ${JSON.stringify(config.message.value)},
      ${config.message.headers ? `headers: ${JSON.stringify(config.message.headers)},` : ''}
    }
  ]
});

await producer.disconnect();
        `;

      case 'python':
        return `
from kafka import KafkaProducer
import json

producer = KafkaProducer(
    bootstrap_servers=${JSON.stringify(config.brokers)},
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

producer.send(
    '${config.topic}',
    key=b'${config.message.key}',
    value=${JSON.stringify(config.message.value)}
)

producer.flush()
producer.close()
        `;

      // ... similar for Java, Go
    }
  }
}

// EXTEND: src/views/MessageProducerWebview.ts
// Add button:
<button onclick="exportCode()">📋 Export to Code</button>
<select id="exportLanguage">
  <option value="nodejs">Node.js</option>
  <option value="python">Python</option>
  <option value="java">Java</option>
  <option value="go">Go</option>
</select>
```

**2.4: AI for Cursor** (6h):
```typescript
// EXTEND: src/services/AIAdvisor.ts
export class AIAdvisor {
  async checkAvailability(): Promise<boolean> {
    // Check if VSCode LM API is available
    if (vscode.env.appName.includes('Cursor')) {
      // Cursor fork may not expose vscode.lm API
      return false; // Fallback to OutputChannel
    }

    const models = await vscode.lm.selectChatModels();
    return models.length > 0;
  }

  async getAdvice(topic: string, config: any): Promise<string> {
    if (!await this.checkAvailability()) {
      // Fallback for Cursor: output to panel instead of LM API
      return this.getFallbackAdvice(topic, config);
    }

    // ... existing LM API logic
  }
}
```

**User Impact**: 🟢 **High**
- **Unique selling point** (nobody else has code export)
- Accelerates development (copy-paste working code)
- Cursor users get AI support

---

#### **Sprint 5 (Week 14-16): Consumer UX + Config Wizards** 🟡

**Objective**: Polish features to match competitors

| ID | Feature | User Story | Effort |
|----|---------|------------|--------|
| **1.2.2** | **Consumer Pause/Seek** | "Pause during debugging" | 5h |
| **1.3.1** | **Topic Creation Wizard** | "Guided UI with validation" | 8h |
| **1.3.2** | **Config Diff View** | "Show current vs. default" | 4h |
| **1.4.1** | **Metrics Export** | "Export to CSV for reports" | 2h |
| **Total** | | | **19h** |

**Deliverables**:
1. Pause/Resume buttons in consumer webview
2. "Seek to Offset" right-click menu
3. Topic wizard (replaces input boxes)
4. Config diff table (current vs. default + tooltips)
5. CSV export for metrics

**Implementation Details**:

**1.2.2: Consumer Pause/Seek** (5h):
```typescript
// EXTEND: src/views/MessageConsumerWebview.ts
// Add buttons in HTML:
<button id="pauseBtn" onclick="pauseConsumer()">⏸️ Pause</button>
<button id="resumeBtn" onclick="resumeConsumer()">▶️ Resume</button>

// Server-side:
async pauseConsumer() {
  await consumer.pause([{ topic: this.topicName }]);
  this.updateUI({ isPaused: true });
}

async resumeConsumer() {
  await consumer.resume([{ topic: this.topicName }]);
  this.updateUI({ isPaused: false });
}

// Right-click menu for partitions (after 3.6):
vscode.commands.registerCommand('kafka.seekToOffset', async (node: PartitionTreeItem) => {
  const offset = await vscode.window.showInputBox({ prompt: 'Offset to seek to' });
  consumer.seek({ topic: node.topicName, partition: node.partitionId, offset });
});
```

**1.3.1: Topic Wizard** (8h):
```typescript
// NEW: src/views/TopicWizardWebview.ts
export class TopicWizardWebview {
  show() {
    // Multi-step wizard:
    // Step 1: Topic name + partitions + replication factor
    // Step 2: Config (retention, compression, etc.)
    // Step 3: Validation (replication <= broker count)
    // Step 4: Preview (validateOnly: true dry-run)
    // Step 5: Create
  }

  private validate(config: TopicConfig): string[] {
    const errors = [];
    const brokerCount = await admin.describeCluster().brokers.length;

    if (config.replicationFactor > brokerCount) {
      errors.push(`Replication factor (${config.replicationFactor}) exceeds broker count (${brokerCount})`);
    }

    return errors;
  }
}
```

**User Impact**: 🟡 **Medium**
- Matches Conduktor wizards
- Improves UX for common operations
- Prevents config errors

---

**Phase 2 Summary**:
- **Total Effort**: 49 hours (~1 dev for 6 weeks) [41h original + 8h connection dashboard]
- **Release**: v1.0.0 (Major) — **"The Kafka IDE: AI + Code Export"**
- **Banner**: *"Introducing Code Export — Generate production code from your tests"*
- **Connection Management**: Added Connection Status Dashboard for ops visibility

---

### **Phase 3: Enterprise Polish (v1.1.0)** — **Backlog** (29h)

> **Goal**: Nice-to-haves for enterprise users (feature-request driven)

| ID | Feature | Why Defer? | Effort | Decision |
|----|---------|------------|--------|----------|
| 3.5 | Backup/Export Wizard | Low demand; manual export exists | 4h | ⏸️ Wait for requests |
| 1.5.1 | OAuth Support | Niche; most use SCRAM/MSK IAM | 8h | ⏸️ GitHub issue template |
| **CM-1** | **Consolidate to ConnectionPool Only** | Tech debt; refactor maps | 4h | ⏸️ **Connection Management** |
| **CM-2** | **"Disable Cluster" Command** | Temp pause without delete | 3h | ⏸️ **Connection Management** |
| **CM-3** | **Consumer Cache Cleanup** | Memory leak fix | 2h | ⏸️ **Connection Management** |
| **CM-5** | **Parallel Health Checks** | Startup performance | 4h | ⏸️ **Connection Management** |
| 1.1.2 | Transactional UI | High complexity, 0.5% demand | - | ❌ **REMOVED** |
| 1.6.2 | DLQ Handler | Application-layer concern | - | ❌ **REMOVED** |
| 3.4 | Kafka Connect | Dedicated UIs exist | - | ⏸️ **Defer to v2.0** |

**Connection Management Backlog** (CM-1 through CM-5): 13h total
- Improves resource management and ops visibility
- Non-blocking; current implementation is functional
- Prioritize if users report connection issues or request disable feature

**Rationale**: Focus on **80% use cases** (developer workflows), not enterprise edge cases. Wait for user demand to validate before investing.

---

## 🔒 Security Considerations

### 🚨 **Critical Security Requirements (All Phases)**

Every feature must complete its security requirements **before** release. Security is NOT optional.

---

### **Security Principles**

1. **Least Privilege**: Request only necessary Kafka ACLs
2. **Secure by Default**: Disable risky features by default
3. **No Credential Leaks**: Sanitize all logs/errors/audit trails
4. **Input Validation**: Validate all user inputs (topic names, regex, principals)
5. **Defense in Depth**: Multiple layers (CSP, HTML escaping, SecretStorage)

---

### **Security Requirements by Feature**

#### **Phase 0: Logger Sanitization** (SEC-2.1-1) 🔴 **BLOCKER**

**Threat**: Credentials logged in clear text via `JSON.stringify()`
**Impact**: HIGH — passwords/tokens exposed in log files
**Mitigation** (2h):

```typescript
// src/infrastructure/Logger.ts
private sanitize(data: any): any {
  const SENSITIVE_KEYS = [
    'saslPassword', 'sslPassword',
    'awsSecretAccessKey', 'awsAccessKeyId', 'awsSessionToken',
    'principal', 'schemaRegistryApiKey', 'schemaRegistryApiSecret'
  ];

  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    for (const key of SENSITIVE_KEYS) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }
    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }
    return sanitized;
  }
  return data;
}

private log(level: string, message: string, data: any[]): void {
  // ... existing code
  data.forEach(item => {
    if (typeof item === 'object') {
      const sanitized = this.sanitize(item);
      this.channel!.appendLine(`  Data: ${JSON.stringify(sanitized, null, 2)}`);
    }
  });
}
```

**Testing**: `grep -r "saslPassword" logs/` → must return ZERO matches

---

#### **Phase 1 Sprint 1: Schema Registry Security** (SEC-3.1-*) 🔴 **CRITICAL**

**Threats**:
1. Schema Registry API keys exposed in logs/settings
2. Man-in-the-middle attack (HTTP connection)
3. Schema field values contain PII (emails, SSNs)

**Mitigations** (8h):

| ID | Requirement | Implementation | Effort |
|----|-------------|----------------|--------|
| SEC-3.1-1 | Store SR credentials securely | Extend `CredentialManager` to store `schemaRegistryApiKey` in SecretStorage | 2h |
| SEC-3.1-2 | Redact schema field values | When displaying schema, show field types only (not example values) | 3h |
| SEC-3.1-3 | Require HTTPS | Validate `schemaRegistryUrl.startsWith('https://')` | 1h |
| SEC-3.1-4 | Cache schemas securely | Store in `globalState` (encrypted by VSCode), not workspace settings | 2h |
| SEC-3.1-5 | Audit schema operations | Log `SCHEMA_FETCHED`, `SCHEMA_REGISTERED` with subject name | 1h (included above) |

**Code Example**:
```typescript
// src/infrastructure/CredentialManager.ts
export interface StoredCredentials {
  saslPassword?: string;
  sslPassword?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
  schemaRegistryApiKey?: string;      // NEW
  schemaRegistryApiSecret?: string;   // NEW
}

// src/services/SchemaRegistryService.ts
constructor(url: string, credentials: { apiKey: string; apiSecret: string }) {
  if (!url.startsWith('https://')) {
    throw new Error('Schema Registry must use HTTPS (SEC-3.1-3)');
  }

  this.registry = new SchemaRegistry({
    host: url,
    auth: credentials // Fetched from CredentialManager, never from settings.json
  });
}
```

---

#### **Phase 1 Sprint 1: Message Search Security** (SEC-1.2-*) 🟡 **HIGH**

**Threats**:
1. Regex DoS (e.g., `.*.*.*` crashes Kafka)
2. PII exposure (searching for credit cards, emails)

**Mitigations** (2h):

| ID | Requirement | Implementation | Effort |
|----|-------------|----------------|--------|
| SEC-1.2-1 | Client-side regex only | Filter messages **after** fetch; never send regex to Kafka broker | 0h (design decision) |
| SEC-1.2-2 | Warn on PII search | If search term matches email/CC pattern, show "Searching PII? Use carefully" | 2h |
| SEC-1.2-3 | Limit search results | Max 1000 messages; require offset range | 1h (included above) |

**Code Example**:
```typescript
// Client-side filtering in webview (SEC-1.2-1):
function searchMessages(messages, searchTerm) {
  // Regex applied client-side ONLY (never sent to Kafka)
  try {
    const regex = new RegExp(searchTerm);
    return messages.filter(msg => regex.test(msg.key || msg.value));
  } catch (e) {
    showError('Invalid regex pattern');
  }
}

// PII warning (SEC-1.2-2):
if (/\d{4}-\d{4}-\d{4}-\d{4}/.test(searchTerm)) {
  vscode.window.showWarningMessage('⚠️ Search term looks like a credit card. Use carefully.');
}
```

---

#### **Phase 1 Sprint 2: Webview XSS Protection** (SEC-3.7-*) 🔴 **CRITICAL**

**Threat**: Malicious topic name like `<script>alert(1)</script>` executes code in webview
**Impact**: HIGH — code injection, data theft
**Mitigations** (7h):

| ID | Requirement | Implementation | Effort |
|----|-------------|----------------|--------|
| SEC-3.7-1 | Escape HTML | Use `escapeHtml()` for all user-generated content (topic names, keys, values) | 2h |
| SEC-3.7-2 | Paginate webview data | Load 100 items at a time; lazy-load on scroll | 4h |
| SEC-3.7-4 | Validate webview messages | Whitelist `message.command` values; reject unknown commands | 1h |

**Code Example**:
```typescript
// src/webviewScripts/escapeHtml.ts (already exists!)
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// src/views/TopicsWebview.ts
private getHtmlContent(topics: string[]): string {
  const rows = topics.map(topic => `
    <tr>
      <td>${escapeHtml(topic)}</td>  <!-- SEC-3.7-1 -->
      <td><button onclick="viewTopic('${escapeHtml(topic)}')">View</button></td>
    </tr>
  `).join('');
  return `<table>${rows}</table>`;
}

// Validate messages (SEC-3.7-4):
private async handleMessage(message: any) {
  const ALLOWED_COMMANDS = ['viewTopic', 'deleteTopic', 'loadMore'];
  if (!ALLOWED_COMMANDS.includes(message.command)) {
    this.logger.warn(`Invalid webview command: ${message.command}`);
    return; // Ignore unknown commands
  }
  // ... handle command
}
```

**Testing**: Create topic named `<script>alert(1)</script>` → verify it displays as text, not executes

---

#### **Phase 1 Sprint 3: Lag Alert Security** (SEC-3.2-*) 🟡 **MEDIUM**

**Threats**:
1. Alert spam (100+ consumer groups = 100+ toasts)
2. Topology disclosure (toasts reveal cluster/group names)

**Mitigations** (3h):

| ID | Requirement | Implementation | Effort |
|----|-------------|----------------|--------|
| SEC-3.2-1 | Throttle alerts | Max 1 toast per cluster per 5 minutes | 1h |
| SEC-3.2-2 | Aggregate alerts | "3 groups lagging" instead of individual toasts | 2h |
| SEC-3.2-3 | User opt-in | Default `kafka.lagAlerts: false`; require explicit enable | 0.5h |

---

### **Security Testing Checklist (Before Each Release)**

| Test | Tool/Method | Pass Criteria | Blocker? |
|------|-------------|---------------|----------|
| **Credential Leaks** | `grep -r "saslPassword\|awsSecretAccessKey" logs/` | ❌ Zero matches | 🔴 YES |
| **XSS Prevention** | Create topic: `<script>alert(1)</script>` | ✅ Displays as text, not executes | 🔴 YES |
| **SR Credentials Storage** | Check `settings.json` for API keys | ❌ No keys present | 🔴 YES |
| **HTTPS Enforcement** | Config SR with `http://` URL | ❌ Rejected with error | 🔴 YES |
| **ACL Probe Rate Limit** | Connect 10x in 1 minute | ✅ Only 1 probe executes | 🟡 NO |
| **Webview CSP** | Browser DevTools → Security tab | ✅ No CSP violations | 🟡 NO |
| **Audit Completeness** | Delete topic → check `AuditLog.getEntries()` | ✅ Entry exists | 🟢 NO |
| **Logger Sanitization** | Trigger error with credentials | ❌ No passwords in logs | 🔴 YES |

**Blocker Criteria**: If a test marked 🔴 fails, **DO NOT SHIP** until fixed.

---

### **Incident Response Plan**

#### **Scenario 1: Credentials Leaked in Logs**
1. **Immediate** (0-2h): Release hotfix to redact logs (SEC-2.1-1)
2. **Notify** (2-4h): Users via GitHub Security Advisory (GHSA)
3. **Rotate** (4-24h): Advise users to rotate SASL passwords via notification toast
4. **Post-Mortem** (1 week): Root cause analysis; update security checklist

#### **Scenario 2: XSS Exploit in Webview**
1. **Immediate** (0-1h): Disable affected webview (kill switch via setting: `kafka.webviews.enabled: false`)
2. **Patch** (1-6h): Apply `escapeHtml` (SEC-3.7-1)
3. **Test** (6-12h): Run full XSS test suite; penetration test
4. **Release** (12-24h): Hotfix v0.X.Y
5. **Notify** (24h): Users via Marketplace update notes

#### **Scenario 3: Schema Registry API Key Exposed**
1. **Immediate** (0-1h): Prompt user to rotate key via modal dialog
2. **Fix** (1-4h): Ensure `CredentialManager` used (SEC-3.1-1)
3. **Audit** (4-24h): Check if key was logged/cached; run `grep` on codebase
4. **Prevent** (1 week): Add pre-commit hook to detect hardcoded keys

---

### **GDPR & Privacy Compliance**

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Data Minimization** | Don't log full message content; log offsets/keys only | ✅ Implemented |
| **Right to Erasure** | `AuditLog.clear()` API for user data deletion | ✅ Implemented |
| **Data Portability** | `AuditLog.export()` provides JSON dump | ✅ Implemented |
| **Encryption at Rest** | VSCode SecretStorage uses OS keychain (Keychain/Credential Manager) | ✅ Provided by VSCode |
| **Encryption in Transit** | Enforce SSL for Kafka and Schema Registry (SEC-3.1-3) | ⏳ Sprint 1 |
| **Consent** | Schema Registry connection requires explicit user input | ✅ Design |

---

## 📐 Technical Implementation Guide

### **KafkaJS API Verification**

All features verified against **KafkaJS v2.2.4**:

| Feature | KafkaJS API | Status | Notes |
|---------|-------------|--------|-------|
| **Compression** | `producer.send({ compression: Types.GZIP })` | ✅ GZIP only | Snappy/LZ4/ZSTD require plugins |
| **Custom Partitioners** | `kafka.producer({ createPartitioner })` | ✅ Supported | Default: Murmur2 hash |
| **Pause/Resume** | `consumer.pause([{ topic, partitions }])` | ✅ Supported | Per topic-partition |
| **Seek** | `consumer.seek({ topic, partition, offset })` | ✅ Supported | Numeric offsets + special values |
| **Seek by Timestamp** | `admin.fetchTopicOffsetsByTimestamp(topic, timestamp)` | ✅ Supported | Returns offsets for all partitions |
| **Offset Management** | `admin.fetchOffsets({ groupId, topics, resolveOffsets })` | ✅ Supported | Full lag calculation |
| **ACL Operations** | `admin.describeAcls({ principal, resourceType, operation })` | ✅ Supported | Full CRUD |
| **Topic Metadata** | `admin.fetchTopicMetadata({ topics })` | ✅ Supported | Returns partition details (leader, replicas, ISR) |
| **Transactions** | `producer.transaction()` | ✅ Supported | Deferred to v2.0 (UI complexity) |

**Evidence**:
- Compression: `kafkajs/src/protocol/message/compression/index.js:14` (GZIP native; others throw `KafkaJSNotImplemented`)
- Pause/Resume: `kafkajs/src/consumer/index.js:463-498`
- Seek: `kafkajs/src/consumer/index.js:386-416`
- ACL: `kafkajs/src/admin/index.js:1226-1305`
- Metadata: `kafkajs/src/admin/index.js:791-808`

---

### **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                    VSCode Extension Host                     │
├─────────────────────────────────────────────────────────────┤
│  Commands (commands/*.ts)                                    │
│  ├─ topicCommands.ts   (create, delete, configure)         │
│  ├─ consumerGroupCommands.ts  (reset offsets, view lag)    │
│  └─ aclCommands.ts     (create, delete ACLs)               │
├─────────────────────────────────────────────────────────────┤
│  Providers (providers/*.ts)                                  │
│  ├─ kafkaExplorerProvider.ts  (tree view: clusters/topics) │
│  ├─ consumerGroupProvider.ts  (tree view: groups)          │
│  └─ aclProvider.ts     (tree view: ACLs)                   │
├─────────────────────────────────────────────────────────────┤
│  Services (services/*.ts)                                    │
│  ├─ TopicService.ts           (topic CRUD)                 │
│  ├─ ConsumerGroupService.ts   (offset reset, lag calc)     │
│  ├─ ProducerService.ts        (message production)         │
│  ├─ SchemaRegistryService.ts  (NEW: schema validation)     │
│  └─ CodeExportService.ts      (NEW: code generation)       │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure (infrastructure/*.ts)                        │
│  ├─ KafkaClientManager.ts  (connection pool, admin/producer/consumer) │
│  ├─ CredentialManager.ts   (SecretStorage wrapper)         │
│  ├─ Logger.ts              (sanitized logging)             │
│  ├─ ErrorHandler.ts        (user-friendly errors)          │
│  └─ AuditLog.ts            (compliance tracking)           │
├─────────────────────────────────────────────────────────────┤
│  Views (views/*.ts)                                          │
│  ├─ MessageProducerWebview.ts     (produce UI)            │
│  ├─ MessageConsumerWebview.ts     (consume + search UI)   │
│  ├─ ClusterDashboardWebview.ts    (metrics + lag alerts)  │
│  ├─ TopicsWebview.ts              (NEW: scalable lists)   │
│  └─ TopicWizardWebview.ts         (NEW: guided creation)  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                         KafkaJS                              │
│  ├─ Admin API  (topics, ACLs, configs, metadata)           │
│  ├─ Producer   (send messages with compression)            │
│  └─ Consumer   (fetch messages, pause/resume, seek)        │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                      Kafka Cluster                           │
│  ├─ Brokers    (message storage)                           │
│  ├─ Topics     (partitions, replicas)                      │
│  ├─ Consumer Groups  (offset tracking)                     │
│  └─ Schema Registry  (Avro/Protobuf schemas)               │
└─────────────────────────────────────────────────────────────┘
```

---

### **Existing Codebase Strengths**

✅ **Strong Foundations**:
1. **Secure Credential Storage**: `CredentialManager` uses VSCode `SecretStorage` API (OS-level encryption)
2. **Audit Logging**: `AuditLog` tracks all operations (no sensitive data)
3. **Configuration Sanitization**: Passwords never stored in `settings.json`
4. **Multi-Cluster Support**: Connection pooling with `ConnectionPool`
5. **Error Handling**: `ErrorHandler` prevents credential leaks in stack traces
6. **Message Templates**: 4 pre-built templates (simple, user-event, order, IoT)
7. **AI Integration**: `AIAdvisor` + `ParameterAIService` for config suggestions

---

### **Dependencies**

| Package | Version | Purpose | Phase |
|---------|---------|---------|-------|
| `kafkajs` | ^2.2.4 | Core Kafka client | ✅ Existing |
| `@kafkajs/confluent-schema-registry` | ^7.x | Schema Registry support | ⏳ Sprint 1 |
| `vscode` | ^1.90.0 | VSCode Extension API | ✅ Existing |
| `aws-sdk` | ^2.x | MSK IAM authentication | ✅ Existing |

**Installation**:
```bash
# Sprint 1 (Schema Registry):
npm install @kafkajs/confluent-schema-registry
```

---

## 🧪 Testing Strategy & Test Cases

### Overview
Testing is integrated into each sprint to ensure reliability, security, and performance. We use:
- **Unit/Integration**: Mocha/Jest in `src/test/` with KafkaJS mocks and Docker (via `docker-compose.2_4.yml` for local Kafka).
- **E2E**: VSCode extension runner (`npm test`) simulating commands/webviews.
- **Security**: Custom checklist (grep, XSS fuzzing, credential scans).
- **Performance**: Load tests with 1k+ topics (mock data or real cluster).
- **CI**: GitHub Actions with coverage reports (c8) and security scans.
- **Effort Allocation**: 20% per sprint (e.g., 1.4h for Phase 0).
- **Success Criteria**: 80%+ unit/integration coverage; all security tests pass; no regressions in existing features.

Manual testing for UX (e.g., webview interactions) + beta testers (5+ users per release).

### Phase 0: Pre-Launch Fixes (v0.8.9) — 1.4h Testing
**Total Effort**: 7h features + 1.4h tests.

1. **Topic Sorting (2.2)**:
   - **Unit**: Test `topics.sort((a, b) => a.localeCompare(b))` in `kafkaExplorerProvider.getChildren()` (mock `getTopics()` returns unsorted array; assert sorted output).
   - **Integration**: Mock VSCode config `kafka.topicSortBy='name'`; verify tree view renders alphabetically.
   - **E2E**: Run extension test: Add topics A-Z, refresh view, assert order in TreeView.
   - **Edge Cases**: Empty topics list; mixed case (e.g., "Apple" vs "banana"); non-ASCII chars.
   - **Tools**: Mocha unit; VSCode test runner for E2E.

2. **Search Focus (2.3)**:
   - **Unit**: Test `treeView.reveal(foundNode, { select: true, focus: true })` (mock TreeView, assert called with options).
   - **Integration**: In `findTopic` command, mock search results; verify node is selected/focused.
   - **E2E**: Simulate Cmd+Shift+P > "Kafka: Find Topic" > type query > Enter; assert topic node highlighted in view.
   - **Edge Cases**: No results (show message); multiple matches (focus first); large list (performance <500ms).
   - **Tools**: Mocha + sinon for mocks.

3. **Logger Sanitization (SEC-LOG)**:
   - **Unit**: Test `sanitize(data)` recursively redacts keys (e.g., input with nested `saslPassword`; assert '[REDACTED]').
   - **Security**: Grep test: Log object with secrets; assert zero matches for `grep -r "saslPassword" logs/`.
   - **Integration**: Trigger log in `Logger.log()` with sensitive data; verify output in VSCode Output panel.
   - **Edge Cases**: Non-object data (strings/numbers); deeply nested objects; arrays with secrets.
   - **Tools**: Mocha; custom script for grep validation.

**Phase 0 Testing Goal**: Run `npm test` passes 100%; security checklist full pass.

### Phase 1: Developer Essentials (v0.10.0) — ✅ COMPLETE
**Total Effort**: 87h features + 17.4h tests.
**Status**: ✅ All features implemented, 632 tests passing, security validated.
**Completion Date**: October 18, 2025

#### Sprint 1 (Week 3-5): Schema Registry + Message Search — 7.4h
**Features**: Schema integration (24h), message search (13h).

1. **Schema Registry Integration (3.1)**:
   - **Unit**: Test `SchemaRegistryService.getLatestSchema()`, `validateMessage()` (mock `@kafkajs/confluent-schema-registry`; assert HTTPS enforced, creds from `CredentialManager`).
   - **Integration**: Docker Kafka + Schema Registry; test connect/validate Avro payload (success/fail cases).
   - **E2E**: Webview produce with schema; assert validation passes/fails; UI shows errors.
   - **Security**: Test SEC-3.1-* (e.g., HTTP URL throws; creds not in logs via grep; PII redacted in schema display).
   - **Edge Cases**: Invalid subject; expired schema; large payloads (>1MB).
   - **Performance**: Validate 100 schemas <2s.
   - **Tools**: Docker Compose; Avro test libs.

2. **Message Search/Filter (1.2.1)**:
   - **Unit**: Test client-side `filterMessages()` (regex on keys/values; assert matches/no-matches).
   - **Integration**: Consume 10k messages; test seek by timestamp/offset via `admin.fetchTopicOffsetsByTimestamp()`.
   - **E2E**: Webview search bar: Type regex > filter results; seek button > jump to offset; assert UI updates.
   - **Security**: SEC-1.2-* (client-only regex; PII warning for email/CC patterns; no server-side injection).
   - **Edge Cases**: Invalid regex (catch errors); empty results; cross-partition search.
   - **Performance**: Search 10k msgs <1s; no DoS from malicious regex.
   - **Tools**: KafkaJS consumer mocks.

#### Sprint 2 (Week 6-8): Partitions + Scalability — 6.8h
**Features**: Partition navigation (13h), scalable lists (21h).

1. **Partition Navigation (3.6)**:
   - **Unit**: Test `PartitionsTreeItem.getChildren()` (mock `admin.fetchTopicMetadata()`; assert partition details: leader/replicas/ISR).
   - **Integration**: Fetch metadata for topic with 10 partitions; verify tree expands correctly.
   - **E2E**: Right-click partition > "View Offsets"; assert info message shows low/high offsets.
   - **Security**: SEC-3.6-* (obfuscate IPs in display; audit log `PARTITION_VIEWED`).
   - **Edge Cases**: Offline leader; empty ISR; topic without partitions.
   - **Tools**: Mocha mocks for admin.

2. **Scalable List Views (3.7)**:
   - **Unit**: Test `TopicsWebview.show()` pagination (threshold 50; assert HTML escapes topics).
   - **Integration**: Load 1k topics; verify webview paginates (100/page); lazy-load on scroll.
   - **E2E**: Tree view > 150 topics > opens webview; search/filter works; memory <500MB.
   - **Security**: SEC-3.7-* (XSS: inject `<script>` in topic name > assert escaped; whitelist webview commands).
   - **Performance**: Load 2k topics <3s; VSCode CPU <20%.
   - **Edge Cases**: 0 topics; special chars in names; concurrent loads.
   - **Tools**: Puppeteer for webview perf; VSCode test runner.

#### Sprint 3 (Week 9-10): Lag Alerts + Polish — 3.2h
**Features**: Lag monitoring (13h), producer enhancements (3h).

1. **Lag Monitoring & Alerts (3.2)**:
   - **Unit**: Test `LagMonitor.monitorLag()` throttle (mock `admin.fetchOffsets()`; assert no spam >5min).
   - **Integration**: Simulate lag (produce/consume offsets); verify toast for >10k lag.
   - **E2E**: Enable setting > simulate alert > click "View Group" > opens details.
   - **Security**: SEC-3.2-* (aggregate alerts; opt-in default false; no topology leaks in toasts).
   - **Edge Cases**: 0 groups; negative lag; disconnected cluster.
   - **Performance**: Poll 30s intervals <100ms/group.

2. **Producer Enhancements (1.1.1)**:
   - **Unit**: Test GZIP compression in `produceAdvancedMessages()` (mock producer.send(); assert Types.GZIP).
   - **Integration**: Produce with/without compression; verify Kafka receives compressed.
   - **E2E**: Webview dropdown > select GZIP > send; load Avro template > validates.
   - **Edge Cases**: Invalid compression (error); large message (1MB+).
   - **Tools**: KafkaJS producer mocks.

**Phase 1 Testing Goal**: Full integration suite with Docker Kafka; security checklist 100%; perf benchmarks pass.

---

### **Connection Management Enhancements**

#### **Current Architecture Overview**

The extension uses a **hybrid lazy loading + connection pooling** strategy:
- **ConnectionPool**: Manages admin/producer lifecycle with 5-min idle cleanup
- **Lazy Loading**: Connections created on-demand (first use), not eagerly on startup
- **Health Checks**: Admin connections validated every 5 minutes
- **Automatic Cleanup**: Background task disconnects idle connections every 1 minute
- **Graceful Shutdown**: `dispose()` on deactivation closes all connections

**What Works Well**:
- ✅ Efficient resource usage (no unnecessary connections)
- ✅ Automatic reconnection on stale connections
- ✅ Proper cleanup on extension deactivation

#### **Identified Gaps & Solutions**

| ID | Issue | User Impact | Solution | Phase | Effort |
|----|-------|-------------|----------|-------|--------|
| **CM-1** | Dual system complexity (legacy maps + pool) | Tech debt; hard to debug | Consolidate to ConnectionPool only | 1.1 (Backlog) | 4h |
| **CM-2** | No "disable cluster" (only delete) | Must re-add config to pause cluster | Add `kafka.disableCluster` command | 1.1 (Backlog) | 3h |
| **CM-3** | Consumer cache never cleans up | Memory leak with many consumer groups | Add 5-min idle timeout for consumers | 1.1 (Backlog) | 2h |
| **CM-4** | No connection status visibility | Can't see if cluster is connected | Add Connection Status Dashboard | v1.0 (Phase 2) | 8h |
| **CM-5** | Sequential health checks on startup | Slow startup with many clusters | Parallel health checks | 1.1 (Backlog) | 4h |

#### **Proposed Feature: Connection Status Dashboard (CM-4)** — Phase 2 Sprint 5

**Objective**: Give users visibility into connection health and control

**Deliverables**:
1. New webview: "Kafka Connection Status" (dashboard with table)
2. Display per cluster:
   - Status: 🟢 Connected / 🟡 Idle / 🔴 Disconnected
   - Use count (operations performed)
   - Last used (time ago)
   - Idle time remaining (e.g., "2m 30s until auto-disconnect")
   - Connection details (brokers, auth type)
3. Right-click actions:
   - "Force Reconnect" → disconnect + reconnect immediately
   - "Disconnect Now" → manual disconnect (temp disable)
   - "View Connection Logs" → filter logs for this cluster
4. Command palette: `Kafka: Show Connection Status`

**Implementation**:
```typescript
// NEW: src/views/ConnectionStatusWebview.ts
export class ConnectionStatusWebview {
  show() {
    const stats = this.connectionPool.getStats(); // Already exists!
    const clusters = this.clientManager.getClusters();

    const data = clusters.map(name => {
      const stat = stats.get(name);
      const idleTime = stat ? Date.now() - stat.lastUsed.getTime() : 0;
      return {
        name,
        status: stat?.isConnected ? (idleTime > 4*60*1000 ? 'idle' : 'connected') : 'disconnected',
        useCount: stat?.useCount || 0,
        lastUsed: stat?.lastUsed || null,
        idleTimeRemaining: Math.max(0, 5*60*1000 - idleTime) // 5min - idle
      };
    });

    this.renderTable(data);
  }
}

// EXTEND: src/kafka/kafkaClientManager.ts
// Add public methods for manual control:
async forceReconnect(clusterName: string) {
  await this.connectionPool.disconnect(clusterName);
  await this.getAdmin(clusterName); // Will auto-reconnect
}

async disconnectCluster(clusterName: string) {
  await this.connectionPool.disconnect(clusterName);
  // Connection stays in config, will reconnect on next use
}
```

**User Story**:
> "As an SRE managing 10+ Kafka clusters, I want to see which clusters are actively connected and manually disconnect idle ones to free resources, without removing the cluster config."

**Testing** (2h):
- **Unit**: Mock `connectionPool.getStats()`, assert table renders correctly
- **Integration**: Connect 3 clusters, wait 3 mins, verify idle status updates
- **E2E**: Right-click > "Disconnect Now" > verify status changes to disconnected
- **Performance**: 50 clusters in dashboard < 500ms load time

**Effort**: 8h (6h implementation + 2h testing)

**Dependencies**: None (uses existing ConnectionPool APIs)

**Priority**: 🟢 Medium (nice-to-have for ops workflows)

---

### Phase 2: Developer Superpowers (v1.0.0) — 10.2h Testing
**Total Effort**: 49h features + 10.2h tests.

#### Sprint 4 (Week 11-13): Code Export + AI — 4.4h
1. **Export to Code (NEW-1)**:
   - **Unit**: Test `CodeExportService.exportProducer()` for Node.js/Python/Java/Go (mock config; assert valid code syntax).
   - **Integration**: Generate code > parse/validate (e.g., ESLint for JS; no syntax errors).
   - **E2E**: Webview button > select lang > copy code > paste in new file > no errors.
   - **Edge Cases**: SASL/SSL configs (redacted); empty messages.
   - **Tools**: Code parsers (e.g., esprima for JS).

2. **AI for Cursor (2.4)**:
   - **Unit**: Test `AIAdvisor.checkAvailability()` (mock VSCode LM API; fallback for Cursor).
   - **Integration**: Mock LM response; assert advice generated for topic config.
   - **E2E**: Enable AI > click advisor > webview shows recommendations.
   - **Edge Cases**: No models available; invalid config input.

3. **Logs Panel (1.4.2)**:
   - **Unit**: Test filter/search in logs (mock OutputChannel).
   - **E2E**: Produce error > filter by level > assert results.

#### Sprint 5 (Week 14-16): Consumer UX + Config Wizards — 3.8h
1. **Consumer Pause/Seek (1.2.2)**:
   - **Unit**: Test `pauseConsumer()`/`resumeConsumer()` (mock consumer.pause/resume).
   - **Integration**: Consume > pause > assert no new messages; seek to offset > verify position.
   - **E2E**: Webview buttons > pause/resume; right-click partition > seek input > updates consumer.

2. **Topic Creation Wizard (1.3.1)**:
   - **Unit**: Test `validate()` (e.g., replication > brokers throws).
   - **E2E**: Multi-step wizard > invalid input > errors; dry-run > no create; final step > topic exists.

3. **Config Diff View (1.3.2)** + **Metrics Export (1.4.1)**:
   - **Unit**: Test diff rendering (current vs default).
   - **E2E**: View diff > tooltips show; export CSV > file opens with data.

4. **Connection Status Dashboard (CM-4)** — 8h:
   - **Unit**: Test `ConnectionStatusWebview.show()` (mock connectionPool.getStats()).
   - **Integration**: Connect 3 clusters, wait for idle, verify status calculations.
   - **E2E**: Command palette > "Show Connection Status" > table displays; right-click cluster > "Disconnect Now" > status updates.
   - **Performance**: 50 clusters render <500ms.

**Phase 2 Testing Goal**: E2E focus on unique features (code gen compiles); AI accuracy (manual review 80% useful); connection dashboard responsive.

### Additional Testing Guidelines
- **Cross-Phase**: Regression suite for core (produce/consume, ACLs) runs per sprint.
- **Beta Testing**: 5+ users per major release (v0.9.0, v1.0.0); feedback via GitHub issues.
- **Security Across All**: Run checklist pre-release (e.g., credential grep, XSS tests with `<script>` topics).
- **Performance Benchmarks**: Use local Kafka (Docker); target <3s for large ops.
- **Accessibility**: Webviews: Keyboard nav, screen reader (ARIA labels); test with VSCode's accessibility mode.
- **Coverage Reporting**: `npm run test:coverage` > html report; fail CI if <80%.

---

## 📈 Success Metrics & KPIs

### **Product Metrics (via Telemetry)**

| Metric | Baseline (v0.8.8) | v0.9.0 Target | v1.0.0 Target | How to Measure |
|--------|-------------------|---------------|---------------|----------------|
| **Daily Active Users** | 500 | **1,500** (3x) | **3,000** (6x) | VSCode telemetry (extension activations) |
| **Avg Session Time** | 5 mins | **12 mins** | **15 mins** | Time between activate/deactivate |
| **Schema Registry Usage** | 0% | **30%** | **50%** | `AuditLog` count of `SCHEMA_FETCHED` |
| **Message Search Usage** | 0% | **60%** | **70%** | Webview event: `searchMessages` |
| **Code Export Usage** | 0% | 0% | **40%** | Command invocation: `kafka.exportCode` |
| **Topics Managed per User** | 5 | **15** | **30** | Avg topics per cluster config |
| **Large Cluster Adoption** | 10% (>100 topics) | **40%** | **60%** | % of users with >100 topics |

### **Engagement Metrics**

| Metric | Baseline | v0.9.0 Target | v1.0.0 Target |
|--------|----------|---------------|---------------|
| **VSCode Marketplace Rating** | 4.2/5 | **4.5/5** | **4.7/5** |
| **GitHub Stars** | 150 | **500** | **1,000** |
| **"Better than Conduktor" Survey** | N/A | **30%** | **50%** |
| **User Retention (30-day)** | 40% | **60%** | **70%** |
| **Feature Adoption (% using >3 features)** | 25% | **50%** | **70%** |

### **Competitive Benchmarks**

| Metric | Us (v0.9) | Conduktor | Lenses | AKHQ |
|--------|-----------|-----------|--------|------|
| **Topic Load Time (500 topics)** | <2s | 1s | 1.5s | 2s |
| **Webview Load Time (1000 topics)** | <3s | 2s | 2.5s | 3s |
| **Message Search (10k msgs)** | <1s | 0.5s | 1s | 1.5s |
| **Schema Validation Time** | <500ms | 300ms | 400ms | N/A |

### **Business Metrics (Post-v1.0 Monetization)**

| Metric | Conservative | Optimistic |
|--------|--------------|------------|
| **Free Tier Users** | 2,850 (95%) | 4,500 (90%) |
| **Pro Tier Users ($5/month)** | 150 (5%) | 500 (10%) |
| **Monthly Recurring Revenue** | **$750** | **$2,500** |
| **Annual Revenue (projected)** | **$9,000** | **$30,000** |

**Monetization Features** (Pro Tier):
- Code export to Python/Go/Java (Node.js free)
- Advanced AI prompts (custom instructions)
- Lag alert webhooks (Slack/PagerDuty)
- Priority support (24h response time)

---

## 🚨 Risk Management

### **Technical Risks**

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| **Schema Registry auth complexity** | High | High | Provide setup wizard + docs; test with Confluent Cloud & MSK | Lead Dev |
| **Large cluster performance degradation** | Medium | High | Load test with 2k topics; implement pagination (3.7) | Lead Dev |
| **XSS vulnerabilities in webviews** | Medium | High | Complete SEC-3.7-1; penetration test before release | Security Champion |
| **KafkaJS API limitations** | Low | Medium | Already verified APIs; fallback to CLI if needed | Lead Dev |
| **VSCode API breaking changes** | Low | Medium | Pin VSCode engine version; monitor release notes | Lead Dev |

### **Product Risks**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **User adoption of Code Export** | Medium | Medium | In-app tutorial; blog post with examples; YouTube demo |
| **Schema Registry too complex for users** | Medium | High | Wizard for initial setup; auto-detect Confluent Cloud |
| **Conduktor copies our features** | Low | Medium | Focus on IDE integration (they can't copy); patent Code Export? |
| **Cursor IDE breaks AI integration** | High | Low | Already planned fallback (2.4); test in Cursor regularly |

### **Market Risks**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Competing VSCode extension launches** | Medium | High | Monitor Marketplace weekly; differentiate with unique features |
| **Kafka adoption slows** | Low | High | Focus on existing Kafka users; diversify to other messaging systems (v2.0) |
| **Enterprise users demand RBAC** | Low | Medium | Defer to v2.0; VSCode handles auth for now |

---

### **Go/No-Go Criteria**

#### **v0.9.0 Launch (Phase 1)**

✅ **GO if**:
- Schema Registry works with Confluent Cloud + MSK (SSL/SASL)
- Message search handles 10,000+ messages without lag (<1s)
- Tree view scales to 1,000+ topics (<3s load time)
- Zero HIGH/CRITICAL security vulnerabilities (pass security checklist)
- 5+ beta testers approve (NPS ≥ 7/10)
- Performance: VSCode memory <500MB with 1k topics loaded

❌ **NO-GO if**:
- Schema Registry fails with SSL/auth errors (show-stopper for data teams)
- Webviews crash with 500+ topics (ops teams blocked)
- Security audit finds credential leaks (SEC-2.1-1 failure)
- Beta testers report "slower than Offset Explorer" (performance regression)

#### **v1.0.0 Launch (Phase 2)**

✅ **GO if**:
- Code Export generates valid code for Node.js, Python, Java, Go
- AI works in both VSCode and Cursor IDE
- Consumer pause/seek works in production scenarios
- User feedback: "Code Export saves me 10+ mins per day"

❌ **NO-GO if**:
- Generated code doesn't compile (breaks trust)
- AI generates incorrect/dangerous configs
- Code Export feature adoption <10% after 2 weeks (not worth maintaining)

---

## 📚 Appendix: Deferred Features

### **Features Removed from Roadmap**

| ID | Feature | Why Removed | User Demand | Effort | Revisit? |
|----|---------|-------------|-------------|--------|----------|
| 1.1.2 | **Transactional Producer UI** | High complexity (state mgmt, coordinator, error recovery); 0.5% of users need exactly-once | ❌ Very Low | High (40h) | ⏸️ If >10 GitHub issues |
| 1.6.2 | **Dead Letter Queue Handler** | Application-layer concern; users implement in app code | ❌ Low | High (30h) | ❌ Never (out of scope) |
| 3.4 | **Kafka Connect Integration** | Dedicated UIs exist (Lenses, Confluent); niche use case | ⚠️ Low-Medium | High (35h) | ⏸️ Defer to v2.0 |
| 1.5.2 | **Rack-Aware Connections** | Multi-DC optimization; VSCode not used for prod deployments | ❌ Very Low | Medium (15h) | ❌ Never (out of scope) |

**Rationale**: Focus on **80% use cases** (developer workflows), not enterprise edge cases. Wait for user demand to validate before investing.

---

### **Features Deferred to Backlog**

| ID | Feature | Why Defer | User Demand | Effort | Trigger for Implementation |
|----|---------|-----------|-------------|--------|---------------------------|
| 3.5 | **Backup/Export Wizard** | Manual export exists; low demand | 🟢 Low | Low (4h) | >5 user requests via GitHub |
| 1.5.1 | **OAuth Support** | Most users use SCRAM/MSK IAM; niche | 🟡 Medium | Low (8h) | GitHub issue template; PR welcome |
| 1.6.1 | **Data Masking** | Enterprise compliance feature; complex | 🟢 Low | Medium (20h) | Enterprise customer request |
| 1.4.1 | **Metrics Export (Advanced)** | Basic CSV export in Phase 2; Prometheus integration overkill | 🟡 Medium | Medium (12h) | User survey shows demand |

**Decision Process**: If feature receives >5 GitHub issues OR paying customer requests it, prioritize in next planning cycle.

---

### **Features Deferred to v2.0 (Post-v1.0)**

| Feature | Rationale | Estimated Effort |
|---------|-----------|------------------|
| **Kafka Connect UI** | Dedicated tools exist; wait for user demand | 35h |
| **Kafka Streams Viewer** | Niche (stream processing); complex visualization | 40h |
| **Multi-Tenancy Support** | Enterprise feature; requires RBAC | 50h |
| **Custom Metrics Dashboards** | Users prefer Grafana; low ROI | 30h |
| **Kafka to Redshift/Snowflake Connectors** | Out of scope; use Connect instead | - |

---

## 📝 Appendix: Technical References

### **KafkaJS API Evidence**

All features verified against KafkaJS source code:

1. **Compression**: `kafkajs/src/protocol/message/compression/index.js:14`
   - GZIP: ✅ Native support
   - Snappy/LZ4/ZSTD: ❌ Throw `KafkaJSNotImplemented` (require pluggable codecs)

2. **Pause/Resume**: `kafkajs/src/consumer/index.js:463-498`
   ```javascript
   const pause = (topicPartitions = []) => {
     consumerGroup.pause(topicPartitions);
   };
   ```

3. **Seek**: `kafkajs/src/consumer/index.js:386-416`
   ```javascript
   const seek = ({ topic, partition, offset }) => {
     consumerGroup.seek({ topic, partition, offset: seekOffset.toString() });
   };
   ```

4. **ACL Describe**: `kafkajs/src/admin/index.js:1226-1305`
   ```javascript
   const describeAcls = async ({
     resourceType, resourceName, resourcePatternType,
     principal, host, operation, permissionType
   }) => { ... };
   ```

5. **Fetch Topic Metadata**: `kafkajs/src/admin/index.js:791-808`
   ```javascript
   const fetchTopicMetadata = async ({ topics = [] } = {}) => {
     return {
       topics: metadata.topicMetadata.map(topicMetadata => ({
         name: topicMetadata.topic,
         partitions: topicMetadata.partitionMetadata,
       })),
     };
   };
   ```

---

## 🎉 Summary & Next Actions

### **✅ What We're Doing**

**Phase 0** (v0.8.9): Fix broken UX → **Ship by Week 2**
**Phase 1** (v0.9.0): Schema + Search + Scale → **Ship by Week 10**
**Phase 2** (v1.0.0): Code Export + AI + Connection Dashboard → **Ship by Week 16**
**Phase 3** (v1.1.0): Connection Management Enhancements (Backlog, 13h)

### **🎯 Strategic Focus**

> **"The Developer-First Kafka IDE"**

**Competitive Advantages**:
1. ✅ Zero context switching (VSCode integration)
2. ✅ AI-powered config (nobody else has this)
3. ✅ Code Export (unique feature, v1.0)
4. ✅ Free & open source

### **📋 Immediate Next Steps**

**This Week (Week 1)**:
1. ✅ Review this roadmap with dev team
2. ✅ Get stakeholder approval
3. ✅ Create GitHub project board
4. ✅ Set up beta tester program (recruit 10 users)

**Next Week (Week 2)**:
1. 🔴 **Start Phase 0** (v0.8.9 hotfix)
   - Fix topic sorting (2h)
   - Fix search focus (3h)
   - Sanitize logger (2h)
2. 🔴 **Ship v0.8.9** (Friday Week 2)

**Week 3 (Sprint 1 Kickoff)**:
1. Install `@kafkajs/confluent-schema-registry`
2. Create feature branches: `feat/schema-registry`, `feat/message-search`
3. Write specs for Schema Registry + Message Search
4. Start development (37h sprint)

---

**For questions or updates**: Reference this document in PRs/issues
**Project Board**: [GitHub Projects Link]
**Slack Channel**: #kafka-vscode-dev
**Product Owner**: [Your Name]

---

**Last Updated**: October 17, 2025
**Version**: 2.0 (Market-Driven Roadmap)
**Status**: ✅ **APPROVED — Start Phase 0 Immediately**

---

**✅ Verification Note**: All technical claims, API references, and feature descriptions verified against codebase on October 17, 2025. KafkaJS v2.2.4 APIs confirmed functional. Effort estimations include 20% testing overhead and security requirements.
