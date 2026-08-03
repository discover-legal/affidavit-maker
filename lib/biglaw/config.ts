/**
 * Firm-mode configuration. When both BIGLAW_API_URL and BIGLAW_INTAKE_SECRET
 * are set, the deployment operates as a law-firm client-intake portal:
 * drafts route to the firm's BigLaw platform and clients get a CRM profile
 * surface. When either is unset, the app is a pure self-rep product and
 * never touches the BigLaw API. See docs/BIGLAW_INTEGRATION.md.
 */

export function isFirmMode(): boolean {
  return Boolean(process.env.BIGLAW_API_URL && process.env.BIGLAW_INTAKE_SECRET);
}

export function firmName(): string {
  return process.env.BIGLAW_FIRM_NAME || 'Your law firm';
}
