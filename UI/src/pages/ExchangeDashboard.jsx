import React, { useState, useEffect } from "react";
import { Box, Typography, Drawer, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useTheme } from "@mui/material/styles";
import { useMediaQuery } from "@mui/material";
import TopBar from "../components/Dashboard/TopBar";
import SidePanel from "../components/Dashboard/SidePanel";
import PlaceOrder from "../components/Dashboard/PlaceOrder";
import { TextField, MenuItem } from "@mui/material";

const ExchangeDashboard = () => {
  const [selectedMenu, setSelectedMenu] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const username = localStorage.getItem("username");
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [pnlData, setPnlData] = useState({
    pnl: 0,
    total_buy: 0,
    total_sell: 0,
  });

  const [bookData, setBookData] = useState({
    bids: [],
    asks: [],
  });

  const [trades, setTrades] = useState([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (!userId) return;

    fetch(`http://localhost:8000/pnl?user_id=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setPnlData({
          pnl: data.pnl || 0,
          total_buy: data.total_buy || 0,
          total_sell: data.total_sell || 0,
        });
      })
      .catch((err) => console.error("PnL fetch error:", err));
  }, []);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const [bookRes, tradesRes] = await Promise.all([
          fetch("http://localhost:8000/book/snapshot"),
          fetch("http://localhost:8000/trades"),
        ]);

        const book = await bookRes.json();
        const tradesData = await tradesRes.json();

        setBookData(book || { bids: [], asks: [] });
        setTrades(tradesData?.trades || []);
      } catch (err) {
        console.error("Market fetch error:", err);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleMenuSelect = (menu) => {
    setSelectedMenu(menu);
    if (isMobile) setMobileOpen(false);
  };

  const bids = [...(bookData.bids || [])].reverse();
  const asks = bookData.asks || [];

  const bestBid = bids.length ? bids[0][0] / 100 : 0;
  const bestAsk = asks.length ? asks[0][0] / 100 : 0;
  const spread =
    bestBid && bestAsk ? (bestAsk - bestBid).toFixed(2) : "--";

  const lastTrade = trades.length ? trades[trades.length - 1] : null;
  const lastPrice = lastTrade?.price_cents
    ? (lastTrade.price_cents / 100).toFixed(2)
    : "--";

  const recentTradeCount = trades.length;
  const latestTradeSide = lastTrade?.taker_side || "--";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #07111F 0%, #0B1F36 45%, #102A43 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <TopBar appName="Trading Exchange" onMenuClick={handleDrawerToggle}>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle} sx={{ color: "#fff", mr: 1 }}>
            <MenuIcon />
          </IconButton>
        )}
      </TopBar>

      <Box sx={{ display: "flex", flex: 1, alignItems: "stretch" }}>
        {!isMobile && (
          <SidePanel selected={selectedMenu} onSelect={handleMenuSelect} />
        )}

        {isMobile && (
          <Drawer
            anchor="left"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            PaperProps={{
              sx: {
                width: 260,
                background: "#0f172a",
                color: "#fff",
                borderRight: "1px solid rgba(255,255,255,0.08)",
              },
            }}
          >
            <SidePanel selected={selectedMenu} onSelect={handleMenuSelect} />
          </Drawer>
        )}

        <Box
          sx={{
            flex: 1,
            p: 3,
            color: "#fff",
            background: "linear-gradient(180deg, #020617 0%, #061226 100%)",
          }}
        >
          {selectedMenu === "Dashboard" && (
            <>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
                Hello {username || "Trader"}!
              </Typography>

              {/* Top P&L cards */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "1fr 1fr",
                    md: "repeat(3, 1fr)",
                  },
                  gap: 2,
                  mb: 3,
                }}
              >
                <MetricCard
                  title="Total P&L"
                  value={`$${(pnlData.pnl / 100).toFixed(2)}`}
                  valueColor={pnlData.pnl >= 0 ? "#22c55e" : "#ef4444"}
                  bg="#1e293b"
                />

                <MetricCard
                  title="Total Buy"
                  value={`$${(pnlData.total_buy / 100).toFixed(2)}`}
                  valueColor="#ffffff"
                  bg="#1e293b"
                />

                <MetricCard
                  title="Total Sell"
                  value={`$${(pnlData.total_sell / 100).toFixed(2)}`}
                  valueColor="#ffffff"
                  bg="#9ebdef"
                  titleColor="rgba(255,255,255,0.7)"
                />
              </Box>

              {/* Market Snapshot + Position Summary */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    borderRadius: "18px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    p: 2.5,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>
                      Market Snapshot
                    </Typography>

                    <TextField
                      select
                      size="small"
                      value={selectedSymbol}
                      onChange={(e) => setSelectedSymbol(e.target.value)}
                      sx={{
                        width: 120,
                        "& .MuiOutlinedInput-root": {
                          color: "#fff",
                          borderRadius: "8px",
                          backgroundColor: "rgba(255,255,255,0.04)",
                          "& fieldset": {
                            borderColor: "rgba(255,255,255,0.08)",
                          },
                        },
                      }}
                    >
                      <MenuItem value="AAPL">AAPL</MenuItem>
                      <MenuItem value="NVDA">NVDA</MenuItem>
                      <MenuItem value="INTC">INTC</MenuItem>
                      <MenuItem value="AMD">AMD</MenuItem>
                    </TextField>
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 2,
                    }}
                  >
                    <MiniInfoCard label="Last Price" value={lastPrice !== "--" ? `$${lastPrice}` : "--"} color="#facc15" />
                    <MiniInfoCard label="Best Bid" value={bestBid ? `$${bestBid.toFixed(2)}` : "--"} color="#22c55e" />
                    <MiniInfoCard label="Best Ask" value={bestAsk ? `$${bestAsk.toFixed(2)}` : "--"} color="#ef4444" />
                    <MiniInfoCard label="Spread" value={spread !== "--" ? `$${spread}` : "--"} color="#38bdf8" />
                    <MiniInfoCard label="Recent Trades" value={`${recentTradeCount}`} color="#ffffff" />
                    <MiniInfoCard label="Latest Side" value={latestTradeSide} color={latestTradeSide === "BUY" ? "#22c55e" : latestTradeSide === "SELL" ? "#ef4444" : "#ffffff"} />
                  </Box>
                </Box>

                <Box
                  sx={{
                    borderRadius: "18px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    p: 2.5,
                  }}
                >
                  <Typography sx={{ color: "#fff", fontWeight: 700, mb: 2, fontSize: 22 }}>
                    Position Summary
                  </Typography>

                  <SummaryRow label="Net P&L" value={`$${(pnlData.pnl / 100).toFixed(2)}`} valueColor={pnlData.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                  <SummaryRow label="Total Buy Value" value={`$${(pnlData.total_buy / 100).toFixed(2)}`} />
                  <SummaryRow label="Total Sell Value" value={`$${(pnlData.total_sell / 100).toFixed(2)}`} />
                  <SummaryRow label="Market Last Price" value={lastPrice !== "--" ? `$${lastPrice}` : "--"} />
                  <SummaryRow label="Current Best Bid" value={bestBid ? `$${bestBid.toFixed(2)}` : "--"} />
                  <SummaryRow label="Current Best Ask" value={bestAsk ? `$${bestAsk.toFixed(2)}` : "--"} />
                </Box>
              </Box>
            </>
          )}

          {selectedMenu === "Place Order" && <PlaceOrder />}

          {selectedMenu === "Order Book" && (
            <Typography variant="h5"></Typography>
          )}

          {selectedMenu === "Trades" && (
            <Typography variant="h5"></Typography>
          )}

          {selectedMenu === "Orders" && (
            <Typography variant="h5"></Typography>
          )}

          {selectedMenu === "Logs" && (
            <Typography variant="h5"></Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const MetricCard = ({
  title,
  value,
  valueColor = "#fff",
  bg = "#1e293b",
  titleColor = "rgba(255,255,255,0.6)",
}) => (
  <Box
    sx={{
      p: 2,
      borderRadius: "8px",
      backgroundColor: bg,
      border: "1px solid rgba(255,255,255,0.08)",
    }}
  >
    <Typography sx={{ color: titleColor, fontSize: 14 }}>
      {title}
    </Typography>
    <Typography sx={{ fontSize: 22, fontWeight: 700, color: valueColor }}>
      {value}
    </Typography>
  </Box>
);

const MiniInfoCard = ({ label, value, color = "#fff" }) => (
  <Box
    sx={{
      p: 1.5,
      borderRadius: "10px",
      backgroundColor: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.55)", mb: 0.5 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 18, fontWeight: 700, color }}>
      {value}
    </Typography>
  </Box>
);

const SummaryRow = ({ label, value, valueColor = "#fff" }) => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      py: 1.2,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    <Typography sx={{ fontSize: 15, color: "rgba(255,255,255,0.65)" }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 16, fontWeight: 700, color: valueColor }}>
      {value}
    </Typography>
  </Box>
);

export default ExchangeDashboard;