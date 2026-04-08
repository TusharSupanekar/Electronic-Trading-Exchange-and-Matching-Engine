import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, CircularProgress, Chip, Divider, Tooltip,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import InventoryIcon from "@mui/icons-material/Inventory";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SpeedIcon from "@mui/icons-material/Speed";

import {
  getWallet, getHoldings, getPnl, getBookSnapshot, getRecentTrades,
} from "../../api/exchangeApi";
import useColors from "../../theme/useColors.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtUSD = (val) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val ?? 0);

const fmtPct = (val) =>
  (val >= 0 ? "+" : "") + (val ?? 0).toFixed(2) + "%";

const pnlColor = (val) => (val >= 0 ? "#22c55e" : "#ef4444");
const pnlBg   = (val) => (val >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)");

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, sub, subColor, accent, c }) {
  return (
    <Box sx={{
      background: c.cardBg,
      border: `1px solid ${accent ? accent + "44" : c.border}`,
      borderRadius: "14px",
      p: { xs: 1.75, md: 2.5 },
      boxShadow: accent ? `0 0 18px ${accent}18` : c.shadow,
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Box sx={{ color: accent || "#6366f1", fontSize: { xs: 18, md: 22 } }}>{icon}</Box>
        <Typography variant="overline" sx={{ color: c.t3, letterSpacing: 1.2, fontSize: { xs: 10, md: 11 } }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: { xs: 18, sm: 22, md: 26 }, fontWeight: 800, color: c.t1, lineHeight: 1.1 }}>
        {value}
      </Typography>
      {sub !== undefined && (
        <Typography sx={{ fontSize: { xs: 11, md: 12 }, mt: 0.5, color: subColor || c.t3 }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

function AllocationBar({ label, pct, color, c }) {
  return (
    <Box sx={{ mb: 1.5, minWidth: 0 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, color: c.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{label}</Typography>
        <Typography sx={{ fontSize: 13, color, fontWeight: 700, flexShrink: 0 }}>{pct.toFixed(1)}%</Typography>
      </Box>
      <Box sx={{ height: 6, background: c.trackBg, borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{
          height: "100%", width: `${Math.min(pct, 100)}%`,
          background: color, borderRadius: 3,
          transition: "width 0.6s ease",
        }} />
      </Box>
    </Box>
  );
}

// ── Main Portfolio Component ──────────────────────────────────────────────────

const Portfolio = () => {
  const userId = localStorage.getItem("user_id");
  const c = useColors();

  const [wallet, setWallet]       = useState(null);
  const [holdings, setHoldings]   = useState([]);
  const [pnl, setPnl]             = useState(null);
  const [snapshot, setSnapshot]   = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [w, h, p, snap, trades] = await Promise.all([
        getWallet(userId),
        getHoldings(userId),
        getPnl(userId),
        getBookSnapshot(1),
        getRecentTrades(50),
      ]);
      setWallet(w);
      setHoldings(Array.isArray(h) ? h : []);
      setPnl(p);
      setSnapshot(snap);
      setRecentTrades((trades?.trades || []).filter(
        (t) => t.taker_user_id === String(userId) || t.maker_user_id === String(userId)
      ).slice(0, 10));
    } catch (e) {
      console.error("Portfolio load error:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (!userId) {
    return (
      <Box sx={{ p: 4, color: "#f87171" }}>Please log in to view your portfolio.</Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  // ── Derived calculations ───────────────────────────────────────────────────
  const cashBalance = (wallet?.balance_cents ?? 0) / 100;

  const bestBid = snapshot?.bids?.[0]?.[0] ?? 0;
  const bestAsk = snapshot?.asks?.[0]?.[0] ?? 0;
  const currentPrice = bestBid && bestAsk
    ? (bestBid + bestAsk) / 200
    : bestBid / 100 || bestAsk / 100;

  const enriched = holdings.map((h) => {
    const price = currentPrice || h.avg_price;
    const marketValue = h.quantity * price;
    const costBasis   = h.quantity * h.avg_price;
    const unrealizedPnl = marketValue - costBasis;
    const unrealizedPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
    return { ...h, currentPrice: price, marketValue, costBasis, unrealizedPnl, unrealizedPct };
  });

  const totalStockValue   = enriched.reduce((s, h) => s + h.marketValue, 0);
  const totalCostBasis    = enriched.reduce((s, h) => s + h.costBasis,   0);
  const totalUnrealized   = enriched.reduce((s, h) => s + h.unrealizedPnl, 0);
  const totalPortfolio    = cashBalance + totalStockValue;
  const realizedPnl       = pnl?.pnl ?? 0;
  const totalPnl          = realizedPnl + totalUnrealized;

  const totalShares = enriched.reduce((s, h) => s + h.quantity, 0);
  const numPositions = enriched.length;

  const best  = enriched.reduce((a, b) => (b.unrealizedPct > (a?.unrealizedPct ?? -Infinity) ? b : a), null);
  const worst = enriched.reduce((a, b) => (b.unrealizedPct < (a?.unrealizedPct ?? Infinity) ? b : a), null);

  const allocSlices = [
    { label: "Cash", value: cashBalance, color: "#6366f1" },
    ...enriched.map((h) => ({ label: h.symbol, value: h.marketValue, color: "#22c55e" })),
  ];
  const allocTotal = allocSlices.reduce((s, a) => s + a.value, 0) || 1;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", display: "flex", flexDirection: "column", gap: 2.5 }}>

      {/* ── Header ── */}
      <Box>
        <Typography sx={{ fontSize: 24, fontWeight: 800, color: c.t1 }}>
          My Portfolio
        </Typography>
        <Typography sx={{ fontSize: 13, color: c.t3, mt: 0.25 }}>
          Live snapshot · prices update on refresh
        </Typography>
      </Box>

      {/* ── Summary Cards ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: { xs: 1.5, md: 2 } }}>
        <SummaryCard c={c}
          icon={<ShowChartIcon />}
          label="Total Portfolio Value"
          value={fmtUSD(totalPortfolio)}
          sub={totalCostBasis > 0 ? `Cost basis: ${fmtUSD(totalCostBasis + cashBalance)}` : "No invested positions"}
          accent="#6366f1"
        />
        <SummaryCard c={c}
          icon={<AccountBalanceWalletIcon />}
          label="Available Cash"
          value={fmtUSD(cashBalance)}
          sub={totalPortfolio > 0 ? `${((cashBalance / totalPortfolio) * 100).toFixed(1)}% of portfolio` : undefined}
          accent="#38bdf8"
        />
        <SummaryCard c={c}
          icon={<InventoryIcon />}
          label="Invested Amount"
          value={fmtUSD(totalCostBasis)}
          sub={`${numPositions} position${numPositions !== 1 ? "s" : ""} · ${totalShares} share${totalShares !== 1 ? "s" : ""}`}
          accent="#a78bfa"
        />
        <SummaryCard c={c}
          icon={totalPnl >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
          label="Overall P&L"
          value={fmtUSD(totalPnl)}
          sub={totalCostBasis > 0 ? fmtPct((totalPnl / totalCostBasis) * 100) + " total return" : undefined}
          subColor={pnlColor(totalPnl)}
          accent={totalPnl >= 0 ? "#22c55e" : "#ef4444"}
        />
      </Box>

      {/* ── Holdings Table + Allocation ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 280px" }, gap: 2 }}>

        {/* Holdings Table */}
        <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "14px", p: { xs: 1.75, md: 2.5 }, boxShadow: c.shadow, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: c.t1, mb: 2 }}>
            Current Holdings
          </Typography>

          {enriched.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <InventoryIcon sx={{ fontSize: 40, color: c.t4, mb: 1 }} />
              <Typography sx={{ color: c.t3, fontSize: 14 }}>
                No open positions yet. Place a buy order to get started.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <Box sx={{ minWidth: 620 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "100px 70px 110px 110px 110px 130px 90px", gap: 1, pb: 1, mb: 1, borderBottom: `1px solid ${c.rowBdr}` }}>
                  {["Symbol", "Shares", "Avg Price", "Cur. Price", "Mkt Value", "Unreal. P&L", "P&L %"].map((h) => (
                    <Typography key={h} sx={{ fontSize: 11, fontWeight: 600, color: c.t3, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      {h}
                    </Typography>
                  ))}
                </Box>
                {enriched.map((h) => (
                  <Box key={h.symbol} sx={{
                    display: "grid", gridTemplateColumns: "100px 70px 110px 110px 110px 130px 90px",
                    gap: 1, py: 1.25, alignItems: "center",
                    borderBottom: `1px solid ${c.rowBdr}`,
                    "&:last-child": { borderBottom: "none" },
                    "&:hover": { background: c.rowHov },
                  }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
                      <Typography sx={{ fontWeight: 700, color: c.t1, fontSize: 14 }}>{h.symbol}</Typography>
                    </Box>
                    <Typography sx={{ color: c.t1, fontSize: 14 }}>{h.quantity}</Typography>
                    <Typography sx={{ color: c.t2, fontSize: 13 }}>{fmtUSD(h.avg_price)}</Typography>
                    <Typography sx={{ color: c.t1, fontSize: 14, fontWeight: 600 }}>
                      {currentPrice ? fmtUSD(h.currentPrice) : "—"}
                    </Typography>
                    <Typography sx={{ color: c.t1, fontSize: 14 }}>{fmtUSD(h.marketValue)}</Typography>
                    <Typography sx={{ color: pnlColor(h.unrealizedPnl), fontSize: 14, fontWeight: 600 }}>
                      {h.unrealizedPnl >= 0 ? "+" : ""}{fmtUSD(h.unrealizedPnl)}
                    </Typography>
                    <Box sx={{ px: 1, py: 0.3, borderRadius: "6px", background: pnlBg(h.unrealizedPct), display: "inline-flex", justifyContent: "center" }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: pnlColor(h.unrealizedPct) }}>
                        {fmtPct(h.unrealizedPct)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {/* Asset Allocation */}
        <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "14px", p: { xs: 1.75, md: 2.5 }, boxShadow: c.shadow, minWidth: 0, overflow: "hidden" }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: c.t1, mb: 2 }}>
            Asset Allocation
          </Typography>
          {allocTotal <= 0.01 ? (
            <Typography sx={{ color: c.t3, fontSize: 13 }}>
              No assets to display yet.
            </Typography>
          ) : (
            allocSlices.map((s, i) => (
              <AllocationBar
                key={s.label}
                label={s.label}
                pct={(s.value / allocTotal) * 100}
                color={["#6366f1", "#22c55e", "#f59e0b", "#38bdf8", "#a78bfa"][i % 5]}
                c={c}
              />
            ))
          )}

          <Divider sx={{ borderColor: c.border, my: 2 }} />

          {/* Quick Stats */}
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: c.t1, mb: 1.5 }}>
            Quick Stats
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {[
              { label: "Open Positions",    value: numPositions },
              { label: "Total Shares Held", value: totalShares },
              { label: "Stock Value",        value: fmtUSD(totalStockValue) },
              { label: "Buying Power",       value: fmtUSD(cashBalance) },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, color: c.t3, flexShrink: 0 }}>{label}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: c.t1, textAlign: "right" }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── P&L Breakdown + Best/Worst ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>

        {/* P&L Breakdown */}
        <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "14px", p: { xs: 1.75, md: 2.5 }, boxShadow: c.shadow }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <SpeedIcon sx={{ color: "#6366f1", fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: c.t1 }}>P&L Breakdown</Typography>
          </Box>

          {[
            { label: "Realized P&L",   value: realizedPnl,     tooltip: "Profit/loss from fully closed trades" },
            { label: "Unrealized P&L", value: totalUnrealized, tooltip: "Open position gain/loss at current price" },
            { label: "Total P&L",      value: totalPnl,        tooltip: "Realized + unrealized combined", bold: true },
          ].map(({ label, value, tooltip, bold }) => (
            <React.Fragment key={label}>
              <Tooltip title={tooltip} placement="right">
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.25,
                  borderBottom: label !== "Total P&L" ? `1px solid ${c.rowBdr}` : "none" }}>
                  <Typography sx={{ fontSize: 14, color: bold ? c.t1 : c.t2, fontWeight: bold ? 700 : 400 }}>
                    {label}
                  </Typography>
                  <Box sx={{ px: 1.2, py: 0.3, borderRadius: "8px", background: pnlBg(value) }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: pnlColor(value) }}>
                      {value >= 0 ? "+" : ""}{fmtUSD(value)}
                    </Typography>
                  </Box>
                </Box>
              </Tooltip>
            </React.Fragment>
          ))}

          <Divider sx={{ borderColor: c.border, my: 2 }} />
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 13, color: c.t3 }}>Total Buy Volume</Typography>
            <Typography sx={{ fontSize: 13, color: c.t1, fontWeight: 600 }}>{fmtUSD(pnl?.total_buy ?? 0)}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
            <Typography sx={{ fontSize: 13, color: c.t3 }}>Total Sell Volume</Typography>
            <Typography sx={{ fontSize: 13, color: c.t1, fontWeight: 600 }}>{fmtUSD(pnl?.total_sell ?? 0)}</Typography>
          </Box>
        </Box>

        {/* Best / Worst + Performance Highlights */}
        <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "14px", p: { xs: 1.75, md: 2.5 }, boxShadow: c.shadow }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <EmojiEventsIcon sx={{ color: "#f59e0b", fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: c.t1 }}>Performance Highlights</Typography>
          </Box>

          {enriched.length === 0 ? (
            <Typography sx={{ color: c.t3, fontSize: 13 }}>
              No positions to analyze yet.
            </Typography>
          ) : (
            <>
              {best && (
                <Box sx={{ p: 1.5, borderRadius: "10px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", mb: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <TrendingUpIcon sx={{ color: "#22c55e", fontSize: 18 }} />
                    <Typography sx={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>BEST POSITION</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: c.t1, fontSize: 15 }}>{best.symbol}</Typography>
                  <Typography sx={{ fontSize: 13, color: "#22c55e" }}>
                    {fmtPct(best.unrealizedPct)} · {fmtUSD(best.unrealizedPnl)}
                  </Typography>
                </Box>
              )}

              {worst && worst.symbol !== best?.symbol && (
                <Box sx={{ p: 1.5, borderRadius: "10px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", mb: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <TrendingDownIcon sx={{ color: "#ef4444", fontSize: 18 }} />
                    <Typography sx={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>WORST POSITION</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: c.t1, fontSize: 15 }}>{worst.symbol}</Typography>
                  <Typography sx={{ fontSize: 13, color: "#ef4444" }}>
                    {fmtPct(worst.unrealizedPct)} · {fmtUSD(worst.unrealizedPnl)}
                  </Typography>
                </Box>
              )}

              <Box sx={{ p: 1.5, borderRadius: "10px", background: c.accentBg, border: `1px solid ${c.accentBorder}` }}>
                <Typography sx={{ fontSize: 12, color: c.accentText, fontWeight: 600, mb: 0.5 }}>PORTFOLIO HEALTH</Typography>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                  <Typography sx={{ fontSize: 13, color: c.t2 }}>Stock Exposure</Typography>
                  <Typography sx={{ fontSize: 13, color: c.t1, fontWeight: 600 }}>
                    {totalPortfolio > 0 ? ((totalStockValue / totalPortfolio) * 100).toFixed(1) : 0}%
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                  <Typography sx={{ fontSize: 13, color: c.t2 }}>Cash Exposure</Typography>
                  <Typography sx={{ fontSize: 13, color: c.t1, fontWeight: 600 }}>
                    {totalPortfolio > 0 ? ((cashBalance / totalPortfolio) * 100).toFixed(1) : 100}%
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                  <Typography sx={{ fontSize: 13, color: c.t2 }}>Avg Position Size</Typography>
                  <Typography sx={{ fontSize: 13, color: c.t1, fontWeight: 600 }}>
                    {numPositions > 0 ? fmtUSD(totalStockValue / numPositions) : "—"}
                  </Typography>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* ── Recent Trade Activity ── */}
      <Box sx={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: "14px", p: { xs: 1.75, md: 2.5 }, boxShadow: c.shadow }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <SwapHorizIcon sx={{ color: "#6366f1", fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: c.t1 }}>Recent Trade Activity</Typography>
        </Box>

        {recentTrades.length === 0 ? (
          <Typography sx={{ color: c.t3, fontSize: 14, py: 2, textAlign: "center" }}>
            No trades found for your account yet.
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <Box sx={{ minWidth: 480 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 70px 1fr", gap: 2, pb: 1, borderBottom: `1px solid ${c.rowBdr}` }}>
                {["Symbol", "Side", "Price", "Qty", "Value"].map((h) => (
                  <Typography key={h} sx={{ fontSize: 11, color: c.t3, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.8 }}>
                    {h}
                  </Typography>
                ))}
              </Box>
              {recentTrades.map((t, i) => {
                const isTaker  = String(t.taker_user_id) === String(userId);
                const side     = isTaker ? t.taker_side : t.maker_side;
                const isBuy    = side === "BUY";
                const price    = (t.price_cents / 100).toFixed(2);
                const value    = (t.price_cents * t.qty / 100).toFixed(2);
                return (
                  <Box key={t.trade_id || i} sx={{
                    display: "grid", gridTemplateColumns: "80px 90px 1fr 70px 1fr",
                    gap: 2, py: 1.1, alignItems: "center",
                    borderBottom: i < recentTrades.length - 1 ? `1px solid ${c.rowBdr}` : "none",
                    "&:hover": { background: c.rowHov },
                  }}>
                    <Typography sx={{ fontWeight: 700, color: c.t1, fontSize: 13 }}>{t.symbol}</Typography>
                    <Chip label={side || "TRADE"} size="small" sx={{
                      background: isBuy ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: isBuy ? "#22c55e" : "#ef4444",
                      fontWeight: 700, fontSize: 11, height: 22, width: "fit-content",
                    }} />
                    <Typography sx={{ color: c.t1, fontSize: 13 }}>${price}</Typography>
                    <Typography sx={{ color: c.t2, fontSize: 13 }}>{t.qty}</Typography>
                    <Typography sx={{ color: c.t1, fontSize: 13, fontWeight: 600 }}>${value}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>

    </Box>
  );
};

export default Portfolio;
