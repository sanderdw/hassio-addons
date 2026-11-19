#!/usr/bin/env bashio
#---------------------------------------------------------------------------------------------------------------------------
# FUNCTIONS
#---------------------------------------------------------------------------------------------------------------------------
function _info() { printf "\\r[ \\033[00;34mINFO\\033[0m ] %s\\n" "$@"; }

#---------------------------------------------------------------------------------------------------------------------------
# HOMEASSISTANT Add-On OVERRIDES
#---------------------------------------------------------------------------------------------------------------------------

function _hass {
  ADDON_VERSON=$(bashio::app.version)
  bashio::log.blue "Home Assistant Metabase Add-on - Release: ${ADDON_VERSON}"
  # First, so ingress shows its "Metabase is starting" page right away.
  _ingress
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
  _move_h2_database
  export MB_DB_DBNAME=$(bashio::config 'MB_DB_DBNAME')
  export MB_DB_USER=$(bashio::config 'MB_DB_USER')
  export MB_DB_PASS=$(bashio::config 'MB_DB_PASS')
  export MB_DB_HOST=$(bashio::config 'MB_DB_HOST')
  export MB_DB_PORT=$(bashio::config 'MB_DB_PORT')
  export JAVA_TIMEZONE=$(bashio::config 'JAVA_TIMEZONE')
  export JAVA_OPTS=$(bashio::config 'JAVA_OPTS')
  export MB_CHECK_FOR_UPDATES="false"
  # Off turns Metabot and Metabase's other AI features off. On leaves them to Metabase's own
  # admin settings, so the variable is only set to switch them off.
  if bashio::config.false 'MB_AI_FEATURES_ENABLED'; then
    export MB_AI_FEATURES_ENABLED="false"
  fi
  _info "Metabase started"
}

# Serves Metabase below Home Assistant's ingress path on port 8099 (nginx, rootfs/etc/nginx).
# Port 3000 stays Metabase itself. MB_SITE_URL must stay unset: its path would apply to port 3000 too.
function _ingress {
  local ingress_entry
  ingress_entry=$(bashio::app.ingress_entry)
  mkdir -p /etc/nginx/conf.d
  sed "s#%%ingress_entry%%#${ingress_entry}#g" /etc/nginx/ingress.conf.template > /etc/nginx/conf.d/ingress.conf
  sed "s#%%ingress_entry%%#${ingress_entry}#g" /etc/nginx/ingress.js.template > /etc/nginx/conf.d/ingress.js
  if nginx; then
    _info "Ingress ready at ${ingress_entry}"
  else
    bashio::log.red "Home Assistant Metabase Add-on - Ingress could not start, use port 3000 instead"
  fi
}

# Up to 1.6.1 the default H2 database was /backup/metabase.db. Home Assistant leaves /backup out of
# every backup and keeps it when the app is uninstalled with its data. The app's config folder
# (/config here, /addon_configs/<slug> in Home Assistant) is in the app's backups and is removed with
# its data. Move the database there once and point the option at it. A database file set by the
# user stays where it is.
H2_OLD_DEFAULT=/backup/metabase.db
H2_NEW_DEFAULT=/config/metabase.db

# Metabase keeps an H2 database in a folder (metabase.db/metabase.db.mv.db); older versions
# kept it in files next to that path (metabase.db.mv.db).
function _h2_files {
  local path=$1
  local files=()
  if [[ -e "${path}" ]]; then
    files+=("${path}")
  fi
  shopt -s nullglob
  files+=("${path}".*)
  shopt -u nullglob
  if [[ ${#files[@]} -gt 0 ]]; then
    printf '%s\n' "${files[@]}"
  fi
}

function _move_h2_database {
  if [[ "${MB_DB_FILE}" != "${H2_OLD_DEFAULT}" ]]; then
    return 0
  fi
  local old_files=() moving=/config/.metabase.db.moving
  mapfile -t old_files < <(_h2_files "${H2_OLD_DEFAULT}")
  if [[ ${#old_files[@]} -gt 0 ]]; then
    if [[ -n "$(_h2_files "${H2_NEW_DEFAULT}")" ]]; then
      bashio::log.yellow "Home Assistant Metabase Add-on - Found an H2 database in both /backup and /config. Metabase uses the one in /config; ${H2_OLD_DEFAULT} is left as it is."
    else
      _info "Moving the H2 database from ${H2_OLD_DEFAULT} to ${H2_NEW_DEFAULT}"
      # Copy first and remove /backup's copy only when everything arrived: /backup and /config
      # are different mounts, so a move is a copy anyway.
      rm -rf "${moving}"
      if mkdir "${moving}" && cp -a "${old_files[@]}" "${moving}/" && mv "${moving}"/* /config/ && rmdir "${moving}"; then
        rm -rf "${old_files[@]}"
      else
        rm -rf "${moving}"
        bashio::log.red "Home Assistant Metabase Add-on - Could not move the H2 database; Metabase keeps using ${H2_OLD_DEFAULT}"
        return 0
      fi
    fi
  fi
  export MB_DB_FILE="${H2_NEW_DEFAULT}"
  # Point the option at the new place too, so the Configuration tab shows where the database is.
  if bashio::app.option 'MB_DB_FILE' "${H2_NEW_DEFAULT}"; then
    _info "Database file option set to ${H2_NEW_DEFAULT}"
  else
    bashio::log.yellow "Home Assistant Metabase Add-on - Could not change the database file option; Metabase uses ${H2_NEW_DEFAULT} anyway"
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
