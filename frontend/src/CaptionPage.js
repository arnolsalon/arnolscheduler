// src/CaptionPage.js
import React, { useState } from 'react';

const API_URL = 'http://localhost:4000';

function CaptionPage() {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('fun');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const generate = async () => {
    const trimmed = topic.trim();
    setErrorMsg('');
    setShowOutput(false);

    if (!trimmed) {
      setCaption(
        'Please enter what the post is about so I can help you write a caption.'
      );
      setHashtags('');
      setShowOutput(true);
      return;
    }

    setLoading(true);

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

      const text = await res.text();        // ⬅️ read raw text
      let data;

      try {
        data = JSON.parse(text);            // ⬅️ try to parse JSON
      } catch (e) {
        // Not JSON (probably HTML or plain text) → show it as error
        console.error('Non-JSON response from server:\n', text);
        throw new Error(text.slice(0, 200)); // show first 200 chars in UI
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate caption');
      }

      setCaption(data.caption || '');
      setHashtags(data.hashtags || '');
      setShowOutput(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h2>Caption &amp; Hashtag Helper</h2>
      <p className="subtitle">
        Describe your post and we&apos;ll help you come up with ideas.
      </p>

      <div className="form">
        <div className="form-group">
          <label htmlFor="topic-input">What is this post about?</label>
          <input
            id="topic-input"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Example: morning coffee and journaling"
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
          onClick={generate}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Caption & Hashtags'}
        </button>

        {errorMsg && (
          <p className="status-msg" style={{ color: '#c62828' }}>
            Error: {errorMsg}
          </p>
        )}

        {showOutput && (
          <>
            <div className="form-group">
              <label htmlFor="generated-caption">Caption</label>
              <textarea
                id="generated-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="generated-hashtags">Hashtags</label>
              <textarea
                id="generated-hashtags"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default CaptionPage;
