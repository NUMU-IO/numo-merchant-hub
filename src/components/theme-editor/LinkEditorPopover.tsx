import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface LinkEditorPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  textKey: string;
  urlKey: string;
  currentText: string;
  currentUrl: string;
  onSave: (text: string, url: string) => void;
}

const EDITABLE_PAGES = [
  { path: "/", label: "Home" },
  { path: "/products", label: "Products" },
  { path: "/product/demo", label: "Product Demo" },
  { path: "/checkout", label: "Checkout" },
  { path: "/contact", label: "Contact" },
  { path: "/order-confirmation", label: "Order Confirmation" },
  { path: "/profile", label: "Profile" },
];

export function LinkEditorPopover({
  open,
  onOpenChange,
  currentText,
  currentUrl,
  onSave,
}: LinkEditorPopoverProps) {
  const [text, setText] = useState(currentText);
  const [url, setUrl] = useState(currentUrl);
  const [newTab, setNewTab] = useState(false);

  useEffect(() => {
    if (open) {
      setText(currentText);
      setUrl(currentUrl);
      setNewTab(false);
    }
  }, [open, currentText, currentUrl]);

  const handleSave = () => {
    onSave(text, url);
    onOpenChange(false);
  };

  const isCustomUrl = !EDITABLE_PAGES.some((p) => url === p.path);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Link Text</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Button text"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">URL</Label>
            <select
              value={isCustomUrl ? "custom" : url}
              onChange={(e) => setUrl(e.target.value === "custom" ? "" : e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
            >
              <option value="custom">Custom URL</option>
              {EDITABLE_PAGES.map((page) => (
                <option key={page.path} value={page.path}>
                  {page.label} ({page.path})
                </option>
              ))}
            </select>
            {isCustomUrl && (
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="mt-2"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="new-tab"
              checked={newTab}
              onCheckedChange={(checked) => setNewTab(checked === true)}
            />
            <Label htmlFor="new-tab" className="text-xs cursor-pointer">
              Open in new tab
            </Label>
          </div>

          <Button onClick={handleSave} className="w-full">
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}