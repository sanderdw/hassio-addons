# Changelog

## 1.10.2

- Update base image to support PostgreSQL 15

## 1.10.1

- Update to DSMR-reader v5.10.3
- NOTE: Check configuration as DSMRREADER_REMOTE_DATALOGGER_MODE" has become "DSMRREADER_OPERATION_MODE"

  - 'sender' changed to 'api_client'
  - 'receiver' changed to 'api_server'

  Reset configuration if you don't see the updated settings.
- Github Action workflow updated/fixes

## 1.9.0

- Update to DSMR-reader v5.9

## 1.8.0

- Update to DSMR-reader v5.8
- Continue when update check fails

## 1.7.0

- Update to DSMR-reader v5.6

## 1.6.1

- Update to DSMR-reader v5.5.1
- New cli-helper to fix (https://community.home-assistant.io/t/dsmr-reader-add-on-for-home-assistant/279087/286)

## 1.6.0

- Update to DSMR-reader v5.5

## 1.5.0

- Update to DSMR-reader v5.4

## 1.4.0

- Update to DSMR-reader v5.3

## 1.3.1

- Fix panel icon https://github.com/sanderdw/hassio-addons/issues/53

## 1.3.0

- As always, backup first!
- Update to DSMR-reader v5.2

## 1.2.1

- As always, backup first!
- Ingress support now standard enabled and port forward removed (reset configuration could be required)
- Additional Reverse Proxy support, see https://github.com/sanderdw/hassio-addons/issues/24
- Added Datalogger API configuration

## 1.2.0

- As always, backup first!
- Don't use the 'OPEN WEB UI' button as it's used for Ingress only, so open the url (you can find it in the addon log) manually
- Ingress support in BETA (need to be specifically enabled in configuration for now and needs a reinstall of the addon)
- Technical: bashio support and code cleanup

## 1.1.2

- As always, backup first!
- Uninstall and reinstall/reconfigure if "image does not exist" error pops up.
- Faster install time (moved to Github Actions)

## 1.1.1

- As always, backup first!
- Support for PostgreSQL 14 (such as the TimescaleDB 2.0.0 Addon)

## 1.1.0

- Update to DSMR-reader v5.1
- Use log level "ERROR" (standard)

## 1.0.0

- Backup first! Make a db backup first if you want to be able to revert.
- Updating from previous version? After the update go to the addon "Configuration" tab and next to "Options" choose "Reset to defaults" (Not the one below "Network") and apply your settings again.
- Update to DSMR-reader v5.0
- Refactor code and using new s6 image
- Big Thanks to Dennis Siemensma and Bram van Dartel for this new release

## 0.7.4

- Revert to older image (again) to fix high cpu and performance

## 0.7.3

- Fixes to underlying image applied (Thanks Xirixiz)
- Added debug mode

## 0.7.2

- Revert to older image to fix usb errors

## 0.7.1 (Beta)

- Try to fix underlying image, don't update yet!

## 0.7.0

- Update to DSMR-reader v4.19

## 0.6.0

- Update to DSMR-reader v4.18

## 0.5.1

- Update to DSMR-reader v4.16.3

## 0.5.0

- Update to DSMR-reader v4.16.2

## 0.4.2

- Update to DSMR-reader v4.15.2

## 0.4.1

- Update to DSMR-reader v4.15.1

## 0.4.0

- Update to DSMR-reader v4.15.0

## 0.3.1

- Support for DATALOGGER_SLEEP

## 0.3.0

- Update to DSMR-reader v4.14.0

## 0.2.1

- DSMR-reader v4.13.0 available for arm32v7
- Base image updates for amd64 & arm64v8

## 0.2.0

- Update to DSMR-reader v4.13.0 (amd64 & arm64v8 only)
- Simplified configuration with dropdowns
- NOTE: Check DATALOGGER_MODE & DATALOGGER_INPUT_METHOD configurations after updating

## 0.1.3

- Update base images (PostgreSQL 12.6 client working on arm32v7, arm32v6 is deprecated)

## 0.1.2

- Fixed PostgreSQL 12.6 client version (arm32 is deprecated and not updated)

## 0.1.1

- Added script to help with commandline actions

## 0.1.0

- Update to DSMR-reader v4.12.0

## 0.0.4

- Extended configuration options
- Added arm32v6

## 0.0.3

- Bugfix Webui link

## 0.0.2

- Easy Webui link
- Added backup option and instructions (see step 10)
- NOTE: Make sure to perform step 10 and configure the backup functionality, even after upgrading from 0.0.1
- Added DJANGO_DATABASE_PORT option
- Corrected mismatch version numbering from 0.1 to 0.0.2

## 0.0.1

- Initial Alpha version (DSMR-reader v4.11)
