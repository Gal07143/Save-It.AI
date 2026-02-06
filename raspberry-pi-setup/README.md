# Save-It.AI Raspberry Pi 5 Production Deployment

Complete production-ready deployment of Save-It.AI on Raspberry Pi 5 with remote access via Tailscale.

## Requirements

### Hardware
- Raspberry Pi 5 (8GB RAM recommended)
- MicroSD Card 64GB+ (Class 10 / A2) or NVMe SSD via PCIe
- Ethernet cable (recommended for initial setup)
- USB-C Power Supply (5V 5A official)

### Software
- Raspberry Pi OS Lite (64-bit) - Bookworm
- Internet connection

## Quick Start

### Step 1: Prepare Raspberry Pi

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Insert SD card and select:
   - **OS**: Raspberry Pi OS Lite (64-bit) - Bookworm
   - **Storage**: Your SD card
3. Click the **gear icon** and configure:
   - Hostname: `saveit-demo`
   - Enable SSH with password authentication
   - Username: `admin`
   - Password: `[your-secure-password]`
   - Configure WiFi (optional)
   - Set your timezone
4. Write the image and insert into Pi

### Step 2: First Boot & SSH

```bash
# Wait 2-3 minutes for first boot, then:
ssh admin@saveit-demo.local
# Enter the password you set in Raspberry Pi Imager
```

### Step 3: Install Save-It.AI

```bash
# One-command installation (~30-45 minutes)
curl -fsSL https://raw.githubusercontent.com/Gal07143/Save-It.AI/main/raspberry-pi-setup/install.sh | bash
```

Or step-by-step:

```bash
git clone https://github.com/Gal07143/Save-It.AI.git
cd Save-It.AI/raspberry-pi-setup

# Run scripts in order
./scripts/01-system-setup.sh       # System updates, tools
./scripts/02-install-dependencies.sh  # Python, Node.js, Redis, MQTT
./scripts/03-install-database.sh   # PostgreSQL
./scripts/04-deploy-application.sh # Backend, frontend, migrations
./scripts/05-setup-nginx.sh        # Reverse proxy
./scripts/06-setup-services.sh     # Systemd services
./scripts/07-setup-security.sh     # Firewall, Fail2Ban
./scripts/08-setup-extras.sh       # Tailscale, backups, monitoring
```

### Step 4: Enable Remote Access (Tailscale)

```bash
# On Raspberry Pi:
sudo tailscale up
# Follow the URL to authenticate
# Note the Tailscale IP (100.x.x.x)

# On your Mac:
# 1. Install Tailscale from https://tailscale.com/download
# 2. Login with the same account
# 3. Now you can connect from anywhere:
ssh admin@100.x.x.x
```

### Step 5: Access the Application

- **Web UI**: http://saveit-demo.local (or http://100.x.x.x via Tailscale)
- **API**: http://saveit-demo.local/api/v1
- **Health Check**: http://saveit-demo.local/api/v1/health/live
- **Monitoring**: http://saveit-demo.local:19999

## Mac SSH Aliases

Add to your `~/.zshrc`:

```bash
export SAVEIT_IP="100.x.x.x"  # Your Tailscale IP
alias pi="ssh admin@\$SAVEIT_IP"
alias pi-logs="ssh admin@\$SAVEIT_IP 'journalctl -u saveit-backend -f'"
alias pi-status="ssh admin@\$SAVEIT_IP '~/Save-It.AI/status.sh'"
alias pi-restart="ssh admin@\$SAVEIT_IP 'sudo systemctl restart saveit-backend nginx'"
alias pi-pull="ssh admin@\$SAVEIT_IP 'cd ~/Save-It.AI && git pull && sudo systemctl restart saveit-backend'"
```

## Useful Commands

```bash
# Check all services status
~/Save-It.AI/status.sh

# View backend logs
sudo journalctl -u saveit-backend -f

# Restart services
sudo systemctl restart saveit-backend nginx

# Update to latest version
~/Save-It.AI/dev-reload.sh

# Start development mode (hot reload)
~/Save-It.AI/dev-mode.sh

# Run backup manually
~/backup.sh

# Check Tailscale status
tailscale status
```

## Credentials

All generated credentials are saved in `~/.saveit/`:

