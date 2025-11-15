// src/SchedulerPage.js
import React, { useState } from 'react';

const API_URL = 'http://localhost:4000';

function SchedulerPage() {
  // ---- AI caption generator state ----
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('fun');
  const [aiCaption, setAICaption] = useState('');
  const [aiHashtags, setAIHashtags] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState('');

  // ---- Scheduling state ----
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState({
    instagram: true,
    facebook: true,
    tiktok: true,
  });
  const [datetime, setDatetime] = useState('');
  const [status, setStatus] = useState('');

  const handlePlatformChange = (name) => {
    setPlatforms((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // --- AI: Generate caption + hashtags ---
  const handleGenerateCaption = async () => {
    const trimmed = topic.trim();
    setAIError('');
    setAICaption('');
    setAIHashtags('');

    if (!trimmed) {
      setAIError('Please describe what the post is about.');
      return;
    }

    setAILoading(true);

    try {
      const res = await fetch(`${API_URL}/api/generate-caption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: trimmed,
          tone,
        }),
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Non-JSON response from server:\n', text);
        throw new Error(
          'Server returned an unexpected response. Check the backend logs.'
        );
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate caption');
      }

      setAICaption(data.caption || '');
      setAIHashtags(data.hashtags || '');
    } catch (err) {
      console.error(err);
      setAIError(err.message || 'Something went wrong');
    } finally {
      setAILoading(false);
    }
  };

  // Copy AI result into the main caption box
  const handleUseAICaption = () => {
    if (!aiCaption && !aiHashtags) return;

    const combined =
      aiCaption && aiHashtags
        ? `${aiCaption}\n\n${aiHashtags}`
        : aiCaption || aiHashtags;

    setCaption(combined);
  };

  // --- File input + local preview ---
  const handleFileChange = (e) => {
    const f = e.target.files[0] || null;
    setFile(f);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl); // clean up old preview URL
    }

    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }
  };

  // --- Schedule form submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');

    if (!file) {
      setStatus('Please choose a photo or video.');
      return;
    }

    if (!datetime) {
      setStatus('Please select a date and time.');
      return;
    }

    const selectedPlatforms = Object.entries(platforms)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    if (selectedPlatforms.length === 0) {
      setStatus('Please select at least one platform.');
      return;
    }

    const formData = new FormData();
    formData.append('media', file);
    formData.append('caption', caption);
    formData.append('platforms', JSON.stringify(selectedPlatforms));
    formData.append('scheduledAt', datetime);

    try {
      const res = await fetch(`${API_URL}/api/schedule`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule post');
      }

      setStatus('Post scheduled successfully 🎉');
      setFile(null);
      setCaption('');
      setDatetime('');
      setPreviewUrl('');
      const input = document.getElementById('media-input');
      if (input) input.value = '';
    } catch (err) {
      console.error(err);
      setStatus('Error: ' + err.message);
    }
  };

  return (
    <section className="card">
      <h2>Smart Caption &amp; Scheduler</h2>
      <p className="subtitle">
        Use AI to generate a caption and hashtags, then schedule your post to
        Instagram, Facebook, and TikTok — all in one place.
      </p>

      {/* --- AI Caption Generator Section --- */}
      <div className="form" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: 0, color: '#0D47A1', fontSize: '1rem' }}>
          Step 1: Generate caption (optional)
        </h3>

        <div className="form-group">
          <label htmlFor="topic-input">What is this post about?</label>
          <input
            id="topic-input"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Example: debbie did a beautiful new hairstyle..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="tone-select">Choose a tone</label>
          <select
            id="tone-select"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
          >
            <option value="fun">Fun / Playful</option>
            <option value="professional">Professional</option>
            <option value="soft">Soft / Reflective</option>
          </select>
        </div>

        <button
          type="button"
          className="primary-btn"
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

        {(aiCaption || aiHashtags) && (
          <>
            <div className="form-group">
              <label>AI Caption</label>
              <textarea
                value={aiCaption}
                onChange={(e) => setAICaption(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>AI Hashtags</label>
              <textarea
                value={aiHashtags}
                onChange={(e) => setAIHashtags(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="primary-btn"
              onClick={handleUseAICaption}
            >
              Use this caption for scheduling
            </button>
          </>
        )}
      </div>

      {/* --- Scheduling Section --- */}
      <form className="form" onSubmit={handleSubmit}>
        <h3 style={{ margin: 0, color: '#0D47A1', fontSize: '1rem' }}>
          Step 2: Upload &amp; schedule
        </h3>

        <div className="form-group">
          <label htmlFor="media-input">Media (Photo or Video)</label>
          <input
            id="media-input"
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
          />

          {previewUrl && (
            <div style={{ marginTop: '8px' }}>
              <label
                style={{ fontSize: '0.85rem', color: '#607d8b', display: 'block' }}
              >
                Preview
              </label>
              <div style={{ marginTop: '4px' }}>
                {file && file.type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{ maxWidth: '160px', borderRadius: '10px' }}
                  />
                ) : file && file.type.startsWith('video/') ? (
                  <video
                    src={previewUrl}
                    controls
                    style={{ maxWidth: '200px', borderRadius: '10px' }}
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="caption-input">
            Final Caption (what will be posted)
          </label>
          <textarea
            id="caption-input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="You can edit or paste your own caption here..."
          />
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
          <label htmlFor="datetime-input">Schedule Time</label>
          <input
            id="datetime-input"
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
          />
        </div>

        <button type="submit" className="primary-btn">
          Schedule Post
        </button>

        {status && <p className="status-msg">{status}</p>}
      </form>
    </section>
  );
}

export default SchedulerPage;
