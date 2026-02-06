# Save-It.AI Quick Start Guide

Get Save-It.AI running on your Raspberry Pi 5 in under an hour.

## Prerequisites

- Raspberry Pi 5 (8GB recommended)
- MicroSD Card 64GB+ (Class 10/A2) or NVMe SSD
- Ethernet cable
- USB-C Power Supply (5V 5A official)
- A Mac/PC for initial setup

---

## Step 1: Flash the OS (5 minutes)

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your Mac
2. Insert your SD card
3. In Imager, select:
   - **OS**: Raspberry Pi OS Lite (64-bit) - Bookworm
   - **Storage**: Your SD card
4. Click the **gear icon** (⚙️) and configure:
   - ✅ Set hostname: `saveit-demo`
   - ✅ Enable SSH (password authentication)
   - ✅ Set username: `admin`
   - ✅ Set password: (choose a strong password!)
   - ✅ Set your timezone
5. Click **Write** and wait for it to finish

---

## Step 2: Boot & Connect (5 minutes)

1. Insert SD card into Raspberry Pi
2. Connect Ethernet cable
3. Connect power
4. Wait 2-3 minutes for first boot

```bash
# From your Mac, connect via SSH:
ssh admin@saveit-demo.local

# Enter the password you set in step 1
```

If `.local` doesn't work, check your router's DHCP clients for the IP.

---

## Step 3: Install Save-It.AI (30-45 minutes)

```bash
# Run the one-command installer:
curl -fsSL https://raw.githubusercontent.com/Gal07143/Save-It.AI/main/raspberry-pi-setup/install.sh | bash
```

☕ Go grab a coffee - this takes about 30-45 minutes.

---

## Step 4: Enable Remote Access (5 minutes)

```bash
# On your Raspberry Pi, enable Tailscale:
sudo tailscale up

# Follow the URL shown to authenticate
# Note down the 100.x.x.x IP address
```

Then on your Mac:
1. Install Tailscale from https://tailscale.com/download
2. Login with the same account
3. Now you can connect from anywhere!

---

## Step 5: Access Your Installation

Open in your browser:

| Service     | URL                                    |
|-------------|----------------------------------------|
| Web App     | http://saveit-demo.local               |
| API         | http://saveit-demo.local/api/v1        |
| Health      | http://saveit-demo.local/api/v1/health/live |
| Monitoring  | http://saveit-demo.local:19999         |

Via Tailscale (from anywhere):
- http://100.x.x.x (your Tailscale IP)

---

## That's It! 🎉

Your Save-It.AI installation is ready for production.

---

## Quick Reference

### Useful Commands

```bash
# Check status of all services
~/Save-It.AI/status.sh

# View backend logs
sudo journalctl -u saveit-backend -f

# Restart services
sudo systemctl restart saveit-backend nginx

# Update to latest version
~/Save-It.AI/dev-reload.sh

# Start development mode (hot reload)
~/Save-It.AI/dev-mode.sh

# Run manual backup
~/backup.sh
```

### View Credentials

```bash
cat ~/.saveit/db-credentials      # Database
cat ~/.saveit/mqtt-credentials    # MQTT
cat ~/.saveit/webhook-secret      # GitHub webhook
```

### Mac SSH Shortcuts

Add to your `~/.zshrc`:

```bash
export SAVEIT_IP="100.x.x.x"  # Your Tailscale IP
alias pi="ssh admin@\$SAVEIT_IP"
alias pi-logs="ssh admin@\$SAVEIT_IP 'journalctl -u saveit-backend -f'"
alias pi-status="ssh admin@\$SAVEIT_IP '~/Save-It.AI/status.sh'"
alias pi-restart="ssh admin@\$SAVEIT_IP 'sudo systemctl restart saveit-backend nginx'"
```

---

## Development Workflow

### VS Code Remote (Recommended)

1. Install VS Code on your Mac
2. Install "Remote - SSH" extension
3. Press `Cmd+Shift+P` → "Remote-SSH: Connect to Host"
4. Enter: `admin@saveit-demo.local` (or Tailscale IP)
5. Open folder: `/home/admin/Save-It.AI`

### Deploy Changes

```bash
# On your Mac
cd Save-It.AI
# Make changes...
git add . && git commit -m "Your changes" && git push

# On Pi (or via SSH)
~/Save-It.AI/dev-reload.sh
```

### Live Development

```bash
# On Pi - start dev servers with hot reload
~/Save-It.AI/dev-mode.sh

# Attach to see logs
tmux attach -t saveit

# Detach: Ctrl+B, then D
# Stop: tmux kill-session -t saveit
```

---

## Troubleshooting

### Services won't start

```bash
# Check logs
sudo journalctl -u saveit-backend -n 50

# Verify database is running
sudo systemctl status postgresql

# Check credentials
cat ~/.saveit/db-credentials
```

### Can't access web interface

```bash
# Check nginx configuration
sudo nginx -t
sudo systemctl status nginx

# Check firewall
sudo ufw status

# Check frontend build exists
ls ~/Save-It.AI/frontend/dist/
```

### Low memory issues

```bash
# Check usage
free -h

# Reduce backend workers
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

# Restore from backup
source ~/.saveit/db-credentials
gunzip -c ~/backups/db_YYYYMMDD_HHMMSS.sql.gz | PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" "$DB_NAME"

# Start services
sudo systemctl start saveit-backend
```

---

## Security Checklist

Before going to production:

- [ ] Changed default passwords
- [ ] Generated new SECRET_KEY in backend/.env
- [ ] Set up SSH key authentication
- [ ] Enabled Tailscale for secure remote access
- [ ] Tested backups and restore
- [ ] Reviewed firewall rules (`sudo ufw status`)

---

## More Information

- Full documentation: [README.md](README.md)
- Detailed deployment plan: [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md)
- Issues: https://github.com/Gal07143/Save-It.AI/issues
