'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { RequireAuth } from '@/features/auth/require-auth';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import { categoryName } from '@/features/organizations/categories-panel';
import { useCategories } from '@/features/organizations/api';
import { Link, useRouter } from '@/i18n/navigation';
import { useCreateReport } from './api';
import { inServiceBounds, LocationPicker, type PickedLocation } from './location-picker';
import { PhotoUploader, type PhotoItem } from './photo-uploader';

function ReportForm() {
  const t = useTranslations('ReportForm');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();
  const categories = useCategories();
  const create = useCreateReport();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // One key per form: a double tap or a retry after a timeout cannot create two reports.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const schema = z.object({
    categoryId: z.string().min(1, tCommon('fieldRequired')),
    title: z.string().trim().min(5, t('titleHint')).max(120, t('titleHint')),
    description: z.string().trim().min(10, t('descriptionHint')).max(2000, t('descriptionHint')),
    locationDescription: z.string().max(300),
    visibility: z.enum(['PUBLIC', 'PRIVATE']),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { visibility: 'PUBLIC', locationDescription: '', categoryId: '' },
  });
  const { errors } = form.formState;

  const readyPhotos = photos.filter((photo) => photo.state === 'ready');
  const photosPending = photos.some(
    (photo) => photo.state === 'uploading' || photo.state === 'processing',
  );
  const photoError = submitted && readyPhotos.length === 0 ? t('photosHint') : undefined;
  const locationError =
    submitted && !location
      ? t('locationRequired')
      : location && !inServiceBounds(location)
        ? t('outOfArea')
        : undefined;

  const onSubmit = form.handleSubmit(
    (values) => {
      setSubmitted(true);
      if (!location || !inServiceBounds(location) || readyPhotos.length === 0 || photosPending)
        return;
      create.mutate(
        {
          idempotencyKey,
          body: {
            categoryId: values.categoryId,
            title: values.title.trim(),
            description: values.description.trim(),
            latitude: Number(location.latitude.toFixed(6)),
            longitude: Number(location.longitude.toFixed(6)),
            locationAccuracyM: location.accuracyM,
            locationDescription: values.locationDescription.trim() || null,
            visibility: values.visibility,
            mediaIds: readyPhotos.map((photo) => photo.mediaId).filter((id): id is string => !!id),
          },
        },
        { onSuccess: (report) => router.replace(`/reports/${report.publicId}`) },
      );
    },
    () => setSubmitted(true),
  );

  const categoryOptions = [
    { value: '', label: t('chooseCategory') },
    ...(categories.data ?? []).map((category) => ({
      value: category.id,
      label: category.parentId
        ? `— ${categoryName(category, locale)}`
        : categoryName(category, locale),
    })),
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert tone="info">{t('emergency')}</FormAlert>
      {create.isError && (
        <FormAlert tone="error">
          <p>{errorMessage(create.error, tErrors)}</p>
          {errorDetail(create.error) && <p className="text-sm">{errorDetail(create.error)}</p>}
        </FormAlert>
      )}
      <SelectField
        label={t('category')}
        options={categoryOptions}
        error={errors.categoryId?.message}
        {...form.register('categoryId')}
      />
      <TextField
        label={t('titleLabel')}
        hint={t('titleHint')}
        error={errors.title?.message}
        {...form.register('title')}
      />
      <TextAreaField
        label={t('description')}
        hint={t('descriptionHint')}
        rows={5}
        error={errors.description?.message}
        {...form.register('description')}
      />
      <PhotoUploader photos={photos} onChange={setPhotos} error={photoError} />
      <LocationPicker value={location} onChange={setLocation} error={locationError} />
      <TextField
        label={t('locationDescription')}
        hint={t('locationDescriptionHint')}
        error={errors.locationDescription?.message}
        {...form.register('locationDescription')}
      />
      <fieldset className="space-y-2">
        <legend className="font-medium">{t('visibility')}</legend>
        {(['PUBLIC', 'PRIVATE'] as const).map((option) => (
          <label key={option} className="flex items-start gap-2">
            <input type="radio" value={option} className="mt-1" {...form.register('visibility')} />
            <span>{option === 'PUBLIC' ? t('public') : t('private')}</span>
          </label>
        ))}
      </fieldset>
      {photosPending && <p className="text-muted text-sm">{t('waitForPhotos')}</p>}
      <Button busy={create.isPending} disabled={photosPending} className="w-full sm:w-auto">
        {create.isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

function VerifyEmailFirst() {
  const tErrors = useTranslations('Errors');
  const tNav = useTranslations('Nav');
  return (
    <FormAlert tone="info">
      <p>{tErrors('EMAIL_NOT_VERIFIED')}</p>
      <Link href="/account" className="underline underline-offset-4">
        {tNav('account')}
      </Link>
    </FormAlert>
  );
}

export function ReportFormPage() {
  return (
    <RequireAuth>
      {(auth) => (auth.user.emailVerified ? <ReportForm /> : <VerifyEmailFirst />)}
    </RequireAuth>
  );
}
