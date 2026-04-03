import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, LineSeries, AreaSeries } from "lightweight-charts";

const CHART_OPTIONS = {
  autoSize: true,
  layout: {
    background: { color: "#0c1628" },
    textColor: "#9ca3af",
    fontFamily: "Inter, monospace",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: "rgba(255,255,255,0.04)" },
    horzLines: { color: "rgba(255,255,255,0.04)" },
  },
  crosshair: {
    vertLine: { color: "rgba(255,255,255,0.3)", labelBackgroundColor: "#2a2a2a" },
    horzLine: { color: "rgba(255,255,255,0.3)", labelBackgroundColor: "#2a2a2a" },
  },
  rightPriceScale: {
    borderColor: "rgba(255,255,255,0.07)",
    scaleMargins: { top: 0.1, bottom: 0.1 },
  },
  timeScale: {
    borderColor: "rgba(255,255,255,0.07)",
    timeVisible: true,
    secondsVisible: false,
    fixLeftEdge: false,
    fixRightEdge: false,
    barSpacing: 10,
    minBarSpacing: 4,
  },
};

const CandleChart = ({ data = [], type = "candle" }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // recreate series when type changes
  useEffect(() => {
    if (!containerRef.current) return;

    // first mount: create the chart
    if (!chartRef.current) {
      chartRef.current = createChart(containerRef.current, CHART_OPTIONS);
    }

    const chart = chartRef.current;

    // remove existing series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // add the right series type
    if (type === "candle") {
      seriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#16a34a",
        borderDownColor: "#dc2626",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
    } else if (type === "line") {
      seriesRef.current = chart.addSeries(LineSeries, {
        color: "#38bdf8",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: "#38bdf8",
      });
    } else if (type === "area") {
      seriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: "#38bdf8",
        topColor: "rgba(56,189,248,0.25)",
        bottomColor: "rgba(56,189,248,0.02)",
        lineWidth: 2,
      });
    }

    // set data if already available
    if (data.length && seriesRef.current) {
      seriesRef.current.setData(formatData(type, data));
      if (type === "candle") {
        chart.timeScale().scrollToRealTime();
      } else {
        chart.timeScale().fitContent();
      }
    }

    return () => {
      // only destroy on unmount (when containerRef becomes null)
    };
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  // destroy chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  // update data
  useEffect(() => {
    if (!seriesRef.current || !data.length) return;
    seriesRef.current.setData(formatData(type, data));
    if (type === "candle") {
      chartRef.current?.timeScale().scrollToRealTime();
    } else {
      chartRef.current?.timeScale().fitContent();
    }
  }, [data, type]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
};

const formatData = (type, data) => {
  if (type === "candle") return data;
  return data.map((d) => ({ time: d.time, value: d.close }));
};

export default CandleChart;
