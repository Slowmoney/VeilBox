import { Navigate, useParams } from 'react-router-dom';
import { useTx } from '../lib/useTx';
import { Screen } from '../ui';

type Doc = 'privacy' | 'terms' | 'third-party';

/** Privacy, terms and third-party notices, one screen each (texts moved from the old About page). */
export function LegalScreen() {
  const tx = useTx();
  const { doc } = useParams();

  const docs: Record<Doc, { title: string; items: Array<[string, string]> }> = {
    privacy: {
      title: tx('Конфиденциальность', 'Privacy'),
      items: [
        [
          tx('Локальное хранение', 'Local storage'),
          tx(
            'Профили, настройки, выбранный профиль и локальные логи хранятся в AppData.',
            'Profiles, settings, selected profile, and local logs are stored in AppData.',
          ),
        ],
        [tx('Телеметрия', 'Telemetry'), tx('По умолчанию отсутствует.', 'Not enabled by default.')],
        [
          tx('Сетевые соединения', 'Network connections'),
          tx(
            'Приложение подключается только к выбранным VPN-серверам, подпискам и диагностическим endpoint при необходимости.',
            'The app only connects to selected VPN servers, subscription URLs, and optional diagnostic endpoints when needed.',
          ),
        ],
        [tx('Полный текст', 'Full text'), 'PRIVACY.md'],
      ],
    },
    terms: {
      title: tx('Условия', 'Terms'),
      items: [
        [
          tx('Ответственность пользователя', 'User responsibility'),
          tx(
            'Пользователь сам отвечает за законность использования VPN, серверов и импортируемых конфигов.',
            'The user is responsible for lawful VPN use, servers, and imported configs.',
          ),
        ],
        [tx('Гарантии', 'Warranty'), tx('Приложение предоставляется «как есть».', 'The application is provided "as is".')],
        [tx('Полный текст', 'Full text'), 'TERMS.md'],
      ],
    },
    'third-party': {
      title: tx('Сторонние компоненты', 'Third-party components'),
      items: [
        ['Xray-core', 'MPL-2.0'],
        ['AmneziaWG Windows Client', 'MIT'],
        ['Wintun', tx('Официальные условия поставки Wintun', 'Official Wintun distribution terms')],
        [tx('Полный список', 'Full notice'), 'THIRD_PARTY_NOTICES.md'],
      ],
    },
  };

  if (!doc || !(doc in docs)) {
    return <Navigate to="/settings/about" replace />;
  }
  const current = docs[doc as Doc];

  return (
    <Screen title={current.title} back="/settings/about">
      <div className="ui-group">
        {current.items.map(([label, text]) => (
          <div key={label} className="legal-row">
            <span className="legal-row__label">{label}</span>
            <p className="legal-row__text">{text}</p>
          </div>
        ))}
      </div>
    </Screen>
  );
}
