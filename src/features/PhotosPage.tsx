import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpFromBracket,
  faChevronLeft,
  faChevronRight,
  faImage,
  faImages,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { Dialog } from '../components/Dialog';
import {
  MAX_PHOTO_SOURCE_BYTES,
  compressPhoto,
  stateFitsStorageBudget,
} from '../lib/storage';
import type { TravelState, TripPhoto } from '../types';

interface PhotosPageProps {
  state: TravelState;
  onUpdate: (photos: TripPhoto[]) => void;
  readOnly?: boolean;
}

function formatAddedDate(value: string) {
  return new Intl.DateTimeFormat('zh-HK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function PhotosPage({ state, onUpdate, readOnly = false }: PhotosPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<TripPhoto | null>(null);

  const selectedIndex = useMemo(
    () => state.photos.findIndex((photo) => photo.id === selectedId),
    [selectedId, state.photos],
  );
  const selectedPhoto = selectedIndex >= 0 ? state.photos[selectedIndex] : null;

  const showRelativePhoto = (offset: number) => {
    if (!state.photos.length || selectedIndex < 0) return;
    const nextIndex = (selectedIndex + offset + state.photos.length) % state.photos.length;
    setSelectedId(state.photos[nextIndex].id);
  };

  useEffect(() => {
    if (!selectedPhoto || state.photos.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') showRelativePhoto(-1);
      if (event.key === 'ArrowRight') showRelativePhoto(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const uploadPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    setUploading(true);
    setMessage('');
    let nextPhotos = [...state.photos];
    let added = 0;
    let skipped = 0;
    let storageFull = false;

    for (const file of files) {
      if (!file.type.startsWith('image/') || file.size > MAX_PHOTO_SOURCE_BYTES) {
        skipped += 1;
        continue;
      }

      try {
        const compressed = await compressPhoto(file);
        const photo: TripPhoto = {
          id: crypto.randomUUID(),
          name: file.name,
          createdAt: new Date().toISOString(),
          ...compressed,
        };
        const candidate = [photo, ...nextPhotos];
        if (!stateFitsStorageBudget({ ...state, photos: candidate })) {
          storageFull = true;
          break;
        }
        nextPhotos = candidate;
        added += 1;
      } catch {
        skipped += 1;
      }
    }

    if (added) onUpdate(nextPhotos);

    const results = [`已加入 ${added} 張相片`];
    if (skipped) results.push(`${skipped} 張格式不支援或檔案過大`);
    if (storageFull) results.push('本機空間已滿，請先刪除部分相片或憑證');
    setMessage(results.join('；'));
    setUploading(false);
  };

  const deletePhoto = () => {
    if (!photoToDelete) return;
    onUpdate(state.photos.filter((photo) => photo.id !== photoToDelete.id));
    if (selectedId === photoToDelete.id) setSelectedId(null);
    setPhotoToDelete(null);
    setMessage('已刪除相片');
  };

  return (
    <>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="template-kicker mb-3">旅程回憶</p>
          <h1 className="display-heading">相片</h1>
          <p className="mt-1 text-sm font-semibold text-muted">集中查看旅程相片</p>
        </div>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="tap-feedback flex min-h-12 items-center gap-2 rounded-2xl bg-forest-700 px-4 text-sm font-black text-white shadow-soft-sm hover:bg-forest-800 disabled:cursor-wait disabled:opacity-60"
            >
              <FontAwesomeIcon icon={faArrowUpFromBracket} aria-hidden="true" />
              {uploading ? '處理中…' : '上傳'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={uploadPhotos}
              className="sr-only"
              aria-label="選擇相片上傳"
            />
          </>
        )}
      </header>

      <section className="mb-4 flex items-center justify-between rounded-3xl border-[3px] border-white/80 bg-forest-50 p-4 text-sm font-bold text-forest-800 shadow-soft-sm">
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faImages} aria-hidden="true" />
          {state.photos.length} 張相片
        </span>
        <span className="text-xs text-muted">{readOnly ? '只可查看' : '上傳時會自動縮小'}</span>
      </section>

      {message && (
        <p
          className="mb-4 rounded-2xl border border-forest-100 bg-white p-3 text-sm font-bold leading-6 text-forest-800"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}

      {state.photos.length ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="旅程相片">
          {state.photos.map((photo) => (
            <article key={photo.id} className="group relative overflow-hidden rounded-3xl border-[3px] border-white bg-paper shadow-soft">
              <button
                type="button"
                onClick={() => setSelectedId(photo.id)}
                className="tap-feedback block w-full text-left"
                aria-label={`查看相片 ${photo.name}`}
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.name}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                <span className="block truncate px-3 pb-3 pt-2 text-sm font-black text-forest-800">
                  {photo.name}
                </span>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setPhotoToDelete(photo)}
                  className="tap-feedback absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-paper/95 text-clay-700 shadow-soft-sm hover:bg-clay-100"
                  aria-label={`刪除相片 ${photo.name}`}
                >
                  <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                </button>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="app-card flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-earth-300 text-2xl text-forest-800">
            <FontAwesomeIcon icon={faImage} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-xl font-black text-forest-800">未有相片</h2>
          <p className="mt-2 max-w-xs text-sm font-semibold leading-6 text-muted">
            選擇手機或電腦內嘅相片，就可以喺呢度隨時睇返。
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="tap-feedback mt-5 min-h-12 rounded-2xl bg-forest-700 px-5 font-black text-white hover:bg-forest-800 disabled:cursor-wait disabled:opacity-60"
            >
              選擇相片
            </button>
          )}
        </section>
      )}

      <Dialog
        open={Boolean(selectedPhoto)}
        title={selectedPhoto?.name ?? '查看相片'}
        onClose={() => setSelectedId(null)}
        panelClassName="sm:max-w-4xl"
      >
        {selectedPhoto && (
          <div>
            <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-3xl bg-forest-900">
              <img
                src={selectedPhoto.dataUrl}
                alt={selectedPhoto.name}
                width={selectedPhoto.width}
                height={selectedPhoto.height}
                className="max-h-[68vh] w-full object-contain"
              />
              {state.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => showRelativePhoto(-1)}
                    className="tap-feedback absolute left-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-paper/90 text-forest-800 shadow-soft-sm"
                    aria-label="上一張相片"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => showRelativePhoto(1)}
                    className="tap-feedback absolute right-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-paper/90 text-forest-800 shadow-soft-sm"
                    aria-label="下一張相片"
                  >
                    <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-muted">
              {selectedIndex + 1} / {state.photos.length} · {formatAddedDate(selectedPhoto.createdAt)}
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(photoToDelete)}
        title="刪除相片"
        onClose={() => setPhotoToDelete(null)}
      >
        {photoToDelete && (
          <div className="space-y-4">
            <p className="rounded-2xl bg-clay-100 p-4 text-sm font-semibold leading-6 text-clay-700">
              確定刪除「{photoToDelete.name}」？刪除後無法復原。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPhotoToDelete(null)}
                className="tap-feedback min-h-12 flex-1 rounded-2xl border border-line bg-white px-4 font-black text-forest-800 hover:bg-forest-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={deletePhoto}
                className="tap-feedback min-h-12 flex-1 rounded-2xl bg-clay-700 px-4 font-black text-white hover:bg-clay-800"
              >
                刪除
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
