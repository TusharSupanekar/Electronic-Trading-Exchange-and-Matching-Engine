import React from "react";
import { Box, Typography, List, ListItemButton, ListItemIcon, ListItemText, Divider } from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PieChartOutlineOutlinedIcon from "@mui/icons-material/PieChartOutlineOutlined";
import { useNavigate } from "react-router-dom";
import useColors from "../../theme/useColors.js";

const menuItems = [
  { label: "Portfolio",   icon: <PieChartOutlineOutlinedIcon /> },
  { label: "Trading board",   icon: <DashboardOutlinedIcon /> },
  { label: "Wallet",      icon: <AccountBalanceWalletOutlinedIcon /> },
  { label: "Logs",        icon: <TerminalOutlinedIcon /> },
];

const SidePanel = ({ selected = "Dashboard", onSelect }) => {
  const navigate = useNavigate();
  const c = useColors();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    navigate("/");
  };

  return (
    <Box sx={{
      width: { xs: "100%", md: 280 },
      minHeight: "calc(100vh - 73px)",
      height: "100%",
      background: c.sideBg,
      borderRight: `1px solid ${c.border}`,
      display: "flex", flexDirection: "column", color: c.t1,
    }}>
      <Box sx={{ px: 3, py: 3 }}>
        <Typography variant="overline" sx={{ color: "rgba(99,102,241,0.7)", letterSpacing: 1.5 }}>
          MAIN MENU
        </Typography>
      </Box>

      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton key={item.label} onClick={() => onSelect?.(item.label)} sx={{
            borderRadius: "12px", mb: 1,
            color: c.t1,
            backgroundColor: selected === item.label
              ? (c.isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.1)")
              : "transparent",
            borderLeft: selected === item.label ? "3px solid #6366f1" : "3px solid transparent",
            "&:hover": { backgroundColor: selected === item.label
              ? (c.isDark ? "rgba(99,102,241,0.22)" : "rgba(99,102,241,0.14)")
              : (c.isDark ? "rgba(99,102,241,0.07)" : "rgba(99,102,241,0.05)") },
          }}>
            <ListItemIcon sx={{ color: selected === item.label ? "#6366f1" : c.t3, minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{
              fontSize: 15, fontWeight: selected === item.label ? 700 : 400,
              color: selected === item.label ? (c.isDark ? "#e0e7ff" : "#4338ca") : c.t2,
            }} />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ borderColor: c.border, mt: "auto" }} />

      <List sx={{ px: 1, pb: 2 }}>
        <ListItemButton onClick={handleLogout} sx={{
          borderRadius: "12px", color: "#f87171",
          "&:hover": { backgroundColor: "rgba(248,113,113,0.1)" },
        }}>
          <ListItemIcon sx={{ color: "#f87171", minWidth: 40 }}><LogoutOutlinedIcon /></ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: 16, fontWeight: 500 }} />
        </ListItemButton>
      </List>
    </Box>
  );
};

export default SidePanel;
