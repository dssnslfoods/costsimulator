import { useState, useMemo } from 'react';
import { useAppState } from '@/store/AppContext';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Trash2, Copy, Pencil, BookmarkPlus } from 'lucide-react';
import TvModeToggle from '@/components/TvModeToggle';
import { toast } from 'sonner';
import { ComparisonReport } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(168, 72%, 40%)',
  'hsl(262, 83%, 58%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
];

export default function ScenarioComparison() {
  const { state, dispatch } = useAppState();
  const { scenarios, selectedScenarioIds, products } = state;
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [showBaseline, setShowBaseline] = useState(true);

  const selected = scenarios.filter(s => selectedScenarioIds.includes(s.id));

  // Baseline totals from all products (original data)
  const baselineTotals = useMemo(() => {
    if (products.length === 0) return null;
    const totalRevenue = products.reduce((s, p) => s + p.offer_price * p.sale_volume, 0);
    const totalCost = products.reduce((s, p) => s + p.approved_cost * p.sale_volume, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    return {
      total_revenue: totalRevenue,
      total_cost: totalCost,
      total_profit: totalProfit,
      avg_margin: avgMargin,
      product_count: products.length,
    };
  }, [products]);

  // Build a product lookup for original revenue/cost per item
  const productMap = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number }>();
    products.forEach(p => {
      map.set(p.item_id, {
        revenue: p.offer_price * p.sale_volume,
        cost: p.approved_cost * p.sale_volume,
      });
    });
    return map;
  }, [products]);

  // "Before vs After" data: total business impact per scenario
  const beforeAfterData = useMemo(() => {
    if (!baselineTotals) return [];
    return selected.map(s => {
      // Original revenue/cost of items IN this scenario
      const originalRevOfAffected = s.assumptions.reduce((sum, a) => {
        const orig = productMap.get(a.item_id);
        return sum + (orig ? orig.revenue : 0);
      }, 0);
      const originalCostOfAffected = s.assumptions.reduce((sum, a) => {
        const orig = productMap.get(a.item_id);
        return sum + (orig ? orig.cost : 0);
      }, 0);
      // After = baseline - original affected + scenario affected
      const afterRevenue = baselineTotals.total_revenue - originalRevOfAffected + s.totals.total_revenue;
      const afterCost = baselineTotals.total_cost - originalCostOfAffected + s.totals.total_cost;
      const afterProfit = afterRevenue - afterCost;
      return {
        name: s.name.length > 18 ? s.name.substring(0, 18) + '…' : s.name,
        fullName: s.name,
        beforeRevenue: baselineTotals.total_revenue,
        afterRevenue,
        revenueDelta: afterRevenue - baselineTotals.total_revenue,
        beforeCost: baselineTotals.total_cost,
        afterCost,
        costDelta: afterCost - baselineTotals.total_cost,
        beforeProfit: baselineTotals.total_profit,
        afterProfit,
        profitDelta: afterProfit - baselineTotals.total_profit,
      };
    });
  }, [selected, baselineTotals, productMap]);

  const comparisonData = [
    ...(showBaseline && baselineTotals ? [{
      name: '📊 Baseline (ทั้งหมด)',
      revenue: baselineTotals.total_revenue,
      cost: baselineTotals.total_cost,
      profit: baselineTotals.total_profit,
      margin: baselineTotals.avg_margin,
      foodCost: 100 - baselineTotals.avg_margin,
      isBaseline: true,
    }] : []),
    ...selected.map(s => ({
      name: s.name.length > 18 ? s.name.substring(0, 18) + '…' : s.name,
      revenue: s.totals.total_revenue,
      cost: s.totals.total_cost,
      profit: s.totals.total_profit,
      margin: s.totals.avg_margin,
      foodCost: 100 - s.totals.avg_margin,
      isBaseline: false,
    })),
  ];

  const bestProfit = selected.length > 0
    ? selected.reduce((b, s) => s.totals.total_profit > b.totals.total_profit ? s : b)
    : null;
  const bestMargin = selected.length > 0
    ? selected.reduce((b, s) => s.totals.avg_margin > b.totals.avg_margin ? s : b)
    : null;
  const bestRevenue = selected.length > 0
    ? selected.reduce((b, s) => s.totals.total_revenue > b.totals.total_revenue ? s : b)
    : null;

  const handleSaveReport = () => {
    if (!reportName.trim()) { toast.error('กรุณาใส่ชื่อ Report'); return; }
    const report: ComparisonReport = {
      id: crypto.randomUUID(),
      name: reportName.trim(),
      description: reportDesc.trim(),
      scenario_ids: selectedScenarioIds,
      snapshot: {
        scenarios: selected.map(s => ({
          id: s.id,
          name: s.name,
          totals: { ...s.totals },
        })),
      },
      created_at: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_COMPARISON_REPORT', payload: report });
    toast.success(`บันทึก Report "${report.name}" แล้ว`);
    setShowSaveDialog(false);
    setReportName('');
    setReportDesc('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Scenario Comparison</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Select scenarios to compare side by side
          </p>
        </div>
        <div className="flex items-center gap-4">
          <TvModeToggle />
          <div className="flex items-center gap-2">
            <Switch checked={showBaseline} onCheckedChange={setShowBaseline} />
            <span className="text-sm text-muted-foreground">เทียบกับ Baseline</span>
          </div>
          {selected.length >= 2 && (
            <Button size="sm" onClick={() => setShowSaveDialog(true)}>
              <BookmarkPlus size={14} />
              Save as Report
            </Button>
          )}
        </div>
      </div>

      {/* Save Report Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>บันทึกเป็น Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">ชื่อ Report *</label>
              <Input value={reportName} onChange={e => setReportName(e.target.value)} placeholder="เช่น Q2 Comparison Report" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">คำอธิบาย</label>
              <Input value={reportDesc} onChange={e => setReportDesc(e.target.value)} placeholder="รายละเอียดเพิ่มเติม" className="mt-1" />
            </div>
            <div className="text-sm text-muted-foreground">
              จะบันทึก {selected.length} scenarios: {selected.map(s => s.name).join(', ')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleSaveReport}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scenario List */}
      <div className="metric-card">
        <h3 className="section-header">Available Scenarios ({scenarios.length})</h3>
        {scenarios.length === 0 ? (
          <p className="text-muted-foreground text-sm">No scenarios created yet.</p>
        ) : (
          <div className="space-y-2">
            {scenarios.map(s => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selectedScenarioIds.includes(s.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={selectedScenarioIds.includes(s.id)}
                  onCheckedChange={() => dispatch({ type: 'TOGGLE_SCENARIO_SELECTION', payload: s.id })}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()} · {s.totals.product_count} products
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">฿{formatCurrency(s.totals.total_profit)}</p>
                  <p className="text-xs text-muted-foreground">{formatPercent(s.totals.avg_margin)} margin</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Edit"
                    onClick={() => {
                      dispatch({ type: 'EDIT_SCENARIO', payload: s.id });
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Duplicate"
                    onClick={() => {
                      dispatch({
                        type: 'DUPLICATE_SCENARIO',
                        payload: { id: s.id, newId: crypto.randomUUID(), newName: `${s.name} (Copy)` },
                      });
                      toast.success('Scenario duplicated');
                    }}
                  >
                    <Copy size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete"
                    onClick={() => {
                      dispatch({ type: 'DELETE_SCENARIO', payload: s.id });
                      toast.info('Scenario deleted');
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparison Charts */}
      {comparisonData.length >= 2 && (
        <>
          {/* Impact vs Baseline - Visual Cards */}
          {showBaseline && baselineTotals && selected.length >= 1 && selected.map(s => {
            const metrics = [
              { label: 'Revenue (รายได้)', before: baselineTotals.total_revenue, after: s.totals.total_revenue, isCurrency: true, positiveIsGood: true },
              { label: 'Total Cost (ต้นทุน)', before: baselineTotals.total_cost, after: s.totals.total_cost, isCurrency: true, positiveIsGood: false },
              { label: 'Profit (กำไร)', before: baselineTotals.total_profit, after: s.totals.total_profit, isCurrency: true, positiveIsGood: true },
              { label: 'Food Margin %', before: baselineTotals.avg_margin, after: s.totals.avg_margin, isCurrency: false, positiveIsGood: true },
              { label: 'Food Cost %', before: 100 - baselineTotals.avg_margin, after: 100 - s.totals.avg_margin, isCurrency: false, positiveIsGood: false },
            ];
            return (
              <div key={s.id} className="metric-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="section-header mb-0">📊 ผลกระทบของ "{s.name}" ต่อภาพรวม</h3>
                  <span className="text-xs text-muted-foreground">เทียบกับสินค้าทั้งหมด ({baselineTotals.product_count} รายการ)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {metrics.map(m => {
                    const delta = m.after - m.before;
                    const deltaPct = m.isCurrency && m.before !== 0 ? (delta / Math.abs(m.before)) * 100 : delta;
                    const isGood = m.positiveIsGood ? delta >= 0 : delta <= 0;
                    const isNeutral = Math.abs(delta) < 0.01;
                    return (
                      <div key={m.label} className={`rounded-xl border p-4 space-y-2 ${isNeutral ? 'border-border bg-muted/30' : isGood ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                        <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">ก่อน</span>
                          <span className="font-mono font-semibold text-foreground">
                            {m.isCurrency ? `฿${formatCurrency(m.before)}` : `${m.before.toFixed(2)}%`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">หลัง</span>
                          <span className="font-mono font-semibold text-foreground">
                            {m.isCurrency ? `฿${formatCurrency(m.after)}` : `${m.after.toFixed(2)}%`}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 pt-1 border-t ${isNeutral ? 'border-border' : isGood ? 'border-success/20' : 'border-destructive/20'}`}>
                          {!isNeutral && (
                            <span className={`text-lg ${isGood ? 'text-success' : 'text-destructive'}`}>
                              {isGood ? '▲' : '▼'}
                            </span>
                          )}
                          <div>
                            <p className={`font-mono text-sm font-bold ${isNeutral ? 'text-muted-foreground' : isGood ? 'text-success' : 'text-destructive'}`}>
                              {delta > 0 ? '+' : ''}{m.isCurrency ? `฿${formatCurrency(delta)}` : `${delta.toFixed(2)}%`}
                            </p>
                            {m.isCurrency && (
                              <p className={`font-mono text-xs ${isNeutral ? 'text-muted-foreground' : isGood ? 'text-success' : 'text-destructive'}`}>
                                ({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(2)}%)
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Before vs After - Overall Revenue/Cost/Profit Impact */}
          {showBaseline && beforeAfterData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue Before vs After */}
              <div className="metric-card">
                <h3 className="section-header">Revenue รวม (ก่อน vs หลัง)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={beforeAfterData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`฿${formatCurrency(value)}`, name]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="beforeRevenue" fill="hsl(var(--muted-foreground))" name="ก่อน" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="afterRevenue" fill={COLORS[0]} name="หลัง" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cost Before vs After */}
              <div className="metric-card">
                <h3 className="section-header">Cost รวม (ก่อน vs หลัง)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={beforeAfterData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`฿${formatCurrency(value)}`, name]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="beforeCost" fill="hsl(var(--muted-foreground))" name="ก่อน" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="afterCost" fill={COLORS[3]} name="หลัง" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Profit Before vs After */}
              <div className="metric-card">
                <h3 className="section-header">Profit รวม (ก่อน vs หลัง)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={beforeAfterData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`฿${formatCurrency(value)}`, name]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="beforeProfit" fill="hsl(var(--muted-foreground))" name="ก่อน" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="afterProfit" fill={COLORS[1]} name="หลัง" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {bestRevenue && (
              <div className="metric-card bg-primary/5 border-primary/20">
                <p className="text-xs font-medium text-primary uppercase tracking-wider">Highest Revenue</p>
                <p className="font-semibold mt-1">{bestRevenue.name}</p>
                <p className="font-mono font-bold text-lg mt-1">฿{formatCurrency(bestRevenue.totals.total_revenue)}</p>
              </div>
            )}
            {bestProfit && (
              <div className="metric-card bg-success/5 border-success/20">
                <p className="text-xs font-medium text-success uppercase tracking-wider">Best Profit</p>
                <p className="font-semibold mt-1">{bestProfit.name}</p>
                <p className="font-mono font-bold text-lg mt-1">฿{formatCurrency(bestProfit.totals.total_profit)}</p>
              </div>
            )}
            {bestMargin && (
              <div className="metric-card bg-accent/5 border-accent/20">
                <p className="text-xs font-medium text-accent uppercase tracking-wider">Best Food Margin</p>
                <p className="font-semibold mt-1">{bestMargin.name}</p>
                <p className="font-mono font-bold text-lg mt-1">{formatPercent(bestMargin.totals.avg_margin)}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Comparison */}
            <div className="metric-card">
              <h3 className="section-header">Revenue Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(value: number) => `฿${formatCurrency(value)}`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="revenue" fill={COLORS[0]} name="Revenue" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cost Comparison */}
            <div className="metric-card">
              <h3 className="section-header">Cost Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(value: number) => `฿${formatCurrency(value)}`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="cost" fill={COLORS[3]} name="Cost" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Profit Comparison */}
            <div className="metric-card">
              <h3 className="section-header">Profit Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(value: number) => `฿${formatCurrency(value)}`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="profit" fill={COLORS[1]} name="Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Margin Comparison */}
            <div className="metric-card">
              <h3 className="section-header">Food Margin Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="margin" fill={COLORS[2]} name="Food Margin %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Food Cost Comparison */}
            <div className="metric-card">
              <h3 className="section-header">Food Cost Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="foodCost" fill={COLORS[4]} name="Food Cost %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="metric-card overflow-x-auto">
            <h3 className="section-header">Detailed Comparison</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {showBaseline && baselineTotals && (
                    <th className="text-right bg-muted/50">📊 Baseline</th>
                  )}
                  {selected.map(s => (
                    <th key={s.id} className="text-right">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Revenue</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">฿{formatCurrency(baselineTotals.total_revenue)}</td>
                  )}
                  {selected.map(s => (
                    <td key={s.id} className={`text-right font-mono text-sm ${s.id === bestRevenue?.id ? 'highlight-best' : ''}`}>
                      ฿{formatCurrency(s.totals.total_revenue)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Total Cost</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">฿{formatCurrency(baselineTotals.total_cost)}</td>
                  )}
                  {selected.map(s => (
                    <td key={s.id} className="text-right font-mono text-sm">
                      ฿{formatCurrency(s.totals.total_cost)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Profit</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">฿{formatCurrency(baselineTotals.total_profit)}</td>
                  )}
                  {selected.map(s => (
                    <td key={s.id} className={`text-right font-mono text-sm ${s.id === bestProfit?.id ? 'highlight-best' : ''}`}>
                      ฿{formatCurrency(s.totals.total_profit)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Food Margin %</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">{formatPercent(baselineTotals.avg_margin)}</td>
                  )}
                  {selected.map(s => (
                    <td key={s.id} className={`text-right font-mono text-sm ${s.id === bestMargin?.id ? 'highlight-best' : ''}`}>
                      {formatPercent(s.totals.avg_margin)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Products</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">{baselineTotals.product_count}</td>
                  )}
                  {selected.map(s => (
                    <td key={s.id} className="text-right font-mono text-sm">
                      {s.totals.product_count}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {comparisonData.length < 2 && selected.length > 0 && (
        <div className="metric-card text-center py-8">
          <p className="text-muted-foreground">เปิด "เทียบกับ Baseline" หรือเลือกอย่างน้อย 2 scenarios เพื่อเปรียบเทียบ</p>
        </div>
      )}
    </div>
  );
}
