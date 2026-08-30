const DEFAULT_SOURCE = `\\documentclass{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath}
\\title{Hello, Typeset}
\\author{Your Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Edit this document on the left. It compiles to a real PDF on the
right, run through a full \\LaTeX{} toolchain on the server --
nothing to install on your machine.

\\section{An equation}
The quadratic formula:
\\[
  x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
\\]

\\end{document}
`;

const editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
  mode: "stex",
  theme: "material-darker",
  lineNumbers: true,
  lineWrapping: true,
  tabSize: 2,
  indentUnit: 2,
  autofocus: true,
});
editor.setValue(DEFAULT_SOURCE);

const compileBtn = document.getElementById("compileBtn");
const downloadBtn = document.getElementById("downloadBtn");
const autoCompileToggle = document.getElementById("autoCompileToggle");
const statusEl = document.getElementById("status");
const statusText = statusEl.querySelector(".status-text");
const pdfFrame = document.getElementById("pdfFrame");
const emptyState = document.getElementById("emptyState");
const errorPanel = document.getElementById("errorPanel");
const errorLog = document.getElementById("errorLog");
const pageInfo = document.getElementById("pageInfo");

let currentPdfUrl = null;
let debounceTimer = null;
let compiling = false;
let queuedRecompile = false;

function setStatus(state, label) {
  statusEl.className = "status status-" + state;
  statusText.textContent = label;
}

async function compile() {
  if (compiling) {
    queuedRecompile = true;
    return;
  }
  compiling = true;
  compileBtn.disabled = true;
  setStatus("compiling", "Compiling…");

  const source = editor.getValue();

  try {
    const res = await fetch("/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });
    const data = await res.json();

    if (data.success) {
      const byteChars = atob(data.pdf);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });

      if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
      currentPdfUrl = URL.createObjectURL(blob);

      pdfFrame.src = currentPdfUrl;
      pdfFrame.style.display = "block";
      emptyState.style.display = "none";
      errorPanel.hidden = true;
      downloadBtn.disabled = false;
      pageInfo.textContent = formatSize(bytes.length);

      setStatus("ok", "Compiled");
    } else {
      showError(data.log || "Compilation failed.");
      setStatus("error", "Error");
    }
  } catch (err) {
    showError("Could not reach the compile server: " + err.message);
    setStatus("error", "Error");
  } finally {
    compiling = false;
    compileBtn.disabled = false;
    if (queuedRecompile) {
      queuedRecompile = false;
      compile();
    }
  }
}

function showError(log) {
  pdfFrame.style.display = "none";
  emptyState.style.display = currentPdfUrl ? "none" : "flex";
  errorPanel.hidden = false;
  errorLog.textContent = log;
}

function formatSize(bytes) {
  const kb = bytes / 1024;
  return kb < 1024 ? kb.toFixed(0) + " KB" : (kb / 1024).toFixed(1) + " MB";
}

function scheduleAutoCompile() {
  if (!autoCompileToggle.checked) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(compile, 1200);
}

editor.on("change", scheduleAutoCompile);

compileBtn.addEventListener("click", () => {
  clearTimeout(debounceTimer);
  compile();
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    clearTimeout(debounceTimer);
    compile();
  }
});

downloadBtn.addEventListener("click", () => {
  if (!currentPdfUrl) return;
  const a = document.createElement("a");
  a.href = currentPdfUrl;
  a.download = "document.pdf";
  a.click();
});

// Compile once on load so there's something to look at immediately.
compile();
