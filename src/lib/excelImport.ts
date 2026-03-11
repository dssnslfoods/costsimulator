import * as XLSX from 'xlsx';
import { Product, DbProductMaster, DbTransaction, PromotionItem } from '@/types';

export interface ParsedExcelData {
  productsForState: Product[];
  dbProducts: DbProductMaster[];
  dbTransactions: DbTransaction[];
}

export function parseExcelFile(file: File): Promise<ParsedExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let transactionSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'transaction');
        let productSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('product') || n.toLowerCase().includes('master'));

        // Fallback to first sheet if names don't exactly match
        if (!transactionSheetName) transactionSheetName = workbook.SheetNames[0];
        if (!productSheetName) productSheetName = workbook.SheetNames[1] || workbook.SheetNames[0];

        const transactionSheet = workbook.Sheets[transactionSheetName];
        const productSheet = workbook.Sheets[productSheetName];

        const transactionJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(transactionSheet);
        const productJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(productSheet);

        const parseNum = (val: unknown): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const cleaned = val.replace(/,/g, '');
            return parseFloat(cleaned) || 0;
          }
          return 0;
        };

        const getField = (row: Record<string, unknown>, keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const key of keys) {
            const match = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
            if (match !== undefined) return row[match];
          }
          return undefined;
        };

        const dbProducts: DbProductMaster[] = productJson
          .filter((row) => {
            const id = getField(row, ['item_id', 'item id', 'itemcode', 'item code', 'product_id', 'product id']);
            return id !== undefined && id !== null && id !== '';
          })
          .map((row) => ({
            item_id: String(getField(row, ['item_id', 'item id', 'itemcode', 'item code', 'product_id', 'product id']) || ''),
            item_name: String(getField(row, ['item_name', 'item name', 'itemname', 'product_name', 'product name', 'description']) || ''),
            item_group: String(getField(row, ['item_group', 'item group', 'group', 'itemgroup']) || '') || undefined,
            item_country: String(getField(row, ['item_country', 'item country', 'country', 'itemcountry']) || '') || undefined,
          }));

        // fallback, collect products from transaction sheet as well if product master sheet is sparse
        const extractedFromTx: DbProductMaster[] = [];

        const dbTransactions: DbTransaction[] = transactionJson
          .filter((row) => {
            const id = getField(row, ['item_id', 'item id', 'itemcode', 'item code', 'product_id', 'product id']);
            return id !== undefined && id !== null && id !== '';
          })
          .map((row) => {
            const itemId = String(getField(row, ['item_id', 'item id', 'itemcode', 'item code', 'product_id', 'product id']) || '');
            const itemName = String(getField(row, ['item_name', 'item name', 'itemname', 'product_name', 'product name', 'description']) || '');

            extractedFromTx.push({ item_id: itemId, item_name: itemName, item_group: undefined, item_country: undefined });

            let dateStr = new Date().toISOString().split('T')[0];
            const rawDate = getField(row, ['date', 'docdate', 'posting date', 'created on']);
            if (rawDate) {
              if (typeof rawDate === 'number') {
                // Excel date
                const date = new Date(Date.UTC(0, 0, rawDate - 1));
                dateStr = date.toISOString().split('T')[0];
              } else {
                try {
                  dateStr = new Date(String(rawDate)).toISOString().split('T')[0];
                } catch (e) {
                  dateStr = new Date().toISOString().split('T')[0];
                }
              }
            }

            return {
              date: dateStr,
              item_id: itemId,
              item_name: itemName,
              sale_volume: parseNum(getField(row, ['sale volumn', 'sale_volume', 'sale volume', 'volume', 'qty', 'quantity']) || 0),
              offer_price: parseNum(getField(row, ['offer price', 'offer_price', 'price']) || 0),
              approved_cost: parseNum(getField(row, ['approved cost', 'approved_cost', 'cost']) || 0),
              standard_cost: parseNum(getField(row, ['standard cost', 'standard_cost', 'std cost']) || 0),
              actual_cost: parseNum(getField(row, ['actual cost', 'actual_cost', 'act cost']) || 0),
            };
          });

        // Ensure unique db products
        const uniqueProductsMap = new Map<string, DbProductMaster>();
        extractedFromTx.forEach(p => uniqueProductsMap.set(p.item_id, p));
        dbProducts.forEach(p => uniqueProductsMap.set(p.item_id, p));

        const finalDbProducts = Array.from(uniqueProductsMap.values());

        // Ensure unique transactions by date and item_id to prevent Postgres UPSERT ON CONFLICT error
        const uniqueTxMap = new Map<string, DbTransaction>();
        for (const tx of dbTransactions) {
          const key = `${tx.date}_${tx.item_id}`;
          if (uniqueTxMap.has(key)) {
            // Aggregate values if duplicate: sum volume, keep latest price/cost
            const existing = uniqueTxMap.get(key)!;
            existing.sale_volume += tx.sale_volume;
            existing.offer_price = tx.offer_price;
            existing.approved_cost = tx.approved_cost;
            existing.standard_cost = tx.standard_cost;
            existing.actual_cost = tx.actual_cost;
          } else {
            uniqueTxMap.set(key, tx);
          }
        }
        const finalDbTransactions = Array.from(uniqueTxMap.values());

        const productsForState: Product[] = finalDbTransactions.map(tx => ({
          item_id: tx.item_id,
          item_name: tx.item_name,
          sale_volume: tx.sale_volume,
          offer_price: tx.offer_price,
          approved_cost: tx.approved_cost,
          standard_cost: tx.standard_cost,
          actual_cost: tx.actual_cost,
          created_at: tx.date || new Date().toISOString(),
          date: tx.date
        }));

        resolve({
          dbProducts: finalDbProducts,
          dbTransactions: finalDbTransactions,
          productsForState
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
export function parsePromotionExcel(file: File): Promise<PromotionItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        const parseNum = (val: unknown): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
          return 0;
        };

        const getField = (row: Record<string, unknown>, keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const key of keys) {
            const match = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
            if (match !== undefined) return row[match];
          }
          return undefined;
        };

        const items: PromotionItem[] = json
          .filter(row => getField(row, ['item_id', 'item id', 'product_id', 'product id']))
          .map(row => ({
            item_id: String(getField(row, ['item_id', 'item id', 'product_id', 'product id']) || ''),
            item_name: String(getField(row, ['item_name', 'item name', 'name', 'product_name']) || ''),
            volume: parseNum(getField(row, ['volume', 'qty', 'quantity', 'sale_volume', 'sale volume']) || 0)
          }));

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
