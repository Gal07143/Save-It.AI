#!/bin/bash
#===============================================================================
# Save-It.AI Raspberry Pi 5 Production Installer
# Run this script on a fresh Raspberry Pi OS Lite (64-bit) Bookworm installation
#
# Prerequisites:
#   - Raspberry Pi 5 (8GB recommended)
#   - MicroSD 64GB+ Class 10/A2 or NVMe SSD
#   - Raspberry Pi OS Lite 64-bit (Bookworm)
#   - Ethernet connection (recommended)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Gal07143/Save-It.AI/main/raspberry-pi-setup/install.sh | bash
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="$HOME/Save-It.AI"
REPO_URL="https://github.com/Gal07143/Save-It.AI.git"
CREDENTIALS_DIR="$HOME/.saveit"

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✖ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✔ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

# Check if running on Raspberry Pi
check_raspberry_pi() {
    if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
        print_warning "This doesn't appear to be a Raspberry Pi. Continuing anyway..."
    else
        local model=$(cat /proc/cpuinfo | grep "Model" | cut -d: -f2 | xargs)
        print_info "Detected: $model"
    fi
}

# Check if running as root
check_not_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "Please don't run this script as root. Run as a normal user with sudo access."
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    print_step "Checking system requirements..."

    # Check memory
    local mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local mem_gb=$((mem_kb / 1024 / 1024))
    if [ "$mem_gb" -lt 4 ]; then
        print_warning "Less than 4GB RAM detected. 8GB recommended for production."
    else
        print_info "RAM: ${mem_gb}GB"
    fi

    # Check disk space
    local disk_avail=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
    if [ "$disk_avail" -lt 10 ]; then
        print_error "Less than 10GB disk space available. Please free up space."
        exit 1
    fi
    print_info "Available disk space: ${disk_avail}GB"

    # Check internet connectivity
    if ! ping -c 1 google.com &>/dev/null; then
        print_error "No internet connection. Please connect to the network."
        exit 1
    fi
    print_info "Internet connection: OK"
}

# Create credentials directory
setup_credentials_dir() {
    mkdir -p "$CREDENTIALS_DIR"
    chmod 700 "$CREDENTIALS_DIR"
}

# Main installation
main() {
    print_header "Save-It.AI Raspberry Pi 5 Production Installer"

    check_not_root
    check_raspberry_pi
    check_requirements
    setup_credentials_dir

    echo ""
    echo "This script will install Save-It.AI for production deployment."
    echo ""
    echo "Components to be installed:"
    echo "  - Python 3.11+ (system package)"
    echo "  - Node.js 20 LTS"
    echo "  - PostgreSQL 15"
    echo "  - Redis"
    echo "  - Mosquitto MQTT Broker (with authentication)"
    echo "  - Nginx (reverse proxy + static files)"
    echo "  - UFW Firewall + Fail2Ban"
    echo "  - Tailscale VPN (optional)"
    echo "  - Netdata monitoring"
    echo "  - Automated backups"
    echo ""
    echo -e "${YELLOW}Estimated time: ~30-45 minutes${NC}"
    echo ""

    # Auto-continue if piped from curl, otherwise ask for confirmation
    if [ -t 0 ]; then
        read -p "Continue with installation? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Installation cancelled."
            exit 0
        fi
    else
        print_info "Running in non-interactive mode, proceeding with installation..."
    fi

    # Clone repository if not exists
    if [ ! -d "$INSTALL_DIR" ]; then
        print_step "Cloning Save-It.AI repository..."
        git clone "$REPO_URL" "$INSTALL_DIR"
    else
        print_step "Repository already exists, pulling latest..."
        cd "$INSTALL_DIR" && git pull
    fi

    cd "$INSTALL_DIR/raspberry-pi-setup/scripts"

    # Make scripts executable
    chmod +x *.sh

    # Track start time
    START_TIME=$(date +%s)

    # Run each setup script
    print_header "Step 1/8: System Setup"
    ./01-system-setup.sh

    print_header "Step 2/8: Installing Dependencies"
    ./02-install-dependencies.sh

    print_header "Step 3/8: Installing Database"
    ./03-install-database.sh

    print_header "Step 4/8: Deploying Application"
    ./04-deploy-application.sh

    print_header "Step 5/8: Setting up Nginx"
    ./05-setup-nginx.sh

    print_header "Step 6/8: Setting up Services"
    ./06-setup-services.sh

    print_header "Step 7/8: Configuring Security"
    ./07-setup-security.sh

    print_header "Step 8/8: Installing Extras"
    ./08-setup-extras.sh

    # Calculate elapsed time
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    MINUTES=$((ELAPSED / 60))
    SECONDS=$((ELAPSED % 60))

    print_header "Installation Complete!"
    echo ""
    echo -e "${GREEN}Save-It.AI has been successfully installed!${NC}"
    echo ""
    echo -e "Installation time: ${MINUTES}m ${SECONDS}s"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Access URLs"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "  Web UI:      http://$(hostname).local"
    echo "  API:         http://$(hostname).local/api/v1"
    echo "  Health:      http://$(hostname).local/api/v1/health/live"
    echo "  Monitoring:  http://$(hostname).local:19999"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Credentials (saved in ~/.saveit/)"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "  Database:    cat ~/.saveit/db-credentials"
    echo "  MQTT:        cat ~/.saveit/mqtt-credentials"
    echo "  Webhook:     cat ~/.saveit/webhook-secret"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Useful Commands"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "  Status:      ~/Save-It.AI/status.sh"
    echo "  Logs:        sudo journalctl -u saveit-backend -f"
    echo "  Restart:     sudo systemctl restart saveit-backend nginx"
    echo "  Update:      ~/Save-It.AI/dev-reload.sh"
    echo "  Backup:      ~/backup.sh"
    echo "  Dev mode:    ~/Save-It.AI/dev-mode.sh"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Remote Access (Tailscale)"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "  Enable:      sudo tailscale up"
    echo "  Then add to your Mac's ~/.zshrc:"
    echo ""
    echo "    export SAVEIT_IP=\"100.x.x.x\"  # Your Tailscale IP"
    echo "    alias pi=\"ssh $(whoami)@\\\$SAVEIT_IP\""
    echo "    alias pi-logs=\"ssh $(whoami)@\\\$SAVEIT_IP 'journalctl -u saveit-backend -f'\""
    echo "    alias pi-restart=\"ssh $(whoami)@\\\$SAVEIT_IP 'sudo systemctl restart saveit-backend nginx'\""
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Reboot:           sudo reboot"
    echo "  2. Enable Tailscale: sudo tailscale up"
    echo "  3. Open browser:     http://$(hostname).local"
    echo ""
}

main "$@"
