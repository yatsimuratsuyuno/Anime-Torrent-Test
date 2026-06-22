// Ekstensi untuk Sukebei Nyaa (sukebei.nyaa.si) oleh yatsimuratsuyuno
// Repository: Anime-Torrent-Test

const BASE_URL = "https://sukebei.nyaa.si";

// Fungsi bantu untuk membuat delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fungsi bantu untuk parsing ukuran file dari string ke byte
function parseSizeToBytes(sizeStr) {
  if (!sizeStr) return 0;
  const units = {
    B: 1,
    KiB: 1024,
    MiB: 1024 * 1024,
    GiB: 1024 * 1024 * 1024,
    TiB: 1024 * 1024 * 1024 * 1024,
  };
  const regex = /([\d.]+)\s*(B|KiB|MiB|GiB|TiB)/;
  const match = sizeStr.match(regex);
  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[2];
    return value * (units[unit] || 0);
  }
  return 0;
}

// Fungsi bantu untuk parsing tanggal
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  // Format di Nyaa biasanya: "2024-01-15 12:30" atau "2024-01-15 12:30 UTC"
  // Bisa juga "Today", "Yesterday", "3 days ago", dll
  const now = new Date();
  const lowerDate = dateStr.toLowerCase().trim();

  if (lowerDate === "today") return now;
  if (lowerDate === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // Coba parsing format standar
  const dateMatch = dateStr.match(
    /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/
  );
  if (dateMatch) {
    return new Date(
      `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:00`
    );
  }

  // Fallback untuk format "X days ago", "X hours ago", "X minutes ago"
  const agoMatch = dateStr.match(/(\d+)\s+(day|hour|minute|min|sec)/);
  if (agoMatch) {
    const value = parseInt(agoMatch[1]);
    const unit = agoMatch[2];
    const pastDate = new Date(now);
    if (unit.startsWith("day")) pastDate.setDate(pastDate.getDate() - value);
    else if (unit.startsWith("hour"))
      pastDate.setHours(pastDate.getHours() - value);
    else if (unit.startsWith("min"))
      pastDate.setMinutes(pastDate.getMinutes() - value);
    else if (unit.startsWith("sec"))
      pastDate.setSeconds(pastDate.getSeconds() - value);
    return pastDate;
  }

  return now;
}

// Fungsi untuk membangun query pencarian yang efektif
function buildSearchQuery(query, options = {}) {
  const titles = query.titles || [];
  const episode = query.episode;
  const episodeCount = query.episodeCount;
  const resolution = query.resolution || "";
  const exclusions = query.exclusions || [];
  const excludeBatched = options.exclude_batched || false;

  // Cari judul yang paling pendek dan paling mungkin memberikan hasil terbaik
  let mainTitle = titles[0] || "";
  // Prioritaskan judul romaji yang biasanya lebih pendek dan umum
  for (const title of titles) {
    if (title && title.length < mainTitle.length && /^[a-zA-Z0-9\s!-]+$/.test(title)) {
      mainTitle = title;
    }
  }

  let searchTerms = [];

  // Tambahkan judul utama dalam tanda kutip untuk pencarian tepat
  searchTerms.push(`"${mainTitle}"`);

  // Tambahkan nomor episode
  if (episode) {
    const epStr = episode.toString().padStart(2, "0");
    searchTerms.push(epStr);
    // Beberapa rilis menggunakan format "01-12" untuk batch
    if (episodeCount && episode === 1 && !excludeBatched) {
      const batchEpStr = episodeCount.toString().padStart(2, "0");
      searchTerms.push(`1-${batchEpStr}`);
    }
  }

  // Tambahkan resolusi
  if (resolution && resolution !== "") {
    searchTerms.push(resolution + "p");
  }

  // Build exclusion string
  let queryString = searchTerms.join(" ");

  // Tambahkan filter untuk mengeluarkan kata kunci
  if (exclusions && exclusions.length > 0) {
    exclusions.forEach((excl) => {
      queryString += ` -"${excl}"`;
    });
  }

  // Exclude batch jika opsi diaktifkan
  if (excludeBatched) {
    queryString += ' -"batch" -"complete" -"complete series"';
  }

  return queryString.trim();
}

// Fungsi untuk parsing satu baris tabel hasil pencarian
function parseTorrentRow(row, fetchFunc) {
  try {
    const cells = row.querySelectorAll("td");
    if (cells.length < 8) return null;

    const categoryCell = cells[0];
    const titleCell = cells[1];
    const linkCell = cells[2];
    const sizeCell = cells[3];
    const dateCell = cells[4];
    const seedersCell = cells[5];
    const leechersCell = cells[6];
    const downloadsCell = cells[7];

    // Ambil judul dan tautan
    const titleLinks = titleCell.querySelectorAll("a");
    let title = "";
    let link = "";
    let hash = "";
    let id = null;

    if (titleLinks.length > 0) {
      title = titleLinks[titleLinks.length - 1].textContent.trim();
    }

    // Cari tautan magnet atau torrent
    const allLinks = linkCell.querySelectorAll("a");
    for (const a of allLinks) {
      const href = a.getAttribute("href") || "";
      if (href.includes("magnet:")) {
        link = href;
        const hashMatch = href.match(/btih:([a-fA-F0-9]{40})/);
        if (hashMatch) hash = hashMatch[1].toLowerCase();
      } else if (href.includes(".torrent")) {
        // Gunakan tautan torrent jika tidak ada magnet
        if (!link) {
          link = href.startsWith("http") ? href : BASE_URL + href;
        }
        // Ekstrak ID dari URL
        const idMatch = href.match(/view\/(\d+)/);
        if (idMatch) id = parseInt(idMatch[1]);
      }
    }

    if (!title || !link) return null;

    // Parse seeders, leechers, downloads
    const seeders = parseInt(seedersCell.textContent.trim()) || 0;
    const leechers = parseInt(leechersCell.textContent.trim()) || 0;
    const downloads = parseInt(downloadsCell.textContent.trim()) || 0;

    // Parse ukuran
    const sizeStr = sizeCell.textContent.trim();
    const size = parseSizeToBytes(sizeStr);

    // Parse tanggal
    const dateStr = dateCell.textContent.trim();
    const date = parseDate(dateStr);

    return {
      title,
      link,
      id,
      seeders,
      leechers,
      downloads,
      accuracy: "low", // Karena ini adalah pencarian string, akurasi rendah
      hash,
      size,
      date,
    };
  } catch (error) {
    console.error("Error parsing torrent row:", error);
    return null;
  }
}

