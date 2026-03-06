export interface Product {
  item_id: string;
  item_name: string;
  sale_volume: number;
  offer_price: number;
  approved_cost: number;
  standard_cost: number;
  actual_cost: number;
  created_at: string;
}

export type CostModel = 'approved' | 'standard' | 'actual';

export interface ScenarioAssumption {
  item_id: string;
  item_name: string;
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

export interface ProductGroup {
  id: string;
  name: string;
  description: string;
  product_ids: string[];
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
  | 'product-groups'
  | 'scenario-creator' 
  | 'scenario-comparison' 
  | 'cost-analysis' 
  | 'price-sensitivity'
  | 'reports';
