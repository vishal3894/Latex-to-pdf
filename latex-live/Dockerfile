FROM node:20-slim

# Install a TeX Live distribution large enough to cover common packages
# (amsmath, graphicx, hyperref, geometry, biblatex, tikz, etc.) plus
# latexmk, which handles multi-pass compiles (refs/TOC/bibliography)
# automatically.
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-science \
    texlive-pictures \
    latexmk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