// Fungsi utama untuk melakukan pencarian
async function performSearch(query, fetchFunc, options = {}, isMovie = false) {
  const searchQuery = buildSearchQuery(query, options);
  const filterTrusted = options.filter_trusted || false;

  // Parameter untuk URL Nyaa
  const params = new URLSearchParams();
  params.append("f", "0"); // No filter
  params.append("c", "0_0"); // All categories (bisa disesuaikan)
  params.append("q", searchQuery);
  params.append("s", "seeders"); // Sort by seeders
  params.append("o", "desc"); // Descending order

  if (filterTrusted) {
    params.append("f", "2"); // Trusted only
  }

  const searchUrl = `${BASE_URL}/?${params.toString()}`;

  try {
    const response = await fetchFunc(searchUrl);
    if (!response.ok) {
      throw new Error(
        `Gagal terhubung ke Sukebei Nyaa (HTTP ${response.status}). Coba lagi nanti.`
      );
    }

    const html = await response.text();

    // Parse HTML response
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Cari tabel hasil
    const table = doc.querySelector("table.torrent-list");
    if (!table) {
      // Coba selector alternatif
      const altTable = doc.querySelector("table.table");
      if (!altTable) {
        // Cek apakah ada pesan tidak ada hasil
        const noResults = doc.querySelector(".no-results");
        if (noResults) {
          return []; // Tidak ada hasil
        }
        throw new Error(
          "Format halaman Sukebei Nyaa berubah. Tidak dapat menemukan tabel hasil."
        );
      }
      const rows = altTable.querySelectorAll("tbody tr");
      if (rows.length === 0) return [];

      const results = [];
      for (const row of rows) {
        if (row.classList.contains("success") || row.querySelector("td")) {
          const result = parseTorrentRow(row, fetchFunc);
          if (result) results.push(result);
        }
      }
      return results;
    }

    const rows = table.querySelectorAll("tbody tr");
    if (rows.length === 0) return [];

    const results = [];
    for (const row of rows) {
      const result = parseTorrentRow(row, fetchFunc);
      if (result) results.push(result);
    }

    return results;
  } catch (error) {
    if (error.message.includes("Format halaman") || error.message.includes("Gagal terhubung")) {
      throw error;
    }
    throw new Error(
      `Error saat mengakses Sukebei Nyaa: ${error.message}. Periksa koneksi internet Anda.`
    );
  }
}

// Ekspor default extension
export default {
  /**
   * Test method untuk memastikan ekstensi berfungsi
   */
  async test() {
    try {
      const testQuery = {
        titles: ["test"],
        episode: 1,
        resolution: "",
        exclusions: [],
        fetch: globalThis.fetch,
        media: null,
        anilistId: 0,
      };

      const response = await fetch(`${BASE_URL}/?q=test&s=seeders&o=desc`);
      if (!response.ok) {
        throw new Error(
          `Tidak dapat terhubung ke Sukebei Nyaa (Status: ${response.status})`
        );
      }

      const html = await response.text();
      if (html.includes("torrent-list") || html.includes("table")) {
        return true;
      }
      throw new Error(
        "Respons dari Sukebei Nyaa tidak sesuai format yang diharapkan. Mungkin halaman sedang dalam pemeliharaan."
      );
    } catch (error) {
      if (error.message.includes("Sukebei Nyaa")) {
        throw error;
      }
      throw new Error(
        `Ekstensi Sukebei Nyaa tidak berfungsi: ${error.message}. Pastikan situs dapat diakses.`
      );
    }
  },

  /**
   * Single search method untuk pencarian episode tunggal
   */
  async single(query, options = {}) {
    return performSearch(query, query.fetch, options, false);
  },

  /**
   * Batch search method untuk pencarian batch
   */
  async batch(query, options = {}) {
    // Untuk batch, kita tambahkan kata kunci batch
    const batchQuery = {
      ...query,
      titles: query.titles.map((t) => t + " batch"),
    };
    // Juga tambahkan judul asli
    batchQuery.titles = [...batchQuery.titles, ...query.titles];

    const results = await performSearch(batchQuery, query.fetch, options, false);

    // Tandai hasil sebagai batch
    return results.map((result) => ({
      ...result,
      type: result.type || "batch",
    }));
  },

  /**
   * Movie search method
   */
  async movie(query, options = {}) {
    // Untuk movie, kita tambahkan kata kunci movie
    const movieQuery = {
      ...query,
      titles: query.titles.map((t) => t + " movie"),
    };
    movieQuery.titles = [...movieQuery.titles, ...query.titles];

    return performSearch(movieQuery, query.fetch, options, true);
  },
};
