/**
 * Publish confirmation.
 *
 * Publishing pushes changes to a LIVE storefront that customers are looking at.
 * The desktop editor gates this behind a pre-publish diff dialog; mobile gets
 * its own gate rather than none. A one-tap publish button on a phone — where
 * mis-taps are the norm, not the exception — is not acceptable for an action
 * that is immediately customer-visible.
 *
 * Deliberately NOT a diff view: computing and rendering a readable diff on a
 * 360px screen is its own project. Naming the store and stating the
 * consequence in plain language is the honest minimum.
 */
import { Loader2, Rocket } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MobilePublishConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPublishing: boolean;
  storeName?: string | null;
  isAr: boolean;
}

export function MobilePublishConfirm({
  open,
  onOpenChange,
  onConfirm,
  isPublishing,
  storeName,
  isAr,
}: MobilePublishConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[92vw] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-start text-base font-extrabold">
            <Rocket className="h-4 w-4 text-saffron" />
            {isAr ? "تنشر التغييرات؟" : "Publish changes?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-start text-[14px] leading-relaxed">
            {isAr ? (
              <>
                التغييرات دي هتظهر على المتجر
                {storeName ? ` «${storeName}» ` : " "}
                على طول، والعملاء هيشوفوها فورًا.
              </>
            ) : (
              <>
                This updates {storeName ? `“${storeName}”` : "your live store"} immediately.
                Customers will see the changes right away.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="mt-0 h-12 rounded-xl font-bold">
            {isAr ? "إلغاء" : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPublishing}
            className="h-12 rounded-xl font-bold"
          >
            {isPublishing ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {isAr ? "بينشر…" : "Publishing…"}
              </>
            ) : isAr ? (
              "انشر"
            ) : (
              "Publish"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
