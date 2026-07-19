# SecureBuddy

## Vision

SecureBuddy is a Telegram-based AI Security Assistant.

Users interact entirely through Telegram.

The platform allows users to safely investigate potentially malicious content without exposing their own devices.

Supported content:

* URLs
* Websites
* PDFs
* Documents
* ZIP files
* APK files

SecureBuddy analyzes content inside isolated disposable environments and returns actionable security insights.

---

# Core Principles

## Zero Trust

All user-provided content is treated as potentially malicious.

Nothing is trusted by default.

Every analysis executes inside an isolated environment.

---

## Isolation First

Potentially dangerous content never executes directly on the application server.

All analysis runs inside disposable Docker containers.

Examples:

* URL Analysis → Playwright Container
* APK Analysis → JADX/APKTool Container
* APK Streaming → Android Emulator Container

---

## Ephemeral Processing

Files are temporary.

Workflow:

1. Receive content
2. Analyze content
3. Generate report
4. Store report
5. Delete temporary files

Uploaded files are not permanently retained during MVP phases.

---

# User Experience

Users interact exclusively through Telegram.

Examples:

* Send URL
* Upload PDF
* Upload ZIP
* Upload APK
* Upload DOCX

SecureBuddy returns:

* AI summary
* Security findings
* Risk score
* Screenshots (URL Analysis)
* Security reports

---

# Telegram User Experience (MVP)

SecureBuddy is designed to be extremely simple to use.

Users should not need to learn complicated commands.

Most actions are automatically inferred from the content they send.

---

## First-Time User Experience

User sends:

```text
/start
```

Bot responds:

```text
👋 Welcome to SecureBuddy

I can analyze:

🔗 URLs
📄 PDFs
📦 ZIP files
📱 APK files
📑 Documents

Simply send a URL or upload a file.

Examples:

https://example.com

or upload:
- APK
- PDF
- ZIP
- DOCX
```

When a user interacts for the first time:

1. Telegram ID is extracted.
2. User record is created automatically.
3. User receives 10 credits.
4. No signup or login is required.

---

## URL Analysis

User sends:

```text
https://example.com
```

System automatically detects URL input.

Workflow:

```text
URL
 │
 ▼
Create Job
 │
 ▼
Queue
 │
 ▼
URL Analysis Worker
 │
 ▼
Generate Report
```

Response:

```text
🛡 URL Analysis Complete

Risk Score: 25/100

Summary:
...

Findings:
...
```

A screenshot is attached as a Telegram image.

---

## PDF Analysis

User uploads:

```text
invoice.pdf
```

System automatically detects PDF.

Response:

```text
📄 PDF Analysis Complete

Risk Score: ...

Summary:
...

Findings:
...
```

---

## Document Analysis

Supported:

* DOCX
* TXT

User uploads document.

System automatically detects document type and starts analysis.

---

## ZIP Analysis

User uploads:

```text
project.zip
```

System automatically detects ZIP archive and starts analysis.

Response:

```text
📦 ZIP Analysis Complete

Risk Score: ...

Summary:
...

Findings:
...
```

---

## APK Analysis

User uploads:

```text
banking.apk
```

System automatically detects APK file and starts static analysis.

Response:

```text
📱 APK Analysis Complete

Risk Score: ...

Summary:
...

Findings:
...
```

---

## Credits Command

Command:

```text
/credits
```

Response:

```text
💳 Credits

Remaining Credits: 7 / 10

Resets at midnight.
```

---

## Historical Reports

Command:

```text
/history
```

Response Example:

```text
1. banking.apk
   Risk: 72
   Date: Jul 19

2. invoice.pdf
   Risk: 10
   Date: Jul 18

3. suspicious-site.xyz
   Risk: 65
   Date: Jul 17
```

Reports are loaded from MongoDB.

Original uploaded files are not retained.

---

## View Report Details

Command:

```text
/report <jobId>
```

Example:

