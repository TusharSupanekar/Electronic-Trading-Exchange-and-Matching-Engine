import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#020617",
      paper: "#0F172A"
    },

    primary: {
      main: "#3B82F6"
    },

    success: {
      main: "#22C55E"
    },

    error: {
      main: "#EF4444"
    },

    warning: {
      main: "#F59E0B"
    },

    text: {
      primary: "#F8FAFC",
      secondary: "#94A3B8"
    },

    divider: "#1F2937"
  }
});

export default theme;