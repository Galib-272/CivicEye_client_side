'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { TextField } from '@/components/ui/text-field';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import { AreaPreview } from './area-preview';
import { useServiceAreas, useUpdateServiceArea, useUploadServiceArea, type Scope } from './api';

/** Service areas with outline previews. Super Admins can upload and (de)activate them. */
export function ServiceAreasPanel({
  scope,
  organizationId,
}: {
  scope: Scope;
  organizationId: string;
}) {
  const t = useTranslations('Org');
  const tAdmin = useTranslations('AdminOrgs');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const areas = useServiceAreas(scope, organizationId);
  const upload = useUploadServiceArea(organizationId);
  const update = useUpdateServiceArea(organizationId);
  const canManage = scope === 'admin';
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const onUpload = (event: FormEvent) => {
    event.preventDefault();
    if (!file || name.trim().length < 2) return;
    upload.mutate(
      { name: name.trim(), file },
      {
        onSuccess: () => {
          setName('');
          setFile(null);
          if (fileInput.current) fileInput.current.value = '';
        },
      },
    );
  };

  return (
    <Section title={t('areasHeading')}>
      {update.isError && <FormAlert tone="error">{errorMessage(update.error, tErrors)}</FormAlert>}
      {!areas.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : areas.data.length === 0 ? (
        <p className="text-muted">{t('noAreas')}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {areas.data.map((area) => (
            <li key={area.id} className="border-border space-y-2 rounded-md border p-3">
              <AreaPreview
                geometry={area.previewGeoJson}
                label={t('areaPreviewLabel', { name: area.name })}
              />
              <p className="font-medium">
                {area.name} {!area.isActive && <Badge>{t('inactive')}</Badge>}
              </p>
              <p className="text-muted text-sm">
                {t('areaSize', {
                  area: format.number(area.areaSqKm, { maximumFractionDigits: 1 }),
                  points: format.number(area.pointCount),
                })}
              </p>
              {canManage && (
                <Button
                  type="button"
                  variant="secondary"
                  busy={update.isPending && update.variables?.serviceAreaId === area.id}
                  onClick={() =>
                    update.mutate({ serviceAreaId: area.id, isActive: !area.isActive })
                  }
                >
                  {area.isActive ? tAdmin('deactivate') : tAdmin('activate')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={onUpload} className="border-border space-y-3 border-t pt-4">
          <h3 className="font-semibold">{tAdmin('uploadHeading')}</h3>
          {upload.isSuccess && <FormAlert tone="success">{tAdmin('uploaded')}</FormAlert>}
          {upload.isError && (
            <FormAlert tone="error">
              <p>{errorMessage(upload.error, tErrors)}</p>
              {errorDetail(upload.error) && <p className="text-sm">{errorDetail(upload.error)}</p>}
            </FormAlert>
          )}
          <TextField
            label={tAdmin('areaName')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={200}
          />
          <div className="space-y-1">
            <label htmlFor={`${organizationId}-area-file`} className="block font-medium">
              {tAdmin('areaFile')}
            </label>
            <p id={`${organizationId}-area-file-hint`} className="text-muted text-sm">
              {tAdmin('areaFileHint')}
            </p>
            <input
              ref={fileInput}
              id={`${organizationId}-area-file`}
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              aria-describedby={`${organizationId}-area-file-hint`}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <Button busy={upload.isPending} disabled={!file}>
            {tAdmin('upload')}
          </Button>
        </form>
      )}
    </Section>
  );
}
