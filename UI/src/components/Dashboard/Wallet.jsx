import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Divider, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, ToggleButton, ToggleButtonGroup, Alert,
  CircularProgress, Tooltip,
} from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

import {
  getWallet, depositFunds, withdrawFunds, getTransactions,
  getPaymentMethods, addPaymentMethod, deletePaymentMethod,
  setDefaultPaymentMethod,
} from "../../api/exchangeApi";

const fmtUSD = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

const cardSx = {
  background: "#0f1728",
  border: "1px solid rgba(99,102,241,0.18)",
  borderRadius: "14px",
  p: { xs: 1.5, sm: 2.5 },
};

// ── Add Payment Method Dialog ─────────────────────────────────────────────────
function AddMethodDialog({ open, onClose, onAdded, userId }) {
  const [type, setType] = useState("BANK");
  const [form, setForm] = useState({ bank_name: "", account_mask: "", provider: "", last4: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setType("BANK");
    setForm({ bank_name: "", account_mask: "", provider: "", last4: "" });
    setError("");
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    setError("");
    if (type === "BANK" && (!form.bank_name || !form.account_mask)) {
      setError("Bank name and account number are required.");
      return;
    }
    if (type === "CARD" && (!form.provider || form.last4.length !== 4)) {
      setError("Provider and 4-digit last4 are required.");
      return;
    }
    setLoading(true);
    try {
      await addPaymentMethod(userId, { method_type: type, ...form });
      onAdded();
      handleClose();
    } catch {
      setError("Failed to add payment method.");
    } finally {
      setLoading(false);
    }
  };

  const inputSx = { color: "#e0e7ff", "& fieldset": { borderColor: "rgba(99,102,241,0.3)" } };
  const labelSx = { sx: { color: "rgba(255,255,255,0.5)" } };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs"
      PaperProps={{ sx: { background: "#0f1728", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "16px" } }}>
      <DialogTitle sx={{ color: "#e0e7ff", fontWeight: 700 }}>Add Payment Method</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
        <ToggleButtonGroup exclusive value={type} onChange={(_, v) => v && setType(v)}
          sx={{ "& .MuiToggleButton-root": { color: "rgba(255,255,255,0.5)", borderColor: "rgba(99,102,241,0.3)", "&.Mui-selected": { background: "rgba(99,102,241,0.18)", color: "#818cf8" } } }}>
          <ToggleButton value="BANK"><AccountBalanceIcon sx={{ mr: 1 }} />Bank Account</ToggleButton>
          <ToggleButton value="CARD"><CreditCardIcon sx={{ mr: 1 }} />Debit / Credit Card</ToggleButton>
        </ToggleButtonGroup>

        {type === "BANK" ? (
          <>
            <TextField label="Bank Name" value={form.bank_name}
              onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
              fullWidth InputLabelProps={labelSx} InputProps={{ sx: inputSx }} />
            <TextField label="Account Number" value={form.account_mask}
              onChange={(e) => setForm((f) => ({ ...f, account_mask: e.target.value }))}
              fullWidth InputLabelProps={labelSx} InputProps={{ sx: inputSx }} />
          </>
        ) : (
          <>
            <TextField label="Card Provider (Visa, Mastercard...)" value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              fullWidth InputLabelProps={labelSx} InputProps={{ sx: inputSx }} />
            <TextField label="Last 4 digits" value={form.last4}
              onChange={(e) => setForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
              fullWidth inputProps={{ maxLength: 4 }} InputLabelProps={labelSx} InputProps={{ sx: inputSx }} />
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}
          sx={{ background: "linear-gradient(135deg,#6366f1,#818cf8)", borderRadius: "8px" }}>
          {loading ? <CircularProgress size={18} color="inherit" /> : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Deposit / Withdraw Dialog ─────────────────────────────────────────────────
function FundsDialog({ open, mode, onClose, onDone, userId, paymentMethods }) {
  const [amountStr, setAmountStr] = useState("");
  const [selectedPm, setSelectedPm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmountStr("");
      setError("");
      const def = paymentMethods.find((m) => m.is_default) || paymentMethods[0];
      setSelectedPm(def?.payment_method_id ?? null);
    }
  }, [open, paymentMethods]);

  const handleSubmit = async () => {
    const cents = Math.round(parseFloat(amountStr) * 100);
    if (!amountStr || isNaN(cents) || cents <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const ref = "pm_" + (selectedPm ?? "manual");
      if (mode === "deposit") await depositFunds(userId, cents, ref);
      else await withdrawFunds(userId, cents, ref);
      onDone();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || (mode === "deposit" ? "Deposit failed." : "Insufficient funds."));
    } finally {
      setLoading(false);
    }
  };

  const isDeposit = mode === "deposit";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"
      PaperProps={{ sx: { background: "#0f1728", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "16px" } }}>
      <DialogTitle sx={{ color: "#e0e7ff", fontWeight: 700 }}>
        {isDeposit ? "Deposit Funds" : "Withdraw Funds"}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
        <TextField label="Amount (USD)" type="number" value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)} fullWidth
          InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
          InputProps={{
            sx: { color: "#e0e7ff", "& fieldset": { borderColor: "rgba(99,102,241,0.3)" } },
            startAdornment: <Typography sx={{ color: "rgba(255,255,255,0.5)", mr: 0.5 }}>$</Typography>,
          }} />

        {paymentMethods.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", mb: 0.5, display: "block" }}>
              {isDeposit ? "Fund from" : "Withdraw to"}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {paymentMethods.map((pm) => (
                <Box key={pm.payment_method_id} onClick={() => setSelectedPm(pm.payment_method_id)}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1.5, p: 1.5,
                    borderRadius: "10px", cursor: "pointer",
                    border: selectedPm === pm.payment_method_id ? "1px solid #6366f1" : "1px solid rgba(99,102,241,0.15)",
                    background: selectedPm === pm.payment_method_id ? "rgba(99,102,241,0.1)" : "transparent",
                  }}>
                  {pm.method_type === "BANK"
                    ? <AccountBalanceIcon sx={{ color: "#818cf8", fontSize: 20 }} />
                    : <CreditCardIcon sx={{ color: "#818cf8", fontSize: 20 }} />}
                  <Typography sx={{ color: "#e0e7ff", fontSize: 14, flex: 1 }}>
                    {pm.method_type === "BANK"
                      ? pm.bank_name + " ..." + (pm.account_mask ? pm.account_mask.slice(-4) : "")
                      : pm.provider + " ...." + pm.last4}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}
          sx={{
            background: isDeposit
              ? "linear-gradient(135deg,#22c55e,#16a34a)"
              : "linear-gradient(135deg,#f59e0b,#d97706)",
            borderRadius: "8px",
          }}>
          {loading ? <CircularProgress size={18} color="inherit" /> : isDeposit ? "Deposit" : "Withdraw"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Wallet Page ──────────────────────────────────────────────────────────
const Wallet = () => {
  const userId = localStorage.getItem("user_id");
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [fundsDialog, setFundsDialog] = useState({ open: false, mode: "deposit" });

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [w, txns, pms] = await Promise.all([
        getWallet(userId),
        getTransactions(userId, 20),
        getPaymentMethods(userId),
      ]);
      setWallet(w);
      setTransactions(txns);
      setPaymentMethods(pms);
    } catch (e) {
      console.error("Wallet load error:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    // Auto-refresh every 5s so trade debits show up without manual navigation
    const timer = setInterval(() => {
      getWallet(userId).then((w) => setWallet(w)).catch(() => {});
      getTransactions(userId, 20).then((t) => setTransactions(t)).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [load, userId]);

  if (!userId) {
    return <Alert severity="warning">Please log in to view your wallet.</Alert>;
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2.5 }}>

      {/* Balance Card */}
      <Box sx={{ ...cardSx, background: "linear-gradient(135deg, #0f1728 0%, #111827 100%)" }}>
        <Typography variant="overline" sx={{ color: "rgba(99,102,241,0.7)", letterSpacing: 1.5 }}>
          Total Balance
        </Typography>
        <Typography sx={{ fontSize: { xs: 32, sm: 44 }, fontWeight: 800, color: "#e0e7ff", lineHeight: 1.15, mt: 0.5 }}>
          {wallet ? fmtUSD(wallet.balance_cents) : "--"}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 2.5 }}>
          <Button variant="contained" startIcon={<ArrowDownwardIcon />}
            onClick={() => setFundsDialog({ open: true, mode: "deposit" })}
            disabled={paymentMethods.length === 0}
            sx={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", borderRadius: "10px", px: { xs: 2, sm: 3 }, fontWeight: 600, flex: { xs: "1 1 auto", sm: "0 0 auto" } }}>
            Deposit
          </Button>
          <Button variant="outlined" startIcon={<ArrowUpwardIcon />}
            onClick={() => setFundsDialog({ open: true, mode: "withdraw" })}
            disabled={!wallet || wallet.balance_cents === 0}
            sx={{ borderColor: "#f59e0b", color: "#f59e0b", borderRadius: "10px", px: { xs: 2, sm: 3 }, fontWeight: 600, flex: { xs: "1 1 auto", sm: "0 0 auto" }, "&:hover": { borderColor: "#d97706", background: "rgba(245,158,11,0.08)" } }}>
            Withdraw
          </Button>
        </Box>
        {paymentMethods.length === 0 && (
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.35)", mt: 1.5 }}>
            Add a payment method below to enable deposits.
          </Typography>
        )}
      </Box>

      {/* Payment Methods */}
      <Box sx={cardSx}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 14, sm: 16 }, color: "#e0e7ff" }}>Payment Methods</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddMethodOpen(true)}
            sx={{ color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "8px", textTransform: "none", "&:hover": { background: "rgba(99,102,241,0.08)" } }}>
            Add
          </Button>
        </Box>

        {paymentMethods.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <AccountBalanceIcon sx={{ fontSize: 40, color: "rgba(255,255,255,0.15)", mb: 1 }} />
            <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
              No payment methods added yet.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {paymentMethods.map((pm) => (
              <Box key={pm.payment_method_id} sx={{
                display: "flex", alignItems: "center", gap: 1, p: { xs: 1.25, sm: 1.75 }, borderRadius: "12px",
                border: pm.is_default ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.06)",
                background: pm.is_default ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.02)",
                flexWrap: "wrap",
              }}>
                {pm.method_type === "BANK"
                  ? <AccountBalanceIcon sx={{ color: "#818cf8", fontSize: 22 }} />
                  : <CreditCardIcon sx={{ color: "#38bdf8", fontSize: 22 }} />}
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: "#e0e7ff", fontSize: 14, fontWeight: 500 }}>
                    {pm.method_type === "BANK" ? pm.bank_name : pm.provider + " Card"}
                  </Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                    {pm.method_type === "BANK"
                      ? "Account ..." + (pm.account_mask ? pm.account_mask.slice(-4) : "")
                      : "....  ....  ....  " + pm.last4}
                  </Typography>
                </Box>
                {pm.is_default && (
                  <Chip label="Default" size="small"
                    sx={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 11, height: 22 }} />
                )}
                <Tooltip title={pm.is_default ? "Already default" : "Set as default"}>
                  <span>
                    <IconButton size="small" disabled={pm.is_default}
                      onClick={() => setDefaultPaymentMethod(userId, pm.payment_method_id).then(load)}
                      sx={{ color: pm.is_default ? "#6366f1" : "rgba(255,255,255,0.25)", "&:hover": { color: "#6366f1" } }}>
                      {pm.is_default ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Remove">
                  <IconButton size="small"
                    onClick={() => deletePaymentMethod(userId, pm.payment_method_id).then(load)}
                    sx={{ color: "rgba(255,255,255,0.25)", "&:hover": { color: "#f87171" } }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Transaction History */}
      <Box sx={cardSx}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: 14, sm: 16 }, color: "#e0e7ff", mb: 2 }}>
          Recent Transactions
        </Typography>
        {transactions.length === 0 ? (
          <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center", py: 3 }}>
            No transactions yet.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {transactions.map((txn, i) => {
              const meta = {
                DEPOSIT:     { label: "Deposit",        icon: <ArrowDownwardIcon sx={{ fontSize: 18, color: "#22c55e" }} />, iconBg: "rgba(34,197,94,0.1)",  amtColor: "#22c55e", sign: "+" },
                WITHDRAWAL:  { label: "Withdrawal",     icon: <ArrowUpwardIcon   sx={{ fontSize: 18, color: "#f59e0b" }} />, iconBg: "rgba(245,158,11,0.1)", amtColor: "#f59e0b", sign: "-" },
                BUY_DEBIT:   { label: "Stock Purchase", icon: <ArrowDownwardIcon sx={{ fontSize: 18, color: "#ef4444" }} />, iconBg: "rgba(239,68,68,0.1)",  amtColor: "#ef4444", sign: "-" },
                SELL_CREDIT: { label: "Stock Sale",     icon: <ArrowUpwardIcon   sx={{ fontSize: 18, color: "#22c55e" }} />, iconBg: "rgba(34,197,94,0.1)",  amtColor: "#22c55e", sign: "+" },
              }[txn.type] || { label: txn.type, icon: <ArrowDownwardIcon sx={{ fontSize: 18, color: "#818cf8" }} />, iconBg: "rgba(99,102,241,0.1)", amtColor: "#818cf8", sign: "" };

              return (
                <React.Fragment key={txn.txn_id}>
                  {i > 0 && <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, flexWrap: "wrap" }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: meta.iconBg,
                    }}>
                      {meta.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: "#e0e7ff", fontSize: { xs: 13, sm: 14 }, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {meta.label}
                      </Typography>
                      <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: { xs: 11, sm: 12 }, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {new Date(txn.created_at).toLocaleString()}
                        {txn.reference ? " · " + txn.reference : ""}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: { xs: 13, sm: 15 }, color: meta.amtColor, whiteSpace: "nowrap" }}>
                      {meta.sign}{fmtUSD(txn.amount_cents)}
                    </Typography>
                    <Chip label={txn.status} size="small" sx={{
                      background: txn.status === "SUCCESS" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      color: txn.status === "SUCCESS" ? "#22c55e" : "#f87171",
                      fontSize: 11, height: 22,
                    }} />
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>
        )}
      </Box>

      <AddMethodDialog
        open={addMethodOpen}
        onClose={() => setAddMethodOpen(false)}
        onAdded={load}
        userId={userId}
      />
      <FundsDialog
        open={fundsDialog.open}
        mode={fundsDialog.mode}
        onClose={() => setFundsDialog((s) => ({ ...s, open: false }))}
        onDone={load}
        userId={userId}
        paymentMethods={paymentMethods}
      />
    </Box>
  );
};

export default Wallet;
