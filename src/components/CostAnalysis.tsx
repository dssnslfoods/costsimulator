import { useMemo } from 'react';
import { useAppState } from '@/store/AppContext';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/calculations';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, ZAxis
} from 'recharts';

export default function CostAnalysis() {
  const { state } = useAppState();
  const { products } = state;

  const analysisData = useMemo(() => {
    return products
      .filter(p => p.approved_cost > 0 || p.standard_cost > 0 || p.actual_cost > 0)
      .map(p => {
        const approvedVsActual = p.approved_cost > 0
          ? ((p.actual_cost - p.approved_cost) / p.approved_cost * 100)
          : 0;
        const standardVsActual = p.standard_cost > 0
          ? ((p.actual_cost - p.standard_cost) / p.standard_cost * 100)
          : 0;

        return {
          ...p,
          approved_vs_actual: approvedVsActual,
          standard_vs_actual: standardVsActual,
          is_over_cost: p.actual_cost > p.approved_cost,
          cost_gap: p.actual_cost - p.approved_cost,
        };
      });
  }, [products]);

  const overCostProducts = analysisData.filter(p => p.is_over_cost);
  const underCostProducts = analysisData.filter(p => !p.is_over_cost && p.approved_cost > 0);

  const topOverCost = [...analysisData]
    .sort((a, b) => b.approved_vs_actual - a.approved_vs_actual)
    .slice(0, 15);

  const chartData = topOverCost.map(p => ({
    name: p.item_name.length > 25 ? p.item_name.substring(0, 25) + '…' : p.item_name,
    approved: p.approved_cost,
    standard: p.standard_cost,
    actual: p.actual_cost,
    variance: p.approved_vs_actual,
  }));

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
        <h2 className="text-2xl font-bold">Cost Gap Analysis</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Compare Approved, Standard, and Actual costs
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <p className="stat-label">Total Products</p>
          <p className="text-xl font-bold font-mono mt-1">{analysisData.length}</p>
        </div>
        <div className="metric-card">
          <p className="stat-label text-destructive">Over-Cost Products</p>
          <p className="text-xl font-bold font-mono mt-1 text-destructive">{overCostProducts.length}</p>
        </div>
        <div className="metric-card">
          <p className="stat-label text-success">Under-Cost Products</p>
          <p className="text-xl font-bold font-mono mt-1 text-success">{underCostProducts.length}</p>
        </div>
        <div className="metric-card">
          <p className="stat-label">Avg. Cost Variance</p>
          <p className="text-xl font-bold font-mono mt-1">
            {analysisData.length > 0
              ? formatPercent(analysisData.reduce((s, p) => s + p.approved_vs_actual, 0) / analysisData.length)
              : '0%'}
          </p>
        </div>
      </div>

      {/* Cost Comparison Chart */}
      <div className="metric-card">
        <h3 className="section-header">Cost Comparison (Top 15 by Variance)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 150 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} />
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
            <Bar dataKey="approved" fill="hsl(217, 91%, 60%)" name="Approved" />
            <Bar dataKey="standard" fill="hsl(168, 72%, 40%)" name="Standard" />
            <Bar dataKey="actual" fill="hsl(38, 92%, 50%)" name="Actual" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Over-cost table */}
      <div className="metric-card overflow-x-auto">
        <h3 className="section-header text-destructive">Over-Cost Products (Actual &gt; Approved)</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item ID</th>
              <th>Product Name</th>
              <th className="text-right">Approved</th>
              <th className="text-right">Standard</th>
              <th className="text-right">Actual</th>
              <th className="text-right">Variance vs Approved</th>
              <th className="text-right">Gap (฿)</th>
            </tr>
          </thead>
          <tbody>
            {overCostProducts
              .sort((a, b) => b.approved_vs_actual - a.approved_vs_actual)
              .slice(0, 30)
              .map(p => (
                <tr key={p.item_id}>
                  <td className="font-mono text-xs">{p.item_id}</td>
                  <td className="max-w-[250px] truncate">{p.item_name}</td>
                  <td className="text-right font-mono text-sm">{formatCurrency(p.approved_cost)}</td>
                  <td className="text-right font-mono text-sm">{formatCurrency(p.standard_cost)}</td>
                  <td className="text-right font-mono text-sm text-destructive font-semibold">
                    {formatCurrency(p.actual_cost)}
                  </td>
                  <td className="text-right font-mono text-sm text-destructive font-semibold">
                    +{formatPercent(p.approved_vs_actual)}
                  </td>
                  <td className="text-right font-mono text-sm text-destructive">
                    +{formatCurrency(p.cost_gap)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
