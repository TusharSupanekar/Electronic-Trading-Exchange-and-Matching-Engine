import React, { useState, useEffect, useMemo } from "react";
import { Box, Typography, Drawer, IconButton, Button, Snackbar, Alert } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useTheme } from "@mui/material/styles";
import { useMediaQuery } from "@mui/material";
import TopBar from "../components/Dashboard/TopBar";
import SidePanel from "../components/Dashboard/SidePanel";
import PlaceOrder from "../components/Dashboard/PlaceOrder";
import CandleChart from "../components/Dashboard/CandleChart";
import RSIPanel from "../components/Dashboard/RSIPanel";
import DepthChart from "../components/Dashboard/DepthChart";
import NewsSentiment from "../components/Dashboard/NewsSentiment";
import Wallet from "../components/Dashboard/Wallet";
import Portfolio from "../components/Dashboard/Portfolio";
import useColors from "../theme/useColors.js";

const ExchangeDashboard = () => {
  const [selectedMenu, setSelectedMenu] = useState("Trading Board");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [candles, setCandles] = useState([]);
  const [bookData, setBookData] = useState({ bids: [], asks: [] });
  const [trades, setTrades] = useState([]);
  const [chartInterval, setChartInterval] = useState("1m");
  const [chartType, setChartType] = useState("candle");
  const [activeIndicators, setActiveIndicators] = useState({ vol: true, sma20: true, sma50: false, ema9: false, rsi: false });
  const toggleIndicator = (key) => setActiveIndicators((prev) => ({ ...prev, [key]: !prev[key] }));

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const c = useColors();

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const [bookRes, tradesRes] = await Promise.all([
          fetch(`${API_URL}/book/snapshot`),
          fetch(`${API_URL}/trades`),
        ]);
        setBookData((await bookRes.json()) || { bids: [], asks: [] });
        setTrades((await tradesRes.json())?.trades || []);
      } catch (err) { console.error("Market fetch error:", err); }
    };
    fetchMarketData();
    const timer = window.setInterval(fetchMarketData, 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCandles = async () => {
      try {
        const res = await fetch(`${API_URL}/candles?symbol=AAPL&interval=${chartInterval}&limit=200`);
        const data = await res.json();
        setCandles(Array.isArray(data) ? data : []);
      } catch (err) { console.error("Candles fetch error:", err); }
    };
    fetchCandles();
    const timer = window.setInterval(fetchCandles, 5000);
    return () => window.clearInterval(timer);
  }, [chartInterval]);

  const handleDrawerToggle = () => setSidebarOpen((prev) => !prev);
  const handleMenuSelect = (menu) => { setSelectedMenu(menu); if (isMobile) setSidebarOpen(false); };

  const bids = [...(bookData.bids || [])].reverse();
  const asks = bookData.asks || [];
  const bestBid = bids.length ? bids[0][0] / 100 : 0;
  const bestAsk = asks.length ? asks[0][0] / 100 : 0;
  const spread = bestBid && bestAsk ? (bestAsk - bestBid).toFixed(2) : "--";
  const lastTrade = trades.length ? trades[trades.length - 1] : null;
  const lastPrice = lastTrade?.price_cents ? (lastTrade.price_cents / 100).toFixed(2) : "--";
  const priceChange = candles.length >= 2
    ? ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100
    : null;

  return (
    <Box sx={{ minHeight: "100vh", background: c.pageBg, display: "flex", flexDirection: "column" }}>
      <TopBar appName="Trading Exchange" onMenuClick={handleDrawerToggle} />

      <Box sx={{ display: "flex", flex: 1, alignItems: "stretch" }}>

        {/* Desktop: collapsible sidebar with slide transition */}
        {!isMobile && (
          <Box sx={{
            width: sidebarOpen ? 280 : 0,
            flexShrink: 0,
            overflow: "hidden",
            transition: "width 0.25s ease",
          }}>
            <SidePanel selected={selectedMenu} onSelect={handleMenuSelect} />
          </Box>
        )}

        {/* Mobile: overlay drawer */}
        {isMobile && (
          <Drawer anchor="left" open={sidebarOpen} onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: 260, background: c.sideBg, color: c.t1, borderRight: `1px solid ${c.border}` } }}>
            <SidePanel selected={selectedMenu} onSelect={handleMenuSelect} />
          </Drawer>
        )}

        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, color: c.t1, background: c.pageBg, minWidth: 0, overflowY: "auto" }}>

          {/* ── DASHBOARD ── */}
          {selectedMenu === "Trading Board" && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 340px" }, gap: 2, alignItems: "start" }}>

              {/* LEFT COLUMN */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>

                {/* Price header card */}
                <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "14px", boxShadow: c.shadow, p: 2.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: c.t1 }}>AAPL/USD</Typography>
                    {lastPrice !== "--" && (
                      <Typography sx={{ fontSize: 17, fontWeight: 700, color: priceChange !== null && priceChange >= 0 ? "#22c55e" : "#ef4444" }}>
                        +${lastPrice}
                      </Typography>
                    )}
                    {priceChange !== null && (
                      <Box sx={{ px: 1.2, py: 0.25, borderRadius: "6px", background: priceChange >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: priceChange >= 0 ? "#22c55e" : "#ef4444" }}>
                          {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 42, fontWeight: 800, lineHeight: 1.1, mb: 2.5, color: c.t1 }}>
                    {lastPrice !== "--" ? `$${lastPrice}` : "--"}
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
                    <StatCard label="Best Bid" value={bestBid ? `$${bestBid.toFixed(2)}` : "--"} color="#22c55e" c={c} />
                    <StatCard label="Best Ask" value={bestAsk ? `$${bestAsk.toFixed(2)}` : "--"} color="#ef4444" c={c} />
                    <StatCard label="Spread"   value={spread !== "--" ? `$${spread}` : "--"}    color="#38bdf8" c={c} />
                  </Box>
                </Box>

                {/* Chart card */}
                <Box sx={{ background: c.altBg, border: `1px solid ${c.border}`, borderRadius: "14px", boxShadow: c.shadow, p: 2, overflow: "hidden" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: c.t3, textTransform: "uppercase", letterSpacing: 1 }}>
                      Live Price Chart
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {["1m", "5m", "15m", "30m", "1h"].map((iv) => (
                        <Box key={iv} onClick={() => setChartInterval(iv)} sx={{
                          px: 1.2, py: 0.4, borderRadius: "6px", cursor: "pointer", fontSize: 11, fontWeight: 700, userSelect: "none", transition: "all 0.15s",
                          background: chartInterval === iv ? c.accentBg : "transparent",
                          color: chartInterval === iv ? c.accentText : c.t3,
                          border: chartInterval === iv ? `1px solid ${c.accentBorder}` : "1px solid transparent",
                          "&:hover": { color: c.accentText, background: c.accentBg },
                        }}>{iv.toUpperCase()}</Box>
                      ))}
                      <Box sx={{ width: "1px", height: 16, background: c.border, mx: 0.5 }} />
                      {[{ key: "candle", label: "Candle" }, { key: "line", label: "Line" }, { key: "area", label: "Area" }].map(({ key, label }) => (
                        <Box key={key} onClick={() => setChartType(key)} sx={{
                          px: 1.2, py: 0.4, borderRadius: "6px", cursor: "pointer", fontSize: 11, fontWeight: 700, userSelect: "none", transition: "all 0.15s",
                          background: chartType === key ? c.accentBg : "transparent",
                          color: chartType === key ? c.accentText : c.t3,
                          border: chartType === key ? `1px solid ${c.accentBorder}` : "1px solid transparent",
                          "&:hover": { color: c.accentText, background: c.accentBg },
                        }}>{label}</Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Indicator toggles */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1.5, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: 10, color: c.t4, textTransform: "uppercase", letterSpacing: 0.8, mr: 0.5 }}>Indicators</Typography>
                    {[
                      { key: "vol",   label: "VOL",    clr: "#9ca3af", bg: "rgba(156,163,175,0.15)", bdr: "rgba(156,163,175,0.35)" },
                      { key: "sma20", label: "SMA 20", clr: "#f59e0b", bg: "rgba(245,158,11,0.15)",  bdr: "rgba(245,158,11,0.4)"   },
                      { key: "sma50", label: "SMA 50", clr: "#3b82f6", bg: "rgba(59,130,246,0.15)",  bdr: "rgba(59,130,246,0.4)"   },
                      { key: "ema9",  label: "EMA 9",  clr: "#a78bfa", bg: "rgba(167,139,250,0.15)", bdr: "rgba(167,139,250,0.4)"  },
                      { key: "rsi",   label: "RSI",    clr: "#f43f5e", bg: "rgba(244,63,94,0.15)",   bdr: "rgba(244,63,94,0.4)"    },
                    ].map(({ key, label, clr, bg, bdr }) => (
                      <Box key={key} onClick={() => toggleIndicator(key)} sx={{
                        px: 1.1, py: 0.3, borderRadius: "6px", cursor: "pointer", fontSize: 10, fontWeight: 700, userSelect: "none", transition: "all 0.15s",
                        background: activeIndicators[key] ? bg : "transparent",
                        color: activeIndicators[key] ? clr : c.t4,
                        border: activeIndicators[key] ? `1px solid ${bdr}` : `1px solid transparent`,
                        "&:hover": { color: clr, background: bg },
                      }}>{label}</Box>
                    ))}
                  </Box>

                  <Box sx={{ height: { xs: 260, md: 360, lg: 420 } }}>
                    <CandleChart data={candles} type={chartType} indicators={activeIndicators} />
                  </Box>
                </Box>

                {/* RSI panel — shown only when RSI indicator is toggled on */}
                {activeIndicators.rsi && <RSIPanel data={candles} />}

                {/* News + Sentiment */}
                <NewsSentiment symbol="AAPL" />

              </Box>

              {/* RIGHT COLUMN */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <InlineOrderPanel bestBid={bestBid} bestAsk={bestAsk} />

                {/* Market Depth Chart */}
                <DepthChart bids={bookData.bids || []} asks={bookData.asks || []} />

                {/* L2 Order Book */}
                <Box onClick={() => setSelectedMenu("Order Book")} sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "14px", boxShadow: c.shadow, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s", "&:hover": { borderColor: "#6366f1" } }}>
                  <Typography sx={{ px: 2, py: 1.5, fontWeight: 700, fontSize: 15, borderBottom: `1px solid ${c.border}`, color: c.t1 }}>
                    L2 Order Book
                  </Typography>
                  <Box sx={{ px: 2, pt: 0.5, pb: 1.5 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.65fr", py: 0.8, borderBottom: `1px solid rgba(99,102,241,0.06)` }}>
                      {["Bids", "Side", "Amount", "Total"].map((h) => (
                        <Typography key={h} sx={{ fontSize: 10, color: c.t3, textTransform: "uppercase", letterSpacing: 0.7 }}>{h}</Typography>
                      ))}
                    </Box>
                    {[...(bookData.bids || [])].reverse().slice(0, 5).map((bid, i) => (
                      <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.65fr", py: 0.7, borderBottom: `1px solid ${c.rowBdr}` }}>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#22c55e", fontWeight: 600 }}>${(bid[0] / 100).toFixed(2)}</Typography>
                        <Typography sx={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>Buy</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t2 }}>{bid[1]}</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t3 }}>{((bid[0] / 100) * bid[1]).toFixed(0)}</Typography>
                      </Box>
                    ))}
                    <Box sx={{ my: 0.8, borderTop: `1px solid rgba(99,102,241,0.08)` }} />
                    {(bookData.asks || []).slice(0, 5).map((ask, i) => (
                      <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.65fr", py: 0.7, borderBottom: `1px solid ${c.rowBdr}` }}>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#ef4444", fontWeight: 600 }}>${(ask[0] / 100).toFixed(2)}</Typography>
                        <Typography sx={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>Sell</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t2 }}>{ask[1]}</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t3 }}>{((ask[0] / 100) * ask[1]).toFixed(0)}</Typography>
                      </Box>
                    ))}
                    {!(bookData.bids || []).length && !(bookData.asks || []).length && (
                      <Typography sx={{ py: 3, textAlign: "center", color: c.t3, fontSize: 12 }}>No orders in book</Typography>
                    )}
                  </Box>
                </Box>

                {/* Recent Trades */}
                <Box onClick={() => setSelectedMenu("Trades")} sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "14px", boxShadow: c.shadow, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s", "&:hover": { borderColor: "#6366f1" } }}>
                  <Typography sx={{ px: 2, py: 1.5, fontWeight: 700, fontSize: 15, borderBottom: `1px solid ${c.border}`, color: c.t1 }}>
                    Recent Trades
                  </Typography>
                  <Box sx={{ px: 2, pt: 0.5, pb: 1.5 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.8fr", py: 0.8, borderBottom: `1px solid rgba(99,102,241,0.06)` }}>
                      {["Price", "Amount", "Seq", "Type"].map((h) => (
                        <Typography key={h} sx={{ fontSize: 10, color: c.t3, textTransform: "uppercase", letterSpacing: 0.7 }}>{h}</Typography>
                      ))}
                    </Box>
                    {[...trades].reverse().slice(0, 8).map((t, i) => (
                      <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.8fr", py: 0.7, borderBottom: `1px solid ${c.rowBdr}`, "&:last-child": { borderBottom: "none" } }}>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: t.taker_side === "BUY" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                          ${(t.price_cents / 100).toFixed(2)}
                        </Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t2 }}>{t.qty}</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t3 }}>{t.seq ?? "--"}</Typography>
                        <Box sx={{ display: "inline-flex" }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, px: 0.8, py: 0.25, borderRadius: "4px",
                            background: t.taker_side === "BUY" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                            color: t.taker_side === "BUY" ? "#22c55e" : "#ef4444",
                          }}>
                            {t.taker_side === "BUY" ? "↑ Buy" : "↓ Sell"}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                    {!trades.length && (
                      <Typography sx={{ py: 3, textAlign: "center", color: c.t3, fontSize: 12 }}>No trades yet</Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {/* ── PLACE ORDER ── */}
          {selectedMenu === "Place Order" && <PlaceOrder />}

          {/* ── ORDER BOOK ── */}
          {selectedMenu === "Order Book" && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: c.t1 }}>Order Book — AAPL</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                {[
                  { label: "Asks", color: "#ef4444", data: bookData.asks || [], side: "ask" },
                  { label: "Bids", color: "#22c55e", data: bookData.bids || [], side: "bid" },
                ].map(({ label, color, data }) => (
                  <Box key={label} sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "12px", boxShadow: c.shadow, overflow: "hidden" }}>
                    <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ color, fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>{label}</Typography>
                      <Typography sx={{ color: c.t3, fontSize: 12 }}>{data.length} levels</Typography>
                    </Box>
                    <Box sx={{ px: 2.5, py: 1, display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 11, color: c.t3, textTransform: "uppercase", letterSpacing: 0.8 }}>Price</Typography>
                      <Typography sx={{ fontSize: 11, color: c.t3, textTransform: "uppercase", letterSpacing: 0.8 }}>Qty</Typography>
                    </Box>
                    {data.map((row, i) => {
                      const maxQ = Math.max(...data.map((r) => r[1]), 1);
                      const pct = Math.round((row[1] / maxQ) * 100);
                      return (
                        <Box key={i} sx={{ position: "relative", px: 2.5, py: 0.9, display: "flex", justifyContent: "space-between", "&:hover": { background: c.rowHov } }}>
                          <Box sx={{ position: "absolute", top: 0, right: 0, height: "100%", width: `${pct}%`, background: label === "Asks" ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", pointerEvents: "none" }} />
                          <Typography sx={{ fontFamily: "monospace", fontSize: 13, color, fontWeight: 600 }}>${(row[0] / 100).toFixed(2)}</Typography>
                          <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: c.t1 }}>{row[1].toLocaleString()}</Typography>
                        </Box>
                      );
                    })}
                    {!data.length && <Typography sx={{ py: 4, textAlign: "center", color: c.t3, fontSize: 13 }}>No {label.toLowerCase()}</Typography>}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* ── TRADES ── */}
          {selectedMenu === "Trades" && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: c.t1 }}>Recent Trades</Typography>
              <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "12px", boxShadow: c.shadow, overflow: "hidden" }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", px: 2.5, py: 1.5, borderBottom: `1px solid ${c.border}` }}>
                  {["Price", "Qty", "Side", "Seq"].map((h) => (
                    <Typography key={h} sx={{ fontSize: 11, color: c.t3, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</Typography>
                  ))}
                </Box>
                {[...trades].reverse().slice(0, 40).map((t, i) => (
                  <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", px: 2.5, py: 1, borderBottom: `1px solid ${c.rowBdr}`, "&:hover": { background: c.rowHov }, "&:last-child": { borderBottom: "none" } }}>
                    <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: t.taker_side === "BUY" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>${(t.price_cents / 100).toFixed(2)}</Typography>
                    <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: c.t1 }}>{t.qty}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: t.taker_side === "BUY" ? "#22c55e" : "#ef4444" }}>{t.taker_side || "—"}</Typography>
                    <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t3 }}>{t.seq}</Typography>
                  </Box>
                ))}
                {!trades.length && <Typography sx={{ py: 5, textAlign: "center", color: c.t3, fontSize: 13 }}>No trades yet</Typography>}
              </Box>
            </Box>
          )}

          {/* ── ORDERS ── */}
          {selectedMenu === "Orders" && <OrdersPage />}

          {/* ── PORTFOLIO ── */}
          {selectedMenu === "Portfolio" && <Portfolio />}

          {/* ── WALLET ── */}
          {selectedMenu === "Wallet" && <Wallet />}

          {/* ── LOGS ── */}
          {selectedMenu === "Logs" && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: c.t1 }}>Activity Log</Typography>
              <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "12px", boxShadow: c.shadow, p: 2.5 }}>
                <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: c.t3, mb: 1 }}>
                  [{new Date().toLocaleTimeString()}] Dashboard loaded
                </Typography>
                <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#22c55e", mb: 1 }}>
                  [{new Date().toLocaleTimeString()}] WebSocket market feed active
                </Typography>
                <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: c.t3 }}>
                  [{new Date().toLocaleTimeString()}] Order book polling every 2s
                </Typography>
              </Box>
            </Box>
          )}

        </Box>
      </Box>
    </Box>
  );
};

