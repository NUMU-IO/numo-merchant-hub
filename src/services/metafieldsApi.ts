/**
 * Metafields API service — merchant-defined typed fields.
 *
 * Definitions declare the schema per (store, owner_type); values are set
 * per owner entity (a specific product/collection/page). Public definitions
 * become bindable dynamic sources in the V3 customizer
 * (`{owner}.metafield:{namespace}.{key}`) and reach storefronts.
 */

import { apiClient } from "./api";

export type MetafieldOwnerType = "product" | "collection" | "page";
export type MetafieldType =
  | "single_line_text"
  | "multi_line_text"
  | "number"
  | "boolean"
  | "json"
  | "url"
  | "date";

export interface MetafieldDefinition {
  id: string;
  store_id: string;
  owner_type: MetafieldOwnerType;
  namespace: string;
  key: string;
  type: MetafieldType;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetafieldValue {
  id: string;
  definition_id: string;
  owner_id: string;
  namespace: string;
  key: string;
  type: MetafieldType;
  value: unknown;
  raw_value: string;
}

export interface CreateMetafieldDefinition {
  owner_type: MetafieldOwnerType;
  namespace: string;
  key: string;
  type: MetafieldType;
  name: string;
  description?: string;
  is_public: boolean;
}

export type UpdateMetafieldDefinition = Partial<
  Pick<CreateMetafieldDefinition, "type" | "name" | "description" | "is_public">
>;

export async function listMetafieldDefinitions(
  storeId: string,
  ownerType?: MetafieldOwnerType,
): Promise<MetafieldDefinition[]> {
  const qs = ownerType ? `?owner_type=${ownerType}` : "";
  return apiClient<MetafieldDefinition[]>(
    `/stores/${storeId}/metafields/definitions${qs}`,
  );
}

export async function createMetafieldDefinition(
  storeId: string,
  data: CreateMetafieldDefinition,
): Promise<MetafieldDefinition> {
  return apiClient<MetafieldDefinition>(
    `/stores/${storeId}/metafields/definitions`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export async function updateMetafieldDefinition(
  storeId: string,
  definitionId: string,
  data: UpdateMetafieldDefinition,
): Promise<MetafieldDefinition> {
  return apiClient<MetafieldDefinition>(
    `/stores/${storeId}/metafields/definitions/${definitionId}`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export async function deleteMetafieldDefinition(
  storeId: string,
  definitionId: string,
): Promise<void> {
  return apiClient<void>(
    `/stores/${storeId}/metafields/definitions/${definitionId}`,
    { method: "DELETE" },
  );
}

export async function listOwnerMetafieldValues(
  storeId: string,
  ownerType: MetafieldOwnerType,
  ownerId: string,
): Promise<MetafieldValue[]> {
  return apiClient<MetafieldValue[]>(
    `/stores/${storeId}/metafields/owners/${ownerType}/${ownerId}`,
  );
}

export async function setOwnerMetafieldValue(
  storeId: string,
  ownerType: MetafieldOwnerType,
  ownerId: string,
  data: { namespace: string; key: string; value: unknown },
): Promise<MetafieldValue> {
  return apiClient<MetafieldValue>(
    `/stores/${storeId}/metafields/owners/${ownerType}/${ownerId}`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export async function unsetOwnerMetafieldValue(
  storeId: string,
  ownerType: MetafieldOwnerType,
  ownerId: string,
  namespace: string,
  key: string,
): Promise<void> {
  return apiClient<void>(
    `/stores/${storeId}/metafields/owners/${ownerType}/${ownerId}/${namespace}/${key}`,
    { method: "DELETE" },
  );
}

/** The setting types each metafield type can bind to in the V3 picker —
 *  mirror of the picker's TEXT/NUMBER/URL/IMAGE compatibility groups so a
 *  definition only offers itself to compatible settings. */
export function compatibleSettingTypes(type: MetafieldType): string[] {
  switch (type) {
    case "single_line_text":
      return ["text", "textarea", "richtext", "inline_richtext"];
    case "multi_line_text":
      return ["textarea", "richtext", "text"];
    case "number":
      return ["number", "range", "text"];
    case "url":
      return ["url", "text"];
    case "boolean":
      return ["checkbox"];
    case "date":
      return ["text"];
    case "json":
      return ["textarea", "text"];
    default:
      return ["text"];
  }
}
