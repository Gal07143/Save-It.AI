#!/bin/bash
#===============================================================================
# Step 7: Security Configuration
#===============================================================================

set -e

echo "▶ Configuring UFW firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Tailscale (if used)
sudo ufw allow 41641/udp

# Allow mDNS for .local resolution
sudo ufw allow 5353/udp

# Enable firewall
echo "y" | sudo ufw enable

echo "▶ Configuring Fail2Ban..."
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16

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

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 1m
bantime = 10m
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

echo "▶ Hardening SSH..."
# Backup original config
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Apply hardening (only if not already done)
if ! grep -q "# Save-It.AI Hardening" /etc/ssh/sshd_config; then
    sudo tee -a /etc/ssh/sshd_config << 'EOF'

# Save-It.AI Hardening
PermitRootLogin no
MaxAuthTries 3
MaxSessions 5
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
fi

# Only disable password auth if SSH keys are set up
if [ -f "$HOME/.ssh/authorized_keys" ] && [ -s "$HOME/.ssh/authorized_keys" ]; then
    echo "  SSH keys found, disabling password authentication..."
    sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
else
    echo "  ⚠ No SSH keys found. Password authentication remains enabled."
    echo "    Run: ssh-copy-id $(whoami)@$(hostname).local from your Mac to add keys."
fi

sudo systemctl reload sshd

echo "▶ Setting up automatic security updates..."
sudo apt install -y unattended-upgrades
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
EOF

sudo tee /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

echo "▶ Setting secure permissions..."
chmod 700 "$HOME/.ssh" 2>/dev/null || true
chmod 600 "$HOME/.ssh/authorized_keys" 2>/dev/null || true
chmod 600 "$HOME/.saveit/"* 2>/dev/null || true

echo ""
echo "✔ Security configuration complete!"
echo ""
echo "Security measures enabled:"
echo "  ✔ UFW firewall (ports 22, 80, 443)"
echo "  ✔ Fail2Ban intrusion prevention"
echo "  ✔ SSH hardening"
echo "  ✔ Automatic security updates"
echo ""
echo "Firewall status:"
sudo ufw status
