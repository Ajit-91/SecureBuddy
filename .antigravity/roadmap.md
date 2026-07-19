# SecureBuddy Roadmap

## Overview

SecureBuddy will be developed incrementally.

Each phase should deliver a working, deployable product.

The goal is to validate real user demand before introducing additional complexity.

---

# Phase 1 — Foundation

## Objective

Establish the core platform infrastructure.

---

## Features

### Telegram Bot Integration

Implement:

* Telegram Bot
* Webhook handling
* Message processing
* File upload handling

---

### User Management

Features:

* Auto-create users
* Store Telegram profile information
* Credit management
* Credit validation

---

### Database Setup

Collections:

* Users
* AnalysisJobs
* Reports

---

### Queue System

Technology:

* Redis
* BullMQ

Queues:

```text id="1mb5el"
url-analysis
document-analysis
zip-analysis
apk-analysis
sandbox-creation
```

---

### Local Development Environment

Dockerized setup:

```text id="3gttcu"
MongoDB
Redis
Backend
Workers
```

---

## Deliverables

Working Telegram bot capable of:

```text id="4rxg9n"
/start
/help
/credits
```

and automatic user creation.

---

# Phase 2 — URL Analysis

## Objective

Analyze websites safely inside isolated containers.

---

## Technology

* Playwright
* Docker

---

## Features

### URL Submission

User sends:

```text id="abuyzz"
https://example.com
```

---

### Browser Execution

Worker:

* Opens website
* Waits for rendering
* Executes JavaScript

---

### Screenshot Generation

Generate screenshot and send via Telegram.

---

### Redirect Detection

Capture:

```text id="9mxo7g"
Initial URL
Redirect Chain
Final URL
```

---

### Metadata Extraction

Examples:

* Title
* Description
* Open Graph data

---

### Security Checks

Examples:

* Excessive redirects
* Suspicious domains
* URL shorteners
* Missing HTTPS

---

### Gemini Summary

Generate:

* Summary
* Risk explanation
* Recommendations

---

## Deliverables

```text id="xwv6kr"
URL Security Report
Risk Score
Screenshot
AI Summary
```

---

# Phase 3 — Document Analysis

## Objective

Analyze uploaded documents safely.

---

## Supported Formats

```text id="4hcbz6"
PDF
DOCX
TXT
```

---

## Features

### Metadata Extraction

Examples:

* Author
* Creation date
* Modification date

---

### Content Extraction

Extract readable text.

---

### Suspicious Indicator Detection

Examples:

* Embedded links
* External references
* Suspicious keywords

---

### AI Summary

Generate:

* Summary
* Findings
* Risk explanation

---

## Deliverables

Document Security Reports.

---

# Phase 4 — ZIP Analysis

## Objective

Inspect compressed archives.

---

## Features

### Archive Extraction

Extract archive contents.

---

### Nested Archive Detection

Examples:

```text id="xocls6"
archive.zip
 └─ files.zip
     └─ content.zip
```

---

### Dangerous File Detection

Examples:

```text id="pjdzjz"
.exe
.bat
.cmd
.ps1
.js
.vbs
```

---

### Archive Statistics

Generate:

* File count
* File types
* Nested depth

---

### AI Summary

Generate findings and risk explanation.

---

## Deliverables

ZIP Security Reports.

---

# Phase 5 — APK Static Analysis

## Objective

Perform Android application static analysis.

---

## Technologies

* JADX
* APKTool

---

## Features

### Manifest Extraction

Extract:

```text id="1j7ayr"
AndroidManifest.xml
```

---

### Permission Analysis

Examples:

```text id="2kvh22"
READ_SMS
READ_CONTACTS
ACCESS_FINE_LOCATION
```

---

### Component Extraction

Extract:

* Activities
* Services
* Receivers
* Providers

---

### URL Extraction

Identify:

* Domains
* Endpoints
* API URLs

---

### Certificate Information

Extract signing details.

---

### Security Findings

Examples:

* Dangerous permissions
* Excessive permissions
* Embedded URLs

---

### Gemini Summary

Generate:

* Risk explanation
* Recommendations

---

## Deliverables

APK Security Reports.

---

# Phase 6 — APK Interactive Sandbox

## Objective

Allow users to manually explore APKs without installing them locally.

---

## Technologies

* Docker
* Android Emulator
* VNC
* noVNC

---

## User Flow

User uploads APK.

↓

Static analysis completes.

↓

Bot displays:

```text id="4x32y2"
[Launch Sandbox]
```

↓

User clicks button.

↓

Sandbox environment starts.

↓

Temporary session URL generated.

---

## Features

### Emulator Creation

Create isolated Android environment.

---

### APK Installation

Install uploaded APK.

---

### Browser Streaming

Provide browser-based access.

---

### Interactive Exploration

User can:

* Tap
* Swipe
* Type
* Navigate

---

### Session Expiration

Example:

```text id="8z3h0q"
30 Minutes
```

---

### Cleanup

Automatically:

* Stop emulator
* Destroy container
* Delete session

---

## Deliverables

Secure browser-based APK testing.

---
