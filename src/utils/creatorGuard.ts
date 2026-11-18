export const CREATOR_EMAIL = 'futfieldsport@gmail.com';
export const CREATOR_ID = 'futfield_creator_official';
export const CREATOR_HANDLE = '@futfield';
export const CREATOR_NAME = 'Futfield';

export function isCreatorEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === CREATOR_EMAIL;
}

export function isReservedFutfieldText(value?: string | null): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return /fut\s*[-_.]?\s*field/i.test(raw);
}

export function isCreatorTarget(identifier?: string | null): boolean {
  const norm = String(identifier || '').trim().toLowerCase();
  if (!norm) return false;
  return (
    norm === CREATOR_ID ||
    norm === CREATOR_HANDLE ||
    norm === 'futfield' ||
    norm === CREATOR_EMAIL ||
    norm === '@futfield_official'
  );
}

export function sanitizeNonCreatorName(name?: string | null, email?: string | null): string {
  const clean = String(name || '').trim();
  if (isCreatorEmail(email)) {
    return clean || CREATOR_NAME;
  }
  if (!clean || isReservedFutfieldText(clean)) {
    return 'Football Fan';
  }
  return clean;
}

export function sanitizeNonCreatorHandle(handle?: string | null, email?: string | null): string {
  const raw = String(handle || '').trim();
  if (isCreatorEmail(email)) {
    return CREATOR_HANDLE;
  }
  if (!raw || isReservedFutfieldText(raw)) {
    return '@fan';
  }
  return raw.startsWith('@') ? raw : `@${raw}`;
}
