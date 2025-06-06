import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/Login/LoginPage';
import Dashboard from './pages/Dashboard';
import Header from './pages/Header/Header';
import UserManagementPage from './pages/UserManagementPage/UserManagementPage';
import AuthCallbackPage from './contexts/AuthCallbackPage';

// Layout component to wrap pages that need the main header
const MainLayout = () => (
  <div>
    <Header />
    <main>
      <Outlet /> {/* Child routes will render here */}
    </main>
  </div>
);

// General protected route for any authenticated user
function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth();
  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading session...</div>;
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Specific protected route for admin-only pages
function AdminProtectedRoute({ children }) {
  const { isAuthenticated, authLoading, user } = useAuth();

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading session...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!user?.roles?.includes('admin')) {
    return <Navigate to="/dashboard" replace />; 
  }
  return children;
}

// This component contains the main routing logic
function AppContent() {
  const { isAuthenticated, authLoading } = useAuth();

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading application...</div>;
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" replace />} 
      />
      <Route 
        path="/auth/callback" 
        element={<AuthCallbackPage />} 
      />
      
      {/* Protected routes wrapped in the main layout */}
      <Route 
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route 
          path="/admin/user-management" 
          element={
            <AdminProtectedRoute>
              <UserManagementPage />
            </AdminProtectedRoute>
          } 
        />
      </Route>
      
      <Route 
        path="*" 
        element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
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