/**
 * AI Description Generator API service.
 */

import { apiClient } from "./api";

export interface GenerateDescriptionRequest {
  product_name: string;
  product_name_ar?: string;
  category?: string;
  image_url?: string;
  attributes?: Record<string, string>;
  tone?: "professional" | "casual" | "luxury" | "playful";
}

export interface GenerateDescriptionResponse {
  short_description_en: string;
  long_description_en: string;
  short_description_ar: string;
  long_description_ar: string;
  seo_title_en: string;
  seo_title_ar: string;
  seo_description_en: string;
  seo_description_ar: string;
  tags: string[];
}

/** Generate bilingual AI product descriptions. */
export async function generateDescription(
  storeId: string,
  data: GenerateDescriptionRequest,
): Promise<GenerateDescriptionResponse> {
  return apiClient<GenerateDescriptionResponse>(
    `/stores/${storeId}/ai/generate-description`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}
