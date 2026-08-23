import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { formatMoney } from "@/lib/format-money";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  listShipments, getShipmentStats, getCodSummary,
  createShipment, bulkCreateShipments, cancelShipment, trackShipment,
  getAwbUrl, fetchBostaCredentials, saveBostaCredentials, deleteBostaCredentials,
  getShipment, getBostaCities,
  type Shipment, type BostaCredentials, type TrackingInfo, type BulkShipmentResult,
} from "@/services/shipmentApi";
import { StatTile } from "@/components/ui/stat-tile";
import { ShippingSetupHero, type SetupStep } from "@/components/logistics/ShippingSetupHero";
import { ZonesOverviewCard } from "@/components/logistics/ZonesOverviewCard";
import { useShippingZones, useShippingCoverage, useReferenceGovernorates } from "@/hooks/useShippingZones";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  fetchShippingSettings, addShippingZone, deleteShippingZone, updateShippingSettings,
  type ShippingSettings,
} from "@/services/storeApi";
import {
  Package, Truck, Eye, EyeOff, Loader2, Plus, Trash2,
  Check, ExternalLink, Printer, ChevronLeft, ChevronRight, Upload,
  PackageCheck, CircleDollarSign, Search, MapPin, ArrowUpRight,
  Zap, ArrowLeft, XCircle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   REAL BOSTA LOGO SVG (from docs.bosta.co/img/logo.svg)
   ═══════════════════════════════════════════════════════════════════════ */

const BostaLogo = ({ className = "", height = 20 }: { className?: string; height?: number }) => {
  const w = (222 / 68) * height;
  return (
    <svg width={w} height={height} viewBox="0 0 222 68" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M65.244 17.666L35.544.533a3.78 3.78 0 00-3.87 0l-29.7 17.133C.79 18.376 0 19.639 0 21.06v25.107c0 1.421.71 2.684 1.975 3.395l29.7 17.133c.631.315 1.263.552 1.974.552.71 0 1.343-.158 1.975-.552l29.7-17.133c1.184-.71 1.974-1.974 1.974-3.395V21.06a4.24 4.24 0 00-2.054-3.394zM60.347 39.93l-10.98-6.316 10.98-6.316V39.93zM33.649 7.323L57.424 21.06 33.65 34.798 9.795 21.06 33.649 7.323zM6.872 27.219l10.98 6.316-10.98 6.316V27.219zm26.777 32.607L9.795 46.088l14.85-8.606 6.95 4.027c.632.316 1.264.553 1.975.553.71 0 1.343-.158 1.975-.553l6.95-4.027 14.85 8.606L33.65 59.826zm97.55-36.239c-8.215 0-13.902 5.605-13.902 13.659 0 8.053 5.687 13.658 13.823 13.658 8.215 0 13.902-5.605 13.902-13.659 0-8.053-5.687-13.658-13.823-13.658zm0 21.08c-4.265 0-6.951-2.921-6.951-7.422 0-4.5 2.765-7.421 6.951-7.421 4.107 0 6.951 3 6.951 7.421-.079 4.422-2.844 7.422-6.951 7.422zm29.147-10.264c-3.239-.474-6.082-.868-6.082-3.079 0-1.105.789-2.526 4.423-2.526 2.922 0 5.055 1.263 5.687 3.474l6.24-1.422c-1.343-4.737-5.45-7.342-11.532-7.342-6.793 0-11.374 3.158-11.374 7.895 0 6.632 5.845 7.422 10.584 8.132 3.317.474 6.24.869 6.24 3.237 0 1.263-.948 2.763-5.45 2.763-3.397 0-5.687-1.263-6.398-3.552l-6.24 1.263c1.422 4.895 5.687 7.5 12.48 7.5 7.504 0 12.243-3.158 12.243-8.21.079-6.554-5.924-7.422-10.821-8.133zm23.933 10.58c-2.054 0-3.239-1.421-3.239-3.869V30.061h10.585v-5.764H181.04v-8.053h-6.871v24.95c0 6.236 3.475 9.79 9.478 9.79 5.213 0 8.61-2.37 9.795-6.79l-5.53-1.738c-.631 1.58-1.895 2.527-3.633 2.527zm30.726-17.37l-.237-.315c-1.737-2.448-4.581-3.711-8.372-3.711-6.951 0-11.928 5.763-11.928 13.659 0 7.974 4.977 13.737 11.77 13.737 3.791 0 6.635-1.342 8.451-3.947l.237-.316v.079l1.343 3.474h5.45V24.376h-5.45l-1.264 3.237zm-6.951 17.054c-4.028 0-6.714-2.921-6.714-7.5 0-4.5 2.607-7.422 6.714-7.422 4.108 0 6.793 2.921 6.793 7.422 0 4.5-2.764 7.5-6.793 7.5zm-105.212-21.08c-3.633 0-6.398 1.264-8.214 3.711l-.395.553V16.324H87.36v33.949h5.45l1.422-3.632.237.316c1.895 2.684 4.739 4.027 8.451 4.027 6.951 0 11.77-5.606 11.77-13.66-.079-8.131-4.898-13.737-11.849-13.737zm-1.737 21.08c-3.16 0-6.872-1.263-6.872-7.5 0-4.58 2.685-7.5 6.951-7.5 3.949 0 6.556 3 6.556 7.5-.079 4.5-2.686 7.5-6.635 7.5z" fill="#E30613" />
    </svg>
  );
};

/* Small Bosta icon (just the hexagon mark) */
const BostaIcon = ({ size = 28 }: { size?: number }) => {
  const scale = size / 68;
  return (
    <svg width={size} height={size} viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M65.244 17.666L35.544.533a3.78 3.78 0 00-3.87 0l-29.7 17.133C.79 18.376 0 19.639 0 21.06v25.107c0 1.421.71 2.684 1.975 3.395l29.7 17.133c.631.315 1.263.552 1.974.552.71 0 1.343-.158 1.975-.552l29.7-17.133c1.184-.71 1.974-1.974 1.974-3.395V21.06a4.24 4.24 0 00-2.054-3.394zM60.347 39.93l-10.98-6.316 10.98-6.316V39.93zM33.649 7.323L57.424 21.06 33.65 34.798 9.795 21.06 33.649 7.323zM6.872 27.219l10.98 6.316-10.98 6.316V27.219zm26.777 32.607L9.795 46.088l14.85-8.606 6.95 4.027c.632.316 1.264.553 1.975.553.71 0 1.343-.158 1.975-.553l6.95-4.027 14.85 8.606L33.65 59.826z" fill="#E30613" />
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   REAL ARAMEX LOGO SVG (wordmark, orange on light bg)
   ═══════════════════════════════════════════════════════════════════════ */

const AramexLogo = ({ height = 16 }: { height?: number }) => {
  const w = (166.1 / 46.3) * height;
  return (
    <svg width={w} height={height} viewBox="10 12.3 166.1 46.3" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M29.9,15.9c-1.1-1.2-2.4-2-3.7-2.6c-1.3-0.6-2.8-0.9-4.3-0.9c-3.3,0-6.1,1.3-8.4,3.8C11.2,18.8,10,22,10,26c0,3.8,1.2,7,3.6,9.6s5.2,3.9,8.5,3.9c1.5,0,2.8-0.3,4.1-0.8c1.2-0.5,2.5-1.4,3.7-2.6v2.7h6.4V13.1h-6.4V15.9z M28.2,31.4c-1.3,1.4-3,2.1-5,2.1c-1.9,0-3.6-0.7-4.9-2.2c-1.3-1.4-2-3.3-2-5.5c0-2.2,0.7-4,2-5.4c1.3-1.4,2.9-2.1,4.9-2.1s3.7,0.7,5,2.1c1.3,1.4,1.7,3,1.7,5.2C30,27.9,29.6,30,28.2,31.4z M73,15.9c-1.1-1.2-2.4-2-3.7-2.6c-1.3-0.6-2.8-0.9-4.3-0.9c-3.3,0-6.1,1.3-8.4,3.8c-2.3,2.5-3.5,5.8-3.5,9.7c0,3.8,1.2,7,3.6,9.6c2.4,2.6,5.2,3.9,8.5,3.9c1.5,0,2.8-0.3,4.1-0.8c1.2-0.5,2.5-1.4,3.7-2.6v2.7h6.4V13.1H73V15.9z M71.3,31.4c-1.3,1.4-3,2.1-5,2.1c-1.9,0-3.6-0.7-4.9-2.2c-1.3-1.4-2-3.3-2-5.5c0-2.2,0.7-4,2-5.4c1.3-1.4,2.9-2.1,4.9-2.1s3.7,0.7,5,2.1c1.3,1.4,1.7,3,1.7,5.2C73.1,27.9,72.7,30,71.3,31.4z M117.9,13.7c-1.4-0.9-3-1.3-4.8-1.3c-1.8,0-3.4,0.4-4.8,1.2c-1.5,0.8-2.7,1.9-3.7,3.5c-0.8-1.5-1.8-2.7-3.1-3.5c-1.3-0.8-2.7-1.2-4.3-1.2c-1.6,0-3,0.3-4.4,0.9c-1.3,0.6-2.5,1.5-3.6,2.7v-3h-6.4v25.7h6.4V27.3c0-2.5,0.2-4.3,0.6-5.4c0.4-1.1,1.1-2,2-2.7c0.9-0.6,1.8-1,2.9-1c1,0,1.8,0.3,2.4,0.8c0.7,0.5,1.2,1.3,1.5,2.3c0.3,1,0.5,2.7,0.5,5v12.4h6.4V27.1c0-2.4,0.2-4.2,0.6-5.3c0.4-1.1,1.1-2,1.9-2.6c0.9-0.6,1.9-0.9,3-0.9c1.4,0,2.5,0.5,3.2,1.5s1.1,3,1.1,5.9v13h6.4v-15c0-3.1-0.3-5.3-0.9-6.7C120.3,15.7,119.3,14.6,117.9,13.7z M144.1,31.2c-1.7,1.7-3.8,2.6-6.1,2.6c-2,0-3.6-0.6-4.9-1.6c-1.3-1.1-2.1-2.6-2.4-4.4h20.5v-1.2c0-4.2-1.3-7.6-3.8-10.2s-5.8-3.9-9.8-3.9c-3.8,0-6.9,1.3-9.4,3.9s-3.8,5.8-3.8,9.8c0,3.8,1.3,7,3.8,9.6c2.5,2.5,5.8,3.8,9.7,3.8c2.6,0,4.8-0.5,6.7-1.4c1.9-0.9,3.5-2.3,4.8-4.3L144.1,31.2z M133.4,19.4c1.3-1,2.9-1.5,4.7-1.5c1.6,0,3.1,0.4,4.3,1.3c1.2,0.9,2.1,2,2.5,3.4H131C131.7,21.1,132.5,20,133.4,19.4z M166.4,25.2l8.7-12.1h-7.3l-5,7l-5-7h-7.4l8.7,12.2l-9.7,13.5h7.3l6-8.4l6,8.4h7.4L166.4,25.2z M51.7,12.3c-1.2,0-2.2,0.2-3.1,0.7c-0.9,0.4-1.8,1.2-2.9,2.4v-2.2h-6.1v25.7H46V25.5c0-4.9,1.3-7.3,4.6-7.3c0.6,0,1.1,0.1,1.7,0.3c1-1.8,2.3-3.4,3.6-4.9C54.5,12.7,53.1,12.3,51.7,12.3z" fill="#E85D04"/>
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   REAL MYLERZ LOGO SVG (from mylerz.com CDN)
   ═══════════════════════════════════════════════════════════════════════ */

const MylerzLogo = ({ height = 16 }: { height?: number }) => {
  const w = (123 / 37) * height;
  return (
    <svg width={w} height={height} viewBox="0 0 123 37" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#mylerz-clip)">
        <path d="M53.6421 10.4379C53.6421 8.01944 51.5238 6.01908 49.099 6.01908H48.9233C48.0039 6.01908 47.2557 6.76528 47.2557 7.6823V13.2249C47.2557 14.034 47.2512 14.7353 47.2377 15.7827C47.2151 17.6841 47.161 18.7855 45.2456 19.9227C44.4974 20.3678 42.8614 20.606 41.6625 19.7205C40.4637 18.8349 40.351 17.6931 40.3555 16.2277C40.36 14.5465 40.3555 12.8653 40.3555 11.1841V8.29365C40.3555 7.37663 39.6073 6.63043 38.6879 6.63043H38.5121C36.3803 6.63043 34.6136 8.14981 34.217 10.1637C34.2125 10.1861 34.2035 10.2086 34.199 10.2311C34.1539 10.4828 34.1223 10.7435 34.1223 11.0088V14.6184C34.1223 15.3376 34.1223 16.0614 34.1223 16.7806C34.1404 19.7969 34.6181 22.521 36.9933 24.5888C39.373 26.6565 43.6591 26.2385 45.9306 24.4359C46.4219 24.0493 46.805 23.5953 47.2332 23.1548C47.2151 23.5863 47.1565 24.1797 46.9627 24.863C46.4805 26.5621 45.498 27.6635 45.0157 28.14C44.7453 28.4097 42.9335 30.1493 40.1437 30.3381C40.031 30.3471 39.9183 30.3516 39.8057 30.3516C37.5026 30.401 35.2806 29.2817 33.8249 27.5241C32.2114 25.5732 31.986 23.1323 31.986 20.6959C31.986 17.783 31.986 14.8701 31.986 11.9572V10.6851C31.986 10.0782 31.8508 9.50736 31.6255 8.98591C31.1252 7.80367 30.1292 6.88216 28.8852 6.50007C28.8357 6.48658 28.7635 6.4641 28.6734 6.43713C26.5461 5.84377 24.6937 6.08201 23.8059 6.24833C23.256 6.35172 22.6205 6.47309 21.8363 6.81473C20.3175 7.48002 19.353 8.49594 18.8257 9.15223C18.3614 7.85762 17.3113 6.8462 15.9908 6.43713C15.9412 6.42365 15.8736 6.40117 15.7834 6.3787C13.6562 5.78533 11.8038 6.02357 10.9159 6.1899C10.3661 6.29329 9.73057 6.41466 8.94636 6.75629C7.6844 7.3092 6.80554 8.10485 6.24217 8.73418V7.85312C6.24217 6.9361 5.49401 6.1899 4.57459 6.1899H1.66758C0.748159 6.1899 0 6.9361 0 7.85312V24.3685C0 25.2855 0.748159 26.0317 1.66758 26.0317H4.57008C5.4895 26.0317 6.23766 25.2855 6.23766 24.3685V14.8791C6.2647 14.4566 6.38639 13.7328 6.89117 13.0271C7.53116 12.1281 8.46411 11.719 9.1041 11.5886C9.19875 11.5707 9.27537 11.5572 9.2979 11.5572C10.1182 11.4403 10.8528 11.692 11.2404 11.8943C12.1238 12.3573 12.7728 13.4182 12.8449 14.6634C12.8449 16.0254 12.8359 17.3874 12.8449 18.727V24.4269C12.8449 25.3439 13.5931 26.0902 14.5125 26.0902H17.415C18.3344 26.0902 19.0826 25.3439 19.0826 24.4269C19.0826 24.4269 19.1141 15.1668 19.1186 15.1668C19.1186 14.8297 19.1682 13.9486 19.7811 13.09C20.4211 12.191 21.3541 11.7819 21.9941 11.6516C22.0887 11.6336 22.1653 11.6201 22.1879 11.6201C23.0081 11.5032 23.7428 11.755 24.1304 11.9572C25.0137 12.4202 25.6627 13.4811 25.7349 14.7218C25.8475 16.5603 25.7934 18.4034 25.7349 20.2374C25.6582 22.7637 25.5366 25.1552 26.3703 27.5826C27.0284 29.502 28.1145 31.2641 29.5252 32.7251C32.1393 35.4312 35.853 37.0135 39.6209 37.0045C43.4698 36.9955 47.2106 35.3772 49.8382 32.5722C51.4968 30.8011 52.6776 28.6075 53.2319 26.2475C53.615 24.6247 53.6421 22.7053 53.6421 21.3028V10.4379Z" fill="#1E293B"/>
        <path d="M60.2044 0H57.3019C56.3809 0 55.6343 0.744651 55.6343 1.66322V24.5753C55.6343 25.4938 56.3809 26.2385 57.3019 26.2385H60.2044C61.1254 26.2385 61.872 25.4938 61.872 24.5753V1.66322C61.872 0.744651 61.1254 0 60.2044 0Z" fill="#FB4F14"/>
        <path d="M77.2137 6.53142C72.4904 4.96709 67.6048 6.95846 65.2837 11.3862C62.7869 16.1467 64.0353 21.8556 68.2719 25.0247C70.7372 26.8677 74.478 27.4521 77.7275 26.8093C78.4351 26.6654 79.03 26.4991 79.4852 26.3598C79.4852 26.3598 80.7111 25.9777 81.608 25.3843C81.7027 25.3214 81.7883 25.2449 81.7883 25.2449C81.901 25.1416 81.9686 25.0382 82.0046 24.9842C82.0407 24.9258 82.0677 24.8763 82.0812 24.8494C82.1398 24.7235 82.1669 24.6156 82.1804 24.5482C82.1849 24.5167 82.2029 24.4268 82.2029 24.3054C82.2029 24.1526 82.1804 24.0357 82.1714 23.9953C82.1398 23.8604 82.0903 23.748 82.0452 23.6626C82.0317 23.6447 81.9956 23.5817 81.9821 23.5637C81.9821 23.5637 81.0401 22.0219 80.4452 21.397C80.3596 21.3071 80.2649 21.2352 80.2649 21.2352C80.1928 21.1813 80.1252 21.1453 80.0666 21.1139C79.8863 21.0239 79.7286 20.997 79.6745 20.9925C79.5033 20.9655 79.3635 20.9835 79.2824 20.9925C78.692 21.0824 78.0655 21.3926 77.2092 21.5814C77.1281 21.5993 77.065 21.6128 76.9839 21.6263C76.5196 21.7117 76.0509 21.7791 75.5822 21.8241C73.3377 22.0084 71.7242 20.8307 71.7242 20.8307C70.5118 19.9451 70.0206 18.7404 69.8358 18.174C70.4172 18.174 70.9715 18.174 71.5259 18.174C75.1856 18.174 78.8407 18.174 82.5004 18.174C83.2486 18.174 84.0553 18.2864 84.0643 17.1446C84.0869 13.4001 82.3066 8.21712 77.2092 6.52692L77.2137 6.53142ZM69.8673 14.6363C69.8854 14.38 70.0476 12.3437 71.7467 11.2514C72.7653 10.5996 73.8154 10.6176 74.1535 10.631C74.5456 10.6445 75.6768 10.6985 76.6774 11.5301C78.043 12.6674 78.0881 14.3621 78.0881 14.6318C75.3478 14.6318 72.6031 14.6363 69.8628 14.6408L69.8673 14.6363Z" fill="#FB4F14"/>
        <path d="M100.046 7.19232C99.8294 6.85069 99.3201 6.68886 98.4007 6.52703C95.8227 6.06852 93.9208 7.12489 92.4425 9.28708V8.00595C92.4425 7.08893 91.6943 6.34273 90.7749 6.34273H87.8724C86.953 6.34273 86.2048 7.08893 86.2048 8.00595V24.5753C86.2048 25.4923 86.953 26.2385 87.8724 26.2385H90.7749C91.6943 26.2385 92.4425 25.4923 92.4425 24.5753V24.2741C92.4425 22.7322 92.447 21.1949 92.4515 19.653C92.4515 18.8664 92.4515 18.0842 92.4515 17.2975C92.4515 17.1222 92.4515 16.9514 92.447 16.7806V16.0614C92.465 15.3871 92.5462 14.7218 92.8707 14.0925C93.3123 13.2249 94.0875 12.4562 95.043 12.1775C95.3585 12.0876 96.0931 11.9168 96.9134 12.0831C97.5083 12.2045 98.252 12.3393 98.7838 11.9437C99.3066 11.5572 99.4554 10.73 99.6356 10.1502C99.6401 10.1322 99.6492 10.1142 99.6537 10.0962C99.7663 9.73211 99.8745 9.32754 99.9646 8.86004C100.136 7.95201 100.24 7.4935 100.055 7.19232H100.046Z" fill="#FB4F14"/>
        <path d="M102.061 7.88908C102.002 8.65326 101.97 9.03535 102.061 10.5188C102.061 10.5323 102.061 10.5682 102.07 10.6132C102.07 10.6312 102.083 10.6851 102.101 10.757C102.106 10.7795 102.119 10.8244 102.142 10.8739C102.196 11.0087 102.263 11.1076 102.281 11.1346C102.308 11.1706 102.349 11.2245 102.403 11.283C102.466 11.3459 102.52 11.3908 102.561 11.4178C102.583 11.4358 102.633 11.4718 102.705 11.5077C102.804 11.5617 102.885 11.5886 102.912 11.5976C103.007 11.6291 103.084 11.6381 103.124 11.6426C103.183 11.6516 103.223 11.6516 103.241 11.6516C103.286 11.6516 103.332 11.6516 103.363 11.6516C105.333 11.6516 107.307 11.6471 109.276 11.6426C108.92 12.191 108.546 12.7259 108.177 13.2608C107.514 14.2228 106.851 15.1848 106.189 16.1468C105.441 17.2301 104.693 18.3134 103.949 19.3968C103.106 20.615 102.268 21.8377 101.434 23.0604C101.348 23.1862 101.263 23.3166 101.2 23.456C100.929 24.0853 100.929 25.0023 101.168 25.6361C101.182 25.6721 101.236 25.8069 101.348 25.9508C101.389 26.0002 101.443 26.0677 101.52 26.1306C101.551 26.1531 101.727 26.2879 101.898 26.3509C101.975 26.3778 102.043 26.3958 102.043 26.3958C102.097 26.4093 102.142 26.4138 102.191 26.4183C102.191 26.4183 102.245 26.4228 102.295 26.4273C102.421 26.4363 112.575 26.4273 115.865 26.4273C115.96 26.4273 116.091 26.4138 116.24 26.3644C116.285 26.3464 116.42 26.3014 116.569 26.1935C116.605 26.1666 116.627 26.1486 116.641 26.1351C116.69 26.0901 116.843 25.9598 116.947 25.744C116.974 25.6856 116.992 25.6361 117.006 25.6047C117.033 25.5282 117.046 25.4698 117.046 25.4518C117.046 25.4338 117.055 25.3979 117.06 25.3529C117.06 25.3305 117.064 25.308 117.064 25.299C117.064 25.281 117.064 25.2675 117.064 25.254C117.064 24.391 117.064 23.5324 117.064 22.6693C117.064 22.6109 117.064 22.5344 117.051 22.4535C117.033 22.3367 117.001 22.2467 116.983 22.1928C116.956 22.1254 116.902 21.9995 116.789 21.8647C116.717 21.7748 116.645 21.7118 116.609 21.6848C116.551 21.6354 116.397 21.523 116.167 21.4556C116.019 21.4106 115.883 21.4017 115.78 21.4061H108.925C112.611 16.0209 115.293 12.0921 115.55 11.71C115.613 11.6201 115.753 11.4088 115.897 11.1121C115.938 11.0312 116.014 10.8694 116.113 10.6087C116.307 10.0872 116.411 9.6467 116.447 9.48487C116.447 9.48487 116.609 8.74766 116.627 7.90706C116.627 7.8711 116.627 7.82614 116.627 7.7722C116.596 7.40809 116.388 7.08893 116.167 6.91362C115.852 6.66189 115.509 6.6484 115.401 6.6484H104.454C104.138 6.6484 103.972 6.62593 103.629 6.6484C103.629 6.6484 103.048 6.68886 102.674 6.89564C102.574 6.94958 102.493 7.01701 102.493 7.01701C102.457 7.04847 102.372 7.12489 102.286 7.23727C102.241 7.29571 102.164 7.41708 102.11 7.5834C102.065 7.72276 102.056 7.83513 102.052 7.88908H102.061Z" fill="#FB4F14"/>
      </g>
      <defs><clipPath id="mylerz-clip"><rect width="123" height="37" fill="white"/></clipPath></defs>
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   CARRIER DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════ */

interface CarrierMeta {
  key: "bosta" | "aramex" | "mylerz" | "manual";
  name: string;
  nameAr: string;
  color: string;
  description: string;
  descriptionAr: string;
  comingSoon?: boolean;
}

const CARRIERS: CarrierMeta[] = [
  { key: "bosta", name: "Bosta", nameAr: "بوسطة", color: "#E30613", description: "Egypt's leading last-mile delivery. COD, next-day, same-day.", descriptionAr: "الشحن والتوصيل السريع في مصر. الدفع عند الاستلام." },
  { key: "aramex", name: "Aramex", nameAr: "أرامكس", color: "#E85D04", description: "Regional and international shipping with full tracking.", descriptionAr: "شحن محلي ودولي مع تتبع كامل.", comingSoon: true },
  { key: "mylerz", name: "Mylerz", nameAr: "مايلرز", color: "#FB4F14", description: "E-commerce fulfillment and last-mile delivery.", descriptionAr: "تنفيذ طلبات التجارة الإلكترونية والتوصيل.", comingSoon: true },
  { key: "manual", name: "Manual", nameAr: "يدوي", color: "#71717A", description: "Handle fulfillment yourself or use a custom carrier.", descriptionAr: "تنفيذ الطلبات يدوياً أو استخدام ناقل مخصص." },
];

/* ═══════════════════════════════════════════════════════════════════════
   BOSTA VERIFICATION + "NOTIFY ME" INTEREST (local, per browser)

   Saving Bosta credentials marks the account `is_configured` on the
   server without ever calling Bosta, so a typo'd key showed a green
   pulsing "Live". We probe `GET /shipments/bosta/cities` after a save
   (and once per browser for an already-configured store) and only call
   it Live when that succeeds. Persisted in localStorage so a reload
   doesn't re-probe every time.
   ═══════════════════════════════════════════════════════════════════════ */

const bostaVerifiedKey = (storeId: string) => `numu:bosta-verified:${storeId}`;
const readBostaVerified = (storeId: string): boolean | null => {
  try {
    const v = localStorage.getItem(bostaVerifiedKey(storeId));
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
};
const writeBostaVerified = (storeId: string, ok: boolean) => {
  try { localStorage.setItem(bostaVerifiedKey(storeId), ok ? "1" : "0"); } catch { /* private mode */ }
};
const clearBostaVerified = (storeId: string) => {
  try { localStorage.removeItem(bostaVerifiedKey(storeId)); } catch { /* noop */ }
};
async function probeBosta(storeId: string): Promise<boolean> {
  try {
    await getBostaCities(storeId);
    return true;
  } catch {
    return false;
  }
}

// "Soon" couriers: the public waitlist endpoint is email-keyed and 409s on
// duplicates, so interest is simply remembered locally and surfaced as a
// "Noted" state — enough to stop "Soon" being a dead end.
const COURIER_INTEREST_KEY = "numu:courier-interest";
const readCourierInterest = (): string[] => {
  try { return JSON.parse(localStorage.getItem(COURIER_INTEREST_KEY) || "[]") as string[]; } catch { return []; }
};
const addCourierInterest = (key: string) => {
  try {
    const next = Array.from(new Set([...readCourierInterest(), key]));
    localStorage.setItem(COURIER_INTEREST_KEY, JSON.stringify(next));
    return next;
  } catch {
    return readCourierInterest();
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   STATUS
   ═══════════════════════════════════════════════════════════════════════ */

const STATUS_META: Record<string, { dot: string; bg: string; label: string; labelAr: string }> = {
  pending:          { dot: "bg-slate-400",   bg: "bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200/60", label: "Pending",          labelAr: "معلق" },
  created:          { dot: "bg-sky-500",     bg: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200/60",           label: "Created",          labelAr: "جديدة" },
  picked_up:        { dot: "bg-amber-500",   bg: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/60", label: "Picked Up",       labelAr: "تم الاستلام" },
  in_transit:       { dot: "bg-orange-500",  bg: "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200/60", label: "In Transit",  labelAr: "في الطريق" },
  out_for_delivery: { dot: "bg-violet-500",  bg: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200/60", label: "Out for Delivery", labelAr: "جاري التوصيل" },
  delivered:        { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/60", label: "Delivered", labelAr: "تم التوصيل" },
  returned:         { dot: "bg-rose-500",    bg: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200/60",       label: "Returned",         labelAr: "مرتجع" },
  cancelled:        { dot: "bg-gray-400",    bg: "bg-gray-50 dark:bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-200/60",       label: "Cancelled",        labelAr: "ملغي" },
  failed:           { dot: "bg-red-600",     bg: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/60",             label: "Failed",           labelAr: "فشل" },
};

const StatusBadge = ({ status, isAr }: { status: string; isAr: boolean }) => {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <Badge variant="outline" className={`text-[10px] font-medium gap-1.5 rounded-md py-0.5 ${m.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {isAr ? m.labelAr : m.label}
    </Badge>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE VIEW — "hub" or "carrier detail"
   ═══════════════════════════════════════════════════════════════════════ */

type PageView = "hub" | "bosta";

const Logistics = () => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [view, setView] = useState<PageView>("hub");
  // Which status the Bosta shipments list opens on (set by the KPI tiles).
  const [bostaInitialStatus, setBostaInitialStatus] = useState<StatusFilter>("all");
  const openBosta = (status: StatusFilter = "all") => { setBostaInitialStatus(status); setView("bosta"); };

  /* ── Carriers state ── */
  const [bostaCreds, setBostaCreds] = useState<BostaCredentials | null>(null);
  const [shippingData, setShippingData] = useState<ShippingSettings | null>(null);
  // null = unknown / probing, true = Bosta answered, false = credentials rejected.
  const [bostaVerified, setBostaVerified] = useState<boolean | null>(() => (storeId ? readBostaVerified(storeId) : null));
  const [courierInterest, setCourierInterest] = useState<string[]>(() => readCourierInterest());

  useEffect(() => {
    if (!storeId) return;
    fetchBostaCredentials(storeId).then(setBostaCreds).catch(() => {});
    fetchShippingSettings(storeId).then(setShippingData).catch(() => {});
  }, [storeId]);

  // One silent probe per browser for a store that was configured before
  // verification existed.
  useEffect(() => {
    if (!storeId || !bostaCreds?.is_configured) return;
    const known = readBostaVerified(storeId);
    if (known !== null) { setBostaVerified(known); return; }
    let cancelled = false;
    probeBosta(storeId).then((ok) => {
      if (cancelled) return;
      writeBostaVerified(storeId, ok);
      setBostaVerified(ok);
    });
    return () => { cancelled = true; };
  }, [storeId, bostaCreds?.is_configured]);

  /* ── Hub-level shipment stats for the 4-tile Souq KPI row.
     Previously only fetched inside BostaDetailView, but the spec calls
     for the same Ready-to-ship / In-transit / Out-for-delivery / Returns
     summary on the hub view itself. */
  const hubStatsQ = useQuery({
    queryKey: ["shipment-stats", storeId],
    queryFn: () => getShipmentStats(storeId!),
    enabled: !!storeId && view === "hub",
  });
  const hubStats = hubStatsQ.data;
  const tileReadyToShip = hubStats?.by_status?.created ?? 0;
  const tileInTransit
    = (hubStats?.by_status?.in_transit ?? 0)
    + (hubStats?.by_status?.picked_up ?? 0);
  const tileOutForDelivery = hubStats?.by_status?.out_for_delivery ?? 0;
  const tileReturns
    = (hubStats?.by_status?.returned ?? 0)
    + (hubStats?.by_status?.failed ?? 0);
  const fmtN = (n: number) => (isAr ? n.toLocaleString("ar-EG") : n.toLocaleString());

  /* ── Landing data: zones, coverage, governorate count ── */
  const zonesQ = useShippingZones(view === "hub" ? storeId : undefined);
  const coverageQ = useShippingCoverage(view === "hub" ? storeId : undefined);
  const govsQ = useReferenceGovernorates(isAr ? "ar" : "en");
  const zones = zonesQ.data ?? [];
  const activeZones = zones.filter((z) => z.is_active);
  const zonesWithRates = activeZones.filter((z) => z.rates.some((r) => r.is_active));
  const totalGovs = govsQ.data?.length ?? 0;
  const storeCurrency = (currentStore as { currency?: string | null; default_currency?: string | null } | null)?.currency
    ?? (currentStore as { default_currency?: string | null } | null)?.default_currency
    ?? "EGP";

  const handleToggleManual = async (enabled: boolean) => {
    if (!storeId) return;
    try { const r = await updateShippingSettings(storeId, { manual_enabled: enabled }); setShippingData(r); toast.success(isAr ? "تم التحديث" : "Updated"); } catch (e) { showError(e, language); }
  };

  const carrierStatus = (key: string): "connected" | "unverified" | "not_configured" | "coming_soon" => {
    if (key === "bosta") {
      if (!bostaCreds?.is_configured) return "not_configured";
      return bostaVerified === false ? "unverified" : "connected";
    }
    if (key === "manual") return shippingData?.manual?.enabled ? "connected" : "not_configured";
    return "coming_soon";
  };

  /* ═══════════════════════════════════════════════════════════════════
     BOSTA DETAIL VIEW
     ═══════════════════════════════════════════════════════════════════ */
  if (view === "bosta") {
    return (
      <BostaDetailView
        storeId={storeId}
        isAr={isAr}
        language={language}
        bostaCreds={bostaCreds}
        setBostaCreds={setBostaCreds}
        shippingData={shippingData}
        setShippingData={setShippingData}
        onBack={() => setView("hub")}
        initialStatus={bostaInitialStatus}
        bostaVerified={bostaVerified}
        setBostaVerified={setBostaVerified}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     LANDING — setup hero · KPI tiles · zones & rates · couriers · tools
     ═══════════════════════════════════════════════════════════════════ */
  const courierReady = !!bostaCreds?.is_configured || !!shippingData?.manual?.enabled;
  const setupSteps: SetupStep[] = [
    {
      key: "zones",
      title: isAr ? "مناطق الشحن" : "Shipping zones",
      detail: activeZones.length
        ? (isAr ? `${fmtN(coverageQ.data?.covered.length ?? 0)} من ${fmtN(totalGovs)} محافظة` : `${fmtN(coverageQ.data?.covered.length ?? 0)} of ${fmtN(totalGovs)} governorates`)
        : (isAr ? "فين بتوصّل؟" : "Where do you deliver?"),
      done: activeZones.length > 0,
      cta: isAr ? "أضف" : "Add",
      to: "/shipping/zones",
    },
    {
      key: "rates",
      title: isAr ? "أسعار الشحن" : "Shipping rates",
      detail: zonesWithRates.length
        ? (isAr ? `${fmtN(zonesWithRates.length)} منطقة بسعر` : `${fmtN(zonesWithRates.length)} zone${zonesWithRates.length === 1 ? "" : "s"} priced`)
        : (isAr ? "العميل بيدفع كام؟" : "What does the customer pay?"),
      done: zonesWithRates.length > 0 && zonesWithRates.length === activeZones.length,
      cta: isAr ? "حدّد" : "Set",
      to: activeZones.length ? `/shipping/zones/${(activeZones.find((z) => !z.rates.some((r) => r.is_active)) ?? activeZones[0]).id}` : "/shipping/zones",
    },
    {
      key: "courier",
      title: isAr ? "شركة الشحن" : "Courier",
      detail: bostaCreds?.is_configured
        ? (bostaVerified === false ? t("logistics.savedUnverified") : (isAr ? "بوسطة متصلة" : "Bosta connected"))
        : shippingData?.manual?.enabled
          ? (isAr ? "شحن يدوي" : "Manual fulfilment")
          : (isAr ? "اربط بوسطة أو فعّل اليدوي" : "Connect Bosta or go manual"),
      done: courierReady,
      cta: isAr ? "اربط" : "Connect",
      onClick: () => openBosta("all"),
    },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <PageHeader
        title={isAr ? "الشحن والتوصيل" : "Shipping & delivery"}
        subtitle={isAr ? "المناطق والأسعار وشركات الشحن والشحنات — في مكان واحد" : "Zones, rates, couriers and shipments — in one place"}
        actions={<>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/orders/shipping-labels")}>
            <Printer className="h-4 w-4" strokeWidth={2.2} />
            {isAr ? "اطبع البوالص" : "Print labels"}
          </Button>
          {bostaCreds?.is_configured ? (
            <Button variant="accent" size="sm" className="gap-1.5" onClick={() => openBosta("all")}>
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              {isAr ? "شحنة جديدة" : "New shipment"}
            </Button>
          ) : (
            <Button variant="accent" size="sm" className="gap-1.5" onClick={() => navigate("/shipping/zones/new")}>
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              {isAr ? "منطقة جديدة" : "New zone"}
            </Button>
          )}
        </>}
      />

      {!(zonesQ.isLoading || coverageQ.isLoading) && (
        <ShippingSetupHero steps={setupSteps} isAr={isAr} />
      )}

      {/* ─── KPI tiles — every tile is a link, even at zero ──── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Package}
          tone="saffron"
          label={isAr ? "جاهز للشحن" : "Ready to ship"}
          value={fmtN(tileReadyToShip)}
          loading={hubStatsQ.isLoading}
          onClick={() => (bostaCreds?.is_configured ? openBosta("created") : navigate("/orders/shipping-labels"))}
        />
        <StatTile
          icon={Truck}
          tone="navy"
          label={isAr ? "في الطريق" : "In transit"}
          value={fmtN(tileInTransit)}
          loading={hubStatsQ.isLoading}
          onClick={() => openBosta("in_transit")}
        />
        <StatTile
          icon={MapPin}
          tone="sage"
          label={isAr ? "خرج للتوصيل" : "Out for delivery"}
          value={fmtN(tileOutForDelivery)}
          loading={hubStatsQ.isLoading}
          onClick={() => openBosta("all")}
        />
        <StatTile
          icon={PackageCheck}
          tone="terra"
          label={isAr ? "مرتجعات" : "Returns"}
          value={fmtN(tileReturns)}
          loading={hubStatsQ.isLoading}
          onClick={() => openBosta("returned")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        {/* ─── Zones & rates ─── */}
        <ZonesOverviewCard
          zones={zones}
          coverage={coverageQ.data}
          totalGovernorates={totalGovs}
          loading={zonesQ.isLoading || govsQ.isLoading}
          isAr={isAr}
          currency={storeCurrency}
        />

        <div className="space-y-4">
          {/* ─── Couriers — compact rows ─── */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="px-5 pt-4 pb-2">
              <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
                <Truck className="h-4 w-4 text-muted-foreground" />
                {isAr ? "شركات الشحن" : "Couriers"}
              </h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {isAr ? "مين بيوصّل الطلبات ويطبع البوالص" : "Who delivers the parcels and prints the labels"}
              </p>
            </div>
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {CARRIERS.map((carrier) => {
                const status = carrierStatus(carrier.key);
                const isConnected = status === "connected";
                const isUnverified = status === "unverified";
                const isComingSoon = status === "coming_soon";
                const interested = courierInterest.includes(carrier.key);
                const clickable = carrier.key === "bosta";
                const Row = clickable ? "button" : "div";
                return (
                  <li key={carrier.key}>
                    <Row
                      {...(clickable ? { type: "button" as const, onClick: () => openBosta("all") } : {})}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-start ${clickable ? "transition-colors hover:bg-muted/40" : ""} ${isComingSoon ? "opacity-70" : ""}`}
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${carrier.color}12` }}>
                        {carrier.key === "bosta" ? <BostaIcon size={22} /> : carrier.key === "aramex" ? <AramexLogo height={9} /> : carrier.key === "mylerz" ? <MylerzLogo height={9} /> : <Truck className="h-4.5 w-4.5 text-zinc-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold">{isAr ? carrier.nameAr : carrier.name}</span>
                          {isConnected && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {carrier.key === "bosta" && bostaVerified === null ? t("logistics.verifying") : t("logistics.live")}
                            </span>
                          )}
                          {isUnverified && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  {t("logistics.savedUnverified")}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">{t("logistics.bostaUnreachable")}</TooltipContent>
                            </Tooltip>
                          )}
                          {isComingSoon && <Badge variant="secondary" className="h-5 text-[10px]">{isAr ? "قريبًا" : "Soon"}</Badge>}
                        </div>
                        <p className="truncate text-[11.5px] text-muted-foreground">{isAr ? carrier.descriptionAr : carrier.description}</p>
                      </div>
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        {carrier.key === "manual" && (
                          <Switch checked={shippingData?.manual?.enabled ?? false} onCheckedChange={handleToggleManual} />
                        )}
                        {carrier.key === "bosta" && (
                          <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-navy dark:text-saffron">
                            {isConnected || isUnverified ? (isAr ? "إدارة" : "Manage") : (isAr ? "اربط" : "Connect")}
                            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                          </span>
                        )}
                        {isComingSoon && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            disabled={interested}
                            onClick={() => {
                              setCourierInterest(addCourierInterest(carrier.key));
                              toast.success(t("logistics.noted"));
                            }}
                          >
                            {interested ? t("logistics.notedShort") : t("logistics.notifyMe")}
                          </Button>
                        )}
                      </div>
                    </Row>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ─── Tools ─── */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-[15px] font-extrabold tracking-tight">{isAr ? "أدوات" : "Tools"}</h2>
            </div>
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {[
                { key: "shipments", icon: Package, title: isAr ? "الشحنات" : "Shipments", sub: isAr ? "تتبّع وإلغاء وبوالص" : "Track, cancel, AWBs", onClick: () => openBosta("all"), disabled: !bostaCreds?.is_configured },
                { key: "labels", icon: Printer, title: isAr ? "طباعة البوالص" : "Print labels", sub: isAr ? "بوالص الطلبات الجاهزة" : "Labels for ready orders", onClick: () => navigate("/orders/shipping-labels") },
                { key: "calc", icon: CircleDollarSign, title: isAr ? "حاسبة الشحن" : "Rate calculator", sub: isAr ? "جرّب محافظة ووزن وشوف السعر" : "Try a governorate & weight", onClick: () => navigate("/logistics/rate-calculator") },
                { key: "cod", icon: Zap, title: isAr ? "أوتوبايلوت الدفع عند الاستلام" : "COD autopilot", sub: isAr ? "رسايل واتساب تلقائية للتوصيل" : "Automatic WhatsApp delivery updates", onClick: () => navigate("/cod-autopilot") },
              ].map((tool) => (
                <li key={tool.key}>
                  <button
                    type="button"
                    onClick={tool.onClick}
                    disabled={tool.disabled}
                    title={tool.disabled ? t("logistics.connectFirst") : undefined}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-start transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <tool.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">{tool.title}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">{tool.sub}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 rtl:rotate-180" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   BOSTA DETAIL VIEW — full dedicated page
   ═══════════════════════════════════════════════════════════════════════ */

type BostaTab = "shipments" | "config" | "zones" | "cod";
type StatusFilter = "all" | "created" | "picked_up" | "in_transit" | "delivered" | "returned" | "failed";
const PAGE_SIZE = 20;

interface BostaDetailProps {
  storeId: string | undefined;
  isAr: boolean;
  language: string;
  bostaCreds: BostaCredentials | null;
  setBostaCreds: (c: BostaCredentials) => void;
  shippingData: ShippingSettings | null;
  setShippingData: (fn: ShippingSettings | ((p: ShippingSettings | null) => ShippingSettings | null)) => void;
  onBack: () => void;
  /** Status the shipments list opens on (KPI tiles pass theirs). */
  initialStatus?: StatusFilter;
  bostaVerified: boolean | null;
  setBostaVerified: (v: boolean | null) => void;
}

const BostaDetailView = ({ storeId, isAr, language, bostaCreds, setBostaCreds, shippingData, setShippingData, onBack, initialStatus = "all", bostaVerified, setBostaVerified }: BostaDetailProps) => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [tab, setTab] = useState<BostaTab>(bostaCreds?.is_configured ? "shipments" : "config");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [page, setPage] = useState(0);

  // Shipment detail
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [createOrderId, setCreateOrderId] = useState("");
  const [createMethod, setCreateMethod] = useState("standard");
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkIds, setBulkIds] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkShipmentResult | null>(null);
  const [bulking, setBulking] = useState(false);

  // Config
  const [bostaForm, setBostaForm] = useState({ api_key: "", business_id: "", webhook_secret: "", auto_create_shipment: false });
  const [bostaSaving, setBostaSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);

  // Zones
  const [freeThreshold, setFreeThreshold] = useState(shippingData?.free_shipping_threshold || 500);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZone, setNewZone] = useState({ zone: "", governorates: "", rate: 0, estimated_days: "" });

  const fmt = (cents: number) => formatMoney(cents, { fromCents: true, locale: isAr ? "ar" : "en" });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(isAr ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const fmtShort = (d: string) => new Date(d).toLocaleDateString(isAr ? "ar-EG" : "en-GB", { day: "numeric", month: "short" });
  const fmtFull = (d: string) => new Date(d).toLocaleString(isAr ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const truncId = (id: string) => id.length > 8 ? `${id.slice(0, 8)}…` : id;

  const statsQ = useQuery({ queryKey: ["shipment-stats", storeId], queryFn: () => getShipmentStats(storeId!), enabled: !!storeId });
  const listQ = useQuery({
    queryKey: ["shipments", storeId, statusFilter, page],
    queryFn: () => listShipments(storeId!, { status: statusFilter === "all" ? undefined : statusFilter, carrier: "bosta", skip: page * PAGE_SIZE, limit: PAGE_SIZE }),
    enabled: !!storeId,
  });
  const codQ = useQuery({ queryKey: ["cod-summary", storeId], queryFn: () => getCodSummary(storeId!), enabled: !!storeId && tab === "cod" });

  const stats = statsQ.data;
  const shipments = listQ.data ?? [];
  const inTransit = (stats?.by_status?.in_transit ?? 0) + (stats?.by_status?.out_for_delivery ?? 0) + (stats?.by_status?.picked_up ?? 0);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["shipments", storeId] }); qc.invalidateQueries({ queryKey: ["shipment-stats", storeId] }); qc.invalidateQueries({ queryKey: ["cod-summary", storeId] }); };

  // ── Handlers ──
  const openDetail = async (id: string) => { if (!storeId) return; setDetailLoading(true); setTracking(null); try { setSelectedShipment(await getShipment(storeId, id)); } catch (e) { showError(e, language); } finally { setDetailLoading(false); } };
  const handleTrack = async (id: string) => { if (!storeId) return; setTrackingLoading(true); try { setTracking(await trackShipment(storeId, id)); } catch (e) { showError(e, language); } finally { setTrackingLoading(false); } };
  const handleCancel = async (id: string) => { if (!storeId) return; setActionLoading(id); try { const u = await cancelShipment(storeId, id); toast.success(isAr ? "تم إلغاء الشحنة" : "Cancelled"); if (selectedShipment?.id === id) setSelectedShipment(u); invalidate(); } catch (e) { showError(e, language); } finally { setActionLoading(null); } };
  const handleCreate = async () => { if (!storeId || !createOrderId.trim()) return; setCreating(true); try { await createShipment(storeId, { order_id: createOrderId.trim(), shipping_method: createMethod, notes: createNotes || undefined }); toast.success(isAr ? "تم إنشاء الشحنة" : "Shipment created"); setShowCreate(false); setCreateOrderId(""); setCreateNotes(""); invalidate(); } catch (e) { showError(e, language); } finally { setCreating(false); } };
  const handleBulk = async () => { if (!storeId) return; const ids = bulkIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean); if (!ids.length) return; setBulking(true); try { const r = await bulkCreateShipments(storeId, ids); setBulkResult(r); toast.success(`${r.succeeded}/${r.total}`); invalidate(); } catch (e) { showError(e, language); } finally { setBulking(false); } };
  // Save, then PROBE. The backend marks the account configured without
  // calling Bosta, so this is the only place a bad key gets caught.
  const handleSaveBosta = async () => {
    if (!storeId) return;
    setBostaSaving(true);
    try {
      const r = await saveBostaCredentials(storeId, { api_key: bostaForm.api_key, business_id: bostaForm.business_id, webhook_secret: bostaForm.webhook_secret || undefined, auto_create_shipment: bostaForm.auto_create_shipment });
      setBostaCreds(r);
      setEditing(false);
      setBostaVerified(null);
      const ok = await probeBosta(storeId);
      writeBostaVerified(storeId, ok);
      setBostaVerified(ok);
      if (ok) toast.success(t("logistics.bostaVerified"));
      else toast.warning(t("logistics.bostaUnreachable"));
    } catch (e) {
      showError(e, language);
    } finally {
      setBostaSaving(false);
    }
  };
  const handleDeleteBosta = async () => { if (!storeId) return; try { await deleteBostaCredentials(storeId); clearBostaVerified(storeId); setBostaVerified(null); setBostaCreds({ is_configured: false, api_key_masked: null, business_id: null, auto_create_shipment: false, last_configured: null }); toast.success(isAr ? "تم قطع الاتصال" : "Disconnected"); } catch (e) { showError(e, language); } };
  const livePill = bostaCreds?.is_configured ? (
    bostaVerified === false ? (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {t("logistics.savedUnverified")}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {bostaVerified === null ? t("logistics.verifying") : t("logistics.live")}
      </span>
    )
  ) : null;
  const handleAddZone = async () => { if (!storeId || !newZone.zone) return; try { const z = await addShippingZone(storeId, newZone); setShippingData((p: ShippingSettings | null) => p ? { ...p, zones: [...p.zones, z] } : p); setNewZone({ zone: "", governorates: "", rate: 0, estimated_days: "" }); setShowAddZone(false); toast.success(isAr ? "تم الإضافة" : "Added"); } catch (e) { showError(e, language); } };
  const handleDeleteZone = async (zoneId: string) => { if (!storeId) return; try { await deleteShippingZone(storeId, zoneId); setShippingData((p: ShippingSettings | null) => p ? { ...p, zones: p.zones.filter(z => z.id !== zoneId) } : p); } catch (e) { showError(e, language); } };

  /* ── Shipment detail view ── */
  if (selectedShipment) {
    const s = selectedShipment;
    return (
      <div className="p-6 max-w-[1100px] mx-auto space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => { setSelectedShipment(null); setTracking(null); }}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{s.tracking_number || truncId(s.id)}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">{s.carrier} · {fmtDate(s.created_at)}</p>
          </div>
          <StatusBadge status={s.status} isAr={isAr} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {storeId && <a href={s.awb_url || getAwbUrl(storeId, s.id)} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg"><Printer className="h-3.5 w-3.5" />{isAr ? "بوليصة" : "AWB"}</Button></a>}
          <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg" onClick={() => handleTrack(s.id)} disabled={trackingLoading}>{trackingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}{isAr ? "تتبع" : "Track"}</Button>
          {!["delivered", "cancelled", "returned", "failed"].includes(s.status) && <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg text-destructive hover:text-destructive" onClick={() => handleCancel(s.id)} disabled={actionLoading === s.id}>{actionLoading === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}{isAr ? "إلغاء" : "Cancel"}</Button>}
          {s.tracking_url && <a href={s.tracking_url} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg"><ExternalLink className="h-3.5 w-3.5" /></Button></a>}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2"><CardContent className="pt-5"><div className="grid grid-cols-2 gap-4 text-sm">
            {[{ l: isAr ? "رقم التتبع" : "Tracking", v: s.tracking_number || "—", mono: true }, { l: isAr ? "الطلب" : "Order", v: truncId(s.order_id), mono: true }, { l: isAr ? "النوع" : "Type", v: s.shipment_type }, { l: isAr ? "طريقة" : "Method", v: s.shipping_method || "—" }, { l: "COD", v: fmt(s.cod_amount) }, { l: isAr ? "تحصيل" : "Collected", v: s.cod_collected ? "✓" : "—" }, { l: isAr ? "تكلفة" : "Cost", v: fmt(s.shipping_cost) }, { l: isAr ? "محاولات" : "Attempts", v: String(s.delivery_attempts) }].map((f, i) => (
              <div key={i}><p className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">{f.l}</p><p className={`font-medium mt-0.5 ${f.mono ? "font-mono text-xs" : ""}`}>{f.v}</p></div>
            ))}
          </div></CardContent></Card>
          <Card><CardContent className="pt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{isAr ? "سجل الحالة" : "History"}</h4>
            {s.status_history.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">{isAr ? "لا يوجد" : "No history"}</p> : (
              <div className="space-y-0">{s.status_history.map((entry, i) => (
                <div key={i} className="flex gap-3 pb-3 last:pb-0"><div className="relative flex flex-col items-center"><div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${i === s.status_history.length - 1 ? "bg-primary" : "bg-muted-foreground/30"}`} />{i < s.status_history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}</div><div className="min-w-0 flex-1"><StatusBadge status={entry.to} isAr={isAr} />{entry.description && <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>}<p className="text-[10px] text-muted-foreground mt-0.5">{fmtFull(entry.timestamp)}</p></div></div>
              ))}</div>
            )}
            {tracking && tracking.events.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />{isAr ? "تتبع مباشر" : "Live"}</h4>
                {tracking.events.map((ev, i) => (
                  <div key={i} className="flex gap-3 pb-3 last:pb-0"><div className="relative flex flex-col items-center"><div className={`h-2 w-2 rounded-full mt-1.5 ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />{i < tracking.events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}</div><div className="min-w-0 flex-1"><p className="text-xs font-medium">{ev.description || ev.status}</p>{ev.location && <p className="text-[10px] text-muted-foreground">{ev.location}</p>}<p className="text-[10px] text-muted-foreground">{fmtFull(ev.timestamp)}</p></div></div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </div>
      </div>
    );
  }

  /* ── Main Bosta page ── */
  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Header with Bosta branding */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <BostaIcon size={32} />
            <div>
              <div className="flex items-center gap-2">
                <BostaLogo height={18} />
                {livePill}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{isAr ? "شحن وتوصيل سريع في مصر" : "Egypt's fastest last-mile delivery"}</p>
            </div>
          </div>
        </div>
        {tab === "shipments" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => { setBulkResult(null); setBulkIds(""); setShowBulk(true); }}>
              <Upload className="h-3 w-3" />{isAr ? "دفعة" : "Bulk"}
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="h-3 w-3" />{isAr ? "شحنة جديدة" : "New Shipment"}
            </Button>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {[
          { label: isAr ? "إجمالي الشحنات" : "Total Shipments", value: stats?.total ?? 0, icon: Package, bg: "from-slate-100 to-slate-50 dark:from-slate-800/40 dark:to-slate-800/20", iconColor: "text-slate-400 dark:text-slate-600" },
          { label: isAr ? "في الطريق" : "In Transit", value: inTransit, icon: Truck, bg: "from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10", iconColor: "text-orange-300 dark:text-orange-800" },
          { label: isAr ? "تم التوصيل" : "Delivered", value: stats?.by_status?.delivered ?? 0, icon: PackageCheck, bg: "from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/10", iconColor: "text-emerald-300 dark:text-emerald-800" },
          { label: isAr ? "COD معلق" : "COD Pending", value: stats ? fmt(stats.cod_pending) : "—", icon: CircleDollarSign, bg: "from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10", iconColor: "text-amber-300 dark:text-amber-800" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${c.bg} p-4`}>
            <c.icon className={`absolute -bottom-2 ltr:-right-2 rtl:-left-2 h-16 w-16 ${c.iconColor}`} />
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{c.label}</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as BostaTab)} className="space-y-4">
        <TabsList className="h-9 p-0.5 bg-muted/60">
          <TabsTrigger value="shipments" className="text-xs gap-1.5 h-8 data-[state=active]:shadow-sm"><Package className="h-3.5 w-3.5" />{isAr ? "الشحنات" : "Shipments"}</TabsTrigger>
          <TabsTrigger value="config" className="text-xs gap-1.5 h-8 data-[state=active]:shadow-sm"><Zap className="h-3.5 w-3.5" />{isAr ? "الإعدادات" : "Setup"}</TabsTrigger>
          <TabsTrigger value="zones" className="text-xs gap-1.5 h-8 data-[state=active]:shadow-sm"><MapPin className="h-3.5 w-3.5" />{isAr ? "المناطق" : "Zones"}</TabsTrigger>
          <TabsTrigger value="cod" className="text-xs gap-1.5 h-8 data-[state=active]:shadow-sm"><CircleDollarSign className="h-3.5 w-3.5" />COD</TabsTrigger>
        </TabsList>

        {/* ─── SHIPMENTS TAB ─── */}
        <TabsContent value="shipments" className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {([
              { v: "all", l: isAr ? "الكل" : "All", count: stats?.total },
              { v: "created", l: isAr ? "جديدة" : "Created" }, { v: "picked_up", l: isAr ? "استلام" : "Picked Up" },
              { v: "in_transit", l: isAr ? "في الطريق" : "In Transit" }, { v: "delivered", l: isAr ? "تم التوصيل" : "Delivered" },
              { v: "returned", l: isAr ? "مرتجع" : "Returned" }, { v: "failed", l: isAr ? "فشل" : "Failed" },
            ] as { v: StatusFilter; l: string; count?: number }[]).map(f => {
              const count = f.count ?? stats?.by_status?.[f.v] ?? 0;
              const active = statusFilter === f.v;
              return (
                <button key={f.v} onClick={() => { setStatusFilter(f.v); setPage(0); }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border cursor-pointer ${active ? "border-foreground/20 bg-foreground text-background shadow-sm" : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/80"}`}>
                  {f.l}{count > 0 && f.v !== "all" ? ` ${count}` : ""}
                </button>
              );
            })}
          </div>
          {listQ.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : shipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3"><Package className="h-6 w-6 text-muted-foreground/30" /></div>
              <p className="text-sm font-medium text-muted-foreground">{isAr ? "لا توجد شحنات" : "No shipments yet"}</p>
              <Button size="sm" className="mt-4 h-8 text-xs gap-1.5" onClick={() => setShowCreate(true)}><Plus className="h-3 w-3" />{isAr ? "شحنة جديدة" : "New Shipment"}</Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border overflow-hidden bg-card">
                <Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">{isAr ? "رقم التتبع" : "Tracking"}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">{isAr ? "النوع" : "Type"}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">COD</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">{isAr ? "التاريخ" : "Date"}</TableHead>
                  <TableHead className="w-8" />
                </TableRow></TableHeader><TableBody>
                  {shipments.map(s => (
                    <TableRow key={s.id} className="cursor-pointer group" onClick={() => openDetail(s.id)}>
                      <TableCell className="font-mono text-xs font-medium">{s.tracking_number || <span className="text-muted-foreground/40">—</span>}</TableCell>
                      <TableCell><StatusBadge status={s.status} isAr={isAr} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">{s.shipment_type}</TableCell>
                      <TableCell className="text-xs tabular-nums">{s.cod_amount > 0 ? <>{fmt(s.cod_amount)}{s.cod_collected && <Check className="inline h-3 w-3 ml-1 text-emerald-500" />}</> : <span className="text-muted-foreground/30">—</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtShort(s.created_at)}</TableCell>
                      <TableCell><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground transition-colors" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3.5 w-3.5 mr-1" />{isAr ? "السابق" : "Prev"}</Button>
                <span className="text-[10px] text-muted-foreground tabular-nums">{isAr ? `صفحة ${page + 1}` : `Page ${page + 1}`}</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={shipments.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>{isAr ? "التالي" : "Next"}<ChevronRight className="h-3.5 w-3.5 ml-1" /></Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ─── SETUP TAB ─── */}
        <TabsContent value="config" className="space-y-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ background: `linear-gradient(135deg, #E306130A, #E3061303)` }}>
              <div className="flex items-center gap-3">
                <BostaIcon size={28} />
                <div>
                  <BostaLogo height={14} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{isAr ? "إعدادات الاتصال" : "Connection settings"}</p>
                </div>
              </div>
              {!editing && livePill}
            </div>
            <div className="p-5">
              {bostaCreds?.is_configured && bostaVerified === false && !editing && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t("logistics.bostaUnreachable")}</span>
                </div>
              )}
              {bostaCreds?.is_configured && !editing ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-muted/30 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">API Key</p><p className="font-mono text-xs">{bostaCreds.api_key_masked || "••••"}</p></div>
                    <div className="rounded-lg bg-muted/30 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Business ID</p><p className="text-xs font-medium">{bostaCreds.business_id || "—"}</p></div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-500" /><span className="text-xs">{isAr ? "إنشاء شحنة تلقائي" : "Auto-create shipment"}</span></div>
                    <Badge variant={bostaCreds.auto_create_shipment ? "default" : "secondary"} className="text-[10px]">{bostaCreds.auto_create_shipment ? "ON" : "OFF"}</Badge>
                  </div>
                  {bostaCreds.last_configured && <p className="text-[10px] text-muted-foreground">{isAr ? "آخر تحديث" : "Updated"}: {fmtDate(bostaCreds.last_configured)}</p>}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => { setEditing(true); setBostaForm({ api_key: "", business_id: bostaCreds.business_id || "", webhook_secret: "", auto_create_shipment: bostaCreds.auto_create_shipment }); }}>{isAr ? "تعديل" : "Edit"}</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive hover:text-destructive" onClick={handleDeleteBosta}>{isAr ? "قطع الاتصال" : "Disconnect"}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label className="text-[11px] font-medium">API Key</Label>
                      <div className="relative"><Input type={showKey ? "text" : "password"} value={bostaForm.api_key} onChange={e => setBostaForm(p => ({ ...p, api_key: e.target.value }))} placeholder="bosta_live_..." className="font-mono text-xs pr-8" /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></div>
                    </div>
                    <div className="grid gap-1.5"><Label className="text-[11px] font-medium">Business ID</Label><Input value={bostaForm.business_id} onChange={e => setBostaForm(p => ({ ...p, business_id: e.target.value }))} className="text-xs" /></div>
                  </div>
                  <div className="grid gap-1.5"><Label className="text-[11px] font-medium">{isAr ? "مفتاح Webhook" : "Webhook Secret"} <span className="text-muted-foreground font-normal">({isAr ? "اختياري" : "optional"})</span></Label><Input type="password" value={bostaForm.webhook_secret} onChange={e => setBostaForm(p => ({ ...p, webhook_secret: e.target.value }))} className="text-xs" /></div>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5"><div className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-500" /><span className="text-xs">{isAr ? "إنشاء شحنة تلقائي" : "Auto-create shipment"}</span></div><Switch checked={bostaForm.auto_create_shipment} onCheckedChange={v => setBostaForm(p => ({ ...p, auto_create_shipment: v }))} /></div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-8 text-xs gap-1.5" style={{ background: "#E30613" }} disabled={bostaSaving || (!bostaForm.api_key && !bostaCreds?.is_configured) || !bostaForm.business_id} onClick={handleSaveBosta}>{bostaSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}{bostaCreds?.is_configured ? (isAr ? "تحديث" : "Update") : (isAr ? "ربط" : "Connect")}</Button>
                    {editing && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditing(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── ZONES TAB ─── */}
        <TabsContent value="zones" className="space-y-4">
          <div className="rounded-xl border overflow-hidden bg-card">
            <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><h3 className="text-sm font-semibold">{isAr ? "مناطق الشحن" : "Shipping Zones"}</h3></div>
              {!showAddZone && <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => setShowAddZone(true)}><Plus className="h-3 w-3" />{isAr ? "إضافة" : "Add"}</Button>}
            </div>
            {!shippingData ? <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            : shippingData.zones.length > 0 ? (
              <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-[10px] uppercase tracking-wider font-semibold">{isAr ? "المنطقة" : "Zone"}</TableHead><TableHead className="text-[10px] uppercase tracking-wider font-semibold">{isAr ? "المحافظات" : "Governorates"}</TableHead><TableHead className="text-[10px] uppercase tracking-wider font-semibold">{isAr ? "السعر" : "Rate"}</TableHead><TableHead className="text-[10px] uppercase tracking-wider font-semibold">{isAr ? "المدة" : "Est."}</TableHead><TableHead className="w-8" /></TableRow></TableHeader><TableBody>
                {shippingData.zones.map(z => (<TableRow key={z.id}><TableCell className="text-xs font-medium">{z.zone}</TableCell><TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{z.governorates}</TableCell><TableCell className="text-xs tabular-nums font-medium">{z.rate} EGP</TableCell><TableCell className="text-xs text-muted-foreground">{z.estimated_days}</TableCell><TableCell><button onClick={() => handleDeleteZone(z.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"><Trash2 className="h-3 w-3" /></button></TableCell></TableRow>))}
              </TableBody></Table>
            ) : <div className="py-8 text-center text-xs text-muted-foreground">{isAr ? "لا توجد مناطق" : "No zones"}</div>}
            {showAddZone && (
              <div className="p-4 border-t bg-muted/10 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1"><Label className="text-[11px]">{isAr ? "المنطقة" : "Zone"}</Label><Input value={newZone.zone} onChange={e => setNewZone(p => ({ ...p, zone: e.target.value }))} placeholder={isAr ? "القاهرة الكبرى" : "Greater Cairo"} className="text-xs" /></div>
                  <div className="grid gap-1"><Label className="text-[11px]">{isAr ? "المحافظات" : "Governorates"}</Label><Input value={newZone.governorates} onChange={e => setNewZone(p => ({ ...p, governorates: e.target.value }))} placeholder={isAr ? "القاهرة، الجيزة" : "Cairo, Giza"} className="text-xs" /></div>
                  <div className="grid gap-1"><Label className="text-[11px]">{isAr ? "السعر" : "Rate"} (EGP)</Label><Input type="number" value={newZone.rate || ""} onChange={e => setNewZone(p => ({ ...p, rate: Number(e.target.value) }))} className="text-xs" /></div>
                  <div className="grid gap-1"><Label className="text-[11px]">{isAr ? "المدة" : "Est. Days"}</Label><Input value={newZone.estimated_days} onChange={e => setNewZone(p => ({ ...p, estimated_days: e.target.value }))} placeholder="2-3 days" className="text-xs" /></div>
                </div>
                <div className="flex gap-2"><Button size="sm" className="h-7 text-[11px]" onClick={handleAddZone} disabled={!newZone.zone}>{isAr ? "إضافة" : "Add"}</Button><Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowAddZone(false)}>{isAr ? "إلغاء" : "Cancel"}</Button></div>
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-card px-5 py-3.5 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{isAr ? "شحن مجاني فوق" : "Free shipping above"}</span>
            <Input type="number" value={freeThreshold} onChange={e => setFreeThreshold(Number(e.target.value))} className="w-24 h-7 text-xs tabular-nums" />
            <span className="text-[11px] text-muted-foreground">EGP</span>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={async () => { if (!storeId) return; try { await updateShippingSettings(storeId, { free_shipping_threshold: freeThreshold }); toast.success(isAr ? "تم الحفظ" : "Saved"); } catch (e) { showError(e, language); } }}>{isAr ? "حفظ" : "Save"}</Button>
          </div>
        </TabsContent>

        {/* ─── COD TAB ─── */}
        <TabsContent value="cod" className="space-y-4">
          {codQ.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : codQ.data ? (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {[
                  { label: isAr ? "إجمالي المتوقع" : "Expected", value: fmt(codQ.data.total_expected), color: "" },
                  { label: isAr ? "تم التحصيل" : "Collected", value: fmt(codQ.data.total_collected), color: "text-emerald-600 dark:text-emerald-400" },
                  { label: isAr ? "معلق" : "Pending", value: fmt(codQ.data.total_pending), color: "text-amber-600 dark:text-amber-400" },
                  { label: isAr ? "بدون تحصيل" : "Not Collected", value: String(codQ.data.delivered_not_collected), color: "text-rose-600 dark:text-rose-400" },
                ].map((c, i) => (
                  <div key={i} className="rounded-xl border bg-card p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{c.label}</p><p className={`text-xl font-bold tabular-nums ${c.color}`}>{c.value}</p></div>
                ))}
              </div>
              {codQ.data.total_expected > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">{isAr ? "معدل التحصيل" : "Collection Rate"}</span><span className="text-sm font-bold tabular-nums">{Math.round((codQ.data.total_collected / codQ.data.total_expected) * 100)}%</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, Math.round((codQ.data.total_collected / codQ.data.total_expected) * 100))}%` }} /></div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground"><span>{codQ.data.collected_count} {isAr ? "محصّلة" : "collected"}</span><span>{codQ.data.total_shipments} {isAr ? "إجمالي" : "total"}</span></div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3"><CircleDollarSign className="h-6 w-6 text-muted-foreground/30" /></div>
              <p className="text-sm font-medium text-muted-foreground">{isAr ? "لا توجد بيانات" : "No COD data yet"}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialogs ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-4 w-4" />{isAr ? "إنشاء شحنة" : "Create Shipment"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5"><Label className="text-[11px]">{isAr ? "رقم الطلب" : "Order ID"}</Label><Input value={createOrderId} onChange={e => setCreateOrderId(e.target.value)} placeholder="Paste order UUID" className="font-mono text-xs" /></div>
            <div className="grid gap-1.5"><Label className="text-[11px]">{isAr ? "الطريقة" : "Method"}</Label><div className="flex gap-2">{["standard", "express"].map(m => (<button key={m} onClick={() => setCreateMethod(m)} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${createMethod === m ? "border-foreground/20 bg-foreground text-background" : "border-border bg-background hover:bg-muted/50"}`}>{m === "standard" ? (isAr ? "عادي" : "Standard") : (isAr ? "سريع" : "Express")}</button>))}</div></div>
            <div className="grid gap-1.5"><Label className="text-[11px]">{isAr ? "ملاحظات" : "Notes"}</Label><Textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)} rows={2} className="text-xs" /></div>
          </div>
          <DialogFooter><Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>{isAr ? "إلغاء" : "Cancel"}</Button><Button size="sm" onClick={handleCreate} disabled={creating || !createOrderId.trim()} className="gap-1.5">{creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}{isAr ? "إنشاء" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="h-4 w-4" />{isAr ? "شحنات دفعة" : "Bulk Create"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-[11px]">{isAr ? "Order IDs (سطر لكل واحد)" : "Order IDs (one per line)"}</Label>
            <Textarea value={bulkIds} onChange={e => setBulkIds(e.target.value)} rows={5} className="font-mono text-xs" placeholder={"uuid-1\nuuid-2"} />
            {bulkResult && <div className="rounded-lg border overflow-hidden"><div className="px-3 py-2 bg-muted/30 text-xs font-medium">{bulkResult.succeeded}/{bulkResult.total} {isAr ? "نجح" : "succeeded"}</div>{bulkResult.results.filter(r => !r.success).map((r, i) => <div key={i} className="px-3 py-1 text-[11px] text-destructive font-mono truncate">{r.order_id.slice(0, 8)}… {r.error}</div>)}</div>}
          </div>
          <DialogFooter><Button variant="ghost" size="sm" onClick={() => setShowBulk(false)}>{isAr ? "إغلاق" : "Close"}</Button><Button size="sm" onClick={handleBulk} disabled={bulking || !bulkIds.trim()} className="gap-1.5">{bulking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}{isAr ? "إنشاء" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {detailLoading && <div className="fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
    </div>
  );
};

export default Logistics;
