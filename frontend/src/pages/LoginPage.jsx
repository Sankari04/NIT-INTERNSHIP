import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@kaverisnacks.com' },
  { role: 'Salesman', email: 'salesman@kaverisnacks.com' },
  { role: 'Production', email: 'production@kaverisnacks.com' },
  { role: 'Auditor', email: 'auditor@kaverisnacks.com' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitLogin(e, customEmail, customPassword) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(customEmail ?? email, customPassword ?? password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2 style={{ marginBottom: 4 }}>Demo Snacks Company</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: 18 }}>
          Order-to-Audit Management System
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submitLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 6 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-box">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>
            Demo account email shortcuts (password configured locally)
          </div>
          <div className="demo-grid">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.role}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEmail(acc.email)}
              >
                Use {acc.role} email
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
