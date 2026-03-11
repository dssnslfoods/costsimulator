import { Product, CostModel, ScenarioAssumption, ScenarioTotals, PriceSensitivityPoint } from '@/types';

export function getCostByModel(product: Product, model: CostModel): number {
  switch (model) {
    case 'approved': return product.approved_cost;
    case 'standard': return product.standard_cost;
    case 'actual': return product.actual_cost;
  }
}

export function calculateAssumption(
  product: Product,
  sellingPrice: number,
  forecastVolume: number,
  costModel: CostModel,
  costAdjustment: number // percentage, e.g. 5 means +5%
): ScenarioAssumption {
  const baseCost = getCostByModel(product, costModel);
  const adjustedCost = baseCost * (1 + costAdjustment / 100);
  const revenue = sellingPrice * forecastVolume;
  const totalCost = adjustedCost * forecastVolume;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    item_id: product.item_id,
    item_name: product.item_name,
    item_group: product.item_group,
    item_country: product.item_country,
    selling_price: sellingPrice,
    forecast_volume: forecastVolume,
    cost_model: costModel,
    cost_adjustment: costAdjustment,
    base_cost: baseCost,
    adjusted_cost: adjustedCost,
    revenue,
    total_cost: totalCost,
    profit,
    margin,
  };
}

export function calculateTotals(assumptions: ScenarioAssumption[]): ScenarioTotals {
  const totalRevenue = assumptions.reduce((s, a) => s + a.revenue, 0);
  const totalCost = assumptions.reduce((s, a) => s + a.total_cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    total_revenue: totalRevenue,
    total_cost: totalCost,
    total_profit: totalProfit,
    avg_margin: avgMargin,
    product_count: assumptions.length,
  };
}

export function generatePriceSensitivity(
  product: Product,
  basePrice: number,
  volume: number,
  costModel: CostModel,
  costAdjustment: number,
  rangeMin: number = 80,
  rangeMax: number = 120,
  steps: number = 21
): PriceSensitivityPoint[] {
  const points: PriceSensitivityPoint[] = [];
  const step = (rangeMax - rangeMin) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const pct = rangeMin + step * i;
    const price = basePrice * (pct / 100);
    const cost = getCostByModel(product, costModel) * (1 + costAdjustment / 100);
    const revenue = price * volume;
    const totalCost = cost * volume;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    points.push({ price_pct: pct, price, revenue, profit, margin });
  }

  return points;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
