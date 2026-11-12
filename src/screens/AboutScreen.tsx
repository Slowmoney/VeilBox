import { useNavigate } from 'react-router-dom';
import { useTx } from '../lib/useTx';
import { useAppStore } from '../store/useAppStore';
import { Button, ListGroup, Row, Screen } from '../ui';

/** Support link from SUPPORT.md. */
export const SUPPORT_URL = 'https://github.com/artem4150/VeilBox/issues';

export function AboutScreen() {
  const tx = useTx();
  const navigate = useNavigate();
  const about = useAppStore((state) => state.about);
  const update = useAppStore((state) => state.update);
  const updateState = useAppStore((state) => state.updateState);
  const checkForUpdate = useAppStore((state) => state.checkForUpdate);
  const installUpdate = useAppStore((state) => state.installUpdate);
  const pushToast = useAppStore((state) => state.pushToast);

  const copySupport = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_URL);
      pushToast({ title: tx('Ссылка скопирована', 'Link copied'), message: SUPPORT_URL, tone: 'success' });
    } catch {
      pushToast({ title: tx('Не удалось скопировать', 'Copy failed'), message: SUPPORT_URL, tone: 'error' });
    }
  };

  const busy = updateState !== 'idle';

  return (
    <Screen title={tx('О программе', 'About')} back="/settings">
      <div className="about-head">
        <img className="about-icon" src={`${import.meta.env.BASE_URL}app-icon.png`} alt="" />
        <strong className="about-name">VeilBox {about?.appVersion ?? ''}</strong>
        <span className="about-update">
          {update
            ? tx(`Доступна версия ${update.version}`, `Version ${update.version} available`)
            : tx('Установлена последняя версия', 'You have the latest version')}
        </span>
        <Button
          variant={update ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => void (update ? installUpdate() : checkForUpdate(false))}
        >
          {updateState === 'checking'
            ? tx('Проверяю…', 'Checking…')
            : updateState === 'installing'
              ? tx('Обновляю…', 'Updating…')
              : update
                ? tx('Обновить', 'Update')
                : tx('Проверить обновления', 'Check for updates')}
        </Button>
      </div>

      <ListGroup>
        <Row title="Xray" value={about?.xrayVersion ?? tx('нет данных', 'unknown')} />
        <Row title={tx('Поддержка', 'Support')} value="GitHub" chevron onClick={() => void copySupport()} />
        <Row title={tx('Конфиденциальность', 'Privacy')} chevron onClick={() => navigate('/settings/about/privacy')} />
        <Row title={tx('Условия', 'Terms')} chevron onClick={() => navigate('/settings/about/terms')} />
        <Row
          title={tx('Сторонние компоненты', 'Third-party components')}
          chevron
          onClick={() => navigate('/settings/about/third-party')}
        />
      </ListGroup>
    </Screen>
  );
}
