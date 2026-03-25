import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginForm from "./components/Login/LoginForm";
import ExchangeDashboard from "./pages/ExchangeDashboard";
import PlaceOrder from "./components/Dashboard/PlaceOrder";
import { CssBaseline } from "@mui/material";

function App() {
  return (
    
    <BrowserRouter>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/dashboard" element={<ExchangeDashboard />} />
        <Route path="/PlaceOrder" element={<PlaceOrder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;