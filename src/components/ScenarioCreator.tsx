import { useState, useMemo } from 'react';
import { useAppState } from '@/store/AppContext';
import { CostModel, Scenario, ScenarioAssumption } from '@/types';
import { calculateAssumption, calculateTotals, formatCurrency, formatNumber, formatPercent } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, RotateCcw, Search, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';

export default function ScenarioCreator() {
  const { state, dispatch } = useAppState();
  const products = state.products;
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDesc, setScenarioDesc] = useState('');
  const [globalCostModel, setGlobalCostModel] = useState<CostModel>('actual');
  const [globalPriceAdj, setGlobalPriceAdj] = useState(0);
  const [globalVolumeAdj, setGlobalVolumeAdj] = useState(0);
  const [globalCostAdj, setGlobalCostAdj] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(products.map(p => p.item_id)));
  const [overrides, setOverrides] = useState<Record<string, {
    price?: number; volume?: number; costAdj?: number; costModel?: CostModel;
  }>>({});

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.item_id)));
    }
  };

  const filteredProducts = products.filter(p =>
    p.item_id.toLowerCase().includes(search.toLowerCase()) ||
    p.item_name.toLowerCase().includes(search.toLowerCase())
  );

  const assumptions = useMemo<ScenarioAssumption[]>(() => {
    return products.filter(p => selectedIds.has(p.item_id)).map(p => {
      const o = overrides[p.item_id] || {};
      const price = o.price ?? p.offer_price * (1 + globalPriceAdj / 100);
      const volume = o.volume ?? p.sale_volume * (1 + globalVolumeAdj / 100);
      const costModel = o.costModel ?? globalCostModel;
      const costAdj = o.costAdj ?? globalCostAdj;
      return calculateAssumption(p, price, volume, costModel, costAdj);
    });
  }, [products, selectedIds, overrides, globalCostModel, globalPriceAdj, globalVolumeAdj, globalCostAdj]);

  const totals = useMemo(() => calculateTotals(assumptions), [assumptions]);

  const assumptionMap = useMemo(() => {
    const map: Record<string, ScenarioAssumption> = {};
    assumptions.forEach(a => { map[a.item_id] = a; });
    return map;
  }, [assumptions]);

  const handleSave = () => {
    if (!scenarioName.trim()) {
      toast.error('Please enter a scenario name');
      return;
    }
    if (products.length === 0) {
      toast.error('No products loaded');
      return;
    }

    const scenario: Scenario = {
      id: crypto.randomUUID(),
      name: scenarioName.trim(),
      description: scenarioDesc.trim(),
      created_by: 'User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assumptions,
      totals,
    };

    dispatch({ type: 'ADD_SCENARIO', payload: scenario });
    toast.success(`Scenario "${scenario.name}" saved`);
    setScenarioName('');
    setScenarioDesc('');
  };

  const handleReset = () => {
    setGlobalPriceAdj(0);
    setGlobalVolumeAdj(0);
    setGlobalCostAdj(0);
    setGlobalCostModel('actual');
    setOverrides({});
    setSelectedIds(new Set(products.map(p => p.item_id)));
  };

  if (products.length === 0) {
    return (
      <div className="metric-card text-center py-16 animate-fade-in">
        <h3 className="text-lg font-semibold mb-2">No Products Available</h3>
        <p className="text-muted-foreground text-sm">Import products first from Product Master.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Scenario Creator</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Simulate pricing, volume, and cost changes
        </p>
      </div>

      {/* Scenario Info */}
      <div className="metric-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Scenario Name *</label>
            <Input
              value={scenarioName}
              onChange={e => setScenarioName(e.target.value)}
              placeholder="e.g., Q2 Price Increase 5%"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={scenarioDesc}
              onChange={e => setScenarioDesc(e.target.value)}
              placeholder="Brief description of assumptions"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Global Adjustments */}
      <div className="metric-card">
        <h3 className="section-header">Global Adjustments</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cost Model</label>
            <Select value={globalCostModel} onValueChange={(v) => setGlobalCostModel(v as CostModel)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved Cost</SelectItem>
                <SelectItem value="standard">Standard Cost</SelectItem>
                <SelectItem value="actual">Actual Cost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Price Adj. (%)</label>
            <Input
              type="number"
              value={globalPriceAdj}
              onChange={e => setGlobalPriceAdj(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Volume Adj. (%)</label>
            <Input
              type="number"
              value={globalVolumeAdj}
              onChange={e => setGlobalVolumeAdj(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cost Adj. (%)</label>
            <Input
              type="number"
              value={globalCostAdj}
              onChange={e => setGlobalCostAdj(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <p className="stat-label">Total Revenue</p>
          <p className="text-xl font-bold font-mono mt-1">฿{formatCurrency(totals.total_revenue)}</p>
        </div>
        <div className="metric-card">
          <p className="stat-label">Total Cost</p>
          <p className="text-xl font-bold font-mono mt-1">฿{formatCurrency(totals.total_cost)}</p>
        </div>
        <div className="metric-card">
          <p className="stat-label">Total Profit</p>
          <p className={`text-xl font-bold font-mono mt-1 ${totals.total_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
            ฿{formatCurrency(totals.total_profit)}
          </p>
        </div>
        <div className="metric-card">
          <p className="stat-label">Avg. Margin</p>
          <p className={`text-xl font-bold font-mono mt-1 ${totals.avg_margin >= 20 ? 'text-success' : totals.avg_margin >= 10 ? 'text-warning' : 'text-destructive'}`}>
            {formatPercent(totals.avg_margin)}
          </p>
        </div>
      </div>

      {/* Product-level details */}
      <div className="metric-card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="section-header mb-0">Product Selection</h3>
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} / {products.length} selected
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={toggleAll} className="h-8 text-xs">
              {selectedIds.size === products.length ? <Square size={14} /> : <CheckSquare size={14} />}
              {selectedIds.size === products.length ? 'Deselect All' : 'Select All'}
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 w-48"
              />
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Product</th>
              <th className="text-right">Price</th>
              <th className="text-right">Volume</th>
              <th className="text-right">Unit Cost</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Profit</th>
              <th className="text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => {
              const isSelected = selectedIds.has(p.item_id);
              const a = assumptionMap[p.item_id];
              return (
                <tr key={p.item_id} className={!isSelected ? 'opacity-40' : ''}>
                  <td>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItem(p.item_id)}
                    />
                  </td>
                  <td>
                    <div className="max-w-[250px] truncate text-sm">{p.item_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.item_id}</div>
                  </td>
                  {a ? (
                    <>
                      <td className="text-right font-mono text-sm">{formatCurrency(a.selling_price)}</td>
                      <td className="text-right font-mono text-sm">{formatNumber(Math.round(a.forecast_volume))}</td>
                      <td className="text-right font-mono text-sm">{formatCurrency(a.adjusted_cost)}</td>
                      <td className="text-right font-mono text-sm">{formatCurrency(a.revenue)}</td>
                      <td className={`text-right font-mono text-sm font-semibold ${a.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(a.profit)}
                      </td>
                      <td className={`text-right font-mono text-sm font-semibold ${a.margin >= 20 ? 'text-success' : a.margin >= 10 ? 'text-warning' : 'text-destructive'}`}>
                        {formatPercent(a.margin)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="text-center text-xs text-muted-foreground">—</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw size={16} />
          Reset
        </Button>
        <Button onClick={handleSave}>
          <Save size={16} />
          Save Scenario
        </Button>
      </div>
    </div>
  );
}
