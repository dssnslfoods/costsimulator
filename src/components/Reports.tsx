import { useState, useMemo } from 'react';
import { useAppState } from '@/store/AppContext';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, FileSpreadsheet, FileText, Trash2, Eye, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import TvModeToggle from '@/components/TvModeToggle';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell
} from 'recharts';

const COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(168, 72%, 40%)',
  'hsl(262, 83%, 58%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
];

export default function Reports() {
  const { state, dispatch } = useAppState();
  const { scenarios, products, comparisonReports } = state;
  const [selectedProjectionId, setSelectedProjectionId] = useState<string>('');
  const [showAllProducts, setShowAllProducts] = useState(false);

  const exportCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded`);
  };

  const exportScenarioSummary = () => {
    const headers = ['Scenario Name', 'Created', 'Products', 'Revenue', 'Cost', 'Profit', 'Margin %', 'Food Cost %'];
    const rows = scenarios.map(s => [
      `"${s.name}"`,
      new Date(s.created_at).toLocaleDateString(),
      String(s.totals.product_count),
      s.totals.total_revenue.toFixed(2),
      s.totals.total_cost.toFixed(2),
      s.totals.total_profit.toFixed(2),
      s.totals.avg_margin.toFixed(2),
      (100 - s.totals.avg_margin).toFixed(2),
    ]);
    exportCSV('scenario_summary.csv', headers, rows);
  };

  const exportProductData = () => {
    const headers = ['Item ID', 'Item Name', 'Volume', 'Offer Price', 'Approved Cost', 'Standard Cost', 'Actual Cost'];
    const rows = products.map(p => [
      p.item_id,
      `"${p.item_name}"`,
      String(p.sale_volume),
      p.offer_price.toFixed(2),
      p.approved_cost.toFixed(2),
      p.standard_cost.toFixed(2),
      p.actual_cost.toFixed(2),
    ]);
    exportCSV('product_data.csv', headers, rows);
  };

  const exportScenarioDetail = (scenarioId: string) => {
    const s = scenarios.find(sc => sc.id === scenarioId);
    if (!s) return;
    const headers = ['Item ID', 'Item Name', 'Selling Price', 'Volume', 'Cost Model', 'Unit Cost', 'Revenue', 'Profit', 'Margin %', 'Food Cost %'];
    const rows = s.assumptions.map(a => [
      a.item_id,
      `"${a.item_name}"`,
      a.selling_price.toFixed(2),
      String(Math.round(a.forecast_volume)),
      a.cost_model,
      a.adjusted_cost.toFixed(2),
      a.revenue.toFixed(2),
      a.profit.toFixed(2),
      a.margin.toFixed(2),
      (100 - a.margin).toFixed(2),
    ]);
    exportCSV(`scenario_${s.name.replace(/\s+/g, '_')}.csv`, headers, rows);
  };

  // Profit Projection data
  const selectedScenario = scenarios.find(s => s.id === selectedProjectionId);

  const profitChartData = useMemo(() =>
    scenarios.map((s, i) => ({
      name: s.name.length > 15 ? s.name.substring(0, 15) + '…' : s.name,
      profit: s.totals.total_profit,
      fill: COLORS[i % COLORS.length],
    })),
    [scenarios]
  );

  const bestWorstCase = useMemo(() => {
    if (scenarios.length === 0) return null;
    const best = scenarios.reduce((b, s) => s.totals.total_profit > b.totals.total_profit ? s : b);
    const worst = scenarios.reduce((w, s) => s.totals.total_profit < w.totals.total_profit ? s : w);
    return { best, worst, diff: best.totals.total_profit - worst.totals.total_profit };
  }, [scenarios]);

  const profitVsFoodCost = useMemo(() => {
    if (!selectedScenario) return [];
    return selectedScenario.assumptions.map(a => ({
      name: a.item_name.length > 20 ? a.item_name.substring(0, 20) + '…' : a.item_name,
      foodCost: 100 - a.margin,
      profit: a.profit,
      margin: a.margin,
    }));
  }, [selectedScenario]);

  const sortedProducts = useMemo(() => {
    if (!selectedScenario) return [];
    return [...selectedScenario.assumptions].sort((a, b) => b.profit - a.profit);
  }, [selectedScenario]);

  const displayProducts = showAllProducts ? sortedProducts : sortedProducts.slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Generate and export reports for management
          </p>
        </div>
        <TvModeToggle />
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="metric-card">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg gradient-primary">
              <FileSpreadsheet size={20} className="text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Product Data Export</h3>
              <p className="text-xs text-muted-foreground mt-1">Export all product master data including costs</p>
              <Button size="sm" className="mt-3" onClick={exportProductData} disabled={products.length === 0}>
                <FileDown size={14} /> Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg gradient-success">
              <FileText size={20} className="text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Scenario Summary</h3>
              <p className="text-xs text-muted-foreground mt-1">Compare all scenarios in one report</p>
              <Button size="sm" className="mt-3" onClick={exportScenarioSummary} disabled={scenarios.length === 0}>
                <FileDown size={14} /> Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg gradient-warning">
              <FileSpreadsheet size={20} className="text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Profit Projection</h3>
              <p className="text-xs text-muted-foreground mt-1">Detailed profit analysis with charts</p>
              <Select value={selectedProjectionId} onValueChange={setSelectedProjectionId}>
                <SelectTrigger className="mt-2 h-8 text-xs">
                  <SelectValue placeholder="เลือก Scenario..." />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Profit Projection Section */}
      {scenarios.length >= 1 && (
        <div className="space-y-6">
          {/* Best / Worst Case Summary */}
          {bestWorstCase && scenarios.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="metric-card border-success/30 bg-success/5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={18} className="text-success" />
                  <p className="text-xs font-medium text-success uppercase tracking-wider">Best Case</p>
                </div>
                <p className="font-semibold">{bestWorstCase.best.name}</p>
                <p className="font-mono font-bold text-xl mt-1 text-success">฿{formatCurrency(bestWorstCase.best.totals.total_profit)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Margin: {formatPercent(bestWorstCase.best.totals.avg_margin)} · Food Cost: {formatPercent(100 - bestWorstCase.best.totals.avg_margin)}
                </p>
              </div>
              <div className="metric-card border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={18} className="text-destructive" />
                  <p className="text-xs font-medium text-destructive uppercase tracking-wider">Worst Case</p>
                </div>
                <p className="font-semibold">{bestWorstCase.worst.name}</p>
                <p className="font-mono font-bold text-xl mt-1 text-destructive">฿{formatCurrency(bestWorstCase.worst.totals.total_profit)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Margin: {formatPercent(bestWorstCase.worst.totals.avg_margin)} · Food Cost: {formatPercent(100 - bestWorstCase.worst.totals.avg_margin)}
                </p>
              </div>
              <div className="metric-card">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Profit Range (Δ)</p>
                <p className="font-mono font-bold text-xl mt-1">฿{formatCurrency(bestWorstCase.diff)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ส่วนต่าง Profit ระหว่าง Best กับ Worst case
                </p>
              </div>
            </div>
          )}

          {/* Profit by Scenario Chart */}
          <div className="metric-card">
            <h3 className="section-header">Profit by Scenario</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={profitChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip
                  formatter={(value: number) => [`฿${formatCurrency(value)}`, 'Profit']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {profitChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Profit vs Food Cost Scatter (needs selected scenario) */}
          {selectedScenario && (
            <>
              <div className="metric-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="section-header mb-0">Profit vs Food Cost — {selectedScenario.name}</h3>
                  <Button size="sm" variant="outline" onClick={() => {
                    const headers = ['Item', 'Profit', 'Food Cost %', 'Margin %'];
                    const rows = profitVsFoodCost.map(d => [
                      `"${d.name}"`, d.profit.toFixed(2), d.foodCost.toFixed(2), d.margin.toFixed(2),
                    ]);
                    exportCSV(`profit_vs_foodcost_${selectedScenario.name.replace(/\s+/g, '_')}.csv`, headers, rows);
                  }}>
                    <FileDown size={14} /> CSV
                  </Button>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="foodCost"
                      name="Food Cost %"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Food Cost %', position: 'insideBottom', offset: -5, fontSize: 11 }}
                    />
                    <YAxis
                      dataKey="profit"
                      name="Profit"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`}
                      label={{ value: 'Profit (฿)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === 'Profit' ? `฿${formatCurrency(value)}` : `${value.toFixed(1)}%`,
                        name
                      ]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Scatter data={profitVsFoodCost} name="Products">
                      {profitVsFoodCost.map((entry, i) => (
                        <Cell key={i} fill={entry.margin >= 20 ? 'hsl(152, 69%, 41%)' : entry.margin >= 10 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)'} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 justify-center text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-success inline-block" /> Margin ≥ 20%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-warning inline-block" /> 10-20%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-destructive inline-block" /> &lt; 10%</span>
                </div>
              </div>

              {/* Per-product Profit Table */}
              <div className="metric-card overflow-x-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="section-header mb-0">Per-Product Profit — {selectedScenario.name}</h3>
                  <Button size="sm" variant="outline" onClick={() => exportScenarioDetail(selectedScenario.id)}>
                    <FileDown size={14} /> Export CSV
                  </Button>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th className="text-right">Selling Price</th>
                      <th className="text-right">Volume</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Profit</th>
                      <th className="text-right">Margin</th>
                      <th className="text-right">Food Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayProducts.map((a, i) => (
                      <tr key={a.item_id}>
                        <td className="text-muted-foreground text-xs">{i + 1}</td>
                        <td>
                          <div className="max-w-[200px] truncate text-sm">{a.item_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{a.item_id}</div>
                        </td>
                        <td className="text-right font-mono text-sm">฿{formatCurrency(a.selling_price)}</td>
                        <td className="text-right font-mono text-sm">{Math.round(a.forecast_volume).toLocaleString()}</td>
                        <td className="text-right font-mono text-sm">฿{formatCurrency(a.revenue)}</td>
                        <td className="text-right font-mono text-sm">฿{formatCurrency(a.total_cost)}</td>
                        <td className={`text-right font-mono text-sm font-semibold ${a.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                          ฿{formatCurrency(a.profit)}
                        </td>
                        <td className={`text-right font-mono text-sm ${a.margin >= 20 ? 'text-success' : a.margin >= 10 ? 'text-warning' : 'text-destructive'}`}>
                          {formatPercent(a.margin)}
                        </td>
                        <td className="text-right font-mono text-sm">{formatPercent(100 - a.margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedProducts.length > 10 && (
                  <div className="mt-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setShowAllProducts(!showAllProducts)}>
                      {showAllProducts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showAllProducts ? 'แสดงน้อยลง' : `ดูทั้งหมด (${sortedProducts.length} รายการ)`}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Saved Comparison Reports */}
      {comparisonReports.length > 0 && (
        <div className="metric-card">
          <h3 className="section-header">Saved Comparison Reports</h3>
          <div className="space-y-3">
            {comparisonReports.map(report => (
              <div key={report.id} className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{report.name}</p>
                    {report.description && <p className="text-xs text-muted-foreground">{report.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(report.created_at).toLocaleDateString()} · {report.snapshot.scenarios.length} scenarios
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      dispatch({ type: 'SET_SELECTED_SCENARIOS', payload: report.scenario_ids });
                      dispatch({ type: 'SET_VIEW', payload: 'scenario-comparison' });
                    }}>
                      <Eye size={14} /> ดู
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const headers = ['Metric', ...report.snapshot.scenarios.map(s => s.name)];
                      const rows = [
                        ['Revenue', ...report.snapshot.scenarios.map(s => s.totals.total_revenue.toFixed(2))],
                        ['Cost', ...report.snapshot.scenarios.map(s => s.totals.total_cost.toFixed(2))],
                        ['Profit', ...report.snapshot.scenarios.map(s => s.totals.total_profit.toFixed(2))],
                        ['Margin %', ...report.snapshot.scenarios.map(s => s.totals.avg_margin.toFixed(2))],
                        ['Food Cost %', ...report.snapshot.scenarios.map(s => (100 - s.totals.avg_margin).toFixed(2))],
                        ['Products', ...report.snapshot.scenarios.map(s => String(s.totals.product_count))],
                      ];
                      exportCSV(`report_${report.name.replace(/\s+/g, '_')}.csv`, headers, rows);
                    }}>
                      <FileDown size={14} /> CSV
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                      dispatch({ type: 'DELETE_COMPARISON_REPORT', payload: report.id });
                      toast.info(`ลบ Report "${report.name}" แล้ว`);
                    }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Profit</th>
                      <th className="text-right">Margin</th>
                      <th className="text-right">Food Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.snapshot.scenarios.map(s => (
                      <tr key={s.id}>
                        <td className="font-medium text-sm">{s.name}</td>
                        <td className="text-right font-mono text-sm">฿{formatCurrency(s.totals.total_revenue)}</td>
                        <td className="text-right font-mono text-sm">฿{formatCurrency(s.totals.total_cost)}</td>
                        <td className={`text-right font-mono text-sm font-semibold ${s.totals.total_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                          ฿{formatCurrency(s.totals.total_profit)}
                        </td>
                        <td className={`text-right font-mono text-sm font-semibold ${s.totals.avg_margin >= 20 ? 'text-success' : 'text-warning'}`}>
                          {formatPercent(s.totals.avg_margin)}
                        </td>
                        <td className="text-right font-mono text-sm">
                          {formatPercent(100 - s.totals.avg_margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenario Detail Reports */}
      {scenarios.length > 0 && (
        <div className="metric-card">
          <h3 className="section-header">Scenario Detail Reports</h3>
          <div className="space-y-3">
            {scenarios.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()} ·
                    Revenue: ฿{formatCurrency(s.totals.total_revenue)} ·
                    Profit: ฿{formatCurrency(s.totals.total_profit)} ·
                    Margin: {formatPercent(s.totals.avg_margin)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => exportScenarioDetail(s.id)}>
                  <FileDown size={14} /> CSV
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Table */}
      {scenarios.length > 0 && (
        <div className="metric-card overflow-x-auto">
          <h3 className="section-header">Quick Summary: All Scenarios</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Date</th>
                <th className="text-right">Products</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Cost</th>
                <th className="text-right">Profit</th>
                <th className="text-right">Margin</th>
                <th className="text-right">Food Cost</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(s => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="text-right font-mono text-sm">{s.totals.product_count}</td>
                  <td className="text-right font-mono text-sm">฿{formatCurrency(s.totals.total_revenue)}</td>
                  <td className="text-right font-mono text-sm">฿{formatCurrency(s.totals.total_cost)}</td>
                  <td className={`text-right font-mono text-sm font-semibold ${s.totals.total_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    ฿{formatCurrency(s.totals.total_profit)}
                  </td>
                  <td className={`text-right font-mono text-sm font-semibold ${s.totals.avg_margin >= 20 ? 'text-success' : 'text-warning'}`}>
                    {formatPercent(s.totals.avg_margin)}
                  </td>
                  <td className="text-right font-mono text-sm">{formatPercent(100 - s.totals.avg_margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scenarios.length === 0 && products.length === 0 && (
        <div className="metric-card text-center py-16">
          <FileText className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-muted-foreground text-sm">
            Import products and create scenarios to generate reports.
          </p>
        </div>
      )}
    </div>
  );
}
