import { useState, useRef } from 'react';
import { useAppState } from '@/store/AppContext';
import { parseExcelFile } from '@/lib/excelImport';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductMaster() {
  const { state, dispatch } = useAppState();
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = state.products.filter(p =>
    p.item_id.toLowerCase().includes(search.toLowerCase()) ||
    p.item_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const products = await parseExcelFile(file);
      dispatch({ type: 'SET_PRODUCTS', payload: products });
      toast.success(`Imported ${products.length} products successfully`);
    } catch (err) {
      toast.error('Failed to parse Excel file');
      console.error(err);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Product Master</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage product catalog and cost data
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImport}
            className="hidden"
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload size={16} />
            {importing ? 'Importing...' : 'Import Excel'}
          </Button>
          {state.products.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => {
                dispatch({ type: 'SET_PRODUCTS', payload: [] });
                toast.info('All products cleared');
              }}
            >
              <Trash2 size={16} />
              Clear
            </Button>
          )}
        </div>
      </div>

      {state.products.length > 0 && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="metric-card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item ID</th>
                  <th>Product Name</th>
                  <th className="text-right">Volume</th>
                  <th className="text-right">Offer Price</th>
                  <th className="text-right">Approved Cost</th>
                  <th className="text-right">Standard Cost</th>
                  <th className="text-right">Actual Cost</th>
                  <th className="text-right">Margin (Actual)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const margin = p.offer_price > 0
                    ? ((p.offer_price - p.actual_cost) / p.offer_price * 100)
                    : 0;
                  return (
                    <tr key={p.item_id}>
                      <td className="font-mono text-xs">{p.item_id}</td>
                      <td className="max-w-[300px] truncate">{p.item_name}</td>
                      <td className="text-right font-mono text-sm">{formatNumber(p.sale_volume)}</td>
                      <td className="text-right font-mono text-sm">{formatCurrency(p.offer_price)}</td>
                      <td className="text-right font-mono text-sm">{formatCurrency(p.approved_cost)}</td>
                      <td className="text-right font-mono text-sm">{formatCurrency(p.standard_cost)}</td>
                      <td className="text-right font-mono text-sm">{formatCurrency(p.actual_cost)}</td>
                      <td className={`text-right font-mono text-sm font-semibold ${margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-destructive'}`}>
                        {margin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="text-xs text-muted-foreground mt-4">
              Showing {filtered.length} of {state.products.length} products
            </div>
          </div>
        </>
      )}

      {state.products.length === 0 && (
        <div className="metric-card text-center py-16">
          <Upload className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-lg font-semibold mb-2">Import Product Data</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
            Upload an Excel file with columns: Item_id, Item_name, sale volumn, offer price, approved cost, standard cost, actual cost
          </p>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} />
            Select Excel File
          </Button>
        </div>
      )}
    </div>
  );
}
