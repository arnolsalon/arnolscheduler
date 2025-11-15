// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cron = require('node-cron');
const crypto = require('crypto');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();

// ----- Env vars -----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY is not set. Caption generation will fail.');
}
if (!ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD is not set. Set it in your .env / Render env.');
}

// ----- Basic middleware -----
app.use(cors());
app.use(express.json());

// ----- Uploads directory & static serving -----
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });
app.use('/uploads', express.static(uploadsDir));

// ----- Database setup (better-sqlite3) -----
const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// Scheduled posts table
db.prepare(`
  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type TEXT,
    original_name TEXT,
    caption TEXT,
    platforms TEXT,        -- JSON array
    scheduled_at TEXT,     -- ISO string
    posted INTEGER DEFAULT 0
  )
`).run();

// Optional: simple social accounts table
db.prepare(`
  CREATE TABLE IF NOT EXISTS social_accounts (
    platform TEXT PRIMARY KEY,
    connected INTEGER DEFAULT 0,
    username TEXT
  )
`).run();

// ----- Simple auth (password + in-memory tokens) -----
const activeTokens = new Set();

function requireAuth(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/login', (req, res) => {
  try {
    const { password } = req.body;
    if (!ADMIN_PASSWORD) {
      return res.status(500).json({ error: 'Server auth not configured.' });
    }
    if (!password || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    activeTokens.add(token);

    return res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ----- Helper: map DB row to API object -----
function mapRow(row) {
  let platforms = [];
  if (row.platforms) {
    try {
      platforms = JSON.parse(row.platforms);
    } catch {
      platforms = [];
    }
  }

  return {
    id: row.id,
    filePath: row.file_path,
    fileUrl: row.file_url,
    file_url: row.file_url, // alias for older frontend code
    mimeType: row.mime_type,
    mime_type: row.mime_type,
    originalName: row.original_name,
    original_name: row.original_name,
    caption: row.caption || '',
    platforms,
    scheduledAt: row.scheduled_at,
    scheduled_at: row.scheduled_at,
    posted: !!row.posted,
  };
}

// ----- Caption generator (OpenAI) -----
app.post('/api/generate-caption', requireAuth, async (req, res) => {
  try {
    const { topic, tone } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    if (!OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: 'OPENAI_API_KEY is not set on the server' });
    }

    const prompt = `
Generate a short social media caption and 8–12 relevant hashtags.

Topic: "${topic}"
Tone: ${tone || 'fun'}

Return JSON with this structure:
{
  "caption": "...",
  "hashtags": "#tag1 #tag2 #tag3"
}
    `.trim();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
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
      return res.status(500).json({ error: 'OpenAI API error', details: data });
    }

    const text = data.choices?.[0]?.message?.content ?? '';

    let caption = '';
    let hashtags = '';

    try {
      const parsed = JSON.parse(text);
      caption = parsed.caption || '';
      hashtags = parsed.hashtags || '';
    } catch (_e) {
      caption = text.trim();
      hashtags = '';
    }

    return res.json({ caption, hashtags });
  } catch (err) {
    console.error('Error generating caption:', err);
    res
      .status(500)
      .json({ error: 'Failed to generate caption', details: err.message });
  }
});

// ----- Schedule a post (create) -----
app.post(
  '/api/schedule',
  requireAuth,
  upload.single('media'),
  (req, res) => {
    try {
      const { caption, platforms, scheduledAt } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Media file is required' });
      }
      if (!scheduledAt) {
        return res.status(400).json({ error: 'scheduledAt is required' });
      }

      // Normalize platforms
      let parsedPlatforms = [];
      if (typeof platforms === 'string') {
        try {
          parsedPlatforms = JSON.parse(platforms); // e.g., '["instagram","facebook"]'
        } catch {
          parsedPlatforms = [];
        }
      } else if (Array.isArray(platforms)) {
        parsedPlatforms = platforms;
      }

      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduledAt datetime' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      const iso = scheduledDate.toISOString();

      const result = db
        .prepare(
          `
        INSERT INTO scheduled_posts
          (file_path, file_url, mime_type, original_name, caption, platforms, scheduled_at, posted)
        VALUES
          (@file_path, @file_url, @mime_type, @original_name, @caption, @platforms, @scheduled_at, 0)
      `
        )
        .run({
          file_path: req.file.path,
          file_url: fileUrl,
          mime_type: req.file.mimetype,
          original_name: req.file.originalname,
          caption: caption || '',
          platforms: JSON.stringify(parsedPlatforms),
          scheduled_at: iso,
        });

      const row = db
        .prepare('SELECT * FROM scheduled_posts WHERE id = ?')
        .get(result.lastInsertRowid);

      const job = mapRow(row);

      return res.json({ message: 'Post scheduled', job });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to schedule post' });
    }
  }
);

