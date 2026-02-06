#!/bin/bash
#===============================================================================
# Step 1: System Setup
# Updates system and installs essential tools for production deployment
#===============================================================================

set -e

echo "▶ Updating system packages..."
sudo apt update
sudo apt upgrade -y

echo "▶ Installing essential tools..."
sudo apt install -y \
    git \
    curl \
    wget \
    htop \
    tmux \
    vim \
    nano \
    ufw \
    fail2ban \
    build-essential \
    libffi-dev \
    libssl-dev \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    libncurses5-dev \
    libncursesw5-dev \
    xz-utils \
    tk-dev \
    liblzma-dev \
    libpq-dev \
    jq \
    unzip \
    avahi-daemon

echo "▶ Setting timezone..."
# Keep UTC for server consistency, or set to local timezone
sudo timedatectl set-timezone UTC

echo "▶ Configuring hostname resolution..."
# Ensure mDNS works for .local domains
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

echo "▶ Configuring system limits..."
# Increase file descriptor limits for production
if ! grep -q "# Save-It.AI limits" /etc/security/limits.conf; then
    sudo tee -a /etc/security/limits.conf > /dev/null << 'EOF'

# Save-It.AI limits
* soft nofile 65535
* hard nofile 65535
* soft nproc 32768
* hard nproc 32768
EOF
fi

echo "▶ Configuring kernel parameters..."
# Optimize for IoT workloads
sudo tee /etc/sysctl.d/99-saveit.conf > /dev/null << 'EOF'
# Save-It.AI kernel optimizations

# File watchers for development
fs.inotify.max_user_watches = 524288

# Network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# Memory management
vm.swappiness = 10
vm.dirty_ratio = 60
vm.dirty_background_ratio = 2
EOF

sudo sysctl -p /etc/sysctl.d/99-saveit.conf 2>/dev/null || true

echo "▶ Enabling memory cgroups for resource management..."
# Required for proper container/process resource limits
CMDLINE_FILE=""
if [ -f /boot/firmware/cmdline.txt ]; then
    CMDLINE_FILE="/boot/firmware/cmdline.txt"
elif [ -f /boot/cmdline.txt ]; then
    CMDLINE_FILE="/boot/cmdline.txt"
fi

if [ -n "$CMDLINE_FILE" ]; then
    if ! grep -q "cgroup_memory=1" "$CMDLINE_FILE" 2>/dev/null; then
        sudo sed -i 's/$/ cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE_FILE"
        echo "  Memory cgroups will be enabled after reboot"
    fi
fi

echo "▶ Creating application directories..."
mkdir -p "$HOME/.saveit"
mkdir -p "$HOME/backups"
chmod 700 "$HOME/.saveit"

echo ""
echo "✔ System setup complete!"
echo ""
echo "  - System packages updated"
echo "  - Essential tools installed"
echo "  - Timezone set to UTC"
echo "  - mDNS enabled ($(hostname).local)"
echo "  - System limits configured"
echo "  - Kernel parameters optimized"
