import React from "react";
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";

import { useNavigate } from "react-router-dom";

const menuItems = [
  {
    label: "Dashboard",
    icon: <DashboardOutlinedIcon />,
  },
  {
    label: "Place Order",
    icon: <AddShoppingCartOutlinedIcon />,
  },
  {
    label: "Order Book",
    icon: <MenuBookOutlinedIcon />,
  },
  {
    label: "Trades",
    icon: <SwapHorizOutlinedIcon />,
  },
  {
    label: "Orders",
    icon: <ReceiptLongOutlinedIcon />,
  },
  {
    label: "Logs",
    icon: <TerminalOutlinedIcon />,
  },
];

const SidePanel = ({ selected = "Dashboard", onSelect }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    navigate("/");
  };

  return (
    <Box
      sx={{
        width: { xs: "100%", md: 280 },
        minHeight: "calc(100vh - 73px)",
        height: "100%",
        background: "linear-gradient(180deg, #0c1021 0%, #090d1a 100%)",
        borderRight: "1px solid rgba(99,102,241,0.15)",
        display: "flex",
        flexDirection: "column",
        color: "#fff",
      }}
    >
      <Box sx={{ px: 3, py: 3 }}>
        <Typography
          variant="overline"
          sx={{ color: "rgba(99,102,241,0.7)", letterSpacing: 1.5 }}
        >
          MAIN MENU
        </Typography>
      </Box>

      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.label}
            onClick={() => onSelect?.(item.label)}
            sx={{
              borderRadius: "12px",
              mb: 1,
              color: "#fff",
              backgroundColor:
                selected === item.label
                  ? "rgba(99,102,241,0.18)"
                  : "transparent",
              borderLeft: selected === item.label
                ? "3px solid #6366f1"
                : "3px solid transparent",
              "&:hover": {
                backgroundColor:
                  selected === item.label
                    ? "rgba(99,102,241,0.22)"
                    : "rgba(99,102,241,0.07)",
              },
            }}
          >
            <ListItemIcon sx={{
              color: selected === item.label ? "#818cf8" : "rgba(255,255,255,0.5)",
              minWidth: 40,
            }}>
              {item.icon}
            </ListItemIcon>

            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: 15,
                fontWeight: selected === item.label ? 700 : 400,
                color: selected === item.label ? "#e0e7ff" : "rgba(255,255,255,0.6)",
              }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ borderColor: "rgba(99,102,241,0.12)", mt: "auto" }} />

      <List sx={{ px: 1, pb: 2 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: "12px",
            color: "#f87171",
            "&:hover": {
              backgroundColor: "rgba(248,113,113,0.1)",
            },
          }}
        >
          <ListItemIcon sx={{ color: "#f87171", minWidth: 40 }}>
            <LogoutOutlinedIcon />
          </ListItemIcon>

          <ListItemText
            primary="Logout"
            primaryTypographyProps={{
              fontSize: 16,
              fontWeight: 500,
            }}
          />
        </ListItemButton>
      </List>
    </Box>
  );
};

export default SidePanel;