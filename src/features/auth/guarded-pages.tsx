'use client';

import { AccountSettings } from './account-settings';
import { RequireAuth } from './require-auth';
import { TwoFactorChallenge } from './two-factor-challenge';
import { TwoFactorSetup } from './two-factor-setup';

// Client entry points for pages that need a signed-in user.

export function TwoFactorChallengeGuarded() {
  return (
    <RequireAuth allowIncompleteMfa>{(auth) => <TwoFactorChallenge auth={auth} />}</RequireAuth>
  );
}

export function TwoFactorSetupGuarded() {
  return <RequireAuth allowIncompleteMfa>{(auth) => <TwoFactorSetup auth={auth} />}</RequireAuth>;
}

export function AccountSettingsGuarded() {
  return <RequireAuth>{(auth) => <AccountSettings auth={auth} />}</RequireAuth>;
}
