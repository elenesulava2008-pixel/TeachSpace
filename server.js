const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (your index.html, css/, js/)
app.use(express.static(path.join(__dirname)));

// Health check (optional but nice)
app.get("/health", (req, res) => res.json({ ok: true }));

// Always serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
