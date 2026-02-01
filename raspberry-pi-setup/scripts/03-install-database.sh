#!/bin/bash
#===============================================================================
# Step 3: Install and Configure PostgreSQL with TimescaleDB
#===============================================================================

set -e

# Generate a random password
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
DB_USER="saveit"
DB_NAME="saveit_db"

#-------------------------------------------------------------------------------
# PostgreSQL
#-------------------------------------------------------------------------------
echo "▶ Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

echo "▶ Starting PostgreSQL..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

#-------------------------------------------------------------------------------
# TimescaleDB
#-------------------------------------------------------------------------------
echo "▶ Installing TimescaleDB..."
# Add TimescaleDB repository
sudo apt install -y gnupg postgresql-common apt-transport-https lsb-release

# Add TimescaleDB GPG key
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/timescaledb.gpg 2>/dev/null || true

# Add TimescaleDB repository
echo "deb https://packagecloud.io/timescale/timescaledb/debian/ $(lsb_release -c -s) main" | sudo tee /etc/apt/sources.list.d/timescaledb.list

# Update and install
sudo apt update
sudo apt install -y timescaledb-2-postgresql-15 || sudo apt install -y timescaledb-2-postgresql-14 || echo "TimescaleDB installation skipped"

# Tune TimescaleDB
echo "▶ Configuring TimescaleDB..."
sudo timescaledb-tune --quiet --yes 2>/dev/null || true

# Restart PostgreSQL
sudo systemctl restart postgresql

#-------------------------------------------------------------------------------
# Create Database and User
#-------------------------------------------------------------------------------
echo "▶ Creating database and user..."
sudo -u postgres psql << EOF
-- Drop if exists (for clean reinstall)
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create user and database
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Connect to database and enable extensions
\c $DB_NAME
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

#-------------------------------------------------------------------------------
# Save credentials
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
# Configure PostgreSQL for local connections
#-------------------------------------------------------------------------------
echo "▶ Configuring PostgreSQL authentication..."
PG_HBA=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW hba_file;")
sudo sed -i 's/peer/md5/g' "$PG_HBA" 2>/dev/null || true
sudo systemctl reload postgresql

echo "✔ Database setup complete!"
echo ""
echo "Database credentials saved to: ~/.saveit/db-credentials"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: (saved in credentials file)"
echo ""
echo "Connection string:"
echo "  postgresql://$DB_USER:****@localhost:5432/$DB_NAME"
