# Home Assistant Add-on: DSMR Reader (Alpha)

The full version of DSMR (https://dsmr-reader.readthedocs.io) using the great work by xirixiz (https://github.com/xirixiz/dsmr-reader-docker).

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield]

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg

#### Configure the repository

1. Install PostgresDB (TimescaleDB) by Expaso: https://community.home-assistant.io/t/home-assistant-add-on-postgresql-timescaledb/198176
2. Add the "dsmrreader" db as an exta database entry in the Configuration tab.
3. Start TimescaleDB addon to initialize.
4. Install this addon
5. Configure settings in the Configuration tab
6. Start DSMR Reader addon
7. Go to http://yourhomeassistant:7777/admin (wait untill add-on is initialized) - Note: Ingress not working yet
8. Login with admin/admin
9. Go to Datalogger -> Dataloggerconfiguratie -> Seriële poort and specify the correct USB port
10. Opslaan/Save and restart add-on
11. http://yourhomeassistant:7777
11. [Optional] Install the Home Assistant integration (https://www.home-assistant.io/integrations/dsmr_reader)