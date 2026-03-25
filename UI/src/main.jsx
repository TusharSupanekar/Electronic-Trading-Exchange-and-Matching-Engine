import { StrictMode } from 'react'
import { ThemeProvider } from "@mui/material/styles";

import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
