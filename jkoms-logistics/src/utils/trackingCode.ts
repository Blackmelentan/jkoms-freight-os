/**
 * Generates human-readable tracking codes: JKG-YYMM-XXXXXX
 * The numeric tail is intentionally NOT sequential-in-memory — it's a
 * short random suffix so two warehouse stations creating labels at the
 * same moment (no network round trip yet) can't collide. Supabase still
 * enforces a UNIQUE constraint as the source of truth; this is just a
 * good-enough client-side draft before the row is confirmed.
 */
export function generateTrackingCode(companyCode = 'JKG'): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const tail = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `${companyCode}-${yy}${mm}-${tail}`;
}

export function isValidTrackingCode(code: string): boolean {
  return /^[A-Z]{2,4}-\d{4}-\d{6}$/.test(code.trim());
}