// ----- List scheduled posts -----
app.get('/api/schedule', requireAuth, (req, res) => {
  try {
    const rows = db
      .prepare('SELECT * FROM scheduled_posts ORDER BY scheduled_at ASC')
      .all();
    const jobs = rows.map(mapRow);
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load scheduled posts' });
  }
});

// ----- Update scheduled post (caption, time, platforms) -----
app.put('/api/schedule/:id', requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const { caption, scheduledAt, platforms } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ error: 'scheduledAt is required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt datetime' });
    }

    let parsedPlatforms = [];
    if (Array.isArray(platforms)) {
      parsedPlatforms = platforms;
    } else if (typeof platforms === 'string') {
      try {
        parsedPlatforms = JSON.parse(platforms);
      } catch {
        parsedPlatforms = [];
      }
    }

    const iso = scheduledDate.toISOString();

    const result = db
      .prepare(
        `
      UPDATE scheduled_posts
      SET caption = @caption,
          platforms = @platforms,
          scheduled_at = @scheduled_at
      WHERE id = @id
    `
      )
      .run({
        id,
        caption: caption || '',
        platforms: JSON.stringify(parsedPlatforms),
        scheduled_at: iso,
      });

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const row = db.prepare('SELECT * FROM scheduled_posts WHERE id = ?').get(id);
    const post = mapRow(row);

    res.json({ message: 'Post updated', post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// ----- Delete scheduled post -----
app.delete('/api/schedule/:id', requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = db
      .prepare('DELETE FROM scheduled_posts WHERE id = ?')
      .run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ----- Optional: social accounts API (simple stub) -----
app.get('/api/accounts', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM social_accounts').all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load accounts' });
  }
});

app.post('/api/accounts', requireAuth, (req, res) => {
  try {
    const { platform, connected, username } = req.body;
    if (!platform) {
      return res.status(400).json({ error: 'platform is required' });
    }

    db.prepare(
      `
      INSERT INTO social_accounts (platform, connected, username)
      VALUES (@platform, @connected, @username)
      ON CONFLICT(platform) DO UPDATE SET
        connected = excluded.connected,
        username = excluded.username
    `
    ).run({
      platform,
      connected: connected ? 1 : 0,
      username: username || null,
    });

    res.json({ message: 'Account updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// ----- Stub: posting to real platforms -----
async function postToPlatforms(job) {
  console.log('Posting job', job.id, 'to', job.platforms);
  console.log('  File path:', job.filePath);
  console.log('  Caption:', job.caption);

  // TODO: Call Facebook / Instagram / TikTok APIs here using stored tokens.

  // For now, just simulate success:
  return true;
}

// ----- Cron: every minute, post due scheduled posts -----
cron.schedule('* * * * *', async () => {
  try {
    const nowIso = new Date().toISOString();
    const rows = db
      .prepare(
        `
      SELECT * FROM scheduled_posts
      WHERE posted = 0 AND scheduled_at <= ?
    `
      )
      .all(nowIso);

    for (const row of rows) {
      const job = mapRow(row);
      try {
        await postToPlatforms(job);
        db.prepare('UPDATE scheduled_posts SET posted = 1 WHERE id = ?').run(
          row.id
        );
        console.log(`✅ Marked job ${row.id} as posted`);
      } catch (err) {
        console.error(`Failed to post job ${row.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Cron error:', err);
  }
});

// ----- Start server -----
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
