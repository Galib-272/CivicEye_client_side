import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, callApi } from '@/lib/api/client';
import type { operations } from '@/types/api.generated';

type Data<Op extends keyof operations> = operations[Op]['responses'] extends {
  200: { content: { 'application/json': { data: infer D } } };
}
  ? D
  : operations[Op]['responses'] extends {
        201: { content: { 'application/json': { data: infer D } } };
      }
    ? D
    : never;

type Body<Op extends keyof operations> = operations[Op] extends {
  requestBody?: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type Overview = Data<'OrganizationsController_overview_v1'>;
export type AdminOrganization = Data<'AdminOrganizationsController_detail_v1'>;
export type AdminOrganizationListItem = Data<'AdminOrganizationsController_list_v1'>[number];
export type Member = Data<'OrganizationsController_members_v1'>[number];
export type Invitation = Data<'OrganizationsController_invitations_v1'>[number];
export type ServiceArea = Data<'OrganizationsController_serviceAreasList_v1'>[number];
export type Category = Data<'CategoriesController_list_v1'>[number];
export type MyOrganization = Data<'OrganizationEnrollmentController_mine_v1'>[number];
export type Overlap = Data<'AdminOrganizationsController_overlaps_v1'>[number];
export type OrganizationRole = Member['role'];
export type VerificationState = Overview['verificationState'];
export type ProfileInput = Body<'OrganizationsController_updateProfile_v1'>;
export type CreateOrganizationInput = Body<'AdminOrganizationsController_create_v1'>;

/** Whether a page acts as Super Admin (any organization) or as a member of one organization. */
export type Scope = 'admin' | 'member';

const path = (organizationId: string) => ({ params: { path: { organizationId } } });

export const orgKeys = {
  all: ['organizations'] as const,
  overview: (id: string) => ['organizations', id, 'overview'] as const,
  admin: (id: string) => ['organizations', id, 'admin'] as const,
  members: (scope: Scope, id: string) => ['organizations', id, scope, 'members'] as const,
  invitations: (scope: Scope, id: string) => ['organizations', id, scope, 'invitations'] as const,
  areas: (scope: Scope, id: string) => ['organizations', id, scope, 'areas'] as const,
};

// ─── Reads ─────────────────────────────────────────────────────────────────────

export function useMyOrganizations() {
  return useQuery({
    queryKey: ['organizations', 'mine'],
    queryFn: () => callApi(() => apiClient().GET('/api/v1/users/me/organizations')),
  });
}

export function useOverview(organizationId: string) {
  return useQuery({
    queryKey: orgKeys.overview(organizationId),
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/organizations/{organizationId}/overview', path(organizationId)),
      ),
    retry: false,
  });
}

export function useAdminOrganization(organizationId: string) {
  return useQuery({
    queryKey: orgKeys.admin(organizationId),
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/admin/organizations/{organizationId}', path(organizationId)),
      ),
    retry: false,
  });
}

export function useAdminOrganizations(query: {
  q?: string;
  verificationState?: VerificationState;
}) {
  return useQuery({
    queryKey: ['organizations', 'admin-list', query],
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/admin/organizations', {
          params: { query: { ...query, page: 1, limit: 100 } },
        }),
      ),
  });
}

export function useCategories(includeInactive = false) {
  return useQuery({
    queryKey: ['categories', includeInactive ? 'all' : 'active'],
    queryFn: () =>
      includeInactive
        ? callApi(() => apiClient().GET('/api/v1/admin/categories'))
        : callApi(() => apiClient().GET('/api/v1/categories')),
  });
}

export function useMembers(scope: Scope, organizationId: string) {
  return useQuery({
    queryKey: orgKeys.members(scope, organizationId),
    queryFn: () =>
      scope === 'admin'
        ? callApi(() =>
            apiClient().GET(
              '/api/v1/admin/organizations/{organizationId}/members',
              path(organizationId),
            ),
          )
        : callApi(() =>
            apiClient().GET('/api/v1/organizations/{organizationId}/members', path(organizationId)),
          ),
  });
}

