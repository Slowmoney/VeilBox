/**
 * Journal lines for people: the backend writes English technical messages,
 * this table turns the known ones into short Russian text. Unknown lines are
 * returned as they are (the journal is for support).
 *
 * Sources: src-tauri/src/{xray_manager,amnezia_manager_windows,amnezia_manager_macos,
 * speed_balancer,tray_manager,lib}.rs. Order matters: the first match wins.
 */
const RULES: Array<[RegExp, string]> = [
  [/^Application initialized\.?$/, 'Приложение запущено'],
  [/^Quit requested from tray\.?$/, 'Выход из приложения через трей'],

  [/^Connected profile '(.+)' through local proxy 127\.0\.0\.1:\d+$/, 'Подключено: $1'],
  [/^Connected profile '(.+)' in TUN mode\..*$/, 'Подключено: $1 (TUN)'],
  [/^Connected profile '(.+)' through AmneziaWG (?:tunnel service '.*'|interface .*)\.?$/, 'Подключено: $1 (AmneziaWG)'],
  [/^Connected via (.+?) \(AmneziaWG\)$/, 'Подключено: $1 (AmneziaWG)'],
  [/^Connected via (.+?) in TUN mode$/, 'Подключено: $1 (TUN)'],
  [/^Connected via (.+?): proxy only .*$/, 'Подключено: $1 (только прокси)'],
  [/^Connected via (.+)$/, 'Подключено: $1'],
  [/^Disconnected and cleared system proxy\.?$/, 'Отключено'],
  [/^Disconnected\.?$/, 'Отключено'],
  [/^Starting (?:Xray|AmneziaWG) for (.+?)\.\.\.$/, 'Подключение: $1'],

  [/^Xray exited unexpectedly\. Reconnecting in (\d+)s\.\.\.$/, 'Соединение оборвалось, переподключение через $1 с'],
  [/^Xray exited unexpectedly with status .*\. Preparing recovery\.$/, 'Соединение оборвалось, восстанавливаю'],
  [/^Auto reconnect attempt failed: (.*)$/, 'Не удалось переподключиться: $1'],
  [/^Connection start failed: (.*)$/, 'Не удалось подключиться: $1'],
  [/^Connection core exited unexpectedly\.?$/, 'Ядро соединения неожиданно остановилось'],
  [/^AmneziaWG tunnel stopped unexpectedly\.?$/, 'Туннель AmneziaWG неожиданно остановился'],

  [/^Detected stale local system proxy on launch and cleared it\.?$/, 'Системный прокси остался с прошлого запуска и выключен'],
  [/^Unable to apply WinHTTP proxy compatibility layer: (.*)$/, 'Не удалось настроить WinHTTP: $1'],
  [/^Unable to restore previous WinHTTP proxy state: (.*)$/, 'Не удалось вернуть прежний WinHTTP-прокси: $1'],
  [/^Unable to poll Xray process status: (.*)$/, 'Не удалось проверить состояние Xray: $1'],

  [/^Speed balancer selected (.+?) \((\d+) KiB\/s measured download\)\.?$/, 'Выбран быстрый сервер: $1 ($2 КБ/с)'],
  [/^All speed probes failed; restored Xray latency-based fallback\.?$/, 'Тест скорости не удался, выбор по задержке'],
  [/^Speed probe could not select an Xray outbound; keeping the current route\.?$/, 'Не удалось переключить сервер, остаюсь на текущем'],
  [/^No server completed the download speed test;.*$/, 'Ни один сервер не прошёл тест скорости, выбор по задержке'],
];

export function toRussianLog(message: string): string {
  const text = message.trim();
  for (const [pattern, replacement] of RULES) {
    if (pattern.test(text)) {
      return text.replace(pattern, replacement);
    }
  }
  return message;
}
