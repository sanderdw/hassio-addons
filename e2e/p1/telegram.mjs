// DSMR 5 telegrams for an emulated smart meter.
//
// Every value is a pure function of the telegram's timestamp, so a test can take a reading that
// an add-on stored, call readingAt() with its timestamp and compare the numbers exactly.

/** The meter starts counting here. Midnight UTC, so the 60 second power cycle is aligned. */
const METER_EPOCH = Date.UTC(2026, 0, 1) / 1000;

const BASE_POWER_W = 200;
const POWER_STEP_W = 10;
const CYCLE_SECONDS = 60;
const CYCLE_ENERGY_WS =
  BASE_POWER_W * CYCLE_SECONDS + (POWER_STEP_W * CYCLE_SECONDS * (CYCLE_SECONDS - 1)) / 2;

const TARIFF_1_START_WH = 1_000_000;
const TARIFF_2_START_WH = 2_000_000;
const GAS_START_LITERS = 500_000;
const GAS_INTERVAL_SECONDS = 300;
const GAS_LITERS_PER_INTERVAL = 2;
const VOLTAGE = 230;

export const METER = {
  header: '/E2E5\\2P1-EMULATOR',
  electricityId: 'E0000000000000001',
  gasId: 'G0000000000000001',
};

/**
 * The meter's state at a moment in time.
 * Power climbs from 200 W to 790 W in 10 W steps every minute, all of it on phase L1 and
 * tariff 2. Gas rises 2 litres every 5 minutes.
 * @param {number} unixSeconds
 */
export function readingAt(unixSeconds) {
  const elapsed = unixSeconds - METER_EPOCH;
  if (!Number.isInteger(elapsed) || elapsed < 0) {
    throw new RangeError(`readingAt needs whole seconds after ${METER_EPOCH}, got ${unixSeconds}`);
  }
  const second = elapsed % CYCLE_SECONDS;
  const powerW = BASE_POWER_W + POWER_STEP_W * second;
  const energyWs =
    Math.floor(elapsed / CYCLE_SECONDS) * CYCLE_ENERGY_WS +
    BASE_POWER_W * second +
    (POWER_STEP_W * second * (second - 1)) / 2;
  const gasIntervals = Math.floor(elapsed / GAS_INTERVAL_SECONDS);

  return {
    unixSeconds,
    powerDeliveredKw: powerW / 1000,
    powerReturnedKw: 0,
    deliveredTariff1Kwh: TARIFF_1_START_WH / 1000,
    deliveredTariff2Kwh: (TARIFF_2_START_WH + Math.floor(energyWs / 3600)) / 1000,
    returnedTariff1Kwh: 0,
    returnedTariff2Kwh: 0,
    voltage: VOLTAGE,
    currentL1: Math.round(powerW / VOLTAGE),
    gasUnixSeconds: unixSeconds - (elapsed % GAS_INTERVAL_SECONDS),
    gasM3: (GAS_START_LITERS + GAS_LITERS_PER_INTERVAL * gasIntervals) / 1000,
  };
}

/** CRC-16/ARC, the checksum a DSMR telegram ends with. */
export function crc16(text) {
  let crc = 0;
  for (const byte of Buffer.from(text, 'latin1')) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc;
}

const amsterdam = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'shortOffset',
});

/** DSMR timestamp: Dutch local time, then S for summer time or W for winter time. */
export function dsmrTimestamp(unixSeconds) {
  const parts = Object.fromEntries(
    amsterdam.formatToParts(new Date(unixSeconds * 1000)).map((part) => [part.type, part.value]),
  );
  const season = parts.timeZoneName === 'GMT+2' ? 'S' : 'W';
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}${season}`;
}

const fixed = (value, integerDigits, decimals) =>
  value.toFixed(decimals).padStart(integerDigits + (decimals ? decimals + 1 : 0), '0');
const kwh = (value) => `${fixed(value, 6, 3)}*kWh`;
const kw = (value) => `${fixed(value, 2, 3)}*kW`;
const hexId = (id) => Buffer.from(id, 'ascii').toString('hex').toUpperCase();

/** The complete telegram for a moment in time, including its checksum and CRLF line ends. */
export function buildTelegram(unixSeconds) {
  const reading = readingAt(unixSeconds);
  const lines = [
    METER.header,
    '',
    '1-3:0.2.8(50)',
    `0-0:1.0.0(${dsmrTimestamp(unixSeconds)})`,
    `0-0:96.1.1(${hexId(METER.electricityId)})`,
    `1-0:1.8.1(${kwh(reading.deliveredTariff1Kwh)})`,
    `1-0:1.8.2(${kwh(reading.deliveredTariff2Kwh)})`,
    `1-0:2.8.1(${kwh(reading.returnedTariff1Kwh)})`,
    `1-0:2.8.2(${kwh(reading.returnedTariff2Kwh)})`,
    '0-0:96.14.0(0002)',
    `1-0:1.7.0(${kw(reading.powerDeliveredKw)})`,
    `1-0:2.7.0(${kw(reading.powerReturnedKw)})`,
    '0-0:96.7.21(00001)',
    '0-0:96.7.9(00000)',
    '1-0:99.97.0(0)(0-0:96.7.19)',
    '1-0:32.32.0(00000)',
    '1-0:52.32.0(00000)',
    '1-0:72.32.0(00000)',
    '1-0:32.36.0(00000)',
    '1-0:52.36.0(00000)',
    '1-0:72.36.0(00000)',
    '0-0:96.13.0()',
    `1-0:32.7.0(${fixed(reading.voltage, 3, 1)}*V)`,
    `1-0:52.7.0(${fixed(reading.voltage, 3, 1)}*V)`,
    `1-0:72.7.0(${fixed(reading.voltage, 3, 1)}*V)`,
    `1-0:31.7.0(${fixed(reading.currentL1, 3, 0)}*A)`,
    '1-0:51.7.0(000*A)',
    '1-0:71.7.0(000*A)',
    `1-0:21.7.0(${kw(reading.powerDeliveredKw)})`,
    `1-0:41.7.0(${kw(0)})`,
    `1-0:61.7.0(${kw(0)})`,
    `1-0:22.7.0(${kw(0)})`,
    `1-0:42.7.0(${kw(0)})`,
    `1-0:62.7.0(${kw(0)})`,
    '0-1:24.1.0(003)',
    `0-1:96.1.0(${hexId(METER.gasId)})`,
    `0-1:24.2.1(${dsmrTimestamp(reading.gasUnixSeconds)})(${fixed(reading.gasM3, 5, 3)}*m3)`,
  ];
  const body = `${lines.join('\r\n')}\r\n!`;
  return `${body}${crc16(body).toString(16).toUpperCase().padStart(4, '0')}\r\n`;
}

/** Finds complete telegrams in a byte stream and reports whether each checksum is correct. */
export function parseTelegrams(stream) {
  return [...stream.matchAll(/\/[^/]+?!([0-9A-F]{4})\r\n/g)].map((match) => {
    const text = match[0];
    const body = text.slice(0, text.lastIndexOf('!') + 1);
    return { text, crcValid: crc16(body) === Number.parseInt(match[1], 16) };
  });
}
