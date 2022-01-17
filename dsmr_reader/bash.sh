#!/usr/bin/env bash

#---------------------------------------------------------------------------------------------------------------------------
# HOMEASSISTANT Add-On OVERRIDES
#---------------------------------------------------------------------------------------------------------------------------
CONFIG_PATH=/data/options.json

DSMRREADER_ADMIN_USER=$(jq --raw-output ".DSMRREADER_ADMIN_USER" $CONFIG_PATH)
DSMRREADER_ADMIN_PASSWORD=$(jq --raw-output ".DSMRREADER_ADMIN_PASSWORD" $CONFIG_PATH)
DJANGO_DATABASE_NAME=$(jq --raw-output ".DJANGO_DATABASE_NAME" $CONFIG_PATH)
DJANGO_DATABASE_USER=$(jq --raw-output ".DJANGO_DATABASE_USER" $CONFIG_PATH)
DJANGO_DATABASE_PASSWORD=$(jq --raw-output ".DJANGO_DATABASE_PASSWORD" $CONFIG_PATH)
DJANGO_DATABASE_HOST=$(jq --raw-output ".DJANGO_DATABASE_HOST" $CONFIG_PATH)
DJANGO_DATABASE_PORT=$(jq --raw-output ".DJANGO_DATABASE_PORT" $CONFIG_PATH)
DATALOGGER_MODE=$(jq --raw-output ".DATALOGGER_MODE" $CONFIG_PATH)
DATALOGGER_SERIAL_PORT=$(jq --raw-output ".DATALOGGER_SERIAL_PORT" $CONFIG_PATH)
DATALOGGER_INPUT_METHOD=$(jq --raw-output ".DATALOGGER_INPUT_METHOD" $CONFIG_PATH)
DATALOGGER_SERIAL_BAUDRATE=$(jq --raw-output ".DATALOGGER_SERIAL_BAUDRATE" $CONFIG_PATH)
DATALOGGER_NETWORK_HOST=$(jq --raw-output ".DATALOGGER_NETWORK_HOST" $CONFIG_PATH)
DATALOGGER_NETWORK_PORT=$(jq --raw-output ".DATALOGGER_NETWORK_PORT" $CONFIG_PATH)
DATALOGGER_SLEEP=$(jq --raw-output ".DATALOGGER_SLEEP" $CONFIG_PATH)
DSMRREADER_LOGLEVEL=$(jq --raw-output ".DSMRREADER_LOGLEVEL" $CONFIG_PATH)

export DSMRREADER_ADMIN_USER="${DSMRREADER_ADMIN_USER}"
export DSMRREADER_ADMIN_PASSWORD="${DSMRREADER_ADMIN_PASSWORD}"
export DJANGO_DATABASE_NAME="${DJANGO_DATABASE_NAME}"
export DJANGO_DATABASE_USER="${DJANGO_DATABASE_USER}"
export DJANGO_DATABASE_PASSWORD="${DJANGO_DATABASE_PASSWORD}"
export DJANGO_DATABASE_HOST="${DJANGO_DATABASE_HOST}"
export DJANGO_DATABASE_PORT="${DJANGO_DATABASE_PORT}"
export DATALOGGER_MODE="${DATALOGGER_MODE}"
export DATALOGGER_SERIAL_PORT="${DATALOGGER_SERIAL_PORT}"
export DATALOGGER_INPUT_METHOD="${DATALOGGER_INPUT_METHOD}"
export DATALOGGER_SERIAL_BAUDRATE="${DATALOGGER_SERIAL_BAUDRATE}"
export DATALOGGER_NETWORK_HOST="${DATALOGGER_NETWORK_HOST}"
export DATALOGGER_NETWORK_PORT="${DATALOGGER_NETWORK_PORT}"
export DATALOGGER_SLEEP="${DATALOGGER_SLEEP}"
export DSMRREADER_LOGLEVEL="${DSMRREADER_LOGLEVEL}"
export ENABLE_IFRAME="true"
