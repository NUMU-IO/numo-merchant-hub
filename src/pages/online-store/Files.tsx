import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { HelpTip } from "@/components/ui/help-tip";
import { MediaManager } from "@/components/media/MediaManager";

/**
 * Online Store → Files. The Shopify "Settings → Files" equivalent: a
 * full media manager over the store's uploaded customization assets.
 * The same `<MediaManager>` powers the in-editor image picker's Library
 * tab, so what you upload/rename/alt here shows up there too.
 */
export default function OnlineStoreFiles() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? "";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
          {isRTL ? "الملفات" : "Files"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isRTL
            ? "ارفع وأعد استخدام الصور والملفات في كل أنحاء متجرك"
            : "Upload and reuse images and files across your store"}
        </p>
      </div>

      <HelpTip title={isRTL ? "كيف تدير ملفاتك؟" : "How files work"}>
        <ul className="list-inside list-disc space-y-1">
          <li>
            {isRTL
              ? "ارفع الصور هنا مرة واحدة، ثم اخترها في محرّر الثيم دون رفعها مجددًا."
              : "Upload once here, then pick images in the theme editor without re-uploading."}
          </li>
          <li>
            {isRTL
              ? "أضِف نصًا بديلًا (Alt) لكل صورة لتحسين الوصولية وترتيب محركات البحث."
              : "Add alt text to each image for better accessibility and SEO."}
          </li>
          <li>
            {isRTL
              ? "«الاسم المعروض» مجرد تسمية ودّية — رابط الملف لا يتغيّر أبدًا، لذا لن تتعطّل الأقسام التي تستخدمه."
              : "“Display name” is just a friendly label — the file URL never changes, so sections using it won't break."}
          </li>
          <li>
            {isRTL
              ? "احذف الملفات غير المستخدمة بحذر: إذا كان الملف مستخدمًا في قسم فستظهر صورته فارغة."
              : "Delete unused files with care: if a file is used in a section, that image will break."}
          </li>
        </ul>
      </HelpTip>

      <MediaManager storeId={storeId} isRTL={isRTL} filterKind="all" showUpload />
    </div>
  );
}