export function useInvitations(scope: Scope, organizationId: string, enabled = true) {
  return useQuery({
    queryKey: orgKeys.invitations(scope, organizationId),
    enabled,
    queryFn: () =>
      scope === 'admin'
        ? callApi(() =>
            apiClient().GET(
              '/api/v1/admin/organizations/{organizationId}/invitations',
              path(organizationId),
            ),
          )
        : callApi(() =>
            apiClient().GET(
              '/api/v1/organizations/{organizationId}/invitations',
              path(organizationId),
            ),
          ),
  });
}

export function useServiceAreas(scope: Scope, organizationId: string) {
  return useQuery({
    queryKey: orgKeys.areas(scope, organizationId),
    queryFn: () =>
      scope === 'admin'
        ? callApi(() =>
            apiClient().GET(
              '/api/v1/admin/organizations/{organizationId}/service-areas',
              path(organizationId),
            ),
          )
        : callApi(() =>
            apiClient().GET(
              '/api/v1/organizations/{organizationId}/service-areas',
              path(organizationId),
            ),
          ),
  });
}

export function useOverlaps() {
  return useQuery({
    queryKey: ['organizations', 'overlaps'],
    queryFn: () => callApi(() => apiClient().GET('/api/v1/admin/service-areas/overlaps')),
  });
}

// ─── Changes ───────────────────────────────────────────────────────────────────

function useInvalidateOrganization(organizationId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganizationInput) =>
      callApi(() => apiClient().POST('/api/v1/admin/organizations', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizations', 'admin-list'] }),
  });
}

export function useUpdateProfile(scope: Scope, organizationId: string) {
  const invalidate = useInvalidateOrganization(organizationId);
  return useMutation({
    mutationFn: (body: ProfileInput & { name?: string; officialEmailDomain?: string }) =>
      scope === 'admin'
        ? callApi(() =>
            apiClient().PATCH('/api/v1/admin/organizations/{organizationId}', {
              ...path(organizationId),
              body,
            }),
          )
        : callApi(() =>
            apiClient().PATCH('/api/v1/organizations/{organizationId}', {
              ...path(organizationId),
              body,
            }),
          ),
    onSuccess: invalidate,
  });
}

