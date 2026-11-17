// Loads the real site data from the API (same origin). Rejects when the API is unreachable.
async function loadSite() {
  const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(u))));
  const home = await get('/api/home');
  const collections = await Promise.all(home.collections.map((c) => get('/api/collections/' + c.slug)));
  return { home, collections, images: collections.flatMap((c) => c.images.map((i) => ({ ...i, collection: c.title }))) };
}
const $ = (s) => document.querySelector(s);
