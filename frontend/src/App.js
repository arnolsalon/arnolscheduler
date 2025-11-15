// src/App.js
import React, { useState } from 'react';
import SchedulerPage from './SchedulerPage';
import UpcomingPage from './UpcomingPage';
import AccountsPage from './AccountsPage';
import LoginPage from './LoginPage';
import './styles.css';

function App() {
  const [page, setPage] = useState('schedule');
  const [authToken, setAuthToken] = useState(
    () => window.localStorage.getItem('authToken') || ''
  );

  const handleLoggedIn = (token) => {
    setAuthToken(token);
    window.localStorage.setItem('authToken', token);
  };

  const handleLogout = () => {
    setAuthToken('');
    window.localStorage.removeItem('authToken');
  };

  // 🔒 If not logged in, only show the password prompt
  if (!authToken) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  // ✅ Once logged in, show the actual app
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Arnol Scheduler</h1>
        <nav className="nav-tabs">
          <button
            className={page === 'schedule' ? 'tab active' : 'tab'}
            onClick={() => setPage('schedule')}
          >
            Schedule Post
          </button>
          <button
            className={page === 'upcoming' ? 'tab active' : 'tab'}
            onClick={() => setPage('upcoming')}
          >
            Upcoming Posts
          </button>
          <button
            className={page === 'accounts' ? 'tab active' : 'tab'}
            onClick={() => setPage('accounts')}
          >
            Accounts
          </button>
          <button className="tab" onClick={handleLogout}>
            Log Out
          </button>
        </nav>
      </header>

      <main className="app-main">
        {page === 'schedule' && <SchedulerPage authToken={authToken} />}
        {page === 'upcoming' && <UpcomingPage authToken={authToken} />}
        {page === 'accounts' && <AccountsPage authToken={authToken} />}
      </main>
    </div>
  );
}

export default App;
