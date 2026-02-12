export type ProductStatus = "published" | "draft" | "archived";

export interface Product {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: number;
  stock: number;
  status: ProductStatus;
  category: string;
  categoryAr: string;
  sku: string;
  image: string;
  sold: number;
}

export const products: Product[] = [
  { id: "P001", name: "Egyptian Cotton T-Shirt", nameAr: "تيشيرت قطن مصري", description: "Premium quality cotton t-shirt", descriptionAr: "تيشيرت قطن عالي الجودة", price: 349, stock: 120, status: "published", category: "Clothing", categoryAr: "ملابس", sku: "CLT-001", image: "👕", sold: 89 },
  { id: "P002", name: "Handmade Leather Bag", nameAr: "حقيبة جلد يدوية", description: "Genuine leather handcrafted bag", descriptionAr: "حقيبة جلد طبيعي صناعة يدوية", price: 1250, stock: 35, status: "published", category: "Accessories", categoryAr: "إكسسوارات", sku: "ACC-002", image: "👜", sold: 67 },
  { id: "P003", name: "Aromatic Oud Perfume", nameAr: "عطر عود فاخر", description: "Traditional oud fragrance", descriptionAr: "عطر عود تقليدي", price: 890, stock: 50, status: "published", category: "Beauty", categoryAr: "جمال", sku: "BTY-003", image: "🧴", sold: 54 },
  { id: "P004", name: "Ceramic Coffee Set", nameAr: "طقم فناجين سيراميك", description: "Hand-painted ceramic coffee cups", descriptionAr: "فناجين قهوة سيراميك مرسومة يدوياً", price: 420, stock: 80, status: "published", category: "Home", categoryAr: "منزل", sku: "HOM-004", image: "☕", sold: 43 },
  { id: "P005", name: "Organic Hibiscus Tea", nameAr: "شاي كركديه عضوي", description: "Dried hibiscus flowers for tea", descriptionAr: "زهور كركديه مجففة للشاي", price: 85, stock: 200, status: "published", category: "Food", categoryAr: "طعام", sku: "FOD-005", image: "🌺", sold: 156 },
  { id: "P006", name: "Pharaonic Necklace", nameAr: "عقد فرعوني", description: "Gold-plated pharaonic design", descriptionAr: "تصميم فرعوني مطلي بالذهب", price: 650, stock: 25, status: "published", category: "Jewelry", categoryAr: "مجوهرات", sku: "JWL-006", image: "📿", sold: 38 },
  { id: "P007", name: "Woven Kilim Cushion", nameAr: "وسادة كليم منسوجة", description: "Traditional Egyptian kilim", descriptionAr: "كليم مصري تقليدي", price: 280, stock: 60, status: "published", category: "Home", categoryAr: "منزل", sku: "HOM-007", image: "🛋️", sold: 31 },
  { id: "P008", name: "Date Molasses", nameAr: "عسل أسود (دبس تمر)", description: "Pure date syrup", descriptionAr: "دبس تمر نقي", price: 120, stock: 150, status: "published", category: "Food", categoryAr: "طعام", sku: "FOD-008", image: "🍯", sold: 98 },
  { id: "P009", name: "Linen Summer Dress", nameAr: "فستان كتان صيفي", description: "Breathable linen dress", descriptionAr: "فستان كتان خفيف", price: 580, stock: 40, status: "draft", category: "Clothing", categoryAr: "ملابس", sku: "CLT-009", image: "👗", sold: 0 },
  { id: "P010", name: "Brass Lantern", nameAr: "فانوس نحاسي", description: "Decorative brass lantern", descriptionAr: "فانوس نحاسي للزينة", price: 350, stock: 45, status: "published", category: "Home", categoryAr: "منزل", sku: "HOM-010", image: "🏮", sold: 72 },
  { id: "P011", name: "Coconut Oil Soap", nameAr: "صابون زيت جوز الهند", description: "Natural handmade soap", descriptionAr: "صابون طبيعي يدوي", price: 65, stock: 300, status: "published", category: "Beauty", categoryAr: "جمال", sku: "BTY-011", image: "🧼", sold: 210 },
  { id: "P012", name: "Embroidered Scarf", nameAr: "وشاح مطرز", description: "Hand-embroidered silk scarf", descriptionAr: "وشاح حرير مطرز يدوياً", price: 420, stock: 30, status: "draft", category: "Accessories", categoryAr: "إكسسوارات", sku: "ACC-012", image: "🧣", sold: 0 },
  { id: "P013", name: "Spice Gift Box", nameAr: "علبة هدايا توابل", description: "Assorted Egyptian spices", descriptionAr: "تشكيلة توابل مصرية", price: 195, stock: 90, status: "published", category: "Food", categoryAr: "طعام", sku: "FOD-013", image: "🎁", sold: 45 },
  { id: "P014", name: "Wooden Chess Set", nameAr: "شطرنج خشبي", description: "Hand-carved wooden chess", descriptionAr: "شطرنج خشب منحوت يدوياً", price: 750, stock: 15, status: "archived", category: "Home", categoryAr: "منزل", sku: "HOM-014", image: "♟️", sold: 12 },
  { id: "P015", name: "Cotton Pajama Set", nameAr: "طقم بيجامة قطن", description: "Comfortable cotton sleepwear", descriptionAr: "بيجامة قطن مريحة", price: 310, stock: 70, status: "published", category: "Clothing", categoryAr: "ملابس", sku: "CLT-015", image: "🩳", sold: 63 },
];
