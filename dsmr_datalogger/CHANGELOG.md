# Changelog

## 1.0.3

- Support for DSMRREADER_DATALOGGER_SLEEP

## 1.0.2

- Changed auto_uart to uart config.json (https://github.com/home-assistant/supervisor/issues/2533). Make sure to run a recent version of Home Assistant before you upgrade
- NOTE: Just released the DSMR Reader Add-on! See https://community.home-assistant.io/t/dsmr-reader-add-on-for-home-assistant/279087

## 1.0.1

- Ready for DSMR meter versions 2/3 (Added DSMRREADER_DATALOGGER_SERIAL_BYTESIZE and DSMRREADER_DATALOGGER_SERIAL_PARITY configuration parameters)

## 1.0.0

- Switch to the most recent dsmr_datalogger_api_client.py v4
- NOTE: As the configuration options are changed, please reset configuration to it's default first after installing/updating ("RESET TO DEFAULTS" on the Configuration tab).
- NOTE: You don't have to specifiy the full API url anymore. http(s)://<YOUR_DSMR_HOST>:<PORT> is enough.

## 0.1.0

- Switch to the most recent dsmr_datalogger_api_client.py and updated pip packages

## 0.0.4

- Switch to Home Assistant Python Base images

## 0.0.3

- Initial Beta version