/**
 * SortableImageGrid — reorder a product's images.
 *
 * The array order IS the storefront order: the API assigns
 * `product.images = dto.images` verbatim, and the storefront renders the
 * array as given. So position 1 is the image that shows in the catalogue,
 * in search, and as the share thumbnail — which is why it carries a
 * "Main" badge rather than leaving the merchant to infer it.
 *
 * Two ways to move an image, deliberately:
 *
 *   drag   fastest on a mouse, and the one merchants reach for.
 *   arrows the only one that works with a keyboard, with assistive tech,
 *          or reliably on a phone — a drag inside a scrolling page is a
 *          coin-flip between reordering and scrolling on touch.
 *
 * dnd-kit's KeyboardSensor covers keyboard dragging too, but it requires
 * discovering that Space picks an item up. The arrows are visible.
 */

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SortableImageGridProps {
  /** Ordered image URLs. Index 0 is the main image. */
  images: string[];
  onReorder: (next: string[]) => void;
  onRemove?: (url: string) => void;
  /** Rendered under each tile — the alt-text input, when editing. */
  renderMeta?: (url: string) => React.ReactNode;
  isAr: boolean;
  disabled?: boolean;
}

export function SortableImageGrid({
  images,
  onReorder,
  onRemove,
  renderMeta,
  isAr,
  disabled,
}: SortableImageGridProps) {
  const sensors = useSensors(
    // 8px before a drag starts, so a click on the remove button is never
    // swallowed as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Touch needs a hold, not a distance: without it every attempt to
    // scroll the page past the grid would drag an image instead.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = images.indexOf(String(active.id));
    const to = images.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(images, from, to));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    onReorder(arrayMove(images, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={images} strategy={rectSortingStrategy}>
        {images.map((url, index) => (
          <SortableImage
            key={url}
            url={url}
            index={index}
            total={images.length}
            onMove={move}
            onRemove={onRemove}
            renderMeta={renderMeta}
            isAr={isAr}
            disabled={disabled}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

interface SortableImageProps {
  url: string;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove?: (url: string) => void;
  renderMeta?: (url: string) => React.ReactNode;
  isAr: boolean;
  disabled?: boolean;
}

function SortableImage({
  url,
  index,
  total,
  onMove,
  onRemove,
  renderMeta,
  isAr,
  disabled,
}: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url, disabled });

  const isMain = index === 0;

  // The arrows mean "towards position 1" and "away from it". In Arabic the
  // grid runs right-to-left, so the glyph that points at position 1 is the
  // RIGHT chevron — swapping the icons keeps the arrow pointing where the
  // image will actually go.
  const PrevIcon = isAr ? ChevronRight : ChevronLeft;
  const NextIcon = isAr ? ChevronLeft : ChevronRight;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn("space-y-1.5", isDragging && "opacity-50 z-10")}
    >
      <div className="relative group aspect-square">
        <img
          src={url}
          alt=""
          className={cn(
            "h-full w-full rounded-xl object-cover bg-muted ring-1 ring-border/20",
            isMain && "ring-2 ring-saffron",
          )}
        />

        {/* Drag handle. A handle rather than the whole tile: dragging the
            tile itself would fight the alt-text input beneath it. */}
        {!disabled && total > 1 && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={
              isAr ? `إعادة ترتيب الصورة ${index + 1}` : `Reorder image ${index + 1}`
            }
            className="absolute top-1.5 start-1.5 h-6 w-6 rounded-lg bg-black/55 backdrop-blur-sm text-white grid place-items-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(url)}
            aria-label={isAr ? "حذف الصورة" : "Remove image"}
            className="absolute top-1.5 end-1.5 h-6 w-6 rounded-lg bg-black/60 backdrop-blur-sm text-white grid place-items-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all hover:bg-black/80"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {isMain ? (
          <span className="absolute bottom-1.5 start-1.5 rounded-md bg-saffron px-1.5 py-0.5 text-[9px] font-bold text-navy">
            {isAr ? "الرئيسية" : "Main"}
          </span>
        ) : (
          <span className="absolute bottom-1.5 start-1.5 rounded-md bg-black/55 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-white tabular-nums">
            {index + 1}
          </span>
        )}

        {/* Arrow controls — always visible on touch, on hover elsewhere. */}
        {!disabled && total > 1 && (
          <div className="absolute bottom-1.5 end-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onMove(index, index - 1)}
              disabled={index === 0}
              aria-label={isAr ? "تحريك للأمام" : "Move earlier"}
              className="h-6 w-6 rounded-lg bg-black/60 backdrop-blur-sm text-white grid place-items-center hover:bg-black/80 disabled:opacity-30 disabled:pointer-events-none"
            >
              <PrevIcon className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, index + 1)}
              disabled={index === total - 1}
              aria-label={isAr ? "تحريك للخلف" : "Move later"}
              className="h-6 w-6 rounded-lg bg-black/60 backdrop-blur-sm text-white grid place-items-center hover:bg-black/80 disabled:opacity-30 disabled:pointer-events-none"
            >
              <NextIcon className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {renderMeta?.(url)}
    </div>
  );
}
