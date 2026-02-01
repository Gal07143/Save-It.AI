# Quick Start Guide - Raspberry Pi 5 Deployment

## Prerequisites

- Raspberry Pi 5 (8GB recommended)
- MicroSD card (64GB+ Class 10)
- Ethernet connection
- Raspberry Pi OS Lite (64-bit) installed

---

## Step 1: Prepare Your Pi (5 minutes)

Using Raspberry Pi Imager:
1. Select "Raspberry Pi OS Lite (64-bit)"
2. Click the gear icon for advanced options:
   - Set hostname: `saveit-demo`
   - Enable SSH with password
   - Set username: `admin`
   - Set password: (your choice)
   - Configure WiFi (optional backup)
3. Write to SD card and boot Pi

---

## Step 2: Connect to Pi

```bash
# From your Mac/PC
ssh admin@saveit-demo.local

# If .local doesn't work, find IP with:
# ping saveit-demo.local
# or check your router's DHCP clients
```

---

## Step 3: Run Installer (30-45 minutes)

```bash
# One-line installation
curl -fsSL https://raw.githubusercontent.com/Gal07143/Save-It.AI/main/raspberry-pi-setup/install.sh -o install.sh && chmod +x install.sh && ./install.sh
```

Or manually:
```bash
git clone https://github.com/Gal07143/Save-It.AI.git
cd Save-It.AI/raspberry-pi-setup
chmod +x install.sh scripts/*.sh
./install.sh
```

---

## Step 4: Verify Installation

```bash
# Check all services
~/Save-It.AI/status.sh

# Or individually
sudo systemctl status saveit-backend
sudo systemctl status saveit-frontend
```

---

## Step 5: Access Your Installation

| Service | URL |
|---------|-----|
| Web App | http://saveit-demo.local |
| API | http://saveit-demo.local/api/v1 |
| Health | http://saveit-demo.local/api/v1/health |
| Monitoring | http://saveit-demo.local:19999 |

---

## Remote Development Setup

### Option A: VS Code Remote (Recommended)

1. Install VS Code on your Mac
2. Install "Remote - SSH" extension
3. Press `Cmd+Shift+P` → "Remote-SSH: Connect to Host"
4. Enter: `admin@saveit-demo.local`
5. Open folder: `/home/admin/Save-It.AI`

### Option B: Tailscale (Access from Anywhere)

```bash
# On Pi
sudo tailscale up
# Note the 100.x.x.x IP shown

# From anywhere
ssh admin@100.x.x.x
```

---

## Development Workflow

### Make Changes Locally & Deploy

```bash
# On your Mac
cd Save-It.AI
# Make changes...
git add . && git commit -m "Your changes" && git push

# On Pi (or set up webhook for auto-deploy)
~/Save-It.AI/dev-reload.sh
```

### Live Development (Hot Reload)

```bash
# On Pi
~/Save-It.AI/dev-mode.sh

# Attach to see logs
tmux attach -t saveit
```

---

## Useful Commands

```bash
# Service management
sudo systemctl restart saveit-backend saveit-frontend
sudo systemctl status saveit-backend saveit-frontend

# View logs
sudo journalctl -u saveit-backend -f
sudo journalctl -u saveit-frontend -f

# Database access
db  # (after reloading shell)

# Manual backup
~/backup.sh

# System status
~/Save-It.AI/status.sh

# Deploy latest
~/Save-It.AI/dev-reload.sh
```

---

## Troubleshooting

### Services won't start
```bash
# Check logs
sudo journalctl -u saveit-backend -n 50
sudo journalctl -u saveit-frontend -n 50

# Check ports
sudo netstat -tlpn | grep -E '8000|5002'
```

### Database connection issues
```bash
# Test database
sudo -u postgres psql -c "SELECT 1"

# Check credentials
cat ~/.saveit/db-credentials
```

### Can't access web interface
```bash
# Check nginx
sudo nginx -t
sudo systemctl status nginx

# Check firewall
sudo ufw status
```

### Low memory
```bash
# Check usage
free -h

# Reduce workers in backend service
sudo nano /etc/systemd/system/saveit-backend.service
# Change --workers 2 to --workers 1
sudo systemctl daemon-reload
sudo systemctl restart saveit-backend
```

---

## Backup & Restore

### Manual Backup
```bash
~/backup.sh
ls -la ~/backups/
```

### Restore Database
```bash
# Stop services
sudo systemctl stop saveit-backend

# Restore
gunzip -c ~/backups/db_YYYYMMDD_HHMMSS.sql.gz | psql -U saveit saveit_db

# Start services
sudo systemctl start saveit-backend
```

---

## Security Notes

1. **Change default passwords** in `~/.saveit/db-credentials`
2. **Set up SSH keys** for passwordless, secure access
3. **Enable Tailscale** for secure remote access
4. **Keep system updated**: `sudo apt update && sudo apt upgrade`

---

## Support

- Issues: https://github.com/Gal07143/Save-It.AI/issues
- Documentation: See main README.md
