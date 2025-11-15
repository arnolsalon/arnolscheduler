// src/UpcomingPage.js
import React, { useEffect, useState } from 'react';

const API_URL = 'http://localhost:4000';

function UpcomingPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [editDatetime, setEditDatetime] = useState('');
  const [editPlatforms, setEditPlatforms] = useState([]);

  // Load posts on mount
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setErrorMsg('');

      try {
        const res = await fetch(`${API_URL}/api/schedule`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load scheduled posts');
        }

        // Sort by time, upcoming first
        const sorted = data.sort((a, b) => {
          const aTime = new Date(a.scheduledAt || a.scheduled_at).getTime();
          const bTime = new Date(b.scheduledAt || b.scheduled_at).getTime();
          return aTime - bTime;
        });

        setPosts(sorted);
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // ---- Edit helpers ----
  const startEdit = (post) => {
    const scheduledRaw = post.scheduledAt || post.scheduled_at;
    const iso = new Date(scheduledRaw).toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm

    setEditingId(post.id);
    setEditCaption(post.caption || '');
    setEditDatetime(iso);
    setEditPlatforms(post.platforms || []);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCaption('');
    setEditDatetime('');
    setEditPlatforms([]);
  };

  const togglePlatform = (name) => {
    setEditPlatforms((prev) =>
      prev.includes(name)
        ? prev.filter((p) => p !== name)
        : [...prev, name]
    );
  };

  const saveEdit = async (id) => {
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/api/schedule/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption: editCaption,
          scheduledAt: editDatetime,
          platforms: editPlatforms,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update post');
      }

      // Update local state with updated post
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? data.post : p))
      );

      cancelEdit();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to update post');
    }
  };

  const deletePost = async (id) => {
    setErrorMsg('');
    const ok = window.confirm('Delete this scheduled post?');
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/api/schedule/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete post');
      }

      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to delete post');
    }
  };

  return (
    <section className="card">
      <h2>Upcoming Scheduled Posts</h2>
      <p className="subtitle">
        See everything that&apos;s queued to go out for your accounts. You can
        tweak captions, times, or platforms, or remove posts you no longer want.
      </p>

      {loading && <p>Loading posts...</p>}
      {errorMsg && (
        <p className="status-msg" style={{ color: '#c62828' }}>
          Error: {errorMsg}
        </p>
      )}

      {!loading && !errorMsg && posts.length === 0 && (
        <p>No posts scheduled yet.</p>
      )}

      <div className="upcoming-list">
        {posts.map((post) => {
          // Normalize field names for both in-memory + SQLite versions
          const mimeType = post.mimeType || post.mime_type || '';
          const fileUrl = post.fileUrl || post.file_url || '';
          const originalName = post.originalName || post.original_name || '';
          const scheduledRaw = post.scheduledAt || post.scheduled_at;
          const isPosted =
            post.posted === true || post.posted === 1 || post.posted === '1';

          const isImage = mimeType.startsWith('image/');
          const isVideo = mimeType.startsWith('video/');

          return (
            <div key={post.id} className="upcoming-item">
              <div className="upcoming-media">
                {isImage && (
                  <img
                    src={`http://localhost:4000${fileUrl}`}
                    alt={originalName || 'Scheduled media'}
                  />
                )}
                {isVideo && (
                  <video
                    src={`http://localhost:4000${fileUrl}`}
                    controls
                    preload="metadata"
                  />
                )}
                {!isImage && !isVideo && (
                  <div className="media-placeholder">
                    No preview available
                  </div>
                )}
              </div>

              <div className="upcoming-details">
                <div className="upcoming-time">
                  {scheduledRaw
                    ? new Date(scheduledRaw).toLocaleString()
                    : 'No time set'}
                  {isPosted ? ' · Posted' : ' · Pending'}
                </div>

                {editingId === post.id ? (
                  <>
                    <div className="form-group">
                      <label>Caption</label>
                      <textarea
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Schedule Time</label>
                      <input
                        type="datetime-local"
                        value={editDatetime}
                        onChange={(e) => setEditDatetime(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Platforms</label>
                      <div className="platform-row">
                        {['instagram', 'facebook', 'tiktok'].map((name) => (
                          <label key={name}>
                            <input
                              type="checkbox"
                              checked={editPlatforms.includes(name)}
                              onChange={() => togglePlatform(name)}
                            />
                            {name.charAt(0).toUpperCase() + name.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '8px',
                      }}
                    >
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => saveEdit(post.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ background: '#b0bec5', boxShadow: 'none' }}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="upcoming-platforms">
                      Platforms:{' '}
                      {post.platforms && post.platforms.length
                        ? post.platforms.join(', ')
                        : 'None'}
                    </div>
                    <div className="upcoming-caption">
                      {post.caption || <em>No caption</em>}
                    </div>

                    <div
                      style={{
                        marginTop: '8px',
                        display: 'flex',
                        gap: '8px',
                      }}
                    >
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => startEdit(post)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ background: '#c62828', boxShadow: 'none' }}
                        onClick={() => deletePost(post.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default UpcomingPage;
