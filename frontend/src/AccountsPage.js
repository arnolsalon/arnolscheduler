// src/AccountsPage.js
import React, { useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const DEFAULT_PLATFORMS = ['instagram', 'facebook', 'tiktok'];

function AccountsPage({ authToken }) {
  const [accounts, setAccounts] = useState({});
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAccounts = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${API_URL}/api/accounts`, {
        headers: { 'x-auth-token': authToken },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load accounts');
      }

      // Convert array from backend to object keyed by platform
      const map = {};
      data.forEach((row) => {
        map[row.platform] = {
          connected: !!row.connected,
          username: row.username || '',
        };
      });

      // Ensure all default platforms are present
      DEFAULT_PLATFORMS.forEach((p) => {
        if (!map[p]) {
          map[p] = { connected: false, username: '' };
        }
      });

      setAccounts(map);
    } catch (err) {
      console.error(err);
      setStatusMsg(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (platform, field, value) => {
    setAccounts((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  };

  const saveAccount = async (platform) => {
    setStatusMsg('');
    const account = accounts[platform];

    try {
      const res = await fetch(`${API_URL}/api/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: JSON.stringify({
          platform,
          connected: account.connected,
          username: account.username,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save account');
      }

      setStatusMsg(`✅ Saved ${platform} settings`);
      await loadAccounts();
    } catch (err) {
      console.error(err);
      setStatusMsg(err.message || 'Failed to save account');
    }
  };

  const prettyName = (platform) => {
    if (platform === 'instagram') return 'Instagram';
    if (platform === 'facebook') return 'Facebook';
    if (platform === 'tiktok') return 'TikTok';
    return platform;
  };

  return (
    <section className="card">
      <h2>Connected Accounts</h2>
      <p className="subtitle">
        These settings represent your salon&apos;s social media accounts. Right
        now this is just saved in the scheduler, but later it can be used for
        real API connections.
      </p>

      {statusMsg && <p className="status-msg">{statusMsg}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="accounts-grid">
          {DEFAULT_PLATFORMS.map((platform) => {
            const acc = accounts[platform] || {
              connected: false,
              username: '',
            };

            return (
              <div key={platform} className="account-card">
                <h3>{prettyName(platform)}</h3>

                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={acc.connected}
                    onChange={(e) =>
                      handleChange(platform, 'connected', e.target.checked)
                    }
                  />
                  <span>Connected</span>
                </label>

                <div className="form-group">
                  <label>Display Name / Handle</label>
                  <input
                    type="text"
                    value={acc.username}
                    onChange={(e) =>
                      handleChange(platform, 'username', e.target.value)
                    }
                    placeholder={
                      platform === 'instagram'
                        ? '@arnolsalon'
                        : platform === 'facebook'
                        ? 'Arnol Salon'
                        : '@arnolsalon.tiktok'
                    }
                  />
                </div>

                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => saveAccount(platform)}
                >
                  Save {prettyName(platform)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AccountsPage;
