// App.js
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import  LoginPage  from './pages/Login/LoginPage'; // Assuming named export, adjust if default
import Dashboard from './pages/Dashboard';
import Header from './pages/Header/Header'
// Corrected import path based on the user's image showing UserManagementPage.js in src/pages/Admin/
import UserManagementPage from './pages/UserManagementPage/UserManagementPage'; 

// ProtectedRoute for general authenticated access
function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth();

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading session...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// AdminProtectedRoute for admin-only access
function AdminProtectedRoute({ children }) {
  const { isAuthenticated, authLoading, user } = useAuth(); // Assuming 'user' object with roles is available from useAuth

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.roles?.includes('admin')) {
    console.warn("Admin Route: Access denied. User is not an admin.");
    // Optionally, you can navigate to a specific "Forbidden" page
    return <Navigate to="/dashboard" replace />; 
  }

  return children;
}

function AppContent() {
  const { isAuthenticated, authLoading } = useAuth(); // Get authLoading for the main app content rendering

  // Display a loading indicator while authentication status is being determined
  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading application...</div>;
  }

  return (
    <Routes>
      {/* LoginPage: accessible only if not authenticated, otherwise redirect to dashboard */}
      <Route 
        path="/login" 
        element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" replace />} 
      />
      
      {/* Dashboard: accessible only if authenticated */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* User Management Page: accessible only if authenticated AND admin */}
      <Route 
        path="/admin/user-management" 
        element={
          <AdminProtectedRoute>
            <UserManagementPage />
          </AdminProtectedRoute>
        } 
      />
      
      {/* Catch-all route */}
      <Route 
        path="*" 
        element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
