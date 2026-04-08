import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { loginUser } from "../../api/exchangeApi";
import { Dialog, Fade, IconButton } from "@mui/material";
import RegisterForm from "./RegisterForm";

export default function LoginForm() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [openRegister, setOpenRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await loginUser(formData);
      console.log("Login successful:", result);

      localStorage.setItem("user", JSON.stringify(result));
      localStorage.setItem("user_id", result.user_id);
      localStorage.setItem("username", result.username);
      localStorage.setItem("email", result.email);

      navigate("/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      setError(err.response?.data?.error || "Login Failed");
    } finally {
      setLoading(false);
    }

    
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.1fr 0.9fr" },
        background: "linear-gradient(135deg, #07111F 0%, #0B1F36 45%, #102A43 100%)",
      }}
    >
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          px: 8,
          py: 8,
          color: "#fff",
        }}
      >
        <Typography
          sx={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#00D4AA",
            mb: 2,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Electronic Trading Exchange
        </Typography>

        <Typography
          sx={{
            fontWeight: 800,
            fontSize: "56px",
            lineHeight: 1.1,
            maxWidth: 580,
            mb: 2,
          }}
        >
          Trade smarter with real-time market confidence.
        </Typography>

        <Typography
          sx={{
            color: "rgba(255,255,255,0.75)",
            fontSize: "18px",
            maxWidth: 520,
            mb: 5,
            lineHeight: 1.7,
          }}
        >
          Monitor orders, track execution flow, and access your exchange dashboard from one secure place.
        </Typography>

        <Box
          sx={{
            
            width: "100%",
            maxWidth: 560,
            borderRadius: "28px",
            p: 3.5,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Stack spacing={2.2}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: "14px",
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg, #00D4AA, #00A3FF)",
                }}
              >
                <TrendingUpIcon sx={{ color: "#fff" }} />
              </Box>

              <Box>
                <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: "18px" }}>
                  Market Overview
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: "14px" }}>
                  Secure access to your live trading workspace
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 2,
                mt: 1,
              }}
            >
              {[
                { label: "Latency", value: "12ms" },
                { label: "Orders", value: "1.2M" },
                { label: "Uptime", value: "99.9%" },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    borderRadius: "18px",
                    p: 2,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", mb: 0.6 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: "22px" }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
          py: 6,
          background: { xs: "#F8FAFC", md: "#F8FAFC" },
        }}
      >
        <Card
          sx={{
            width: "100%",
            maxWidth: 460,
            borderRadius: "28px",
            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.14)",
            border: "1px solid rgba(15,23,42,0.06)",
            backgroundColor: "#ffffff",
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Typography sx={{ fontSize: "30px", fontWeight: 800, color: "#0F172A", mb: 1 }}>
              Welcome back
            </Typography>
            <Typography sx={{ color: "#64748B", mb: 4, fontSize: "15px" }}>
              Login to continue to your trading dashboard.
            </Typography>

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon sx={{ color: "#64748B" }} />
                      </InputAdornment>
                    ),
                    sx: { backgroundColor: "#ffffff", color: "#0F172A" },
                  }}
                  InputLabelProps={{ sx: { color: "#64748B" } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "#CBD5E1" },
                      "&:hover fieldset": { borderColor: "#94A3B8" },
                    },
                  }}
                />

                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ color: "#64748B" }} />
                      </InputAdornment>
                    ),
                    sx: { backgroundColor: "#ffffff", color: "#0F172A" },
                  }}
                  InputLabelProps={{ sx: { color: "#64748B" } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "#CBD5E1" },
                      "&:hover fieldset": { borderColor: "#94A3B8" },
                    },
                  }}
                />

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontSize: "14px", color: "#64748B" }}>
                    Secure sign in for exchange users
                  </Typography>
                  <Link href="#" underline="hover" sx={{ fontSize: "14px", fontWeight: 600 }}>
                    Forgot password?
                  </Link>
                </Box>

                {error && (
                  <Typography sx={{ color: "red", fontSize: "14px", textAlign: "center" }}>
                    {error}
                  </Typography>
                )}

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  sx={{
                    height: 52,
                    borderRadius: "14px",
                    textTransform: "none",
                    fontSize: "16px",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #0F172A 0%, #1D4ED8 100%)",
                  }}
                >
                  {loading ? "signing in..." : "Sign In"}
                </Button>

                <Typography sx={{ textAlign: "center", color: "#64748B", fontSize: "14px" }}>
                  Don&apos;t have an account?{" "}
                  <Box
                    component="span"
                    onClick={() => setOpenRegister(true)}
                    sx={{
                      fontWeight: 700,
                      color: "#1976d2",
                      cursor: "pointer",
                    }}
                  >
                    Create account
                  </Box>
                </Typography>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Box>


      <Dialog
        open={openRegister}
        onClose={() => setOpenRegister(false)}
        fullWidth
        maxWidth="sm"
        TransitionComponent={Fade}
        BackdropProps={{
          timeout: 400,
          sx: {
            backdropFilter: "blur(8px)",
            backgroundColor: "rgba(15, 23, 42, 0.45)",
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: "24px",
            overflow: "hidden",
            background: "#ffffff",
            boxShadow: "0 30px 80px rgba(0,0,0,0.28)",
          },
        }}
      >
        <RegisterForm
          onClose={() => setOpenRegister(false)}
          onSuccess={(registeredEmail) => {
            setOpenRegister(false);
            setFormData((prev) => ({
              ...prev,
              email: registeredEmail,
              password: "",
            }));
          }}
        />
      </Dialog>
    </Box>
  );
}