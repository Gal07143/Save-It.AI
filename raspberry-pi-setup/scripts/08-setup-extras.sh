#!/bin/bash
#===============================================================================
# Step 8: Setup Extra Features
# - Automated backups
# - System monitoring (Netdata)
# - Health checks
# - Tailscale VPN
# - Log rotation
# - Database management tools
#===============================================================================

set -e

APP_DIR="$HOME/Save-It.AI"

#-------------------------------------------------------------------------------
# 1. Automated Backups
#-------------------------------------------------------------------------------
echo "▶ Setting up automated backups..."

mkdir -p "$HOME/backups"

cat > "$HOME/backup.sh" << 'EOF'
#!/bin/bash
# Save-It.AI Backup Script

BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Load database credentials
source "$HOME/.saveit/db-credentials"

# Database backup
echo "  Backing up database..."
PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Application config backup
echo "  Backing up configuration..."
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    "$HOME/Save-It.AI/backend/.env" \
    "$HOME/.saveit" \
    2>/dev/null || true

# Cleanup old backups
echo "  Cleaning up old backups..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup complete!"
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5
EOF
chmod +x "$HOME/backup.sh"

# Schedule daily backup at 2 AM
(crontab -l 2>/dev/null | grep -v backup.sh; echo "0 2 * * * $HOME/backup.sh >> /var/log/saveit-backup.log 2>&1") | crontab -

#-------------------------------------------------------------------------------
# 2. System Monitoring (Netdata)
#-------------------------------------------------------------------------------
echo "▶ Installing Netdata monitoring..."

# Install Netdata
wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh 2>/dev/null
if [ -f /tmp/netdata-kickstart.sh ]; then
    bash /tmp/netdata-kickstart.sh --stable-channel --disable-telemetry --dont-wait || echo "  Netdata installation skipped"
    rm /tmp/netdata-kickstart.sh
fi

#-------------------------------------------------------------------------------
# 3. Health Checks
#-------------------------------------------------------------------------------
echo "▶ Setting up health checks..."

cat > "$HOME/health-check.sh" << 'EOF'
#!/bin/bash
# Health check and auto-recovery script

LOG_FILE="/var/log/saveit-health.log"
BACKEND_URL="http://localhost:8000/api/v1/health"
FRONTEND_URL="http://localhost:5002"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_and_restart() {
    local name=$1
    local url=$2
    local service=$3

    if ! curl -sf --max-time 10 "$url" > /dev/null 2>&1; then
        log "WARNING: $name is not responding, restarting..."
        sudo systemctl restart "$service"
        sleep 5
        if curl -sf --max-time 10 "$url" > /dev/null 2>&1; then
            log "INFO: $name recovered successfully"
        else
            log "ERROR: $name failed to recover"
        fi
    fi
}

# Check services
check_and_restart "Backend API" "$BACKEND_URL" "saveit-backend"
check_and_restart "Frontend" "$FRONTEND_URL" "saveit-frontend"

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 90 ]; then
    log "WARNING: Disk usage is at ${DISK_USAGE}%"
fi

# Check memory
MEM_USAGE=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -gt 90 ]; then
    log "WARNING: Memory usage is at ${MEM_USAGE}%"
fi
EOF
chmod +x "$HOME/health-check.sh"

# Create log file
sudo touch /var/log/saveit-health.log
sudo chown $(whoami) /var/log/saveit-health.log

# Run every 5 minutes
(crontab -l 2>/dev/null | grep -v health-check.sh; echo "*/5 * * * * $HOME/health-check.sh") | crontab -

#-------------------------------------------------------------------------------
# 4. Tailscale VPN (Optional)
#-------------------------------------------------------------------------------
echo "▶ Installing Tailscale VPN..."

curl -fsSL https://tailscale.com/install.sh | sh 2>/dev/null || echo "  Tailscale installation skipped"

echo ""
echo "  To enable Tailscale, run: sudo tailscale up"
echo "  This allows secure remote access from anywhere."

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
}
EOF

#-------------------------------------------------------------------------------
# 6. Database Management Tools
#-------------------------------------------------------------------------------
echo "▶ Installing database management tools..."

# Install pgcli for better PostgreSQL CLI
source "$HOME/.pyenv/versions/3.11.7/bin/activate" 2>/dev/null || true
pip install pgcli 2>/dev/null || echo "  pgcli installation skipped"

# Create database connection alias
if ! grep -q "alias db=" ~/.bashrc; then
    source "$HOME/.saveit/db-credentials"
    echo "alias db='pgcli postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME'" >> ~/.bashrc
fi

#-------------------------------------------------------------------------------
# 7. Performance Tuning
#-------------------------------------------------------------------------------
echo "▶ Applying performance tuning..."

# Increase file watchers for development
echo "fs.inotify.max_user_watches=524288" | sudo tee /etc/sysctl.d/99-saveit.conf
sudo sysctl -p /etc/sysctl.d/99-saveit.conf 2>/dev/null || true

# Optimize PostgreSQL for Raspberry Pi
sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = '256MB';" 2>/dev/null || true
sudo -u postgres psql -c "ALTER SYSTEM SET effective_cache_size = '512MB';" 2>/dev/null || true
sudo -u postgres psql -c "ALTER SYSTEM SET work_mem = '16MB';" 2>/dev/null || true
sudo systemctl reload postgresql 2>/dev/null || true

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Extra Features Installed"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  ✔ Automated backups (daily at 2 AM)"
echo "      Run manually: ~/backup.sh"
echo "      Backups stored in: ~/backups/"
echo ""
echo "  ✔ System monitoring (Netdata)"
echo "      Access at: http://$(hostname).local:19999"
echo "      Or via: http://$(hostname).local/monitoring/"
echo ""
echo "  ✔ Health checks (every 5 minutes)"
echo "      Auto-restarts failed services"
echo "      Log: /var/log/saveit-health.log"
echo ""
echo "  ✔ Tailscale VPN (optional)"
echo "      Enable with: sudo tailscale up"
echo ""
echo "  ✔ Log rotation (14 days retention)"
echo ""
echo "  ✔ Database tools"
echo "      Connect with: db (after reloading shell)"
echo ""
echo "  ✔ Performance tuning applied"
echo ""
echo "═══════════════════════════════════════════════════════════════"
