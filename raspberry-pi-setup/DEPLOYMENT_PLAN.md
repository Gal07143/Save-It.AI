# Save-It.AI Raspberry Pi 5 Production Deployment Plan

## Overview

This plan provides a complete, production-ready deployment of Save-It.AI on Raspberry Pi 5 with:
- Full application stack (Backend, Frontend, Database, MQTT)
- Remote access via Tailscale (work from Mac, not on RP5)
- Production security hardening
- Client-ready operational system

---

## Phase 1: Hardware Setup & OS Installation

### 1.1 Hardware Requirements
- Raspberry Pi 5 (8GB RAM recommended)
- MicroSD Card 64GB+ (Class 10 / A2) or NVMe SSD via PCIe
- Ethernet cable (required for initial setup)
- USB-C Power Supply (5V 5A official)

### 1.2 OS Installation (Raspberry Pi Imager)
1. Download Raspberry Pi Imager on Mac
2. Insert SD card and select:
   - OS: **Raspberry Pi OS Lite (64-bit) - Bookworm**
   - Storage: Your SD card
3. Click gear icon and configure:
   - Hostname: `saveit-demo`
   - Enable SSH with password authentication
   - Username: `admin`
   - Password: `[strong-password]` (record this!)
   - WiFi: Optional (Ethernet preferred)
   - Timezone: Your local timezone
4. Write the image

### 1.3 First Boot
1. Insert SD card into RP5
2. Connect Ethernet cable
3. Connect power
4. Wait 2-3 minutes for boot
5. Find IP address: `ping saveit-demo.local` or check router DHCP

---

## Phase 2: Remote Access Setup (PRIORITY - Do First!)

### 2.1 Initial SSH from Mac
```bash
ssh admin@saveit-demo.local
# Enter the password you set in Raspberry Pi Imager
```

### 2.2 Install Tailscale on RP5
```bash
# Run on RP5:
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Follow the URL to authenticate
# Note the Tailscale IP (100.x.x.x)
```

### 2.3 Install Tailscale on Mac
1. Download from https://tailscale.com/download
2. Install and login with same account
3. Test connection: `ssh admin@100.x.x.x`

### 2.4 Configure SSH Aliases (Mac)
Add to `~/.zshrc`:
```bash
export SAVEIT_IP="100.x.x.x"  # Your Tailscale IP
alias pi="ssh admin@\$SAVEIT_IP"
alias pi-logs="ssh admin@\$SAVEIT_IP 'journalctl -u saveit-backend -f'"
alias pi-restart="ssh admin@\$SAVEIT_IP 'sudo systemctl restart saveit-backend nginx'"
alias pi-status="ssh admin@\$SAVEIT_IP 'sudo systemctl status saveit-backend nginx postgresql mosquitto'"
```

---

## Phase 3: System Dependencies Installation

### 3.1 System Update
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget build-essential
```

### 3.2 Python 3.11+ Installation
```bash
sudo apt install -y python3 python3-pip python3-venv python3-dev
python3 --version  # Should be 3.11+
```

### 3.3 Node.js 20 LTS Installation
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should be v20.x
npm --version
```

### 3.4 PostgreSQL 15 Installation
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3.5 Redis Installation
```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 3.6 Mosquitto MQTT Broker Installation
```bash
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
```

### 3.7 Nginx Installation
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

---

## Phase 4: Database Configuration

### 4.1 Create Database and User
```bash
sudo -u postgres psql << 'EOF'
CREATE USER saveit WITH PASSWORD 'saveit_secure_prod_2026!';
CREATE DATABASE saveit OWNER saveit;
GRANT ALL PRIVILEGES ON DATABASE saveit TO saveit;
\c saveit
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF
```

### 4.2 Configure PostgreSQL for Local Access
Edit `/etc/postgresql/15/main/pg_hba.conf`:
```bash
sudo nano /etc/postgresql/15/main/pg_hba.conf
```
Ensure this line exists:
```
local   saveit   saveit   md5
```
Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### 4.3 Verify Database Connection
```bash
psql -U saveit -d saveit -c "SELECT 1;"
# Enter password: saveit_secure_prod_2026!
```

---

## Phase 5: Application Deployment

### 5.1 Clone Repository
```bash
cd ~
git clone https://github.com/Gal07143/Save-It.AI.git
cd Save-It.AI
```

### 5.2 Backend Setup
```bash
cd ~/Save-It.AI/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install additional required packages
pip install aiomqtt pymodbus redis
```

### 5.3 Backend Environment Configuration
Create `~/Save-It.AI/backend/.env`:
```bash
cat > ~/Save-It.AI/backend/.env << 'EOF'
# Database
DATABASE_URL=postgresql://saveit:saveit_secure_prod_2026!@localhost:5432/saveit

