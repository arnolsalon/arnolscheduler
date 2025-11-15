// src/App.js
import React, { useState } from 'react';
import SchedulerPage from './SchedulerPage';
import UpcomingPage from './UpcomingPage';
import AccountsPage from './AccountsPage';

function App() {
  const [activePage, setActivePage] = useState('schedule');

  const renderPage = () => {
    if (activePage === 'schedule') return <SchedulerPage />;
    if (activePage === 'upcoming') return <UpcomingPage />;
    if (activePage === 'accounts') return <AccountsPage />;
    return <SchedulerPage />;
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="logo">SocialBlue</div>
        <nav className="nav-tabs">
          <button
            className={activePage === 'schedule' ? 'tab active' : 'tab'}
            onClick={() => setActivePage('schedule')}
          >
            Create &amp; Schedule
          </button>
          <button
            className={activePage === 'upcoming' ? 'tab active' : 'tab'}
            onClick={() => setActivePage('upcoming')}
          >
            Upcoming Posts
          </button>
          <button
            className={activePage === 'accounts' ? 'tab active' : 'tab'}
            onClick={() => setActivePage('accounts')}
          >
            Accounts
          </button>
        </nav>
      </header>

      <main className="app-main">{renderPage()}</main>
    </div>
  );
}

export default App;
