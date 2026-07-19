# SecureBuddy AI Context

## Project Summary

SecureBuddy is a Telegram-based AI Security Assistant.

Users interact entirely through Telegram.

The platform allows users to safely investigate potentially malicious content without exposing their own devices.

Supported content:

* URLs
* PDFs
* DOCX documents
* TXT documents
* ZIP files
* APK files

The system performs analysis inside isolated Docker containers and returns:

* Risk Score
* Security Findings
* AI Summary
* Recommendations
* Screenshots (URL Analysis)

---

# Current Development Scope

Current Target:

```text
Phase 1 → Phase 6
```

Implemented Features:

* User Management
* Credits System
* URL Analysis
* Document Analysis
* ZIP Analysis
* APK Static Analysis

Planned:

* APK Interactive Sandbox

Future:

* AI Agent
* MCP Integrations
* EXE Analysis
* EXE Streaming

---

# Core Principles

## Zero Trust

All user content is considered untrusted.

---

## Isolation First

Potentially dangerous content must never execute on the application server.

All analysis runs inside Docker containers.

---

## Ephemeral Processing

Workflow:

```text
Receive Content
      │
      ▼
Analyze
      │
      ▼
Store Report
      │
      ▼
Delete Temporary Files
```

Uploaded files are not permanently stored.

---

# Tech Stack

## Backend

* Node.js
* Express.js
* TypeScript

---

## Database

* MongoDB
* Mongoose

All schemas use:

```ts
{
  timestamps: true
}
```

---

## Queue System

* Redis
* BullMQ

---

## Containerization

* Docker

---

## URL Analysis

* Playwright

---

## APK Analysis

* JADX
* APKTool

---

## AI

* Gemini API

Gemini generates:

* Summaries
* Risk explanations
* Recommendations

Workers generate actual findings.

---

# User Management

Telegram is the identity provider.

No:

* Email signup
* Passwords
* JWT authentication
* OTP verification

Users are automatically created from Telegram information.

Unique identifier:

```text
telegramId
```

---

# Credits System

Every new user receives:

```text
10 credits
```

Every analysis costs:

```text
1 credit
```

Before creating a job:

```ts
if (user.credits <= 0)
```

Reject request.

Credit is deducted immediately after job acceptance.

---

## Credit Reset

Cron:

```text
0 0 * * *
```

Runs daily at midnight.

Implementation:

```ts
await User.updateMany(
  {},
  {
    $set: {
      credits: 10
    }
  }
);
```

---

# Telegram Commands

## Supported Commands

```text
/start
/help
/credits
/history
/report <jobId>
```

---

## Content-Based Actions

```text
Send URL
    →
    URL Analysis

Upload PDF
    →
    PDF Analysis

Upload DOCX
    →
    Document Analysis

Upload TXT
    →
    Document Analysis

Upload ZIP
    →
    ZIP Analysis

Upload APK
    →
    APK Analysis
```

Analysis type is automatically detected.

---

# Database Collections

## User

Purpose:

Represents Telegram user.

Fields:

```ts
{
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;

  credits: number;

  plan: "free" | "premium";
}
```

Indexes:

```text
telegramId (unique)
```

Default Values:

```text
credits = 10
plan = free
```

---

## AnalysisJob

Purpose:

Tracks processing state.

Fields:

```ts
{
  userId: ObjectId;

  type:
    | "url"
    | "pdf"
    | "document"
    | "zip"
    | "apk";

  status:
    | "queued"
    | "processing"
    | "completed"
    | "failed";

  displayName?: string;

  originalFileName?: string;

  telegramFileId?: string;

  inputValue?: string;

  errorMessage?: string;
}
```

Indexes:

```text
userId
status
type
createdAt
```

---

## Report

Purpose:

Stores permanent analysis results.

Fields:

```ts
{
  jobId: ObjectId;

  riskScore: number;

  summary: string;

  findings: any[];

  reportData: any;

  aiProvider: string;

  aiModelVersion: string;
}
```

---

## SandboxSession

Phase 6.

Fields:

```ts
{
  userId: ObjectId;

  jobId: ObjectId;

  containerId: string;

  sessionToken: string;

  expiresAt: Date;

  status:
    | "active"
    | "expired"
    | "terminated";
}
```

