import { useMemo, useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBagShopping,
  faCheck,
  faClipboardCheck,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import type { ChecklistKind, Checklists } from '../types';

interface PlanningPageProps {
  checklists: Checklists;
  onToggle: (kind: ChecklistKind, itemId: string) => void;
  onAdd: (kind: ChecklistKind, text: string) => void;
  readOnly?: boolean;
}

const sections = [
  {
    kind: 'todo' as const,
    title: '出發前待辦',
    placeholder: '新增待辦事項',
    icon: faClipboardCheck,
    accent: 'bg-forest-700',
    pale: 'bg-forest-50',
  },
  {
    kind: 'shopping' as const,
    title: '購物清單',
    placeholder: '新增想買的東西',
    icon: faBagShopping,
    accent: 'bg-category-food',
    pale: 'bg-earth-50',
  },
];

export function PlanningPage({ checklists, onToggle, onAdd, readOnly = false }: PlanningPageProps) {
  const [drafts, setDrafts] = useState<Record<(typeof sections)[number]['kind'], string>>({
    todo: '',
    shopping: '',
  });

  const progress = useMemo(() => {
    const all = sections.flatMap((section) => checklists[section.kind]);
    const done = all.filter((item) => item.done).length;
    return { done, total: all.length, percent: all.length ? Math.round((done / all.length) * 100) : 0 };
  }, [checklists]);

  const submitItem = (event: FormEvent, kind: (typeof sections)[number]['kind']) => {
    event.preventDefault();
    const text = drafts[kind].trim();
    if (!text) return;
    onAdd(kind, text);
    setDrafts((current) => ({ ...current, [kind]: '' }));
  };

  return (
    <>
      <header className="mb-5">
        <p className="template-kicker mb-3">出發前一起完成</p>
        <h1 className="display-heading">準備</h1>
        <p className="mt-1 text-sm font-semibold text-muted">待辦與購物清單</p>
      </header>

      <section className="island-hero mb-5 bg-earth-300 p-5" aria-label="準備進度">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-earth-700">整體完成度</p>
            <p className="mt-1 text-3xl font-black text-forest-800">{progress.percent}%</p>
          </div>
          <p className="rounded-full bg-forest-700 px-3 py-1.5 text-sm font-black text-white">
            {progress.done} / {progress.total}
          </p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-paper/70">
          <div
            className="h-full rounded-full bg-forest-600 transition-[width] duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {sections.map((section) => {
          const items = checklists[section.kind];
          const completed = items.filter((item) => item.done).length;
          return (
            <section key={section.kind} className="app-card flex flex-col" aria-labelledby={`${section.kind}-heading`}>
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-dashed border-line pb-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white ${section.accent}`}>
                    <FontAwesomeIcon icon={section.icon} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id={`${section.kind}-heading`} className="font-black text-forest-800">{section.title}</h2>
                    <p className="text-xs font-semibold text-muted">完成 {completed} / {items.length}</p>
                  </div>
                </div>
              </div>

              <ul className="mb-4 flex-1 space-y-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <label className={`flex min-h-12 items-center gap-3 rounded-2xl p-3 ${readOnly ? 'cursor-default' : 'tap-feedback cursor-pointer'} ${item.done ? section.pale : 'bg-canvas hover:bg-forest-50'}`}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        disabled={readOnly}
                        onChange={() => onToggle(section.kind, item.id)}
                        className="peer sr-only"
                      />
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${item.done ? `${section.accent} border-transparent text-white` : 'border-earth-300 bg-paper text-transparent'}`}>
                        <FontAwesomeIcon icon={faCheck} className="text-xs" aria-hidden="true" />
                      </span>
                      <span className={`font-bold leading-6 ${item.done ? 'text-muted line-through decoration-2' : 'text-ink'}`}>
                        {item.text}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              {!readOnly && (
                <form onSubmit={(event) => submitItem(event, section.kind)} className="flex gap-2">
                  <label className="sr-only" htmlFor={`${section.kind}-input`}>{section.placeholder}</label>
                  <input
                    id={`${section.kind}-input`}
                    value={drafts[section.kind]}
                    onChange={(event) => setDrafts((current) => ({ ...current, [section.kind]: event.target.value }))}
                    className="min-h-11 min-w-0 flex-1 rounded-2xl border-2 border-white bg-canvas px-3 text-sm font-semibold outline-none shadow-[inset_0_2px_0_rgba(215,201,173,0.5)] focus:border-forest-300 focus:ring-4 focus:ring-forest-100"
                    placeholder={section.placeholder}
                  />
                  <button
                    type="submit"
                    className={`tap-feedback flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${section.accent}`}
                    aria-label={`加入${section.title}`}
                  >
                    <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                  </button>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
