import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBus,
  faCalendarDays,
  faChevronRight,
  faCloud,
  faCloudRain,
  faFloppyDisk,
  faHotel,
  faLocationDot,
  faMapLocationDot,
  faPen,
  faPersonWalking,
  faPlus,
  faSun,
  faUtensils,
} from '@fortawesome/free-solid-svg-icons';
import { Dialog } from '../components/Dialog';
import type {
  ItineraryCategory,
  ItineraryItem,
  TravelState,
  WeatherKind,
} from '../types';

interface SchedulePageProps {
  state: TravelState;
  onUpdate: (patch: Partial<Pick<TravelState, 'trip' | 'itinerary' | 'weather'>>) => void;
  readOnly?: boolean;
}

const categoryMeta: Record<ItineraryCategory, { label: string; color: string; icon: typeof faLocationDot }> = {
  sight: { label: '景點', color: 'bg-category-sight', icon: faLocationDot },
  food: { label: '美食', color: 'bg-category-food', icon: faUtensils },
  transport: { label: '交通', color: 'bg-category-transport', icon: faBus },
  hotel: { label: '住宿', color: 'bg-category-hotel', icon: faHotel },
};

const weatherIcons: Record<WeatherKind, typeof faSun> = {
  sunny: faSun,
  cloudy: faCloud,
  rainy: faCloudRain,
};

