import { useI18n } from '../i18n/I18n.tsx';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './select.css';

export type SelectOption<T extends string> = { value: T; label: string; detail?: string };

/** Select-only combobox: focus stays on the trigger while the listbox is open. */
export function GameSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  tone = 'dark',
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  icon?: ReactNode;
  tone?: 'dark' | 'parchment';
}) {
  const { t } = useI18n();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 280, maxHeight: 320 });
  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 24);
      const height = Math.min(options.length * 68 + 16, 340);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upwards = below < Math.min(height, 220) && above > below;
      const maxHeight = Math.max(96, Math.min(height, upwards ? above - 8 : below - 8));
      setPosition({
        width,
        maxHeight,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: upwards ? rect.top - maxHeight - 8 : rect.bottom + 8,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !popup.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open)
      popup.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);
  return (
    <div className={`game-select select-${tone}`}>
      <span className="select-label" id={`${id}-label`}>
        {t(label)}
      </span>
      <button
        ref={trigger}
        type="button"
        className={`select-trigger${open ? ' is-open' : ''}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        onClick={() => {
          setActive(selected);
          setOpen((v) => !v);
        }}
        onBlur={(event) => {
          if (!popup.current?.contains(event.relatedTarget as Node)) setOpen(false);
        }}
        onKeyDown={(event) => {
          const key = event.key;
          if (key === 'Tab') {
            setOpen(false);
            return;
          }
          if (key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            return;
          }
          if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            if (open) choose(active);
            else {
              setActive(selected);
              setOpen(true);
            }
            return;
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
            event.preventDefault();
            setOpen(true);
            setActive(
              key === 'Home'
                ? 0
                : key === 'End'
                  ? options.length - 1
                  : !open
                    ? selected
                    : (active + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length,
            );
            return;
          }
          if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            const now = Date.now();
            const text =
              (now - search.current.time < 700 ? search.current.text : '') +
              key.toLocaleLowerCase();
            search.current = { text, time: now };
            const index = options.findIndex((o) => t(o.label).toLocaleLowerCase().startsWith(text));
            if (index >= 0) {
              setActive(index);
              setOpen(true);
            }
          }
        }}
      >
        {icon && (
          <span className="select-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="select-value" id={`${id}-value`}>
          {t(options[selected].label)}
        </span>
        <svg className="select-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className={`select-popup select-${tone}`}
            style={position}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-option-${index}`}
                data-index={index}
                role="option"
                aria-selected={option.value === value}
                className={`select-option${index === active ? ' is-active' : ''}`}
                onPointerMove={() => setActive(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>
                  <b>{t(option.label)}</b>
                  {option.detail && <small>{t(option.detail)}</small>}
                </span>
                <span className="select-check" aria-hidden="true">
                  {option.value === value ? '✓' : ''}
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
