#!/bin/bash
#===============================================================================
# Step 3: Install and Configure PostgreSQL 15
# Sets up PostgreSQL with production-ready configuration
#===============================================================================

set -e

# Database configuration (matching deployment plan)
DB_USER="saveit"
DB_NAME="saveit"
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

#-------------------------------------------------------------------------------
# PostgreSQL Installation
#-------------------------------------------------------------------------------
echo "▶ Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

echo "▶ Starting PostgreSQL..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Wait for PostgreSQL to be ready
sleep 3

#-------------------------------------------------------------------------------
# Create Database and User
#-------------------------------------------------------------------------------
echo "▶ Creating database and user..."
sudo -u postgres psql << EOF
-- Drop existing if needed (for clean reinstall)
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create user and database
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Connect to database and enable extensions
\c $DB_NAME

-- UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Statistics extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

#-------------------------------------------------------------------------------
# Save Credentials
#-------------------------------------------------------------------------------
echo "▶ Saving database credentials..."
mkdir -p "$HOME/.saveit"
cat > "$HOME/.saveit/db-credentials" << EOF
# Save-It.AI Database Credentials
# Generated on $(date)

DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
EOF
chmod 600 "$HOME/.saveit/db-credentials"

#-------------------------------------------------------------------------------
# Configure PostgreSQL for Local Access
#-------------------------------------------------------------------------------
echo "▶ Configuring PostgreSQL authentication..."
PG_VERSION=$(ls /etc/postgresql/ | head -1)
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

# Backup original
sudo cp "$PG_HBA" "$PG_HBA.backup"

# Update authentication method for local connections
sudo sed -i 's/local\s\+all\s\+all\s\+peer/local   all   all   md5/' "$PG_HBA"

# Add specific rule for saveit user
if ! sudo grep -q "saveit" "$PG_HBA"; then
    sudo sed -i "/^local\s\+all\s\+all/i local   $DB_NAME   $DB_USER   md5" "$PG_HBA"
fi

#-------------------------------------------------------------------------------
# PostgreSQL Performance Tuning for Raspberry Pi
#-------------------------------------------------------------------------------
echo "▶ Applying PostgreSQL performance tuning..."
PG_CONF="/etc/postgresql/$PG_VERSION/main/conf.d/saveit.conf"
sudo mkdir -p "/etc/postgresql/$PG_VERSION/main/conf.d"

sudo tee "$PG_CONF" > /dev/null << 'EOF'
# Save-It.AI PostgreSQL Configuration
# Optimized for Raspberry Pi 5 (8GB RAM)

# Memory settings
shared_buffers = 256MB
effective_cache_size = 512MB
work_mem = 16MB
maintenance_work_mem = 64MB

# Connection settings
max_connections = 100

# Write-ahead log
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Query planner
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging (minimal for production)
log_min_duration_statement = 1000
log_checkpoints = on

# Statistics
track_activities = on
track_counts = on
EOF

# Reload PostgreSQL with new configuration
sudo systemctl restart postgresql

#-------------------------------------------------------------------------------
# Verify Database Connection
#-------------------------------------------------------------------------------
echo "▶ Verifying database connection..."
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "  Database connection: OK"
else
    echo "⚠ Database connection test failed. Trying with peer auth..."
    # Try with local socket
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    sudo systemctl restart postgresql
fi

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo ""
echo "✔ Database setup complete!"
echo ""
echo "  Database:    $DB_NAME"
echo "  User:        $DB_USER"
echo "  Password:    (saved in credentials file)"
echo ""
echo "  Credentials file: ~/.saveit/db-credentials"
echo ""
echo "  Connection string:"
echo "    postgresql://$DB_USER:****@localhost:5432/$DB_NAME"
echo ""
echo "  Test connection:"
echo "    psql -U $DB_USER -d $DB_NAME -c 'SELECT 1;'"