---

# Queue Design

## URL Queue

```text
url-analysis
```

Worker:

```text
URL Analysis Worker
```

---

## Document Queue

```text
document-analysis
```

Worker:

```text
Document Analysis Worker
```

---

## ZIP Queue

```text
zip-analysis
```

Worker:

```text
ZIP Analysis Worker
```

---

## APK Queue

```text
apk-analysis
```

Worker:

```text
APK Analysis Worker
```

---

## Sandbox Queue

```text
sandbox-creation
```

Worker:

```text
Sandbox Worker
```

---

# URL Analysis Worker

Technology:

```text
Playwright
```

Responsibilities:

* Open URL
* Wait for rendering
* Capture screenshot
* Detect redirects
* Extract metadata
* Generate findings

Workflow:

```text
Open URL
    │
    ▼
Capture Screenshot
    │
    ▼
Extract Metadata
    │
    ▼
Generate Findings
    │
    ▼
Gemini Summary
```

Screenshot Strategy:

```text
Generate
   │
   ▼
Send To Telegram
   │
   ▼
Delete
```

No screenshot storage during MVP.

---

# Document Analysis Worker

Supported:

* PDF
* DOCX
* TXT

Responsibilities:

* Extract metadata
* Extract content
* Identify suspicious indicators
* Generate findings
* Generate summary

---

# ZIP Analysis Worker

Responsibilities:

* Extract archive
* Inspect nested archives
* Detect dangerous files
* Generate findings

Dangerous file examples:

```text
.exe
.bat
.cmd
.ps1
.vbs
.js
```

---

# APK Analysis Worker

Technologies:

```text
JADX
APKTool
```

Responsibilities:

* Parse AndroidManifest.xml
* Extract permissions
* Extract activities
* Extract services
* Extract receivers
* Extract URLs
* Generate findings

Examples:

```text
READ_SMS
READ_CONTACTS
ACCESS_FINE_LOCATION
```

---

# File Handling Strategy

Files are NOT stored permanently.

Workflow:

```text
Telegram
    │
    ▼
Download File
    │
    ▼
Analyze
    │
    ▼
Store Report
    │
    ▼
Delete File
```

Only reports are retained.

---

# Report Strategy

Store:

* Findings
* Summary
* Risk Score
* Analysis Metadata

Do Not Store:

* Uploaded files
* APKs
* ZIPs
* PDFs
* DOCX files
* Screenshots

---

# Historical Reports

Command:

```text
/history
```

Loads reports from MongoDB.

---

## Report Details

Command:

```text
/report <jobId>
```

Loads report from Report collection.

---

# APK Interactive Sandbox (Phase 6)

User Flow:

```text
Upload APK
      │
      ▼
Static Analysis
      │
      ▼
Show Button
[Launch Sandbox]
      │
      ▼
Create Container
      │
      ▼
Start Emulator
      │
      ▼
Install APK
      │
      ▼
Start noVNC
      │
      ▼
Generate Session URL
```

---

## Sandbox Stack

* Docker
* Android Emulator
* VNC
* noVNC

---

## User Actions

User can:

* Tap
* Swipe
* Type
* Navigate

inside browser.

No local APK installation required.

---

## Session Cleanup

On expiration:

```text
Stop Emulator
      │
      ▼
Destroy Container
      │
      ▼
Delete Session
```

---

# Important Implementation Rules

## Rule 1

Never execute user content on application server.

Always use Docker containers.

---

## Rule 2

Never permanently store uploaded files.

Store reports only.

---

## Rule 3

Deduct credits before job creation.

---

## Rule 4

Gemini generates summaries.

Workers generate findings.

---

## Rule 5

Containers are never shared between users.

---

## Rule 6

All analysis jobs must run through BullMQ.

No direct processing inside Telegram handlers.

---

## Rule 7

Analysis must continue working even if future MCP integrations fail.

MCPs are optional enrichments.

---

# MVP Definition

The MVP is complete when users can:

* Send URLs
* Upload PDFs
* Upload Documents
* Upload ZIP files
* Upload APKs

and receive:

* Security Findings
* Risk Score
* AI Summary

through Telegram using a secure Docker-based analysis pipeline.
