#!/usr/bin/env bashio

#---------------------------------------------------------------------------------------------------------------------------
# FUNCTIONS
#---------------------------------------------------------------------------------------------------------------------------
function _info() { printf "\\r[ \\033[00;34mINFO\\033[0m ] %s\\n" "$@"; }

#---------------------------------------------------------------------------------------------------------------------------
# HOMEASSISTANT Add-On OVERRIDES
#---------------------------------------------------------------------------------------------------------------------------

function _hass {
  ADDON_VERSON=$(jq --raw-output '.version' /app/ha_addon_version.json)
  _info "Home Assistant Add-on release: ${ADDON_VERSON}"
  CONFIG_PATH=/data/options.json
  export TWINGATE_NETWORK=$(bashio::config 'DATALOGGER_DEBUG_LOGGING')
  export TWINGATE_ACCESS_TOKEN=$(bashio::config 'DATALOGGER_TIMEOUT')
  export TWINGATE_REFRESH_TOKEN=$(bashio::config 'DATALOGGER_SLEEP')
  _info "Twingate Addon started"
}

#---------------------------------------------------------------------------------------------------------------------------
# MAIN
#---------------------------------------------------------------------------------------------------------------------------

_hass
./connectord