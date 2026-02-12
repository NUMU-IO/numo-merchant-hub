export type PaymentStatus = "paid" | "unpaid" | "cod";
export type FulfillmentStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export interface OrderItem {
  productId: string;
  name: string;
  nameAr: string;
  qty: number;
  price: number;
  image: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerNameAr: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  total: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  items: OrderItem[];
  shippingAddress: string;
  shippingAddressAr: string;
  shippingCost: number;
  timeline: { status: string; statusAr: string; date: string }[];
}

export const orders: Order[] = [
  {
    id: "O001", orderNumber: "#1001", customerName: "Sara Mohamed", customerNameAr: "سارة محمد",
    customerEmail: "sara@email.com", customerPhone: "+201012345678", date: "2026-02-12",
    total: 1599, paymentStatus: "paid", fulfillmentStatus: "delivered",
    items: [
      { productId: "P001", name: "Egyptian Cotton T-Shirt", nameAr: "تيشيرت قطن مصري", qty: 2, price: 349, image: "👕" },
      { productId: "P005", name: "Organic Hibiscus Tea", nameAr: "شاي كركديه عضوي", qty: 3, price: 85, image: "🌺" },
    ],
    shippingAddress: "12 Tahrir St, Cairo", shippingAddressAr: "١٢ شارع التحرير، القاهرة", shippingCost: 35,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-10" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-10" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-11" },
      { status: "Delivered", statusAr: "تم التسليم", date: "2026-02-12" },
    ],
  },
  {
    id: "O002", orderNumber: "#1002", customerName: "Omar Hassan", customerNameAr: "عمر حسن",
    customerEmail: "omar@email.com", customerPhone: "+201098765432", date: "2026-02-12",
    total: 1250, paymentStatus: "cod", fulfillmentStatus: "shipped",
    items: [{ productId: "P002", name: "Handmade Leather Bag", nameAr: "حقيبة جلد يدوية", qty: 1, price: 1250, image: "👜" }],
    shippingAddress: "45 Corniche Rd, Alexandria", shippingAddressAr: "٤٥ طريق الكورنيش، الإسكندرية", shippingCost: 50,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-11" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-11" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-12" },
    ],
  },
  {
    id: "O003", orderNumber: "#1003", customerName: "Fatma Ali", customerNameAr: "فاطمة علي",
    customerEmail: "fatma@email.com", customerPhone: "+201155566677", date: "2026-02-11",
    total: 890, paymentStatus: "paid", fulfillmentStatus: "processing",
    items: [{ productId: "P003", name: "Aromatic Oud Perfume", nameAr: "عطر عود فاخر", qty: 1, price: 890, image: "🧴" }],
    shippingAddress: "8 Nile St, Giza", shippingAddressAr: "٨ شارع النيل، الجيزة", shippingCost: 35,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-11" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-11" },
    ],
  },
  {
    id: "O004", orderNumber: "#1004", customerName: "Khaled Ibrahim", customerNameAr: "خالد إبراهيم",
    customerEmail: "khaled@email.com", customerPhone: "+201234567890", date: "2026-02-11",
    total: 770, paymentStatus: "paid", fulfillmentStatus: "delivered",
    items: [
      { productId: "P004", name: "Ceramic Coffee Set", nameAr: "طقم فناجين سيراميك", qty: 1, price: 420, image: "☕" },
      { productId: "P010", name: "Brass Lantern", nameAr: "فانوس نحاسي", qty: 1, price: 350, image: "🏮" },
    ],
    shippingAddress: "22 Garden City, Cairo", shippingAddressAr: "٢٢ جاردن سيتي، القاهرة", shippingCost: 0,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-09" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-09" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-10" },
      { status: "Delivered", statusAr: "تم التسليم", date: "2026-02-11" },
    ],
  },
  {
    id: "O005", orderNumber: "#1005", customerName: "Nour Youssef", customerNameAr: "نور يوسف",
    customerEmail: "nour@email.com", customerPhone: "+201011122233", date: "2026-02-11",
    total: 650, paymentStatus: "unpaid", fulfillmentStatus: "pending",
    items: [{ productId: "P006", name: "Pharaonic Necklace", nameAr: "عقد فرعوني", qty: 1, price: 650, image: "📿" }],
    shippingAddress: "15 Zamalek, Cairo", shippingAddressAr: "١٥ الزمالك، القاهرة", shippingCost: 35,
    timeline: [{ status: "Order placed", statusAr: "تم الطلب", date: "2026-02-11" }],
  },
  {
    id: "O006", orderNumber: "#1006", customerName: "Amira Mostafa", customerNameAr: "أميرة مصطفى",
    customerEmail: "amira@email.com", customerPhone: "+201099988877", date: "2026-02-10",
    total: 475, paymentStatus: "paid", fulfillmentStatus: "delivered",
    items: [
      { productId: "P005", name: "Organic Hibiscus Tea", nameAr: "شاي كركديه عضوي", qty: 2, price: 85, image: "🌺" },
      { productId: "P013", name: "Spice Gift Box", nameAr: "علبة هدايا توابل", qty: 1, price: 195, image: "🎁" },
      { productId: "P008", name: "Date Molasses", nameAr: "عسل أسود", qty: 1, price: 120, image: "🍯" },
    ],
    shippingAddress: "33 Maadi, Cairo", shippingAddressAr: "٣٣ المعادي، القاهرة", shippingCost: 0,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-08" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-08" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-09" },
      { status: "Delivered", statusAr: "تم التسليم", date: "2026-02-10" },
    ],
  },
  {
    id: "O007", orderNumber: "#1007", customerName: "Youssef Kamal", customerNameAr: "يوسف كمال",
    customerEmail: "youssef@email.com", customerPhone: "+201277766655", date: "2026-02-10",
    total: 580, paymentStatus: "cod", fulfillmentStatus: "shipped",
    items: [{ productId: "P009", name: "Linen Summer Dress", nameAr: "فستان كتان صيفي", qty: 1, price: 580, image: "👗" }],
    shippingAddress: "7 Smouha, Alexandria", shippingAddressAr: "٧ سموحة، الإسكندرية", shippingCost: 50,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-09" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-10" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-10" },
    ],
  },
  {
    id: "O008", orderNumber: "#1008", customerName: "Hana Adel", customerNameAr: "هنا عادل",
    customerEmail: "hana@email.com", customerPhone: "+201166655544", date: "2026-02-10",
    total: 130, paymentStatus: "paid", fulfillmentStatus: "delivered",
    items: [
      { productId: "P011", name: "Coconut Oil Soap", nameAr: "صابون زيت جوز الهند", qty: 2, price: 65, image: "🧼" },
    ],
    shippingAddress: "19 Heliopolis, Cairo", shippingAddressAr: "١٩ مصر الجديدة، القاهرة", shippingCost: 35,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-08" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-09" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-09" },
      { status: "Delivered", statusAr: "تم التسليم", date: "2026-02-10" },
    ],
  },
  {
    id: "O009", orderNumber: "#1009", customerName: "Ali Mahmoud", customerNameAr: "علي محمود",
    customerEmail: "ali@email.com", customerPhone: "+201022233344", date: "2026-02-09",
    total: 280, paymentStatus: "paid", fulfillmentStatus: "cancelled",
    items: [{ productId: "P007", name: "Woven Kilim Cushion", nameAr: "وسادة كليم منسوجة", qty: 1, price: 280, image: "🛋️" }],
    shippingAddress: "5 Aswan", shippingAddressAr: "٥ أسوان", shippingCost: 75,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-09" },
      { status: "Cancelled", statusAr: "ملغي", date: "2026-02-09" },
    ],
  },
  {
    id: "O010", orderNumber: "#1010", customerName: "Dina Samir", customerNameAr: "دينا سمير",
    customerEmail: "dina@email.com", customerPhone: "+201288899900", date: "2026-02-09",
    total: 1540, paymentStatus: "paid", fulfillmentStatus: "delivered",
    items: [
      { productId: "P003", name: "Aromatic Oud Perfume", nameAr: "عطر عود فاخر", qty: 1, price: 890, image: "🧴" },
      { productId: "P006", name: "Pharaonic Necklace", nameAr: "عقد فرعوني", qty: 1, price: 650, image: "📿" },
    ],
    shippingAddress: "28 Dokki, Giza", shippingAddressAr: "٢٨ الدقي، الجيزة", shippingCost: 0,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-07" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-07" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-08" },
      { status: "Delivered", statusAr: "تم التسليم", date: "2026-02-09" },
    ],
  },
  {
    id: "O011", orderNumber: "#1011", customerName: "Mohamed Fathy", customerNameAr: "محمد فتحي",
    customerEmail: "mfathy@email.com", customerPhone: "+201033344455", date: "2026-02-09",
    total: 310, paymentStatus: "cod", fulfillmentStatus: "pending",
    items: [{ productId: "P015", name: "Cotton Pajama Set", nameAr: "طقم بيجامة قطن", qty: 1, price: 310, image: "🩳" }],
    shippingAddress: "11 Mansoura", shippingAddressAr: "١١ المنصورة", shippingCost: 60,
    timeline: [{ status: "Order placed", statusAr: "تم الطلب", date: "2026-02-09" }],
  },
  {
    id: "O012", orderNumber: "#1012", customerName: "Layla Ashraf", customerNameAr: "ليلى أشرف",
    customerEmail: "layla@email.com", customerPhone: "+201155577788", date: "2026-02-08",
    total: 420, paymentStatus: "paid", fulfillmentStatus: "processing",
    items: [{ productId: "P012", name: "Embroidered Scarf", nameAr: "وشاح مطرز", qty: 1, price: 420, image: "🧣" }],
    shippingAddress: "3 Tanta", shippingAddressAr: "٣ طنطا", shippingCost: 50,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-08" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-08" },
    ],
  },
  {
    id: "O013", orderNumber: "#1013", customerName: "Tamer Gamal", customerNameAr: "تامر جمال",
    customerEmail: "tamer@email.com", customerPhone: "+201066677788", date: "2026-02-08",
    total: 750, paymentStatus: "paid", fulfillmentStatus: "shipped",
    items: [{ productId: "P014", name: "Wooden Chess Set", nameAr: "شطرنج خشبي", qty: 1, price: 750, image: "♟️" }],
    shippingAddress: "9 Luxor", shippingAddressAr: "٩ الأقصر", shippingCost: 75,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-07" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-07" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-08" },
    ],
  },
  {
    id: "O014", orderNumber: "#1014", customerName: "Reem Hossam", customerNameAr: "ريم حسام",
    customerEmail: "reem@email.com", customerPhone: "+201244455566", date: "2026-02-07",
    total: 195, paymentStatus: "paid", fulfillmentStatus: "delivered",
    items: [{ productId: "P013", name: "Spice Gift Box", nameAr: "علبة هدايا توابل", qty: 1, price: 195, image: "🎁" }],
    shippingAddress: "16 Nasr City, Cairo", shippingAddressAr: "١٦ مدينة نصر، القاهرة", shippingCost: 35,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-06" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-06" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-07" },
      { status: "Delivered", statusAr: "تم التسليم", date: "2026-02-07" },
    ],
  },
  {
    id: "O015", orderNumber: "#1015", customerName: "Bassem Nabil", customerNameAr: "باسم نبيل",
    customerEmail: "bassem@email.com", customerPhone: "+201077788899", date: "2026-02-07",
    total: 349, paymentStatus: "unpaid", fulfillmentStatus: "cancelled",
    items: [{ productId: "P001", name: "Egyptian Cotton T-Shirt", nameAr: "تيشيرت قطن مصري", qty: 1, price: 349, image: "👕" }],
    shippingAddress: "21 Port Said", shippingAddressAr: "٢١ بورسعيد", shippingCost: 60,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-07" },
      { status: "Cancelled", statusAr: "ملغي", date: "2026-02-07" },
    ],
  },
  {
    id: "O016", orderNumber: "#1016", customerName: "Mona Sayed", customerNameAr: "منى سيد",
    customerEmail: "mona@email.com", customerPhone: "+201199900011", date: "2026-02-06",
    total: 930, paymentStatus: "paid", fulfillmentStatus: "delivered",
    items: [
      { productId: "P001", name: "Egyptian Cotton T-Shirt", nameAr: "تيشيرت قطن مصري", qty: 1, price: 349, image: "👕" },
      { productId: "P009", name: "Linen Summer Dress", nameAr: "فستان كتان صيفي", qty: 1, price: 580, image: "👗" },
    ],
    shippingAddress: "14 October City", shippingAddressAr: "١٤ مدينة أكتوبر", shippingCost: 35,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-04" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-04" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-05" },
      { status: "Delivered", statusAr: "تم التسليم", date: "2026-02-06" },
    ],
  },
  {
    id: "O017", orderNumber: "#1017", customerName: "Ahmed Tarek", customerNameAr: "أحمد طارق",
    customerEmail: "atarek@email.com", customerPhone: "+201022211133", date: "2026-02-06",
    total: 1250, paymentStatus: "paid", fulfillmentStatus: "shipped",
    items: [{ productId: "P002", name: "Handmade Leather Bag", nameAr: "حقيبة جلد يدوية", qty: 1, price: 1250, image: "👜" }],
    shippingAddress: "6 Hurghada", shippingAddressAr: "٦ الغردقة", shippingCost: 75,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-05" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-05" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-06" },
    ],
  },
  {
    id: "O018", orderNumber: "#1018", customerName: "Salma Wael", customerNameAr: "سلمى وائل",
    customerEmail: "salma@email.com", customerPhone: "+201233344455", date: "2026-02-05",
    total: 170, paymentStatus: "paid", fulfillmentStatus: "delivered",
    items: [
      { productId: "P005", name: "Organic Hibiscus Tea", nameAr: "شاي كركديه عضوي", qty: 1, price: 85, image: "🌺" },
      { productId: "P005", name: "Organic Hibiscus Tea", nameAr: "شاي كركديه عضوي", qty: 1, price: 85, image: "🌺" },
    ],
    shippingAddress: "10 Sharm El Sheikh", shippingAddressAr: "١٠ شرم الشيخ", shippingCost: 75,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-03" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-04" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-04" },
      { status: "Delivered", statusAr: "تم التسليم", date: "2026-02-05" },
    ],
  },
  {
    id: "O019", orderNumber: "#1019", customerName: "Karim Adham", customerNameAr: "كريم أدهم",
    customerEmail: "karim@email.com", customerPhone: "+201055566677", date: "2026-02-05",
    total: 350, paymentStatus: "cod", fulfillmentStatus: "pending",
    items: [{ productId: "P010", name: "Brass Lantern", nameAr: "فانوس نحاسي", qty: 1, price: 350, image: "🏮" }],
    shippingAddress: "4 Suez", shippingAddressAr: "٤ السويس", shippingCost: 60,
    timeline: [{ status: "Order placed", statusAr: "تم الطلب", date: "2026-02-05" }],
  },
  {
    id: "O020", orderNumber: "#1020", customerName: "Yasmin Sherif", customerNameAr: "ياسمين شريف",
    customerEmail: "yasmin@email.com", customerPhone: "+201166677788", date: "2026-02-04",
    total: 698, paymentStatus: "paid", fulfillmentStatus: "delivered",
    items: [{ productId: "P001", name: "Egyptian Cotton T-Shirt", nameAr: "تيشيرت قطن مصري", qty: 2, price: 349, image: "👕" }],
    shippingAddress: "27 New Cairo", shippingAddressAr: "٢٧ القاهرة الجديدة", shippingCost: 35,
    timeline: [
      { status: "Order placed", statusAr: "تم الطلب", date: "2026-02-02" },
      { status: "Processing", statusAr: "قيد المعالجة", date: "2026-02-02" },
      { status: "Shipped", statusAr: "تم الشحن", date: "2026-02-03" },
      { status: "Delivered", statusAr: "تم التسليم", date: "2026-02-04" },
    ],
  },
];
