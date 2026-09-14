import { useState, type ChangeEvent, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBed,
  faCalendarCheck,
  faCar,
  faDownload,
  faFileArrowUp,
  faFileImage,
  faFilePdf,
  faLocationDot,
  faPen,
  faPlane,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { Dialog } from '../components/Dialog';
import {
  fileToDataUrl,
  MAX_VOUCHER_BYTES,
  MAX_VOUCHER_TOTAL_BYTES,
} from '../lib/storage';
import type {
  AccommodationBooking,
  CarRentalBooking,
  FlightBooking,
  TravelState,
  Voucher,
} from '../types';

type BookingPatch = Partial<
  Pick<TravelState, 'flight' | 'accommodation' | 'carRental' | 'vouchers'>
>;

interface BookingsPageProps {
  state: TravelState;
  onUpdate: (patch: BookingPatch) => void;
  readOnly?: boolean;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-HK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-HK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function getNightCount(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T00:00:00`).getTime();
  const end = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / 86_400_000);
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

export function BookingsPage({ state, onUpdate, readOnly = false }: BookingsPageProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [flightDraft, setFlightDraft] = useState<FlightBooking>(state.flight);
  const [hotelDraft, setHotelDraft] = useState<AccommodationBooking>(state.accommodation);
  const [carDraft, setCarDraft] = useState<CarRentalBooking>(state.carRental);

  const openEditor = () => {
    setFlightDraft(state.flight);
    setHotelDraft(state.accommodation);
    setCarDraft(state.carRental);
    setEditError('');
    setEditOpen(true);
  };

  const saveBookingEdits = (event: FormEvent) => {
    event.preventDefault();
    if (new Date(flightDraft.returnAt) <= new Date(flightDraft.outboundAt)) {
      setEditError('回程日期及時間必須遲過去程。');
      return;
    }
    if (getNightCount(hotelDraft.checkIn, hotelDraft.checkOut) < 1) {
      setEditError('離開日期必須遲過入住日期。');
      return;
    }
    if (new Date(carDraft.returnAt) <= new Date(carDraft.pickupAt)) {
      setEditError('還車日期及時間必須遲過取車。');
      return;
    }
    onUpdate({ flight: flightDraft, accommodation: hotelDraft, carRental: carDraft });
    setEditError('');
    setEditOpen(false);
  };

  const handleVoucherUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setUploadMessage('');
    if (!files.length) return;
    if (state.vouchers.length + files.length > 6) {
      setUploadMessage('最多可儲存 6 份憑證，請先刪除不需要的檔案。');
      return;
    }
    const totalBytes = state.vouchers.reduce((sum, item) => sum + item.size, 0)
      + files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_VOUCHER_TOTAL_BYTES) {
      setUploadMessage('所有憑證合計不可超過 2 MB，請先壓縮或刪除部分檔案。');
      return;
    }

    try {
      const additions: Voucher[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
          throw new Error('只支援圖片或 PDF 檔案。');
        }
        if (file.size > MAX_VOUCHER_BYTES) {
          throw new Error(`${file.name} 超過 900 KB，請先壓縮檔案。`);
        }
        additions.push({
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type,
          size: file.size,
          createdAt: new Date().toISOString(),
          dataUrl: await fileToDataUrl(file),
        });
      }
      onUpdate({ vouchers: [...state.vouchers, ...additions] });
      setUploadMessage(`已加入 ${additions.length} 份憑證。`);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : '檔案讀取失敗。');
    }
  };

  const nightCount = getNightCount(state.accommodation.checkIn, state.accommodation.checkOut);

  return (
    <>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="template-kicker mb-3">確認資料</p>
          <h1 className="display-heading">預訂</h1>
          <p className="mt-1 text-sm font-semibold text-muted">機票、住宿、租車與憑證</p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={openEditor}
            className="tap-feedback flex min-h-12 items-center gap-2 rounded-2xl bg-forest-700 px-4 text-sm font-black text-white shadow-soft-sm hover:bg-forest-800"
          >
            <FontAwesomeIcon icon={faPen} aria-hidden="true" />
            編輯
          </button>
        )}
      </header>

      <div className="space-y-5">
        <section aria-labelledby="flight-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="flight-heading" className="text-lg font-black text-forest-800">機票</h2>
            <span className="rounded-full bg-earth-300 px-3 py-1 text-xs font-black text-forest-800">
              已確認
            </span>
          </div>
          <article className="island-hero overflow-hidden bg-forest-700 text-white">
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-forest-300 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
                  <FontAwesomeIcon icon={faPlane} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-forest-100">{state.flight.airline}</p>
                  <p className="text-lg font-black">{state.flight.flightNo}</p>
                </div>
              </div>
              <p className="text-right text-xs font-bold text-forest-100">
                閘口 {state.flight.gate}
              </p>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-5">
              <div>
                <p className="text-3xl font-black tracking-wide">{state.flight.fromCode}</p>
                <p className="text-sm font-bold text-forest-100">{state.flight.fromCity}</p>
              </div>
              <div className="flex items-center gap-2 text-forest-100" aria-hidden="true">
                <span className="h-px w-5 bg-forest-300" />
                <FontAwesomeIcon icon={faPlane} className="text-xs" />
                <span className="h-px w-5 bg-forest-300" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-black tracking-wide">{state.flight.toCode}</p>
                <p className="text-sm font-bold text-forest-100">{state.flight.toCity}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-forest-300/30 bg-forest-800/55 px-4 py-4">
              {[
                ['去程', `${state.flight.fromCode} → ${state.flight.toCode}`, state.flight.outboundAt],
                ['回程', `${state.flight.toCode} → ${state.flight.fromCode}`, state.flight.returnAt],
              ].map(([label, route, value], index) => (
                <div key={label} className={index === 0 ? 'pr-4' : 'pl-4'}>
                  <p className="text-xs font-bold text-forest-100">{label}</p>
                  <p className="mt-1 text-sm font-black">{route}</p>
                  <p className="mt-1 text-xs font-semibold text-forest-100">{formatDateTime(value)}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section aria-labelledby="hotel-heading">
          <h2 id="hotel-heading" className="mb-3 text-lg font-black text-forest-800">住宿</h2>
          <article className="app-card">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-earth-700">{nightCount} 晚住宿</p>
                  <h3 className="mt-1 text-xl font-black text-forest-800">{state.accommodation.name}</h3>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-earth-100 text-earth-700">
                  <FontAwesomeIcon icon={faBed} aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-canvas p-4">
                <div>
                  <p className="text-xs font-bold text-muted">Check-in</p>
                  <p className="mt-1 text-sm font-black">{formatDate(state.accommodation.checkIn)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted">Check-out</p>
                  <p className="mt-1 text-sm font-black">{formatDate(state.accommodation.checkOut)}</p>
                </div>
              </div>
              <p className="mt-4 flex items-start gap-2 text-sm font-semibold leading-6 text-muted">
                <FontAwesomeIcon icon={faLocationDot} className="mt-1 text-forest-600" aria-hidden="true" />
                {state.accommodation.address}
              </p>
              <div className="mt-4 border-t border-dashed border-line pt-4">
                <div>
                  <p className="text-xs font-bold text-muted">住宿總額</p>
                  <p className="mt-1 text-xl font-black text-forest-800">
                    HKD {state.accommodation.totalHkd.toLocaleString('zh-HK')}
                  </p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section aria-labelledby="car-heading">
          <h2 id="car-heading" className="mb-3 text-lg font-black text-forest-800">租車</h2>
          <article className="app-card">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-category-transport text-white">
                <FontAwesomeIcon icon={faCar} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold text-muted">租車公司</p>
                <h3 className="font-black text-forest-800">{state.carRental.company}</h3>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-forest-50 p-4">
                <p className="text-xs font-bold text-forest-600">取車</p>
                <p className="mt-1 font-black">{formatDateTime(state.carRental.pickupAt)}</p>
                <p className="mt-1 text-sm font-semibold text-muted">{state.carRental.pickupLocation}</p>
              </div>
              <div className="rounded-2xl bg-earth-100 p-4">
                <p className="text-xs font-bold text-earth-700">還車</p>
                <p className="mt-1 font-black">{formatDateTime(state.carRental.returnAt)}</p>
                <p className="mt-1 text-sm font-semibold text-muted">{state.carRental.returnLocation}</p>
              </div>
            </div>
          </article>
        </section>

        <section aria-labelledby="voucher-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="voucher-heading" className="text-lg font-black text-forest-800">票券與憑證</h2>
              <p className="mt-0.5 text-xs font-semibold text-muted">最多 6 份；單份 900 KB，合計 2 MB</p>
            </div>
            {!readOnly && (
              <label className="tap-feedback flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-earth-100 px-3 text-sm font-black text-earth-700 hover:bg-earth-300/40">
                <FontAwesomeIcon icon={faFileArrowUp} aria-hidden="true" />
                上傳
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="sr-only"
                  onChange={handleVoucherUpload}
                />
              </label>
            )}
          </div>

          <div className="app-card space-y-3">
            {uploadMessage && (
              <p className="rounded-2xl bg-earth-50 p-3 text-sm font-bold text-earth-700" role="status">
                {uploadMessage}
              </p>
            )}
            {state.vouchers.length ? (
              <ul className="space-y-2">
                {state.vouchers.map((voucher) => (
                  <li key={voucher.id} className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper text-earth-700 shadow-soft-sm">
                      <FontAwesomeIcon
                        icon={voucher.mimeType === 'application/pdf' ? faFilePdf : faFileImage}
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-ink">{voucher.name}</p>
                      <p className="text-xs font-semibold text-muted">{Math.ceil(voucher.size / 1024)} KB</p>
                    </div>
                    <a
                      href={voucher.dataUrl}
                      download={voucher.name}
                      className="tap-feedback flex h-10 w-10 items-center justify-center rounded-xl text-forest-700 hover:bg-forest-100"
                      aria-label={`下載 ${voucher.name}`}
                    >
                      <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
                    </a>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onUpdate({ vouchers: state.vouchers.filter((item) => item.id !== voucher.id) })}
                        className="tap-feedback flex h-10 w-10 items-center justify-center rounded-xl text-clay-700 hover:bg-clay-100"
                        aria-label={`刪除 ${voucher.name}`}
                      >
                        <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-5 text-center">
                <FontAwesomeIcon icon={faCalendarCheck} className="text-3xl text-earth-300" aria-hidden="true" />
                <p className="mt-3 font-black text-forest-800">尚未加入憑證</p>
                <p className="mt-1 text-sm font-semibold text-muted">可儲存電子機票、確認信或門票圖片。</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={editOpen} title="編輯預訂資料" onClose={() => setEditOpen(false)}>
        <form onSubmit={saveBookingEdits} className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="mb-3 font-black text-forest-800">
              <FontAwesomeIcon icon={faPlane} className="mr-2" aria-hidden="true" />機票
            </legend>
            <Field label="航班編號">
              <input value={flightDraft.flightNo} onChange={(event) => setFlightDraft({ ...flightDraft, flightNo: event.target.value })} className={inputClass} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="去程日期及時間">
                <input
                  type="datetime-local"
                  value={flightDraft.outboundAt}
                  onChange={(event) => {
                    setFlightDraft({ ...flightDraft, outboundAt: event.target.value });
                    setEditError('');
                  }}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="回程日期及時間">
                <input
                  type="datetime-local"
                  min={flightDraft.outboundAt}
                  value={flightDraft.returnAt}
                  onChange={(event) => {
                    setFlightDraft({ ...flightDraft, returnAt: event.target.value });
                    setEditError('');
                  }}
                  className={inputClass}
                  required
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-t border-line pt-5">
            <legend className="mb-3 font-black text-forest-800">
              <FontAwesomeIcon icon={faBed} className="mr-2" aria-hidden="true" />住宿
            </legend>
            <Field label="飯店名稱">
              <input value={hotelDraft.name} onChange={(event) => setHotelDraft({ ...hotelDraft, name: event.target.value })} className={inputClass} required />
            </Field>
            <Field label="地址">
              <input value={hotelDraft.address} onChange={(event) => setHotelDraft({ ...hotelDraft, address: event.target.value })} className={inputClass} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="入住日期">
                <input
                  type="date"
                  value={hotelDraft.checkIn}
                  onChange={(event) => {
                    setHotelDraft({ ...hotelDraft, checkIn: event.target.value });
                    setEditError('');
                  }}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="離開日期">
                <input
                  type="date"
                  min={hotelDraft.checkIn}
                  value={hotelDraft.checkOut}
                  onChange={(event) => {
                    setHotelDraft({ ...hotelDraft, checkOut: event.target.value });
                    setEditError('');
                  }}
                  className={inputClass}
                  required
                />
              </Field>
            </div>
            <p className="rounded-2xl bg-earth-50 px-4 py-3 text-sm font-bold text-earth-700">
              共住 {getNightCount(hotelDraft.checkIn, hotelDraft.checkOut)} 晚
            </p>
            <Field label="總額（HKD）">
              <input type="number" inputMode="decimal" min="0" value={hotelDraft.totalHkd} onChange={(event) => setHotelDraft({ ...hotelDraft, totalHkd: Number(event.target.value) })} className={inputClass} required />
            </Field>
          </fieldset>

          <fieldset className="space-y-3 border-t border-line pt-5">
            <legend className="mb-3 font-black text-forest-800">
              <FontAwesomeIcon icon={faCar} className="mr-2" aria-hidden="true" />租車
            </legend>
            <Field label="取車日期及時間">
              <input
                type="datetime-local"
                value={carDraft.pickupAt}
                onChange={(event) => {
                  setCarDraft({ ...carDraft, pickupAt: event.target.value });
                  setEditError('');
                }}
                className={inputClass}
                required
              />
            </Field>
            <Field label="取車地點">
              <input value={carDraft.pickupLocation} onChange={(event) => setCarDraft({ ...carDraft, pickupLocation: event.target.value })} className={inputClass} required />
            </Field>
            <Field label="還車日期及時間">
              <input
                type="datetime-local"
                min={carDraft.pickupAt}
                value={carDraft.returnAt}
                onChange={(event) => {
                  setCarDraft({ ...carDraft, returnAt: event.target.value });
                  setEditError('');
                }}
                className={inputClass}
                required
              />
            </Field>
            <Field label="還車地點">
              <input value={carDraft.returnLocation} onChange={(event) => setCarDraft({ ...carDraft, returnLocation: event.target.value })} className={inputClass} required />
            </Field>
          </fieldset>

          {editError && <p className="text-sm font-bold text-clay-700" role="alert">{editError}</p>}

          <div className="flex gap-3 border-t border-line pt-5">
            <button type="button" onClick={() => setEditOpen(false)} className="tap-feedback min-h-12 flex-1 rounded-2xl bg-canvas px-4 font-black text-muted">
              取消
            </button>
            <button type="submit" className="tap-feedback min-h-12 flex-1 rounded-2xl bg-forest-700 px-4 font-black text-white hover:bg-forest-800">
              儲存預訂
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
