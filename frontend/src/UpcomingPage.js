// src/UpcomingPage.js
import React, { useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

function UpcomingPage({ authToken }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    caption: '',
    scheduledAt: '',
    platforms: [],
  });

  const loadPosts = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${API_URL}/api/schedule`, {
        headers: { 'x-auth-token': authToken },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load posts');
      }
      setPosts(data);
    } catch (err) {
      console.error(err);
      setStatusMsg(err.message || 'Failed to load upcoming posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (post) => {
    setEditingId(post.id);
    setEditForm({
      caption: post.caption || '',
      scheduledAt: post.scheduledAt
        ? post.scheduledAt.slice(0, 16) // ISO → yyyy-MM-ddTHH:mm
        : '',
      platforms: post.platforms || [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      caption: '',
      scheduledAt: '',
      platforms: [],
    });
  };

  const toggleEditPlatform = (platform) => {
    setEditForm((prev) => {
      const exists = prev.platforms.includes(platform);
      return {
        ...prev,
        platforms: exists
          ? prev.platforms.filter((p) => p !== platform)
          : [...prev.platforms, platform],
      };
    });
  };

  const saveEdit = async (id) => {
    try {
      setStatusMsg('');
      const payload = {
        caption: editForm.caption,
        scheduledAt: editForm.scheduledAt,
        platforms: editForm.platforms,
      };

      const res = await fetch(`${API_URL}/api/schedule/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update post');
      }

      setStatusMsg('✅ Post updated');
      setEditingId(null);
      await loadPosts();
    } catch (err) {
      console.error(err);
      setStatusMsg(err.message || 'Failed to update post');
    }
  };

  const deletePost = async (id) => {
    if (!window.confirm('Delete this scheduled post?')) return;

    try {
      setStatusMsg('');
      const res = await fetch(`${API_URL}/api/schedule/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': authToken },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete post');
      }

      setStatusMsg('🗑️ Post deleted');
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      setStatusMsg(err.message || 'Failed to delete post');
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <section className="card">
      <h2>Upcoming Scheduled Posts</h2>
      <p className="subtitle">
        Review everything that&apos;s scheduled and make last-minute edits if needed.
      </p>

      {statusMsg && <p className="status-msg">{statusMsg}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : posts.length === 0 ? (
        <p>No upcoming posts yet. Schedule something from the main page!</p>
      ) : (
        <div className="upcoming-list">
          {posts.map((post) => {
            const isEditing = editingId === post.id;
            const platforms = post.platforms || [];

            return (
              <div key={post.id} className="upcoming-item">
                <div className="media-preview">
                  {post.mimeType?.startsWith('image') ? (
                    <img
                      src={`${API_URL}${post.fileUrl}`}
                      alt={post.originalName || 'Scheduled media'}
                    />
                  ) : post.mimeType?.startsWith('video') ? (
                    <video
                      src={`${API_URL}${post.fileUrl}`}
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <div className="placeholder">
                      <span>Media</span>
                    </div>
                  )}
                </div>

                <div className="upcoming-details">
                  {!isEditing ? (
                    <>
                      <p className="upcoming-caption">{post.caption}</p>
                      <p className="upcoming-meta">
                        <strong>When:</strong> {formatDate(post.scheduledAt)}
                      </p>
                      <p className="upcoming-meta">
                        <strong>Platforms:</strong>{' '}
                        {platforms.length ? platforms.join(', ') : 'None'}
                      </p>
                      {post.posted && (
                        <p className="badge posted">Already posted</p>
                      )}
                    </>
                  ) : (
                    <div className="edit-form">
                      <div className="form-group">
                        <label>Caption</label>
                        <textarea
                          value={editForm.caption}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              caption: e.target.value,
                            }))
                          }
                          rows={3}
                        />
                      </div>

                      <div className="form-group">
                        <label>Scheduled Time</label>
                        <input
                          type="datetime-local"
                          value={editForm.scheduledAt}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              scheduledAt: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label>Platforms</label>
                        <div className="platform-row">
                          <label>
                            <input
                              type="checkbox"
                              checked={editForm.platforms.includes('instagram')}
                              onChange={() => toggleEditPlatform('instagram')}
                            />
                            Instagram
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={editForm.platforms.includes('facebook')}
                              onChange={() => toggleEditPlatform('facebook')}
                            />
                            Facebook
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={editForm.platforms.includes('tiktok')}
                              onChange={() => toggleEditPlatform('tiktok')}
                            />
                            TikTok
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="upcoming-actions">
                    {!isEditing ? (
                      <>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => startEdit(post)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => deletePost(post.id)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => saveEdit(post.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default UpcomingPage;
