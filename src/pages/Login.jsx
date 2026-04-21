import { useState } from "react";
import { auth, googleProvider } from "../firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { registerForNotifications } from "../utils/notifications";

export default function Login({ onLogin = () => {} }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();
  const theme = useTheme();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await registerForNotifications();

      // Check for redirect path (from event landing page)
      const redirectPath = sessionStorage.getItem("redirectAfterLogin");
      if (redirectPath) {
        sessionStorage.removeItem("redirectAfterLogin");
        navigate(redirectPath, { replace: true });
      } else {
        onLogin();
      }
    } catch (error) {
      console.error("Login failed:", error);
      // Provide user-friendly error messages
      switch (error.code) {
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
        case 'auth/invalid-email':
        case 'auth/user-not-found':
          setLoginError("Invalid email or password. Please try again.");
          break;
        case 'auth/user-disabled':
          setLoginError("This account has been disabled. Please contact support.");
          break;
        case 'auth/too-many-requests':
          setLoginError("Too many failed attempts. Please try again later.");
          break;
        case 'auth/network-request-failed':
          setLoginError("Network error. Please check your connection.");
          break;
        default:
          setLoginError("Unable to sign in. Please try again.");
      }
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setResetMessage("Please enter your email address to reset your password.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setResetMessage("Please enter a valid email address.");
      return;
    }

    setIsResetting(true);

    try {
      await sendPasswordResetEmail(auth, email, {
        url: window.location.origin + '/login',
        handleCodeInApp: false
      });
      setResetMessage("Password reset email sent! Please check your inbox and spam folder.");
      setLoginError("");
    } catch (error) {
      console.error("Password reset error:", error);
      switch (error.code) {
        case 'auth/invalid-email':
          setResetMessage("Invalid email address format.");
          break;
        case 'auth/user-not-found':
          setResetMessage("No account found with this email address.");
          break;
        case 'auth/too-many-requests':
          setResetMessage("Too many attempts. Please try again later.");
          break;
        case 'auth/network-request-failed':
          setResetMessage("Network error. Please check your connection and try again.");
          break;
        default:
          setResetMessage("Failed to send reset email. Please try again.");
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      backgroundColor: theme.palette.background.default,
      padding: "1rem"
    }}>
      <div style={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: "12px",
        padding: "2rem",
        maxWidth: "400px",
        width: "100%",
        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: theme.palette.text.primary,
        border: `1px solid ${theme.palette.divider}`
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img src="/logo.png" alt="Level Up Logo" style={{ height: "48px", marginBottom: "0.5rem" }} />
          <h2 style={{ fontWeight: 600, fontSize: "1.5rem" }}>Welcome Back</h2>
          <p style={{ marginTop: "0.25rem", fontSize: "0.95rem", color: theme.palette.text.primary }}>
            Log in to continue
          </p>
        </div>

        <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "0.75rem", borderRadius: "6px", border: `1px solid ${theme.palette.divider}`, fontSize: "1rem", color: theme.palette.text.primary }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "0.75rem", borderRadius: "6px", border: `1px solid ${theme.palette.divider}`, fontSize: "1rem", color: theme.palette.text.primary }}
          />
          <p style={{ textAlign: "right", marginTop: "-0.5rem", marginBottom: "1rem", fontSize: "0.85rem" }}>
            <button
              type="button"
              className="button-link"
              onClick={handlePasswordReset}
              disabled={isResetting}
              style={{
                color: isResetting ? theme.palette.text.disabled : theme.palette.primary.main,
                textDecoration: "underline",
                fontWeight: 500,
                cursor: isResetting ? "not-allowed" : "pointer",
                opacity: isResetting ? 0.6 : 1
              }}
            >
              {isResetting ? "Sending..." : "Forgot password?"}
            </button>
          </p>
          <button type="submit" className="button-primary" style={{ width: "100%" }}>
            Log In
          </button>
        </form>

        {loginError && (
          <p style={{ color: "#ef4444", marginTop: "1rem", textAlign: "center" }}>
            {loginError}
          </p>
        )}

        <hr style={{ margin: "2rem 0", border: "none", borderTop: "1px solid #eee" }} />

        <Link to="/signup" style={{ width: "100%", display: "inline-block", textAlign: "center" }}>
          <button
            className="button-primary"
            style={{ width: "100%", backgroundColor: "var(--brand-primary-coral)", color: "#fff" }}
          >
            New User? Sign Up
          </button>
        </Link>

      </div>
      {resetMessage && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            padding: "2rem",
            borderRadius: "12px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
            maxWidth: "400px",
            width: "90%",
            textAlign: "center"
          }}>
            <div style={{
              fontSize: "2rem",
              marginBottom: "1rem",
              color: resetMessage.includes("sent") ? "#10b981" : "#ff9800"
            }}>
              {resetMessage.includes("sent") ? "✓" : "ℹ"}
            </div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem", fontWeight: 600 }}>
              {resetMessage.includes("sent") ? "Email Sent!" : "Action Required"}
            </h3>
            <p style={{ fontSize: "1rem", marginBottom: "1.5rem", lineHeight: "1.5" }}>{resetMessage}</p>
            <button
              className="button-primary"
              onClick={() => setResetMessage("")}
              style={{
                backgroundColor: resetMessage.includes("sent") ? "#10b981" : theme.palette.primary.main,
                minWidth: "100px"
              }}
            >
              {resetMessage.includes("sent") ? "Got it" : "OK"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}