import { useEffect, useMemo, useRef, useState } from 'react';

type Props = { value: string; onChange: (next: string) => void; withTime?: boolean; disabled?: boolean; placeholder?: string };
/** A fully styled, keyboard-accessible date picker; does not depend on browser-native calendar chrome. */
export function ThemedDateTime({ value, onChange, withTime = false, disabled, placeholder = 'Choose a date' }: Props) {
  const current = value ? new Date(value) : null;
  const initial = current && !Number.isNaN(current.getTime()) ? current : new Date();
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [open, setOpen] = useState(false);
  const popover = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const click = (event: MouseEvent) => { if (popover.current && !popover.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', close);
    document.addEventListener('mousedown', click);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('mousedown', click); };
  }, [open]);
  const days = useMemo(() => {
    const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: offset }, () => null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [month]);
  const selected = value?.slice(0, 10) || '';
  const display = selected && !Number.isNaN(Date.parse(selected + 'T12:00:00')) ? new Date(selected + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const time = value?.match(/T(\d\d:\d\d)/)?.[1] || '09:00';
  const choose = (day: number) => {
    const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(withTime ? `${date}T${time}` : date);
    setOpen(false);
  };
  return <div className="miih-themed-calendar" ref={popover}>
    <button className="miih-date-trigger" disabled={disabled} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <span>{display || placeholder}{withTime && display ? ` · ${time}` : ''}</span><span aria-hidden="true">▦</span>
    </button>
    {open && <div className="miih-calendar-popover" role="dialog" aria-label="Select date">
      <div className="miih-calendar-head">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <select aria-label="Month" value={month.getMonth()} onChange={e => setMonth(new Date(month.getFullYear(), Number(e.target.value), 1))}>{Array.from({ length: 12 }, (_, i) => <option value={i} key={i}>{new Date(2000, i, 1).toLocaleString('en-IN', { month: 'long' })}</option>)}</select>
        <select aria-label="Year" value={month.getFullYear()} onChange={e => setMonth(new Date(Number(e.target.value), month.getMonth(), 1))}>{Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => <option key={year}>{year}</option>)}</select>
        <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="miih-calendar-grid">{['M','T','W','T','F','S','S'].map((name,i) => <span className="miih-calendar-weekday" key={i}>{name}</span>)}{days.map((day, i) => day === null ? <span key={'blank' + i}/> : <button type="button" key={i} aria-pressed={selected === `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`} onClick={() => choose(day)}>{day}</button>)}</div>
      <div className="miih-calendar-footer">{withTime && <label>Time <input type="time" value={time} onChange={e => onChange(`${selected || new Date().toISOString().slice(0, 10)}T${e.target.value}`)}/></label>}<button type="button" onClick={() => { onChange(''); setOpen(false); }}>Clear date</button><button type="button" onClick={() => { const today = new Date(); const value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; setMonth(new Date(today.getFullYear(),today.getMonth(),1)); onChange(withTime ? `${value}T${time}` : value); setOpen(false); }}>Today</button></div>
    </div>}
  </div>;
}
