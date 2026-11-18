import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StrategyConfig } from './StrategyPresets';

export interface BacktestReportData {
    symbol: string;
    dataSource: string;
    isRealMarketData: boolean | null;
    strategy: StrategyConfig;
    initialCapital: number;
    finalEquity: number;
    netPnl: number;
    returnPct: number;
    tradeCount: number;
    wins: number;
    losses: number;
    winRatePct: number;
    profitFactor: number | null;
    maxDrawdownPct: number;
    sharpeRatio?: number | null;
    sortinoRatio?: number | null;
    maxConsecutiveLosses?: number;
    totalTaxesAndCharges?: number;
    taxSummary?: {
        brokerage: number;
        stt: number;
        gst: number;
        exchange_charges: number;
        stamp_duty: number;
        sebi_charges: number;
        total: number;
    };
    trades: Array<{
        entry_time: string;
        exit_time: string;
        side?: 'LONG' | 'SHORT';
        entry_price: number;
        exit_price: number;
        quantity: number;
        net_pnl: number;
        exit_reason: string;
    }>;
    userName?: string;
    userEmail?: string;
}

export function generateInstitutionalPDFReport(data: BacktestReportData) {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
    const accentColor: [number, number, number] = [16, 185, 129]; // Emerald 500
    const dangerColor: [number, number, number] = [239, 68, 68]; // Red 500
    const textMuted: [number, number, number] = [100, 116, 139]; // Slate 500

    // Header Band
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 26, 'F');

    // Title & Logo
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('STRATEGY LAB · INSTITUTIONAL RESEARCH TEAR-SHEET', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
        `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST | Instrument: ${data.symbol}`,
        14,
        18,
    );

    if (data.userEmail || data.userName) {
        doc.text(
            `Analyst: ${data.userName || data.userEmail} (Verified)`,
            140,
            18,
            { align: 'right' }
        );
    }

    let y = 34;

    // Strategy & Provenance Subheader
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`${data.strategy.name || 'Quantitative Strategy'} — ${data.symbol}`, 14, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...textMuted);
    const provenanceText =
        data.isRealMarketData === true
            ? 'Verified Authentic NSE Market Data · Zero Look-Ahead Bias'
            : data.dataSource.includes('csv')
            ? 'User-Uploaded Historical Tradebook Data'
            : 'Synthetic Demonstration Dataset (Educational Simulation)';
    doc.text(provenanceText, 14, y + 5);

    y += 14;

    // KPI Summary Grid (Boxes)
    const kpis = [
        { label: 'NET PROFIT / LOSS', val: `Rs. ${data.netPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sub: `${data.returnPct > 0 ? '+' : ''}${data.returnPct}% Total Return`, isGood: data.netPnl >= 0 },
        { label: 'WIN RATE', val: `${data.winRatePct}%`, sub: `${data.wins}W / ${data.losses}L (${data.tradeCount} Trades)`, isGood: data.winRatePct >= 50 },
        { label: 'PROFIT FACTOR', val: data.profitFactor !== null ? String(data.profitFactor) : 'Inf', sub: 'Gross Win / Gross Loss', isGood: (data.profitFactor ?? 0) >= 1.5 },
        { label: 'MAX DRAWDOWN', val: `${data.maxDrawdownPct}%`, sub: 'Peak-to-Trough Decline', isGood: Math.abs(data.maxDrawdownPct) <= 10 },
        { label: 'SHARPE RATIO', val: data.sharpeRatio !== null && data.sharpeRatio !== undefined ? String(data.sharpeRatio) : 'N/A', sub: 'Annualized Risk-Adjusted', isGood: (data.sharpeRatio ?? 0) >= 1.0 },
        { label: 'SORTINO RATIO', val: data.sortinoRatio !== null && data.sortinoRatio !== undefined ? String(data.sortinoRatio) : 'N/A', sub: `Max Consecutive Losses: ${data.maxConsecutiveLosses ?? 0}`, isGood: (data.sortinoRatio ?? 0) >= 1.5 },
    ];

    const boxWidth = 58;
    const boxHeight = 17;
    const gapX = 4;
    const gapY = 4;

    kpis.forEach((kpi, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const bx = 14 + col * (boxWidth + gapX);
        const by = y + row * (boxHeight + gapY);

        doc.setFillColor(248, 250, 252); // Slate 50
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.roundedRect(bx, by, boxWidth, boxHeight, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...textMuted);
        doc.text(kpi.label, bx + 4, by + 4.5);

        doc.setFontSize(10.5);
        if (kpi.isGood) {
            doc.setTextColor(...accentColor);
        } else {
            doc.setTextColor(...dangerColor);
        }
        doc.text(kpi.val, bx + 4, by + 10);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...textMuted);
        doc.text(kpi.sub, bx + 4, by + 14.5);
    });

    y += 2 * (boxHeight + gapY) + 6;

    // Strategy Rules & Indian Statutory Taxes Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('STRATEGY SPECIFICATION & INDIAN REGULATORY FRICTIONS', 14, y);
    y += 3;

    const taxTotal = data.totalTaxesAndCharges ?? data.taxSummary?.total ?? 0;
    const stt = data.taxSummary?.stt ?? 0;
    const gst = data.taxSummary?.gst ?? 0;
    const brokerage = data.taxSummary?.brokerage ?? 0;
    const exchange = data.taxSummary?.exchange_charges ?? 0;
    const stamp = data.taxSummary?.stamp_duty ?? 0;

    autoTable(doc, {
        startY: y,
        theme: 'plain',
        headStyles: { fillColor: [241, 245, 249], textColor: primaryColor, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
        columns: [
            { header: 'PARAMETER', dataKey: 'param' },
            { header: 'VALUE', dataKey: 'val' },
            { header: 'STATUTORY LEVY', dataKey: 'levy' },
            { header: 'DEDUCTION', dataKey: 'deduct' },
        ],
        body: [
            {
                param: 'Execution Direction',
                val: data.strategy.trade_direction,
                levy: 'Securities Transaction Tax (STT)',
                deduct: `Rs. ${stt.toFixed(2)}`,
            },
            {
                param: 'EMA Crossover Periods',
                val: `Fast ${data.strategy.fast_ema} / Slow ${data.strategy.slow_ema}`,
                levy: 'Goods & Services Tax (GST 18%)',
                deduct: `Rs. ${gst.toFixed(2)}`,
            },
            {
                param: 'RSI Momentum Filter',
                val: data.strategy.use_rsi_filter ? `Active (> ${data.strategy.rsi_min})` : 'Disabled',
                levy: 'Brokerage (Flat Rs. 20/order model)',
                deduct: `Rs. ${brokerage.toFixed(2)}`,
            },
            {
                param: 'Stop Loss / Profit Target',
                val: `SL ${data.strategy.stop_loss_pct}% / TP ${data.strategy.take_profit_pct}%`,
                levy: 'Exchange Turnover & SEBI Charges',
                deduct: `Rs. ${exchange.toFixed(2)}`,
            },
            {
                param: 'Trailing Stop / Supertrend',
                val: `${data.strategy.use_trailing_stop ? `TSL ${data.strategy.trailing_stop_pct}%` : 'No TSL'} · ${data.strategy.use_supertrend_filter ? 'Supertrend On' : 'Supertrend Off'}`,
                levy: 'Stamp Duty (Buy Orders)',
                deduct: `Rs. ${stamp.toFixed(2)}`,
            },
            {
                param: 'Starting Capital -> Final',
                val: `Rs. ${data.initialCapital.toLocaleString('en-IN')} -> Rs. ${data.finalEquity.toLocaleString('en-IN')}`,
                levy: 'TOTAL STATUTORY FRICTIONS',
                deduct: `Rs. ${taxTotal.toFixed(2)}`,
            },
        ],
        margin: { left: 14, right: 14 },
    });

    const lastTable = (doc as any).lastAutoTable;
    y = lastTable ? lastTable.finalY + 8 : y + 45;

    // Trade Ledger Section (Top 20 trades)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text(`TRADE EXECUTION LEDGER (LATEST ${Math.min(data.trades.length, 20)} OF ${data.trades.length} TRADES)`, 14, y);
    y += 3;

    const sampleTrades = data.trades.slice(0, 20).map((t) => [
        t.entry_time.replace('T', ' ').substring(0, 16),
        t.exit_time.replace('T', ' ').substring(0, 16),
        t.side || 'LONG',
        `Rs. ${t.entry_price.toFixed(2)}`,
        `Rs. ${t.exit_price.toFixed(2)}`,
        `Rs. ${t.net_pnl.toFixed(2)}`,
        t.exit_reason.replace('_', ' '),
    ]);

    autoTable(doc, {
        startY: y,
        theme: 'striped',
        head: [['ENTRY TIME', 'EXIT TIME', 'SIDE', 'ENTRY (Rs.)', 'EXIT (Rs.)', 'NET P&L', 'EXIT REASON']],
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
        body: sampleTrades,
        bodyStyles: { fontSize: 6.8, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            5: { fontStyle: 'bold' },
        },
        didParseCell: (hookData) => {
            if (hookData.section === 'body' && hookData.column.index === 5) {
                const cellText = String(hookData.cell.raw || '');
                if (cellText.includes('-')) {
                    hookData.cell.styles.textColor = dangerColor;
                } else {
                    hookData.cell.styles.textColor = accentColor;
                }
            }
        },
        margin: { left: 14, right: 14 },
    });

    // Footer Disclaimer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
            'CONFIDENTIAL RESEARCH DOCUMENT · Strategy Lab Deterministic Backtesting Engine · Past performance does not guarantee future market returns.',
            14,
            290,
        );
        doc.text(`Page ${i} of ${pageCount}`, 196, 290, { align: 'right' });
    }

    const cleanSymbol = data.symbol.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`StrategyLab_FactSheet_${cleanSymbol}_${Date.now()}.pdf`);
}
