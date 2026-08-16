#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=================================================="
echo "   SecureBuddy VM Auto-Setup Script        "
echo "=================================================="

# 1. System Update & Essentials
echo "[1/8] Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y
# Set frontend to non-interactive to auto-accept prompts for iptables-persistent
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y curl git build-essential iptables-persistent

# 2. Setup Swap Space (2GB)
echo "[2/8] Checking and setting up swap space..."
if [ -f /swapfile ]; then
    echo "Swap file already exists. Skipping."
else
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap space (2GB) configured successfully."
fi

# 3. Install Node.js (v20)
echo "[3/8] Installing Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"

# 4. Install Docker
echo "[4/8] Installing Docker..."
sudo apt-get install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
echo "Docker installed successfully."

# 5. Install PM2
echo "[5/8] Installing PM2 globally..."
sudo npm install -g pm2
echo "PM2 version: $(pm2 -v)"

# 6. Install and Configure Caddy Web Server (Reverse Proxy)
echo "[6/8] Installing and configuring Caddy Web Server..."
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy

echo "Creating default /etc/caddy/Caddyfile template..."
sudo tee /etc/caddy/Caddyfile <<EOF
# Replace securebuddy.duckdns.org with your actual domain name!
securebuddy.duckdns.org {
    reverse_proxy localhost:3000
}
EOF

sudo systemctl restart caddy
echo "Caddy installed and started."

# 7. Configure VM Firewall (Open ports 80 and 443)
echo "[7/8] Opening ports 80 and 443 in Ubuntu iptables..."
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
echo "Firewall rules updated and saved."

# 8. Pre-pull required Docker images & build custom URL analyzer
echo "[8/8] Pre-pulling required Docker images and building custom image..."
sudo docker pull lscr.io/linuxserver/chromium:latest
sudo docker pull mcr.microsoft.com/playwright:v1.45.0-jammy
sudo docker pull alpine:latest
sudo docker pull budtmo/docker-android:emulator_9.0
sudo docker build -t securebuddy-url-analyzer:latest ./docker/url-analysis



echo "=================================================="
echo "          VM SETUP COMPLETED SUCCESSFULLY         "
echo "=================================================="
echo "IMPORTANT: Please log out of SSH and log back in"
echo "to apply Docker user group permissions."
echo ""
echo "Next Steps to deploy:"
echo "1. Clone your repository: git clone <repo_url> securebuddy"
echo "2. Navigate to folder: cd securebuddy"
echo "3. Configure your .env file"
echo "4. Build project: npm install && npm run build"
echo "5. Start via PM2: npm run prod:start"
echo "6. Save startup state: pm2 save && pm2 startup"
echo "=================================================="
