#!/bin/sh
CONFIG_PATH=/data/options.json

# Create addon.d directory for optional nginx includes
mkdir -p /etc/nginx/addon.d

# Generate Sendspin proxy config if SENDSPIN_URL is configured
if [ -f "$CONFIG_PATH" ]; then
    SENDSPIN_URL=$(jq --raw-output '.SENDSPIN_URL // empty' "$CONFIG_PATH")

    if [ -n "$SENDSPIN_URL" ]; then
        # Strip trailing slash for consistent proxy_pass behavior
        SENDSPIN_URL=$(echo "$SENDSPIN_URL" | sed 's|/$||')

        echo "VoltViz: Sendspin proxy enabled -> ${SENDSPIN_URL}"

        cat > /etc/nginx/addon.d/sendspin-proxy.conf << PROXYEOF
location /sendspin-proxy/ {
    proxy_pass ${SENDSPIN_URL}/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
PROXYEOF
    fi
fi

exec nginx -g "daemon off;"
