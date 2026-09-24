export const isPartnerHost = window.location.hostname.startsWith("partners.");

export const partnerPath = (path: string) => (isPartnerHost ? path || "/" : `/partners${path}`);
