'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES, MAX_PHOTOS, removePhoto, uploadPhoto } from './api';

export interface PhotoItem {
  key: string;
  name: string;
  previewUrl: string;
  state: 'uploading' | 'processing' | 'ready' | 'rejected' | 'failed';
  progress: number;
  mediaId?: string;
  reason?: string | null;
}

/**
 * Picks and uploads 1–5 photos. Each photo goes straight to storage and is checked by the
 * server (which also strips location data) before the report can be submitted.
 */
export function PhotoUploader({
  photos,
  onChange,
  error,
  max = MAX_PHOTOS,
  legend,
  hint,
  inputId = 'report-photos',
}: {
  photos: PhotoItem[];
  onChange: (update: (current: PhotoItem[]) => PhotoItem[]) => void;
  error?: string;
  /** How many photos may be added here (fewer when the report already has some). */
  max?: number;
  legend?: string;
  hint?: string;
  inputId?: string;
}) {
  const t = useTranslations('ReportForm');
  const input = useRef<HTMLInputElement>(null);
  const aborts = useRef(new Map<string, AbortController>());
  const [notice, setNotice] = useState<string>();

  // Release object URLs and stop polling when the form unmounts.
  useEffect(() => {
    const controllers = aborts.current;
    return () => controllers.forEach((controller) => controller.abort());
  }, []);

  const update = (key: string, patch: Partial<PhotoItem>) =>
    onChange((current) =>
      current.map((photo) => (photo.key === key ? { ...photo, ...patch } : photo)),
    );

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const problems: string[] = [];
    const room = max - photos.length;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_PHOTO_TYPES.includes(file.type as (typeof ACCEPTED_PHOTO_TYPES)[number])) {
        problems.push(t('photoWrongType', { name: file.name }));
      } else if (file.size > MAX_PHOTO_BYTES) {
        problems.push(t('photoTooLarge', { name: file.name }));
      } else if (accepted.length >= room) {
        problems.push(t('photoLimit'));
        break;
      } else {
        accepted.push(file);
      }
    }
    setNotice(problems.length ? problems.join(' ') : undefined);

    for (const file of accepted) {
      const key = crypto.randomUUID();
      const controller = new AbortController();
      aborts.current.set(key, controller);
      onChange((current) => [
        ...current,
        {
          key,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          state: 'uploading',
          progress: 0,
        },
      ]);
      uploadPhoto(
        file,
        (progress) =>
          update(key, progress === 100 ? { progress, state: 'processing' } : { progress }),
        controller.signal,
      )
        .then((view) =>
          update(key, {
            mediaId: view.id,
            state:
              view.status === 'PROCESSED'
                ? 'ready'
                : view.status === 'REJECTED'
                  ? 'rejected'
                  : 'failed',
            reason: view.rejectionReason,
          }),
        )
        .catch(() => update(key, { state: 'failed' }));
    }
    if (input.current) input.current.value = '';
  };

  const remove = (photo: PhotoItem) => {
    aborts.current.get(photo.key)?.abort();
    URL.revokeObjectURL(photo.previewUrl);
    onChange((current) => current.filter((item) => item.key !== photo.key));
    if (photo.mediaId) void removePhoto(photo.mediaId).catch(() => undefined);
  };

  const statusText = (photo: PhotoItem) => {
    switch (photo.state) {
      case 'uploading':
        return t('photoUploading', { percent: photo.progress });
      case 'processing':
        return t('photoProcessing');
      case 'ready':
        return t('photoReady');
      case 'rejected':
        return t('photoRejected', { reason: photo.reason ?? '' });
      case 'failed':
        return t('photoFailed');
    }
  };

  return (
    <fieldset className="space-y-3">
      <legend className="font-medium">{legend ?? t('photos')}</legend>
      <p id={`${inputId}-hint`} className="text-muted text-sm">
        {hint ?? t('photosHint')}
      </p>
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.key} className="border-border space-y-1 rounded-md border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview from an object URL */}
              <img
                src={photo.previewUrl}
                alt=""
                className="aspect-square w-full rounded object-cover"
              />
              <p
                aria-live="polite"
                className={`text-sm ${photo.state === 'rejected' || photo.state === 'failed' ? 'font-medium text-red-700 dark:text-red-400' : 'text-muted'}`}
              >
                {statusText(photo)}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="w-full text-sm"
                onClick={() => remove(photo)}
              >
                {t('removePhoto', { number: index + 1 })}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {photos.length < max && (
        <div>
          <label
            htmlFor={inputId}
            className="border-border focus-within:outline-accent inline-block cursor-pointer rounded-md border px-4 py-2 font-medium focus-within:outline-2"
          >
            {t('addPhotos')}
          </label>
          {/* Asking for JPEG/PNG/WebP makes iPhones convert HEIC photos to JPEG. */}
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={ACCEPTED_PHOTO_TYPES.join(',')}
            multiple
            aria-describedby={`${inputId}-hint`}
            className="sr-only"
            onChange={(event) => addFiles(event.target.files)}
          />
        </div>
      )}
      {(notice ?? error) && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {notice ?? error}
        </p>
      )}
    </fieldset>
  );
}
