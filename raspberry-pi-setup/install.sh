#!/bin/bash
#===============================================================================
# Save-It.AI Raspberry Pi 5 Master Installer
# Run this script on a fresh Raspberry Pi OS installation
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="$HOME/Save-It.AI"
REPO_URL="https://github.com/Gal07143/Save-It.AI.git"

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

# Check if running on Raspberry Pi
check_raspberry_pi() {
    if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
        print_warning "This doesn't appear to be a Raspberry Pi. Continuing anyway..."
    fi
}

# Check if running as root
check_not_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "Please don't run this script as root. Run as a normal user with sudo access."
        exit 1
    fi
}

# Main installation
main() {
    print_header "Save-It.AI Raspberry Pi 5 Installer"

    check_not_root
    check_raspberry_pi

    echo "This script will install Save-It.AI on your Raspberry Pi."
    echo ""
    echo "It will install:"
    echo "  - Python 3.11 (via pyenv)"
    echo "  - Node.js 20 LTS"
    echo "  - PostgreSQL 15 with TimescaleDB"
    echo "  - Redis"
    echo "  - Mosquitto MQTT Broker"
    echo "  - Nginx"
    echo "  - Save-It.AI Application"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
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

    print_header "Installation Complete!"
    echo ""
    echo -e "${GREEN}Save-It.AI has been successfully installed!${NC}"
    echo ""
    echo "Access your installation:"
    echo "  - Web UI: http://$(hostname).local"
    echo "  - API: http://$(hostname).local/api/v1"
    echo "  - Monitoring: http://$(hostname).local:19999"
    echo ""
    echo "Useful commands:"
    echo "  - View status: sudo systemctl status saveit-backend saveit-frontend"
    echo "  - View logs: sudo journalctl -u saveit-backend -f"
    echo "  - Dev mode: ~/Save-It.AI/dev-mode.sh"
    echo "  - Deploy: ~/Save-It.AI/dev-reload.sh"
    echo ""
    echo -e "${YELLOW}Please reboot to complete the installation:${NC}"
    echo "  sudo reboot"
}

main "$@"
