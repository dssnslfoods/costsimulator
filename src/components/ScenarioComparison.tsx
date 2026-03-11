import { useState, useMemo } from 'react';
import { useAppState } from '@/store/AppContext';
import { formatCurrency, formatPercent, getCostByModel } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Trash2, Copy, Pencil, BookmarkPlus, Download } from 'lucide-react';
import TvModeToggle from '@/components/TvModeToggle';
import { toast } from 'sonner';
import { ComparisonReport, ScenarioAssumption } from '@/types';
import * as XLSX from 'xlsx';
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
    if (products.length === 0) return [];

    return selected.map(s => {
      let bRevenue = 0; let bCost = 0;
      let aRevenue = 0; let aCost = 0;

      const assumptionMap = new Map<string, ScenarioAssumption>();
      s.assumptions.forEach(a => assumptionMap.set(a.item_id, a));

      products.forEach(p => {
        const a = assumptionMap.get(p.item_id);
        const costModel = a ? a.cost_model : 'approved'; // Use same cost model as assumption for better baseline comparison

        const origRev = p.offer_price * p.sale_volume;
        const origCost = getCostByModel(p, costModel) * p.sale_volume;

        bRevenue += origRev;
        bCost += origCost;

        if (a) {
          aRevenue += a.revenue;
          aCost += a.total_cost;
        } else {
          aRevenue += origRev;
          aCost += origCost;
        }
      });

      const bProfit = bRevenue - bCost;
      const aProfit = aRevenue - aCost;
      const bMargin = bRevenue > 0 ? (bProfit / bRevenue) * 100 : 0;
      const aMargin = aRevenue > 0 ? (aProfit / aRevenue) * 100 : 0;

      return {
        name: s.name.length > 18 ? s.name.substring(0, 18) + '…' : s.name,
        fullName: s.name,
        beforeRevenue: bRevenue,
        afterRevenue: aRevenue,
        revenueDelta: aRevenue - bRevenue,
        beforeCost: bCost,
        afterCost: aCost,
        costDelta: aCost - bCost,
        beforeProfit: bProfit,
        afterProfit: aProfit,
        profitDelta: aProfit - bProfit,
        beforeMargin: bMargin,
        afterMargin: aMargin,
      };
    });
  }, [selected, products]);

  // Combined impact of ALL selected scenarios
  const combinedImpact = useMemo(() => {
    if (products.length === 0 || selected.length === 0) return null;

    const mergedAssumptions = new Map<string, ScenarioAssumption>();
    selected.forEach(s => {
      s.assumptions.forEach(a => mergedAssumptions.set(a.item_id, a));
    });

    let bRevenue = 0; let bCost = 0;
    let aRevenue = 0; let aCost = 0;

    products.forEach(p => {
      const a = mergedAssumptions.get(p.item_id);
      const costModel = a ? a.cost_model : 'approved';

      const origRev = p.offer_price * p.sale_volume;
      const origCost = getCostByModel(p, costModel) * p.sale_volume;

      bRevenue += origRev;
      bCost += origCost;

      if (a) {
        aRevenue += a.revenue;
        aCost += a.total_cost;
      } else {
        aRevenue += origRev;
        aCost += origCost;
      }
    });

    const bProfit = bRevenue - bCost;
    const aProfit = aRevenue - aCost;
    const bMargin = bRevenue > 0 ? (bProfit / bRevenue) * 100 : 0;
    const aMargin = aRevenue > 0 ? (aProfit / aRevenue) * 100 : 0;

    return {
      beforeRevenue: bRevenue,
      afterRevenue: aRevenue,
      beforeCost: bCost,
      afterCost: aCost,
      beforeProfit: bProfit,
      afterProfit: aProfit,
      beforeMargin: bMargin,
      afterMargin: aMargin,
      productCount: products.length,
      affectedCount: mergedAssumptions.size
    };
  }, [selected, products]);

  const comparisonData = useMemo(() => {
    const data = [
      ...(showBaseline && baselineTotals ? [{
        name: '📊 Baseline',
        revenue: baselineTotals.total_revenue,
        cost: baselineTotals.total_cost,
        profit: baselineTotals.total_profit,
        margin: baselineTotals.avg_margin,
        foodCost: 100 - baselineTotals.avg_margin,
        isBaseline: true,
      }] : []),
      ...beforeAfterData.map(s => ({
        name: s.name,
        revenue: s.afterRevenue,
        cost: s.afterCost,
        profit: s.afterProfit,
        margin: s.afterMargin,
        foodCost: 100 - s.afterMargin,
        isBaseline: false,
      })),
    ];

    if (selected.length > 1 && combinedImpact) {
      data.push({
        name: '✨ Combined',
        revenue: combinedImpact.afterRevenue,
        cost: combinedImpact.afterCost,
        profit: combinedImpact.afterProfit,
        margin: combinedImpact.afterMargin,
        foodCost: 100 - combinedImpact.afterMargin,
        isBaseline: false,
      });
    }
    return data;
  }, [showBaseline, baselineTotals, beforeAfterData, combinedImpact, selected.length]);

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

  const handleExportExcel = () => {
    if (comparisonData.length === 0) return;
    
    // Prepare the table data for Excel
    const metrics = [
      { label: 'Revenue', key: 'revenue' },
      { label: 'Total Cost', key: 'cost' },
      { label: 'Profit', key: 'profit' },
      { label: 'Food Margin %', key: 'margin' },
      { label: 'Food Cost %', key: 'foodCost' }
    ];

    const data = metrics.map(m => {
      const row: any = { 'Metric': m.label };
      comparisonData.forEach(scenario => {
        let val = scenario[m.key as keyof typeof scenario];
        if (typeof val === 'number') {
           row[scenario.name] = m.label.includes('%') ? `${val.toFixed(2)}%` : val;
        } else {
           row[scenario.name] = val;
        }
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
    XLSX.writeFile(wb, 'scenario_comparison.xlsx');
    toast.success('ส่งออกข้อมูลเปรียบเทียบสำเร็จ');
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleExportExcel}>
                <Download size={14} />
                Export Excel
              </Button>
              <Button size="sm" onClick={() => setShowSaveDialog(true)}>
                <BookmarkPlus size={14} />
                Save as Report
              </Button>
            </div>
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
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${selectedScenarioIds.includes(s.id)
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
          {showBaseline && combinedImpact && (
            <div className="metric-card space-y-4 border-2 border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="section-header mb-0">📊 ผลกระทบรวมของ Scenario ที่เลือก ต่อภาพรวม</h3>
                  <p className="text-sm text-muted-foreground">
                    ค่าจำลองจากการรัน {selected.length} scenario รวมกัน (มีผลต่อ {combinedImpact.affectedCount} ผลิตภัณฑ์)
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">เทียบกับสินค้าทั้งหมด ({combinedImpact.productCount} รายการ)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {[
                  { label: 'Revenue (รายได้)', before: combinedImpact.beforeRevenue, after: combinedImpact.afterRevenue, isCurrency: true, positiveIsGood: true },
                  { label: 'Total Cost (ต้นทุน)', before: combinedImpact.beforeCost, after: combinedImpact.afterCost, isCurrency: true, positiveIsGood: false },
                  { label: 'Profit (กำไร)', before: combinedImpact.beforeProfit, after: combinedImpact.afterProfit, isCurrency: true, positiveIsGood: true },
                  { label: 'Food Margin %', before: combinedImpact.beforeMargin, after: combinedImpact.afterMargin, isCurrency: false, positiveIsGood: true },
                  { label: 'Food Cost %', before: 100 - combinedImpact.beforeMargin, after: 100 - combinedImpact.afterMargin, isCurrency: false, positiveIsGood: false },
                ].map(m => {
                  const delta = m.after - m.before;
                  const deltaPct = m.isCurrency && m.before !== 0 ? (delta / Math.abs(m.before)) * 100 : delta;
                  const isGood = m.positiveIsGood ? delta >= 0 : delta <= 0;
                  const isNeutral = Math.abs(delta) < 0.01;
                  return (
                    <div key={m.label} className={`rounded-xl border p-4 space-y-2 bg-card ${isNeutral ? 'border-border' : isGood ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
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
          )}

          {/* Individual Scenario Impacts */}
          {showBaseline && selected.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {beforeAfterData.map(s => {
                const metrics = [
                  { label: 'Revenue', before: s.beforeRevenue, after: s.afterRevenue, isCurrency: true, positiveIsGood: true },
                  { label: 'Profit', before: s.beforeProfit, after: s.afterProfit, isCurrency: true, positiveIsGood: true },
                  { label: 'Margin %', before: s.beforeMargin, after: s.afterMargin, isCurrency: false, positiveIsGood: true },
                ];
                return (
                  <div key={s.fullName} className="metric-card border border-border/50">
                    <h4 className="font-semibold text-sm mb-3">ผลกระทบของ "{s.fullName}" ต่อภาพรวม</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {metrics.map(m => {
                        const delta = m.after - m.before;
                        const isGood = m.positiveIsGood ? delta >= 0 : delta <= 0;
                        return (
                          <div key={m.label} className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase">{m.label}</p>
                            <p className="font-mono text-xs font-semibold">
                              {m.isCurrency ? `฿${formatCurrency(m.after)}` : `${m.after.toFixed(1)}%`}
                            </p>
                            <p className={`font-mono text-[10px] ${isGood ? 'text-success' : 'text-destructive'}`}>
                              {delta >= 0 ? '+' : ''}{m.isCurrency ? formatCurrency(delta) : delta.toFixed(1)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
            <h3 className="section-header">Detailed Comparison (ภาพรวมทั้งหมด)</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {showBaseline && baselineTotals && (
                    <th className="text-right bg-muted/50">📊 Baseline</th>
                  )}
                  {beforeAfterData.map(s => (
                    <th key={s.name} className="text-right">{s.name}</th>
                  ))}
                  {selected.length > 1 && combinedImpact && (
                    <th className="text-right bg-primary/10">✨ Combined</th>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Revenue</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">฿{formatCurrency(baselineTotals.total_revenue)}</td>
                  )}
                  {beforeAfterData.map(s => (
                    <td key={s.name} className="text-right font-mono text-sm">
                      ฿{formatCurrency(s.afterRevenue)}
                    </td>
                  ))}
                  {selected.length > 1 && combinedImpact && (
                    <td className="text-right font-mono text-sm bg-primary/5 font-bold">
                      ฿{formatCurrency(combinedImpact.afterRevenue)}
                    </td>
                  )}
                </tr>
                <tr>
                  <td className="font-medium">Total Cost</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">฿{formatCurrency(baselineTotals.total_cost)}</td>
                  )}
                  {beforeAfterData.map(s => (
                    <td key={s.name} className="text-right font-mono text-sm">
                      ฿{formatCurrency(s.afterCost)}
                    </td>
                  ))}
                  {selected.length > 1 && combinedImpact && (
                    <td className="text-right font-mono text-sm bg-primary/5 font-bold">
                      ฿{formatCurrency(combinedImpact.afterCost)}
                    </td>
                  )}
                </tr>
                <tr>
                  <td className="font-medium">Profit</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">฿{formatCurrency(baselineTotals.total_profit)}</td>
                  )}
                  {beforeAfterData.map(s => (
                    <td key={s.name} className="text-right font-mono text-sm">
                      ฿{formatCurrency(s.afterProfit)}
                    </td>
                  ))}
                  {selected.length > 1 && combinedImpact && (
                    <td className="text-right font-mono text-sm bg-primary/5 font-bold">
                      ฿{formatCurrency(combinedImpact.afterProfit)}
                    </td>
                  )}
                </tr>
                <tr>
                  <td className="font-medium">Food Margin %</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">{formatPercent(baselineTotals.avg_margin)}</td>
                  )}
                  {beforeAfterData.map(s => (
                    <td key={s.name} className="text-right font-mono text-sm">
                      {formatPercent(s.afterMargin)}
                    </td>
                  ))}
                  {selected.length > 1 && combinedImpact && (
                    <td className="text-right font-mono text-sm bg-primary/5 font-bold">
                      {formatPercent(combinedImpact.afterMargin)}
                    </td>
                  )}
                </tr>
                <tr>
                  <td className="font-medium">Affected Items</td>
                  {showBaseline && baselineTotals && (
                    <td className="text-right font-mono text-sm bg-muted/50">-</td>
                  )}
                  {selected.map(s => (
                    <td key={s.id} className="text-right font-mono text-sm">
                      {s.totals.product_count}
                    </td>
                  ))}
                  {selected.length > 1 && combinedImpact && (
                    <td className="text-right font-mono text-sm bg-primary/5 font-bold">
                      {combinedImpact.affectedCount}
                    </td>
                  )}
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
