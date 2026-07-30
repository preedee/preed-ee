/* Trip page photo edit mode.
   Loaded by each trip page only when ?edit is in the URL. Adds remove/add controls to the
   day photo galleries (.snaps[id^="snaps-"]) and commits changes via the Contents API:
   photos go straight to the public repo (preed-ee), the page HTML goes to the private
   source repo (preed-ee-src), whose Action re-encrypts and publishes (~2 min to live).
   Auth: fine-grained PAT (contents:write on preedee/preed-ee AND preedee/preed-ee-src),
   pasted once, kept in localStorage — never in this file, never in the repo. */
(() => {
  'use strict';
  if (!new URLSearchParams(location.search).has('edit')) return;
  if (window.top !== window.self) return;   // never editable inside a frame (clickjacked commits)

  const OWNER = 'preedee', REPO = 'preed-ee', SRC_REPO = 'preed-ee-src', BRANCH = 'main';
  const TOKEN_KEY = 'tripEditToken';
  const pathMatch = location.pathname.match(/\/trips\/([^/]+)\//);
  if (!pathMatch) { console.warn('[edit] not a /trips/<slug>/ URL'); return; }
  const REPO_DIR = 'docs/trips/' + pathMatch[1];            // public: photos + encrypted output
  const SRC_DIR = 'pages/trips/' + pathMatch[1];            // private: plaintext HTML source
  const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/`;
  const SRC_API = `https://api.github.com/repos/${OWNER}/${SRC_REPO}/contents/`;

  const galleries = [...document.querySelectorAll('.snaps[id^="snaps-"]')];
  if (!galleries.length) { console.warn('[edit] no snaps galleries found'); return; }

  const staged = { adds: [], removals: new Set() };  // adds: {key, name, blob, w, h, alt, previewEl}

  /* ---------- UI scaffolding ---------- */

  const css = document.createElement('style');
  css.textContent = `
    .ed-btn { font: 600 0.85rem/1 sans-serif; padding: 0.6rem 0.9rem; border-radius: 6px;
      border: 1px dashed currentColor; background: transparent; color: inherit; cursor: pointer;
      opacity: 0.75; margin: 0.4rem 0 0.8rem; min-height: 44px; }
    .ed-btn:hover { opacity: 1; }
    .snaps img { cursor: pointer; }
    .snaps img.ed-removed { opacity: 0.3; outline: 3px solid #c0392b; outline-offset: -3px; }
    .snaps img.ed-staged { outline: 3px solid #27ae60; outline-offset: -3px; }
    #ed-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 99;
      display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;
      padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
      background: #1d1d1f; color: #f5f5f4; font: 0.9rem/1.4 sans-serif;
      box-shadow: 0 -2px 12px rgba(0,0,0,0.35); }
    #ed-bar button { font: 600 0.9rem/1 sans-serif; padding: 0.6rem 1.1rem; border-radius: 6px;
      border: none; cursor: pointer; min-height: 44px; }
    #ed-save { background: #27ae60; color: #fff; }
    #ed-save:disabled { background: #555; cursor: default; }
    #ed-token-link { background: transparent; color: #9ad; text-decoration: underline; padding: 0.6rem 0.2rem; }
    #ed-status.err { color: #ff8a80; }
    #ed-status.ok { color: #8ae08a; }
    .ed-panel { position: fixed; left: 50%; bottom: 5.5rem; transform: translateX(-50%);
      z-index: 100; width: min(420px, calc(100vw - 2rem)); background: #26262a; color: #f5f5f4;
      border-radius: 10px; padding: 1rem; font: 0.9rem/1.45 sans-serif;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
    .ed-panel img { max-width: 100%; max-height: 180px; object-fit: contain; border-radius: 6px;
      display: block; margin: 0 auto 0.6rem; }
    .ed-panel input { width: 100%; box-sizing: border-box; padding: 0.55rem 0.6rem; margin: 0.4rem 0 0.7rem;
      border-radius: 6px; border: 1px solid #555; background: #1b1b1e; color: #fff; font: inherit; }
    .ed-panel .ed-row { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .ed-panel button { font: 600 0.85rem/1 sans-serif; padding: 0.55rem 1rem; border-radius: 6px;
      border: none; cursor: pointer; min-height: 44px; }
    .ed-panel .ed-primary { background: #27ae60; color: #fff; }
    .ed-panel .ed-ghost { background: #3a3a3f; color: #ddd; }
    body { padding-bottom: 6rem; }`;
  document.head.appendChild(css);

  const bar = document.createElement('div');
  bar.id = 'ed-bar';
  bar.innerHTML = `<span id="ed-count"></span>
    <span id="ed-status" role="status"></span>
    <span style="flex:1"></span>
    <button id="ed-token-link" type="button">🔑 token</button>
    <button id="ed-save" type="button" disabled>Save changes</button>`;
  document.body.appendChild(bar);
  const countEl = bar.querySelector('#ed-count');
  const statusEl = bar.querySelector('#ed-status');
  const saveBtn = bar.querySelector('#ed-save');

  const status = (msg, cls) => { statusEl.textContent = msg; statusEl.className = cls || ''; };
  const refreshBar = () => {
    const n = staged.adds.length, m = staged.removals.size;
    countEl.textContent = n || m
      ? `${n} to add · ${m} to remove`
      : 'Edit mode — tap a photo to remove it, or use ＋ Add photos.';
    saveBtn.disabled = !(n || m);
  };
  refreshBar();

  /* Simple modal: builder wires its own buttons to done(value); done(null) = cancel */
  const panel = (buildInner) => new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'ed-panel';
    buildInner(box, (v) => { box.remove(); resolve(v); });
    document.body.appendChild(box);
  });

  const askToken = () => panel((box, done) => {
    box.innerHTML = `<b>GitHub token needed</b>
      <p style="margin:0.4rem 0">Fine-grained PAT · repo <code>${OWNER}/${REPO}</code> · Contents: read &amp; write. Stored only in this browser.</p>
      <input type="password" placeholder="github_pat_…" autocomplete="off">
      <div class="ed-row"><button class="ed-ghost" type="button">Cancel</button>
      <button class="ed-primary" type="button">Save token</button></div>`;
    const input = box.querySelector('input');
    box.querySelector('.ed-ghost').onclick = () => done(null);
    box.querySelector('.ed-primary').onclick = () => {
      const t = input.value.trim();
      if (t) localStorage.setItem(TOKEN_KEY, t);
      done(t || null);
    };
    input.focus();
  });

  const askAlt = (blobUrl, fileName) => panel((box, done) => {
    box.innerHTML = `<img alt="">
      <b>Describe this photo</b> <span class="ed-fn" style="opacity:0.7"></span>
      <input type="text" placeholder="e.g. Kids under the Rain Vortex" maxlength="160">
      <div class="ed-row"><button class="ed-ghost" type="button">Skip photo</button>
      <button class="ed-primary" type="button">Add photo</button></div>`;
    box.querySelector('img').src = blobUrl;                      // property, never markup
    box.querySelector('.ed-fn').textContent = `(${fileName})`;   // file names are untrusted
    const input = box.querySelector('input');
    const submit = () => done(input.value.trim() || 'Trip photo');
    box.querySelector('.ed-ghost').onclick = () => done(null);
    box.querySelector('.ed-primary').onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    input.focus();
  });

  /* ---------- gallery wiring ---------- */

  /* The page's own lazy-load swaps data-src into src and drops the attribute when a day
     is expanded, so a gallery photo may carry either one. Staged previews (blob:) have neither. */
  const fileNameOf = (img) => {
    const raw = img.getAttribute('data-src') || (img.src.startsWith('blob:') ? '' : img.src);
    return raw ? raw.split('/').pop().split('?')[0] : '';
  };

  const usedNames = () => new Set(
    [...document.querySelectorAll('.snaps img')].map(fileNameOf).filter(Boolean)
      .concat(staged.adds.map((a) => a.name))
  );

  const uniqueName = (key, alt) => {
    const taken = usedNames();
    const slug = alt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'photo';
    let name = `${key}-${slug}.jpg`;
    for (let i = 2; taken.has(name); i++) name = `${key}-${slug}-${i}.jpg`;
    return name;
  };

  const resizeToJpeg = async (file) => {
    const bmp = await createImageBitmap(file).catch(() => {
      throw new Error(`Cannot decode ${file.name} — export it as JPEG and retry`);
    });
    const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.72));
    if (!blob) throw new Error(`JPEG encode failed for ${file.name}`);
    return { blob, w: c.width, h: c.height };
  };

  document.addEventListener('click', (e) => {
    const img = e.target.closest('.snaps[id^="snaps-"] img');
    if (!img) return;
    if (img.classList.contains('ed-staged')) {   // un-stage a pending add
      staged.adds = staged.adds.filter((a) => a.previewEl !== img);
      URL.revokeObjectURL(img.src);
      img.remove();
    } else {
      const name = fileNameOf(img);
      if (!name) return;
      img.classList.toggle('ed-removed');
      img.classList.contains('ed-removed') ? staged.removals.add(name) : staged.removals.delete(name);
    }
    refreshBar();
  });

  galleries.forEach((gal) => {
    const key = gal.id.replace(/^snaps-/, '');

    const picker = document.createElement('input');
    picker.type = 'file'; picker.accept = 'image/*'; picker.multiple = true; picker.hidden = true;

    const addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'ed-btn';
    addBtn.textContent = `＋ Add photos (${key})`;
    addBtn.onclick = () => picker.click();
    gal.after(addBtn, picker);

    picker.addEventListener('change', async () => {
      const jobs = [...picker.files].map((file) => ({ file, resized: resizeToJpeg(file) }));
      picker.value = '';
      for (const { file, resized } of jobs) {   // resizes run while alt text is being typed
        try {
          const { blob, w, h } = await resized;
          const url = URL.createObjectURL(blob);
          const alt = await askAlt(url, file.name);
          if (alt === null) { URL.revokeObjectURL(url); continue; }
          const img = document.createElement('img');
          img.src = url; img.alt = alt; img.width = w; img.height = h;
          img.className = 'ed-staged' + (w > h ? ' land' : '');
          gal.appendChild(img);
          staged.adds.push({ key, name: uniqueName(key, alt), blob, w, h, alt, previewEl: img });
        } catch (err) {
          status(err.message, 'err');
        }
      }
      refreshBar();
    });
  });

  /* ---------- persistence ---------- */

  const call = async (base, path, opts = {}) => {
    const res = await fetch(base + path, {
      ...opts,
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem(TOKEN_KEY),
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      const hint = res.status === 401 || res.status === 403 || res.status === 404
        ? ' — check your token (🔑) covers preed-ee AND preed-ee-src, and that the source file exists' : '';
      throw Object.assign(new Error(`GitHub ${res.status}: ${detail.message || res.statusText}${hint}`), { httpStatus: res.status });
    }
    return res.json();
  };
  const api = (path, opts) => call(API, path, opts);       // public repo: photos + encrypted output
  const srcApi = (path, opts) => call(SRC_API, path, opts); // private repo: plaintext HTML source

  const blobToBase64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Could not read image data'));
    r.readAsDataURL(blob);
  });

  const b64ToText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
  const textToB64 = (text) => blobToBase64(new Blob([text]));

  const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* Canonical generator of the gallery img markup — mirrors STANDARDS.md "Images" and TEMPLATE. */
  const imgTag = (a) => {
    const land = a.w > a.h;
    const [vw, vh] = land ? [4, 3] : [3, 4];
    return `<img${land ? ' class="land"' : ''} data-src="img/${a.name}" src="data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 ${vw} ${vh}%22><rect width=%22${vw}%22 height=%22${vh}%22 fill=%22%23aab5aa%22/></svg>" width="${vw * 160}" height="${vh * 160}" alt="${escHtml(a.alt)}" loading="lazy">`;
  };

  const transformHtml = (html) => {
    for (const name of staged.removals) {
      const m = html.match(new RegExp(`[ \\t]*<img[^>]*data-src="img/${escRe(name)}"[^>]*>\\n?`));
      if (!m) throw new Error(`Could not find img/${name} in page source — page may have changed; reload and retry`);
      html = html.replace(m[0], '');
    }
    const byKey = {};
    staged.adds.forEach((a) => (byKey[a.key] = byKey[a.key] || []).push(a));
    for (const [key, adds] of Object.entries(byKey)) {
      const open = html.indexOf(`id="snaps-${key}"`);
      if (open === -1) throw new Error(`Gallery snaps-${key} missing from page source — reload and retry`);
      const indent = html.slice(html.lastIndexOf('\n', open) + 1).match(/^[ \t]*/)[0];
      const close = html.indexOf('</div>', open);
      const head = html.slice(0, close).replace(/[ \t\n]+$/, '');
      html = head + '\n' + adds.map((a) => indent + '  ' + imgTag(a)).join('\n') + '\n' + indent + html.slice(close);
    }
    return html;
  };

  const commitAll = async () => {
    status('Reading page source…');
    // Transform first: a source-parse failure must abort BEFORE any image commit lands.
    const loadSource = async () => {
      const src = await srcApi(`${SRC_DIR}/index.html?ref=${BRANCH}`);
      return { sha: src.sha, html: transformHtml(b64ToText(src.content)) };
    };
    status('Preparing images…');
    const [cur, contents] = await Promise.all([
      loadSource(),
      Promise.all(staged.adds.map((a) => blobToBase64(a.blob))),
    ]);
    for (let i = 0; i < staged.adds.length; i++) {   // sequential: each PUT is a commit on main
      status(`Uploading ${staged.adds[i].name}…`);
      await api(`${REPO_DIR}/img/${staged.adds[i].name}`, {
        method: 'PUT',
        body: JSON.stringify({ message: `trip photos: add ${staged.adds[i].name}`, content: contents[i], branch: BRANCH }),
      });
    }
    status('Updating page…');
    const put = async ({ sha, html }) => srcApi(`${SRC_DIR}/index.html`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `trip photos: ${staged.adds.length} added, ${staged.removals.size} removed`,
        content: await textToB64(html),
        sha,
        branch: BRANCH,
      }),
    });
    try { await put(cur); }
    catch (e) {
      if (e.httpStatus !== 409) throw e;   // stale sha: refetch + retransform once
      await put(await loadSource());
    }
    for (const name of staged.removals) {   // page no longer references these; failures leave harmless orphans
      try {
        const file = await api(`${REPO_DIR}/img/${name}?ref=${BRANCH}`);
        await api(`${REPO_DIR}/img/${name}`, {
          method: 'DELETE',
          body: JSON.stringify({ message: `trip photos: delete ${name}`, sha: file.sha, branch: BRANCH }),
        });
      } catch (e) {
        if (e.httpStatus !== 404) console.warn('[edit] could not delete', name, e.message);
      }
    }
  };

  bar.querySelector('#ed-token-link').onclick = askToken;

  saveBtn.onclick = async () => {
    if (!confirm(`Commit to preed.ee?\n\n${staged.adds.length} photo(s) added\n${staged.removals.size} photo(s) removed`)) return;
    if (!localStorage.getItem(TOKEN_KEY) && !(await askToken())) return;
    saveBtn.disabled = true;
    try {
      await commitAll();
      document.querySelectorAll('.snaps img.ed-removed').forEach((i) => i.remove());
      document.querySelectorAll('.snaps img.ed-staged').forEach((i) => i.classList.remove('ed-staged'));
      staged.adds = []; staged.removals.clear();
      refreshBar();
      status('Committed ✓ — encrypted page rebuilds via Action, live in ~2 min', 'ok');
    } catch (err) {
      status(err.message, 'err');
      refreshBar();
    }
  };
})();
