#!/bin/bash
#===============================================================================
# Step 2: Install Runtime Dependencies
# Installs Python 3.11 (pyenv), Node.js 20, Redis, MQTT
#===============================================================================

set -e

PYTHON_VERSION="3.11.7"
NODE_VERSION="20"

#-------------------------------------------------------------------------------
# Python via pyenv
#-------------------------------------------------------------------------------
echo "▶ Installing pyenv..."
if [ ! -d "$HOME/.pyenv" ]; then
    curl https://pyenv.run | bash
fi

# Add pyenv to bashrc if not already present
if ! grep -q 'PYENV_ROOT' ~/.bashrc; then
    cat >> ~/.bashrc << 'EOF'

# Pyenv configuration
export PYENV_ROOT="$HOME/.pyenv"
command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
EOF
fi

# Source for current session
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"

echo "▶ Installing Python $PYTHON_VERSION (this may take 10-15 minutes on Pi)..."
if ! pyenv versions | grep -q "$PYTHON_VERSION"; then
    pyenv install "$PYTHON_VERSION"
fi
pyenv global "$PYTHON_VERSION"

echo "▶ Verifying Python installation..."
python --version

#-------------------------------------------------------------------------------
# Node.js via NodeSource
#-------------------------------------------------------------------------------
echo "▶ Installing Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "▶ Verifying Node.js installation..."
node --version
npm --version

# Install global npm packages
echo "▶ Installing global npm packages..."
sudo npm install -g serve pm2

#-------------------------------------------------------------------------------
# Redis
#-------------------------------------------------------------------------------
echo "▶ Installing Redis..."
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

#-------------------------------------------------------------------------------
# Mosquitto MQTT Broker
#-------------------------------------------------------------------------------
echo "▶ Installing Mosquitto MQTT Broker..."
sudo apt install -y mosquitto mosquitto-clients

# Create Mosquitto configuration directory
sudo mkdir -p /etc/mosquitto/conf.d
sudo mkdir -p /var/lib/mosquitto

# Create main configuration
echo "▶ Configuring Mosquitto..."
sudo tee /etc/mosquitto/conf.d/saveit.conf << 'MQTTCONF'
# Save-It.AI Mosquitto Configuration
# =================================

# Network listeners
listener 1883 0.0.0.0
protocol mqtt

# Persistence
persistence true
persistence_location /var/lib/mosquitto/

# Logging
log_dest syslog
log_type error
log_type warning
log_type notice
log_type information
connection_messages true

# Authentication
# Allow anonymous for local connections (backend subscriber)
# Require password for remote connections (gateways)
allow_anonymous false
password_file /etc/mosquitto/passwd

# ACL configuration
acl_file /etc/mosquitto/acl

# Performance tuning
max_queued_messages 10000
max_inflight_messages 100

# Connection limits
max_connections 500
MQTTCONF

# Create initial password file with internal subscriber account
MQTT_INTERNAL_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 24)

# Create password file
sudo touch /etc/mosquitto/passwd
sudo mosquitto_passwd -b /etc/mosquitto/passwd saveit_internal "$MQTT_INTERNAL_PASS"

# Save internal credentials for the backend
mkdir -p "$HOME/.saveit"
cat > "$HOME/.saveit/mqtt-credentials" << EOF
MQTT_INTERNAL_USER=saveit_internal
MQTT_INTERNAL_PASS=$MQTT_INTERNAL_PASS
EOF
chmod 600 "$HOME/.saveit/mqtt-credentials"

# Create ACL file
sudo tee /etc/mosquitto/acl << 'ACLCONF'
# Save-It.AI MQTT ACL Configuration
# =================================

# Internal subscriber has full access (for backend data ingestion)
user saveit_internal
topic readwrite #

# Gateway pattern: gw_<id>_<token> can only access their topics
# Pattern matching for gateway topics
pattern readwrite saveit/%u/#
pattern readwrite device/%u/#

# All authenticated users can read their own topics
pattern read $SYS/broker/clients/connected
ACLCONF

# Set proper permissions
sudo chown -R mosquitto:mosquitto /var/lib/mosquitto
sudo chmod 600 /etc/mosquitto/passwd

# Enable and restart Mosquitto
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto

# Verify Mosquitto is running
sleep 2
if systemctl is-active --quiet mosquitto; then
    echo "✔ Mosquitto MQTT Broker running on port 1883"
else
    echo "✖ WARNING: Mosquitto failed to start. Check: sudo journalctl -u mosquitto"
fi

echo "✔ All dependencies installed!"
echo "  Python: $(python --version)"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  Redis: $(redis-server --version | head -1)"
