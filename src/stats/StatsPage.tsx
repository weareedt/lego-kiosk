import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CHARACTERS, CHARACTER_IDS } from '../lib/characters';
import { config } from '../lib/config';
import { kioskId, loadUsage, localDay, type DayStats } from '../lib/usage';
import './stats.css';

/**
 * Staff usage stats at /stats. Open it from anywhere (it reads the online copy
 * the iPad uploads every few minutes, see server/usage.ts), or on the iPad by
 * holding the Welcome screen's top-left corner for 3 seconds (then this iPad's
 * own, up-to-the-second counts are used for it).
 */

type Days = Record<string, Record<string, number>>;
interface Snapshot {
  at: string;
  days: Days;
}

type Online =
  | { state: 'loading' }
  | { state: 'ok'; kiosks: Record<string, Snapshot> }
  | { state: 'locked'; wrong: boolean }
  | { state: 'unavailable'; reason: string };

const KEY_STORAGE = 'stf.statsKey';
const REFRESH_MS = 60_000;

const readKey = () => {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
};

/** Adds up every iPad's counts; this iPad's live counts replace its uploaded copy. */
function combine(kiosks: Record<string, Snapshot>, self: string | null, local: DayStats[]): DayStats[] {
  const all: Days[] = Object.entries(kiosks)
    .filter(([id]) => !(id === self && local.length))
    .map(([, s]) => s.days);
  if (local.length) all.push(Object.fromEntries(local.map((d) => [d.day, d.counts])));
  const out: Days = {};
  for (const days of all)
    for (const [day, counts] of Object.entries(days)) {
      const o = (out[day] ??= {});
      for (const [k, v] of Object.entries(counts)) o[k] = (o[k] ?? 0) + v;
    }
  return Object.keys(out)
    .sort()
    .map((day) => ({ day, counts: out[day] }));
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(min)) return 'unknown';
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};

/** The kiosk flow, in order. "Started" = tapped Welcome and reached the name screen. */
const STEPS = [
  { type: 'start', label: 'Started' },
  { type: 'camera', label: 'Reached camera' },
  { type: 'confirm', label: 'Took a photo' },
  { type: 'matching', label: 'Got matched' },
  { type: 'reveal', label: 'Saw their result' },
] as const;

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
const hourKey = (step: string, h: number) => `${step}@${String(h).padStart(2, '0')}`;

const DAY_MS = 24 * 3600 * 1000;
const dayNumber = (d: string) => Math.round((parseDay(d).getTime() - parseDay(config.event.start).getTime()) / DAY_MS) + 1;

