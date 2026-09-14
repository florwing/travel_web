import type { Json } from './database.types';
import { normalizeTravelState } from './storage';
import { supabase } from './supabase';
import type { TravelState, TripPhoto, Voucher } from '../types';

export const TRAVEL_FILES_BUCKET = 'travel-files';

function dataUrlToBlob(dataUrl: string) {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('檔案內容格式無效。');
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

function extensionForMime(mimeType: string) {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  return extensions[mimeType] ?? 'bin';
}

async function uploadMedia(
  tripId: string,
  folder: 'photos' | 'vouchers',
  item: TripPhoto | Voucher,
) {
  if (item.storagePath) return item;
  if (!item.dataUrl.startsWith('data:')) throw new Error(`未能上傳「${item.name}」。`);

  const path = `${tripId}/${folder}/${item.id}.${extensionForMime(item.mimeType)}`;
  const { error } = await supabase.storage
    .from(TRAVEL_FILES_BUCKET)
    .upload(path, dataUrlToBlob(item.dataUrl), {
      contentType: item.mimeType,
      upsert: true,
    });
  if (error) throw error;
  return { ...item, storagePath: path };
}

export async function ensureMediaUploaded(state: TravelState, tripId: string): Promise<TravelState> {
  const [photos, vouchers] = await Promise.all([
    Promise.all(state.photos.map((photo) => uploadMedia(tripId, 'photos', photo) as Promise<TripPhoto>)),
    Promise.all(state.vouchers.map((voucher) => uploadMedia(tripId, 'vouchers', voucher) as Promise<Voucher>)),
  ]);
  return { ...state, photos, vouchers };
}

function withoutDataUrl(item: TripPhoto | Voucher) {
  const { dataUrl, ...metadata } = item;
  void dataUrl;
  return metadata;
}

export function serializeCloudState(state: TravelState): Json {
  return {
    ...state,
    photos: state.photos.map(withoutDataUrl),
    vouchers: state.vouchers.map(withoutDataUrl),
  } as unknown as Json;
}

export function serializeCloudSeed(state: TravelState): Json {
  return {
    ...state,
    photos: [],
    vouchers: [],
  } as unknown as Json;
}

async function hydrateMedia<T extends TripPhoto | Voucher>(item: T): Promise<T> {
  if (!item.storagePath) return { ...item, dataUrl: item.dataUrl ?? '' };
  const { data, error } = await supabase.storage
    .from(TRAVEL_FILES_BUCKET)
    .createSignedUrl(item.storagePath, 21_600);
  if (error) throw error;
  return { ...item, dataUrl: data.signedUrl };
}

export async function hydrateCloudState(value: unknown): Promise<TravelState> {
  const state = normalizeTravelState(value);
  const [photos, vouchers] = await Promise.all([
    Promise.all(state.photos.map(hydrateMedia)),
    Promise.all(state.vouchers.map(hydrateMedia)),
  ]);
  return { ...state, photos, vouchers };
}

export function mergeStoragePaths(current: TravelState, uploaded: TravelState): TravelState {
  const photoPaths = new Map(uploaded.photos.map((item) => [item.id, item.storagePath]));
  const voucherPaths = new Map(uploaded.vouchers.map((item) => [item.id, item.storagePath]));
  return {
    ...current,
    photos: current.photos.map((item) => ({
      ...item,
      storagePath: photoPaths.get(item.id) ?? item.storagePath,
    })),
    vouchers: current.vouchers.map((item) => ({
      ...item,
      storagePath: voucherPaths.get(item.id) ?? item.storagePath,
    })),
  };
}

export function friendlyCloudError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/invalid login credentials/i.test(message)) return '電郵或密碼不正確。';
  if (/email not confirmed/i.test(message)) return '請先開啟確認電郵，再返回登入。';
  if (/already registered|already been registered/i.test(message)) return '呢個電郵已經註冊，請直接登入。';
  if (/password/i.test(message) && /characters|short|length/i.test(message)) return '密碼最少需要 8 個字元。';
  if (/provider.*(not enabled|disabled)|unsupported provider/i.test(message)) {
    return 'Google 登入尚未啟用，請先喺 Supabase 開啟 Google provider。';
  }
  if (/duplicate key/i.test(message)) return '呢位家庭成員已經加入。';
  return fallback;
}
