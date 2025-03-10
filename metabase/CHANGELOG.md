# Changelog

## 1.1.0

- Update to Metabase 0.53.5.5
- Official Arm support

## 1.0.1

- Fix version check
- Beta Arm support, the HEAD of development on the Metabase repository, use at your own risk. Will be replaced with the official Metabase provided ARM Release later.
- NOTE: Standard database [type](https://www.metabase.com/docs/latest/installation-and-operation/configuring-application-database) is changed to h2 to remove the dependency on an external database/addon.

  Using Metabase with an H2 application database is not recommended for production deployments. For production deployments, we highly recommend using Postgres instead. If you decide to continue to use H2, please be sure to back up the database file regularly (stored in the backup folder of HA).

## 1.0.0

- Happy 2025!
0.52.4
- Added Metabase [environment variables](https://www.metabase.com/docs/latest/configuring-metabase/environment-variables) in config:
  - Database [type](https://www.metabase.com/docs/latest/installation-and-operation/configuring-application-database)
  - [Timezone](https://www.metabase.com/docs/latest/installation-and-operation/running-metabase-on-docker#setting-the-java-timezone)
  - Allocating [custom memory](https://www.metabase.com/docs/latest/troubleshooting-guide/running#allocating-more-memory-to-the-jvm) sizing to the addon
- NOTE: Currently only x86 supported, Metabase is currently [testing](https://github.com/metabase/metabase/issues/13119#issuecomment-2539434988) an official ARM Release and will be added again later.

## 0.5.0

- Update to Metabase 0.43.0

## 0.4.0

- Update to Metabase 0.42.4
- Faster install time

## 0.3.0

- Update to Metabase 0.40.0

## 0.2.1

- Update to Metabase 0.39.1

## 0.2.0

- Update to Metabase 0.39.0.1
- NOTE: Check "Before you upgrade" on https://github.com/metabase/metabase/releases/tag/v0.39.0.1

## 0.1.2

- Update to Metabase 0.38.3

## 0.1.1

- Addon image labels fix

## 0.1.0

- Update to Metabase 0.38.2 (patch update)

## 0.0.2

- Update to Metabase 0.38.1 (patch release)
- Standard external port set to 7778 (3000 used for zwaveJS)

## 0.0.1

- Initial Alpha version
