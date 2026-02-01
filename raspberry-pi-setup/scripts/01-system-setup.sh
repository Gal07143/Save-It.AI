#!/bin/bash
#===============================================================================
# Step 1: System Setup
# Updates system and installs essential tools
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
    unzip

echo "▶ Setting timezone..."
sudo timedatectl set-timezone UTC

echo "▶ Configuring system limits..."
sudo tee -a /etc/security/limits.conf > /dev/null << 'EOF'
* soft nofile 65535
* hard nofile 65535
EOF

echo "▶ Enabling memory cgroups for better resource management..."
if ! grep -q "cgroup_memory=1" /boot/firmware/cmdline.txt 2>/dev/null; then
    sudo sed -i 's/$/ cgroup_memory=1 cgroup_enable=memory/' /boot/firmware/cmdline.txt 2>/dev/null || true
fi

echo "✔ System setup complete!"
