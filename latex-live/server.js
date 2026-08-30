const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Limits — keep the service safe from abuse since compiling runs a real
// TeX toolchain on the server.
const MAX_SOURCE_BYTES = 300 * 1024; // 300 KB of LaTeX source
const COMPILE_TIMEOUT_MS = 25_000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Very small in-memory rate limiter: N requests per IP per minute.
const RATE_LIMIT = 12;
const rateBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = rateBuckets.get(ip) || [];
  const recent = bucket.filter((t) => now - t < windowMs);
  recent.push(now);
  rateBuckets.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

app.post("/api/compile", async (req, res) => {
  const ip = req.ip || "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({ success: false, log: "Too many compile requests. Please wait a moment and try again." });
  }

  const source = req.body && req.body.source;
  if (typeof source !== "string" || source.trim().length === 0) {
    return res.status(400).json({ success: false, log: "No LaTeX source provided." });
  }
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
    return res.status(413).json({ success: false, log: "Document is too large (max 300 KB)." });
  }

  const jobId = crypto.randomUUID();
  const jobDir = path.join(os.tmpdir(), `latex-${jobId}`);
  const texPath = path.join(jobDir, "main.tex");
  const pdfPath = path.join(jobDir, "main.pdf");
  const logPath = path.join(jobDir, "main.log");

  try {
    await fs.mkdir(jobDir, { recursive: true });
    await fs.writeFile(texPath, source, "utf8");

    await new Promise((resolve, reject) => {
      execFile(
        "latexmk",
        [
          "-pdf",
          "-interaction=nonstopmode",
          "-halt-on-error",
          "-file-line-error",
          "-output-directory=" + jobDir,
          texPath,
        ],
        { cwd: jobDir, timeout: COMPILE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          // latexmk exits non-zero on LaTeX errors too — we still want the
          // log, so don't reject purely on error; check for the PDF instead.
          resolve({ error, stdout, stderr });
        }
      );
    });

    const pdfExists = fsSync.existsSync(pdfPath);

    if (!pdfExists) {
      let log = "";
      try {
        log = await fs.readFile(logPath, "utf8");
      } catch {
        log = "Compilation failed and no log was produced. Check your document for unmatched braces or environments.";
      }
      return res.json({ success: false, log: tailLog(log) });
    }

    const pdfBuffer = await fs.readFile(pdfPath);
    let log = "";
    try {
      log = await fs.readFile(logPath, "utf8");
    } catch {
      /* ignore */
    }

    return res.json({
      success: true,
      pdf: pdfBuffer.toString("base64"),
      log: tailLog(log),
    });
  } catch (err) {
    return res.status(500).json({ success: false, log: "Server error while compiling: " + err.message });
  } finally {
    fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
});

function tailLog(log, maxChars = 6000) {
  if (log.length <= maxChars) return log;
  return "...(truncated)...\n" + log.slice(-maxChars);
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`latex-live listening on port ${PORT}`);
});
