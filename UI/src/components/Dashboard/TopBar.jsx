import React, { useEffect, useState } from "react";
import { AppBar, Toolbar, Typography, Box, Avatar, Paper, IconButton, Tooltip } from "@mui/material";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useColorMode } from "../../context/ColorModeContext.jsx";
import useColors from "../../theme/useColors.js";

const getWeatherLabel = (code) => {
  const weatherMap = {
    0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Cloudy",
    45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
    61: "Rain", 63: "Rain", 65: "Heavy Rain", 71: "Snow", 73: "Snow",
    75: "Heavy Snow", 80: "Rain Showers", 81: "Rain Showers",
    82: "Heavy Showers", 95: "Thunderstorm",
  };
  return weatherMap[code] || "Weather";
};

const TopBar = ({ appName = "Trading Exchange", profileName = "T", onMenuClick }) => {
  const [currentTime, setCurrentTime] = useState("");
  const [weather, setWeather] = useState("Loading weather...");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { toggleColorMode, mode } = useColorMode();
  const c = useColors();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString([], {
        weekday: "short", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
        );
        const data = await res.json();
        const temp = data?.current?.temperature_2m;
        const code = data?.current?.weather_code;
        if (temp !== undefined && code !== undefined)
          setWeather(`${temp}°C • ${getWeatherLabel(code)}`);
        else setWeather("Weather unavailable");
      } catch { setWeather("Weather unavailable"); }
    };
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => setWeather("Location denied")
      );
    else setWeather("Geolocation not supported");
  }, []);

  return (
    <AppBar position="static" elevation={0} sx={{
      background: c.topBg,
      backdropFilter: "blur(16px)",
      borderBottom: `1px solid ${c.border}`,
      boxShadow: c.isDark ? "none" : "0 1px 8px rgba(0,0,0,0.07)",
      px: { xs: 1, sm: 2, md: 3 },
    }}>
      <Toolbar sx={{ minHeight: "72px !important", display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>

        {/* Left */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={onMenuClick} sx={{ color: c.t1 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "0.5px", color: c.t1, whiteSpace: "nowrap" }}>
            {appName}
          </Typography>
        </Box>

        {/* Center */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "center", flex: 1 }}>
          <Paper elevation={0} sx={{
            display: "flex", alignItems: "center", gap: 1, px: 2, py: 1,
            borderRadius: "14px", backgroundColor: "rgba(99,102,241,0.08)",
            border: `1px solid ${c.border}`, color: c.t2,
          }}>
            <AccessTimeIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{currentTime}</Typography>
          </Paper>

          <Paper elevation={0} sx={{
            display: "flex", alignItems: "center", gap: 1, px: 2, py: 1,
            borderRadius: "14px", backgroundColor: "rgba(99,102,241,0.08)",
            border: `1px solid ${c.border}`, color: c.t2,
          }}>
            <CloudOutlinedIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{weather}</Typography>
          </Paper>
        </Box>

        {/* Right */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton onClick={toggleColorMode} sx={{
              color: c.t2,
              border: `1px solid ${c.border}`,
              borderRadius: "10px",
              width: 38, height: 38,
              "&:hover": { background: "rgba(99,102,241,0.1)", color: "#6366f1" },
              transition: "all 0.2s",
            }}>
              {mode === "dark" ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Tooltip title={profileName || ""} arrow>
            <Avatar sx={{ width: 42, height: 42, bgcolor: "#6366f1", fontWeight: 700, cursor: "pointer" }}>
              {profileName ? profileName[0].toUpperCase() : <AccountCircleOutlinedIcon />}
            </Avatar>
          </Tooltip>
        </Box>

      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
