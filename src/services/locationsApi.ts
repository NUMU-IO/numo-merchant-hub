/**
 * Locations API service — Phase 8.2.
 *
 * Locations represent physical fulfillment + pickup points. A
 * location can:
 *   - fulfill_orders (warehouse / dark store)
 *   - fulfill_pickup (in-store pickup eligible)
 * Both flags can be true (a retail store that both ships + offers
 * pickup), false (a dropship location not yet active), etc.
 *
 * Storefront only ever sees pickup-eligible locations (separate
 * route under /storefront/store/{id}/pickup-locations).
 */

import { apiClient } from "./api";

export interface Location {
  id: string;
  store_id: string;
  name: string;
  name_ar: string | null;
  position: number;
  is_active: boolean;
  fulfills_orders: boolean;
  fulfills_pickup: boolean;
  address: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  pickup_instructions: string | null;
  pickup_instructions_ar: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLocationData {
  name: string;
  name_ar?: string | null;
  is_active?: boolean;
  fulfills_orders?: boolean;
  fulfills_pickup?: boolean;
  address?: Location["address"];
  pickup_instructions?: string | null;
  pickup_instructions_ar?: string | null;
  position?: number;
}

export type UpdateLocationData = Partial<CreateLocationData>;

export async function listLocations(storeId: string): Promise<Location[]> {
  const res = await apiClient<{ items?: Location[] } | Location[]>(
    `/stores/${storeId}/inventory/locations`,
  );
  if (Array.isArray(res)) return res;
  return res?.items ?? [];
}

export async function createLocation(
  storeId: string,
  data: CreateLocationData,
): Promise<Location> {
  return apiClient<Location>(`/stores/${storeId}/inventory/locations`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateLocation(
  storeId: string,
  locationId: string,
  data: UpdateLocationData,
): Promise<Location> {
  return apiClient<Location>(
    `/stores/${storeId}/inventory/locations/${locationId}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export async function deleteLocation(
  storeId: string,
  locationId: string,
): Promise<void> {
  return apiClient<void>(
    `/stores/${storeId}/inventory/locations/${locationId}`,
    { method: "DELETE" },
  );
}
