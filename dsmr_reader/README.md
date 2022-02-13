# Home Assistant Add-on: DSMR Reader
[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fsanderdw%2Fhassio-addons)

`DSMR Reader Add-on v1.0.0 released, please check the changelog before upgrading.`

Provide a tool to easily extract, store and visualize data transferred by the DSMR protocol of your smart meter.

Credits to Dennis Siemensma for creating the DSMR Reader software (https://dsmr-reader.readthedocs.io) and Bram van Dartel for creating the underlying container image (https://github.com/xirixiz/dsmr-reader-docker).

![dsmr-shield] ![addon-shield] ![aarch64-shield] ![amd64-shield] ![armv7-shield] ![armhf-shield] [![Community Forum][forum-shield]][forum]

![DSMR Reader](https://github.com/sanderdw/hassio-addons/raw/master/images/dsmr_reader.png)

[dsmr-shield]: https://img.shields.io/badge/DSMR%20Reader%20Version-%205.0-purple.svg?style=flat-square
[addon-shield]: https://img.shields.io/badge/Addon%20Version-%201.0.0-purple.svg?style=flat-square

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg?style=flat-square
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg?style=flat-square
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg?style=flat-square
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg?style=flat-square

[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=flat-square
[forum]: https://community.home-assistant.io/t/dsmr-reader-add-on-for-home-assistant/279087
## Configure the repository

See config instructions here: https://github.com/sanderdw/hassio-addons


## Configure the add-on

1. Install HA Addon [PostgresDB (TimescaleDB) by Expaso.](https://community.home-assistant.io/t/home-assistant-add-on-postgresql-timescaledb/198176)
2. Add the ```dsmrreader``` db as an exta database entry in the Configuration tab (of the timescaleDB addon). No need to set it under timescale_enabled as well.
3. Start TimescaleDB addon to initialize.
4. Install this addon.
5. Configure settings in the ```Configuration``` tab if defaults are changed by you.
6. Start DSMR Reader addon.
7. Go to http://yourhomeassistant:7777/admin (wait untill add-on is initialized) - Note: Ingress not working yet.
8. Login with admin/admin.
9. Go to ```Datalogger -> Dataloggerconfiguratie``` and specify the correct serial USB port or configure a remote network socket input method (using ser2net).
10. Go to ```Back-up -> Geavanceerd/Advanced``` and use ```/backup/dsmrreader``` as the backup folder (notice the first forward slash). This wil make sure backups are created in the HA "backup" folder just like the HA backup functionality.
11. Choose ```Opslaan/Save``` and you should see telegrams coming in (http://yourhomeassistant:7777).
12. _Optional:_ Install the [Home Assistant integration](https://www.home-assistant.io/integrations/dsmr_reader) or use [custom SQL](https://www.home-assistant.io/integrations/sql/) to get the data in HA and use it in the new [Energy dashboard.](https://community.home-assistant.io/t/dsmr-reader-add-on-for-home-assistant/279087/131?u=sanderdw)

Note: Having problems or questions? Please check the community forum first https://community.home-assistant.io/t/dsmr-reader-add-on-for-home-assistant/279087 before creating an issue in Github.

Note: Need to perform commands on the commandline? After entering the container bash ("```docker exec -it addon_0826754b_dsmr_reader bash```") you need to execute this command "```. /etc/cont-init.d/01-set-hassio-vars```" to apply the settings correctly from the addon Configuration tab.

Note: Using a PostgresDB with DSMR Reader on a Raspberry PI with an SDCARD can decrease it's lifespan. Google on "wear sdcard raspberry pi" for more information. 
Use of an external USB SSD/harddisk is recommended (https://www.home-assistant.io/common-tasks/os/#using-external-data-disk), or you could use a seperate PostgresDB server on a different machine.

