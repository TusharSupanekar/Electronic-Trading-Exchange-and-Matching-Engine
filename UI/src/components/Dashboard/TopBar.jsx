import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  Paper,
} from "@mui/material";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

const getWeatherLabel = (code) => {
  const weatherMap = {
    0: "Clear",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Fog",
    51: "Drizzle",
    53: "Drizzle",
    55: "Drizzle",
    61: "Rain",
    63: "Rain",
    65: "Heavy Rain",
    71: "Snow",
    73: "Snow",
    75: "Heavy Snow",
    80: "Rain Showers",
    81: "Rain Showers",
    82: "Heavy Showers",
    95: "Thunderstorm",
  };

  return weatherMap[code] || "Weather";
};

const TopBar = ({ appName = "Trading Exchange", profileName = "T", onMenuClick }) => {
  const [currentTime, setCurrentTime] = useState("");
  const [weather, setWeather] = useState("Loading weather...");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWeather = async (latitude, longitude) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
        );
        const data = await res.json();

        const temp = data?.current?.temperature_2m;
        const code = data?.current?.weather_code;

        if (temp !== undefined && code !== undefined) {
          setWeather(`${temp}°C • ${getWeatherLabel(code)}`);
        } else {
          setWeather("Weather unavailable");
        }
      } catch (error) {
        setWeather("Weather unavailable");
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(
            position.coords.latitude,
            position.coords.longitude
          );
        },
        () => {
          setWeather("Location denied");
        }
      );
    } else {
      setWeather("Geolocation not supported");
    }
  }, []);



  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        background: "rgba(17, 24, 39, 0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        px: { xs: 1, sm: 2, md: 3 },
      }}
    >
      <Toolbar
        sx={{
          minHeight: "72px !important",
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >

        {/* Left - Menu + App Name */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isMobile && (
            <IconButton onClick={onMenuClick} sx={{ color: "#fff" }}>
              <MenuIcon />
            </IconButton>
          )}

          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              letterSpacing: "0.5px",
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            {appName}
          </Typography>
        </Box>

        {/* Center - Time + Weather */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: "14px",
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "#fff",
            }}
          >
            <AccessTimeIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {currentTime}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: "14px",
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "#fff",
            }}
          >
            <CloudOutlinedIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {weather}
            </Typography>
          </Paper>
        </Box>

        {/* Right - Profile */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            minWidth: "fit-content",
          }}
        >
          <Avatar
            sx={{
              width: 42,
              height: 42,
              bgcolor: "#2563eb",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {profileName ? profileName[0].toUpperCase() : <AccountCircleOutlinedIcon />}
          </Avatar>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;