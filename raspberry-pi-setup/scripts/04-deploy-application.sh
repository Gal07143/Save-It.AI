#!/bin/bash
#===============================================================================
# Step 4: Deploy Save-It.AI Application
# Sets up backend, frontend, and runs database migrations
#===============================================================================

set -e

APP_DIR="$HOME/Save-It.AI"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# Load credentials
source "$HOME/.saveit/db-credentials"
source "$HOME/.saveit/mqtt-credentials"

#-------------------------------------------------------------------------------
# Backend Setup
#-------------------------------------------------------------------------------
echo "▶ Setting up backend..."
cd "$BACKEND_DIR"

# Create virtual environment
echo "  Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip wheel setuptools

# Install dependencies
echo "  Installing Python dependencies (this may take a few minutes)..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    pip install .
fi

# Install additional required packages
echo "  Installing additional dependencies..."
pip install aiomqtt pymodbus redis

# Generate secure keys
SECRET_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
CSRF_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

# Create production .env file
echo "  Creating environment configuration..."
cat > .env << EOF
# Save-It.AI Backend Configuration
# Generated on $(date)
# Environment: Production

#-------------------------------------------------------------------------------
# Database
#-------------------------------------------------------------------------------
DATABASE_URL=$DATABASE_URL

#-------------------------------------------------------------------------------
# Redis
#-------------------------------------------------------------------------------
REDIS_URL=redis://localhost:6379/0

#-------------------------------------------------------------------------------
# MQTT
#-------------------------------------------------------------------------------
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
MQTT_USERNAME=$MQTT_USER
MQTT_PASSWORD=$MQTT_PASS

#-------------------------------------------------------------------------------
# Security
#-------------------------------------------------------------------------------
SECRET_KEY=$SECRET_KEY
SESSION_SECRET=$SESSION_SECRET
CSRF_SECRET_KEY=$CSRF_SECRET

#-------------------------------------------------------------------------------
# CORS - Update with your domains
#-------------------------------------------------------------------------------
CORS_ORIGINS=["http://localhost","http://localhost:5002","http://$(hostname).local","http://$(hostname -I | awk '{print $1}')"]
ALLOWED_ORIGINS=http://localhost,http://localhost:5002,http://$(hostname).local,http://$(hostname -I | awk '{print $1}')

#-------------------------------------------------------------------------------
# Environment
#-------------------------------------------------------------------------------
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO

#-------------------------------------------------------------------------------
# API Settings
#-------------------------------------------------------------------------------
API_V1_PREFIX=/api/v1
PROJECT_NAME=Save-It.AI
EOF

# Create logs directory
mkdir -p logs

#-------------------------------------------------------------------------------
# Database Migrations
#-------------------------------------------------------------------------------
echo "  Running database migrations..."
if [ -f "alembic.ini" ]; then
    # Run migrations
    alembic upgrade head
    echo "  Migrations complete"
else
    echo "⚠ alembic.ini not found, skipping migrations"
fi

deactivate

#-------------------------------------------------------------------------------
# Frontend Setup
#-------------------------------------------------------------------------------
echo "▶ Setting up frontend..."
cd "$FRONTEND_DIR"

# Install dependencies
echo "  Installing Node.js dependencies..."
npm ci --prefer-offline 2>/dev/null || npm install

# Build for production
echo "  Building production bundle (this may take a few minutes)..."
npm run build

# Verify build output
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "  Build complete: $(ls dist/ | wc -l) files in dist/"
else
    echo "⚠ Build may have failed. Check dist/ directory."
fi

#-------------------------------------------------------------------------------
# Create Helper Scripts
#-------------------------------------------------------------------------------
echo "▶ Creating helper scripts..."

# Development mode script
cat > "$APP_DIR/dev-mode.sh" << 'EOF'
#!/bin/bash
# Start Save-It.AI in development mode with hot reload

echo "Starting Save-It.AI in DEVELOPMENT mode..."
echo "Frontend: http://$(hostname).local:5002 (hot reload)"
echo "Backend:  http://$(hostname).local:8000 (auto reload)"
echo ""

# Stop production services
sudo systemctl stop saveit-backend 2>/dev/null || true

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
echo "  Stop:   tmux kill-session -t saveit"
echo "  Return to production: sudo systemctl start saveit-backend"
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

echo "▶ Updating backend..."
cd backend
source venv/bin/activate
pip install -r requirements.txt 2>/dev/null || pip install .
pip install aiomqtt pymodbus redis
alembic upgrade head 2>/dev/null || true
deactivate

echo "▶ Rebuilding frontend..."
cd ../frontend
npm ci --prefer-offline 2>/dev/null || npm install
npm run build

echo "▶ Restarting services..."
sudo systemctl restart saveit-backend

echo ""
echo "✔ Deployment complete!"
sudo systemctl status saveit-backend --no-pager | head -5
EOF
chmod +x "$APP_DIR/dev-reload.sh"

# Quick status script
cat > "$APP_DIR/status.sh" << 'EOF'
#!/bin/bash
# Show status of all Save-It.AI services

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Save-It.AI Service Status"
echo "═══════════════════════════════════════════════════════════════"
echo ""

services=("saveit-backend" "postgresql" "redis-server" "mosquitto" "nginx")

for service in "${services[@]}"; do
    status=$(systemctl is-active "$service" 2>/dev/null || echo "not installed")
    if [ "$status" = "active" ]; then
        echo "  ✔ $service: RUNNING"
    else
        echo "  ✖ $service: $status"
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  System Resources"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Memory:   $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "  Disk:     $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
echo "  CPU Temp: $(vcgencmd measure_temp 2>/dev/null | cut -d= -f2 || echo "N/A")"
echo "  Load:     $(uptime | awk -F'load average:' '{print $2}')"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  API Health Check"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check API health
if curl -sf http://localhost:8000/api/v1/health/live > /dev/null 2>&1; then
    echo "  API: ✔ Healthy"
else
    echo "  API: ✖ Not responding"
fi

echo ""
EOF
chmod +x "$APP_DIR/status.sh"

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo ""
echo "✔ Application deployment complete!"
echo ""
echo "  Backend:  $BACKEND_DIR"
echo "  Frontend: $FRONTEND_DIR/dist"
echo "  Config:   $BACKEND_DIR/.env"
echo ""
echo "  Helper scripts created:"
echo "    ~/Save-It.AI/status.sh     - Check service status"
echo "    ~/Save-It.AI/dev-mode.sh   - Start dev servers"
echo "    ~/Save-It.AI/dev-reload.sh - Update deployment"
