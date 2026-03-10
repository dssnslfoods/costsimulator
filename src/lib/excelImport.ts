import * as XLSX from 'xlsx';
import { Product, DbProductMaster, DbTransaction } from '@/types';

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

        const dbProducts: DbProductMaster[] = productJson
          .filter((row) => {
            const id = row['Item_id'] || row['item_id'] || row['Item Id'] || row['ITEM_ID'];
            return id !== undefined && id !== null && id !== '';
          })
          .map((row) => ({
            item_id: String(row['Item_id'] || row['item_id'] || row['Item Id'] || row['ITEM_ID'] || ''),
            item_name: String(row['Item_name'] || row['item_name'] || row['Item Name'] || row['ITEM_NAME'] || '')
          }));

        // fallback, collect products from transaction sheet as well if product master sheet is sparse
        const extractedFromTx: DbProductMaster[] = [];

        const dbTransactions: DbTransaction[] = transactionJson
          .filter((row) => {
            const id = row['Item_id'] || row['item_id'] || row['Item Id'] || row['ITEM_ID'];
            return id !== undefined && id !== null && id !== '';
          })
          .map((row) => {
            const itemId = String(row['Item_id'] || row['item_id'] || row['Item Id'] || row['ITEM_ID'] || '');
            const itemName = String(row['Item_name'] || row['item_name'] || row['Item Name'] || row['ITEM_NAME'] || '');

            extractedFromTx.push({ item_id: itemId, item_name: itemName });

            let dateStr = new Date().toISOString().split('T')[0];
            const rawDate = row['Date'] || row['date'] || row['DATE'];
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
              sale_volume: parseNum(row['sale volumn'] || row['sale_volume'] || row['Sale Volume'] || row['SALE_VOLUME'] || 0),
              offer_price: parseNum(row['offer price'] || row['offer_price'] || row['Offer Price'] || row['OFFER_PRICE'] || 0),
              approved_cost: parseNum(row['approved cost'] || row['approved_cost'] || row['Approved Cost'] || row['APPROVED_COST'] || 0),
              standard_cost: parseNum(row['standard cost'] || row['standard_cost'] || row['Standard Cost'] || row['STANDARD_COST'] || 0),
              actual_cost: parseNum(row['actual cost'] || row['actual_cost'] || row['Actual Cost'] || row['ACTUAL_COST'] || 0),
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
