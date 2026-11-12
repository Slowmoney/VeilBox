import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectImportKind } from '../../lib/importDetect';
import { useTx } from '../../lib/useTx';
import { useAppStore } from '../../store/useAppStore';
import { Button, Sheet, TextArea } from '../../ui';

interface AddSheetProps {
  open: boolean;
  onClose: () => void;
}

/** One field for everything: the kind of the pasted text decides the import action. */
export function AddSheet({ open, onClose }: AddSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="">
      {/* The body mounts only while open, so its state resets between openings. */}
      <AddBody onClose={onClose} />
    </Sheet>
  );
}

function AddBody({ onClose }: { onClose: () => void }) {
  const tx = useTx();
  const navigate = useNavigate();
  const importProfile = useAppStore((state) => state.importProfile);
  const importProfilesJson = useAppStore((state) => state.importProfilesJson);
  const importAmneziaConfig = useAppStore((state) => state.importAmneziaConfig);
  const importAmneziaUri = useAppStore((state) => state.importAmneziaUri);
  const importSubscription = useAppStore((state) => state.importSubscription);
  const pushToast = useAppStore((state) => state.pushToast);
  const [text, setText] = useState('');
  const [jsonMode, setJsonMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async (value = text, fileName?: string) => {
    const trimmed = value.trim();
    const detected = detectImportKind(trimmed);
    const kind = jsonMode && detected === 'unknown' ? 'unknown' : detected;
    if (kind === 'unknown') {
      setError(
        jsonMode
          ? tx('Не похоже на JSON', 'Does not look like JSON')
          : tx('Не похоже на ссылку или конфиг', 'Does not look like a link or a config'),
      );
      return;
    }
    setError(null);
    setBusy(true);
    try {
      switch (kind) {
        case 'subscription':
          await importSubscription(trimmed);
          break;
        case 'proxyUri':
          if (!(await importProfile(trimmed))) {
            return;
          }
          break;
        case 'amneziaUri':
          await importAmneziaUri(trimmed);
          break;
        case 'amneziaConfig':
          await importAmneziaConfig(trimmed, fileName);
          break;
        case 'json':
          await importProfilesJson(trimmed);
          break;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const fromClipboard = async () => {
    try {
      const clip = (await navigator.clipboard.readText()).trim();
      if (clip) {
        setText(clip);
        setError(null);
      }
    } catch {
      pushToast({
        title: tx('Не удалось прочитать буфер', 'Cannot read the clipboard'),
        message: tx('Вставьте текст вручную (Ctrl+V).', 'Paste the text manually (Ctrl+V).'),
        tone: 'error',
      });
    }
  };

  const fromFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const content = await file.text();
    const name = file.name.replace(/\.[^.]+$/, '');
    if (detectImportKind(content) === 'unknown') {
      setError(tx('В файле нет конфига', 'No config in the file'));
      return;
    }
    setText(content);
    await submit(content, name);
  };

  return (
    <>
      <div className="ui-sheet__head">
        <h2 className="ui-sheet__title">{tx('Добавить', 'Add')}</h2>
        <p className="ui-sheet__sub">
          {tx('Вставьте ссылку подписки или ключ — тип определится сам.', 'Paste a subscription link or a key — the type is detected.')}
        </p>
      </div>
      <TextArea
        mono
        rows={jsonMode ? 8 : 3}
        value={text}
        placeholder={
          jsonMode ? '{ "profiles": [ … ] }' : 'https://… · vless:// · ss:// · hy2:// · vpn:// · [Interface]'
        }
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        spellCheck={false}
      />
      {error ? <p className="add-error">{error}</p> : null}
      <div className="add-actions">
        <Button block disabled={busy || !text.trim()} onClick={() => void submit()}>
          {busy ? tx('Добавляю…', 'Adding…') : tx('Добавить', 'Add')}
        </Button>
      </div>
      <div className="add-sources">
        <Button variant="secondary" size="sm" onClick={() => void fromClipboard()}>
          {tx('Из буфера', 'Paste')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
          {tx('Файл .conf', '.conf file')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setJsonMode((value) => !value)}>
          JSON
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onClose();
            navigate('/servers/profile/new');
          }}
        >
          {tx('Вручную', 'Manually')}
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".conf,.txt,text/plain"
        hidden
        onChange={(event) => {
          void fromFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </>
  );
}
