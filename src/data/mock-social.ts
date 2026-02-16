export interface SocialPost {
  id: string;
  platform: "instagram" | "facebook";
  imageEmoji: string;
  caption: string;
  captionAr: string;
  likes: number;
  comments: number;
  date: string;
  imported: boolean;
  suggestedName: string;
  suggestedNameAr: string;
  suggestedPrice: number;
}

export interface SocialAccount {
  id: string;
  platform: "instagram" | "facebook";
  handle: string;
  followers: number;
  posts: number;
  connected: boolean;
  avatar: string;
}

export const socialAccounts: SocialAccount[] = [
  { id: "ig1", platform: "instagram", handle: "@numu.egypt", followers: 12400, posts: 156, connected: true, avatar: "📸" },
  { id: "fb1", platform: "facebook", handle: "NUMU Store Egypt", followers: 8200, posts: 89, connected: false, avatar: "👤" },
];

export const socialPosts: SocialPost[] = [
  { id: "sp1", platform: "instagram", imageEmoji: "👕", caption: "New drop! Premium Egyptian cotton tee 🔥", captionAr: "وصل جديد! تيشيرت قطن مصري فاخر 🔥", likes: 342, comments: 28, date: "2026-02-14", imported: false, suggestedName: "Egyptian Cotton Tee", suggestedNameAr: "تيشيرت قطن مصري", suggestedPrice: 349 },
  { id: "sp2", platform: "instagram", imageEmoji: "👜", caption: "Handcrafted leather perfection ✨", captionAr: "جلد مصنوع يدوي بإتقان ✨", likes: 521, comments: 45, date: "2026-02-13", imported: true, suggestedName: "Handmade Leather Bag", suggestedNameAr: "حقيبة جلد يدوية", suggestedPrice: 1250 },
  { id: "sp3", platform: "instagram", imageEmoji: "🧴", caption: "Our bestselling Oud fragrance 🌙", captionAr: "أكتر عطر عود مبيعاً عندنا 🌙", likes: 789, comments: 67, date: "2026-02-12", imported: false, suggestedName: "Aromatic Oud Perfume", suggestedNameAr: "عطر عود فاخر", suggestedPrice: 890 },
  { id: "sp4", platform: "instagram", imageEmoji: "📿", caption: "Ancient Egyptian inspired jewelry 👑", captionAr: "مجوهرات مستوحاة من مصر القديمة 👑", likes: 456, comments: 34, date: "2026-02-11", imported: false, suggestedName: "Pharaonic Necklace", suggestedNameAr: "عقد فرعوني", suggestedPrice: 650 },
  { id: "sp5", platform: "instagram", imageEmoji: "🌺", caption: "Organic hibiscus from Aswan farms 🌿", captionAr: "كركديه عضوي من مزارع أسوان 🌿", likes: 234, comments: 19, date: "2026-02-10", imported: true, suggestedName: "Organic Hibiscus Tea", suggestedNameAr: "شاي كركديه عضوي", suggestedPrice: 85 },
  { id: "sp6", platform: "facebook", imageEmoji: "☕", caption: "Beautiful ceramic coffee set - limited edition!", captionAr: "طقم فناجين سيراميك - إصدار محدود!", likes: 178, comments: 22, date: "2026-02-13", imported: false, suggestedName: "Ceramic Coffee Set", suggestedNameAr: "طقم فناجين سيراميك", suggestedPrice: 420 },
  { id: "sp7", platform: "facebook", imageEmoji: "👗", caption: "Summer linen collection now available 🌞", captionAr: "كولكشن الكتان الصيفي متاح دلوقتي 🌞", likes: 312, comments: 41, date: "2026-02-12", imported: false, suggestedName: "Linen Summer Dress", suggestedNameAr: "فستان كتان صيفي", suggestedPrice: 580 },
  { id: "sp8", platform: "facebook", imageEmoji: "🧣", caption: "Hand-embroidered scarves - each one unique 🎨", captionAr: "أوشحة مطرزة يدوي - كل واحد فريد 🎨", likes: 267, comments: 33, date: "2026-02-11", imported: true, suggestedName: "Embroidered Scarf", suggestedNameAr: "وشاح مطرز", suggestedPrice: 420 },
  { id: "sp9", platform: "facebook", imageEmoji: "🏮", caption: "Ramadan special: Brass lanterns handmade in Khan El Khalili", captionAr: "عرض رمضان: فوانيس نحاس مصنوعة في خان الخليلي", likes: 445, comments: 56, date: "2026-02-10", imported: false, suggestedName: "Brass Lantern", suggestedNameAr: "فانوس نحاسي", suggestedPrice: 350 },
];
