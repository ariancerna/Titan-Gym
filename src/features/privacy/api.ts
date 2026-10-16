import { requireSupabase } from '../../lib/supabase/client';
import { privacyPolicyVersion } from '../../content/privacy';

export interface PrivacyConsent {
  accepted_at: string;
  source: 'signup' | 'reservation';
}

/** Consentimiento del socio para la versión vigente, o null si todavía no la aceptó. */
export async function getPrivacyConsent(): Promise<PrivacyConsent | null> {
  const { data, error } = await requireSupabase()
    .from('privacy_consents')
    .select('accepted_at,source')
    .eq('policy_version', privacyPolicyVersion)
    .maybeSingle();
  if (error) throw error;
  return data as PrivacyConsent | null;
}

export async function acceptPrivacyPolicy(): Promise<void> {
  const { error } = await requireSupabase().rpc('accept_privacy_policy', {
    p_version: privacyPolicyVersion,
  });
  if (error) throw error;
}
