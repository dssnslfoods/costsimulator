import { useAppState } from '@/store/AppContext';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Copy, Pencil } from 'lucide-react';
import { toast } from 'sonner';
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
  const { scenarios, selectedScenarioIds } = state;

  const selected = scenarios.filter(s => selectedScenarioIds.includes(s.id));

  const comparisonData = selected.map(s => ({
    name: s.name.length > 18 ? s.name.substring(0, 18) + '…' : s.name,
    revenue: s.totals.total_revenue,
    cost: s.totals.total_cost,
    profit: s.totals.total_profit,
    margin: s.totals.avg_margin,
  }));

  const bestProfit = selected.length > 0
    ? selected.reduce((b, s) => s.totals.total_profit > b.totals.total_profit ? s : b)
    : null;
  const bestMargin = selected.length > 0
    ? selected.reduce((b, s) => s.totals.avg_margin > b.totals.avg_margin ? s : b)
    : null;
  const bestRevenue = selected.length > 0
    ? selected.reduce((b, s) => s.totals.total_revenue > b.totals.total_revenue ? s : b)
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Scenario Comparison</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Select scenarios to compare side by side
        </p>
      </div>

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
      {selected.length >= 2 && (
        <>
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
                <p className="text-xs font-medium text-accent uppercase tracking-wider">Best Margin</p>
                <p className="font-semibold mt-1">{bestMargin.name}</p>
                <p className="font-mono font-bold text-lg mt-1">{formatPercent(bestMargin.totals.avg_margin)}</p>
              </div>
            )}
          </div>

          <div className="metric-card">
            <h3 className="section-header">Revenue, Cost & Profit Comparison</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip
                  formatter={(value: number) => `฿${formatCurrency(value)}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" fill={COLORS[0]} name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" fill={COLORS[3]} name="Cost" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill={COLORS[1]} name="Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison Table */}
          <div className="metric-card overflow-x-auto">
            <h3 className="section-header">Detailed Comparison</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {selected.map(s => (
                    <th key={s.id} className="text-right">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Revenue</td>
                  {selected.map(s => (
                    <td key={s.id} className={`text-right font-mono text-sm ${s.id === bestRevenue?.id ? 'highlight-best' : ''}`}>
                      ฿{formatCurrency(s.totals.total_revenue)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Total Cost</td>
                  {selected.map(s => (
                    <td key={s.id} className="text-right font-mono text-sm">
                      ฿{formatCurrency(s.totals.total_cost)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Profit</td>
                  {selected.map(s => (
                    <td key={s.id} className={`text-right font-mono text-sm ${s.id === bestProfit?.id ? 'highlight-best' : ''}`}>
                      ฿{formatCurrency(s.totals.total_profit)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Margin %</td>
                  {selected.map(s => (
                    <td key={s.id} className={`text-right font-mono text-sm ${s.id === bestMargin?.id ? 'highlight-best' : ''}`}>
                      {formatPercent(s.totals.avg_margin)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Products</td>
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

      {selected.length === 1 && (
        <div className="metric-card text-center py-8">
          <p className="text-muted-foreground">Select at least 2 scenarios to compare.</p>
        </div>
      )}
    </div>
  );
}
