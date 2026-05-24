/**
 * 2-column responsive grid hosting the 8 chart panels for a campaign.
 * Feature 002 US3 T046.
 *
 * Below `lg` breakpoint the grid collapses to 1 column. Each panel
 * loads its own data via TanStack Query so panels render
 * independently — a slow query on one doesn't block the others.
 *
 * "Items sold by product" is special: it consumes `top_products` from
 * the performance endpoint that the KPI cards already fetched, so we
 * pass the value in instead of making a redundant request.
 */

import { useQuery } from "@tanstack/react-query";

import { getCampaignPerformance, type AttributionModelName } from "@/services/campaignApi";

import {
  ItemsSoldByProductPanel,
  OrdersNewVsReturningPanel,
  SalesByChannelPanel,
  SalesByOrderSizePanel,
  SalesByUtmPanel,
  SessionsByChannelPanel,
  SessionsByDevicePanel,
  SessionsByUtmPanel,
} from "./panels/BreakdownPanels";

export interface CampaignChartGridProps {
  storeId: string;
  campaignId: string;
  dateFrom: string;
  dateTo: string;
  attributionModel: AttributionModelName;
  formatCurrency: (cents: number) => string;
}

export function CampaignChartGrid(props: CampaignChartGridProps) {
  const performanceQuery = useQuery({
    queryKey: [
      "campaign-performance",
      props.storeId,
      props.campaignId,
      props.dateFrom,
      props.dateTo,
    ],
    queryFn: () =>
      getCampaignPerformance(
        props.storeId,
        props.campaignId,
        props.dateFrom,
        props.dateTo,
      ),
    enabled: !!props.storeId && !!props.campaignId,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SessionsByChannelPanel {...props} />
      <SalesByChannelPanel {...props} />
      <SessionsByUtmPanel {...props} />
      <SalesByUtmPanel {...props} />
      <OrdersNewVsReturningPanel {...props} />
      <SalesByOrderSizePanel {...props} />
      <ItemsSoldByProductPanel
        topProducts={performanceQuery.data?.totals.top_products}
        loading={performanceQuery.isLoading}
        formatCurrency={props.formatCurrency}
      />
      <SessionsByDevicePanel {...props} />
    </div>
  );
}
