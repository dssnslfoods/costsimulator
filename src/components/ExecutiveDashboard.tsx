import { useAppState } from '@/store/AppContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { TrendingUp, TrendingDown, Percent, Package, Activity, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Cell
} from 'recharts';

const CHART_COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(168, 72%, 40%)',
  'hsl(262, 83%, 58%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(190, 80%, 45%)',
];

export default function ExecutiveDashboard() {
  const { state } = useAppState();
  const { scenarios, products } = state;

  const hasScenarios = scenarios.length > 0;
  const hasProducts = products.length > 0;

  // Aggregate from scenarios
  const scenarioChartData = scenarios.map(s => ({
    name: s.name.length > 20 ? s.name.substring(0, 20) + '…' : s.name,
    revenue: s.totals.total_revenue,
    profit: s.totals.total_profit,
    margin: s.totals.avg_margin,
    cost: s.totals.total_cost,
  }));

  // Best scenario
  const bestProfit = hasScenarios
    ? scenarios.reduce((best, s) => s.totals.total_profit > best.totals.total_profit ? s : best)
    : null;

  const bestMargin = hasScenarios
    ? scenarios.reduce((best, s) => s.totals.avg_margin > best.totals.avg_margin ? s : best)
    : null;

  // Top products by highest margin
  const productProfitData = hasProducts
    ? products
        .map(p => ({
          name: p.item_name.length > 18 ? p.item_name.substring(0, 18) + '…' : p.item_name,
          profit: (p.offer_price - p.actual_cost) * p.sale_volume,
          margin: p.offer_price > 0 ? ((p.offer_price - p.actual_cost) / p.offer_price) * 100 : 0,
        }))
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 10)
    : [];

  const totalProductRevenue = products.reduce((s, p) => s + p.offer_price * p.sale_volume, 0);
  const totalActualCost = products.reduce((s, p) => s + p.actual_cost * p.sale_volume, 0);
  const totalApprovedCost = products.reduce((s, p) => s + p.approved_cost * p.sale_volume, 0);
  const totalProfit = totalProductRevenue - totalActualCost;
  const avgMargin = totalProductRevenue > 0 ? (totalProfit / totalProductRevenue) * 100 : 0;
  const costToRevenueRatio = totalProductRevenue > 0 ? (totalActualCost / totalProductRevenue) * 100 : 0;
  const costVariance = totalApprovedCost > 0 ? ((totalActualCost - totalApprovedCost) / totalApprovedCost) * 100 : 0;
  const lossProducts = products.filter(p => p.offer_price < p.actual_cost).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Executive Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of revenue, profitability, and scenario projections
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Gross Margin"
          value={`${avgMargin.toFixed(1)}%`}
          icon={<Percent size={20} />}
          gradient="gradient-success"
          subtitle={`Profit ฿${formatCurrency(totalProfit)}`}
        />
        <MetricCard
          label="Food Cost Ratio"
          value={`${costToRevenueRatio.toFixed(1)}%`}
          icon={<Activity size={20} />}
          gradient="gradient-primary"
          subtitle={costToRevenueRatio > 70 ? 'ต้นทุนสูง ควรปรับปรุง' : 'อยู่ในเกณฑ์ดี'}
        />
        <MetricCard
          label="Cost Variance"
          value={`${costVariance >= 0 ? '+' : ''}${costVariance.toFixed(1)}%`}
          icon={costVariance > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          gradient={costVariance > 5 ? 'gradient-warning' : 'gradient-success'}
          subtitle="Actual vs Approved"
        />
        <MetricCard
          label="Loss Products"
          value={`${lossProducts} / ${products.length}`}
          icon={<AlertTriangle size={20} />}
          gradient={lossProducts > 0 ? 'gradient-warning' : 'gradient-dark'}
          subtitle={lossProducts > 0 ? 'สินค้าขาดทุน ต้องแก้ไข' : 'ไม่มีสินค้าขาดทุน'}
        />
      </div>

      {hasScenarios && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue & Profit by Scenario */}
          <div className="metric-card">
            <h3 className="section-header">Revenue & Profit by Scenario</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scenarioChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="revenue" fill={CHART_COLORS[0]} name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill={CHART_COLORS[1]} name="Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Margin by Scenario */}
          <div className="metric-card">
            <h3 className="section-header">Margin by Scenario</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scenarioChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="margin" fill={CHART_COLORS[2]} name="Margin %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hasProducts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="metric-card">
            <h3 className="section-header">Top 10 Products by Highest Margin</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productProfitData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Bar dataKey="margin" name="Margin %" radius={[0, 4, 4, 0]}>
                  {productProfitData.map((entry, i) => (
                    <Cell key={i} fill={entry.margin >= 20 ? 'hsl(168, 72%, 40%)' : entry.margin >= 10 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Lowest Margin Products */}
          <div className="metric-card">
            <h3 className="section-header">Top 10 Lowest Margin Products</h3>
            {hasProducts ? (() => {
              const lowestMarginData = products
                .map(p => ({
                  name: p.item_name.length > 18 ? p.item_name.substring(0, 18) + '…' : p.item_name,
                  margin: p.offer_price > 0 ? ((p.offer_price - p.actual_cost) / p.offer_price) * 100 : 0,
                }))
                .sort((a, b) => a.margin - b.margin)
                .slice(0, 10);
              return (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={lowestMarginData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip
                      formatter={(value: number) => `${value.toFixed(2)}%`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="margin" name="Margin %" radius={[0, 4, 4, 0]}>
                      {lowestMarginData.map((entry, i) => (
                        <Cell key={i} fill={entry.margin >= 20 ? 'hsl(168, 72%, 40%)' : entry.margin >= 10 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })() : (
              <p className="text-muted-foreground text-sm">No products loaded.</p>
            )}
          </div>
        </div>
      )}

      {!hasProducts && (
        <div className="metric-card text-center py-16">
          <Package className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-lg font-semibold mb-2">No Products Loaded</h3>
          <p className="text-muted-foreground text-sm">
            Go to Product Master to import your Excel data file.
          </p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, gradient, subtitle }: {
  label: string; value: string; icon: React.ReactNode; gradient: string; subtitle: string;
}) {
  return (
    <div className="metric-card relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-20 h-20 ${gradient} opacity-10 rounded-bl-[40px]`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${gradient}`}>
          <span className="text-primary-foreground">{icon}</span>
        </div>
      </div>
    </div>
  );
}
