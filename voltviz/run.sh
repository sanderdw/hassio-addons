#!/bin/bash bashio
ADDON_VERSON=$(bashio::addon.version)
bashio::log.blue "Home Assistant VoltViz App - Release: ${ADDON_VERSON}"
CHECK_UPDATE=$(curl -s "https://api-check.duckdns.org/voltviz-app/${ADDON_VERSON}?webserv=$(bashio::config 'WEBSERVER')&arch=$(bashio::info.arch)") || true
if [[ "$CHECK_UPDATE" == *"response_string"* ]]; then
    OUTPUT=$(echo $CHECK_UPDATE | jq --raw-output .response_string)
    bashio::log.blue "$OUTPUT"
else
    bashio::log.red "Home Assistant VoltViz App - Update check failed"
fi


CONFIG_PATH=/data/options.json

# Create addon.d directory for optional nginx includes
mkdir -p /etc/nginx/addon.d

# Inject addon.d include and sendspin rewrite into default.conf (port 80) for non-ingress access
if [ -f /etc/nginx/conf.d/default.conf ]; then
    if ! grep -q 'addon.d' /etc/nginx/conf.d/default.conf; then
        sed -i '/^}/i\    include /etc/nginx/addon.d/*.conf;' /etc/nginx/conf.d/default.conf
        echo "VoltViz: Added sendspin proxy include to default.conf (port 80)"
    fi
    if ! grep -q 'sendspin' /etc/nginx/conf.d/default.conf; then
        sed -i '/try_files.*index\.html/i\        if ($args !~* "sendspin") {\n            return 302 "?sendspin=./sendspin-proxy/";\n        }' /etc/nginx/conf.d/default.conf
        echo "VoltViz: Added sendspin redirect to default.conf (port 80)"
    fi
fi

# Generate Sendspin proxy config if SENDSPIN_URL is configured
if [ -f "$CONFIG_PATH" ]; then
    SENDSPIN_URL=$(jq --raw-output '.SENDSPIN_URL // empty' "$CONFIG_PATH")

    if [ -n "$SENDSPIN_URL" ]; then
        # Strip trailing slash for consistent proxy_pass behavior
        SENDSPIN_URL=$(echo "$SENDSPIN_URL" | sed 's|/$||')

        echo "VoltViz: Sendspin proxy enabled -> ${SENDSPIN_URL}"

        # Verify SENDSPIN_URL is reachable
        if ! curl -s --max-time 5 -o /dev/null -w '' "$SENDSPIN_URL" 2>/dev/null; then
            bashio::log.red "Sendspin URL is not reachable: ${SENDSPIN_URL} - continuing anyway"
        fi

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