// ── Inline Order Panel ────────────────────────────────────────────────────────

const InlineOrderPanel = ({ bestBid, bestAsk }) => {
  const [side, setSide] = useState("BUY");
  const [orderType, setOrderType] = useState("LIMIT");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const userId = localStorage.getItem("user_id");
  const c = useColors();

  const showNotification = (message, severity = "success") => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  const estimatedTotal = useMemo(() => {
    const p = orderType === "MARKET" ? (side === "BUY" ? bestAsk : bestBid) : Number(price || 0);
    return (Number(qty || 0) * Number(p || 0)).toFixed(2);
  }, [qty, price, orderType, side, bestBid, bestAsk]);

  const handleSubmit = async () => {
    if (!userId) return showNotification("Not logged in", "error");
    setSubmitting(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId, symbol: "AAPL", side, type: orderType,
          qty: Number(qty),
          price_cents: orderType === "LIMIT" ? Math.round(Number(price) * 100) : null,
          client_order_id: Date.now().toString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage =
          data?.detail?.includes("Not enough shares")
            ? "You don't have stocks to trade"
            : data?.detail || "Order failed";
        throw new Error(errorMessage);
      }

      showNotification(`${side} order placed successfully`, "success");
    } catch (err) {
      showNotification(err.message || "Order failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAll = async () => {
    if (!userId) return;
    try {
      const cancelAPI = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await fetch(`${cancelAPI}/orders?user_id=${userId}&status=resting&limit=50`);
      const data = await res.json();
      await Promise.all((data.orders || []).map((o) =>
        fetch(`${cancelAPI}/orders/${o.order_id}`, { method: "DELETE" })
      ));
      showNotification("All active orders cancelled", "success");
    } catch {
      showNotification("Failed to cancel orders", "error");
    }
  };

  return (
    <>
      <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "14px", boxShadow: c.shadow, p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: c.t1 }}>Order Placement</Typography>
          <Box onClick={cancelAll} sx={{ px: 1.4, py: 0.4, borderRadius: "6px", cursor: "pointer", fontSize: 11, fontWeight: 600,
            border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
            "&:hover": { background: "rgba(239,68,68,0.08)" }, transition: "all 0.15s",
          }}>Cancel All</Box>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${c.border}`, borderRadius: "10px", overflow: "hidden", mb: 1.5 }}>
          {["BUY", "SELL"].map((s) => (
            <Box key={s} onClick={() => setSide(s)} sx={{
              py: 1, textAlign: "center", cursor: "pointer", fontWeight: 700, fontSize: 14, userSelect: "none",
              background: side === s ? (s === "BUY" ? "#16a34a" : "#dc2626") : "transparent",
              color: side === s ? "#fff" : c.t3, transition: "all 0.15s",
            }}>{s}</Box>
          ))}
        </Box>

        <Box sx={{ display: "flex", gap: 0.6, mb: 1.5 }}>
          {["LIMIT", "MARKET"].map((t) => (
            <Box key={t} onClick={() => setOrderType(t)} sx={{
              px: 1.5, py: 0.55, borderRadius: "7px", cursor: "pointer", fontSize: 12, fontWeight: 600, userSelect: "none",
              background: orderType === t ? "rgba(99,102,241,0.2)" : "transparent",
              color: orderType === t ? c.t1 : c.t3,
              border: orderType === t ? `1px solid ${c.border}` : "1px solid transparent",
              transition: "all 0.15s",
            }}>{t}</Box>
          ))}
        </Box>

        {orderType === "LIMIT" && (
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 11, color: c.t3, mb: 0.6, textTransform: "uppercase", letterSpacing: 0.7 }}>Price</Typography>
            <Box sx={{ position: "relative" }}>
              <Typography sx={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: c.t2, fontSize: 15, pointerEvents: "none" }}>$</Typography>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                style={{
                  width: "100%", background: c.inputBg, border: `1px solid ${c.inputBdr}`,
                  borderRadius: "9px", padding: "10px 12px 10px 26px", color: c.inputClr, fontSize: "17px", fontWeight: 700,
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 0.6, mt: 0.8 }}>
              <QfBtn label={`Bid $${bestBid?.toFixed(2) || "--"}`} color="#22c55e" onClick={() => setPrice(bestBid?.toFixed(2) || "")} disabled={!bestBid} />
              <QfBtn label="Mid" color="#f5a520" onClick={() => bestBid && bestAsk && setPrice(((bestBid + bestAsk) / 2).toFixed(2))} disabled={!bestBid || !bestAsk} />
              <QfBtn label={`Ask $${bestAsk?.toFixed(2) || "--"}`} color="#ef4444" onClick={() => setPrice(bestAsk?.toFixed(2) || "")} disabled={!bestAsk} />
            </Box>
          </Box>
        )}

        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: c.t3, mb: 0.6, textTransform: "uppercase", letterSpacing: 0.7 }}>Amount</Typography>
          <Box sx={{ display: "flex", alignItems: "center", background: c.inputBg, border: `1px solid ${c.inputBdr}`, borderRadius: "9px", overflow: "hidden" }}>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", padding: "10px 12px", color: c.inputClr, fontSize: "17px", fontWeight: 700, outline: "none" }}
            />
            <Typography sx={{ px: 1.5, fontSize: 12, color: c.t3, borderLeft: `1px solid ${c.border}`, py: 1.3 }}>shares</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.6, mt: 0.8 }}>
            {[1, 5, 10, 50, 100].map((n) => (
              <Box key={n} onClick={() => setQty(String(n))} sx={{
                flex: 1, textAlign: "center", py: 0.55, cursor: "pointer", fontSize: 11, fontWeight: 600,
                borderRadius: "6px", border: `1px solid ${c.border}`, color: c.t3,
                "&:hover": { border: `1px solid rgba(99,102,241,0.5)`, color: c.t1, background: "rgba(99,102,241,0.06)" },
                transition: "all 0.15s", userSelect: "none",
              }}>{n}</Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.2, borderTop: `1px solid ${c.border}`, mb: 1.5 }}>
          <Typography sx={{ color: c.t2, fontSize: 13 }}>Estimated Cost</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: c.t1 }}>${estimatedTotal}</Typography>
        </Box>

        <Box onClick={!submitting ? handleSubmit : undefined} sx={{
          py: 1.3, textAlign: "center", borderRadius: "10px",
          cursor: submitting ? "default" : "pointer",
          background: side === "BUY"
            ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
            : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
          color: "#fff", fontWeight: 700, fontSize: 15, userSelect: "none",
          opacity: submitting ? 0.7 : 1,
          "&:hover": { filter: submitting ? "none" : "brightness(1.08)" },
          transition: "all 0.15s",
        }}>
          {submitting ? "Placing..." : `Place ${side} Order`}
        </Box>
      </Box>

      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          variant="filled"
          sx={{ width: "100%", fontWeight: 600, borderRadius: "10px" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const StatCard = ({ label, value, color = "#fff", c }) => {
  const bgMap    = { "#22c55e": "rgba(34,197,94,0.08)",  "#ef4444": "rgba(239,68,68,0.08)",  "#38bdf8": "rgba(56,189,248,0.08)" };
  const borderMap= { "#22c55e": "rgba(34,197,94,0.25)",  "#ef4444": "rgba(239,68,68,0.25)",  "#38bdf8": "rgba(56,189,248,0.25)" };
  return (
    <Box sx={{ background: bgMap[color] || "rgba(99,102,241,0.06)", border: `1px solid ${borderMap[color] || "rgba(99,102,241,0.2)"}`, borderRadius: "10px", p: 1.5 }}>
      <Typography sx={{ fontSize: 11, color: c.t3, textTransform: "uppercase", letterSpacing: 0.8, mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: 19, fontWeight: 700, color }}>{value}</Typography>
    </Box>
  );
};

const QfBtn = ({ label, color, onClick, disabled }) => (
  <Box onClick={!disabled ? onClick : undefined} sx={{
    flex: 1, textAlign: "center", py: 0.55, cursor: disabled ? "default" : "pointer",
    fontSize: 10, fontWeight: 600, borderRadius: "6px", border: `1px solid ${color}35`,
    color: disabled ? "rgba(128,128,128,0.4)" : color,
    "&:hover": !disabled ? { background: `${color}15` } : {},
    transition: "all 0.15s", userSelect: "none",
  }}>{label}</Box>
);

// ── Orders page ───────────────────────────────────────────────────────────────

const OrdersPage = () => {
  const [orders, setOrders] = React.useState([]);
  const userId = localStorage.getItem("user_id");
  const c = useColors();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  React.useEffect(() => {
    if (!userId) return;
    const fetchOrders = () => {
      fetch(`${API_URL}/orders?user_id=${userId}&limit=100`)
        .then((r) => r.json())
        .then((d) => setOrders(d.orders || []))
        .catch(console.error);
    };
    fetchOrders();
    const timer = setInterval(fetchOrders, 3000);
    return () => clearInterval(timer);
  }, [userId]);

  const cancelOrder = async (orderId) => {
    try {
      await fetch(`${API_URL}/orders/${orderId}`, { method: "DELETE" });
      setOrders((prev) => prev.map((o) => o.order_id === orderId ? { ...o, status: "CANCELED" } : o));
    } catch (e) { console.error(e); }
  };

  const statusColor = { FILLED: "#22c55e", RESTING: "#5b8ff9", PARTIAL: "#f5a520", CANCELED: "#888", REJECTED: "#ef4444", NEW: "#a78bfa" };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: c.t1 }}>My Orders</Typography>
      <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "12px", boxShadow: c.shadow, overflow: "hidden" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1.5fr 0.6fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.5fr", px: 2.5, py: 1.5, borderBottom: `1px solid ${c.border}` }}>
          {["Order ID", "Side", "Type", "Qty", "Rem.", "Price", "Status", ""].map((h) => (
            <Typography key={h} sx={{ fontSize: 11, color: c.t3, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</Typography>
          ))}
        </Box>
        {orders.map((o, i) => (
          <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1.5fr 0.6fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.5fr", px: 2.5, py: 1.1, borderBottom: `1px solid ${c.rowBdr}`, alignItems: "center", "&:hover": { background: c.rowHov }, "&:last-child": { borderBottom: "none" } }}>
            <Typography sx={{ fontFamily: "monospace", fontSize: 11, color: c.t3 }}>{o.order_id.slice(0, 10)}…</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: o.side === "BUY" ? "#22c55e" : "#ef4444" }}>{o.side}</Typography>
            <Typography sx={{ fontSize: 12, color: c.t2 }}>{o.type}</Typography>
            <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t1 }}>{o.qty}</Typography>
            <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t1 }}>{o.remaining_qty}</Typography>
            <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: c.t1 }}>{o.price_cents ? `$${(o.price_cents / 100).toFixed(2)}` : "MKT"}</Typography>
            <Box sx={{ display: "inline-flex" }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, px: 1, py: 0.3, borderRadius: "4px",
                background: `${statusColor[o.status] || "#888"}18`, color: statusColor[o.status] || "#888",
                border: `1px solid ${statusColor[o.status] || "#888"}40`, textTransform: "uppercase", letterSpacing: 0.4,
              }}>{o.status}</Typography>
            </Box>
            {["NEW", "RESTING", "PARTIAL"].includes(o.status) ? (
              <Button size="small" onClick={() => cancelOrder(o.order_id)} sx={{ minWidth: 0, px: 1, py: 0.3, fontSize: 10, color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "4px", textTransform: "none", "&:hover": { background: "rgba(239,68,68,0.08)" } }}>✕</Button>
            ) : <Box />}
          </Box>
        ))}
        {!orders.length && <Typography sx={{ py: 5, textAlign: "center", color: c.t3, fontSize: 13 }}>No orders found for this user</Typography>}
      </Box>
    </Box>
  );
};

export default ExchangeDashboard;
