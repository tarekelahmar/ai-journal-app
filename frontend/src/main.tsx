import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import ConsentPage from './pages/ConsentPage'
import JournalPage from './pages/JournalPage'
import SettingsPage from './pages/SettingsPage'
import './index.css'

function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/consent" element={<ConsentPage />} />

      {/* Main app */}
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/settings" element={<SettingsPage />} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/journal" replace />} />
      <Route path="*" element={<Navigate to="/journal" replace />} />
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
