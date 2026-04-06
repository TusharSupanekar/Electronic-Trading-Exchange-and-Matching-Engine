import React, { useState, useEffect, useMemo } from "react";
import { Box, Typography, Drawer, IconButton, Button, Snackbar, Alert } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useTheme } from "@mui/material/styles";
import { useMediaQuery } from "@mui/material";
import TopBar from "../components/Dashboard/TopBar";
import SidePanel from "../components/Dashboard/SidePanel";
import PlaceOrder from "../components/Dashboard/PlaceOrder";
import CandleChart from "../components/Dashboard/CandleChart";

const ExchangeDashboard = () => {
  const [selectedMenu, setSelectedMenu] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [candles, setCandles] = useState([]);
  const [bookData, setBookData] = useState({ bids: [], asks: [] });
  const [trades, setTrades] = useState([]);
  const [chartInterval, setChartInterval] = useState("1m");
  const [chartType, setChartType] = useState("candle");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // book + trades polling
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const [bookRes, tradesRes] = await Promise.all([
          fetch("http://localhost:8000/book/snapshot"),
          fetch("http://localhost:8000/trades"),
        ]);
        setBookData((await bookRes.json()) || { bids: [], asks: [] });
        setTrades((await tradesRes.json())?.trades || []);
      } catch (err) {
        console.error("Market fetch error:", err);
      }
    };
    fetchMarketData();
    const timer = window.setInterval(fetchMarketData, 2000);
    return () => window.clearInterval(timer);
  }, []);

  // candles — refetch when interval changes
  useEffect(() => {
    const fetchCandles = async () => {
      try {
        const res = await fetch(`http://localhost:8000/candles?symbol=AAPL&interval=${chartInterval}&limit=200`);
        const data = await res.json();
        setCandles(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Candles fetch error:", err);
      }
    };
    fetchCandles();
    const timer = window.setInterval(fetchCandles, 5000);
    return () => window.clearInterval(timer);
  }, [chartInterval]);

  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);
  const handleMenuSelect = (menu) => {
    setSelectedMenu(menu);
    if (isMobile) setMobileOpen(false);
  };

  const bids = [...(bookData.bids || [])].reverse();
  const asks = bookData.asks || [];
  const bestBid = bids.length ? bids[0][0] / 100 : 0;
  const bestAsk = asks.length ? asks[0][0] / 100 : 0;
  const spread = bestBid && bestAsk ? (bestAsk - bestBid).toFixed(2) : "--";
  const lastTrade = trades.length ? trades[trades.length - 1] : null;
  const lastPrice = lastTrade?.price_cents ? (lastTrade.price_cents / 100).toFixed(2) : "--";
  const priceChange =
    candles.length >= 2
      ? ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100
      : null;

  return (
    <Box sx={{ minHeight: "100vh", background: "#07090f", display: "flex", flexDirection: "column" }}>
      <TopBar appName="Trading Exchange" onMenuClick={handleDrawerToggle}>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle} sx={{ color: "#fff", mr: 1 }}>
            <MenuIcon />
          </IconButton>
        )}
      </TopBar>

      <Box sx={{ display: "flex", flex: 1, alignItems: "stretch" }}>
        {!isMobile && <SidePanel selected={selectedMenu} onSelect={handleMenuSelect} />}

        {isMobile && (
          <Drawer
            anchor="left"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: 260, background: "#0c1021", color: "#fff", borderRight: "1px solid rgba(99,102,241,0.18)" } }}
          >
            <SidePanel selected={selectedMenu} onSelect={handleMenuSelect} />
          </Drawer>
        )}

        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, color: "#fff", background: "#07090f", minWidth: 0, overflowY: "auto" }}>

          {/* ── DASHBOARD ── */}
          {selectedMenu === "Dashboard" && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 340px" }, gap: 2, alignItems: "start" }}>

              {/* LEFT COLUMN */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>

                {/* Price header card */}
                <Box sx={{ background: "#0f1728", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "14px", p: 2.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>AAPL/USD</Typography>
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
                  <Typography sx={{ fontSize: 42, fontWeight: 800, lineHeight: 1.1, mb: 2.5 }}>
                    {lastPrice !== "--" ? `$${lastPrice}` : "--"}
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
                    <StatCard label="Best Bid" value={bestBid ? `$${bestBid.toFixed(2)}` : "--"} color="#22c55e" />
                    <StatCard label="Best Ask" value={bestAsk ? `$${bestAsk.toFixed(2)}` : "--"} color="#ef4444" />
                    <StatCard label="Spread" value={spread !== "--" ? `$${spread}` : "--"} color="#38bdf8" />
                  </Box>
                </Box>

                {/* Chart card */}
                <Box sx={{ background: "#0c1628", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "14px", p: 2, overflow: "hidden" }}>
                  {/* Toolbar */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 }}>
                      Live Price Chart
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {/* Interval buttons */}
                      {["1m", "5m", "15m", "30m", "1h"].map((iv) => (
                        <Box key={iv} onClick={() => setChartInterval(iv)} sx={{
                          px: 1.2, py: 0.4, borderRadius: "6px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                          userSelect: "none", transition: "all 0.15s",
                          background: chartInterval === iv ? "rgba(99,102,241,0.2)" : "transparent",
                          color: chartInterval === iv ? "#a5b4fc" : "rgba(255,255,255,0.35)",
                          border: chartInterval === iv ? "1px solid rgba(99,102,241,0.45)" : "1px solid transparent",
                          "&:hover": { color: "#a5b4fc", background: "rgba(99,102,241,0.1)" },
                        }}>
                          {iv.toUpperCase()}
                        </Box>
                      ))}
                      {/* Divider */}
                      <Box sx={{ width: "1px", height: 16, background: "rgba(99,102,241,0.25)", mx: 0.5 }} />
                      {/* Chart type buttons */}
                      {[{ key: "candle", label: "Candle" }, { key: "line", label: "Line" }, { key: "area", label: "Area" }].map(({ key, label }) => (
                        <Box key={key} onClick={() => setChartType(key)} sx={{
                          px: 1.2, py: 0.4, borderRadius: "6px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                          userSelect: "none", transition: "all 0.15s",
                          background: chartType === key ? "rgba(56,189,248,0.15)" : "transparent",
                          color: chartType === key ? "#38bdf8" : "rgba(255,255,255,0.35)",
                          border: chartType === key ? "1px solid rgba(56,189,248,0.3)" : "1px solid transparent",
                          "&:hover": { color: "#38bdf8", background: "rgba(56,189,248,0.08)" },
                        }}>
                          {label}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box sx={{ height: { xs: 260, md: 360, lg: 420 } }}>
                    <CandleChart data={candles} type={chartType} />
                  </Box>
                </Box>
              </Box>

              {/* RIGHT COLUMN */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <InlineOrderPanel bestBid={bestBid} bestAsk={bestAsk} />

                {/* Compact L2 Order Book */}
                <Box sx={{ background: "#0f1728", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "14px", overflow: "hidden" }}>
                  <Typography sx={{ px: 2, py: 1.5, fontWeight: 700, fontSize: 15, borderBottom: "1px solid rgba(99,102,241,0.18)" }}>
                    L2 Order Book
                  </Typography>
                  <Box sx={{ px: 2, pt: 0.5, pb: 1.5 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.65fr", py: 0.8, borderBottom: "1px solid rgba(99,102,241,0.06)" }}>
                      {["Bids", "Side", "Amount", "Total"].map((h) => (
                        <Typography key={h} sx={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 0.7 }}>{h}</Typography>
                      ))}
                    </Box>
                    {[...(bookData.bids || [])].reverse().slice(0, 5).map((bid, i) => (
                      <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.65fr", py: 0.7, borderBottom: "1px solid rgba(99,102,241,0.05)" }}>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#22c55e", fontWeight: 600 }}>${(bid[0] / 100).toFixed(2)}</Typography>
                        <Typography sx={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>Buy</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{bid[1]}</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{((bid[0] / 100) * bid[1]).toFixed(0)}</Typography>
                      </Box>
                    ))}
                    <Box sx={{ my: 0.8, borderTop: "1px solid rgba(99,102,241,0.08)" }} />
                    {(bookData.asks || []).slice(0, 5).map((ask, i) => (
                      <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.65fr", py: 0.7, borderBottom: "1px solid rgba(99,102,241,0.05)" }}>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#ef4444", fontWeight: 600 }}>${(ask[0] / 100).toFixed(2)}</Typography>
                        <Typography sx={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>Sell</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{ask[1]}</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{((ask[0] / 100) * ask[1]).toFixed(0)}</Typography>
                      </Box>
                    ))}
                    {!(bookData.bids || []).length && !(bookData.asks || []).length && (
                      <Typography sx={{ py: 3, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>No orders in book</Typography>
                    )}
                  </Box>
                </Box>

                {/* Compact Recent Trades */}
                <Box sx={{ background: "#0f1728", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "14px", overflow: "hidden" }}>
                  <Typography sx={{ px: 2, py: 1.5, fontWeight: 700, fontSize: 15, borderBottom: "1px solid rgba(99,102,241,0.18)" }}>
                    Recent Trades
                  </Typography>
                  <Box sx={{ px: 2, pt: 0.5, pb: 1.5 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.8fr", py: 0.8, borderBottom: "1px solid rgba(99,102,241,0.06)" }}>
                      {["Price", "Amount", "Seq", "Type"].map((h) => (
                        <Typography key={h} sx={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 0.7 }}>{h}</Typography>
                      ))}
                    </Box>
                    {[...trades].reverse().slice(0, 8).map((t, i) => (
                      <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1fr 0.55fr 0.6fr 0.8fr", py: 0.7, borderBottom: "1px solid rgba(99,102,241,0.05)", "&:last-child": { borderBottom: "none" } }}>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: t.taker_side === "BUY" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                          ${(t.price_cents / 100).toFixed(2)}
                        </Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{t.qty}</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{t.seq ?? "--"}</Typography>
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
                      <Typography sx={{ py: 3, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>No trades yet</Typography>
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
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Order Book — AAPL</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                <Box sx={{ background: "#0f1728", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "12px", overflow: "hidden" }}>
                  <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid rgba(99,102,241,0.18)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ color: "#ef4444", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>Asks</Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{(bookData.asks || []).length} levels</Typography>
                  </Box>
                  <Box sx={{ px: 2.5, py: 1, display: "flex", justifyContent: "space-between" }}>
                    <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8 }}>Price</Typography>
                    <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8 }}>Qty</Typography>
                  </Box>
                  {(bookData.asks || []).map((ask, i) => {
                    const maxQ = Math.max(...(bookData.asks || []).map((a) => a[1]), 1);
                    const pct = Math.round((ask[1] / maxQ) * 100);
                    return (
                      <Box key={i} sx={{ position: "relative", px: 2.5, py: 0.9, display: "flex", justifyContent: "space-between", "&:hover": { background: "rgba(255,255,255,0.025)" } }}>
                        <Box sx={{ position: "absolute", top: 0, right: 0, height: "100%", width: `${pct}%`, background: "rgba(239,68,68,0.08)", pointerEvents: "none" }} />
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#ef4444", fontWeight: 600 }}>${(ask[0] / 100).toFixed(2)}</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#f0f0f0" }}>{ask[1].toLocaleString()}</Typography>
                      </Box>
                    );
                  })}
                  {!(bookData.asks || []).length && <Typography sx={{ py: 4, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No asks</Typography>}
                </Box>

                <Box sx={{ background: "#0f1728", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "12px", overflow: "hidden" }}>
                  <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid rgba(99,102,241,0.18)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ color: "#22c55e", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>Bids</Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{(bookData.bids || []).length} levels</Typography>
                  </Box>
                  <Box sx={{ px: 2.5, py: 1, display: "flex", justifyContent: "space-between" }}>
                    <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8 }}>Price</Typography>
                    <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8 }}>Qty</Typography>
                  </Box>
                  {(bookData.bids || []).map((bid, i) => {
                    const maxQ = Math.max(...(bookData.bids || []).map((b) => b[1]), 1);
                    const pct = Math.round((bid[1] / maxQ) * 100);
                    return (
                      <Box key={i} sx={{ position: "relative", px: 2.5, py: 0.9, display: "flex", justifyContent: "space-between", "&:hover": { background: "rgba(255,255,255,0.025)" } }}>
                        <Box sx={{ position: "absolute", top: 0, right: 0, height: "100%", width: `${pct}%`, background: "rgba(34,197,94,0.08)", pointerEvents: "none" }} />
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#22c55e", fontWeight: 600 }}>${(bid[0] / 100).toFixed(2)}</Typography>
                        <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#f0f0f0" }}>{bid[1].toLocaleString()}</Typography>
                      </Box>
                    );
                  })}
                  {!(bookData.bids || []).length && <Typography sx={{ py: 4, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No bids</Typography>}
                </Box>
              </Box>
            </Box>
          )}

          {/* ── TRADES ── */}
          {selectedMenu === "Trades" && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Recent Trades</Typography>
              <Box sx={{ background: "#0f1728", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "12px", overflow: "hidden" }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", px: 2.5, py: 1.5, borderBottom: "1px solid rgba(99,102,241,0.18)" }}>
                  {["Price", "Qty", "Side", "Seq"].map((h) => (
                    <Typography key={h} sx={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</Typography>
                  ))}
                </Box>
                {[...trades].reverse().slice(0, 40).map((t, i) => (
                  <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", px: 2.5, py: 1, borderBottom: "1px solid rgba(255,255,255,0.04)", "&:hover": { background: "rgba(255,255,255,0.02)" }, "&:last-child": { borderBottom: "none" } }}>
                    <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: t.taker_side === "BUY" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>${(t.price_cents / 100).toFixed(2)}</Typography>
                    <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#f0f0f0" }}>{t.qty}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: t.taker_side === "BUY" ? "#22c55e" : "#ef4444" }}>{t.taker_side || "—"}</Typography>
                    <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{t.seq}</Typography>
                  </Box>
                ))}
                {!trades.length && <Typography sx={{ py: 5, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No trades yet</Typography>}
              </Box>
            </Box>
          )}

          {/* ── ORDERS ── */}
          {selectedMenu === "Orders" && <OrdersPage />}

          {/* ── LOGS ── */}
          {selectedMenu === "Logs" && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Activity Log</Typography>
              <Box sx={{ background: "#0f1728", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "12px", p: 2.5 }}>
                <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.35)", mb: 1 }}>
                  [{new Date().toLocaleTimeString()}] Dashboard loaded
                </Typography>
                <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "#22c55e", mb: 1 }}>
                  [{new Date().toLocaleTimeString()}] WebSocket market feed active
                </Typography>
                <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
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

  const showNotification = (message, severity = "success") => {
    setNotification({
      open: true,
      message,
      severity,
    });
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
      const res = await fetch("http://localhost:8000/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          symbol: "AAPL",
          side,
          type: orderType,
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
      const res = await fetch(`http://localhost:8000/orders?user_id=${userId}&status=resting&limit=50`);
      const data = await res.json();
      await Promise.all((data.orders || []).map((o) =>
        fetch(`http://localhost:8000/orders/${o.order_id}`, { method: "DELETE" })
      ));
      showNotification("All active orders cancelled", "success");
    } catch {
      showNotification("Failed to cancel orders", "error");
    }
  };

  return (
    <>
      <Box sx={{ background: "#0f1728", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "14px", p: 2 }}>
        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Order Placement</Typography>
          <Box onClick={cancelAll} sx={{ px: 1.4, py: 0.4, borderRadius: "6px", cursor: "pointer", fontSize: 11, fontWeight: 600,
            border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
            "&:hover": { background: "rgba(239,68,68,0.08)" }, transition: "all 0.15s",
          }}>
            Cancel All
          </Box>
        </Box>

        {/* Buy / Sell */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "10px", overflow: "hidden", mb: 1.5 }}>
          {["BUY", "SELL"].map((s) => (
            <Box key={s} onClick={() => setSide(s)} sx={{
              py: 1, textAlign: "center", cursor: "pointer", fontWeight: 700, fontSize: 14, userSelect: "none",
              background: side === s ? (s === "BUY" ? "#16a34a" : "#dc2626") : "transparent",
              color: side === s ? "#fff" : "rgba(255,255,255,0.35)",
              transition: "all 0.15s",
            }}>
              {s}
            </Box>
          ))}
        </Box>

        {/* Order type tabs */}
        <Box sx={{ display: "flex", gap: 0.6, mb: 1.5 }}>
          {["LIMIT", "MARKET"].map((t) => (
            <Box key={t} onClick={() => setOrderType(t)} sx={{
              px: 1.5, py: 0.55, borderRadius: "7px", cursor: "pointer", fontSize: 12, fontWeight: 600, userSelect: "none",
              background: orderType === t ? "rgba(99,102,241,0.2)" : "transparent",
              color: orderType === t ? "#fff" : "rgba(255,255,255,0.38)",
              border: orderType === t ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
              transition: "all 0.15s",
            }}>
              {t}
            </Box>
          ))}
        </Box>

        {/* Price */}
        {orderType === "LIMIT" && (
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)", mb: 0.6, textTransform: "uppercase", letterSpacing: 0.7 }}>Price</Typography>
            <Box sx={{ position: "relative" }}>
              <Typography sx={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.45)", fontSize: 15, pointerEvents: "none" }}>$</Typography>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                style={{
                  width: "100%", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: "9px", padding: "10px 12px 10px 26px", color: "#fff", fontSize: "17px", fontWeight: 700,
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

        {/* Amount */}
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)", mb: 0.6, textTransform: "uppercase", letterSpacing: 0.7 }}>Amount</Typography>
          <Box sx={{ display: "flex", alignItems: "center", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "9px", overflow: "hidden" }}>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", padding: "10px 12px", color: "#fff", fontSize: "17px", fontWeight: 700, outline: "none" }}
            />
            <Typography sx={{ px: 1.5, fontSize: 12, color: "rgba(255,255,255,0.35)", borderLeft: "1px solid rgba(99,102,241,0.18)", py: 1.3 }}>shares</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.6, mt: 0.8 }}>
            {[1, 5, 10, 50, 100].map((n) => (
              <Box key={n} onClick={() => setQty(String(n))} sx={{
                flex: 1, textAlign: "center", py: 0.55, cursor: "pointer", fontSize: 11, fontWeight: 600,
                borderRadius: "6px", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.45)",
                "&:hover": { border: "1px solid rgba(255,255,255,0.22)", color: "#fff", background: "rgba(99,102,241,0.06)" },
                transition: "all 0.15s", userSelect: "none",
              }}>
                {n}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Estimated cost */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.2, borderTop: "1px solid rgba(99,102,241,0.18)", mb: 1.5 }}>
          <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Estimated Cost</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>${estimatedTotal}</Typography>
        </Box>

        {/* Submit */}
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
          sx={{
            width: "100%",
            fontWeight: 600,
            borderRadius: "10px",
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

// ── Small helper components ───────────────────────────────────────────────────

const StatCard = ({ label, value, color = "#fff" }) => {
  const bgMap = { "#22c55e": "rgba(34,197,94,0.08)", "#ef4444": "rgba(239,68,68,0.08)", "#38bdf8": "rgba(56,189,248,0.08)" };
  const borderMap = { "#22c55e": "rgba(34,197,94,0.25)", "#ef4444": "rgba(239,68,68,0.25)", "#38bdf8": "rgba(56,189,248,0.25)" };
  return (
    <Box sx={{ background: bgMap[color] || "rgba(99,102,241,0.06)", border: `1px solid ${borderMap[color] || "rgba(99,102,241,0.2)"}`, borderRadius: "10px", p: 1.5 }}>
      <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8, mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: 19, fontWeight: 700, color }}>{value}</Typography>
    </Box>
  );
};

const QfBtn = ({ label, color, onClick, disabled }) => (
  <Box onClick={!disabled ? onClick : undefined} sx={{
    flex: 1, textAlign: "center", py: 0.55, cursor: disabled ? "default" : "pointer",
    fontSize: 10, fontWeight: 600, borderRadius: "6px",
    border: `1px solid ${color}35`,
    color: disabled ? "rgba(255,255,255,0.2)" : color,
    "&:hover": !disabled ? { background: `${color}15` } : {},
    transition: "all 0.15s", userSelect: "none",
  }}>
    {label}
  </Box>
);

// ── Orders page ───────────────────────────────────────────────────────────────

const OrdersPage = () => {
  const [orders, setOrders] = React.useState([]);
  const userId = localStorage.getItem("user_id");

  React.useEffect(() => {
    if (!userId) return;
    fetch(`http://localhost:8000/orders?user_id=${userId}&limit=50`)
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(console.error);
  }, [userId]);

  const cancelOrder = async (orderId) => {
    try {
      await fetch(`http://localhost:8000/orders/${orderId}`, { method: "DELETE" });
      setOrders((prev) => prev.map((o) => o.order_id === orderId ? { ...o, status: "CANCELED" } : o));
    } catch (e) {
      console.error(e);
    }
  };

  const statusColor = { FILLED: "#22c55e", RESTING: "#5b8ff9", PARTIAL: "#f5a520", CANCELED: "#888", REJECTED: "#ef4444", NEW: "#a78bfa" };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>My Orders</Typography>
      <Box sx={{ background: "#0f1728", border: "1px solid rgba(99,102,241,0.18)", borderRadius: "12px", overflow: "hidden" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1.5fr 0.6fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.5fr", px: 2.5, py: 1.5, borderBottom: "1px solid rgba(99,102,241,0.18)" }}>
          {["Order ID", "Side", "Type", "Qty", "Rem.", "Price", "Status", ""].map((h) => (
            <Typography key={h} sx={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</Typography>
          ))}
        </Box>
        {orders.map((o, i) => (
          <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1.5fr 0.6fr 0.7fr 0.7fr 0.7fr 0.8fr 0.8fr 0.5fr", px: 2.5, py: 1.1, borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center", "&:hover": { background: "rgba(255,255,255,0.02)" }, "&:last-child": { borderBottom: "none" } }}>
            <Typography sx={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{o.order_id.slice(0, 10)}…</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: o.side === "BUY" ? "#22c55e" : "#ef4444" }}>{o.side}</Typography>
            <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{o.type}</Typography>
            <Typography sx={{ fontFamily: "monospace", fontSize: 12 }}>{o.qty}</Typography>
            <Typography sx={{ fontFamily: "monospace", fontSize: 12 }}>{o.remaining_qty}</Typography>
            <Typography sx={{ fontFamily: "monospace", fontSize: 12 }}>{o.price_cents ? `$${(o.price_cents / 100).toFixed(2)}` : "MKT"}</Typography>
            <Box sx={{ display: "inline-flex" }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, px: 1, py: 0.3, borderRadius: "4px", background: `${statusColor[o.status] || "#888"}18`, color: statusColor[o.status] || "#888", border: `1px solid ${statusColor[o.status] || "#888"}40`, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {o.status}
              </Typography>
            </Box>
            {["NEW", "RESTING", "PARTIAL"].includes(o.status) ? (
              <Button size="small" onClick={() => cancelOrder(o.order_id)} sx={{ minWidth: 0, px: 1, py: 0.3, fontSize: 10, color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "4px", textTransform: "none", "&:hover": { background: "rgba(239,68,68,0.08)" } }}>✕</Button>
            ) : <Box />}
          </Box>
        ))}
        {!orders.length && <Typography sx={{ py: 5, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No orders found for this user</Typography>}
      </Box>
    </Box>
  );
};

export default ExchangeDashboard;