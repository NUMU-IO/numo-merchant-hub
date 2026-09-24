export const isPartnerHost = window.location.hostname.startsWith("partners.");

export const partnerPath = (path: string) => (isPartnerHost ? path || "/" : `/partners${path}`);

/** The partner portal's own origin when the hub runs on merchant.<domain>
 *  (auth cookies are scoped to the parent domain, so the session carries
 *  over); elsewhere (localhost, previews) the portal lives at /partners. */
export const partnerPortalUrl = window.location.hostname.startsWith("merchant.")
  ? `${window.location.protocol}//${window.location.host.replace(/^merchant\./, "partners.")}/`
  : null;
