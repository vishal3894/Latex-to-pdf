# Typeset — online LaTeX editor with live PDF preview

Type LaTeX on the left, see the compiled PDF on the right. The compiler
(TeX Live + latexmk) runs entirely on the server, inside the Docker
container — your users never install anything.

## What's inside

- `server.js` — Express backend. `POST /api/compile` takes `{ source }`,
  runs `latexmk -pdf` in an isolated temp directory, and returns the
  compiled PDF as base64 (or a log if it failed). Includes size limits,
  a compile timeout, and basic per-IP rate limiting.
- `public/` — Frontend: CodeMirror editor (LaTeX syntax highlighting),
  a PDF preview pane, auto-compile with debounce, Ctrl+Enter to compile,
  and a download button. No build step — plain HTML/CSS/JS.
- `Dockerfile` — Node 20 + a TeX Live install big enough for most
  everyday documents (amsmath, graphicx, hyperref, tikz, biblatex, etc.)
  plus `latexmk`.

## Run it locally

You need Docker (this bundles the ~1–2 GB TeX Live install, so plain
`npm start` on a machine without LaTeX installed won't compile — Docker
is the easiest path):

```bash
docker build -t typeset .
docker run -p 3000:3000 typeset
```

Then open **http://localhost:3000**.

## Deploy it online (so it needs no install on any PC)

Any host that runs a Dockerfile works. Two easy options:

**Render**
1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com), create a new **Web Service**,
   point it at the repo, and pick **Docker** as the environment. Render
   detects the `Dockerfile` automatically.
3. Deploy — you'll get a public URL.

**Fly.io**
```bash
fly launch    # detects the Dockerfile, asks a few questions
fly deploy
```

**Railway**
1. New Project → Deploy from GitHub repo.
2. Railway detects the `Dockerfile` and builds/deploys automatically.

Note: the first build installs TeX Live (~1–2 GB), so the initial
deploy can take several minutes; rebuilds after code-only changes are
much faster since Docker caches that layer.

## Notes on limits (tune in `server.js`)

- `MAX_SOURCE_BYTES` — max LaTeX source size (default 300 KB).
- `COMPILE_TIMEOUT_MS` — kills runaway compiles (default 25s).
- `RATE_LIMIT` — max compiles per IP per minute (default 12).

## Extending it

- **Multi-file projects / image uploads**: extend `/api/compile` to
  accept a zip or multiple files and write them all into the job
  directory before running `latexmk`.
- **Bibliography**: `latexmk -pdf` already runs `bibtex`/`biber`
  automatically when it detects citations, as long as the `.bib` file
  is present in the job directory.
- **Persistence**: currently nothing is saved between sessions. Add a
  database or `localStorage`-based autosave if users should be able to
  come back to a document.
