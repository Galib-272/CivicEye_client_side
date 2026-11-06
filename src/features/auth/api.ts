import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiClient, callApi, setCsrfToken } from '@/lib/api/client';
import type { components, operations } from '@/types/api.generated';

/** The `data` payload of an operation's 200 response, from the generated API types. */
type Data<Op extends keyof operations> = operations[Op]['responses'] extends {
  200: { content: { 'application/json': { data: infer D } } };
}
  ? D
  : never;

export type AuthState = Data<'AuthController_me_v1'>;
export type SelfUser = AuthState['user'];
export type MfaState = AuthState['mfa'];
export type Session = Data<'SessionsController_list_v1'>[number];
export type MfaStatus = Data<'MfaController_status_v1'>;
export type ErrorCode = components['schemas']['ErrorCode'];

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

/** null = signed out. */
async function fetchAuthState(): Promise<AuthState | null> {
  try {
    const state = await callApi(() => apiClient().GET('/api/v1/auth/me'));
    setCsrfToken(state.csrfToken);
    return state;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      setCsrfToken(undefined);
      return null;
    }
    throw error;
  }
}

export function useAuthState() {
  return useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchAuthState, staleTime: 60_000 });
}

/** Stores a fresh auth state returned by login, two-factor or password-change responses. */
function useStoreAuthState() {
  const queryClient = useQueryClient();
  return (state: AuthState | null) => {
    setCsrfToken(state?.csrfToken);
    queryClient.setQueryData(AUTH_QUERY_KEY, state);
  };
}

/**
 * True for a few seconds after the user presses "Sign out", so pages that need a signed-in
 * user let the sign-out button take them home instead of redirecting to the sign-in page.
 */
let signedOutAt = 0;
export const isSigningOut = () => Date.now() - signedOutAt < 5_000;

export function useLogin() {
  const store = useStoreAuthState();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      callApi(() => apiClient().POST('/api/v1/auth/login', { body })),
    onSuccess: (state) => {
      signedOutAt = 0;
      store(state);
    },
  });
}

export function useLogout() {
  const store = useStoreAuthState();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => callApi(() => apiClient().POST('/api/v1/auth/logout')),
    onMutate: () => {
      signedOutAt = Date.now();
    },
    onSettled: () => {
      store(null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      password: string;
      preferredLocale: 'en' | 'bn';
    }) => callApi(() => apiClient().POST('/api/v1/auth/register', { body })),
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      callApi(() => apiClient().POST('/api/v1/auth/verify-email', { body: { token } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => callApi(() => apiClient().POST('/api/v1/auth/resend-verification')),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      callApi(() => apiClient().POST('/api/v1/auth/forgot-password', { body: { email } })),
  });
}

export function useResetPassword() {
  const store = useStoreAuthState();
  return useMutation({
    mutationFn: (body: { token: string; newPassword: string }) =>
      callApi(() => apiClient().POST('/api/v1/auth/reset-password', { body })),
    // A reset signs the account out everywhere, including this browser.
    onSuccess: () => store(null),
  });
}

export function useMfaChallenge() {
  const store = useStoreAuthState();
  return useMutation({
    mutationFn: (body: { code: string } | { backupCode: string }) =>
      callApi(() => apiClient().POST('/api/v1/auth/mfa/challenge', { body })),
    onSuccess: store,
  });
}

export function useMfaSetup() {
  return useMutation({
    mutationFn: () => callApi(() => apiClient().POST('/api/v1/auth/mfa/setup')),
  });
}

export function useMfaEnable() {
  const store = useStoreAuthState();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      callApi(() => apiClient().POST('/api/v1/auth/mfa/enable', { body: { code } })),
    onSuccess: (result) => {
      store(result.auth);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'mfa'] });
    },
  });
}

export function useMfaStatus() {
  return useQuery({
    queryKey: ['auth', 'mfa'],
    queryFn: () => callApi(() => apiClient().GET('/api/v1/auth/mfa')),
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => callApi(() => apiClient().GET('/api/v1/auth/sessions')),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      callApi(() =>
        apiClient().DELETE('/api/v1/auth/sessions/{sessionId}', {
          params: { path: { sessionId } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; preferredLocale?: 'en' | 'bn' }) =>
      callApi(() => apiClient().PATCH('/api/v1/users/me', { body })),
    onSuccess: (user) =>
      queryClient.setQueryData<AuthState | null>(AUTH_QUERY_KEY, (state) =>
        state ? { ...state, user } : state,
      ),
  });
}

export function useChangePassword() {
  const store = useStoreAuthState();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      callApi(() => apiClient().PATCH('/api/v1/users/me/password', { body })),
    onSuccess: (state) => {
      store(state);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
  });
}
