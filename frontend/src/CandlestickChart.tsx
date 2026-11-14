import { useEffect, useRef } from 'react';
import {
    createChart,
    CandlestickSeries,
    HistogramSeries,
    ColorType,
    createSeriesMarkers,
} from 'lightweight-charts';
import type { SeriesMarker, Time } from 'lightweight-charts';

export type CandleData = {
    time: number;
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

export type TradeMarker = {
    entry_time: string;
    exit_time: string;
    side?: 'LONG' | 'SHORT';
    entry_price: number;
    exit_price: number;
    quantity: number;
    points: number;
    net_pnl: number;
    exit_reason: string;
};

interface Props {
    candles: CandleData[];
    trades: TradeMarker[];
    theme?: 'dark' | 'light';
}

export default function CandlestickChart({ candles, trades, theme = 'dark' }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || !candles || candles.length === 0) return;

        const container = containerRef.current;
        container.innerHTML = '';

        const isLight = theme === 'light';

        const chart = createChart(container, {
            layout: {
                background: { type: ColorType.Solid, color: isLight ? '#ffffff' : '#0d1522' },
                textColor: isLight ? '#475569' : '#94a3b8',
                fontSize: 12,
            },
            grid: {
                vertLines: { color: isLight ? '#f1f5f9' : '#1e293b' },
                horzLines: { color: isLight ? '#f1f5f9' : '#1e293b' },
            },
            crosshair: {
                vertLine: { color: isLight ? '#94a3b8' : '#475569', width: 1, style: 2 },
                horzLine: { color: isLight ? '#94a3b8' : '#475569', width: 1, style: 2 },
            },
            timeScale: {
                borderColor: isLight ? '#e2e8f0' : '#334155',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: isLight ? '#e2e8f0' : '#334155',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.25,
                },
            },
            width: container.clientWidth || 800,
            height: 440,
        });

        // 1. Candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        const formattedCandles = candles.map((c) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));
        candleSeries.setData(formattedCandles);

        // 2. Volume series
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#38bdf8',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        const volumeData = candles.map((c) => ({
            time: c.time as Time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
        }));
        volumeSeries.setData(volumeData);

        // 3. Trade markers
        if (trades && trades.length > 0) {
            const markers: SeriesMarker<Time>[] = [];

            // Helper to find closest candle time for a trade timestamp
            const findCandleTime = (isoString: string): Time | null => {
                const targetSec = Math.floor(new Date(isoString).getTime() / 1000);
                if (isNaN(targetSec)) return null;

                // Exact match or nearest
                let closest = candles[0];
                let minDiff = Math.abs(candles[0].time - targetSec);

                for (let i = 1; i < candles.length; i++) {
                    const diff = Math.abs(candles[i].time - targetSec);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = candles[i];
                    }
                }
                return closest ? (closest.time as Time) : null;
            };

            trades.forEach((trade) => {
                const isShort = trade.side === 'SHORT';
                const entryTime = findCandleTime(trade.entry_time);
                if (entryTime !== null) {
                    markers.push({
                        time: entryTime,
                        position: isShort ? 'aboveBar' : 'belowBar',
                        color: isShort ? '#f59e0b' : '#10b981',
                        shape: isShort ? 'arrowDown' : 'arrowUp',
                        text: isShort
                            ? `SHORT @ ₹${trade.entry_price.toFixed(1)} (${trade.quantity})`
                            : `BUY @ ₹${trade.entry_price.toFixed(1)} (${trade.quantity})`,
                    });
                }

                const exitTime = findCandleTime(trade.exit_time);
                if (exitTime !== null) {
                    const isWin = trade.net_pnl >= 0;
                    const pnlSign = isWin ? '+' : '';
                    markers.push({
                        time: exitTime,
                        position: isShort ? 'belowBar' : 'aboveBar',
                        color: isWin ? '#38bdf8' : '#ef4444',
                        shape: isShort ? 'arrowUp' : 'arrowDown',
                        text: isShort
                            ? `COVER (${trade.exit_reason.toUpperCase()}): ₹${trade.exit_price.toFixed(1)} (${pnlSign}₹${trade.net_pnl.toFixed(0)})`
                            : `${trade.exit_reason.toUpperCase()}: ₹${trade.exit_price.toFixed(1)} (${pnlSign}₹${trade.net_pnl.toFixed(0)})`,
                    });
                }
            });

            // Sort markers by time
            markers.sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));

            createSeriesMarkers(candleSeries, markers);
        }

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (containerRef.current) {
                chart.applyOptions({ width: containerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [candles, trades, theme]);

    const isLight = theme === 'light';

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '440px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b',
                    transition: 'border-color 200ms ease',
                }}
            />
        </div>
    );
}

