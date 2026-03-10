import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (name.trim().length === 0) return 'Name is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      // Create account (public endpoint — no auth needed)
      await apiClient.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      // Auto-login with the same credentials
      await login(email.trim(), password);

      // Go to consent/onboarding flow
      navigate('/consent');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;
      if (detail) {
        setError(detail);
      } else if (err?.message?.includes('Network Error')) {
        setError('Cannot reach the server. Please try again later.');
      } else {
        setError(`Registration failed (${status || err?.message || 'unknown error'})`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim().length > 0 && email.length > 0 && password.length >= 8 && password === confirmPassword;

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
            Create your account
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#9B9B9B' }}>
            Start your wellness journal
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

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#6B6B6B' }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#FAF8F5',
                border: '1.5px solid #E8E3DC',
                color: '#2C2C2C',
              }}
              placeholder="Your name"
            />
          </div>

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
              autoComplete="new-password"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#FAF8F5',
                border: '1.5px solid #E8E3DC',
                color: '#2C2C2C',
              }}
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#6B6B6B' }}>
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#FAF8F5',
                border: '1.5px solid #E8E3DC',
                color: '#2C2C2C',
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isValid}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#C4704B' }}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-center" style={{ color: '#9B9B9B' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-medium" style={{ color: '#C4704B' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
