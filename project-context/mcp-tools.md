# MCP Tool Strategy

## Overview

MCP integrations are not required for the MVP.

Core analysis must function independently.

MCPs are used only to enrich findings and improve report quality.

If an MCP provider is unavailable, analysis should continue normally.

---

# Architecture Philosophy

Core Workflow:

```text id="kz6wra"
Worker
   │
   ▼
Generate Findings
   │
   ▼
Gemini Summary
   │
   ▼
Store Report
```

MCP-Enriched Workflow:

```text id="81hsk6"
Worker
   │
   ▼
Generate Findings
   │
   ├── Threat Intelligence MCP
   ├── Reputation MCP
   ├── Research MCP
   │
   ▼
Gemini Summary
   │
   ▼
Enhanced Report
```

---

# Important Decision

Gemini is NOT an MCP.

Gemini is a core application dependency.

Gemini is responsible for:

* Summaries
* Risk explanations
* Recommendations

MCPs provide additional context.

---

# Threat Intelligence MCPs

## Purpose

Determine whether indicators have already been identified as malicious.

---

## Potential Providers

### VirusTotal

Possible Use Cases:

* URL reputation
* Domain reputation
* File hash reputation

Examples:

```text id="hv06km"
Known Malware

Known Phishing

Known Malicious Domain
```

---

### AbuseIPDB

Possible Use Cases:

* IP reputation
* Abuse history
* Threat scores

---

## Future Flow

```text id="ql0wwi"
URL
 │
 ▼
Extract Domain
 │
 ▼
Threat Intelligence MCP
 │
 ▼
Reputation Result
```

---

# Vulnerability Intelligence MCPs

## Purpose

Provide vulnerability context.

---

## Potential Sources

### CVE Database

Examples:

```text id="5tazdr"
CVE-2025-1234

CVE-2026-5678
```

---

### National Vulnerability Database (NVD)

Provides:

* Severity
* References
* Remediation guidance

---

## Future Use Cases

Examples:

```text id="mn8mlo"
APK Contains Library X

↓

Search Vulnerability Sources

↓

Known CVEs Found

↓

Include In Report
```

---

# Domain Intelligence MCPs

## Purpose

Enrich URL investigations.

---

## Potential Data

Examples:

* Domain age
* Registrar
* DNS information
* Hosting provider

---

## Future Use Cases

Examples:

```text id="utjcyx"
Newly Registered Domain

↓

Increase Risk Score
```

---

# Research MCPs

## Purpose

Provide broader security context.

---

## Examples

### Security Advisories

Sources:

* Vendor advisories
* Security bulletins

---

### Malware Intelligence

Sources:

* Public threat reports
* Security blogs
* Research publications

---

## Future Use Cases

Examples:

```text id="m8br8e"
Domain Linked To Known Campaign

↓

Include Threat Context
```

---

# Reputation MCPs

## Purpose

Assist with trust evaluation.

---

## Examples

### URL Reputation

Questions:

```text id="c5b8f8"
Has this URL been reported before?

Has it been flagged as phishing?

Is it associated with malware?
```

---

### File Reputation

Questions:

```text id="1ajx6h"
Has this APK hash been seen before?

Was it previously flagged?
```

---

# AI Agent MCP Usage (Future)

Phase:

```text id="htly7g"
Phase 7+
```

---

## Agent Workflow

```text id="u4n4bq"
User Request
      │
      ▼
Security Agent
      │
      ├── Threat Intel MCP
      ├── Reputation MCP
      ├── Research MCP
      ├── Vulnerability MCP
      │
      ▼
Reasoning
      │
      ▼
Gemini Summary
      │
      ▼
Enhanced Report
```

---

# Reliability Rules

All MCP integrations must:

### Use Timeouts

Prevent slow external providers from blocking analysis.

---

### Fail Gracefully

If MCP fails:

```text id="8qvllm"
Continue Analysis
```

---

### Never Block Core Workflow

Analysis completion must not depend on external services.

---

### Log Failures

Capture:

* Provider
* Error
* Timestamp

for monitoring.

---

# Caching Strategy

Future optimization.

Cache:

* Domain reputation
* IP reputation
* Hash lookups

Benefits:

* Lower costs
* Faster reports
* Reduced rate-limit issues

---

# Security Rules

Never send sensitive user information to MCP providers.

Only send:

* URLs
* Domains
* Hashes
* Indicators of compromise

when required.

Avoid sharing:

* User metadata
* Telegram identifiers
* Internal report data

unless absolutely necessary.

---

# MVP Decision

For MVP:

```text id="b9kkc0"
No MCP Integrations
```

Use:

```text id="11r6vx"
Workers
+
Gemini
```

only.

MCP integrations begin in Phase 8 after the core platform has proven stable and useful.
