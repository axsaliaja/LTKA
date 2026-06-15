#!/bin/bash
# ============================================================
# EC2 bootstrap for the attendance API (Amazon Linux 2023).
# Invoked by CloudFormation user-data with these env vars exported:
#   REPO_URL, DB_HOST, DB_PASS, S3_BUCKET, AWS_REGION
#
# Installs Node.js, MySQL client, Caddy; clones the repo; configures
# and starts the Express API (systemd) behind Caddy HTTPS via nip.io.
# ============================================================
set -euxo pipefail

APP_DIR=/opt/absensi
DB_USER=admin
DB_NAME=absensi

# ---- 1. Resolve the public IP (IMDSv2) and nip.io hostname ----
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)
NIP_HOST="$(echo "$PUBLIC_IP" | tr '.' '-').nip.io"
echo "Public IP: $PUBLIC_IP  Host: $NIP_HOST"

# ---- 2. System packages ----
dnf update -y
dnf install -y git mariadb105 # mariadb105 provides the `mysql` client

# Node.js 20 (NodeSource)
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# Caddy — official static binary (most reliable on Amazon Linux 2023).
curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /usr/local/bin/caddy
chmod +x /usr/local/bin/caddy
id caddy &>/dev/null || useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy
mkdir -p /etc/caddy /var/lib/caddy
chown -R caddy:caddy /var/lib/caddy

cat > /etc/systemd/system/caddy.service <<'UNIT'
[Unit]
Description=Caddy
After=network.target

[Service]
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile
Restart=on-failure
AmbientCapabilities=CAP_NET_BIND_SERVICE
Environment=XDG_DATA_HOME=/var/lib/caddy
Environment=XDG_CONFIG_HOME=/var/lib/caddy

[Install]
WantedBy=multi-user.target
UNIT

# ---- 3. Clone the repository ----
rm -rf "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR/backend"

# ---- 4. Wait for RDS to accept connections ----
for i in $(seq 1 30); do
  if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1" >/dev/null 2>&1; then
    echo "RDS is up."
    break
  fi
  echo "Waiting for RDS ($i/30)…"
  sleep 10
done

# Ensure the database exists.
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" \
  -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4;"

# ---- 5. Backend .env ----
JWT_SECRET=$(openssl rand -hex 32)
cat > "$APP_DIR/backend/.env" <<EOF
PORT=4000
DB_HOST=$DB_HOST
DB_PORT=3306
DB_USER=$DB_USER
DB_PASS=$DB_PASS
DB_NAME=$DB_NAME
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=12h
AWS_REGION=$AWS_REGION
S3_BUCKET=$S3_BUCKET
S3_PRESIGN_EXPIRES=300
MATCH_THRESHOLD=0.5
CORS_ORIGIN=*
EOF

# ---- 6. Install, build, migrate, seed ----
npm install
npm run build
npm run migrate
npm run seed || echo "Seed step reported an issue (continuing)."

# ---- 7. systemd service for the API ----
cat > /etc/systemd/system/absensi-api.service <<EOF
[Unit]
Description=Absensi Express API
After=network.target

[Service]
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
EnvironmentFile=$APP_DIR/backend/.env
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now absensi-api

# ---- 8. Caddy reverse proxy with automatic HTTPS ----
cat > /etc/caddy/Caddyfile <<EOF
$NIP_HOST {
    reverse_proxy localhost:4000
}
EOF

systemctl enable --now caddy
systemctl restart caddy

echo "Bootstrap complete. API: https://$NIP_HOST"
