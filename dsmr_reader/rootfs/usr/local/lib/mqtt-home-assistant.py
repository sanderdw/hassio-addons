# Sets up DSMR Reader's MQTT for Home Assistant's DSMR Reader integration. Runs in
# `manage.py shell` from init-mqtt-home-assistant/run, which passes the broker of Home
# Assistant's MQTT service in MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD and MQTT_SSL
# (MQTT_HOST is empty without that service).
#
# - The broker is set only when nobody set it yet, or when this script set it last time
#   (checked with a fingerprint in /data). A broker entered by hand is left alone.
# - The split-topic data sources the integration reads are switched on. Their topics are not
#   changed: the integration expects DSMR Reader's default topics.
import hashlib
import json
import os

from dsmr_mqtt.models.settings.broker import MQTTBrokerSettings
from dsmr_mqtt.models.settings.consumption import (
    SplitTopicGasConsumptionMQTTSettings,
    SplitTopicQuarterHourPeakElectricityConsumptionMQTTSettings,
)
from dsmr_mqtt.models.settings.day_totals import SplitTopicDayTotalsMQTTSettings
from dsmr_mqtt.models.settings.meter_statistics import SplitTopicMeterStatisticsMQTTSettings
from dsmr_mqtt.models.settings.period_totals import SplitTopicCurrentPeriodTotalsMQTTSettings
from dsmr_mqtt.models.settings.telegram import SplitTopicTelegramMQTTSettings

NAME = "init-mqtt-home-assistant"
STATE_FILE = "/data/mqtt-home-assistant.json"
BROKER_FIELDS = ("hostname", "port", "username", "password", "secure")
DATA_SOURCES = (
    SplitTopicTelegramMQTTSettings,
    SplitTopicDayTotalsMQTTSettings,
    SplitTopicGasConsumptionMQTTSettings,
    SplitTopicQuarterHourPeakElectricityConsumptionMQTTSettings,
    SplitTopicMeterStatisticsMQTTSettings,
    SplitTopicCurrentPeriodTotalsMQTTSettings,
)


def log(level, message):
    print(f"[ {level} ] {NAME} | {message}", flush=True)


def same(value, other):
    """An empty username or password is the same as none."""
    return (value or None) == (other or None)


def fingerprint(broker):
    values = [getattr(broker, field) for field in BROKER_FIELDS]
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


def read_state():
    try:
        with open(STATE_FILE) as file:
            return json.load(file)
    except (OSError, ValueError):
        return {}


def write_state(broker):
    with open(STATE_FILE, "w") as file:
        json.dump({"broker": fingerprint(broker)}, file)


def is_untouched(broker):
    defaults = {field: MQTTBrokerSettings._meta.get_field(field).default for field in BROKER_FIELDS}
    return not broker.enabled and all(same(getattr(broker, field), value) for field, value in defaults.items())


def set_up_broker():
    broker = MQTTBrokerSettings.get_solo()
    host = os.environ.get("MQTT_HOST")
    if not host:
        if broker.enabled:
            log("INFO", f"Using the MQTT broker set in DSMR Reader ({broker.hostname}:{broker.port})")
        else:
            log(
                "WARN",
                "Home Assistant has no MQTT service (the Mosquitto broker app provides one), so no "
                "broker is set. Enter your broker in DSMR Reader: Configuration, MQTT Broker/connection.",
            )
        return

    wanted = {
        "hostname": host,
        "port": int(os.environ["MQTT_PORT"]),
        "username": os.environ.get("MQTT_USERNAME") or None,
        "password": os.environ.get("MQTT_PASSWORD") or None,
        "secure": MQTTBrokerSettings.SECURE_CERT_NONE
        if os.environ.get("MQTT_SSL") == "true"
        else MQTTBrokerSettings.INSECURE,
    }
    if broker.enabled and all(same(getattr(broker, field), value) for field, value in wanted.items()):
        write_state(broker)
        log("INFO", f"MQTT broker: {host}:{wanted['port']}, from Home Assistant")
        return

    set_by_us = read_state().get("broker") == fingerprint(broker)
    if not (is_untouched(broker) or set_by_us):
        log(
            "INFO",
            f"Keeping the MQTT broker that was entered in DSMR Reader ({broker.hostname}:{broker.port})",
        )
        return

    for field, value in wanted.items():
        setattr(broker, field, value)
    broker.enabled = True
    broker.save()
    write_state(broker)
    log("INFO", f"MQTT broker set to {host}:{wanted['port']}, from Home Assistant")


def enable_data_sources():
    for model in DATA_SOURCES:
        settings = model.get_solo()
        name = str(model._meta.verbose_name)
        if not settings.enabled:
            settings.enabled = True
            settings.save()
            log("INFO", f"Switched on {name}")
        default = model._meta.get_field("formatting").default
        if settings.formatting.strip() != default.strip():
            log("WARN", f"{name} has changed topics; Home Assistant reads the default topics")


set_up_broker()
enable_data_sources()
