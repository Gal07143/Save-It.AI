#!/bin/bash
#===============================================================================
# Step 4: Deploy Save-It.AI Application
#===============================================================================

set -e

APP_DIR="$HOME/Save-It.AI"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# Source pyenv
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"

# Load database credentials
source "$HOME/.saveit/db-credentials"

#-------------------------------------------------------------------------------
# Backend Setup
#-------------------------------------------------------------------------------
echo "▶ Setting up backend..."
cd "$BACKEND_DIR"

# Create virtual environment
echo "  Creating Python virtual environment..."
python -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip wheel setuptools

# Install dependencies
echo "  Installing Python dependencies (this may take a few minutes)..."
pip install -r requirements.txt 2>/dev/null || pip install .

# Generate secret key
SECRET_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)

# Create .env file
echo "  Creating environment configuration..."
cat > .env << EOF
# Save-It.AI Backend Configuration
# Generated on $(date)

# Database
DATABASE_URL=$DATABASE_URL

# Redis
REDIS_URL=redis://localhost:6379/0

# MQTT
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883

# Security
SECRET_KEY=$SECRET_KEY
CSRF_SECRET_KEY=$(openssl rand -base64 32)

# CORS - Add your domains here
CORS_ORIGINS=http://localhost:5002,http://$(hostname).local,http://$(hostname).local:5002,http://$(hostname -I | awk '{print $1}')

# Environment
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO

# API Settings
API_V1_PREFIX=/api/v1
PROJECT_NAME=Save-It.AI
EOF

# Run database migrations
echo "  Running database migrations..."
alembic upgrade head 2>/dev/null || echo "  Migrations skipped (may need manual run)"

# Create logs directory
mkdir -p logs

deactivate

#-------------------------------------------------------------------------------
# Frontend Setup
#-------------------------------------------------------------------------------
echo "▶ Setting up frontend..."
cd "$FRONTEND_DIR"

# Install dependencies
echo "  Installing Node.js dependencies..."
npm install

# Build for production
echo "  Building production bundle..."
npm run build

#-------------------------------------------------------------------------------
# Create helper scripts
#-------------------------------------------------------------------------------
echo "▶ Creating helper scripts..."

# Development mode script
cat > "$APP_DIR/dev-mode.sh" << 'EOF'
#!/bin/bash
# Start Save-It.AI in development mode with hot reload

echo "Starting Save-It.AI in DEVELOPMENT mode..."
echo "Frontend: http://$(hostname).local:5002 (hot reload)"
echo "Backend: http://$(hostname).local:8000 (auto reload)"
echo ""

# Stop production services
sudo systemctl stop saveit-backend saveit-frontend 2>/dev/null || true

# Kill any existing tmux session
tmux kill-session -t saveit 2>/dev/null || true

# Create new tmux session
tmux new-session -d -s saveit -n backend

# Backend with auto-reload
tmux send-keys -t saveit:backend "cd ~/Save-It.AI/backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" Enter

# Frontend with hot-reload
tmux new-window -t saveit -n frontend
tmux send-keys -t saveit:frontend "cd ~/Save-It.AI/frontend && npm run dev -- --host 0.0.0.0" Enter

echo "Development servers started in tmux session 'saveit'"
echo ""
echo "Commands:"
echo "  Attach: tmux attach -t saveit"
echo "  Detach: Ctrl+B, then D"
echo "  Stop: tmux kill-session -t saveit"
EOF
chmod +x "$APP_DIR/dev-mode.sh"

# Deployment reload script
cat > "$APP_DIR/dev-reload.sh" << 'EOF'
#!/bin/bash
# Pull latest changes and redeploy

set -e
cd ~/Save-It.AI

echo "▶ Pulling latest changes..."
git pull

echo "▶ Rebuilding frontend..."
cd frontend
npm install
npm run build

echo "▶ Updating backend..."
cd ../backend
source venv/bin/activate
pip install -r requirements.txt 2>/dev/null || pip install .
alembic upgrade head 2>/dev/null || true
deactivate

echo "▶ Restarting services..."
sudo systemctl restart saveit-backend saveit-frontend

echo "✔ Deployment complete!"
sudo systemctl status saveit-backend saveit-frontend --no-pager
EOF
chmod +x "$APP_DIR/dev-reload.sh"

# Quick status script
cat > "$APP_DIR/status.sh" << 'EOF'
#!/bin/bash
# Show status of all Save-It.AI services

echo "═══════════════════════════════════════════════════"
echo "  Save-It.AI Service Status"
echo "═══════════════════════════════════════════════════"
echo ""

services=("saveit-backend" "saveit-frontend" "postgresql" "redis-server" "mosquitto" "nginx")

for service in "${services[@]}"; do
    status=$(systemctl is-active "$service" 2>/dev/null || echo "not installed")
    if [ "$status" = "active" ]; then
        echo "  ✔ $service: RUNNING"
    else
        echo "  ✖ $service: $status"
    fi
done

echo ""
echo "═══════════════════════════════════════════════════"
echo "  System Resources"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "  Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
echo "  CPU Temp: $(vcgencmd measure_temp 2>/dev/null | cut -d= -f2 || echo "N/A")"
echo "  Load: $(uptime | awk -F'load average:' '{print $2}')"
echo ""
EOF
chmod +x "$APP_DIR/status.sh"

echo "✔ Application deployment complete!"
