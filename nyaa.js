/**
 * Nyaa.si & Sukebei.nyaa.si — Unified Extension for Hayase
 * Repository: yatsimuratsuyuno/Anime-Torrent-Test
 * Version: 1.0.0
 */

// ─── Constants ───────────────────────────────────
const SIZE_REGEX = /(\d+(?:\.\d+)?)\s*(GiB|MiB|KiB|GB|MB|KB|B)/i;
const HASH_REGEX = /btih:([a-fA-F0-9]{40})/;

// ─── Utility Functions ───────────────────────────
function parseSize(str) {
  if (!str) return 0;
  const m = str.match(SIZE_REGEX);
  if (!m) return 0;
  let v = parseFloat(m[1]);
  switch ((m[2] || '').toUpperCase()) {
    case 'GIB': case 'GB': v *= 1073741824; break;
    case 'MIB': case 'MB': v *= 1048576; break;
    case 'KIB': case 'KB': v *= 1024; break;
  }
  return Math.round(v);
}

function parseNum(str) {
  return parseInt(str, 10) || 0;
}

function extractHash(link) {
  const m = link.match(HASH_REGEX);
  return m ? m[1].toLowerCase() : '';
}

function detectBatch(title) {
  return /\b(batch|complete|season\s*\d+|1-?\d+|s\d{2})\b/i.test(title)
    ? 'batch'
    : undefined;
}

// ─── RSS Parser ──────────────────────────────────
function parseRSS(xml) {
  const results = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const item = m[1];
    const title = (item.match(/<title>(.*?)<\/title>/i) || [])[1]?.trim() || '';
    const link = (item.match(/<link>(.*?)<\/link>/i) || [])[1] || '';
    const hash = (
      (item.match(/<nyaa:infohash>([a-fA-F0-9]{40})<\/nyaa:infohash>/i) || [])[1] ||
      extractHash(link)
    ).toLowerCase();
    const magnet = `magnet:?xt=urn:btih:${hash}`;

    results.push({
      title,
      link: magnet,
      seeders: parseNum((item.match(/<nyaa:seeders>(\d+)<\/nyaa:seeders>/i) || [])[1]),
      leechers: parseNum((item.match(/<nyaa:leechers>(\d+)<\/nyaa:leechers>/i) || [])[1]),
      downloads: parseNum((item.match(/<nyaa:downloads>(\d+)<\/nyaa:downloads>/i) || [])[1]),
      accuracy: 'medium',
      hash,
      size: parseSize((item.match(/<nyaa:size>(.*?)<\/nyaa:size>/i) || [])[1]),
      date: new Date(((item.match(/<pubDate>(.*?)<\/pubDate>/i) || [])[1]) || Date.now()),
      type: detectBatch(title)
    });
  }
  return results;
}

// ─── HTML Parser (Fallback) ──────────────────────
function parseHTML(html) {
  const results = [];
  const re = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = re.exec(html))) {
    const row = m[1];
    const magnet = (row.match(/href="(magnet:\?xt=urn:btih:[^"]+)"/i) || [])[1];
    if (!magnet) continue;

    const title =
      (row.match(/title="([^"]*?)"/i) || [])[1] ||
      (row.match(/colspan="2"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i) || [])[1]?.trim() ||
      '';
    const hash = extractHash(magnet);
    const seeds = parseNum((row.match(/color:\s*green[^>]*>\s*(\d+)/i) || [])[1]);
    const leech = parseNum((row.match(/color:\s*red[^>]*>\s*(\d+)/i) || [])[1]);
    const size = parseSize((row.match(/>\s*([\d.]+ (?:GiB|MiB|KiB|GB|MB|KB|B))\s*</i) || [])[1]);
    const dateStr = (row.match(/>\s*(\d{4}-\d{2}-\d{2})\s*</i) || [])[1];

    results.push({
      title,
      link: magnet,
      seeders: seeds,
      leechers: leech,
      downloads: 0,
      accuracy: 'medium',
      hash,
      size,
      date: dateStr ? new Date(dateStr) : new Date(),
      type: detectBatch(title)
    });
  }
  return results;
}

// ─── Filter Exclusions ───────────────────────────
function applyExclusions(results, exclusions) {
  if (!exclusions || !exclusions.length) return results;
  return results.filter(r =>
    !exclusions.some(e => r.title.toLowerCase().includes(e.toLowerCase()))
  );
}

// ─── Build Search Query ──────────────────────────
function buildSearchQuery(titles, episode) {
  let q = (titles?.[0] || '').trim();
  if (episode) q += ` ${String(episode).padStart(2, '0')}`;
  return q;
}

// ══════════════════════════════════════════════════
//  MAIN EXTENSION EXPORT
// ══════════════════════════════════════════════════
export default {

  // ── Health Check ─────────────────────────────
  async test() {
    const domains = ['nyaa.si', 'sukebei.nyaa.si'];
    for (const domain of domains) {
      try {
        const res = await fetch(`https://${domain}/`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) return true;
      } catch (_) { /* lanjut domain berikutnya */ }
    }
    throw new Error(
      'Tidak dapat terhubung ke Nyaa.si maupun Sukebei. ' +
      'Periksa koneksi internet atau firewall Anda.'
    );
  },

  // ── Single Episode Search ────────────────────
  async single(query, options) {
    return this._search(query, options);
  },

  // ── Batch Search ─────────────────────────────
  async batch(query, options) {
    return this._search(query, options);
  },

  // ── Movie Search ─────────────────────────────
  async movie(query, options) {
    return this._search(query, options);
  },

  // ── Core Search Logic ────────────────────────
  async _search(query, options = {}) {
    const { titles, episode, exclusions = [], fetch } = query;
    const limit = Math.min(options.limit || 50, 100);
    const filter = options.filter || '0';
    const category = options.category || '0_0';

    const searchQuery = buildSearchQuery(titles, episode);
    if (!searchQuery) {
      throw new Error('Tidak ada judul untuk dicari. Masukkan judul anime terlebih dahulu.');
    }

    // Domain prioritas: nyaa.si dulu, baru sukebei
    const domains = ['nyaa.si', 'sukebei.nyaa.si'];
    let lastError = null;

    for (const domain of domains) {
      try {
        const baseUrl = `https://${domain}`;
        const rssUrl = `${baseUrl}/?page=rss&f=${filter}&c=${category}&q=${encodeURIComponent(searchQuery)}`;

        const res = await fetch(rssUrl);
        if (!res.ok) {
          lastError = `Server ${domain} mengembalikan status ${res.status}`;
          continue;
        }

        const text = await res.text();

        // Deteksi apakah response RSS atau HTML
        let results;
        if (text.includes('<item>')) {
          results = parseRSS(text);
        } else if (text.includes('table-bordered')) {
          results = parseHTML(text);
        } else {
          // Tidak ada hasil atau format tidak dikenal
          continue;
        }

        if (!results.length) continue;

        // Apply exclusions filter
        results = applyExclusions(results, exclusions);

        // Sort by seeders (descending)
        results.sort((a, b) => b.seeders - a.seeders);

        // Limit results
        return results.slice(0, limit);

      } catch (e) {
        lastError = e;
      }
    }

    throw new Error(
      `Pencarian gagal di kedua domain. ${lastError?.message || 'Coba lagi nanti.'}`
    );
  }
};
