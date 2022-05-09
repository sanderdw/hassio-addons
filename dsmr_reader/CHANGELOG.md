# Changelog

## 1.2.0

- As always, backup first!
- Ingress support (need to be specifically enabled in configuration for now)
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