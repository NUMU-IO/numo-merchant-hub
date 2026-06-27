/**
 * Theme code-editor API — the in-app file workspace behind Online Store →
 * Edit code. CRUD over the store's editable theme source files, plus scaffold
 * (seed a buildable starter) and publish (run the workspace through the same
 * external-theme build pipeline). Build status is polled with the existing
 * `fetchBuildStatus` from themeApi.
 */

import { apiClient } from "./api";
import type { ThemeBuildResponse } from "./themeApi";

export interface ThemeFileMeta {
  path: string;
  size: number;
  updated_at: string | null;
}

export interface ThemeFileListResponse {
  files: ThemeFileMeta[];
  has_workspace: boolean;
}

export interface ThemeFileContent {
  path: string;
  content: string;
  updated_at: string | null;
}

export interface ScaffoldThemeResponse {
  file_count: number;
  message: string;
}

const base = (storeId: string) => `/stores/${storeId}/themes/code`;

// Encode each path segment but keep the slashes so the backend's
// `{file_path:path}` route still sees the directory structure.
const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

/** List every file in the store's theme workspace (flat). */
export function listThemeFiles(storeId: string): Promise<ThemeFileListResponse> {
  return apiClient<ThemeFileListResponse>(`${base(storeId)}/files`);
}

/** Read a single file's full content. */
export function readThemeFile(
  storeId: string,
  path: string,
): Promise<ThemeFileContent> {
  return apiClient<ThemeFileContent>(`${base(storeId)}/files/${encodePath(path)}`);
}

/** Create or overwrite a file. */
export function writeThemeFile(
  storeId: string,
  path: string,
  content: string,
): Promise<ThemeFileContent> {
  return apiClient<ThemeFileContent>(`${base(storeId)}/files/${encodePath(path)}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

/** Delete a file. */
export function deleteThemeFile(
  storeId: string,
  path: string,
): Promise<{ deleted: boolean; path: string }> {
  return apiClient<{ deleted: boolean; path: string }>(
    `${base(storeId)}/files/${encodePath(path)}`,
    { method: "DELETE" },
  );
}

/** Seed a buildable starter theme into the workspace. */
export function scaffoldTheme(
  storeId: string,
  body: { name?: string; theme_id?: string; overwrite?: boolean } = {},
): Promise<ScaffoldThemeResponse> {
  return apiClient<ScaffoldThemeResponse>(`${base(storeId)}/scaffold`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Build & publish the workspace via the external-theme pipeline. */
export function publishThemeCode(storeId: string): Promise<ThemeBuildResponse> {
  return apiClient<ThemeBuildResponse>(`${base(storeId)}/publish`, {
    method: "POST",
  });
}
