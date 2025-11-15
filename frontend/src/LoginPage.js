// src/LoginPage.js
import React, { useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

function LoginPage({ onLoggedIn }) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const text = await res.text(); // read raw text
      let data = {};

      try {
        data = JSON.parse(text);
      } catch {
        // Not JSON – probably HTML like "<!DOCTYPE html>..."
        throw new Error(text || 'Non-JSON response from server');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoggedIn(data.token);
    } catch (err) {
      console.error('Login error:', err);
      setStatus(err.message || 'Login failed');
    }
  };

  return (
    <div className="app-shell">
      <section className="card" style={{ maxWidth: 420, margin: '60px auto' }}>
        <h2>Arnol Scheduler Login</h2>
        <p className="subtitle">
          This tool is private. Enter the password to continue.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>

          <button type="submit" className="primary-btn">
            Log In
          </button>

          {status && (
            <p className="status-msg" style={{ color: '#c62828' }}>
              {status}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}

export default LoginPage;
