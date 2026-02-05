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

# Create directories
sudo mkdir -p /etc/mosquitto/conf.d
sudo mkdir -p /var/lib/mosquitto
sudo chown mosquitto:mosquitto /var/lib/mosquitto

# Create simple configuration (anonymous allowed for easy setup)
echo "▶ Configuring Mosquitto..."
sudo tee /etc/mosquitto/conf.d/saveit.conf << 'MQTTCONF'
# Save-It.AI Mosquitto Configuration
listener 1883
allow_anonymous true
persistence true
persistence_location /var/lib/mosquitto/
log_dest stdout
MQTTCONF

# Save placeholder credentials for the backend (anonymous mode)
mkdir -p "$HOME/.saveit"
cat > "$HOME/.saveit/mqtt-credentials" << EOF
MQTT_INTERNAL_USER=
MQTT_INTERNAL_PASS=
EOF
chmod 600 "$HOME/.saveit/mqtt-credentials"

# Enable and restart Mosquitto
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto

# Verify Mosquitto is running
sleep 2
if systemctl is-active --quiet mosquitto; then
    echo "✔ Mosquitto MQTT Broker running on port 1883"
else
    echo "⚠ Mosquitto may need manual start. Continuing..."
fi

echo "✔ All dependencies installed!"
echo "  Python: $(python --version)"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  Redis: $(redis-server --version | head -1)"