```bash
cat ~/.saveit/db-credentials      # Database credentials
cat ~/.saveit/mqtt-credentials    # MQTT broker credentials
cat ~/.saveit/webhook-secret      # GitHub webhook secret
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx (Port 80)                          │
│  - Static files: /home/admin/Save-It.AI/frontend/dist       │
│  - API proxy: localhost:8000                                │
│  - Rate limiting, security headers                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────────┐     ┌───────────────────┐
│  FastAPI Backend  │     │  Static Frontend  │
│    (Port 8000)    │     │   (dist folder)   │
│  - REST API       │     │   - React SPA     │
│  - WebSocket      │     │   - Vite build    │
└───────┬───────────┘     └───────────────────┘
        │
        ├──────────────┬──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  PostgreSQL  │ │  Redis   │ │  Mosquitto   │
│  (Port 5432) │ │  (6379)  │ │  MQTT (1883) │
└──────────────┘ └──────────┘ └──────────────┘
```

## Ports

| Service     | Port  | External | Notes                    |
|-------------|-------|----------|--------------------------|
| SSH         | 22    | Yes      | Secured with Fail2Ban    |
| HTTP        | 80    | Yes      | Nginx reverse proxy      |
| HTTPS       | 443   | Yes      | (Configure for SSL)      |
| Backend API | 8000  | No       | Internal only            |
| PostgreSQL  | 5432  | No       | Internal only            |
| Redis       | 6379  | No       | Internal only            |
| MQTT        | 1883  | No       | Internal only            |
| Netdata     | 19999 | No       | Via /monitoring/ proxy   |
| Tailscale   | 41641 | Yes      | UDP for VPN              |

## Security

- **Firewall**: UFW configured to allow only SSH, HTTP, HTTPS, Tailscale
- **Fail2Ban**: Protects SSH and Nginx from brute force attacks
- **SSH Hardening**: Root login disabled, limited auth attempts
- **MQTT Auth**: Password authentication required
- **Auto Updates**: Unattended security updates enabled

## Backups

Automated daily backups at 2 AM:
- Database dumps (gzipped)
- Configuration files
- 7-day retention

Manual backup:
```bash
~/backup.sh
```

Backups stored in `~/backups/`

## Troubleshooting

### Can't connect via SSH

```bash
# Check if Pi is on the network
ping saveit-demo.local

# If mDNS not working, find IP from router or:
# Connect a monitor to see the IP on login screen
```

### Backend won't start

```bash
# Check service status
sudo systemctl status saveit-backend

# View logs
sudo journalctl -u saveit-backend -n 50

# Common fixes:
# - Check DATABASE_URL in backend/.env
# - Run: cd ~/Save-It.AI/backend && source venv/bin/activate && alembic upgrade head
# - Verify PostgreSQL is running: sudo systemctl status postgresql
```

### Web interface not loading

```bash
# Check Nginx
sudo systemctl status nginx
sudo nginx -t  # Test configuration

# Check frontend build exists
ls ~/Save-It.AI/frontend/dist/

# Rebuild if needed
cd ~/Save-It.AI/frontend && npm run build
```

### MQTT not working

```bash
# Check Mosquitto
sudo systemctl status mosquitto

# Test connection
source ~/.saveit/mqtt-credentials
mosquitto_pub -h localhost -t "test" -m "hello" -u $MQTT_USER -P $MQTT_PASS
```

## File Structure

```
raspberry-pi-setup/
├── install.sh              # Master installer
├── scripts/
│   ├── 01-system-setup.sh
│   ├── 02-install-dependencies.sh
│   ├── 03-install-database.sh
│   ├── 04-deploy-application.sh
│   ├── 05-setup-nginx.sh
│   ├── 06-setup-services.sh
│   ├── 07-setup-security.sh
│   └── 08-setup-extras.sh
├── services/
│   ├── saveit-backend.service
│   └── saveit-webhook.service
├── configs/
│   ├── .env.example
│   ├── nginx-saveit.conf
│   └── fail2ban-jail.local
├── README.md
├── DEPLOYMENT_PLAN.md
└── QUICKSTART.md
```

## Support

For issues, please open a GitHub issue at:
https://github.com/Gal07143/Save-It.AI/issues
