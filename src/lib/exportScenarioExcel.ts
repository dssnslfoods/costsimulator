import ExcelJS from 'exceljs';
import { Scenario } from '@/types';
import { formatCurrency, formatPercent } from './calculations';

export async function exportScenarioExcel(scenario: Scenario) {
  const workbook = new ExcelJS.Workbook();

  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary', {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  });

  summarySheet.columns = [
    { width: 25 },
    { width: 20 },
  ];

  // Title
  let row = 1;
  const titleCell = summarySheet.getCell(row, 1);
  titleCell.value = 'Scenario Report';
  titleCell.font = { size: 18, bold: true, color: { argb: 'FF1e40af' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'center' };
  summarySheet.mergeCells(row, 1, row, 2);
  row++;

  const scenarioNameCell = summarySheet.getCell(row, 1);
  scenarioNameCell.value = scenario.name;
  scenarioNameCell.font = { size: 14, bold: true, color: { argb: 'FF3b82f6' } };
  summarySheet.mergeCells(row, 1, row, 2);
  row++;

  // Description
  if (scenario.description) {
    const descCell = summarySheet.getCell(row, 1);
    descCell.value = scenario.description;
    descCell.font = { size: 11, italic: true, color: { argb: 'FF6b7280' } };
    descCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    summarySheet.mergeCells(row, 1, row, 2);
    summarySheet.getRow(row).height = 30;
    row++;
  }

  row++;

  // Summary metrics
  const metrics = [
    ['Total Revenue', scenario.totals.total_revenue, '#f0f9ff', '#1e40af'],
    ['Total Cost', scenario.totals.total_cost, '#fef2f2', '#b91c1c'],
    ['Total Profit', scenario.totals.total_profit, '#f0fdf4', '#16a34a'],
    ['Average Margin %', scenario.totals.avg_margin, '#f5f3ff', '#7c3aed'],
    ['Average Food Cost %', 100 - scenario.totals.avg_margin, '#fefce8', '#ca8a04'],
  ];

  metrics.forEach(([label, value, bgColor, textColor]) => {
    const labelCell = summarySheet.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 11, color: { argb: 'FF' + textColor.slice(1) } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor.slice(1) } };
    labelCell.border = {
      left: { style: 'thin', color: { argb: 'FFd1d5db' } },
      right: { style: 'thin', color: { argb: 'FFd1d5db' } },
      top: { style: 'thin', color: { argb: 'FFd1d5db' } },
      bottom: { style: 'thin', color: { argb: 'FFd1d5db' } },
    };
    labelCell.alignment = { horizontal: 'left' };
    labelCell.padding = { left: 10, right: 10 };

    const valueCell = summarySheet.getCell(row, 2);
    if (label.includes('%')) {
      valueCell.value = Number(value.toFixed(2));
      valueCell.numFmt = '0.00"%"';
    } else {
      valueCell.value = value;
      valueCell.numFmt = '#,##0.00';
    }
    valueCell.font = { bold: true, size: 11 };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor.slice(1) } };
    valueCell.border = {
      left: { style: 'thin', color: { argb: 'FFd1d5db' } },
      right: { style: 'thin', color: { argb: 'FFd1d5db' } },
      top: { style: 'thin', color: { argb: 'FFd1d5db' } },
      bottom: { style: 'thin', color: { argb: 'FFd1d5db' } },
    };
    valueCell.alignment = { horizontal: 'right' };
    valueCell.padding = { left: 10, right: 10 };

    summarySheet.getRow(row).height = 22;
    row++;
  });

  // Details Sheet
  const detailsSheet = workbook.addWorksheet('Details', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  detailsSheet.columns = [
    { width: 12, header: 'Item ID' },
    { width: 25, header: 'Item Name' },
    { width: 12, header: 'Group' },
    { width: 12, header: 'Country' },
    { width: 14, header: 'Selling Price' },
    { width: 14, header: 'Volume' },
    { width: 12, header: 'Cost Model' },
    { width: 14, header: 'Unit Cost' },
    { width: 14, header: 'Revenue' },
    { width: 14, header: 'Total Cost' },
    { width: 14, header: 'Profit' },
    { width: 12, header: 'Margin %' },
  ];

  // Header row
  const headerRow = detailsSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e40af' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'center' };
  headerRow.height = 24;

  detailsSheet.columns.forEach((col) => {
    const cell = detailsSheet.getCell(1, col.header ? detailsSheet.columns.indexOf(col) + 1 : 0);
    cell.border = {
      left: { style: 'thin', color: { argb: 'FF1e40af' } },
      right: { style: 'thin', color: { argb: 'FF1e40af' } },
      top: { style: 'thin', color: { argb: 'FF1e40af' } },
      bottom: { style: 'thin', color: { argb: 'FF1e40af' } },
    };
  });

  // Data rows
  scenario.assumptions.forEach((assumption, idx) => {
    const dataRow = detailsSheet.getRow(idx + 2);
    dataRow.values = [
      assumption.item_id,
      assumption.item_name,
      assumption.item_group || '—',
      assumption.item_country || '—',
      assumption.selling_price,
      Math.round(assumption.forecast_volume),
      assumption.cost_model,
      assumption.adjusted_cost,
      assumption.revenue,
      assumption.total_cost,
      assumption.profit,
      assumption.margin,
    ];

    // Formatting
    dataRow.font = { size: 10 };
    dataRow.height = 18;

    // Alternate row coloring
    if (idx % 2 === 0) {
      dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    }

    // Number formatting and alignment
    detailsSheet.getCell(idx + 2, 5).numFmt = '#,##0.00'; // Price
    detailsSheet.getCell(idx + 2, 5).alignment = { horizontal: 'right' };

    detailsSheet.getCell(idx + 2, 6).alignment = { horizontal: 'right' }; // Volume

    detailsSheet.getCell(idx + 2, 8).numFmt = '#,##0.00'; // Unit Cost
    detailsSheet.getCell(idx + 2, 8).alignment = { horizontal: 'right' };

    detailsSheet.getCell(idx + 2, 9).numFmt = '#,##0.00'; // Revenue
    detailsSheet.getCell(idx + 2, 9).alignment = { horizontal: 'right' };

    detailsSheet.getCell(idx + 2, 10).numFmt = '#,##0.00'; // Total Cost
    detailsSheet.getCell(idx + 2, 10).alignment = { horizontal: 'right' };

    // Profit color coding
    const profitCell = detailsSheet.getCell(idx + 2, 11);
    profitCell.numFmt = '#,##0.00';
    profitCell.alignment = { horizontal: 'right' };
    if (assumption.profit >= 0) {
      profitCell.font = { ...profitCell.font, color: { argb: 'FF16a34a' }, bold: true };
    } else {
      profitCell.font = { ...profitCell.font, color: { argb: 'FFdc2626' }, bold: true };
    }

    // Margin color coding
    const marginCell = detailsSheet.getCell(idx + 2, 12);
    marginCell.numFmt = '0.00"%"';
    marginCell.alignment = { horizontal: 'right' };
    if (assumption.margin >= 20) {
      marginCell.font = { ...marginCell.font, color: { argb: 'FF16a34a' }, bold: true };
    } else if (assumption.margin >= 10) {
      marginCell.font = { ...marginCell.font, color: { argb: 'FFea580c' }, bold: true };
    } else {
      marginCell.font = { ...marginCell.font, color: { argb: 'FFdc2626' }, bold: true };
    }

    // Borders
    for (let col = 1; col <= 12; col++) {
      const cell = detailsSheet.getCell(idx + 2, col);
      cell.border = {
        left: { style: 'thin', color: { argb: 'FFe5e7eb' } },
        right: { style: 'thin', color: { argb: 'FFe5e7eb' } },
        top: { style: 'thin', color: { argb: 'FFe5e7eb' } },
        bottom: { style: 'thin', color: { argb: 'FFe5e7eb' } },
      };
    }
  });

  // Freeze panes
  detailsSheet.views = [
    { state: 'frozen', ySplit: 1 },
  ];

  // Save
  await workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scenario_${scenario.name.replace(/\s+/g, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
