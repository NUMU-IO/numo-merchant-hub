/** "unlisted" = reachable by direct link but absent from the catalogue,
 *  search and feeds. The API calls the published state "active"; the hub
 *  has always said "published", and `toDisplayStatus` bridges the two. */
export type ProductStatus = "published" | "unlisted" | "draft" | "archived";

export interface ProductVariant {
  id: string;
  name: string;
  nameAr: string;
  options: string[];
  optionsAr: string[];
  /**
   * Per-option rendering metadata. Arrays are aligned by position with
   * `options[]` — index `i` describes `options[i]`. Used by the storefront
   * to render color swatches and swap the main image on selection. Only
   * populated for color-type variants today.
   */
  hexValues?: string[];
  imageValues?: string[];
}

export interface Product {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  stock: number;
  status: ProductStatus;
  category: string;
  categoryAr: string;
  categoryId?: string;
  sku: string;
  image: string;
  images: string[];
  sold: number;
  variants: ProductVariant[];
}

export const categories = [
  { en: "Clothing", ar: "ملابس" },
  { en: "Accessories", ar: "إكسسوارات" },
  { en: "Beauty", ar: "جمال" },
  { en: "Home", ar: "منزل" },
  { en: "Food", ar: "طعام" },
  { en: "Jewelry", ar: "مجوهرات" },
];

