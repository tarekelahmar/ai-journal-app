import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AppShell } from './components/navigation/AppShell'
import LoginPage from './pages/LoginPage'
import ConsentPage from './pages/ConsentPage'
import OnboardingPage from './pages/OnboardingPage'
import DailyScorePage from './pages/DailyScorePage'
import JournalPage from './pages/JournalPage'
import DashboardPage from './pages/DashboardPage'
import ActionsPage from './pages/ActionsPage'
import ActionDetailPage from './pages/ActionDetailPage'
import ProfilePage from './pages/ProfilePage'
import './index.css'

function App() {
  return (
    <Routes>
      {/* Pre-auth routes (no bottom nav) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/consent" element={<ConsentPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Main app with AppShell (bottom nav) */}
      <Route element={<AppShell />}>
        <Route path="/score" element={<DailyScorePage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/actions/:id" element={<ActionDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/score" replace />} />
      <Route path="*" element={<Navigate to="/score" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