```text
/report 123
```

Response:

```text
Report #123

Type: APK

Risk Score: 72

Summary:
...

Findings:
...
```

---

## Help Command

Command:

```text
/help
```

Response:

```text
Available Commands

/start
/help
/credits
/history
/report <jobId>

Or simply send:

🔗 URL
📄 PDF
📦 ZIP
📱 APK
📑 DOCX
```

---

## APK Sandbox Workflow (Phase 6)

Step 1:

User uploads APK.

```text
banking.apk
```

Step 2:

SecureBuddy performs static analysis.

Step 3:

Bot sends report along with an inline action button:

```text
🛡 APK Analysis Complete

Would you like to launch this APK in a sandbox?

[Launch Sandbox]
```

Step 4:

User clicks:

```text
Launch Sandbox
```

Step 5:

System:

1. Creates dedicated Docker container.
2. Starts Android emulator.
3. Installs APK.
4. Starts noVNC.
5. Generates temporary browser session.

Bot responds:

```text
✅ Sandbox Ready

Open:

https://securebuddy.com/session/<token>

Session expires in 30 minutes.
```

Users can:

* Tap
* Swipe
* Type
* Navigate

without installing APKs on their own devices.

Containers are destroyed automatically when sessions expire.

---

## Supported Commands

```text
/start
/help
/credits
/history
/report <jobId>
```

Everything else is automatically inferred:

```text
Send URL      → URL Analysis
Upload PDF    → PDF Analysis
Upload DOCX   → Document Analysis
Upload ZIP    → ZIP Analysis
Upload APK    → APK Analysis
```

# User Management

Telegram acts as the identity provider.

Users are automatically created when interacting with the bot for the first time.

No:

* Signup
* Login
* Password
* Email verification

User ownership is tracked using Telegram ID.

---

# Credits System

SecureBuddy uses a daily credit system.

Each analysis consumes credits.

Default user allocation:

```text
10 credits per day
```

Rules:

* Every successful analysis request consumes 1 credit.
* Credits are deducted immediately after job acceptance.
* If a user has no remaining credits, new jobs cannot be created.
* Credits reset automatically every midnight.

Future subscription plans will replace the hardcoded credit allocation.

---

# Initial Features

## URL Analysis

Features:

* Open URL in isolated browser
* Capture screenshot
* Detect redirects
* Extract metadata
* Generate AI summary
* Generate risk score

Screenshot lifecycle:

```text
Generate Screenshot
        │
        ▼
Send To Telegram
        │
        ▼
Delete Screenshot
```

Screenshots are not stored permanently during MVP.

---

## Document Analysis

Supported:

* PDF
* DOCX
* TXT

Features:

* Metadata extraction
* Content extraction
* Suspicious indicator detection
* AI summarization

---

## ZIP Analysis

Features:

* Archive extraction
* Nested file inspection
* Suspicious file detection

---

## APK Static Analysis

Features:

* AndroidManifest.xml extraction
* Permission analysis
* Activity extraction
* Receiver extraction
* Service extraction
* Embedded URL extraction
* Security report generation

---

# Historical Reports

Reports are stored permanently.

Stored:

* Risk score
* Findings
* AI summary
* Analysis metadata

Not Stored:

* APK files
* PDFs
* ZIP files
* Uploaded documents
* Screenshots

Historical reports are generated from stored report data.

---

# APK Interactive Sandbox (Phase 6)

Users upload APKs and request streaming.

System:

* Creates Android emulator
* Installs APK
* Launches application
* Generates temporary browser session

Users can:

* Tap
* Swipe
* Type
* Navigate

without installing APKs on their own devices.

Sessions automatically expire and are destroyed.

---

# Long-Term Vision

Future features include:

* AI Security Agent
* MCP Integrations
* Automated APK Exploration
* EXE Analysis
* EXE Streaming
* Advanced Malware Analysis
* Threat Intelligence Enrichment
