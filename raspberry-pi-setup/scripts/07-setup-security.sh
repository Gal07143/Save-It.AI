#!/bin/bash
#===============================================================================
# Step 7: Security Configuration
# Configures UFW firewall, Fail2Ban, and SSH hardening
#===============================================================================

set -e

echo "▶ Configuring UFW firewall..."

# Reset and configure
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Tailscale UDP port
sudo ufw allow 41641/udp

# Allow mDNS for .local resolution
sudo ufw allow 5353/udp

# Note: MQTT (1883) is NOT exposed externally - only localhost access
# If you need external MQTT access, uncomment:
# sudo ufw allow 1883/tcp

# Enable firewall
echo "y" | sudo ufw enable

echo "▶ Configuring Fail2Ban..."

# Create jail configuration
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# Ban for 1 hour, escalating to 24h for repeat offenders
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16

# Action: ban IP using ufw
banaction = ufw

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 1m
bantime = 10m

[nginx-botsearch]
enabled = true
port = http,https
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 2
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

echo "▶ Hardening SSH..."

# Backup original config
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d)

# Apply hardening (only if not already done)
if ! grep -q "# Save-It.AI Security Hardening" /etc/ssh/sshd_config; then
    sudo tee -a /etc/ssh/sshd_config << 'EOF'

# Save-It.AI Security Hardening
PermitRootLogin no
MaxAuthTries 3
MaxSessions 5
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitEmptyPasswords no
EOF
fi

# Check for SSH keys and optionally disable password auth
if [ -f "$HOME/.ssh/authorized_keys" ] && [ -s "$HOME/.ssh/authorized_keys" ]; then
    echo "  SSH keys found. You may disable password authentication."
    echo ""
    echo "  To disable password auth (after verifying key access works):"
    echo "    sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config"
    echo "    sudo systemctl reload sshd"
else
    echo "  ⚠ No SSH keys found. Password authentication remains enabled."
    echo ""
    echo "  To add SSH keys from your Mac:"
    echo "    ssh-copy-id $(whoami)@$(hostname).local"
fi

sudo systemctl reload sshd

echo "▶ Setting up automatic security updates..."
sudo apt install -y unattended-upgrades apt-listchanges

sudo tee /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}:${distro_codename}-updates";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Mail "";
EOF

sudo tee /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

echo "▶ Setting secure file permissions..."
chmod 700 "$HOME/.ssh" 2>/dev/null || true
chmod 600 "$HOME/.ssh/authorized_keys" 2>/dev/null || true
chmod 600 "$HOME/.saveit/"* 2>/dev/null || true
chmod 600 "$HOME/Save-It.AI/backend/.env" 2>/dev/null || true

echo ""
echo "✔ Security configuration complete!"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Security Measures Enabled"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  ✔ UFW firewall (ports: 22, 80, 443, 41641/udp, 5353/udp)"
echo "  ✔ Fail2Ban intrusion prevention"
echo "  ✔ SSH hardening (root login disabled, max 3 auth attempts)"
echo "  ✔ Automatic security updates"
echo "  ✔ Secure file permissions"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Firewall Status"
echo "═══════════════════════════════════════════════════════════════"
echo ""
sudo ufw status numbered
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Fail2Ban Status"
echo "═══════════════════════════════════════════════════════════════"
echo ""
sudo fail2ban-client status 2>/dev/null || echo "  Fail2Ban starting..."