export const products: Product[] = [
  { id: "P001", name: "Egyptian Cotton T-Shirt", nameAr: "تيشيرت قطن مصري", description: "Premium quality cotton t-shirt", descriptionAr: "تيشيرت قطن عالي الجودة", price: 349, compareAtPrice: 450, stock: 120, status: "published", category: "Clothing", categoryAr: "ملابس", sku: "CLT-001", image: "👕", images: ["👕"], sold: 89, variants: [{ id: "v1", name: "Size", nameAr: "المقاس", options: ["S", "M", "L", "XL"], optionsAr: ["S", "M", "L", "XL"] }, { id: "v2", name: "Color", nameAr: "اللون", options: ["White", "Black", "Navy"], optionsAr: ["أبيض", "أسود", "كحلي"] }] },
  { id: "P002", name: "Handmade Leather Bag", nameAr: "حقيبة جلد يدوية", description: "Genuine leather handcrafted bag", descriptionAr: "حقيبة جلد طبيعي صناعة يدوية", price: 1250, stock: 35, status: "published", category: "Accessories", categoryAr: "إكسسوارات", sku: "ACC-002", image: "👜", images: ["👜"], sold: 67, variants: [{ id: "v3", name: "Color", nameAr: "اللون", options: ["Brown", "Tan", "Black"], optionsAr: ["بني", "تان", "أسود"] }] },
  { id: "P003", name: "Aromatic Oud Perfume", nameAr: "عطر عود فاخر", description: "Traditional oud fragrance", descriptionAr: "عطر عود تقليدي", price: 890, stock: 50, status: "published", category: "Beauty", categoryAr: "جمال", sku: "BTY-003", image: "🧴", images: ["🧴"], sold: 54, variants: [{ id: "v4", name: "Size", nameAr: "الحجم", options: ["50ml", "100ml"], optionsAr: ["٥٠ مل", "١٠٠ مل"] }] },
  { id: "P004", name: "Ceramic Coffee Set", nameAr: "طقم فناجين سيراميك", description: "Hand-painted ceramic coffee cups", descriptionAr: "فناجين قهوة سيراميك مرسومة يدوياً", price: 420, stock: 80, status: "published", category: "Home", categoryAr: "منزل", sku: "HOM-004", image: "☕", images: ["☕"], sold: 43, variants: [] },
  { id: "P005", name: "Organic Hibiscus Tea", nameAr: "شاي كركديه عضوي", description: "Dried hibiscus flowers for tea", descriptionAr: "زهور كركديه مجففة للشاي", price: 85, stock: 200, status: "published", category: "Food", categoryAr: "طعام", sku: "FOD-005", image: "🌺", images: ["🌺"], sold: 156, variants: [{ id: "v5", name: "Weight", nameAr: "الوزن", options: ["250g", "500g", "1kg"], optionsAr: ["٢٥٠ جم", "٥٠٠ جم", "١ كجم"] }] },
  { id: "P006", name: "Pharaonic Necklace", nameAr: "عقد فرعوني", description: "Gold-plated pharaonic design", descriptionAr: "تصميم فرعوني مطلي بالذهب", price: 650, stock: 25, status: "published", category: "Jewelry", categoryAr: "مجوهرات", sku: "JWL-006", image: "📿", images: ["📿"], sold: 38, variants: [{ id: "v6", name: "Length", nameAr: "الطول", options: ["40cm", "50cm"], optionsAr: ["٤٠ سم", "٥٠ سم"] }] },
  { id: "P007", name: "Woven Kilim Cushion", nameAr: "وسادة كليم منسوجة", description: "Traditional Egyptian kilim", descriptionAr: "كليم مصري تقليدي", price: 280, stock: 60, status: "published", category: "Home", categoryAr: "منزل", sku: "HOM-007", image: "🛋️", images: ["🛋️"], sold: 31, variants: [{ id: "v7", name: "Size", nameAr: "المقاس", options: ["40x40", "50x50"], optionsAr: ["٤٠×٤٠", "٥٠×٥٠"] }] },
  { id: "P008", name: "Date Molasses", nameAr: "عسل أسود (دبس تمر)", description: "Pure date syrup", descriptionAr: "دبس تمر نقي", price: 120, stock: 150, status: "published", category: "Food", categoryAr: "طعام", sku: "FOD-008", image: "🍯", images: ["🍯"], sold: 98, variants: [] },
  { id: "P009", name: "Linen Summer Dress", nameAr: "فستان كتان صيفي", description: "Breathable linen dress", descriptionAr: "فستان كتان خفيف", price: 580, stock: 40, status: "draft", category: "Clothing", categoryAr: "ملابس", sku: "CLT-009", image: "👗", images: ["👗"], sold: 0, variants: [{ id: "v8", name: "Size", nameAr: "المقاس", options: ["S", "M", "L"], optionsAr: ["S", "M", "L"] }, { id: "v9", name: "Color", nameAr: "اللون", options: ["Beige", "White"], optionsAr: ["بيج", "أبيض"] }] },
  { id: "P010", name: "Brass Lantern", nameAr: "فانوس نحاسي", description: "Decorative brass lantern", descriptionAr: "فانوس نحاسي للزينة", price: 350, stock: 45, status: "published", category: "Home", categoryAr: "منزل", sku: "HOM-010", image: "🏮", images: ["🏮"], sold: 72, variants: [{ id: "v10", name: "Size", nameAr: "الحجم", options: ["Small", "Large"], optionsAr: ["صغير", "كبير"] }] },
  { id: "P011", name: "Coconut Oil Soap", nameAr: "صابون زيت جوز الهند", description: "Natural handmade soap", descriptionAr: "صابون طبيعي يدوي", price: 65, stock: 300, status: "published", category: "Beauty", categoryAr: "جمال", sku: "BTY-011", image: "🧼", images: ["🧼"], sold: 210, variants: [] },
  { id: "P012", name: "Embroidered Scarf", nameAr: "وشاح مطرز", description: "Hand-embroidered silk scarf", descriptionAr: "وشاح حرير مطرز يدوياً", price: 420, stock: 30, status: "draft", category: "Accessories", categoryAr: "إكسسوارات", sku: "ACC-012", image: "🧣", images: ["🧣"], sold: 0, variants: [{ id: "v11", name: "Color", nameAr: "اللون", options: ["Red", "Blue", "Green"], optionsAr: ["أحمر", "أزرق", "أخضر"] }] },
  { id: "P013", name: "Spice Gift Box", nameAr: "علبة هدايا توابل", description: "Assorted Egyptian spices", descriptionAr: "تشكيلة توابل مصرية", price: 195, stock: 90, status: "published", category: "Food", categoryAr: "طعام", sku: "FOD-013", image: "🎁", images: ["🎁"], sold: 45, variants: [] },
  { id: "P014", name: "Wooden Chess Set", nameAr: "شطرنج خشبي", description: "Hand-carved wooden chess", descriptionAr: "شطرنج خشب منحوت يدوياً", price: 750, stock: 15, status: "archived", category: "Home", categoryAr: "منزل", sku: "HOM-014", image: "♟️", images: ["♟️"], sold: 12, variants: [] },
  { id: "P015", name: "Cotton Pajama Set", nameAr: "طقم بيجامة قطن", description: "Comfortable cotton sleepwear", descriptionAr: "بيجامة قطن مريحة", price: 310, stock: 70, status: "published", category: "Clothing", categoryAr: "ملابس", sku: "CLT-015", image: "🩳", images: ["🩳"], sold: 63, variants: [{ id: "v12", name: "Size", nameAr: "المقاس", options: ["M", "L", "XL", "XXL"], optionsAr: ["M", "L", "XL", "XXL"] }] },
];
