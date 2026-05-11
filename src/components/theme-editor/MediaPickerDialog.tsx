import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Image, Link as LinkIcon, Loader2 } from "lucide-react";
import { apiClient, apiClientFormData } from "@/services/api";

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  storeId: string;
}

interface AssetItem {
  key: string;
  url: string;
  size: number;
  last_modified: string;
}

export function MediaPickerDialog({ open, onOpenChange, onSelect, storeId }: MediaPickerDialogProps) {
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [libraryAssets, setLibraryAssets] = useState<AssetItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlPreview, setUrlPreview] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const res = await apiClient<AssetItem[]>(`/stores/${storeId}/settings/customization/assets`);
      setLibraryAssets(res ?? []);
    } catch {
      setLibraryAssets([]);
    } finally {
      setLoadingLibrary(false);
    }
  }, [storeId]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "library" && libraryAssets.length === 0) {
      loadLibrary();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be under 5MB");
        return;
      }
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        alert("Only JPEG, PNG, and WebP images are allowed");
        return;
      }
      setUploadFile(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("asset_type", "section_image");

      const res = await apiClientFormData<{ url: string }>(`/stores/${storeId}/settings/customization/assets`, formData);
      const url = res?.url;
      if (url) {
        onSelect(url);
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload image");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    if (value.match(/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)) {
      setUrlPreview(value);
    } else {
      setUrlPreview(null);
    }
  };

  const handleUrlSelect = () => {
    if (urlPreview) {
      onSelect(urlPreview);
      onOpenChange(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Image</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="media-upload-input"
              />
              <label htmlFor="media-upload-input" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploadFile ? uploadFile.name : "Click to upload (JPEG, PNG, WebP, max 5MB)"}
                </p>
              </label>
            </div>
            {uploadFile && (
              <div className="flex items-center gap-2">
                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="space-y-4 mt-4">
            {loadingLibrary ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : libraryAssets.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No images uploaded yet</div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                {libraryAssets.map((asset) => (
                  <button
                    key={asset.key}
                    onClick={() => {
                      onSelect(asset.url);
                      onOpenChange(false);
                    }}
                    className="relative aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                  >
                    <img src={asset.url} alt={asset.key} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                      {formatSize(asset.size)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="url" className="space-y-4 mt-4">
            <Input
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => handleUrlChange(e.target.value)}
            />
            {urlPreview && (
              <div className="border rounded-lg p-2">
                <img src={urlPreview} alt="Preview" className="max-h-[200px] mx-auto object-contain" />
              </div>
            )}
            <Button onClick={handleUrlSelect} disabled={!urlPreview} className="w-full">
              Use This URL
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}