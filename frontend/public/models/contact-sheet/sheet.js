const $$ = (s) => [...document.querySelectorAll(s)];
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
const set = (id, v) => { const n = document.getElementById(id); if (n && v) n.textContent = v; };
const pad = (n) => String(n).padStart(2, '0');
const lb = document.querySelector("#lb");

function open(img) {
  $('#lbImg').src = img.filePath; $('#lbImg').alt = img.altText || img.title || '';
  $('#lbCap').textContent = img.title + (img.collection ? ' · ' + img.collection : '');
  lb.showModal();
}
function frame(img, n) {
  const b = el('button', 'frame'); b.type = 'button'; b.setAttribute('aria-label', 'View ' + (img.title || 'image'));
  const c = el('span', 'clip'), i = new Image();
  i.src = img.filePath; i.alt = img.altText || img.title || ''; i.loading = 'lazy'; i.width = 400; i.height = 500;
  c.append(i); b.append(c); b.addEventListener('click', () => open(img)); return b;
}
function render(d) {
  const h = d.home.homepage || {};
  set('siteTitle', d.home.siteTitle); set('siteSubtitle', d.home.siteSubtitle);
  ['workEyebrow','workHeadline','aboutEyebrow','aboutHeadline','aboutDetail','contactEyebrow','contactHeadline','contactDetail'].forEach((k) => set(k, h[k]));
  const cols = $('#collections'); cols.replaceChildren();
  d.collections.forEach((c, k) => {
    const row = el('article', 'col rv'), t = el('div');
    t.append(el('span', 'n', 'Roll ' + pad(k + 1) + ' · ' + c.images.length + (c.images.length === 1 ? ' frame' : ' frames')), el('h3', '', c.title), el('p', '', c.description));
    const th = el('div', 'thumbs');
    if (!c.images.length) th.append(el('p', 'empty', 'No frames on this roll yet.'));
    c.images.slice(0, 4).forEach((im) => th.append(frame({ ...im, collection: c.title })));
    row.append(t, th); cols.append(row);
  });
  const sheet = $('#sheet'); sheet.replaceChildren();
  if (!d.images.length) sheet.append(el('p', 'empty', 'The contact sheet is empty for now.'));
  else { const ul = el('ul', 'sheet');
    d.images.forEach((im, k) => { const li = el('li', 'rv'); const cap = el('div', 'cap');
      cap.append(el('b', '', im.title), el('span', '', pad(k + 1) + ' / ' + pad(d.images.length)));
      li.append(frame(im), cap); ul.append(li); });
    sheet.append(ul); }
  const hs = $('#heroStrip'); hs.replaceChildren();
  d.images.slice(0, 6).forEach((im) => { const li = el('li'), f = frame(im); li.append(f); hs.append(li); });
  $('#total').textContent = d.images.length;
  observe();
}
function observe() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .1 });
  $$('.rv').forEach((n) => io.observe(n));
}
$('#lbClose').addEventListener('click', () => lb.close());
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
$('#yr').textContent = new Date().getFullYear();
$('#form').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target, m = $('#formMsg');
  m.textContent = f.checkValidity() ? 'Thank you. This is a design preview; nothing was sent.' : 'Please fill in name, a valid email and a message.';
  if (!f.checkValidity()) f.reportValidity();
});
loadSite().then(render).catch(() => {
  $('#collections').replaceChildren(el('p', 'empty', 'Collections are unavailable right now.'));
  $('#sheet').replaceChildren(el('p', 'empty', 'Images are unavailable right now.'));
});
