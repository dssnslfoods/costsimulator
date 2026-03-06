import { useState, useMemo } from 'react';
import { useAppState } from '@/store/AppContext';
import { CostModel } from '@/types';
import { generatePriceSensitivity, formatCurrency, formatPercent } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';

export default function PriceSensitivity() {
  const { state } = useAppState();
  const { products } = state;

  const [selectedProductId, setSelectedProductId] = useState(products[0]?.item_id || '');
  const [costModel, setCostModel] = useState<CostModel>('actual');
  const [rangeMin, setRangeMin] = useState(80);
  const [rangeMax, setRangeMax] = useState(120);

  const product = products.find(p => p.item_id === selectedProductId);

  const sensitivityData = useMemo(() => {
    if (!product) return [];
    return generatePriceSensitivity(
      product,
      product.offer_price,
      product.sale_volume,
      costModel,
      0,
      rangeMin,
      rangeMax,
      21
    );
  }, [product, costModel, rangeMin, rangeMax]);

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
        <h2 className="text-2xl font-bold">Price Sensitivity Analysis</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Simulate how price changes affect margin and profit
        </p>
      </div>

      {/* Controls */}
      <div className="metric-card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Product</label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {products.map(p => (
                  <SelectItem key={p.item_id} value={p.item_id}>
                    <span className="truncate">{p.item_name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cost Model</label>
            <Select value={costModel} onValueChange={(v) => setCostModel(v as CostModel)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="actual">Actual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Price Range Min (%)</label>
            <Input
              type="number"
              value={rangeMin}
              onChange={e => setRangeMin(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Price Range Max (%)</label>
            <Input
              type="number"
              value={rangeMax}
              onChange={e => setRangeMax(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
        </div>
      </div>

      {product && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="metric-card">
              <p className="stat-label">Base Price</p>
              <p className="text-xl font-bold font-mono mt-1">฿{formatCurrency(product.offer_price)}</p>
            </div>
            <div className="metric-card">
              <p className="stat-label">Volume</p>
              <p className="text-xl font-bold font-mono mt-1">{new Intl.NumberFormat().format(product.sale_volume)}</p>
            </div>
            <div className="metric-card">
              <p className="stat-label">Cost ({costModel})</p>
              <p className="text-xl font-bold font-mono mt-1">
                ฿{formatCurrency(
                  costModel === 'approved' ? product.approved_cost
                    : costModel === 'standard' ? product.standard_cost
                    : product.actual_cost
                )}
              </p>
            </div>
            <div className="metric-card">
              <p className="stat-label">Price Range</p>
              <p className="text-xl font-bold font-mono mt-1">
                ฿{formatCurrency(product.offer_price * rangeMin / 100)} – ฿{formatCurrency(product.offer_price * rangeMax / 100)}
              </p>
            </div>
          </div>

          {/* Price vs Profit */}
          <div className="metric-card">
            <h3 className="section-header">Price vs Profit</h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={sensitivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="price"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `฿${v.toFixed(1)}`}
                  label={{ value: 'Price', position: 'insideBottomRight', offset: -5, fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'Margin' ? formatPercent(value) : `฿${formatCurrency(value)}`
                  }
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <ReferenceLine x={product.offer_price} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label="Current" />
                <Line type="monotone" dataKey="profit" stroke="hsl(168, 72%, 40%)" name="Profit" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(217, 91%, 60%)" name="Revenue" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Price vs Margin */}
          <div className="metric-card">
            <h3 className="section-header">Price vs Margin %</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sensitivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="price"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `฿${v.toFixed(1)}`}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value: number) => formatPercent(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <ReferenceLine x={product.offer_price} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="margin" stroke="hsl(262, 83%, 58%)" name="Margin %" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Data Table */}
          <div className="metric-card overflow-x-auto">
            <h3 className="section-header">Sensitivity Data Points</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-right">% of Base</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {sensitivityData.map((d, i) => (
                  <tr key={i} className={Math.abs(d.price_pct - 100) < 0.5 ? 'bg-primary/5' : ''}>
                    <td className="text-right font-mono text-sm">{d.price_pct.toFixed(0)}%</td>
                    <td className="text-right font-mono text-sm">฿{formatCurrency(d.price)}</td>
                    <td className="text-right font-mono text-sm">฿{formatCurrency(d.revenue)}</td>
                    <td className={`text-right font-mono text-sm font-semibold ${d.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      ฿{formatCurrency(d.profit)}
                    </td>
                    <td className={`text-right font-mono text-sm font-semibold ${d.margin >= 20 ? 'text-success' : d.margin >= 10 ? 'text-warning' : 'text-destructive'}`}>
                      {formatPercent(d.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
