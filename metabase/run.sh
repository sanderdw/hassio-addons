#!/usr/bin/env bashio

bashio::log.info "Welcome to the Home Assistant Add-on: Metabase by Sander de Wildt"
bashio::log.info "Explore your Home Assistant data at ease"

export MB_DB_DBNAME=$(bashio::config 'MB_DB_DBNAME')
export MB_DB_USER=$(bashio::config 'MB_DB_USER')
export MB_DB_PASS=$(bashio::config 'MB_DB_PASS')
export MB_DB_HOST=$(bashio::config 'MB_DB_HOST')
export MB_DB_PORT=$(bashio::config 'MB_DB_PORT')

java -jar  ./home/metabase.jar