# Security
SECRET_KEY=your-very-long-random-secret-key-change-this-in-production
ENVIRONMENT=production

# MQTT
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883

# Redis
REDIS_URL=redis://localhost:6379/0

# CORS (update with your domain)
CORS_ORIGINS=["http://localhost","http://saveit-demo.local"]
EOF
```

### 5.4 Run Database Migrations
```bash
cd ~/Save-It.AI/backend
source venv/bin/activate
alembic upgrade head

# Verify tables created
psql -U saveit -d saveit -c "\dt"
```

### 5.5 Frontend Build
```bash
cd ~/Save-It.AI/frontend

# Install dependencies
npm ci

# Build for production
npm run build

# Verify build output
ls -la dist/
```

---

## Phase 6: MQTT Broker Configuration

### 6.1 Configure Mosquitto (Production Security)
```bash
# Create password file
sudo mosquitto_passwd -c /etc/mosquitto/passwd saveit_mqtt
# Enter strong password when prompted

# Configure Mosquitto
sudo tee /etc/mosquitto/conf.d/saveit.conf << 'EOF'
# Listener on standard port
listener 1883

# Authentication (disable anonymous for production)
allow_anonymous false
password_file /etc/mosquitto/passwd

# Logging
log_dest syslog
log_type error
log_type warning
log_type notice
EOF

# Restart Mosquitto
sudo systemctl restart mosquitto
```

### 6.2 Test MQTT Connection
```bash
# Subscribe in one terminal
mosquitto_sub -h localhost -t "test/#" -u saveit_mqtt -P "your_mqtt_password" &

# Publish in another
mosquitto_pub -h localhost -t "test/hello" -m "Hello MQTT" -u saveit_mqtt -P "your_mqtt_password"
```

---

## Phase 7: Systemd Services Configuration

### 7.1 Backend Service
```bash
sudo tee /etc/systemd/system/saveit-backend.service << 'EOF'
[Unit]
Description=Save-It.AI Backend API
After=network.target postgresql.service redis-server.service mosquitto.service
Requires=postgresql.service

[Service]
Type=simple
User=admin
WorkingDirectory=/home/admin/Save-It.AI/backend
Environment="PATH=/home/admin/Save-It.AI/backend/venv/bin"
ExecStart=/home/admin/Save-It.AI/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

### 7.2 Frontend Service (Optional - Nginx serves static files)
The frontend is served as static files by Nginx, no separate service needed.

### 7.3 Enable and Start Services
```bash
sudo systemctl daemon-reload
sudo systemctl enable saveit-backend
sudo systemctl start saveit-backend

# Check status
sudo systemctl status saveit-backend
```

---

## Phase 8: Nginx Configuration

### 8.1 Configure Nginx
```bash
sudo tee /etc/nginx/sites-available/saveit << 'EOF'
server {
    listen 80;
    server_name saveit-demo.local _;

    # Frontend static files
    root /home/admin/Save-It.AI/frontend/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # WebSocket support
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # SPA routing - serve index.html for all non-API routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF
```

### 8.2 Enable Site
```bash
sudo ln -sf /etc/nginx/sites-available/saveit /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

---

## Phase 9: Security Hardening

### 9.1 Firewall Configuration
```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS (future)
sudo ufw allow 41641/udp # Tailscale
sudo ufw --force enable
```

### 9.2 Fail2ban Installation
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 9.3 Secure SSH
```bash
# Generate SSH key on Mac (if not already done)
# ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy key to RP5
ssh-copy-id admin@saveit-demo.local

