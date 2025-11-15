// src/AccountsPage.js
import React, { useEffect, useState } from 'react';

const API_URL = 'http://localhost:4000';

// A proper React component for a single platform card
function PlatformCard({ platformKey, label, entry, onConnect, onDisconnect }) {
  const [inputValue, setInputValue] = useState(entry.username || '');

  return (
    <div className="account-card">
      <div className="account-header">
        <span className="account-name">{label}</span>
        <span
          className="account-status"
          style={{ color: entry.connected ? '#2e7d32' : '#c62828' }}
        >
          {entry.connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      <div className="form-group">
        <label>Username / Handle</label>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`@your_${platformKey}_name`}
        />
      </div>

      <div className="account-actions">
        {!entry.connected ? (
          <button
            type="button"
            className="primary-btn"
            onClick={() => onConnect(platformKey, inputValue)}
            disabled={!inputValue.trim()}
          >
            Connect {label}
          </button>
        ) : (
          <button
            type="button"
            className="primary-btn"
            onClick={() => onDisconnect(platformKey)}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

function AccountsPage() {
  const [accounts, setAccounts] = useState({
    instagram: { connected: false, username: '' },
    facebook: { connected: false, username: '' },
    tiktok: { connected: false, username: '' },
  });
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  // Load accounts from backend
  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true);
      setStatusMsg('');

      try {
        const res = await fetch(`${API_URL}/api/accounts`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load accounts');
        }

        setAccounts(data);
      } catch (err) {
        console.error(err);
        setStatusMsg(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  // Connect account
  const handleConnect = async (platform, username) => {
    setStatusMsg('');

    try {
      const res = await fetch(`${API_URL}/api/accounts/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, username }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect.');

      setAccounts(data.accounts);
      setStatusMsg(`${platform} connected!`);
    } catch (err) {
      console.error(err);
      setStatusMsg(err.message);
    }
  };

  // Disconnect account
  const handleDisconnect = async (platform) => {
    setStatusMsg('');

    try {
      const res = await fetch(`${API_URL}/api/accounts/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect.');

      setAccounts(data.accounts);
      setStatusMsg(`${platform} disconnected.`);
    } catch (err) {
      console.error(err);
      setStatusMsg(err.message);
    }
  };

  if (loading) {
    return (
      <section className="card">
        <h2>Accounts</h2>
        <p className="subtitle">Loading...</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Accounts</h2>
      <p className="subtitle">
        Connect Instagram, Facebook, and TikTok accounts for auto-posting.
        This app supports **one account per platform**, perfect for your mom.
      </p>

      {statusMsg && <p className="status-msg">{statusMsg}</p>}

      <div className="accounts-grid">

        <PlatformCard
          platformKey="instagram"
          label="Instagram"
          entry={accounts.instagram}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />

        <PlatformCard
          platformKey="facebook"
          label="Facebook"
          entry={accounts.facebook}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />

        <PlatformCard
          platformKey="tiktok"
          label="TikTok"
          entry={accounts.tiktok}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />

      </div>
    </section>
  );
}

export default AccountsPage;
