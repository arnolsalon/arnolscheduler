// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const cron = require('node-cron');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- SQLite setup ----
const db = new Database(path.join(__dirname, 'data.db'));

// Create tables if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  original_name TEXT,
  caption TEXT,
  platforms TEXT,           -- JSON string
  scheduled_at TEXT NOT NULL,
  posted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS social_accounts (
  platform TEXT PRIMARY KEY,
  connected INTEGER NOT NULL DEFAULT 0,
  username TEXT
);
`);

// Ensure rows exist for each platform
const ensureAccountRow = db.prepare(`
INSERT OR IGNORE INTO social_accounts (platform, connected, username)
VALUES (?, 0, NULL)
`);
['instagram', 'facebook', 'tiktok'].forEach((p) => ensureAccountRow.run(p));

// Multer for uploads
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// ---- Helper DB functions ----
const insertPost = db.prepare(`
INSERT INTO scheduled_posts (
  file_path, file_url, mime_type, original_name,
  caption, platforms, scheduled_at, posted
) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
`);
const selectAllPosts = db.prepare(`SELECT * FROM scheduled_posts`);
const selectDuePosts = db.prepare(`
SELECT * FROM scheduled_posts
WHERE posted = 0 AND datetime(scheduled_at) <= datetime('now')
`);
const updatePostRow = db.prepare(`
UPDATE scheduled_posts
SET caption = COALESCE(?, caption),
    platforms = COALESCE(?, platforms),
    scheduled_at = COALESCE(?, scheduled_at)
WHERE id = ?
`);
const markPostPosted = db.prepare(`
UPDATE scheduled_posts
SET posted = 1
WHERE id = ?
`);
const deletePostRow = db.prepare(`DELETE FROM scheduled_posts WHERE id = ?`);
const selectPostById = db.prepare(`SELECT * FROM scheduled_posts WHERE id = ?`);

const selectAccounts = db.prepare(`SELECT * FROM social_accounts`);
const updateAccount = db.prepare(`
UPDATE social_accounts
SET connected = ?, username = ?
WHERE platform = ?
`);

// ---- Routes ----

// Create a scheduled post
app.post('/api/schedule', upload.single('media'), (req, res) => {
  try {
    const { caption, platforms, scheduledAt } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Media file is required' });
    }
    if (!scheduledAt) {
      return res.status(400).json({ error: 'scheduledAt is required' });
    }

    const parsedPlatforms = JSON.parse(platforms);
    const scheduledDate = new Date(scheduledAt);
    const fileUrl = `/uploads/${req.file.filename}`;

    const info = insertPost.run(
      req.file.path,
      fileUrl,
      req.file.mimetype,
      req.file.originalname,
      caption || '',
      JSON.stringify(parsedPlatforms),
      scheduledDate.toISOString()
    );

    const created = selectPostById.get(info.lastInsertRowid);
    created.platforms = JSON.parse(created.platforms || '[]');

    res.json({ message: 'Post scheduled', job: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule post' });
  }
});

// List scheduled posts
app.get('/api/schedule', (req, res) => {
  try {
    const rows = selectAllPosts.all();
    const posts = rows.map((r) => ({
      ...r,
      platforms: JSON.parse(r.platforms || '[]'),
    }));
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

// Delete a scheduled post
app.delete('/api/schedule/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = selectPostById.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Post not found' });
    }

    deletePostRow.run(id);
    existing.platforms = JSON.parse(existing.platforms || '[]');
    res.json({ message: 'Post deleted', post: existing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Edit a scheduled post
app.put('/api/schedule/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { caption, scheduledAt, platforms } = req.body;

    const existing = selectPostById.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const newCaption = typeof caption === 'string' ? caption : null;
    const newPlatforms = Array.isArray(platforms)
      ? JSON.stringify(platforms)
      : null;
    const newScheduledAt = scheduledAt
      ? new Date(scheduledAt).toISOString()
      : null;

    updatePostRow.run(newCaption, newPlatforms, newScheduledAt, id);

    const updated = selectPostById.get(id);
    updated.platforms = JSON.parse(updated.platforms || '[]');

    res.json({ message: 'Post updated', post: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// AI caption generator (same as before)
app.post('/api/generate-caption', async (req, res) => {
  try {
    const { topic, tone } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: 'OPENAI_API_KEY is not set on the server' });
    }

    const prompt = `
Generate a short social media caption and 8–12 relevant hashtags.

Topic: "${topic}"
Tone: ${tone}

Return JSON with this structure:
{
  "caption": "...",
  "hashtags": "#tag1 #tag2 #tag3"
}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return res
        .status(500)
        .json({ error: 'OpenAI API error', details: data });
    }

    const text = data.choices?.[0]?.message?.content ?? '';
    let caption = '';
    let hashtags = '';

    try {
      const parsed = JSON.parse(text);
      caption = parsed.caption || '';
      hashtags = parsed.hashtags || '';
    } catch {
      caption = text.trim();
      hashtags = '';
    }

    res.json({ caption, hashtags });
  } catch (err) {
    console.error('Error generating caption:', err);
    res.status(500).json({
      error: 'Failed to generate caption',
      details: err.message,
    });
  }
});

// Accounts
app.get('/api/accounts', (req, res) => {
  try {
    const rows = selectAccounts.all();
    const obj = {};
    rows.forEach((r) => {
      obj[r.platform] = {
        connected: !!r.connected,
        username: r.username,
      };
    });
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load accounts' });
  }
});

app.post('/api/accounts/connect', (req, res) => {
  try {
    const { platform, username } = req.body;

    if (!['instagram', 'facebook', 'tiktok'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    updateAccount.run(1, username.trim(), platform);

    const rows = selectAccounts.all();
    const obj = {};
    rows.forEach((r) => {
      obj[r.platform] = {
        connected: !!r.connected,
        username: r.username,
      };
    });

    res.json({ message: `${platform} connected`, accounts: obj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to connect account' });
  }
});

app.post('/api/accounts/disconnect', (req, res) => {
  try {
    const { platform } = req.body;

    if (!['instagram', 'facebook', 'tiktok'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    updateAccount.run(0, null, platform);

    const rows = selectAccounts.all();
    const obj = {};
    rows.forEach((r) => {
      obj[r.platform] = {
        connected: !!r.connected,
        username: r.username,
      };
    });

    res.json({ message: `${platform} disconnected`, accounts: obj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

// Posting cron
async function postToPlatforms(job) {
  console.log('Would post job', job.id, 'to', job.platforms);
  // TODO: real API calls here
  markPostPosted.run(job.id);
}

cron.schedule('* * * * *', () => {
  const due = selectDuePosts.all();
  due.forEach((job) => {
    job.platforms = JSON.parse(job.platforms || '[]');
    postToPlatforms(job);
  });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
