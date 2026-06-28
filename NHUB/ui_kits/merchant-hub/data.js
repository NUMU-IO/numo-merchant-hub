/* NUMU mock data + bilingual (EN / Egyptian-colloquial AR) strings.
   Product names & categories lifted from the real app's mock-products.ts. */

const FMT = (egp, ar) => ar ? `${egp.toLocaleString("ar-EG")} ج.م` : `EGP ${egp.toLocaleString()}`;

const NAV = [
  { key: "dashboard", en: "Dashboard", ar: "لوحة التحكم", icon: "house", group: "main" },
  { key: "orders",    en: "Orders",    ar: "الطلبات",     icon: "shopping-cart", group: "main", count: 6 },
  { key: "products",  en: "Products",  ar: "المنتجات",    icon: "package", group: "main" },
  { key: "customers", en: "Customers", ar: "العملاء",     icon: "users", group: "main" },
  { key: "categories",en: "Categories",ar: "الفئات",      icon: "folders", group: "main" },
  { key: "discounts", en: "Discounts", ar: "الخصومات",    icon: "tag", group: "sell" },
  { key: "marketing", en: "Marketing", ar: "التسويق",     icon: "megaphone", group: "sell" },
  { key: "analytics", en: "Analytics", ar: "التحليلات",   icon: "chart-bar", group: "sell" },
  { key: "store",     en: "Online Store", ar: "المتجر الإلكتروني", icon: "storefront", group: "sell" },
  { key: "payments",  en: "Finance",   ar: "المالية",     icon: "currency-circle-dollar", group: "ops" },
  { key: "logistics", en: "Logistics", ar: "الشحن والتوصيل", icon: "truck", group: "ops" },
  { key: "cod",       en: "COD",       ar: "الدفع عند الاستلام", icon: "money", group: "ops" },
];

const PRODUCTS = [
  { id: "P001", en: "Egyptian Cotton T-Shirt", ar: "تيشيرت قطن مصري", cat: "Clothing", catAr: "ملابس", price: 349, was: 450, stock: 120, sold: 89, status: "published", img: "👕" },
  { id: "P002", en: "Handmade Leather Bag", ar: "حقيبة جلد يدوية", cat: "Accessories", catAr: "إكسسوارات", price: 1250, stock: 35, sold: 67, status: "published", img: "👜" },
  { id: "P003", en: "Aromatic Oud Perfume", ar: "عطر عود فاخر", cat: "Beauty", catAr: "جمال", price: 890, stock: 50, sold: 54, status: "published", img: "🧴" },
  { id: "P004", en: "Ceramic Coffee Set", ar: "طقم فناجين سيراميك", cat: "Home", catAr: "منزل", price: 420, stock: 80, sold: 43, status: "published", img: "☕" },
  { id: "P005", en: "Organic Hibiscus Tea", ar: "شاي كركديه عضوي", cat: "Food", catAr: "طعام", price: 85, stock: 200, sold: 156, status: "published", img: "🌺" },
  { id: "P006", en: "Pharaonic Necklace", ar: "عقد فرعوني", cat: "Jewelry", catAr: "مجوهرات", price: 650, stock: 8, sold: 38, status: "published", img: "📿" },
  { id: "P009", en: "Linen Summer Dress", ar: "فستان كتان صيفي", cat: "Clothing", catAr: "ملابس", price: 580, stock: 40, sold: 0, status: "draft", img: "👗" },
  { id: "P010", en: "Brass Lantern", ar: "فانوس نحاسي", cat: "Home", catAr: "منزل", price: 350, stock: 45, sold: 72, status: "published", img: "🏮" },
  { id: "P011", en: "Coconut Oil Soap", ar: "صابون زيت جوز الهند", cat: "Beauty", catAr: "جمال", price: 65, stock: 6, sold: 210, status: "published", img: "🧼" },
];

const NAMES = [
  { en: "Mariam Hassan", ar: "مريم حسن", city: "Cairo", cityAr: "القاهرة" },
  { en: "Omar Khaled", ar: "عمر خالد", city: "Giza", cityAr: "الجيزة" },
  { en: "Salma Adel", ar: "سلمى عادل", city: "Alexandria", cityAr: "الإسكندرية" },
  { en: "Youssef Tarek", ar: "يوسف طارق", city: "Mansoura", cityAr: "المنصورة" },
  { en: "Nour Ibrahim", ar: "نور إبراهيم", city: "Tanta", cityAr: "طنطا" },
  { en: "Karim Fathy", ar: "كريم فتحي", city: "Cairo", cityAr: "القاهرة" },
  { en: "Habiba Sherif", ar: "حبيبة شريف", city: "Aswan", cityAr: "أسوان" },
];

