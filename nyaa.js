const BASE_URL = "https://nyaa.si";

function parseSizeToBytes(sizeStr) {
  if (!sizeStr) return 0;
  const units = {
    'B': 1,
    'KiB': 1024,
    'MiB': 1048576,
    'GiB': 1073741824,
    'TiB': 1099511627776
  };
  const match = sizeStr.match(/([\d.]+)\s*(B|KiB|MiB|GiB|TiB)/);
  if (match) {
    return parseFloat(match[1]) * units[match[2]];
  }
  return 0;
}

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (match) {
    return new Date(match[1], match[2] - 1, match[3], match[4], match[5]);
  }
  return new Date();
}

function parseRow(row) {
  try {
    const cells = row.querySelectorAll("td");
    if (cells.length < 8) return null;

    const titleCell = cells[1];
    const links = cells[2].querySelectorAll("a");
    const sizeStr = cells[3].textContent.trim();
    const dateStr = cells[4].textContent.trim();
    const seeders = parseInt(cells[5].textContent.trim()) || 0;
    const leechers = parseInt(cells[6].textContent.trim()) || 0;
    const downloads = parseInt(cells[7].textContent.trim()) || 0;

    const titleLinks = titleCell.querySelectorAll("a");
    let title = "";
    if (titleLinks.length > 0) {
      title = titleLinks[titleLinks.length - 1].textContent.trim();
    }

    let link = "";
    let hash = "";

    for (const a of links) {
      const href = a.getAttribute("href") || "";
      if (href.includes("magnet:")) {
        link = href;
        const hashMatch = href.match(/btih:([a-fA-F0-9]{40})/);
        if (hashMatch) hash = hashMatch[1].toLowerCase();
      } else if (href.includes(".torrent") && !link) {
        link = href.startsWith("http") ? href : BASE_URL + href;
      }
    }

    if (!title || !link) return null;

    return {
      title: title,
      link: link,
      seeders: seeders,
      leechers: leechers,
      downloads: downloads,
      accuracy: "low",
      hash: hash,
      size: parseSizeToBytes(sizeStr),
      date: parseDate(dateStr)
    };
  } catch (e) {
    return null;
  }
}

async function performSearch(query, options = {}) {
  const titles = query.titles || [];
  const episode = query.episode;
  const exclusions = query.exclusions || [];
  const fetchFunc = query.fetch || fetch;
  
  let mainTitle = titles[0] || "";
  for (const t of titles) {
    if (t && /^[a-zA-Z0-9\s]+$/.test(t) && t.length <= mainTitle.length) {
      mainTitle = t;
    }
  }

  let searchQuery = mainTitle;
  if (episode) {
    searchQuery += " " + episode.toString().padStart(2, "0");
  }
  if (query.resolution) {
    searchQuery += " " + query.resolution + "p";
  }
  for (const e of exclusions) {
    searchQuery += " -" + e;
  }
  if (options.exclude_batched) {
    searchQuery += " -batch -complete";
  }

  const params = new URLSearchParams({
    f: options.filter_trusted ? "2" : "0",
    c: "0_0",
    q: searchQuery,
    s: "seeders",
    o: "desc"
  });

  const response = await fetchFunc(BASE_URL + "/?" + params.toString());
  if (!response.ok) {
    throw new Error("Failed to connect to Nyaa.si");
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const rows = doc.querySelectorAll("table.torrent-list tbody tr, table.table tbody tr");

  const results = [];
  for (const row of rows) {
    const result = parseRow(row);
    if (result) results.push(result);
  }

  return results;
}

export default {
  async test() {
    const resp = await fetch(BASE_URL);
    if (!resp.ok) throw new Error("Cannot reach Nyaa.si");
    return true;
  },

  async single(query, options = {}) {
    return performSearch(query, options);
  },

  async batch(query, options = {}) {
    return performSearch(query, options);
  },

  async movie(query, options = {}) {
    return performSearch(query, options);
  }
};
