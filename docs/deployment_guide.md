# SecureBuddy Networking & Deployment Guide

This document provides a simplified breakdown of cloud server deployment, firewalls, reverse proxies, and the HTTPS secure context requirement for SecureBuddy.

---

## 1. HTTP vs HTTPS & SSL Decrypted

At their core, HTTP and HTTPS are languages used to send data back and forth between a browser and a server. The critical difference is **safety**.

| Feature | HTTP (Port 80) | HTTPS (Port 443) |
| :--- | :--- | :--- |
| **Security** | ❌ Unencrypted (Clear Text) | 	c100% Encrypted via SSL/TLS |
| **Risk** | Vulnerable to packet interception | Completely safe from snooping |
| **Secure Context** | ❌ Refused by modern browsers | 	cApproved for sensitive APIs |

```
[Browser] ────► [SSL Encryption Shield (TLS Handshake)] ────► [Secure Server]
```

### What is SSL/TLS and why did Selkies complain?
**SSL (Secure Sockets Layer)** is the cryptographic protocol that handles the encryption. To activate it, a trusted third-party authority (like *Let's Encrypt*) issues a digital **Certificate** verifying your server's domain identity.

*   **The Selkies Error**: The Chromium VNC sandbox client uses browser APIs (for mouse pointer lock, clipboard copy-pasting, and audio streaming) that strictly require a **Secure Context** (HTTPS) to function. Accessing the server via a raw public IP over HTTP (`http://<VM-IP>:3000`) triggers a security block in the browser, causing the connection to fail on startup.

---

## 2. What is a Reverse Proxy & Caddy?

When you run SecureBuddy, it runs locally on port `3000`. We don't want to expose port `3000` directly to the internet because it doesn't have built-in SSL capabilities. Instead, we use a **Reverse Proxy**.

A reverse proxy acts like a security guard receptionist sitting at the entrance (ports 80/443). It receives HTTPS requests, decodes the SSL encryption, and passes the clean traffic internally to your Node.js application.

```
[User Browser (https://domain)] ──► [Caddy Web Server (Port 443)] ──► [Node API (Internal: Port 3000)]
```

### The Caddyfile Configuration
We configure Caddy by writing a block of text into `/etc/caddy/Caddyfile`:

```caddy
securebuddy.duckdns.org {
    reverse_proxy localhost:3000
}
```

*   **`securebuddy.duckdns.org`**: Tells Caddy to listen for requests hitting this specific domain name. Caddy automatically contacts Let's Encrypt in the background to download and renew your free SSL certificate.
*   **`reverse_proxy localhost:3000`**: Tells Caddy to forward all incoming traffic on that domain directly to your Node.js server running locally on port `3000`.

---

## 3. The Double-Lock Firewall

For security, cloud networks use a **two-layered security design** to lock down ports. A packet coming from the internet must pass through both locks to reach your application.

```
[Internet Request] ──► [Lock 1: Oracle Cloud Security List] ──► [Lock 2: Local VM iptables] ──► [Caddy Server]
```

### Lock 1: Oracle Cloud Ingress Rules (External Network Shield)
This is a cloud-based firewall running **outside** your server. By default, Oracle blocks ports `80` and `443`. If you don't open these ports in your Oracle Cloud Console (VCN Security Lists), the packets are discarded before they ever touch your virtual machine.

### Lock 2: Local VM iptables (Internal Server Gatekeeper)
This is a software firewall running **inside** your Ubuntu operating system. Ubuntu blocks all incoming ports unless you explicitly permit them.

To unlock this second layer, we run:
```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

*   **`-I INPUT`**: Inserts the rule at the **very top** of the rules list. This is crucial because Oracle's Ubuntu images contain a default "reject all" rule at the bottom; inserting at the top ensures our allow rule is evaluated first.
*   **`-p tcp --dport 80 / 443`**: Matches incoming TCP traffic destined for ports 80 (HTTP) and 443 (HTTPS).
*   **`-j ACCEPT`**: Tells the system to accept/allow the packet.
*   **`netfilter-persistent save`**: Saves the rule config to disk so it remains active even if the VM is rebooted.
