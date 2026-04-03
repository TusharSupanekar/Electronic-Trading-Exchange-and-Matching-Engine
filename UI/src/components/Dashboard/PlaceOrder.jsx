import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import CandleChart from "./CandleChart";

const PlaceOrder = () => {
  const [side, setSide] = useState("BUY");
  const [type, setType] = useState("LIMIT");
  const [symbol, setSymbol] = useState("AAPL");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [candles, setCandles] = useState([]);
  const [book, setBook] = useState({ bids: [], asks: [] });
  const [trades, setTrades] = useState([]);
  const [openModal, setOpenModal] = useState(false);

  const userId = localStorage.getItem("user_id");

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [candlesRes, bookRes, tradesRes] = await Promise.all([
          fetch(`http://localhost:8000/candles?symbol=${symbol}&interval=1m&limit=100`),
          fetch("http://localhost:8000/book/snapshot"),
          fetch("http://localhost:8000/trades"),
        ]);

        const candlesData = await candlesRes.json();
        const bookData = await bookRes.json();
        const tradesData = await tradesRes.json();

        setCandles(Array.isArray(candlesData) ? candlesData : []);
        setBook(bookData || { bids: [], asks: [] });
        setTrades(tradesData?.trades || []);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [symbol]);

  const bids = [...(book.bids || [])].reverse().slice(0, 5);
  const asks = (book.asks || []).slice(0, 5);

  const bestBid = bids.length ? bids[0][0] / 100 : 0;
  const bestAsk = asks.length ? asks[0][0] / 100 : 0;
  const spread = bestBid && bestAsk ? (bestAsk - bestBid).toFixed(2) : "--";
  const lastTrade = trades.length ? trades[trades.length - 1] : null;
  const lastPrice = lastTrade?.price_cents
    ? (lastTrade.price_cents / 100).toFixed(2)
    : "--";

  const total = useMemo(() => {
    const selectedPrice =
      type === "MARKET"
        ? side === "BUY"
          ? bestAsk
          : bestBid
        : Number(price || 0);

    return (Number(qty || 0) * Number(selectedPrice || 0)).toFixed(2);
  }, [qty, price, type, side, bestAsk, bestBid]);

  const openOrderModal = (selectedSide = "BUY") => {
    setSide(selectedSide);
    setOpenModal(true);
  };

  const closeOrderModal = () => {
    setOpenModal(false);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        user_id: userId,
        symbol,
        side,
        type,
        qty: Number(qty),
        price_cents: type === "LIMIT" ? Math.round(Number(price) * 100) : null,
        client_order_id: Date.now().toString(),
      };

      const res = await fetch("http://localhost:8000/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Order failed");

      alert(`${side} order placed successfully`);
      setOpenModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to place order");
    }
  };

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.8fr 0.9fr" },
          gap: 2,
          color: "#fff",
          alignItems: "start",
        }}
      >
        {/* MIDDLE / MAIN SECTION */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* TOP CARD */}
          <Paper sx={cardStyle}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", sm: "center" },
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: { xs: 24, md: 26 }, fontWeight: 700 }}>
                  {symbol}/USD
                </Typography>
                <Typography sx={{ fontSize: { xs: 28, md: 32 }, fontWeight: 700 }}>
                  ${lastPrice}
                </Typography>
              </Box>

              <Button
                variant="contained"
                onClick={() => openOrderModal("BUY")}
                sx={{
                  minWidth: 150,
                  py: 1.1,
                  px: 3,
                  borderRadius: "10px",
                  fontWeight: 700,
                  textTransform: "none",
                  backgroundColor: "#16a34a",
                  boxShadow: "none",
                  "&:hover": {
                    backgroundColor: "#15803d",
                    boxShadow: "none",
                  },
                }}
              >
                Place Order
              </Button>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                gap: 1.2,
                mt: 2,
              }}
            >
              <MiniCard
                label="Best Bid"
                value={bestBid ? `$${bestBid.toFixed(2)}` : "--"}
                color="#22c55e"
              />
              <MiniCard
                label="Best Ask"
                value={bestAsk ? `$${bestAsk.toFixed(2)}` : "--"}
                color="#ef4444"
              />
              <MiniCard
                label="Spread"
                value={spread !== "--" ? `$${spread}` : "--"}
                color="#38bdf8"
              />
              <MiniCard
                label="Last Price"
                value={lastPrice !== "--" ? `$${lastPrice}` : "--"}
                color="#facc15"
              />
            </Box>
          </Paper>

          {/* SMALLER CHART */}
          <Paper sx={{ ...cardStyle, p: 1.5 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1 }}>
              Live Price Chart
            </Typography>

            <Box
              sx={{
                height: { xs: 260, md: 320, lg: 360 },
                width: "100%",
                overflow: "hidden",
              }}
            >
              <CandleChart data={candles} />
            </Box>
          </Paper>
        </Box>

        {/* RIGHT SECTION */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Paper sx={cardStyle}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 2 }}>
              L2 Order Book
            </Typography>

            <Typography sx={{ color: "#22c55e", mb: 1, fontSize: 15,borderBottom: "1px solid rgba(255,255,255,0.06)",}}>
              Bids
            </Typography>
            {bids.map((bid, i) => (
              <Row
                key={i}
                left={`$${(bid[0] / 100).toFixed(2)}`}
                right={bid[1]}
                color="#22c55e"
              />
            ))}

            <Typography sx={{ color: "#ef4444", mt: 2, mb: 1, fontSize: 15,borderBottom: "1px solid rgba(255,255,255,0.06)",}}>
              Asks
            </Typography>
            {asks.map((ask, i) => (
              <Row
                key={i}
                left={`$${(ask[0] / 100).toFixed(2)}`}
                right={ask[1]}
                color="#ef4444"
              />
            ))}
          </Paper>

          <Paper sx={cardStyle}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 2 }}>
              Recent Trades
            </Typography>

            {trades.slice().reverse().slice(0, 8).map((trade, i) => (
              <Box
                key={i}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  py: 0.9,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Typography
                  sx={{
                    color: trade.taker_side === "BUY" ? "#22c55e" : "#ef4444",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  ${(trade.price_cents / 100).toFixed(2)}
                </Typography>
                <Typography sx={{ fontSize: 14 }}>{trade.qty}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                  {trade.taker_side}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Box>
      </Box>

      {/* ORDER MODAL */}
      <Dialog
        open={openModal}
        onClose={closeOrderModal}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreen}
        scroll="paper"
        PaperProps={{
            sx: {
            background: "#111829",
            color: "#fff",
            borderRadius: fullScreen ? 0 : "14px",
            border: "1px solid rgba(99,102,241,0.18)",
            width: "100%",
            maxHeight: fullScreen ? "100dvh" : "90vh",
            overflow: "hidden",
            },
        }}
        >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontWeight: 700,
            pb: 1,
          }}
        >
          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
            Place Order
          </Typography>
          <IconButton onClick={closeOrderModal} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{
                pb: 2.5,
                pt: 1,
                overflow: "hidden",
            }}>
          <ToggleButtonGroup
            value={side}
            exclusive
            onChange={(e, value) => value && setSide(value)}
            fullWidth
            sx={{
                mb: 1.5,
                mt: 0.5,
                "& .MuiToggleButton-root": {
                color: "#fff",
                borderColor: "rgba(255,255,255,0.08)",
                py: 0.9,
                fontWeight: 700,
                },
                "& .Mui-selected": {
                backgroundColor:
                    side === "BUY"
                    ? "#16a34a !important"
                    : "#dc2626 !important",
                },
            }}
            >
            <ToggleButton value="BUY">BUY</ToggleButton>
            <ToggleButton value="SELL">SELL</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            select
            label="Symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            fullWidth
            sx={fieldSx}
            margin="dense"
          >
            <MenuItem value="AAPL">AAPL</MenuItem>
            <MenuItem value="NVDA">NVDA</MenuItem>
            <MenuItem value="INTC">INTC</MenuItem>
          </TextField>

          <TextField
            select
            label="Order Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            fullWidth
            sx={fieldSx}
            margin="dense"
          >
            <MenuItem value="LIMIT">LIMIT</MenuItem>
            <MenuItem value="MARKET">MARKET</MenuItem>
          </TextField>

          <TextField
            label="Quantity"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            fullWidth
            sx={fieldSx}
            margin="dense"
          />

          {/* Qty presets */}
          <Box sx={{ display: 'flex', gap: 0.8, mt: 0.5, mb: 0.5 }}>
            {[1, 5, 10, 50, 100].map(n => (
              <Button key={n} size="small" onClick={() => setQty(n)}
                sx={{ flex: 1, minWidth: 0, py: 0.4, border: '1px solid rgba(255,255,255,0.1)',
                  color: '#888', fontSize: 11, textTransform: 'none', borderRadius: '8px',
                  '&:hover': { border: '1px solid rgba(255,255,255,0.25)', color: '#fff', background: 'rgba(255,255,255,0.05)' }
                }}>
                {n}
              </Button>
            ))}
          </Box>

          {type === "LIMIT" && (
            <>
              <TextField
                label="Price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                fullWidth
                sx={fieldSx}
                margin="dense"
              />
              {/* Quick price fill */}
              <Box sx={{ display: 'flex', gap: 0.8, mt: 0.5, mb: 0.5 }}>
                <Button size="small" onClick={() => setPrice(bestBid.toFixed(2))} disabled={!bestBid}
                  sx={{ flex: 1, py: 0.4, border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e',
                    fontSize: 11, textTransform: 'none', borderRadius: '8px',
                    '&:hover': { background: 'rgba(34,197,94,0.08)' } }}>
                  Bid ${bestBid ? bestBid.toFixed(2) : '--'}
                </Button>
                <Button size="small" onClick={() => bestBid && bestAsk && setPrice(((bestBid + bestAsk) / 2).toFixed(2))} disabled={!bestBid || !bestAsk}
                  sx={{ flex: 1, py: 0.4, border: '1px solid rgba(245,165,32,0.3)', color: '#f5a520',
                    fontSize: 11, textTransform: 'none', borderRadius: '8px',
                    '&:hover': { background: 'rgba(245,165,32,0.08)' } }}>
                  Mid
                </Button>
                <Button size="small" onClick={() => setPrice(bestAsk.toFixed(2))} disabled={!bestAsk}
                  sx={{ flex: 1, py: 0.4, border: '1px solid rgba(240,57,78,0.3)', color: '#ef4444',
                    fontSize: 11, textTransform: 'none', borderRadius: '8px',
                    '&:hover': { background: 'rgba(240,57,78,0.08)' } }}>
                  Ask ${bestAsk ? bestAsk.toFixed(2) : '--'}
                </Button>
              </Box>
            </>
          )}

          <Box sx={{ mt: 2.5, mb: 2 }}>
            <Row left="Best Bid" right={bestBid ? `$${bestBid.toFixed(2)}` : "--"} />
            <Row left="Best Ask" right={bestAsk ? `$${bestAsk.toFixed(2)}` : "--"} />
            <Row left="Spread" right={spread !== "--" ? `$${spread}` : "--"} />
            <Row left="Estimated Total" right={`$${total}`} />
          </Box>

          <Button
            fullWidth
            variant="contained"
            onClick={handleSubmit}
            sx={{
                mt: 0.5,
                py: 1.2,
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: 15,
                textTransform: "none",
                backgroundColor: side === "BUY" ? "#16a34a" : "#dc2626",
                boxShadow: "none",
                "&:hover": {
                backgroundColor: side === "BUY" ? "#15803d" : "#b91c1c",
                boxShadow: "none",
                },
            }}
            >
            {side} {symbol}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

const cardStyle = {
  p: 2,
  borderRadius: "8px",
  background: "#0f1728",
  border: "1px solid rgba(99,102,241,0.18)",
  color: "#fff",
  boxShadow: "none",
};

const MiniCard = ({ label, value, color }) => (
  <Box
    sx={{
      p: 1.1,
      borderRadius: "8px",
      backgroundColor: "rgba(255,255,255,0.04)",
    }}
  >
    <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 15, fontWeight: 700, color }}>
      {value}
    </Typography>
  </Box>
);

const Row = ({ left, right, color = "#fff" }) => (
  <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.7 }}>
    <Typography
      sx={{
        color: color === "#fff" ? "rgba(255,255,255,0.65)" : color,
        fontSize: 14,
      }}
    >
      {left}
    </Typography>
    <Typography sx={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
      {right}
    </Typography>
  </Box>
);

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "#fff",
    borderRadius: "12px",
    backgroundColor: "rgba(255,255,255,0.03)",
    "& fieldset": {
      borderColor: "rgba(255,255,255,0.08)",
    },
    "&:hover fieldset": {
      borderColor: "rgba(255,255,255,0.15)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "#3b82f6",
    },
  },
  "& .MuiInputLabel-root": {
    color: "#94a3b8",
  },
};

export default PlaceOrder;