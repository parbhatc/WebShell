import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import DashboardPage from "@/pages/Dashboard";
import WorkspacePage from "@/pages/Workspace";

import { useAuthStore } from '@/stores/useAuthStore';

const isAuthenticated = () => {
    return useAuthStore.getState().isAuthenticated;
};

const PrivateRoute = ({ children }) => {
    return isAuthenticated() ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/server/:id/session" element={<PrivateRoute><WorkspacePage /></PrivateRoute>} />
        <Route path="/home" element={<Home />} />
      </Routes>
    </Router>
  );
}
