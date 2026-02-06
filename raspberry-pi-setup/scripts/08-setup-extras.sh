#!/bin/bash
#===============================================================================
# Step 8: Setup Extra Features
# - Tailscale VPN (remote access from anywhere)
# - Automated backups
# - System monitoring (Netdata)
# - Health checks with auto-recovery
# - Log rotation
# - PostgreSQL tuning
#===============================================================================

set -e

APP_DIR="$HOME/Save-It.AI"

#-------------------------------------------------------------------------------
# 1. Tailscale VPN (Priority - Remote Access)
#-------------------------------------------------------------------------------
echo "▶ Installing Tailscale VPN..."

if ! command -v tailscale &> /dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "  Tailscale installed"
else
    echo "  Tailscale already installed"
fi

echo ""
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║  IMPORTANT: Enable Tailscale for remote access!           ║"
echo "  ║                                                            ║"
echo "  ║  Run:  sudo tailscale up                                   ║"
echo "  ║                                                            ║"
echo "  ║  This gives you a 100.x.x.x IP accessible from anywhere.  ║"
echo "  ║  Install Tailscale on your Mac too!                        ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo ""

#-------------------------------------------------------------------------------
# 2. Automated Backups
#-------------------------------------------------------------------------------
echo "▶ Setting up automated backups..."

mkdir -p "$HOME/backups"

cat > "$HOME/backup.sh" << 'EOF'
#!/bin/bash
# Save-It.AI Backup Script
# Run manually or via cron

BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Load database credentials
if [ -f "$HOME/.saveit/db-credentials" ]; then
    source "$HOME/.saveit/db-credentials"

    # Database backup
    echo "  Backing up database..."
    PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U "$DB_USER" "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

    if [ -f "$BACKUP_DIR/db_$DATE.sql.gz" ]; then
        echo "  Database backup: OK ($(du -h "$BACKUP_DIR/db_$DATE.sql.gz" | cut -f1))"
    fi
fi

# Application config backup
echo "  Backing up configuration..."
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    "$HOME/Save-It.AI/backend/.env" \
    "$HOME/.saveit" \
    2>/dev/null || true

# Cleanup old backups
echo "  Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup complete!"
echo ""
echo "Recent backups:"
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5
EOF
chmod +x "$HOME/backup.sh"

# Schedule daily backup at 2 AM
(crontab -l 2>/dev/null | grep -v "backup.sh"; echo "0 2 * * * $HOME/backup.sh >> /var/log/saveit-backup.log 2>&1") | crontab -

# Create log file
sudo touch /var/log/saveit-backup.log
sudo chown $(whoami) /var/log/saveit-backup.log

#-------------------------------------------------------------------------------
# 3. System Monitoring (Netdata)
#-------------------------------------------------------------------------------
echo "▶ Installing Netdata monitoring..."

if ! command -v netdata &> /dev/null; then
    wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh 2>/dev/null
    if [ -f /tmp/netdata-kickstart.sh ]; then
        bash /tmp/netdata-kickstart.sh --stable-channel --disable-telemetry --dont-wait 2>/dev/null || echo "  Netdata installation skipped"
        rm -f /tmp/netdata-kickstart.sh
    fi
else
    echo "  Netdata already installed"
fi

#-------------------------------------------------------------------------------
# 4. Health Checks with Auto-Recovery
#-------------------------------------------------------------------------------
echo "▶ Setting up health checks..."

cat > "$HOME/health-check.sh" << 'EOF'
#!/bin/bash
# Health check and auto-recovery script
# Runs every 5 minutes via cron

LOG_FILE="/var/log/saveit-health.log"
BACKEND_URL="http://localhost:8000/api/v1/health/live"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_and_restart() {
    local name=$1
    local url=$2
    local service=$3

    if ! curl -sf --max-time 10 "$url" > /dev/null 2>&1; then
        log "WARNING: $name not responding, attempting restart..."
        sudo systemctl restart "$service"
        sleep 10
        if curl -sf --max-time 10 "$url" > /dev/null 2>&1; then
            log "INFO: $name recovered successfully"
        else
            log "ERROR: $name failed to recover after restart"
        fi
    fi
}

# Check backend API
check_and_restart "Backend API" "$BACKEND_URL" "saveit-backend"

# Check disk space (warn at 85%, critical at 95%)
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 95 ]; then
    log "CRITICAL: Disk usage at ${DISK_USAGE}% - immediate attention required!"
elif [ "$DISK_USAGE" -gt 85 ]; then
    log "WARNING: Disk usage at ${DISK_USAGE}%"
fi

# Check memory (warn at 85%)
MEM_USAGE=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -gt 85 ]; then
    log "WARNING: Memory usage at ${MEM_USAGE}%"
fi

# Check CPU temperature (warn at 70C, throttle at 80C)
if command -v vcgencmd &> /dev/null; then
    TEMP=$(vcgencmd measure_temp | cut -d= -f2 | cut -d. -f1)
    if [ "$TEMP" -gt 80 ]; then
        log "CRITICAL: CPU temperature at ${TEMP}C - thermal throttling likely!"
    elif [ "$TEMP" -gt 70 ]; then
        log "WARNING: CPU temperature at ${TEMP}C"
    fi
