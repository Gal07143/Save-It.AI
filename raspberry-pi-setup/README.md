# Save-It.AI Raspberry Pi 5 Deployment

Complete setup scripts for deploying Save-It.AI on a Raspberry Pi 5.

## Quick Start

### Step 1: Prepare Raspberry Pi
1. Install Raspberry Pi OS Lite (64-bit) using Raspberry Pi Imager
2. Enable SSH and set hostname to `saveit-demo`
3. Connect via Ethernet for best performance

### Step 2: Initial Setup (Run on Pi)
```bash
# Download and run the master setup script
curl -fsSL https://raw.githubusercontent.com/Gal07143/Save-It.AI/main/raspberry-pi-setup/install.sh | bash
```

Or step by step:
```bash
# Clone the repository
git clone https://github.com/Gal07143/Save-It.AI.git
cd Save-It.AI/raspberry-pi-setup

# Run scripts in order
./scripts/01-system-setup.sh
./scripts/02-install-dependencies.sh
./scripts/03-install-database.sh
./scripts/04-deploy-application.sh
./scripts/05-setup-nginx.sh
./scripts/06-setup-services.sh
./scripts/07-setup-security.sh
./scripts/08-setup-extras.sh
```

### Step 3: Configure
```bash
# Edit environment variables
nano ~/Save-It.AI/backend/.env

# Update secrets and passwords
```

### Step 4: Access
- **Web UI**: http://saveit-demo.local
- **API**: http://saveit-demo.local/api/v1
- **Monitoring**: http://saveit-demo.local:19999

## Remote Development

### From your Mac:
```bash
# Connect via SSH
ssh admin@saveit-demo.local

# Or use VS Code Remote-SSH extension
# Cmd+Shift+P -> "Remote-SSH: Connect to Host"
```

### Enable Tailscale for anywhere access:
```bash
# On Pi
sudo tailscale up

# Note the IP (100.x.x.x)
# Connect from anywhere: ssh admin@100.x.x.x
```

## Useful Commands

```bash
# View service status
sudo systemctl status saveit-backend saveit-frontend

# Restart services
sudo systemctl restart saveit-backend saveit-frontend

# View logs
sudo journalctl -u saveit-backend -f

# Start development mode (hot reload)
~/Save-It.AI/dev-mode.sh

# Deploy latest changes
~/Save-It.AI/dev-reload.sh

# Manual backup
~/backup.sh
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
│   ├── saveit-frontend.service
│   └── webhook-deploy.service
├── configs/
│   ├── nginx-saveit.conf
│   ├── .env.example
│   └── fail2ban-jail.local
└── README.md
```
