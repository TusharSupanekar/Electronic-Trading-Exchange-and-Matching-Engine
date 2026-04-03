import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#07090f",
      paper: "#101726",
    },
    primary: {
      main: "#6366f1",
    },
    success: {
      main: "#22C55E",
    },
    error: {
      main: "#EF4444",
    },
    warning: {
      main: "#F59E0B",
    },
    text: {
      primary: "#e2e8f0",
      secondary: "#8892a4",
    },
    divider: "rgba(99,102,241,0.15)",
  },
});

export default theme;
