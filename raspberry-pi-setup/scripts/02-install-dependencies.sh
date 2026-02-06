#!/bin/bash
#===============================================================================
# Step 2: Install Runtime Dependencies
# Installs Python 3.11+, Node.js 20 LTS, Redis, Mosquitto MQTT
#===============================================================================

set -e

NODE_VERSION="20"

#-------------------------------------------------------------------------------
# Python 3.11+ (System Package - Faster than pyenv on Pi)
#-------------------------------------------------------------------------------
echo "▶ Installing Python 3.11+..."
sudo apt install -y python3 python3-pip python3-venv python3-dev

# Verify version
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo "  Python version: $PYTHON_VERSION"

# Check if version is 3.11+
MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 11 ]); then
    echo "⚠ Python 3.11+ recommended. Current: $PYTHON_VERSION"
fi

#-------------------------------------------------------------------------------
# Node.js 20 LTS via NodeSource
#-------------------------------------------------------------------------------
echo "▶ Installing Node.js $NODE_VERSION LTS..."
if ! command -v node &> /dev/null || ! node --version | grep -q "^v${NODE_VERSION}"; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "  Node.js version: $(node --version)"
echo "  npm version: $(npm --version)"

# Install useful global npm packages
echo "▶ Installing global npm packages..."
sudo npm install -g serve pm2 2>/dev/null || true

#-------------------------------------------------------------------------------
# Redis
#-------------------------------------------------------------------------------
echo "▶ Installing Redis..."
sudo apt install -y redis-server

# Configure Redis for production
sudo tee /etc/redis/redis.conf.d/saveit.conf > /dev/null 2>/dev/null << 'EOF' || true
# Save-It.AI Redis Configuration
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify Redis
if redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "  Redis: OK (PONG)"
else
    echo "⚠ Redis may need manual verification"
fi

#-------------------------------------------------------------------------------
# Mosquitto MQTT Broker (Production with Authentication)
#-------------------------------------------------------------------------------
echo "▶ Installing Mosquitto MQTT Broker..."
sudo apt install -y mosquitto mosquitto-clients

# Create directories
sudo mkdir -p /etc/mosquitto/conf.d
sudo mkdir -p /var/lib/mosquitto
sudo chown mosquitto:mosquitto /var/lib/mosquitto

# Generate MQTT credentials
MQTT_USER="saveit_mqtt"
MQTT_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

echo "▶ Configuring Mosquitto with authentication..."

# Create password file
sudo sh -c "echo '' | mosquitto_passwd -c -b /etc/mosquitto/passwd $MQTT_USER '$MQTT_PASS'"
sudo chmod 600 /etc/mosquitto/passwd
sudo chown mosquitto:mosquitto /etc/mosquitto/passwd

# Create production configuration
sudo tee /etc/mosquitto/conf.d/saveit.conf > /dev/null << 'EOF'
# Save-It.AI Mosquitto Configuration
# Production mode with authentication

# Listener on standard port
listener 1883

# Authentication (disable anonymous for production)
allow_anonymous false
password_file /etc/mosquitto/passwd

# Persistence
persistence true
persistence_location /var/lib/mosquitto/

# Logging
log_dest syslog
log_type error
log_type warning
log_type notice

# Connection settings
max_connections 1000
max_queued_messages 10000

# Keep-alive
keepalive_interval 60
EOF

# Save MQTT credentials
mkdir -p "$HOME/.saveit"
cat > "$HOME/.saveit/mqtt-credentials" << EOF
# Save-It.AI MQTT Credentials
# Generated on $(date)

MQTT_USER=$MQTT_USER
MQTT_PASS=$MQTT_PASS
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
EOF
chmod 600 "$HOME/.saveit/mqtt-credentials"

# Enable and restart Mosquitto
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto

# Verify Mosquitto is running
sleep 2
if systemctl is-active --quiet mosquitto; then
    echo "  Mosquitto: RUNNING on port 1883"

    # Test MQTT connection
    if mosquitto_pub -h localhost -t "test/ping" -m "pong" -u "$MQTT_USER" -P "$MQTT_PASS" 2>/dev/null; then
        echo "  MQTT auth: OK"
    else
        echo "⚠ MQTT auth test failed. May need manual verification."
    fi
else
    echo "⚠ Mosquitto may need manual start"
fi

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo ""
echo "✔ All dependencies installed!"
echo ""
echo "  Python:    $(python3 --version | cut -d' ' -f2)"
echo "  Node.js:   $(node --version)"
echo "  npm:       $(npm --version)"
echo "  Redis:     $(redis-server --version | head -1 | cut -d' ' -f3)"
echo "  Mosquitto: $(mosquitto -h 2>&1 | head -1 | cut -d' ' -f3 || echo 'installed')"
echo ""
echo "  MQTT credentials saved to: ~/.saveit/mqtt-credentials"
