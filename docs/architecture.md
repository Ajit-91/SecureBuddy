# SecureBuddy Technical Architecture & Flow Diagrams

This document outlines the system architecture, component boundaries, and core workflow diagrams of **SecureBuddy**, a Telegram-based AI Security Assistant.

---

## 1. High-Level System Architecture

SecureBuddy uses a distributed, queue-based sandbox architecture built on Node.js, Docker, MongoDB, and Redis. It isolates dangerous actions (like navigating to sketchy URLs or running untrusted APKs) inside temporary, sandboxed Docker containers.

```mermaid
graph TD
    User([Telegram User]) <-->|Message / Buttons| Bot[Grammy Bot Interface]
    Bot -->|Enqueue Analysis Jobs| Redis[(Redis Broker)]
    
    subgraph Background Queue Workers
        Worker[BullMQ Worker Pool]
        Redis <--> Worker
        Worker -->|DB State Management| DB[(MongoDB)]
        Worker -->|Executes Sandbox| DockerHost[Docker Daemon]
    end
    
    subgraph Isolated Containers
        DockerHost -->|URL Scan| Playwright[Playwright Analyzer]
        DockerHost -->|URL Sandbox| ChromiumVNC[Chromium noVNC Sandbox]
        DockerHost -->|APK Sandbox| AndroidKVM[Android Emulator Sandbox]
    end
    
    Worker -->|Fetch/Analyze Payload| Playwright
    Express[Express API Server] <-->|DB Verification| DB
    Express <-->|Single-Port WS/HTTP Proxy| ChromiumVNC
    Express <-->|Single-Port WS/HTTP Proxy| AndroidKVM
    User <-->|HTTPS: Port 443| Caddy[Caddy Reverse Proxy] <-->|Port 3000| Express
```

---

## 2. Core Workflow Diagrams

### A. URL Threat Scan Flow
This flow is triggered when a user sends a website URL to the bot. It runs a headless Playwright scanner in a container, captures a screenshot, extracts findings, and summarizes the risk using Gemini.

```mermaid
sequenceDiagram
    autonumber
    actor User as Telegram User
    participant Bot as Telegram Bot
    participant Queue as BullMQ (Redis)
    participant Worker as URL Worker
    participant Docker as Playwright Container
    participant AI as Gemini API
    
    User->>Bot: Sends URL
    Bot->>Queue: Enqueues URL_ANALYSIS Job
    Queue->>Worker: Dequeues Job
    Worker->>Bot: Sends "Analysis Started" message
    Worker->>Docker: Spawns Playwright Container
    activate Docker
    Docker->>Docker: Navigates to target URL
    Docker->>Docker: Captures screenshot & result.json
    Docker-->>Worker: Writes data to shared temp folder
    deactivate Docker
    Worker->>AI: Sends metadata, chain, & findings
    AI-->>Worker: Returns AI Summary & Recommendations
    Worker->>Bot: Uploads screenshot + Threat Report text
    Worker->>Bot: Sends "🚀 Launch Sandbox" invitation button
    Worker->>Worker: Deletes temp folder
```

---

### B. Interactive VNC Sandbox Flow
This flow allows users to interactively browse the URL inside a secure containerized browser, using our secure HTTP/WebSocket proxy on port 3000.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant Express as Express API Server
    participant DB as MongoDB
    participant Docker as Docker Host
    participant VNC as Chromium VNC Container (Port 3000)
    
    User->>Express: GET /session/:token
    Express->>DB: Verify active session token
    DB-->>Express: Session active, local port is 49152
    Express->>User: Redirects to /sandbox/:token/
    
    Note over User, Express: HTTP Reverse Proxying
    User->>Express: GET /sandbox/:token/vnc.html
    Express->>VNC: HTTP Proxy to 127.0.0.1:49152/vnc.html
    VNC-->>Express: Returns HTML
    Express-->>User: Serves HTML
    
    Note over User, Express: WebSocket Upgrade Proxying
    User->>Express: WS /sandbox/:token/websockify (Upgrade)
    Express->>DB: Verify session port
    Express->>VNC: Upgrades socket connection to ws://127.0.0.1:49152/websockify
    VNC-->>Express: WebSocket Tunnel Established
    Express-->>User: WebSocket Tunnel Open (VNC Interactive Stream active!)
```

---

### C. APK Dynamic Analyzer Flow
This flow downloads an APK from Telegram, detects host KVM compatibility, starts an Android emulator container, installs the app, and opens a VNC tunnel.

```mermaid
sequenceDiagram
    autonumber
    actor User as Telegram User
    participant Bot as Telegram Bot
    participant Queue as BullMQ (Redis)
    participant Worker as Sandbox Worker
    participant Docker as Docker Host
    participant Android as Android Container (Port 6080)
    
    User->>Bot: Uploads APK file
    Bot->>Queue: Enqueues Sandbox Creation Job
    Queue->>Worker: Dequeues Job
    Worker->>Worker: Downloads APK file from Telegram API
    Worker->>Docker: Checks `/dev/kvm` availability inside Docker
    alt KVM Available
        Worker->>Docker: Spawn Android container with --device /dev/kvm
    else No KVM
        Worker->>Docker: Fallback to Chromium VNC Container (URL mock mode)
    end
    activate Android
    Worker->>Android: Poll getprop sys.boot_completed until "1" (5 min timeout)
    Worker->>Android: Copy APK: docker cp app.apk container:/tmp/app.apk
    Worker->>Android: Install: docker exec adb install /tmp/app.apk
    deactivate Android
    Worker->>Bot: Sends "Interactive Sandbox Ready" Telegram message with session link
    Worker->>Worker: Clean up temporary files
```
