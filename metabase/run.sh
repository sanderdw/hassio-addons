#!/bin/bash bashio
#---------------------------------------------------------------------------------------------------------------------------
# FUNCTIONS
#---------------------------------------------------------------------------------------------------------------------------
function _info() { printf "\\r[ \\033[00;34mINFO\\033[0m ] %s\\n" "$@"; }

#---------------------------------------------------------------------------------------------------------------------------
# HOMEASSISTANT Add-On OVERRIDES
#---------------------------------------------------------------------------------------------------------------------------

function _hass {
  ADDON_VERSON=$(bashio::addon.version)
  bashio::log.blue "Home Assistant Metabase Add-on - Release: ${ADDON_VERSON}"
  # The check must not hold up the start when its server does not answer.
  CHECK_UPDATE=$(curl -s --max-time 10 "https://api-check.duckdns.org/metabase-addon/${ADDON_VERSON}?arch=$(bashio::info.arch)") || true
  if [[ "$CHECK_UPDATE" == *"response_string"* ]]; then
    OUTPUT=$(echo $CHECK_UPDATE | jq --raw-output .response_string)
    bashio::log.blue "$OUTPUT"
  else
    bashio::log.red "Home Assistant Metabase Add-on - Update check failed"
  fi
  CONFIG_PATH=/data/options.json
  export MB_DB_TYPE=$(bashio::config 'MB_DB_TYPE')
  export MB_DB_FILE=$(bashio::config 'MB_DB_FILE')
  export MB_DB_DBNAME=$(bashio::config 'MB_DB_DBNAME')
  export MB_DB_USER=$(bashio::config 'MB_DB_USER')
  export MB_DB_PASS=$(bashio::config 'MB_DB_PASS')
  export MB_DB_HOST=$(bashio::config 'MB_DB_HOST')
  export MB_DB_PORT=$(bashio::config 'MB_DB_PORT')
  export JAVA_TIMEZONE=$(bashio::config 'JAVA_TIMEZONE')
  export JAVA_OPTS=$(bashio::config 'JAVA_OPTS')
  export MB_CHECK_FOR_UPDATES="false"
  _ingress
  _info "Metabase started"
}

# Serves Metabase below Home Assistant's ingress path on port 8099 (nginx, rootfs/etc/nginx).
# Port 3000 stays Metabase itself. MB_SITE_URL must stay unset: its path would apply to port 3000 too.
function _ingress {
  local ingress_entry
  ingress_entry=$(bashio::addon.ingress_entry)
  mkdir -p /etc/nginx/conf.d
  sed "s#%%ingress_entry%%#${ingress_entry}#g" /etc/nginx/ingress.conf.template > /etc/nginx/conf.d/ingress.conf
  sed "s#%%ingress_entry%%#${ingress_entry}#g" /etc/nginx/ingress.js.template > /etc/nginx/conf.d/ingress.js
  if nginx; then
    _info "Ingress ready at ${ingress_entry}"
  else
    bashio::log.red "Home Assistant Metabase Add-on - Ingress could not start, use port 3000 instead"
  fi
}

#---------------------------------------------------------------------------------------------------------------------------
# MAIN
#---------------------------------------------------------------------------------------------------------------------------

_hass

# Java ends with exit code 143 when it is told to stop, also after a clean shutdown, and Home
# Assistant shows that as an error. So run Metabase as a child, pass the stop signal on, wait
# until it has shut down and report a clean stop.
STOPPING=false
/app/run_metabase.sh &
METABASE_PID=$!
trap 'STOPPING=true; kill -TERM "${METABASE_PID}" 2>/dev/null' TERM INT

EXIT_CODE=0
wait "${METABASE_PID}" || EXIT_CODE=$?
if [[ "${STOPPING}" == true ]]; then
  # The first wait ended because of the signal; this one waits for Metabase itself.
  EXIT_CODE=0
  wait "${METABASE_PID}" || EXIT_CODE=$?
  if [[ "${EXIT_CODE}" -eq 143 ]]; then
    EXIT_CODE=0
  fi
fi
exit "${EXIT_CODE}"
