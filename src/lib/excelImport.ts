import * as XLSX from 'xlsx';
import { Product } from '@/types';

export function parseExcelFile(file: File): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        const products: Product[] = json
          .filter((row) => {
            const id = row['Item_id'] || row['item_id'] || row['Item Id'] || row['ITEM_ID'];
            return id !== undefined && id !== null && id !== '';
          })
          .map((row) => {
            const parseNum = (val: unknown): number => {
              if (typeof val === 'number') return val;
              if (typeof val === 'string') {
                const cleaned = val.replace(/,/g, '');
                return parseFloat(cleaned) || 0;
              }
              return 0;
            };

            return {
              item_id: String(row['Item_id'] || row['item_id'] || row['Item Id'] || row['ITEM_ID'] || ''),
              item_name: String(row['Item_name'] || row['item_name'] || row['Item Name'] || row['ITEM_NAME'] || ''),
              sale_volume: parseNum(row['sale volumn'] || row['sale_volume'] || row['Sale Volume'] || row['SALE_VOLUME'] || 0),
              offer_price: parseNum(row['offer price'] || row['offer_price'] || row['Offer Price'] || row['OFFER_PRICE'] || 0),
              approved_cost: parseNum(row['approved cost'] || row['approved_cost'] || row['Approved Cost'] || row['APPROVED_COST'] || 0),
              standard_cost: parseNum(row['standard cost'] || row['standard_cost'] || row['Standard Cost'] || row['STANDARD_COST'] || 0),
              actual_cost: parseNum(row['actual cost'] || row['actual_cost'] || row['Actual Cost'] || row['ACTUAL_COST'] || 0),
              created_at: new Date().toISOString(),
            };
          });

        resolve(products);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