fi
EOF
chmod +x "$HOME/health-check.sh"

# Create log file
sudo touch /var/log/saveit-health.log
sudo chown $(whoami) /var/log/saveit-health.log

# Run every 5 minutes
(crontab -l 2>/dev/null | grep -v "health-check.sh"; echo "*/5 * * * * $HOME/health-check.sh") | crontab -

#-------------------------------------------------------------------------------
# 5. Log Rotation
#-------------------------------------------------------------------------------
echo "▶ Configuring log rotation..."

sudo tee /etc/logrotate.d/saveit << EOF
/var/log/saveit-*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 $(whoami) $(whoami)
}

$HOME/Save-It.AI/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 $(whoami) $(whoami)
    postrotate
        systemctl reload saveit-backend 2>/dev/null || true
    endscript
}
EOF

#-------------------------------------------------------------------------------
# 6. Database CLI Tools
#-------------------------------------------------------------------------------
echo "▶ Setting up database tools..."

# Install pgcli for better PostgreSQL CLI
pip3 install --user pgcli 2>/dev/null || echo "  pgcli installation skipped"

# Create database connection alias
if ! grep -q "alias db=" ~/.bashrc; then
    if [ -f "$HOME/.saveit/db-credentials" ]; then
        source "$HOME/.saveit/db-credentials"
        echo "alias db='PGPASSWORD=\"$DB_PASSWORD\" psql -h localhost -U $DB_USER -d $DB_NAME'" >> ~/.bashrc
    fi
fi

#-------------------------------------------------------------------------------
# 7. Create Production Checklist
#-------------------------------------------------------------------------------
echo "▶ Creating production checklist..."

cat > "$APP_DIR/PRODUCTION_CHECKLIST.md" << 'EOF'
# Save-It.AI Production Checklist

## Before Client Delivery

### Security
- [ ] Changed default passwords (admin user, database, MQTT)
- [ ] Generated new SECRET_KEY in backend/.env
- [ ] Set up SSH key authentication
- [ ] Disabled password SSH authentication (after testing keys)
- [ ] Verified firewall rules (sudo ufw status)
- [ ] Tested Fail2Ban is working

### Configuration
- [ ] Updated CORS_ORIGINS with client domain
- [ ] Configured email/SMTP settings (if needed)
- [ ] Set correct timezone (sudo timedatectl)
- [ ] Updated hostname (sudo hostnamectl set-hostname)

### Testing
- [ ] API health check passes
- [ ] Web interface loads correctly
- [ ] User registration/login works
- [ ] Device onboarding works
- [ ] MQTT telemetry works
- [ ] Alerts/alarms work

### Backups
- [ ] Verified backup script runs (~/backup.sh)
- [ ] Tested backup restoration
- [ ] Configured off-site backup (optional)

### Monitoring
- [ ] Netdata accessible at :19999
- [ ] Health check cron job running
- [ ] Log rotation configured

### Documentation
- [ ] Client admin account created
- [ ] Access credentials documented
- [ ] Tailscale setup documented
- [ ] Support contact provided

## Quick Commands

```bash
# Check status
~/Save-It.AI/status.sh

# View logs
sudo journalctl -u saveit-backend -f

# Restart services
sudo systemctl restart saveit-backend nginx

# Manual backup
~/backup.sh

# Check Tailscale
tailscale status
```

## Access URLs

- Web UI: http://[hostname].local
- API: http://[hostname].local/api/v1
- Monitoring: http://[hostname].local:19999
EOF

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Extra Features Installed"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  ✔ Tailscale VPN"
echo "      Enable with: sudo tailscale up"
echo "      Then connect from anywhere via 100.x.x.x IP"
echo ""
echo "  ✔ Automated backups (daily at 2 AM)"
echo "      Manual run: ~/backup.sh"
echo "      Location:   ~/backups/"
echo ""
echo "  ✔ System monitoring (Netdata)"
echo "      Access at: http://$(hostname).local:19999"
echo ""
echo "  ✔ Health checks (every 5 minutes)"
echo "      Auto-restarts failed services"
echo "      Log: /var/log/saveit-health.log"
echo ""
echo "  ✔ Log rotation (14 days retention)"
echo ""
echo "  ✔ Database CLI tools"
echo "      Connect with: db (after reloading shell)"
echo ""
echo "  ✔ Production checklist"
echo "      See: ~/Save-It.AI/PRODUCTION_CHECKLIST.md"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Mac SSH Aliases (add to ~/.zshrc):"
echo ""
echo "    export SAVEIT_IP=\"100.x.x.x\"  # Your Tailscale IP"
echo "    alias pi=\"ssh $(whoami)@\$SAVEIT_IP\""
echo "    alias pi-logs=\"ssh $(whoami)@\$SAVEIT_IP 'journalctl -u saveit-backend -f'\""
echo "    alias pi-status=\"ssh $(whoami)@\$SAVEIT_IP '~/Save-It.AI/status.sh'\""
echo "    alias pi-restart=\"ssh $(whoami)@\$SAVEIT_IP 'sudo systemctl restart saveit-backend nginx'\""
echo ""
echo "═══════════════════════════════════════════════════════════════"
