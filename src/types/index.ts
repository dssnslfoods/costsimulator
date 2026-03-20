export interface Product {
  item_id: string;
  item_name: string;
  item_group?: string;
  item_country?: string;
  sale_volume: number;
  offer_price: number;
  approved_cost: number;
  standard_cost: number;
  actual_cost: number;
  created_at: string;
  date?: string; // We'll use this for the transaction date if needed, though product master shouldn't have it
}

export interface DbProductMaster {
  item_id: string;
  item_name: string;
  item_group?: string;
  item_country?: string;
}

export interface DbTransaction {
  date: string;
  item_id: string;
  item_name: string;
  sale_volume: number;
  offer_price: number;
  approved_cost: number;
  standard_cost: number;
  actual_cost: number;
}

export type CostModel = 'approved' | 'standard' | 'actual';

export interface ScenarioAssumption {
  item_id: string;
  item_name: string;
  item_group?: string;
  item_country?: string;
  selling_price: number;
  forecast_volume: number;
  cost_model: CostModel;
  cost_adjustment: number; // percentage adjustment
  base_cost: number;
  adjusted_cost: number;
  revenue: number;
  total_cost: number;
  profit: number;
  margin: number;
}

export interface ScenarioConfig {
  costModel: CostModel;
  priceAdj: number;
  priceAdjUnit: 'pct' | 'fixed';
  volumeAdj: number;
  volumeAdjUnit: 'pct' | 'pieces';
  costAdj: number;
  costAdjUnit: 'pct' | 'fixed';
}

export interface Scenario {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  description: string;
  assumptions: ScenarioAssumption[];
  totals: ScenarioTotals;
  config?: ScenarioConfig;
}

export interface ScenarioTotals {
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  avg_margin: number;
  product_count: number;
}

export interface PriceSensitivityPoint {
  price_pct: number;
  price: number;
  revenue: number;
  profit: number;
  margin: number;
}

export interface PromotionItem {
  item_id: string;
  item_name: string;
  volume: number;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  item_group?: string;
  item_country?: string;
  items: PromotionItem[];
  created_at: string;
}

export interface ComparisonReport {
  id: string;
  name: string;
  description: string;
  scenario_ids: string[];
  snapshot: {
    scenarios: Array<{
      id: string;
      name: string;
      totals: ScenarioTotals;
    }>;
  };
  created_at: string;
}

export type AppView =
  | 'dashboard'
  | 'products'
  | 'promotions'
  | 'scenario-creator'
  | 'scenario-comparison'
  | 'cost-analysis'
  | 'price-sensitivity'
  | 'reports';