/** "13 Nov – 27 Dec · day 3 of 45" (or "starts …" / "ended"). */
function eventProgress(): string {
  const { start, end } = config.event;
  const fmtShort = (d: string) => parseDay(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const range = `${fmtShort(start)} – ${fmtShort(end)}`;
  const today = localDay(new Date());
  const total = dayNumber(end);
  if (today < start) return `${range} · starts ${dayShort(start)}`;
  if (today > end) return `${range} · ended`;
  return `${range} · day ${dayNumber(today)} of ${total}`;
}

function sumCounts(days: DayStats[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of days) for (const [k, v] of Object.entries(d.counts)) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Busiest hour of the day by guests started, or null if nobody started. */
function busiestHour(c: Record<string, number>): number | null {
  let best: number | null = null;
  for (let h = 0; h < 24; h++) if (n(c, hourKey('start', h)) > (best === null ? 0 : n(c, hourKey('start', best)))) best = h;
  return best;
}

export function StatsPage() {
  const [local] = useState(loadUsage);
  const [self] = useState(() => kioskId(false));
  const [key, setKey] = useState(readKey);
  const [online, setOnline] = useState<Online>({ state: 'loading' });
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/usage', { headers: key ? { 'x-stats-key': key } : {}, cache: 'no-store' });
      if (res.status === 401) return setOnline({ state: 'locked', wrong: !!key });
      if (res.status === 503) return setOnline({ state: 'unavailable', reason: 'Online stats aren’t connected yet.' });
      if (!res.ok) return setOnline({ state: 'unavailable', reason: `Online stats returned an error (${res.status}).` });
      const body = (await res.json()) as { kiosks: Record<string, Snapshot> };
      setOnline({ state: 'ok', kiosks: body.kiosks ?? {} });
    } catch {
      setOnline((prev) => (prev.state === 'ok' ? prev : { state: 'unavailable', reason: 'Couldn’t reach the online stats.' }));
    }
  }, [key]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  // Only the official event days (testing before the start is kept but not shown).
  const days = useMemo(
    () => combine(online.state === 'ok' ? online.kiosks : {}, self, local).filter((d) => d.day >= config.event.start && d.day <= config.event.end),
    [online, self, local],
  );
  // iPads that have counted at least one guest (empty uploads from stray browsers don't count).
  const others =
    online.state === 'ok'
      ? Object.entries(online.kiosks).filter(([id, s]) => !(id === self && local.length) && Object.keys(s.days).length > 0)
      : [];
  const latest = others.map(([, s]) => s.at).sort().pop();

  let source: string;
  if (online.state === 'loading') source = local.length ? 'This iPad · loading online stats…' : 'Loading…';
  else if (online.state === 'ok') {
    const ipads = others.length + (local.length ? 1 : 0);
    source = !ipads ? '' : `${ipads === 1 ? '1 iPad' : `${ipads} iPads`}${local.length ? ' · this iPad live' : ''}${latest ? ` · last upload ${ago(latest)}` : ''}`;
  } else source = local.length ? 'This iPad only' : '';

  return (
    <>
      <header className="st-brand">
        <div className="st-brand-in">
          <img className="st-logo" src="/assets/lego-logo.png" alt="LEGO" width={56} height={56} />
          <div className="st-titles">
            <p className="st-kicker">LEGO® Santa’s Toy Factory</p>
            <h1>Kiosk usage</h1>
            {source && <p className="st-sub">{source}</p>}
          </div>
          <div className="st-actions">
            <button className="st-btn" onClick={() => void refresh()}>
              Refresh
            </button>
            <button className="st-btn" onClick={() => downloadCsv(days)} disabled={!days.length}>
              Download CSV
            </button>
            {self && (
              <button className="st-btn st-btn-primary" onClick={() => location.assign('/')}>
                Back to kiosk
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="st">
        {online.state === 'unavailable' && <p className="st-note">{online.reason}{local.length ? ' Showing this iPad’s own counts.' : ''}</p>}
        {online.state === 'locked' && (
          <KeyForm
            wrong={online.wrong}
            onSubmit={(k) => {
              try {
                localStorage.setItem(KEY_STORAGE, k);
              } catch {
                /* ignore */
              }
              setKey(k);
            }}
          />
        )}
        {(online.state !== 'loading' || local.length > 0) && !(online.state === 'locked' && !local.length) && (
          <Dashboard days={days} selected={selected} onSelect={setSelected} />
        )}
      </div>
    </>
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
      <label htmlFor="st-key">{wrong ? 'That key didn’t work. Try again.' : 'Enter the stats key to see all iPads.'}</label>
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
  const peak = busiestHour(day.counts);

  return (
    <>
      <section aria-label="Whole event">
        <h2 className="st-h2">
          Whole event <span className="st-muted">· {eventProgress()}</span>
        </h2>
        <div className="st-tiles">
          <Tile label="Guests" value={fmt(n(total, 'start'))} />
          <Tile label="Saw their result" value={fmt(n(total, 'reveal'))} note={`${pct(n(total, 'reveal'), n(total, 'start'))} of guests`} />
          <Tile label="Busiest day" value={dayShort(busiest.day)} note={`${fmt(n(busiest.counts, 'start'))} guests`} />
          <Tile label="Camera problems" value={fmt(n(total, 'cameraError'))} note="camera error screen shown" />
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
                {fmt(n(d.counts, 'start'))} guests · {fmt(n(d.counts, 'reveal'))} saw their result
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
          <Tile
            label="Busiest hour"
            value={peak === null ? '–' : hourLabel(peak)}
            note={peak === null ? 'no guests' : `${fmt(n(day.counts, hourKey('start', peak)))} guests`}
          />
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
  const byHour = Array.from({ length: 24 }, (_, h) => n(counts, hourKey('start', h)));
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
