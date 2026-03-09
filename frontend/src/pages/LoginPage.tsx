import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, setUserId } = useAuth();
  const authMode = import.meta.env.VITE_AUTH_MODE || 'public';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userIdInput, setUserIdInput] = useState('1');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (authMode === 'public') {
        // Alpha mode: just set user_id
        const userId = parseInt(userIdInput, 10);
        if (isNaN(userId) || userId <= 0) {
          setError('Please enter a valid user ID');
          return;
        }
        setUserId(userId);
      } else {
        // Private mode: JWT login
        await login(email, password);
      }
      navigate('/consent');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#FAF8F5', fontFamily: "'DM Sans', sans-serif" }}
    >
      <div
        className="w-full bg-white rounded-2xl shadow-sm p-8 space-y-6"
        style={{ maxWidth: 400 }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: '#2C2C2C' }}>
            Welcome back
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#9B9B9B' }}>
            Sign in to your journal
          </p>
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ backgroundColor: '#FDF2F0', color: '#C47A6B' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {authMode === 'public' ? (
            /* Alpha mode: user ID input */
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#6B6B6B' }}>
                User ID
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: '#FAF8F5',
                  border: '1.5px solid #E8E3DC',
                  color: '#2C2C2C',
                }}
                placeholder="e.g. 1"
              />
            </div>
          ) : (
            /* Private mode: email + password */
            <>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#6B6B6B' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: '#FAF8F5',
                    border: '1.5px solid #E8E3DC',
                    color: '#2C2C2C',
                  }}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#6B6B6B' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: '#FAF8F5',
                    border: '1.5px solid #E8E3DC',
                    color: '#2C2C2C',
                  }}
                  placeholder="••••••••"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#C4704B' }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {authMode !== 'public' && (
          <p className="text-sm text-center" style={{ color: '#9B9B9B' }}>
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium" style={{ color: '#C4704B' }}>
              Sign up
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
