import { apiClient } from "@/services/api";

export interface ChannelConnectionDTO {
  id: string;
  channel: "facebook" | "instagram" | "whatsapp";
  status: "active" | "expired" | "revoked" | "error";
  external_account_id: string;
  external_account_name: string;
  token_expires_at: string | null;
  last_error: string | null;
  webhook_subscribed_at: string | null;
}

// Must be listed in the Meta app's Valid OAuth Redirect URIs and must be
// identical between the authorize call and the code exchange.
const metaRedirectUri = () => `${window.location.origin}/channels/oauth/meta/callback`;

export async function startOAuth(storeId: string): Promise<{ authorization_url: string; state: string }> {
  return apiClient(`/stores/${storeId}/channels/connect`, {
    method: "POST",
    body: JSON.stringify({ store_id: storeId, redirect_uri: metaRedirectUri() }),
  });
}

export async function handleOAuthCallback(
  storeId: string,
  code: string,
  state: string,
): Promise<{ connections: ChannelConnectionDTO[] }> {
  return apiClient(`/stores/${storeId}/channels/callback`, {
    method: "POST",
    body: JSON.stringify({ code, state, redirect_uri: metaRedirectUri() }),
  });
}

export async function listConnections(storeId: string): Promise<ChannelConnectionDTO[]> {
  return apiClient(`/stores/${storeId}/channels/`);
}

export async function disconnectChannel(storeId: string, connectionId: string): Promise<void> {
  return apiClient(`/stores/${storeId}/channels/${connectionId}`, { method: "DELETE" });
}