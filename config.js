const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (index.html, css/, js/)
app.use(express.static(path.join(__dirname)));

// Provide public config to the browser
app.get("/config.js", (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res
      .type("application/javascript")
      .send(`console.error("Supabase environment variables are missing.");`);
  }

  res.type("application/javascript").send(`
    window.__ENV = window.__ENV || {};
    window.__ENV.SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL)};
    window.__ENV.SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY)};
  `);
});

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Fallback for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
