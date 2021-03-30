
# Home Assistant Add-on: DSMR Reader

Used for reading the smart meter DSMR P1 port (https://dsmr-reader.readthedocs.io) using the great work by xirixiz (https://github.com/xirixiz/dsmr-reader-docker).


![dsmr-shield] ![addon-shield] ![aarch64-shield] ![amd64-shield] ![armv7-shield] ![armhf-shield] [![Community Forum][forum-shield]][forum]

![DSMR Reader](/images/dsmr_reader.png)

[dsmr-shield]: https://img.shields.io/badge/DSMR%20Reader%20Version-%204.14.0-purple.svg?style=flat-square
[addon-shield]: https://img.shields.io/badge/Addon%20Version-%200.3.1-purple.svg?style=flat-square

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg?style=flat-square
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg?style=flat-square
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg?style=flat-square
[armhf-shield]: https://img.shields.io/badge/armhf-version%204.12.0-orange.svg?style=flat-square

[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=flat-square
[forum]: https://community.home-assistant.io/t/dsmr-reader-add-on-for-home-assistant/279087
## Configure the repository

See config instructions here: https://github.com/sanderdw/hassio-addons


## Configure the add-on

1. Install PostgresDB (TimescaleDB) by Expaso: https://community.home-assistant.io/t/home-assistant-add-on-postgresql-timescaledb/198176.
2. Add the "dsmrreader" db as an exta database entry in the Configuration tab.
3. Start TimescaleDB addon to initialize.
4. Install this addon.
5. Configure settings in the "Configuration" tab if defaults are changed by you.
6. Start DSMR Reader addon.
7. Go to http://yourhomeassistant:7777/admin (wait untill add-on is initialized) - Note: Ingress not working yet.
8. Login with admin/admin.
9. Go to **Datalogger -> Dataloggerconfiguratie** and specify the correct serial USB port or configure a remote network socket input method (using ser2net).
10. Go to **Back-up -> Geavanceerd/Advanced** and use "/backup/dsmrreader" as the backup folder (notice the first forward slash). This wil make sure backups are created in the HA "backup" folder just like the HA snapshotting functionality.
11. Choose **Opslaan/Save** and you should see telegrams coming in (http://yourhomeassistant:7777).
12. _Optional:_ Install the Home Assistant integration (https://www.home-assistant.io/integrations/dsmr_reader) or use https://www.home-assistant.io/integrations/sql/ to get the data in HA.

Note: Using a PostgresDB with DSMR Reader on a Raspberry PI with an SDCARD can decrease it's lifespan. Google on "wear sdcard raspberry pi" for more information. 
Use of an external USB SSD/harddisk is recommended (https://www.raspberrypi.org/documentation/hardware/raspberrypi/bootmodes/msd.md), or you could use a seperate PostgresDB server on a different machine.

