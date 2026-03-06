import { useAppState } from '@/store/AppContext';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet, FileText, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function Reports() {
  const { state, dispatch } = useAppState();
  const { scenarios, products, comparisonReports } = state;

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
    const headers = ['Scenario Name', 'Created', 'Products', 'Revenue', 'Cost', 'Profit', 'Margin %'];
    const rows = scenarios.map(s => [
      `"${s.name}"`,
      new Date(s.created_at).toLocaleDateString(),
      String(s.totals.product_count),
      s.totals.total_revenue.toFixed(2),
      s.totals.total_cost.toFixed(2),
      s.totals.total_profit.toFixed(2),
      s.totals.avg_margin.toFixed(2),
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
    const headers = ['Item ID', 'Item Name', 'Selling Price', 'Volume', 'Cost Model', 'Unit Cost', 'Revenue', 'Profit', 'Margin %'];
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
    ]);
    exportCSV(`scenario_${s.name.replace(/\s+/g, '_')}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Generate and export reports for management
        </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                Export all product master data including costs
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={exportProductData}
                disabled={products.length === 0}
              >
                <FileDown size={14} />
                Export CSV
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
              <p className="text-xs text-muted-foreground mt-1">
                Compare all scenarios in one report
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={exportScenarioSummary}
                disabled={scenarios.length === 0}
              >
                <FileDown size={14} />
                Export CSV
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
              <p className="text-xs text-muted-foreground mt-1">
                Detailed profit analysis by scenario
              </p>
              <p className="text-xs text-muted-foreground mt-2">Select scenario below</p>
            </div>
          </div>
        </div>
      </div>

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
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()} ·
                    Revenue: ฿{formatCurrency(s.totals.total_revenue)} ·
                    Profit: ฿{formatCurrency(s.totals.total_profit)} ·
                    Margin: {formatPercent(s.totals.avg_margin)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportScenarioDetail(s.id)}
                >
                  <FileDown size={14} />
                  CSV
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
