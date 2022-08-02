#!/usr/bin/env bash

#---------------------------------------------------------------------------------------------------------------------------
# HOMEASSISTANT Add-On Cli Helper
#---------------------------------------------------------------------------------------------------------------------------
CONFIG_PATH=/data/options.json

DSMRREADER_ADMIN_USER=$(jq --raw-output ".DSMRREADER_ADMIN_USER" $CONFIG_PATH)
DSMRREADER_ADMIN_PASSWORD=$(jq --raw-output ".DSMRREADER_ADMIN_PASSWORD" $CONFIG_PATH)
DJANGO_DATABASE_NAME=$(jq --raw-output ".DJANGO_DATABASE_NAME" $CONFIG_PATH)
DJANGO_DATABASE_USER=$(jq --raw-output ".DJANGO_DATABASE_USER" $CONFIG_PATH)
DJANGO_DATABASE_PASSWORD=$(jq --raw-output ".DJANGO_DATABASE_PASSWORD" $CONFIG_PATH)
DJANGO_DATABASE_HOST=$(jq --raw-output ".DJANGO_DATABASE_HOST" $CONFIG_PATH)
DJANGO_DATABASE_PORT=$(jq --raw-output ".DJANGO_DATABASE_PORT" $CONFIG_PATH)


export DSMRREADER_ADMIN_USER="${DSMRREADER_ADMIN_USER}"
export DSMRREADER_ADMIN_PASSWORD="${DSMRREADER_ADMIN_PASSWORD}"
export DJANGO_DATABASE_NAME="${DJANGO_DATABASE_NAME}"
export DJANGO_DATABASE_USER="${DJANGO_DATABASE_USER}"
export DJANGO_DATABASE_PASSWORD="${DJANGO_DATABASE_PASSWORD}"
export DJANGO_DATABASE_HOST="${DJANGO_DATABASE_HOST}"
export DJANGO_DATABASE_PORT="${DJANGO_DATABASE_PORT}"
