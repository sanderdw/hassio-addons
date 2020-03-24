#!/usr/bin/env bashio

export DSMR_API_KEY=$(bashio::config 'DSMR_API_KEY')
export DSMR_API_URL=$(bashio::config 'DSMR_API_URL')
export DSMR_USB_PORT=$(bashio::config 'DSMR_USB_PORT')

python3 ./dsmr_datalogger_api_client.py