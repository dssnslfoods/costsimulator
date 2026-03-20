import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Scenario } from '@/types';
import { formatCurrency, formatPercent } from './calculations';

export async function exportScenarioPDF(scenario: Scenario) {
  // Create a temporary container for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '1000px';
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '40px';
  container.style.fontFamily = 'Arial, sans-serif';

  // Build HTML content
  const date = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tableRows = scenario.assumptions
    .map(
      (a) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px; font-size: 11px;">${a.item_id}</td>
      <td style="padding: 10px; font-size: 11px;">${a.item_name}</td>
      <td style="padding: 10px; text-align: right; font-size: 11px;">฿${formatCurrency(a.selling_price)}</td>
      <td style="padding: 10px; text-align: right; font-size: 11px;">${Math.round(a.forecast_volume).toLocaleString()}</td>
      <td style="padding: 10px; text-align: center; font-size: 11px;">${a.cost_model}</td>
      <td style="padding: 10px; text-align: right; font-size: 11px;">฿${formatCurrency(a.adjusted_cost)}</td>
      <td style="padding: 10px; text-align: right; font-size: 11px;">฿${formatCurrency(a.revenue)}</td>
      <td style="padding: 10px; text-align: right; font-size: 11px; color: ${a.profit >= 0 ? '#16a34a' : '#dc2626'};">฿${formatCurrency(a.profit)}</td>
      <td style="padding: 10px; text-align: right; font-size: 11px; color: ${a.margin >= 20 ? '#16a34a' : a.margin >= 10 ? '#ea580c' : '#dc2626'};">${formatPercent(a.margin)}</td>
    </tr>
  `
    )
    .join('');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937;">
      <!-- Header -->
      <div style="border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px; color: #1e40af; font-weight: bold;">Scenario Report</h1>
        <h2 style="margin: 5px 0 0 0; font-size: 20px; color: #3b82f6;">${scenario.name}</h2>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">${date}</p>
      </div>

      <!-- Description -->
      ${
        scenario.description
          ? `<div style="background-color: #f3f4f6; padding: 15px; margin-bottom: 25px; border-left: 4px solid #3b82f6; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #374151;">${scenario.description}</p>
          </div>`
          : ''
      }

      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 30px;">
        <div style="background-color: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 15px;">
          <p style="margin: 0; font-size: 11px; color: #0c4a6e; font-weight: bold;">Total Revenue</p>
          <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #1e40af;">฿${formatCurrency(scenario.totals.total_revenue)}</p>
        </div>
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 15px;">
          <p style="margin: 0; font-size: 11px; color: #7c2d12; font-weight: bold;">Total Cost</p>
          <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #b91c1c;">฿${formatCurrency(scenario.totals.total_cost)}</p>
        </div>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px;">
          <p style="margin: 0; font-size: 11px; color: #15803d; font-weight: bold;">Total Profit</p>
          <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #16a34a;">฿${formatCurrency(scenario.totals.total_profit)}</p>
        </div>
        <div style="background-color: #f5f3ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 15px;">
          <p style="margin: 0; font-size: 11px; color: #4c1d95; font-weight: bold;">Avg Margin</p>
          <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #7c3aed;">${formatPercent(scenario.totals.avg_margin)}</p>
        </div>
        <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 15px;">
          <p style="margin: 0; font-size: 11px; color: #713f12; font-weight: bold;">Avg Food Cost</p>
          <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #ca8a04;">${formatPercent(100 - scenario.totals.avg_margin)}</p>
        </div>
      </div>

      <!-- Product Details Table -->
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: bold; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Product Details (${scenario.totals.product_count} items)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #eff6ff; border-bottom: 2px solid #3b82f6;">
              <th style="padding: 12px; text-align: left; font-weight: bold; color: #1e40af;">Item ID</th>
              <th style="padding: 12px; text-align: left; font-weight: bold; color: #1e40af;">Item Name</th>
              <th style="padding: 12px; text-align: right; font-weight: bold; color: #1e40af;">Price</th>
              <th style="padding: 12px; text-align: right; font-weight: bold; color: #1e40af;">Volume</th>
              <th style="padding: 12px; text-align: center; font-weight: bold; color: #1e40af;">Model</th>
              <th style="padding: 12px; text-align: right; font-weight: bold; color: #1e40af;">Unit Cost</th>
              <th style="padding: 12px; text-align: right; font-weight: bold; color: #1e40af;">Revenue</th>
              <th style="padding: 12px; text-align: right; font-weight: bold; color: #1e40af;">Profit</th>
              <th style="padding: 12px; text-align: right; font-weight: bold; color: #1e40af;">Margin</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 30px; font-size: 10px; color: #9ca3af;">
        <p style="margin: 0;">Generated by Cost Simulator | ${new Date().toLocaleString('th-TH')}</p>
      </div>
    </div>
  `;

  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    // Calculate dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let position = 0;

    // Add image to PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add more pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Download
    pdf.save(`Scenario_${scenario.name.replace(/\s+/g, '_')}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