function getCountdown(startDate: string) {
  const departure = new Date(`${startDate}T00:00:00+08:00`).getTime();
  const diff = departure - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat('zh-HK', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T00:00:00`));
}

function getTripDates(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 31) {
    dates.push([
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, '0'),
      String(cursor.getDate()).padStart(2, '0'),
    ].join('-'));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function shiftDate(date: string, dayOffset: number) {
  const shifted = new Date(`${date}T00:00:00`);
  shifted.setDate(shifted.getDate() + dayOffset);
  return [
    shifted.getFullYear(),
    String(shifted.getMonth() + 1).padStart(2, '0'),
    String(shifted.getDate()).padStart(2, '0'),
  ].join('-');
}

function daysBetween(fromDate: string, toDate: string) {
  return Math.round(
    (new Date(`${toDate}T00:00:00`).getTime() - new Date(`${fromDate}T00:00:00`).getTime())
      / 86_400_000,
  );
}

function formatTripRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.max(1, daysBetween(startDate, endDate) + 1);
  const formatter = new Intl.DateTimeFormat('zh-HK', { month: 'numeric', day: 'numeric' });
  return `${formatter.format(start)}－${formatter.format(end)} · ${days}日${Math.max(0, days - 1)}夜`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-forest-800">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'form-field';

export function SchedulePage({ state, onUpdate, readOnly = false }: SchedulePageProps) {
  const [selectedDate, setSelectedDate] = useState(state.trip.startDate);
  const [detailItem, setDetailItem] = useState<ItineraryItem | null>(null);
  const [dateEditorOpen, setDateEditorOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState({
    startDate: state.trip.startDate,
    endDate: state.trip.endDate,
  });
  const [dateError, setDateError] = useState('');
  const [itineraryDraft, setItineraryDraft] = useState<ItineraryItem | null>(null);
  const [itineraryMode, setItineraryMode] = useState<'create' | 'edit'>('edit');
  const [itineraryError, setItineraryError] = useState('');

  const tripDates = useMemo(
    () => getTripDates(state.trip.startDate, state.trip.endDate),
    [state.trip.endDate, state.trip.startDate],
  );

  const items = useMemo(
    () => state.itinerary
      .filter((item) => item.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time)),
    [selectedDate, state.itinerary],
  );
  const weather = state.weather.find((item) => item.date === selectedDate);
  const dayNumber = Math.max(1, tripDates.indexOf(selectedDate) + 1);
  const countdown = getCountdown(state.trip.startDate);

  const openDateEditor = () => {
    setDateDraft({ startDate: state.trip.startDate, endDate: state.trip.endDate });
    setDateError('');
    setDateEditorOpen(true);
  };

  const saveTripDates = (event: React.FormEvent) => {
    event.preventDefault();
    const nextDates = getTripDates(dateDraft.startDate, dateDraft.endDate);
    if (!nextDates.length) {
      setDateError('結束日期必須等於或遲過開始日期。');
      return;
    }
    if (daysBetween(dateDraft.startDate, dateDraft.endDate) >= 31) {
      setDateError('旅程日期最多可設定 31 日。');
      return;
    }

    const offset = daysBetween(state.trip.startDate, dateDraft.startDate);
    const nextItinerary = state.itinerary.map((item) => ({
      ...item,
      date: shiftDate(item.date, offset),
    }));
    const outsideRange = nextItinerary.some(
      (item) => item.date < dateDraft.startDate || item.date > dateDraft.endDate,
    );
    if (outsideRange) {
      setDateError('新日期範圍未能包含全部現有行程，請延後結束日期。');
      return;
    }

    onUpdate({
      trip: {
        ...state.trip,
        startDate: dateDraft.startDate,
        endDate: dateDraft.endDate,
      },
      itinerary: nextItinerary,
      weather: state.weather.map((item) => ({
        ...item,
        date: shiftDate(item.date, offset),
      })),
    });
    setSelectedDate(dateDraft.startDate);
    setDateEditorOpen(false);
  };

  const openItineraryEditor = (item: ItineraryItem) => {
    setItineraryMode('edit');
    setItineraryDraft({ ...item });
    setItineraryError('');
    setDetailItem(null);
  };

  const openNewItinerary = () => {
    setItineraryMode('create');
    setItineraryDraft({
      id: crypto.randomUUID(),
      date: selectedDate,
      time: '09:00',
      title: '',
      location: '',
      category: 'sight',
      note: '',
      mapUrl: '',
    });
    setItineraryError('');
  };

  const saveItinerary = (event: React.FormEvent) => {
    event.preventDefault();
    if (!itineraryDraft) return;
    if (!itineraryDraft.title.trim() || !itineraryDraft.location.trim()) {
      setItineraryError('請填寫行程名稱及地點。');
      return;
    }
    if (
      itineraryDraft.date < state.trip.startDate
      || itineraryDraft.date > state.trip.endDate
    ) {
      setItineraryError('行程日期必須在旅程日期範圍內。');
      return;
    }

    const cleanedItem = {
      ...itineraryDraft,
      title: itineraryDraft.title.trim(),
      location: itineraryDraft.location.trim(),
      note: itineraryDraft.note.trim(),
      mapUrl: itineraryDraft.mapUrl.trim(),
    };
    onUpdate({
      itinerary: itineraryMode === 'create'
        ? [...state.itinerary, cleanedItem]
        : state.itinerary.map((item) =>
          item.id === cleanedItem.id ? cleanedItem : item,
        ),
    });
    setSelectedDate(cleanedItem.date);
    setItineraryDraft(null);
  };

  return (
    <>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="template-kicker mb-3">行程總覽</p>
          <h1 className="display-heading">
            {state.trip.title}
          </h1>
          <p className="mt-1 text-sm font-semibold text-muted">
            {formatTripRange(state.trip.startDate, state.trip.endDate)}
          </p>
        </div>
        <div className="island-action-bubble">
          <FontAwesomeIcon icon={faMapLocationDot} aria-hidden="true" />
        </div>
      </header>

      <section className="mb-5 grid grid-cols-[1.15fr_0.85fr] gap-3" aria-label="旅程摘要">
        <article className="island-hero relative overflow-hidden bg-forest-700 p-5 text-white">
          <span className="absolute -right-5 -top-5 h-20 w-20 rounded-full border-[12px] border-earth-300/90" aria-hidden="true" />
          <p className="text-sm font-bold text-forest-100">{countdown > 0 ? '距離出發' : '旅程狀態'}</p>
          {countdown > 0 ? (
            <div className="mt-2 flex items-end gap-2">
              <strong className="text-4xl font-black leading-none">{countdown}</strong>
              <span className="pb-0.5 text-base font-bold">天</span>
            </div>
          ) : (
            <strong className="mt-2 block text-2xl font-black">旅程已開始</strong>
          )}
          <p className="mt-3 truncate text-xs font-semibold text-forest-100">
            {state.trip.destinations.join(' · ')}
          </p>
        </article>

        <article className="app-card flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-muted">{state.trip.destinations[0]}</p>
              <p className="mt-1 text-2xl font-black">{weather?.high ?? '--'}°</p>
            </div>
            {weather && (
              <FontAwesomeIcon
                icon={weatherIcons[weather.kind]}
                className={`text-3xl ${weather.kind === 'rainy' ? 'text-category-transport' : 'text-earth-500'}`}
                aria-hidden="true"
              />
            )}
          </div>
          <p className="mt-4 text-sm font-bold text-forest-700">
            {weather?.condition ?? '天氣待更新'}
            {weather && <span className="ml-1 text-xs text-muted">{weather.low}°–{weather.high}°</span>}
          </p>
        </article>
      </section>

      <section aria-labelledby="schedule-date-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="schedule-date-heading" className="text-lg font-black text-forest-800">每日行程</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-earth-300 px-3 py-1 text-xs font-black text-forest-800">
              第 {dayNumber} 天
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={openDateEditor}
                className="tap-feedback flex h-10 w-10 items-center justify-center gap-2 rounded-full bg-forest-700 text-xs font-black text-white hover:bg-forest-800 min-[380px]:w-auto min-[380px]:px-3"
                aria-label="編輯旅程日期"
              >
                <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" />
                <span className="hidden min-[380px]:inline">編輯日期</span>
              </button>
            )}
          </div>
        </div>

        <div className="scrollbar-none -mx-4 mb-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          {tripDates.map((date) => {
            const parsed = new Date(`${date}T00:00:00`);
            const active = selectedDate === date;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                aria-pressed={active}
                aria-label={displayDate(date)}
                className={`tap-feedback min-w-[4.15rem] snap-start rounded-2xl border-2 px-3 py-3 text-center ${
                    active
                      ? 'border-earth-300 bg-earth-300 text-forest-800 shadow-soft-sm'
                    : 'border-line bg-paper text-ink hover:bg-forest-50'
                }`}
              >
                  <span className={`block text-xs font-bold ${active ? 'text-forest-700' : 'text-muted'}`}>
                  {new Intl.DateTimeFormat('zh-HK', { weekday: 'short' }).format(parsed)}
                </span>
                <span className="mt-1 block text-xl font-black">{parsed.getDate()}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="app-card" aria-label={`${displayDate(selectedDate)}行程`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-line pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-forest-600">{displayDate(selectedDate)}</p>
            <h2 className="mt-1 truncate text-xl font-black text-forest-800">
              {items[0]?.location ?? '自由活動日'}
            </h2>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {!readOnly && (
              <button
                type="button"
                onClick={openNewItinerary}
                className="tap-feedback flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-earth-100 px-3 text-xs font-black text-earth-700 hover:bg-earth-300/40"
              >
                <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                新增
              </button>
            )}
            <div className="rounded-2xl bg-earth-100 px-3 py-2 text-center text-earth-700">
              <FontAwesomeIcon icon={faPersonWalking} className="mr-1" aria-hidden="true" />
              <strong className="text-sm">輕鬆走</strong>
            </div>
          </div>
        </div>

        {items.length ? (
          <ol className="space-y-1">
            {items.map((item, index) => {
              const meta = categoryMeta[item.category];
              return (
                <li key={item.id} className="grid grid-cols-[2.75rem_0.75rem_minmax(0,1fr)] gap-2 sm:grid-cols-[3.4rem_1rem_minmax(0,1fr)] sm:gap-3">
                  <time className="pt-3 text-sm font-black text-forest-800">{item.time}</time>
                  <div className="flex flex-col items-center">
                    <span className={`mt-4 h-3 w-3 shrink-0 rounded-full ring-4 ring-white ${meta.color}`} />
                    {index < items.length - 1 && <span className="h-full min-h-16 w-px bg-line" />}
                  </div>
                  <div className="mb-3 flex min-w-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailItem(item)}
                      className="tap-feedback flex min-h-16 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-canvas/80 p-2 text-left hover:bg-forest-50 sm:gap-3 sm:p-3"
                    >
                      <span className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex ${meta.color} text-white`}>
                        <FontAwesomeIcon icon={meta.icon} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-base text-ink">{item.title}</strong>
                        <span className="mt-0.5 block truncate text-sm font-semibold text-muted">
                          {item.location}
                        </span>
                      </span>
                      <FontAwesomeIcon icon={faChevronRight} className="hidden text-xs text-muted sm:inline" aria-hidden="true" />
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => openItineraryEditor(item)}
                        className="tap-feedback flex w-10 shrink-0 items-center justify-center rounded-2xl bg-earth-100 text-earth-700 hover:bg-earth-300/40 sm:w-12"
                        aria-label={`編輯 ${item.title}`}
                      >
                        <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="rounded-2xl bg-canvas p-6 text-center">
            <p className="font-bold text-forest-800">這天暫未有固定行程</p>
            <p className="mt-1 text-sm text-muted">可以留作購物、休息或臨時安排。</p>
            {!readOnly && (
              <button
                type="button"
                onClick={openNewItinerary}
                className="tap-feedback mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-forest-700 px-4 text-sm font-black text-white hover:bg-forest-800"
              >
                <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                新增第一項行程
              </button>
            )}
          </div>
        )}
      </section>

      <Dialog open={Boolean(detailItem)} title={detailItem?.title ?? '行程詳情'} onClose={() => setDetailItem(null)}>
        {detailItem && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-sm font-bold text-white ${categoryMeta[detailItem.category].color}`}>
                {categoryMeta[detailItem.category].label}
              </span>
              <time className="rounded-full bg-canvas px-3 py-1 text-sm font-bold text-forest-700">
                {displayDate(detailItem.date)} · {detailItem.time}
              </time>
            </div>
            <div className="rounded-2xl bg-canvas p-4">
              <p className="text-sm font-bold text-muted">地點</p>
              <p className="mt-1 font-bold text-ink">{detailItem.location}</p>
            </div>
            <div className="rounded-2xl border border-line p-4">
              <p className="text-sm font-bold text-muted">備註</p>
              <p className="mt-2 leading-7 text-ink">{detailItem.note}</p>
            </div>
            {detailItem.mapUrl && (
              <a
                href={detailItem.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="tap-feedback flex min-h-12 items-center justify-center rounded-2xl bg-forest-700 px-4 font-black text-white hover:bg-forest-800"
              >
                <FontAwesomeIcon icon={faMapLocationDot} className="mr-2" aria-hidden="true" />
                開啟地圖
              </a>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => openItineraryEditor(detailItem)}
                className="tap-feedback flex min-h-12 w-full items-center justify-center rounded-2xl bg-earth-100 px-4 font-black text-earth-700 hover:bg-earth-300/40"
              >
                <FontAwesomeIcon icon={faPen} className="mr-2" aria-hidden="true" />
                編輯這項行程
              </button>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={dateEditorOpen} title="編輯旅程日期" onClose={() => setDateEditorOpen(false)}>
        <form onSubmit={saveTripDates} className="space-y-4">
          <div className="rounded-2xl bg-earth-50 p-4 text-sm font-semibold leading-6 text-earth-700">
            修改開始日期後，現有天氣及每日行程會按相同日數一併移動。
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="開始日期">
              <input
                type="date"
                value={dateDraft.startDate}
                onChange={(event) => {
                  setDateDraft((current) => ({ ...current, startDate: event.target.value }));
                  setDateError('');
                }}
                className={inputClass}
                required
              />
            </Field>
            <Field label="結束日期">
              <input
                type="date"
                min={dateDraft.startDate}
                value={dateDraft.endDate}
                onChange={(event) => {
                  setDateDraft((current) => ({ ...current, endDate: event.target.value }));
                  setDateError('');
                }}
                className={inputClass}
                required
              />
            </Field>
          </div>
          {dateError && <p className="text-sm font-bold text-clay-700" role="alert">{dateError}</p>}
          <div className="flex gap-3 border-t border-line pt-4">
            <button type="button" onClick={() => setDateEditorOpen(false)} className="tap-feedback min-h-12 flex-1 rounded-2xl bg-canvas px-4 font-black text-muted">
              取消
            </button>
            <button type="submit" className="tap-feedback min-h-12 flex-1 rounded-2xl bg-forest-700 px-4 font-black text-white hover:bg-forest-800">
              <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" aria-hidden="true" />
              儲存日期
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(itineraryDraft)}
        title={itineraryMode === 'create' ? '新增每日行程' : '編輯每日行程'}
        onClose={() => setItineraryDraft(null)}
      >
        {itineraryDraft && (
          <form onSubmit={saveItinerary} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="日期">
                <input
                  type="date"
                  min={state.trip.startDate}
                  max={state.trip.endDate}
                  value={itineraryDraft.date}
                  onChange={(event) => {
                    setItineraryDraft({ ...itineraryDraft, date: event.target.value });
                    setItineraryError('');
                  }}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="時間">
                <input
                  type="time"
                  value={itineraryDraft.time}
                  onChange={(event) => setItineraryDraft({ ...itineraryDraft, time: event.target.value })}
                  className={inputClass}
                  required
                />
              </Field>
            </div>
            <Field label="行程名稱">
              <input
                value={itineraryDraft.title}
                onChange={(event) => setItineraryDraft({ ...itineraryDraft, title: event.target.value })}
                className={inputClass}
                maxLength={80}
                required
              />
            </Field>
            <Field label="地點">
              <input
                value={itineraryDraft.location}
                onChange={(event) => setItineraryDraft({ ...itineraryDraft, location: event.target.value })}
                className={inputClass}
                maxLength={100}
                required
              />
            </Field>
            <Field label="類別">
              <select
                value={itineraryDraft.category}
                onChange={(event) => setItineraryDraft({
                  ...itineraryDraft,
                  category: event.target.value as ItineraryCategory,
                })}
                className={inputClass}
              >
                {Object.entries(categoryMeta).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </Field>
            <Field label="地圖連結">
              <input
                type="url"
                value={itineraryDraft.mapUrl}
                onChange={(event) => setItineraryDraft({ ...itineraryDraft, mapUrl: event.target.value })}
                className={inputClass}
                placeholder="https://maps.google.com/..."
              />
            </Field>
            <Field label="備註">
              <textarea
                value={itineraryDraft.note}
                onChange={(event) => setItineraryDraft({ ...itineraryDraft, note: event.target.value })}
                className={`${inputClass} min-h-28 py-3`}
                maxLength={500}
              />
            </Field>
            {itineraryError && <p className="text-sm font-bold text-clay-700" role="alert">{itineraryError}</p>}
            <div className="flex gap-3 border-t border-line pt-4">
              <button type="button" onClick={() => setItineraryDraft(null)} className="tap-feedback min-h-12 flex-1 rounded-2xl bg-canvas px-4 font-black text-muted">
                取消
              </button>
              <button type="submit" className="tap-feedback min-h-12 flex-1 rounded-2xl bg-forest-700 px-4 font-black text-white hover:bg-forest-800">
                <FontAwesomeIcon icon={itineraryMode === 'create' ? faPlus : faFloppyDisk} className="mr-2" aria-hidden="true" />
                {itineraryMode === 'create' ? '新增行程' : '儲存行程'}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
