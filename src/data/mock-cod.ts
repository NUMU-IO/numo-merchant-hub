export type CODStatus = "collected" | "in_transit" | "pending" | "settled" | "disputed";

export interface CODTransaction {
  id: string;
  orderId: string;
  customerName: string;
  customerNameAr: string;
  amount: number;
  status: CODStatus;
  courierName: string;
  courierNameAr: string;
  dispatchDate: string;
  deliveryDate: string | null;
  settlementDate: string | null;
  zone: string;
  zoneAr: string;
}

export const codTransactions: CODTransaction[] = [
  { id: "COD-001", orderId: "ORD-1001", customerName: "Mohamed Ali", customerNameAr: "محمد علي", amount: 1250, status: "settled", courierName: "Bosta", courierNameAr: "بوسطة", dispatchDate: "2026-02-08", deliveryDate: "2026-02-10", settlementDate: "2026-02-13", zone: "Cairo", zoneAr: "القاهرة" },
  { id: "COD-002", orderId: "ORD-1002", customerName: "Fatma Hassan", customerNameAr: "فاطمة حسن", amount: 890, status: "settled", courierName: "Bosta", courierNameAr: "بوسطة", dispatchDate: "2026-02-07", deliveryDate: "2026-02-09", settlementDate: "2026-02-12", zone: "Giza", zoneAr: "الجيزة" },
  { id: "COD-003", orderId: "ORD-1003", customerName: "Ahmed Samir", customerNameAr: "أحمد سمير", amount: 2100, status: "collected", courierName: "Aramex", courierNameAr: "أرامكس", dispatchDate: "2026-02-10", deliveryDate: "2026-02-12", settlementDate: null, zone: "Alexandria", zoneAr: "إسكندرية" },
  { id: "COD-004", orderId: "ORD-1004", customerName: "Sara Mahmoud", customerNameAr: "سارة محمود", amount: 675, status: "collected", courierName: "Bosta", courierNameAr: "بوسطة", dispatchDate: "2026-02-11", deliveryDate: "2026-02-13", settlementDate: null, zone: "Cairo", zoneAr: "القاهرة" },
  { id: "COD-005", orderId: "ORD-1005", customerName: "Khaled Nabil", customerNameAr: "خالد نبيل", amount: 3400, status: "in_transit", courierName: "Aramex", courierNameAr: "أرامكس", dispatchDate: "2026-02-13", deliveryDate: null, settlementDate: null, zone: "Mansoura", zoneAr: "المنصورة" },
  { id: "COD-006", orderId: "ORD-1006", customerName: "Nour Adel", customerNameAr: "نور عادل", amount: 1580, status: "in_transit", courierName: "Bosta", courierNameAr: "بوسطة", dispatchDate: "2026-02-13", deliveryDate: null, settlementDate: null, zone: "Tanta", zoneAr: "طنطا" },
  { id: "COD-007", orderId: "ORD-1007", customerName: "Youssef Tarek", customerNameAr: "يوسف طارق", amount: 920, status: "pending", courierName: "Bosta", courierNameAr: "بوسطة", dispatchDate: "2026-02-14", deliveryDate: null, settlementDate: null, zone: "Cairo", zoneAr: "القاهرة" },
  { id: "COD-008", orderId: "ORD-1008", customerName: "Mona Sherif", customerNameAr: "منى شريف", amount: 1850, status: "pending", courierName: "Aramex", courierNameAr: "أرامكس", dispatchDate: "2026-02-14", deliveryDate: null, settlementDate: null, zone: "Assiut", zoneAr: "أسيوط" },
  { id: "COD-009", orderId: "ORD-1009", customerName: "Hassan Ibrahim", customerNameAr: "حسن إبراهيم", amount: 4200, status: "disputed", courierName: "Bosta", courierNameAr: "بوسطة", dispatchDate: "2026-02-05", deliveryDate: "2026-02-07", settlementDate: null, zone: "Cairo", zoneAr: "القاهرة" },
  { id: "COD-010", orderId: "ORD-1010", customerName: "Dina Kamal", customerNameAr: "دينا كمال", amount: 560, status: "settled", courierName: "Aramex", courierNameAr: "أرامكس", dispatchDate: "2026-02-06", deliveryDate: "2026-02-08", settlementDate: "2026-02-11", zone: "Alexandria", zoneAr: "إسكندرية" },
  { id: "COD-011", orderId: "ORD-1011", customerName: "Omar Fathy", customerNameAr: "عمر فتحي", amount: 1320, status: "collected", courierName: "Bosta", courierNameAr: "بوسطة", dispatchDate: "2026-02-12", deliveryDate: "2026-02-14", settlementDate: null, zone: "Giza", zoneAr: "الجيزة" },
  { id: "COD-012", orderId: "ORD-1012", customerName: "Layla Mostafa", customerNameAr: "ليلى مصطفى", amount: 2750, status: "in_transit", courierName: "Aramex", courierNameAr: "أرامكس", dispatchDate: "2026-02-14", deliveryDate: null, settlementDate: null, zone: "Luxor", zoneAr: "الأقصر" },
];

export const codSummary = {
  totalCOD: codTransactions.reduce((sum, t) => sum + t.amount, 0),
  settled: codTransactions.filter(t => t.status === "settled").reduce((sum, t) => sum + t.amount, 0),
  collected: codTransactions.filter(t => t.status === "collected").reduce((sum, t) => sum + t.amount, 0),
  inTransit: codTransactions.filter(t => t.status === "in_transit").reduce((sum, t) => sum + t.amount, 0),
  pending: codTransactions.filter(t => t.status === "pending").reduce((sum, t) => sum + t.amount, 0),
  disputed: codTransactions.filter(t => t.status === "disputed").reduce((sum, t) => sum + t.amount, 0),
  settledCount: codTransactions.filter(t => t.status === "settled").length,
  collectedCount: codTransactions.filter(t => t.status === "collected").length,
  inTransitCount: codTransactions.filter(t => t.status === "in_transit").length,
  pendingCount: codTransactions.filter(t => t.status === "pending").length,
  disputedCount: codTransactions.filter(t => t.status === "disputed").length,
  totalCount: codTransactions.length,
};
