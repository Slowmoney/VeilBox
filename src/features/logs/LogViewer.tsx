import type { LogEntry } from '../../types';

interface LogViewerProps {
  title: string;
  entries: LogEntry[];
  onCopy?: () => void;
  onClear?: () => void;
}

export function LogViewer({ title, entries, onCopy, onClear }: LogViewerProps) {
  return (
    <div className="log-viewer-minimal">
      <div className="log-viewer-topline">
        <div className="log-viewer-heading">
          <h3>{title}</h3>
          <p>{entries.length} entries</p>
        </div>
        <div className="button-row">
          {onCopy ? (
            <button type="button" className="button" onClick={onCopy} disabled={entries.length === 0}>
              Copy
            </button>
          ) : null}
          {onClear ? (
            <button type="button" className="button" onClick={onClear} disabled={entries.length === 0}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <h3>No log entries yet</h3>
        </div>
      ) : (
        <div className="log-lines">
          {entries.map((entry) => (
            <div key={entry.id} className="log-line">
              <span>{new Date(entry.timestamp).toLocaleString()}</span>
              <strong>
                {entry.level} · {entry.source}
              </strong>
              <p>{entry.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