const ORDERS = [
  { id: "#NM-2841", who: 0, total: 1599, pay: "cod",      status: "pending",    items: 2, ago: "5m" },
  { id: "#NM-2840", who: 1, total: 349,  pay: "paid",     status: "processing", items: 1, ago: "22m" },
  { id: "#NM-2839", who: 2, total: 2140, pay: "paid",     status: "shipped",    items: 3, ago: "1h" },
  { id: "#NM-2838", who: 3, total: 650,  pay: "cod",      status: "delivered",  items: 1, ago: "3h" },
  { id: "#NM-2837", who: 4, total: 890,  pay: "paid",     status: "confirmed",  items: 1, ago: "5h" },
  { id: "#NM-2836", who: 5, total: 470,  pay: "cod",      status: "pending",    items: 2, ago: "6h" },
  { id: "#NM-2835", who: 6, total: 1250, pay: "paid",     status: "delivered",  items: 1, ago: "Yesterday", agoAr: "إمبارح" },
  { id: "#NM-2834", who: 0, total: 215,  pay: "refunded", status: "cancelled",  items: 1, ago: "Yesterday", agoAr: "إمبارح" },
];

const CUSTOMERS = [
  { who: 0, orders: 14, spent: 18420, tag: "VIP" },
  { who: 5, orders: 9,  spent: 11200, tag: "Loyal", tagAr: "وفي" },
  { who: 2, orders: 6,  spent: 7850,  tag: "Loyal", tagAr: "وفي" },
  { who: 1, orders: 3,  spent: 2410,  tag: "New", tagAr: "جديد" },
  { who: 4, orders: 2,  spent: 1305,  tag: "New", tagAr: "جديد" },
  { who: 6, orders: 1,  spent: 650,   tag: "New", tagAr: "جديد" },
];

// revenue spark (last 7 days, in EGP)
const SPARK = [3200, 4100, 3800, 5200, 4800, 6400, 7250];
const ORDERS_SPARK = [22, 28, 26, 35, 31, 42, 48];

const STATUS = {
  pending:    { en: "Pending",    ar: "في الانتظار", v: "--st-pending" },
  processing: { en: "Processing", ar: "بيتجهز",      v: "--st-processing" },
  confirmed:  { en: "Confirmed",  ar: "متأكد",       v: "--st-confirmed" },
  shipped:    { en: "Shipped",    ar: "اتشحن",       v: "--st-shipped" },
  delivered:  { en: "Delivered",  ar: "اتسلّم",      v: "--st-delivered" },
  cancelled:  { en: "Cancelled",  ar: "ملغي",        v: "--st-cancelled" },
};
const PAY = {
  cod:      { en: "COD",      ar: "عند الاستلام" },
  paid:     { en: "Paid",     ar: "مدفوع" },
  refunded: { en: "Refunded", ar: "مسترجع" },
};

const T = {
  greetMorning: { en: "Good morning", ar: "صباح الفل" },
  merchant: { en: "Ahmed", ar: "أحمد" },
  summary: { en: "You have 2 orders needing attention — and sales are up", ar: "عندك طلبين محتاجين اهتمامك — والمبيعات في تحسّن" },
  viewStore: { en: "View store", ar: "شوف المتجر" },
  addProduct: { en: "Add product", ar: "ضيف منتج" },
  search: { en: "Search products, orders…", ar: "دوّر في المنتجات والطلبات…" },
  sales: { en: "Sales", ar: "المبيعات" },
  orders: { en: "Orders", ar: "الطلبات" },
  visitors: { en: "Visitors", ar: "الزيارات" },
  aov: { en: "Avg. order", ar: "متوسط الطلب" },
  last7: { en: "Last 7 days", ar: "آخر ٧ أيام" },
  liveNow: { en: "live now", ar: "زائر دلوقتي" },
  attention: { en: "Needs your attention", ar: "محتاج اهتمامك" },
  pendingOrders: { en: "orders waiting to be fulfilled", ar: "طلبات مستنية التجهيز" },
  lowStock: { en: "products are low on stock", ar: "منتجات مخزونها قرب يخلص" },
  recentOrders: { en: "Recent orders", ar: "آخر الطلبات" },
  topProducts: { en: "Top sellers", ar: "الأكتر مبيعاً" },
  viewAll: { en: "View all", ar: "شوف الكل" },
  setup: { en: "Finish setting up your store", ar: "كمّل تجهيز متجرك" },
  setupSub: { en: "Complete all steps & get 1 month Premium free", ar: "كمّل كل الخطوات واكسب شهر Premium مجاناً" },
  customer: { en: "Customer", ar: "العميل" },
  total: { en: "Total", ar: "الإجمالي" },
  payment: { en: "Payment", ar: "الدفع" },
  status: { en: "Status", ar: "الحالة" },
  product: { en: "Product", ar: "المنتج" },
  price: { en: "Price", ar: "السعر" },
  stock: { en: "Stock", ar: "المخزون" },
  sold: { en: "Sold", ar: "اتباع" },
  all: { en: "All", ar: "الكل" },
  spent: { en: "spent", ar: "اشترى بـ" },
  ordersCount: { en: "orders", ar: "طلب" },
  sold_u: { en: "sold", ar: "مبيعة" },
  inStock: { en: "in stock", ar: "في المخزن" },
  units: { en: "units", ar: "قطعة" },
  filterBy: { en: "Filter", ar: "تصفية" },
  export: { en: "Export", ar: "تصدير" },
};

Object.assign(window, { FMT, NAV, PRODUCTS, NAMES, ORDERS, CUSTOMERS, SPARK, ORDERS_SPARK, STATUS, PAY, T });
