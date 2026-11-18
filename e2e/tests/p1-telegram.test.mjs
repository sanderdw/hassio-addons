// The smart meter emulator on its own. Needs no VM.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTelegram, crc16, dsmrTimestamp, parseTelegrams, readingAt } from '../p1/telegram.mjs';

const at = (iso) => Date.parse(iso) / 1000;

describe('P1 telegram', () => {
  it('computes CRC-16/ARC', () => {
    assert.equal(crc16('123456789'), 0xbb3d);
  });

  it('writes Dutch local time with the summer or winter time flag', () => {
    assert.equal(dsmrTimestamp(at('2026-01-15T11:00:05Z')), '260115120005W');
    assert.equal(dsmrTimestamp(at('2026-07-15T10:00:05Z')), '260715120005S');
    // The night the clock goes back: 02:30 happens twice.
    assert.equal(dsmrTimestamp(at('2026-10-25T00:30:00Z')), '261025023000S');
    assert.equal(dsmrTimestamp(at('2026-10-25T01:30:00Z')), '261025023000W');
  });

  it('builds a telegram that passes its own checksum', () => {
    const telegram = buildTelegram(at('2026-11-18T12:00:25Z'));
    assert.ok(telegram.startsWith('/E2E5\\2P1-EMULATOR\r\n\r\n1-3:0.2.8(50)\r\n'));
    assert.match(telegram, /\r\n1-0:1\.7\.0\(00\.450\*kW\)\r\n/);
    assert.match(telegram, /\r\n![0-9A-F]{4}\r\n$/);
    // DSMR Reader finds a telegram by its first slash, so there must be only one.
    assert.equal(telegram.split('/').length, 2);
    assert.deepEqual(
      parseTelegrams(`${telegram.slice(100)}${telegram}${telegram}`).map((parsed) => parsed.crcValid),
      [true, true],
    );
  });

  it('detects a damaged telegram', () => {
    const telegram = buildTelegram(at('2026-11-18T12:00:25Z')).replace('00.450*kW', '00.451*kW');
    assert.deepEqual(parseTelegrams(telegram).map((parsed) => parsed.crcValid), [false]);
  });

  it('counts energy as the sum of the power', () => {
    const start = at('2026-11-18T12:00:00Z');
    let wattSeconds = 0;
    for (let second = 0; second < 3600; second += 1) {
      wattSeconds += readingAt(start + second).powerDeliveredKw * 1000;
    }
    const counted = readingAt(start + 3600).deliveredTariff2Kwh - readingAt(start).deliveredTariff2Kwh;
    assert.ok(Math.abs(counted - wattSeconds / 3_600_000) < 0.0015, `${counted} kWh in an hour`);
  });

  it('never counts backwards', () => {
    const start = at('2026-11-18T12:00:00Z');
    for (let second = 1; second < 900; second += 1) {
      const before = readingAt(start + second - 1);
      const after = readingAt(start + second);
      assert.ok(after.deliveredTariff2Kwh >= before.deliveredTariff2Kwh);
      assert.ok(after.gasM3 >= before.gasM3);
    }
  });
});