export function useSetContact(organizationId: string) {
  const invalidate = useInvalidateOrganization(organizationId);
  return useMutation({
    mutationFn: (body: Body<'AdminOrganizationsController_setContact_v1'>) =>
      callApi(() =>
        apiClient().PUT('/api/v1/admin/organizations/{organizationId}/verification-contact', {
          ...path(organizationId),
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export type VerificationAction = 'verify' | 'reject' | 'suspend' | 'reactivate';

export function useVerificationAction(organizationId: string) {
  const invalidate = useInvalidateOrganization(organizationId);
  return useMutation({
    mutationFn: ({ action, reason }: { action: VerificationAction; reason?: string }) => {
      const options = { ...path(organizationId), body: reason ? { reason } : {} };
      const client = apiClient();
      switch (action) {
        case 'verify':
          return callApi(() =>
            client.POST('/api/v1/admin/organizations/{organizationId}/verify', options),
          );
        case 'reject':
          return callApi(() =>
            client.POST('/api/v1/admin/organizations/{organizationId}/reject', {
              ...options,
              body: { reason: reason ?? '' },
            }),
          );
        case 'suspend':
          return callApi(() =>
            client.POST('/api/v1/admin/organizations/{organizationId}/suspend', {
              ...options,
              body: { reason: reason ?? '' },
            }),
          );
        case 'reactivate':
          return callApi(() =>
            client.POST('/api/v1/admin/organizations/{organizationId}/reactivate', {
              ...options,
              body: { reason: reason ?? '' },
            }),
          );
      }
    },
    onSuccess: invalidate,
  });
}

export function useSetCategories(scope: Scope, organizationId: string) {
  const invalidate = useInvalidateOrganization(organizationId);
  return useMutation({
    mutationFn: (categoryIds: string[]) =>
      scope === 'admin'
        ? callApi(() =>
            apiClient().PUT('/api/v1/admin/organizations/{organizationId}/categories', {
              ...path(organizationId),
              body: { categoryIds },
            }),
          )
        : callApi(() =>
            apiClient().PUT('/api/v1/organizations/{organizationId}/categories', {
              ...path(organizationId),
              body: { categoryIds },
            }),
          ),
    onSuccess: invalidate,
  });
}

export function useInvite(scope: Scope, organizationId: string) {
  const invalidate = useInvalidateOrganization(organizationId);
  return useMutation({
    mutationFn: (body: { email: string; role: OrganizationRole }) =>
      scope === 'admin'
        ? callApi(() =>
            apiClient().POST('/api/v1/admin/organizations/{organizationId}/invitations', {
              ...path(organizationId),
              body,
            }),
          )
        : callApi(() =>
            apiClient().POST('/api/v1/organizations/{organizationId}/invitations', {
              ...path(organizationId),
              body,
            }),
          ),
    onSuccess: invalidate,
  });
}

export function useRevokeInvitation(scope: Scope, organizationId: string) {
  const invalidate = useInvalidateOrganization(organizationId);
  return useMutation({
    mutationFn: (invitationId: string) => {
      const params = { params: { path: { organizationId, invitationId } } };
      return scope === 'admin'
        ? callApi(() =>
            apiClient().DELETE(
              '/api/v1/admin/organizations/{organizationId}/invitations/{invitationId}',
              params,
            ),
          )
        : callApi(() =>
            apiClient().DELETE(
              '/api/v1/organizations/{organizationId}/invitations/{invitationId}',
              params,
            ),
          );
    },
    onSuccess: invalidate,
  });
}

export function useChangeRole(scope: Scope, organizationId: string) {
  const invalidate = useInvalidateOrganization(organizationId);
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrganizationRole }) => {
      const options = { params: { path: { organizationId, memberId } }, body: { role } };
      return scope === 'admin'
        ? callApi(() =>
            apiClient().PATCH(
              '/api/v1/admin/organizations/{organizationId}/members/{memberId}',
              options,
            ),
          )
        : callApi(() =>
            apiClient().PATCH('/api/v1/organizations/{organizationId}/members/{memberId}', options),
          );
    },
    onSuccess: invalidate,
  });
}

export function useRemoveMember(scope: Scope, organizationId: string) {
  const invalidate = useInvalidateOrganization(organizationId);
  return useMutation({
    mutationFn: (memberId: string) => {
      const params = { params: { path: { organizationId, memberId } } };
      return scope === 'admin'
        ? callApi(() =>
            apiClient().DELETE(
              '/api/v1/admin/organizations/{organizationId}/members/{memberId}',
              params,
            ),
          )
        : callApi(() =>
            apiClient().DELETE('/api/v1/organizations/{organizationId}/members/{memberId}', params),
          );
    },
    onSuccess: invalidate,
  });
}

export function useUploadServiceArea(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) =>
      callApi(() =>
        apiClient().POST('/api/v1/admin/organizations/{organizationId}/service-areas', {
          ...path(organizationId),
          body: { name, file: file as unknown as string },
          bodySerializer: (body: { name: string; file: string }) => {
            const form = new FormData();
            form.append('name', body.name);
            form.append('file', body.file as unknown as Blob);
            return form;
          },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] }),
        queryClient.invalidateQueries({ queryKey: ['organizations', 'overlaps'] }),
      ]),
  });
}

export function useUpdateServiceArea(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceAreaId, isActive }: { serviceAreaId: string; isActive: boolean }) =>
      callApi(() =>
        apiClient().PATCH('/api/v1/admin/service-areas/{serviceAreaId}', {
          params: { path: { serviceAreaId } },
          body: { isActive },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] }),
        queryClient.invalidateQueries({ queryKey: ['organizations', 'overlaps'] }),
      ]),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Body<'AdminCategoriesController_create_v1'>) =>
      callApi(() => apiClient().POST('/api/v1/admin/categories', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      ...body
    }: Body<'AdminCategoriesController_update_v1'> & { categoryId: string }) =>
      callApi(() =>
        apiClient().PATCH('/api/v1/admin/categories/{categoryId}', {
          params: { path: { categoryId } },
          body,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      callApi(() => apiClient().POST('/api/v1/invitations/accept', { body: { token } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizations', 'mine'] }),
  });
}

export function useConfirmContact() {
  return useMutation({
    mutationFn: (token: string) =>
      callApi(() => apiClient().POST('/api/v1/organization-contacts/confirm', { body: { token } })),
  });
}
