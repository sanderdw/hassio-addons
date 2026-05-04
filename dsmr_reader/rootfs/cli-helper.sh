#!/usr/bin/env bash

#---------------------------------------------------------------------------------------------------------------------------
# HOMEASSISTANT app Cli Helper
#---------------------------------------------------------------------------------------------------------------------------

readonly CONFIG_PATH=/data/options.json

# Reads a key from the add-on config and exports it as an environment variable.
_export_config() {
  local key="$1"
  export "${key}=$(jq --raw-output ".${key}" "${CONFIG_PATH}")"
}

_export_config 'DSMRREADER_ADMIN_USER'
_export_config 'DSMRREADER_ADMIN_PASSWORD'
_export_config 'DJANGO_DATABASE_NAME'
_export_config 'DJANGO_DATABASE_USER'
_export_config 'DJANGO_DATABASE_PASSWORD'
_export_config 'DJANGO_DATABASE_HOST'
_export_config 'DJANGO_DATABASE_PORT'
