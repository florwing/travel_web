import { defaultTravelState } from '../data/defaultState';
import type { AccommodationBooking, FlightBooking, TravelState } from '../types';

export const STORAGE_KEY = 'group-trip-planner:v1';
export const MAX_VOUCHER_BYTES = 900 * 1024;
export const MAX_VOUCHER_TOTAL_BYTES = 2 * 1024 * 1024;
export const MAX_PHOTO_SOURCE_BYTES = 15 * 1024 * 1024;
export const MAX_STORED_STATE_CHARACTERS = 4_200_000;
const MAX_COMPRESSED_PHOTO_CHARACTERS = 420_000;

type LegacyFlightBooking = Partial<FlightBooking> & {
  date?: string;
  boardingTime?: string;
  departureTime?: string;
  seat?: string;
};

type LegacyAccommodationBooking = Partial<AccommodationBooking> & {
  people?: number;
};

function dateOnly(value: unknown, fallback: string) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : fallback;
}

export function loadTravelState(): TravelState {
  if (typeof window === 'undefined') return defaultTravelState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultTravelState;
    return normalizeTravelState(JSON.parse(raw));
  } catch {
    return defaultTravelState;
  }
}

export function normalizeTravelState(value: unknown): TravelState {
  if (!value || typeof value !== 'object') return defaultTravelState;
  const parsed = value as Partial<TravelState>;
  if (parsed.version !== 1) return defaultTravelState;

  const storedFlight = parsed.flight as LegacyFlightBooking | undefined;
  const storedAccommodation = parsed.accommodation as LegacyAccommodationBooking | undefined;
  const legacyOutboundAt = storedFlight?.date
    ? `${storedFlight.date}T${storedFlight.departureTime ?? storedFlight.boardingTime ?? '09:00'}`
    : undefined;

  return {
    ...defaultTravelState,
    ...parsed,
    trip: { ...defaultTravelState.trip, ...parsed.trip },
    flight: {
      airline: storedFlight?.airline ?? defaultTravelState.flight.airline,
      flightNo: storedFlight?.flightNo ?? defaultTravelState.flight.flightNo,
      fromCode: storedFlight?.fromCode ?? defaultTravelState.flight.fromCode,
      fromCity: storedFlight?.fromCity ?? defaultTravelState.flight.fromCity,
      toCode: storedFlight?.toCode ?? defaultTravelState.flight.toCode,
      toCity: storedFlight?.toCity ?? defaultTravelState.flight.toCity,
      outboundAt: storedFlight?.outboundAt
        ?? legacyOutboundAt
        ?? defaultTravelState.flight.outboundAt,
      returnAt: storedFlight?.returnAt ?? defaultTravelState.flight.returnAt,
      gate: storedFlight?.gate ?? defaultTravelState.flight.gate,
    },
    accommodation: {
      name: storedAccommodation?.name ?? defaultTravelState.accommodation.name,
      checkIn: dateOnly(storedAccommodation?.checkIn, defaultTravelState.accommodation.checkIn),
      checkOut: dateOnly(storedAccommodation?.checkOut, defaultTravelState.accommodation.checkOut),
      address: storedAccommodation?.address ?? defaultTravelState.accommodation.address,
      totalHkd: storedAccommodation?.totalHkd ?? defaultTravelState.accommodation.totalHkd,
    },
    carRental: { ...defaultTravelState.carRental, ...parsed.carRental },
    itinerary: Array.isArray(parsed.itinerary) ? parsed.itinerary : defaultTravelState.itinerary,
    weather: Array.isArray(parsed.weather) ? parsed.weather : defaultTravelState.weather,
    vouchers: Array.isArray(parsed.vouchers) ? parsed.vouchers : [],
    photos: Array.isArray(parsed.photos) ? parsed.photos : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : defaultTravelState.expenses,
    exchangeRates: { ...defaultTravelState.exchangeRates, ...parsed.exchangeRates },
    checklists: {
      todo: Array.isArray(parsed.checklists?.todo)
        ? parsed.checklists.todo
        : defaultTravelState.checklists.todo,
      packing: Array.isArray(parsed.checklists?.packing)
        ? parsed.checklists.packing
        : defaultTravelState.checklists.packing,
      shopping: Array.isArray(parsed.checklists?.shopping)
        ? parsed.checklists.shopping
        : defaultTravelState.checklists.shopping,
    },
  };
}

export function saveTravelState(state: TravelState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('無法讀取檔案'));
    reader.readAsDataURL(file);
  });
}

export function stateFitsStorageBudget(state: TravelState) {
  return JSON.stringify(state).length <= MAX_STORED_STATE_CHARACTERS;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('無法開啟相片'));
    image.src = url;
  });
}

export async function compressPhoto(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const initialScale = Math.min(1, 1600 / largestSide);
    let finalDataUrl = '';
    let finalWidth = 0;
    let finalHeight = 0;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const scale = initialScale * (0.86 ** attempt);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('無法處理相片');
      context.drawImage(image, 0, 0, width, height);

      finalDataUrl = canvas.toDataURL('image/webp', Math.max(0.52, 0.82 - attempt * 0.06));
      finalWidth = width;
      finalHeight = height;
      if (finalDataUrl.length <= MAX_COMPRESSED_PHOTO_CHARACTERS) break;
    }

    if (!finalDataUrl) throw new Error('無法處理相片');
    const mimeType = finalDataUrl.slice(5, finalDataUrl.indexOf(';')) || 'image/webp';
    const base64Length = finalDataUrl.split(',')[1]?.length ?? 0;

    return {
      dataUrl: finalDataUrl,
      mimeType,
      size: Math.ceil(base64Length * 0.75),
      width: finalWidth,
      height: finalHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
