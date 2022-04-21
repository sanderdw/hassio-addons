# Home Assistant Add-ons: DSMR Reader/Datalogger & Metabase
[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fsanderdw%2Fhassio-addons)
[![Community Forum][forum-shield]][forum]

[![GitHub Build Status](https://github.com/sanderdw/hassio-addons/workflows/DSMR%20Reader/badge.svg?logo=github)](https://github.com/sanderdw/hassio-addons/actions)
[![GitHub Build Status](https://github.com/sanderdw/hassio-addons/workflows/DSMR%20Datalogger/badge.svg?logo=github)](https://github.com/sanderdw/hassio-addons/actions)
[![GitHub Build Status](https://github.com/sanderdw/hassio-addons/workflows/Metabase/badge.svg?logo=github)](https://github.com/sanderdw/hassio-addons/actions)
## About DSMR Reader/Datalogger

Provide a tool to easily extract, store and visualize data transferred by the DSMR protocol of your smart meter.
Allow you to export your data to other systems or third parties. Currently supports MQTT for pushing data and an REST API for pulling data.
See the DSMR Reader webpage (https://dsmr-reader.readthedocs.io) for more background information.

![DSMR Reader](images/dsmr_reader.png)

## About Metabase
Meet the easy, open source way for everyone to ask questions and learn from data.
See the Metabase webpage (https://www.metabase.com) for more background information.

![Metabase](images/metabase.png)

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg?style=flat-square
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg?style=flat-square
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg?style=flat-square
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg?style=flat-square
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg?style=flat-square
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=for-the-badge
[forum]: https://community.home-assistant.io/search?q=%40sanderdw%20%23home-assistant-os
## Configure the repository

1. Go to Supervisor -> Add-on store
2. Specify https://github.com/sanderdw/hassio-addons as the new repository URL
3. Install one of the addons which should appear after a refresh and follow the instructions.
