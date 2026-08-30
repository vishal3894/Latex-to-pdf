# Install the full TeX Live distribution. Since end users can type
# *any* LaTeX package, a partial install (e.g. texlive-latex-extra +
# texlive-science) will keep failing on whichever package it happens
# to be missing (chemfig, pstricks, some font, etc.) one at a time.
# texlive-full covers virtually all of CTAN, so arbitrary documents
# compile reliably. Trade-off: a much larger image (~4-5 GB) and a
# slower first build — later builds are fast since Docker caches this
# layer as long as this line doesn't change.
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-full \
    latexmk \
    && rm -rf /var/lib/apt/lists/*
 
WORKDIR /app
 
COPY package*.json ./
RUN npm install --omit=dev
 
COPY . .
 
ENV PORT=3000
EXPOSE 3000
 
CMD ["node", "server.js"]
 
