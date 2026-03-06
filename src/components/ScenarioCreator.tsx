import { useState, useMemo, useEffect } from 'react';
import { useAppState } from '@/store/AppContext';
import { CostModel, Scenario, ScenarioAssumption, ScenarioConfig } from '@/types';
import { calculateAssumption, calculateTotals, formatCurrency, formatNumber, formatPercent } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, RotateCcw, Search, CheckSquare, Square, FolderOpen } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

type AdjUnit = 'pct' | 'fixed';
type VolUnit = 'pct' | 'pieces';

function AdjInput({
  label,
  value,
  onChange,
  unit,
  onUnitChange,
  unitOptions,
  sliderMin = -50,
  sliderMax = 50,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  onUnitChange: (u: string) => void;
  unitOptions: { value: string; label: string }[];
  sliderMin?: number;
  sliderMax?: number;
  step?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <Select value={unit} onValueChange={onUnitChange}>
          <SelectTrigger className="h-6 w-16 text-xs border-0 bg-transparent px-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={sliderMin}
          max={sliderMax}
          step={step}
          className="flex-1"
        />
        <Input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="font-mono w-20 h-8 text-sm text-right shrink-0"
        />
      </div>
    </div>
  );
}

export default function ScenarioCreator() {
  const { state, dispatch } = useAppState();
  const products = state.products;
  const editingScenario = state.editingScenarioId
    ? state.scenarios.find(s => s.id === state.editingScenarioId) ?? null
    : null;

  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDesc, setScenarioDesc] = useState('');
  const [globalCostModel, setGlobalCostModel] = useState<CostModel>('actual');

  const [globalPriceAdj, setGlobalPriceAdj] = useState(0);
  const [priceAdjUnit, setPriceAdjUnit] = useState<AdjUnit>('pct');

  const [globalVolumeAdj, setGlobalVolumeAdj] = useState(0);
  const [volumeAdjUnit, setVolumeAdjUnit] = useState<VolUnit>('pct');

  const [globalCostAdj, setGlobalCostAdj] = useState(0);
  const [costAdjUnit, setCostAdjUnit] = useState<AdjUnit>('pct');

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(products.map(p => p.item_id)));
  const [overrides, setOverrides] = useState<Record<string, {
    price?: number; volume?: number; costAdj?: number; costModel?: CostModel;
  }>>({});

  // Load editing scenario
  useEffect(() => {
    if (editingScenario) {
      setScenarioName(editingScenario.name);
      setScenarioDesc(editingScenario.description);
      setSelectedIds(new Set(editingScenario.assumptions.map(a => a.item_id)));

      // Restore global config
      if (editingScenario.config) {
        const c = editingScenario.config;
        setGlobalCostModel(c.costModel);
        setGlobalPriceAdj(c.priceAdj);
        setPriceAdjUnit(c.priceAdjUnit);
        setGlobalVolumeAdj(c.volumeAdj);
        setVolumeAdjUnit(c.volumeAdjUnit);
        setGlobalCostAdj(c.costAdj);
        setCostAdjUnit(c.costAdjUnit);
        setOverrides({});
      } else {
        // Legacy scenarios without config — load from per-product overrides
        const newOverrides: Record<string, { price?: number; volume?: number; costAdj?: number; costModel?: CostModel }> = {};
        editingScenario.assumptions.forEach(a => {
          newOverrides[a.item_id] = {
            price: a.selling_price,
            volume: a.forecast_volume,
            costAdj: a.cost_adjustment,
            costModel: a.cost_model,
          };
        });
        setOverrides(newOverrides);
        setGlobalPriceAdj(0);
        setGlobalVolumeAdj(0);
        setGlobalCostAdj(0);
      }
    }
  }, [editingScenario?.id]);

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

      // Price calculation
      let price: number;
      if (o.price != null) {
        price = o.price;
      } else if (priceAdjUnit === 'fixed') {
        price = p.offer_price + globalPriceAdj;
      } else {
        price = p.offer_price * (1 + globalPriceAdj / 100);
      }

      // Volume calculation
      let volume: number;
      if (o.volume != null) {
        volume = o.volume;
      } else if (volumeAdjUnit === 'pieces') {
        volume = p.sale_volume + globalVolumeAdj;
      } else {
        volume = p.sale_volume * (1 + globalVolumeAdj / 100);
      }

      // Cost adjustment — convert fixed to % relative to base cost
      let costAdj: number;
      if (o.costAdj != null) {
        costAdj = o.costAdj;
      } else if (costAdjUnit === 'fixed') {
        const baseCost = globalCostModel === 'approved' ? p.approved_cost
          : globalCostModel === 'standard' ? p.standard_cost : p.actual_cost;
        costAdj = baseCost > 0 ? (globalCostAdj / baseCost) * 100 : 0;
      } else {
        costAdj = globalCostAdj;
      }

      const costModel = o.costModel ?? globalCostModel;
      return calculateAssumption(p, price, volume, costModel, costAdj);
    });
  }, [products, selectedIds, overrides, globalCostModel, globalPriceAdj, priceAdjUnit, globalVolumeAdj, volumeAdjUnit, globalCostAdj, costAdjUnit]);

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

    const config: ScenarioConfig = {
      costModel: globalCostModel,
      priceAdj: globalPriceAdj,
      priceAdjUnit,
      volumeAdj: globalVolumeAdj,
      volumeAdjUnit,
      costAdj: globalCostAdj,
      costAdjUnit,
    };

    if (editingScenario) {
      const updated: Scenario = {
        ...editingScenario,
        name: scenarioName.trim(),
        description: scenarioDesc.trim(),
        updated_at: new Date().toISOString(),
        assumptions,
        totals,
        config,
      };
      dispatch({ type: 'UPDATE_SCENARIO', payload: updated });
      dispatch({ type: 'CLEAR_EDITING' });
      toast.success(`Scenario "${updated.name}" updated`);
    } else {
      const scenario: Scenario = {
        id: crypto.randomUUID(),
        name: scenarioName.trim(),
        description: scenarioDesc.trim(),
        created_by: 'User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assumptions,
        totals,
        config,
      };
      dispatch({ type: 'ADD_SCENARIO', payload: scenario });
      toast.success(`Scenario "${scenario.name}" saved`);
    }
    setScenarioName('');
    setScenarioDesc('');
  };

  const handleReset = () => {
    setGlobalPriceAdj(0);
    setPriceAdjUnit('pct');
    setGlobalVolumeAdj(0);
    setVolumeAdjUnit('pct');
    setGlobalCostAdj(0);
    setCostAdjUnit('pct');
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {editingScenario ? `Edit: ${editingScenario.name}` : 'Scenario Creator'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {editingScenario ? 'Editing existing scenario' : 'Simulate pricing, volume, and cost changes'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {editingScenario && (
            <Button variant="outline" size="sm" onClick={() => {
              dispatch({ type: 'CLEAR_EDITING' });
              handleReset();
            }}>
              Cancel Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw size={14} />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save size={14} />
            {editingScenario ? 'Update Scenario' : 'Save Scenario'}
          </Button>
        </div>
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

          <AdjInput
            label="Selling Price Adj."
            value={globalPriceAdj}
            onChange={setGlobalPriceAdj}
            unit={priceAdjUnit}
            onUnitChange={(u) => { setPriceAdjUnit(u as AdjUnit); setGlobalPriceAdj(0); }}
            unitOptions={[
              { value: 'pct', label: '%' },
              { value: 'fixed', label: '฿' },
            ]}
            sliderMin={priceAdjUnit === 'pct' ? -50 : -20}
            sliderMax={priceAdjUnit === 'pct' ? 50 : 20}
            step={priceAdjUnit === 'pct' ? 1 : 0.5}
          />

          <AdjInput
            label="Volume Adj."
            value={globalVolumeAdj}
            onChange={setGlobalVolumeAdj}
            unit={volumeAdjUnit}
            onUnitChange={(u) => { setVolumeAdjUnit(u as VolUnit); setGlobalVolumeAdj(0); }}
            unitOptions={[
              { value: 'pct', label: '%' },
              { value: 'pieces', label: 'ชิ้น' },
            ]}
            sliderMin={volumeAdjUnit === 'pct' ? -50 : -500000}
            sliderMax={volumeAdjUnit === 'pct' ? 50 : 500000}
            step={volumeAdjUnit === 'pct' ? 1 : 10000}
          />

          <AdjInput
            label="Cost Adj."
            value={globalCostAdj}
            onChange={setGlobalCostAdj}
            unit={costAdjUnit}
            onUnitChange={(u) => { setCostAdjUnit(u as AdjUnit); setGlobalCostAdj(0); }}
            unitOptions={[
              { value: 'pct', label: '%' },
              { value: 'fixed', label: '฿' },
            ]}
            sliderMin={costAdjUnit === 'pct' ? -50 : -20}
            sliderMax={costAdjUnit === 'pct' ? 50 : 20}
            step={costAdjUnit === 'pct' ? 1 : 0.5}
          />
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
            {state.productGroups.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <FolderOpen size={14} />
                    เลือกจากกลุ่ม
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {state.productGroups.map(g => (
                    <DropdownMenuItem key={g.id} onClick={() => {
                      setSelectedIds(new Set(g.product_ids));
                    }}>
                      {g.name} ({g.product_ids.length} สินค้า)
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
              <th className="text-right">Base Price</th>
              <th className="text-right">Selling Price</th>
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
                  <td className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(p.offer_price)}</td>
                  {a ? (
                    <>
                      <td className={`text-right font-mono text-sm font-semibold ${a.selling_price !== p.offer_price ? 'text-primary' : ''}`}>
                        {formatCurrency(a.selling_price)}
                      </td>
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
                    <td colSpan={7} className="text-center text-xs text-muted-foreground">—</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
