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
  CHECK_UPDATE=$(curl -s "https://api-check.duckdns.org/metabase-addon/${ADDON_VERSON}?arch=$(bashio::info.arch)") || true
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
  _info "Metabase started"
}

#---------------------------------------------------------------------------------------------------------------------------
# MAIN
#---------------------------------------------------------------------------------------------------------------------------

_hass
exec /app/run_metabase.sh