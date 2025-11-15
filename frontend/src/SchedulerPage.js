// src/SchedulerPage.js
import React, { useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

function SchedulerPage({ authToken }) {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState({
    instagram: true,
    facebook: true,
    tiktok: true,
  });
  const [scheduledAt, setScheduledAt] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // caption helper state
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('fun');
  const [hashtags, setHashtags] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const handlePlatformChange = (name) => {
    setPlatforms((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) {
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg('');

    if (!file) {
      setStatusMsg('Please select an image or video to upload.');
      return;
    }
    if (!scheduledAt) {
      setStatusMsg('Please choose a date and time for the post.');
      return;
    }

    const activePlatforms = Object.keys(platforms).filter((key) => platforms[key]);
    if (activePlatforms.length === 0) {
      setStatusMsg('Please select at least one platform.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('media', file);
      formData.append('caption', caption);
      formData.append('platforms', JSON.stringify(activePlatforms));
      formData.append('scheduledAt', scheduledAt);

      const res = await fetch(`${API_URL}/api/schedule`, {
        method: 'POST',
        headers: {
          'x-auth-token': authToken,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule post');
      }

      setStatusMsg('✅ Post scheduled!');
      setFile(null);
      setCaption('');
      setHashtags('');
      setTopic('');
      setScheduledAt('');
    } catch (err) {
      console.error(err);
      setStatusMsg(`❌ ${err.message || 'Something went wrong'}`);
    }
  };

  const handleGenerateCaption = async () => {
    setAiError('');
    setStatusMsg('');

    const trimmed = topic.trim();
    if (!trimmed) {
      setCaption(
        'Please describe what the post is about so I can help you write a caption.'
      );
      setHashtags('');
      return;
    }

    setAiLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/generate-caption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: JSON.stringify({
          topic: trimmed,
          tone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate caption');
      }

      setCaption(data.caption || '');
      setHashtags(data.hashtags || '');
    } catch (err) {
      console.error(err);
      setAiError(err.message || 'Failed to generate caption');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <section className="card">
      <h2>Schedule a New Post</h2>
      <p className="subtitle">
        Upload your photo or video, pick platforms, and choose when it should go live.
      </p>

      <form className="form" onSubmit={handleScheduleSubmit}>
        <div className="form-group">
          <label>Media (Image or Video)</label>
          <input type="file" accept="image/*,video/*" onChange={handleFileChange} />
        </div>

        <div className="form-group">
          <label>Platforms</label>
          <div className="platform-row">
            <label>
              <input
                type="checkbox"
                checked={platforms.instagram}
                onChange={() => handlePlatformChange('instagram')}
              />
              Instagram
            </label>
            <label>
              <input
                type="checkbox"
                checked={platforms.facebook}
                onChange={() => handlePlatformChange('facebook')}
              />
              Facebook
            </label>
            <label>
              <input
                type="checkbox"
                checked={platforms.tiktok}
                onChange={() => handlePlatformChange('tiktok')}
              />
              TikTok
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Scheduled Time</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>

        <hr className="divider" />

        <h3>Caption &amp; Hashtag Helper</h3>
        <p className="subtitle">
          Describe your post and we&apos;ll help you come up with ideas.
        </p>

        <div className="form-group">
          <label>What is this post about?</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Example: Debbie did a beautiful red balayage..."
          />
        </div>

        <div className="form-group">
          <label>Choose a tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="fun">Fun / Playful</option>
            <option value="professional">Professional</option>
            <option value="soft">Soft / Reflective</option>
          </select>
        </div>

        <button
          type="button"
          className="secondary-btn"
          onClick={handleGenerateCaption}
          disabled={aiLoading}
        >
          {aiLoading ? 'Generating...' : 'Generate Caption & Hashtags'}
        </button>

        {aiError && (
          <p className="status-msg" style={{ color: '#c62828' }}>
            Error: {aiError}
          </p>
        )}

        <div className="form-group">
          <label>Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Hashtags</label>
          <textarea
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            rows={2}
          />
        </div>

        <button type="submit" className="primary-btn">
          Schedule Post
        </button>

        {statusMsg && <p className="status-msg">{statusMsg}</p>}
      </form>
    </section>
  );
}

export default SchedulerPage;
