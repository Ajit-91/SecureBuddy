# Technical Decisions

## Backend

Technology:

* Node.js
* Express.js
* TypeScript

Reason:

* Mature ecosystem
* Strong async support
* Excellent Telegram libraries
* BullMQ compatibility

---

# Database

Technology:

* MongoDB
* Mongoose

Decision:

Use:

```ts id="bq1zvz"
{
  timestamps: true
}
```

instead of manually managing:

```text id="0rluzv"
createdAt
updatedAt
```

---

# Authentication

## Decision

Use Telegram as the identity provider.

No:

* Email signup
* Passwords
* JWT authentication
* OTP verification

Unique user identifier:

```text id="sy35uz"
telegramId
```

Reason:

Telegram already authenticates users.

---

# User Creation

Decision:

Automatically create user records.

Workflow:

```text id="8flrqt"
User Sends Message
         │
         ▼
Find By Telegram ID
         │
         ▼
Not Found
         │
         ▼
Create User
```

Initial values:

```ts id="z68s0z"
{
  credits: 10,
  plan: "free"
}
```

---

# Credits System

Decision:

Hardcode:

```text id="3o57m5"
10 credits/day
```

for MVP.

Every accepted analysis consumes:

```text id="rxgqvy"
1 credit
```

Reason:

* Simple implementation
* Easy to understand
* Supports future subscription plans

---

# Credit Reset

Schedule:

```text id="pgrupf"
0 0 * * *
```

Implementation:

```ts id="xtwqec"
await User.updateMany(
  {},
  {
    $set: {
      credits: 10
    }
  }
);
```

Reason:

Simple MVP implementation.

Future versions may derive limits from plan configurations.

---

# Queue System

Technology:

* BullMQ
* Redis

Reason:

* Background processing
* Retry support
* Worker isolation
* Scalability

Queues:

```text id="29sgs9"
url-analysis
document-analysis
zip-analysis
apk-analysis
sandbox-creation
```

---

# Containerization

Technology:

* Docker

Decision:

All security-sensitive analysis runs inside disposable containers.

Examples:

```text id="fhkz4y"
URL Analysis

APK Analysis

APK Streaming
```

---

## Container Lifecycle

```text id="tcfvwu"
Create Container
      │
      ▼
Run Analysis
      │
      ▼
Generate Report
      │
      ▼
Destroy Container
```

Containers are never reused.

Reason:

Isolation and security.

---

# File Storage

## Decision

Do not permanently store uploaded files.

Workflow:

```text id="7oyqpx"
Download
Analyze
Store Report
Delete File
```

Reason:

* Lower infrastructure cost
* Simpler architecture
* Better privacy
* Reduced storage management

---

# Report Storage

Decision:

Store reports permanently.

Store:

* Findings
* Risk score
* Summary
* Metadata

Do Not Store:

* Uploaded files
* APKs
* PDFs
* ZIPs
* Screenshots

Reason:

Provides historical reports without retaining user content.

---

# URL Analysis

Technology:

* Playwright

Reason:

* Real browser execution
* JavaScript rendering
* Screenshot generation
* Redirect detection

---

## Screenshot Strategy

Workflow:

```text id="2dpr2m"
Generate Screenshot
        │
        ▼
Send To Telegram
        │
        ▼
Delete Screenshot
```

Reason:

Avoid image hosting infrastructure during MVP.

---

# APK Analysis

Technologies:

* JADX
* APKTool

Reason:

Provides:

* Manifest extraction
* Permission analysis
* Activity extraction
* Receiver extraction
* Static code inspection

---

# APK Streaming

Phase:

```text id="k0q23n"
Phase 6
```

Technologies:

* Docker
* Android Emulator
* VNC
* noVNC

Reason:

Allows users to safely interact with APKs without installing them locally.

---

# AI Layer

Provider:

```text id="91mew5"
Gemini API
```

Usage:

* Summary generation
* Risk explanation
* Recommendations

---

## Important Principle

Workers perform deterministic analysis.

Gemini explains findings.

Gemini does not replace security analysis.

Workflow:

```text id="m4ix8w"
Worker
   │
   ▼
Findings
   │
   ▼
Gemini
   │
   ▼
Summary
```

---

# MCP Strategy

Decision:

MCP integrations are optional enrichments.

Core analysis must continue working even if MCP providers fail.

Examples:

* VirusTotal
* AbuseIPDB
* Threat Intelligence Sources

Reason:

Avoid dependency on external providers.

---

# Historical Reports

Decision:

Use Report collection as the source of truth.

Commands:

```text id="v3h0bz"
/history

/report <jobId>
```

must load data from stored reports.

Reason:

Uploaded files no longer exist after processing.

---

# Deployment Philosophy

MVP Priorities:

1. Security
2. Simplicity
3. Low Cost
4. Fast Development

Avoid introducing infrastructure unless required by actual usage patterns.

Prefer simple implementations first and optimize later based on real-world usage.
