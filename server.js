const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Provide config FIRST (before static), so it can't be overridden by a file
app.get("/config.js", (req, res) => {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;

  res.type("application/javascript").send(`
    window.__ENV = window.__ENV || {};
    window.__ENV.SUPABASE_URL = ${JSON.stringify(url || "")};
    window.__ENV.SUPABASE_ANON_KEY = ${JSON.stringify(anon || "")};
  `);
});

// ✅ Serve static files
app.use(express.static(path.join(__dirname)));

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => console.log("Server running on port", PORT));
