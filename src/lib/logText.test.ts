import { describe, expect, it } from 'vitest';
import { toRussianLog } from './logText';

describe('toRussianLog', () => {
  it('translates known backend messages', () => {
    expect(toRussianLog('Connected via NL #37')).toBe('Подключено: NL #37');
    expect(toRussianLog('Disconnected and cleared system proxy.')).toBe('Отключено');
    expect(toRussianLog('Xray exited unexpectedly. Reconnecting in 3s...')).toBe(
      'Соединение оборвалось, переподключение через 3 с',
    );
  });

  it('distinguishes connection kinds', () => {
    expect(toRussianLog("Connected profile 'X' in TUN mode. Local SOCKS diagnostic port 127.0.0.1:1080. Outbound interface: automatic.")).toBe(
      'Подключено: X (TUN)',
    );
    expect(toRussianLog('Connected via X (AmneziaWG)')).toBe('Подключено: X (AmneziaWG)');
  });

  it('returns unknown lines unchanged', () => {
    expect(toRussianLog('Something nobody wrote a rule for')).toBe('Something nobody wrote a rule for');
  });
});
