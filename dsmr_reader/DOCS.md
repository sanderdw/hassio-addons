# Home Assistant App: DSMR Reader

## Configure the app

1. Install the [TimescaleDB](https://community.home-assistant.io/t/home-assistant-app-postgresql-timescaledb/198176) app by Expaso: DSMR Reader stores its data there.
2. In the ```Configuration``` tab of TimescaleDB, add ```dsmrreader``` to ```databases```. It does not need to be in ```timescale_enabled```.
3. Start TimescaleDB.
4. Install this app and open its ```Configuration``` tab:
   - Change **Admin password** (default ```admin```) and **Secret key** (default ```dsmrreader```). The app's log warns while they have their defaults.
   - The database options match the defaults of TimescaleDB. Change them only when you changed TimescaleDB.
   - Not using Ingress (**Web access** is ```Standard``` or ```Custom```), or receiving telegrams from a remote datalogger? Open a port for DSMR Reader under ```Network``` (select ```Show disabled ports```).
5. Start the app. Open DSMR Reader with ```Open web UI```, or switch on ```Show in sidebar```. The first start sets up the database and takes longer.
6. In DSMR Reader, open ```Configuratie/Configuration```. Through Ingress, Home Assistant admins are logged in already (see [Ingress auto-login](#ingress-auto-login)). Otherwise, log in with the **Admin username** and **Admin password**. The app sets this password at every start.
7. Go to ```Datalogger -> Dataloggerconfiguratie/Datalogger configuration```. The defaults read a DSMR 4 or 5 meter on serial port ```/dev/ttyUSB0```, so with one USB P1 cable there is often nothing to change. Otherwise:
   - Another serial port: Home Assistant lists the ports under Settings -> System -> Hardware. A ```/dev/serial/by-id/...``` path stays the same when you plug in other USB devices.
   - A P1 cable on another device in your network (for example with ser2net): choose the network socket input method.

   Choose ```Opslaan/Save```. The readings then appear on the dashboard.
8. Go to ```Back-up -> Geavanceerd/Advanced``` and use one of these backup folders:
   1. Local backups: ```/backup/dsmrreader``` (notice the first forward slash). The backups then end up in Home Assistant's backup folder, next to Home Assistant's own backups.
   2. Remote backups:
      1. First configure Home Assistant [network storage](https://www.home-assistant.io/common-tasks/os/#network-storage) (usage type must be ```Share```), and remember the folder name.
      2. ```/share/yourfoldername``` (notice the first forward slash).
9. _Optional:_ Get the data in Home Assistant and its [Energy dashboard](https://www.home-assistant.io/docs/energy/) with the DSMR Reader integration: see [Home Assistant integration](#home-assistant-integration) below.

## Ingress auto-login

With **Log in Home Assistant admins automatically** on (the default) and **Web access** set to ```Ingress```, a Home Assistant admin who opens DSMR Reader in Home Assistant is logged in as the **Admin username** without a login page. Home Assistant users who are not admins, and visitors on the app's own port, still get the login page. Such a login lasts only while that admin uses DSMR Reader through Home Assistant: another Home Assistant user in the same browser, losing the admin role, or opening the app's own port logs it out. A login with the password is not affected.

- Logging out in DSMR Reader has no effect through Ingress: the next page logs you in again.
- Switch **Log in Home Assistant admins automatically** off to always log in with the **Admin password**.

## Run modes

**Run mode** decides what the app does:

- ```standalone``` (default): reads the meter, stores the readings and shows the dashboard. It reads the meter as set in step 7; the **Remote datalogger** options are not used.
- ```server_remote_datalogger```: stores the readings and shows the dashboard, but does not read a meter itself. A datalogger on another device sends the telegrams to DSMR Reader's API. The API is off until you switch it on in DSMR Reader's configuration, where you also find the API key for the datalogger. Open the port from step 4 as well.
- ```remote_datalogger```: only reads the meter and sends the telegrams to another DSMR Reader, set in **Remote datalogger: DSMR Reader address** and **Remote datalogger: API key**. The other **Remote datalogger** options set how it reads the meter. The [DSMR Datalogger](https://github.com/sanderdw/hassio-addons/tree/main/dsmr_datalogger) app is made for only this.

## Home Assistant integration

The [DSMR Reader integration](https://www.home-assistant.io/integrations/dsmr_reader) reads what DSMR Reader publishes to an MQTT broker. The app can set this up for you:

1. Install and start the [Mosquitto broker](https://my.home-assistant.io/redirect/supervisor_addon/?addon=core_mosquitto) app, and add the MQTT integration that Home Assistant then discovers.
2. In the ```Configuration``` tab of this app, switch on **Connect to Home Assistant through MQTT** and restart the app.
3. Home Assistant shows **DSMR Reader** as discovered under Settings -> Devices & services. Select ```Add```.

At every start, with **Connect to Home Assistant through MQTT** on, the app:

- Sets DSMR Reader's MQTT broker to Mosquitto, with the username and password Home Assistant gives the app. A broker you entered in DSMR Reader yourself is kept: the app only sets a broker that nobody set yet, or that it set itself.
- Switches on the data sources the integration reads: the ```Split topic``` sources for telegrams, day consumption, gas consumption, quarter-hour peak consumption, meter statistics and current month/year totals. It does not change their topics: the integration expects the default ones, and the app's log warns when they were changed.

Another MQTT broker, such as one on a NAS: enter it in DSMR Reader under ```Configuration -> MQTT Broker/connection``` and point Home Assistant's MQTT integration at the same broker. The option then still switches on the data sources.

Switching the option off does not undo what it set up; switch off MQTT in DSMR Reader's configuration if you no longer want it.

Note: Having problems or questions? Please check the community forum first https://community.home-assistant.io/t/dsmr-reader-app-for-home-assistant/279087 before creating an issue in Github.

Note: Need to perform commands on the commandline? After entering the container bash ("```docker exec -it app_0826754b_dsmr_reader bash```") you need to execute this command "```. /cli-helper.sh```" to apply the settings correctly from the app's Configuration tab.
