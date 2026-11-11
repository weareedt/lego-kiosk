import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CHARACTERS, CHARACTER_IDS } from '../lib/characters';
import './stats.css';

/**
 * Staff usage dashboard at /stats. Reads per-day totals from /api/stats
 * (see server/telemetry.ts) and refreshes every minute.
 */

interface DayStats {
  day: string;
  counts: Record<string, number>;
}

type Load =
  | { state: 'loading' }
  | { state: 'ok'; days: DayStats[]; at: Date }
  | { state: 'locked'; wrong: boolean }
  | { state: 'unconfigured' }
  | { state: 'error'; message: string };

const KEY_STORAGE = 'stf.statsKey';
const REFRESH_MS = 60_000;

/** The kiosk flow, in order. "Started" = tapped Welcome and reached the name screen. */
const STEPS = [
  { type: 'start', label: 'Started' },
  { type: 'camera', label: 'Reached camera' },
  { type: 'confirm', label: 'Took a photo' },
  { type: 'matching', label: 'Got matched' },
  { type: 'reveal', label: 'Saw their result' },
  { type: 'qr', label: 'Scanned the QR' },
] as const;

const readKey = () => {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
};
const writeKey = (k: string) => {
  try {
    localStorage.setItem(KEY_STORAGE, k);
  } catch {
    /* ignore */
  }
};

const n = (c: Record<string, number>, k: string) => c[k] ?? 0;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–');
const fmt = (v: number) => v.toLocaleString();

