import React, { useState } from "react";
import {
  Box,
  Button,
  CardContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { registerUser } from "../../api/exchangeApi";

export default function RegisterForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await registerUser(formData);
      alert("Registration successful");
      onSuccess(formData.email);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const lightFieldSx = {
    "& .MuiOutlinedInput-root": {
      "& fieldset": { borderColor: "#CBD5E1" },
      "&:hover fieldset": { borderColor: "#94A3B8" },
    },
  };

  return (
    <CardContent sx={{ p: 4, backgroundColor: "#ffffff" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography sx={{ fontSize: "28px", fontWeight: 800, color: "#0F172A" }}>
          Create account
        </Typography>

        <IconButton onClick={onClose} sx={{ color: "#64748B" }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Typography sx={{ color: "#64748B", mb: 4, fontSize: "15px" }}>
        Register to access your trading workspace.
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            fullWidth
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon sx={{ color: "#64748B" }} />
                </InputAdornment>
              ),
              sx: { backgroundColor: "#ffffff", color: "#0F172A" },
            }}
            InputLabelProps={{ sx: { color: "#64748B" } }}
            sx={lightFieldSx}
          />

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
            sx={lightFieldSx}
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
            sx={lightFieldSx}
          />

          {error && (
            <Typography sx={{ color: "red", fontSize: "14px" }}>
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
            {loading ? "Creating Account..." : "Create Account"}
          </Button>

          <Button
            type="button"
            fullWidth
            variant="outlined"
            onClick={onClose}
            sx={{
              height: 48,
              borderRadius: "14px",
              textTransform: "none",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            Back to Login
          </Button>
        </Stack>
      </Box>
    </CardContent>
  );
}