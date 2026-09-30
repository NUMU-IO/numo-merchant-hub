import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { apiClientBlob, getImpersonationToken } from "@/services/api";
import { apiAssetUrl } from "@/services/storeApi";

/**
 * `<img>` for an image the API streams behind auth (payment proofs).
 *
 * A merchant's own session rides on the `access_token` cookie, which a plain
 * `<img src>` sends. An admin impersonating a merchant authenticates with a
 * tab-scoped Bearer token instead, and `<img>` cannot send headers — so the
 * image 401s. While impersonating, fetch it through the API client and show
 * it as a blob URL. On failure fall back to the direct URL so the caller's
 * `onError` still fires.
 */
export function ApiImage({
  path,
  ...props
}: { path: string | null | undefined } & Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
>) {
  const impersonating = !!getImpersonationToken();
  const [blobUrl, setBlobUrl] = useState<string>();

  useEffect(() => {
    if (!path || !impersonating) return;
    let cancelled = false;
    let url: string | undefined;
    apiClientBlob(path.replace(/^\/api\/v1(?=\/)/, ""))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(apiAssetUrl(path));
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setBlobUrl(undefined);
    };
  }, [path, impersonating]);

  return <img src={impersonating ? blobUrl : apiAssetUrl(path)} {...props} />;
}