const parseDay = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd);
};
const dayShort = (d: string) => parseDay(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const dayLong = (d: string) => parseDay(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

function sumCounts(days: DayStats[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of days) for (const [k, v] of Object.entries(d.counts)) out[k] = (out[k] ?? 0) + v;
  return out;
}

export function StatsPage() {
  const [key, setKey] = useState(readKey);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [selected, setSelected] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { headers: key ? { 'x-stats-key': key } : {}, cache: 'no-store' });
      if (res.status === 401) return setLoad({ state: 'locked', wrong: !!key });
      if (res.status === 503) return setLoad({ state: 'unconfigured' });
      if (!res.ok) return setLoad({ state: 'error', message: `The stats service returned ${res.status}.` });
      const body = (await res.json()) as { days: DayStats[]; at: string };
      setLoad({ state: 'ok', days: body.days, at: new Date(body.at) });
    } catch {
      setLoad((prev) => (prev.state === 'ok' ? prev : { state: 'error', message: 'Couldn’t reach the stats service. Check the connection.' }));
    }
  }, [key]);

  useEffect(() => {
    void fetchStats();
    const t = window.setInterval(fetchStats, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [fetchStats]);

  return (
    <div className="st">
      <header className="st-head">
        <div>
          <h1>Kiosk usage</h1>
          <p className="st-sub">
            LEGO® Santa’s Toy Factory
            {load.state === 'ok' && <> · updated {load.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</>}
          </p>
        </div>
        {load.state === 'ok' && (
          <div className="st-actions">
            <button className="st-btn" onClick={() => void fetchStats()}>
              Refresh
            </button>
            <button className="st-btn" onClick={() => downloadCsv(load.days)} disabled={!load.days.length}>
              Download CSV
            </button>
          </div>
        )}
      </header>

      {load.state === 'loading' && <p className="st-note">Loading…</p>}
      {load.state === 'error' && <p className="st-note">{load.message}</p>}
      {load.state === 'unconfigured' && (
        <p className="st-note">
          Stats storage isn’t connected yet. Add an Upstash Redis database to this project in Vercel (Storage tab), then redeploy.
        </p>
      )}
      {load.state === 'locked' && (
        <KeyForm
          wrong={load.wrong}
          onSubmit={(k) => {
            writeKey(k);
            setKey(k);
          }}
        />
      )}
      {load.state === 'ok' && <Dashboard days={load.days} selected={selected} onSelect={setSelected} />}
    </div>
  );
}

function KeyForm({ wrong, onSubmit }: { wrong: boolean; onSubmit: (k: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form
      className="st-card st-key"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSubmit(v.trim());
      }}
    >
      <label htmlFor="st-key">{wrong ? 'That key didn’t work. Try again.' : 'Enter the stats key to view usage.'}</label>
      <div className="st-key-row">
        <input id="st-key" type="password" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="st-btn st-btn-primary" type="submit">
          View
        </button>
      </div>
    </form>
  );
}

function Dashboard({ days, selected, onSelect }: { days: DayStats[]; selected: string | null; onSelect: (d: string) => void }) {
  const total = useMemo(() => sumCounts(days), [days]);
  if (!days.length) {
    return <p className="st-note">No guests yet. Numbers appear here as soon as someone taps the kiosk.</p>;
  }
  const day = days.find((d) => d.day === selected) ?? days[days.length - 1];
  const busiest = days.reduce((a, b) => (n(b.counts, 'start') > n(a.counts, 'start') ? b : a));

  return (
    <>
      <section aria-label="Whole event">
        <h2 className="st-h2">
          Whole event <span className="st-muted">· {days.length === 1 ? '1 day' : `${days.length} days`}</span>
        </h2>
        <div className="st-tiles">
          <Tile label="Guests" value={fmt(n(total, 'start'))} />
          <Tile label="Saw their result" value={fmt(n(total, 'reveal'))} note={`${pct(n(total, 'reveal'), n(total, 'start'))} of guests`} />
          <Tile label="Scanned the QR" value={fmt(n(total, 'qr'))} note={`${pct(n(total, 'qr'), n(total, 'reveal'))} of results`} />
          <Tile label="Busiest day" value={dayShort(busiest.day)} note={`${fmt(n(busiest.counts, 'start'))} guests`} />
        </div>
      </section>

      <section className="st-card">
        <h3 className="st-h3">Guests per day</h3>
        <p className="st-hint">Tap a day to see its details below.</p>
        <Bars
          items={days.map((d) => ({
            key: d.day,
            label: dayShort(d.day),
            value: n(d.counts, 'start'),
            tip: (
              <>
                <strong>{dayShort(d.day)}</strong>
                <br />
                {fmt(n(d.counts, 'start'))} guests · {fmt(n(d.counts, 'reveal'))} results · {fmt(n(d.counts, 'qr'))} QR scans
              </>
            ),
          }))}
          selected={day.day}
          onSelect={onSelect}
        />
      </section>

      <section aria-label="Selected day">
        <div className="st-dayhead">
          <h2 className="st-h2">{dayLong(day.day)}</h2>
          <select aria-label="Choose a day" value={day.day} onChange={(e) => onSelect(e.target.value)}>
            {[...days].reverse().map((d) => (
              <option key={d.day} value={d.day}>
                {dayShort(d.day)}
              </option>
            ))}
          </select>
        </div>
        <div className="st-tiles">
          <Tile label="Guests" value={fmt(n(day.counts, 'start'))} />
          <Tile label="Saw their result" value={fmt(n(day.counts, 'reveal'))} note={`${pct(n(day.counts, 'reveal'), n(day.counts, 'start'))} of guests`} />
          <Tile label="Scanned the QR" value={fmt(n(day.counts, 'qr'))} note={`${pct(n(day.counts, 'qr'), n(day.counts, 'reveal'))} of results`} />
          <Tile label="Camera problems" value={fmt(n(day.counts, 'cameraError'))} note="camera error screen shown" />
        </div>

        <div className="st-grid">
          <div className="st-card">
            <h3 className="st-h3">Guests by hour</h3>
            <HourBars counts={day.counts} />
          </div>
          <div className="st-card">
            <h3 className="st-h3">How far guests got</h3>
            <p className="st-hint">Share of guests who started.</p>
            <HBars
              rows={STEPS.map((s) => ({
                label: s.label,
                value: n(day.counts, s.type),
                note: pct(n(day.counts, s.type), n(day.counts, 'start')),
              }))}
              max={Math.max(1, ...STEPS.map((s) => n(day.counts, s.type)))}
            />
          </div>
          <div className="st-card">
            <h3 className="st-h3">Cards handed out</h3>
            <p className="st-hint">This day, with the whole event in brackets.</p>
            <HBars
              rows={CHARACTER_IDS.map((id) => ({
                label: CHARACTERS[id].name,
                value: n(day.counts, `char:${id}`),
                note: `(${fmt(n(total, `char:${id}`))})`,
              }))}
              max={Math.max(1, ...CHARACTER_IDS.map((id) => n(day.counts, `char:${id}`)))}
            />
          </div>
        </div>
      </section>

      <section className="st-card">
        <h3 className="st-h3">Every day</h3>
        <DayTable days={days} total={total} />
      </section>
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="st-tile">
      <div className="st-tile-label">{label}</div>
      <div className="st-tile-value">{value}</div>
      {note && <div className="st-tile-note">{note}</div>}
    </div>
  );
}

// ---- Charts ---------------------------------------------------------------

/** Round axis maximum and step, e.g. 37 → 40 in steps of 10. */
function niceScale(max: number): { top: number; step: number } {
  if (max <= 4) return { top: 4, step: 1 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { top: Math.ceil(max / step) * step, step };
}

interface BarItem {
  key: string;
  label: string;
  value: number;
  tip: ReactNode;
}

function Bars({ items, selected, onSelect, labelEvery = 1 }: { items: BarItem[]; selected?: string; onSelect?: (k: string) => void; labelEvery?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const { top, step } = niceScale(Math.max(0, ...items.map((i) => i.value)));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const hovered = items.find((i) => i.key === hover);

  return (
    <div className="st-bars">
      <div className="st-bars-plot">
        {ticks.map((t) => (
          <div key={t} className="st-grid-line" style={{ bottom: `${(t / top) * 100}%` }}>
            <span>{fmt(t)}</span>
          </div>
        ))}
        <div className="st-bars-row">
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              className={`st-bar-hit${it.key === selected ? ' is-selected' : ''}${onSelect ? '' : ' is-static'}`}
              onMouseEnter={() => setHover(it.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(it.key)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect?.(it.key)}
              aria-label={`${it.label}: ${it.value}`}
              aria-pressed={onSelect ? it.key === selected : undefined}
            >
              <span className="st-bar" style={{ height: `${(it.value / top) * 100}%` }} />
              {hover === it.key && hovered && <span className="st-tip">{hovered.tip}</span>}
              <span className="st-bar-label" aria-hidden>
                {i % labelEvery === 0 ? it.label : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HourBars({ counts }: { counts: Record<string, number> }) {
  const byHour = Array.from({ length: 24 }, (_, h) => n(counts, `start@${String(h).padStart(2, '0')}`));
  const active = byHour.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0);
  if (!active.length) return <p className="st-hint">No guests this day.</p>;
  // Show the hours the kiosk was in use, padded by one hour either side.
  const from = Math.max(0, active[0] - 1);
  const to = Math.min(23, active[active.length - 1] + 1);
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const peak = hours.reduce((a, b) => (byHour[b] > byHour[a] ? b : a));
  return (
    <>
      <p className="st-hint">
        Busiest: {hourLabel(peak)}–{hourLabel((peak + 1) % 24)} with {fmt(byHour[peak])} guests.
      </p>
      <Bars
        labelEvery={Math.max(1, Math.ceil(hours.length / 5))}
        items={hours.map((h) => ({
          key: String(h),
          label: hourLabel(h),
          value: byHour[h],
          tip: (
            <>
              <strong>
                {hourLabel(h)}–{hourLabel((h + 1) % 24)}
              </strong>
              <br />
              {fmt(byHour[h])} guests started
            </>
          ),
        }))}
      />
    </>
  );
}

function HBars({ rows, max }: { rows: { label: string; value: number; note: string }[]; max: number }) {
  return (
    <ul className="st-hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="st-hbar-label">{r.label}</span>
          <span className="st-hbar-track">
            <span className="st-hbar" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="st-hbar-value">
            {fmt(r.value)} <span className="st-muted">{r.note}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---- Table and CSV --------------------------------------------------------

const COLUMNS: { label: string; get: (c: Record<string, number>) => string }[] = [
  ...STEPS.map((s) => ({ label: s.label, get: (c: Record<string, number>) => fmt(n(c, s.type)) })),
  { label: 'Result rate', get: (c) => pct(n(c, 'reveal'), n(c, 'start')) },
  { label: 'QR scan rate', get: (c) => pct(n(c, 'qr'), n(c, 'reveal')) },
  { label: 'Camera problems', get: (c) => fmt(n(c, 'cameraError')) },
];

function DayTable({ days, total }: { days: DayStats[]; total: Record<string, number> }) {
  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            {COLUMNS.map((c) => (
              <th key={c.label} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.day}>
              <th scope="row">{dayShort(d.day)}</th>
              {COLUMNS.map((c) => (
                <td key={c.label}>{c.get(d.counts)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {COLUMNS.map((c) => (
              <td key={c.label}>{c.get(total)}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function downloadCsv(days: DayStats[]) {
  const head = ['day', ...STEPS.map((s) => s.type), 'cameraError', ...CHARACTER_IDS.map((id) => `cards_${id}`)];
  const rows = days.map((d) => [
    d.day,
    ...STEPS.map((s) => n(d.counts, s.type)),
    n(d.counts, 'cameraError'),
    ...CHARACTER_IDS.map((id) => n(d.counts, `char:${id}`)),
  ]);
  const csv = [head, ...rows].map((r) => r.join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `kiosk-usage-${days[days.length - 1]?.day ?? 'empty'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
