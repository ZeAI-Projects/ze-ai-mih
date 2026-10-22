import { useAdmin } from './AdminPortal';

type Props = {
  targetId: string;
  title: string;
  label?: string;
  description?: string;
};

function buildPrintMarkup(node: HTMLElement, title: string, description?: string) {
  const styleMarkup = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((element) => element.outerHTML)
    .join('\n');
  const printedAt = new Date().toLocaleString();
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    ${styleMarkup}
    <style>
      :root { color-scheme: light; }
      html, body { margin: 0; padding: 0; background: #ffffff; color: #201531; }
      body { font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .miih-print-shell { padding: 24px; }
      .miih-print-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; border-bottom: 2px solid #e4d8ff; padding-bottom: 16px; margin-bottom: 24px; }
      .miih-print-kicker { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #7b4fe0; margin-bottom: 8px; }
      .miih-print-header h1 { margin: 0 0 8px; font-size: 32px; line-height: 1.1; }
      .miih-print-header p { margin: 0; color: #5b4f74; max-width: 720px; }
      .miih-print-meta { text-align: right; font-size: 12px; color: #6a5d84; }
      .miih-print-meta strong { display: block; font-size: 14px; color: #201531; margin-bottom: 4px; }
      .miih-print-content { width: 100%; }
      .miih-admin-primary, .miih-admin-outline, .miih-export-overlay, button { display: none !important; }
      .miih-admin-grid2, .miih-stat-grid { break-inside: avoid; }
      .miih-panel, .miih-stat-card { break-inside: avoid; page-break-inside: avoid; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { size: A4 portrait; margin: 12mm; }
        .miih-print-shell { padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="miih-print-shell">
      <header class="miih-print-header">
        <div>
          <span class="miih-print-kicker">Made in India · Admin export</span>
          <h1>${title}</h1>
          <p>${description || 'Generated from the live admin workspace.'}</p>
        </div>
        <div class="miih-print-meta">
          <strong>ZeAI Admin Workspace</strong>
          <span>Printed on ${printedAt}</span>
        </div>
      </header>
      <main class="miih-print-content">${node.outerHTML}</main>
    </div>
  </body>
</html>`;
}

export function AdminVisualExportButton({ targetId, title, label = 'Export PDF', description }: Props) {
  const { can, notify } = useAdmin();
  if (!can('EXPORT_CREATE')) return null;

  function exportPdf() {
    const target = document.getElementById(targetId);
    if (!target) {
      notify('This page section could not be prepared for export.');
      return;
    }
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!printWindow) {
      notify('Please allow pop-ups to export this page as PDF.');
      return;
    }
    const markup = buildPrintMarkup(target, title, description);
    printWindow.document.open();
    printWindow.document.write(markup);
    printWindow.document.close();
    const doPrint = () => {
      printWindow.focus();
      printWindow.print();
    };
    printWindow.addEventListener('load', doPrint, { once: true });
    window.setTimeout(doPrint, 500);
  }

  return (
    <button type="button" className="miih-admin-primary" onClick={exportPdf}>
      <span aria-hidden="true">⇩</span> {label}
    </button>
  );
}
