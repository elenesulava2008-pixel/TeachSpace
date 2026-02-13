const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve your static files: index.html, css/, js/
app.use(express.static(path.join(__dirname)));

// Provide public config to the browser (anon key is OK to expose)
app.get("/config.js", (req, res) => {
  const url = process.env.SUPABASE_URL || "https://hsrwgfzsqpaldbuevokm.supabase.co";
  const anon = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcndnZnpzcXBhbGRidWV2b2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTQwODcsImV4cCI6MjA4NTkzMDA4N30.zP-LsXIz3mEzipmAU9pV6RcmIQM2SU5AkLWIqgn3Xms";

  res.type("application/javascript").send(`
    window.__ENV = window.__ENV || {};
    window.__ENV.SUPABASE_URL = ${JSON.stringify(url)};
    window.__ENV.SUPABASE_ANON_KEY = ${JSON.stringify(anon)};
  `);
});

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// SPA-ish fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => console.log("Server running on port", PORT));