# Disable password authentication (optional, after testing key auth)
# sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# sudo systemctl restart sshd
```

---

## Phase 10: Verification & Testing

### 10.1 Service Status Check
```bash
sudo systemctl status saveit-backend
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status mosquitto
sudo systemctl status redis-server
```

### 10.2 API Health Check
```bash
# From RP5
curl http://localhost:8000/api/v1/health/live

# From Mac (via Tailscale)
curl http://100.x.x.x/api/v1/health/live
```

### 10.3 Web Interface Test
Open in browser (Mac):
- http://saveit-demo.local (local network)
- http://100.x.x.x (via Tailscale from anywhere)

### 10.4 Database Verification
```bash
psql -U saveit -d saveit -c "SELECT COUNT(*) FROM users;"
psql -U saveit -d saveit -c "SELECT COUNT(*) FROM alembic_version;"
```

### 10.5 MQTT Test
```bash
mosquitto_pub -h localhost -t "saveit/1/telemetry" -m '{"power": 1500}' -u saveit_mqtt -P "your_mqtt_password"
```

---

## Phase 11: Production Checklist

### 11.1 Before Client Delivery
- [ ] Change default passwords (admin user, database, MQTT)
- [ ] Generate new SECRET_KEY in .env
- [ ] Update CORS_ORIGINS with client domain
- [ ] Set up regular backups (cron job for pg_dump)
- [ ] Configure log rotation
- [ ] Test all device onboarding flows
- [ ] Create client admin user account
- [ ] Document client-specific configuration

### 11.2 Backup Setup
```bash
# Create backup script
sudo tee /usr/local/bin/saveit-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/admin/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U saveit saveit > $BACKUP_DIR/saveit_$DATE.sql
# Keep last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
EOF

sudo chmod +x /usr/local/bin/saveit-backup.sh

# Add to cron (daily at 2am)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/saveit-backup.sh") | crontab -
```

---

## Quick Reference

| Service | Port | Command |
|---------|------|---------|
| Web UI | 80 | http://saveit-demo.local |
| API | 8000 | http://saveit-demo.local/api/v1 |
| PostgreSQL | 5432 | `psql -U saveit -d saveit` |
| MQTT | 1883 | `mosquitto_pub/sub` |
| SSH | 22 | `ssh admin@saveit-demo.local` |
| Tailscale | - | `ssh admin@100.x.x.x` |

---

## Maintenance Commands

```bash
# View logs
sudo journalctl -u saveit-backend -f

# Restart services
sudo systemctl restart saveit-backend nginx

# Update application
cd ~/Save-It.AI
git pull
source backend/venv/bin/activate
pip install -r backend/requirements.txt
alembic upgrade head
cd frontend && npm ci && npm run build
sudo systemctl restart saveit-backend

# Check disk space
df -h

# Check memory
free -h
```

---

## Critical Files to Modify

1. **Backend Environment**: `/home/admin/Save-It.AI/backend/.env`
2. **Nginx Config**: `/etc/nginx/sites-available/saveit`
3. **Systemd Service**: `/etc/systemd/system/saveit-backend.service`
4. **MQTT Config**: `/etc/mosquitto/conf.d/saveit.conf`

---

## Estimated Time

- Phase 1-2 (Hardware + Remote Access): 30 minutes
- Phase 3-5 (Dependencies + App): 45 minutes
- Phase 6-8 (Services + Nginx): 30 minutes
- Phase 9-10 (Security + Testing): 20 minutes
- Phase 11 (Production Prep): 15 minutes

**Total: ~2.5 hours for complete deployment**

---

## Automated Installation

Instead of following this plan manually, you can use the automated installer:

```bash
curl -fsSL https://raw.githubusercontent.com/Gal07143/Save-It.AI/main/raspberry-pi-setup/install.sh | bash
```

This runs all the scripts in the `raspberry-pi-setup/scripts/` directory automatically.
