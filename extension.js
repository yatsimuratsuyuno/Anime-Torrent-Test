// extension.js

export default {
  // Fungsi test untuk memastikan URL base Sukebei bisa dijangkau
  async test() {
    try {
      // Kita menggunakan context fetch dari global Web Worker
      const response = await fetch("https://sukebei.nyaa.si/?page=rss&q=test&c=0_0&f=0");
      if (!response.ok) throw new Error(`Situs merespons dengan status: ${response.status}`);
      return true;
    } catch (error) {
      throw new Error(`Gagal terhubung ke Sukebei: ${error.message}`);
    }
  },

  async single(query, options) {
    return await searchSukebei(query, 'single');
  },

  async batch(query, options) {
    return await searchSukebei(query, 'batch');
  },

  async movie(query, options) {
    return await searchSukebei(query, 'movie');
  }
};

/**
 * Fungsi pembantu untuk mencari dan mem-parsing data RSS dari Sukebei
 */
async function searchSukebei(query, type) {
  const { titles, episode, resolution, fetch } = query;
  
  // Mengambil judul utama dari daftar judul
  let searchQuery = titles[0] || '';
  
  // Modifikasi query berdasarkan tipe pencarian
  if (type === 'single') {
    // Menambahkan format episode dua digit (misal: 01, 02) jika di bawah 10
    const epString = episode < 10 ? `0${episode}` : episode;
    searchQuery += ` ${epString}`;
  } else if (type === 'batch') {
    searchQuery += ` batch`;
  }

  // Jika resolusi dispesifikasikan (misal: 1080)
  if (resolution) {
    searchQuery += ` ${resolution}p`;
  }

  // URL RSS feed Sukebei
  const url = `https://sukebei.nyaa.si/?page=rss&q=${encodeURIComponent(searchQuery)}&c=0_0&f=0`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Sukebei merespons dengan status error: ${response.status}`);
    }
    
    const text = await response.text();
    const results = [];
    
    // Web Worker tidak memiliki DOMParser, gunakan Regex untuk parse RSS (XML)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const itemXml = match[1];

      // Ekstraksi data menggunakan Regex
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
      const hashMatch = itemXml.match(/<nyaa:infoHash>(.*?)<\/nyaa:infoHash>/);
      const seedersMatch = itemXml.match(/<nyaa:seeders>(.*?)<\/nyaa:seeders>/);
      const leechersMatch = itemXml.match(/<nyaa:leechers>(.*?)<\/nyaa:leechers>/);
      const downloadsMatch = itemXml.match(/<nyaa:downloads>(.*?)<\/nyaa:downloads>/);
      const sizeMatch = itemXml.match(/<nyaa:size>(.*?)<\/nyaa:size>/);
      const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

      // Pastikan data inti tersedia
      if (titleMatch && linkMatch && hashMatch) {
        
        // Sukebei me-return ukuran dalam format teks (misal: "1.2 GiB").
        // Hayase mewajibkan format angka dalam satuan "bytes".
        let sizeInBytes = 0;
        if (sizeMatch) {
            const sizeStr = sizeMatch[1];
            if (sizeStr.includes('GiB')) sizeInBytes = parseFloat(sizeStr) * 1024 * 1024 * 1024;
            else if (sizeStr.includes('MiB')) sizeInBytes = parseFloat(sizeStr) * 1024 * 1024;
            else if (sizeStr.includes('KiB')) sizeInBytes = parseFloat(sizeStr) * 1024;
            else if (sizeStr.includes('Bytes')) sizeInBytes = parseFloat(sizeStr);
        }

        results.push({
          title: titleMatch[1],
          link: linkMatch[1],
          hash: hashMatch[1],
          seeders: seedersMatch ? parseInt(seedersMatch[1], 10) : 0,
          leechers: leechersMatch ? parseInt(leechersMatch[1], 10) : 0,
          downloads: downloadsMatch ? parseInt(downloadsMatch[1], 10) : 0,
          size: sizeInBytes,
          accuracy: 'low', // Di-set low karena ini pure string search (rentan false positive)
          date: dateMatch ? new Date(dateMatch[1]) : new Date()
        });
      }
    }

    // Hayase akan mem-filter exclusions (misal: "x265", "web-dl") secara otomatis 
    // jika kita tidak memfilternya di sini, tetapi hasil array mentahnya akan diteruskan.
    return results;

  } catch (error) {
    throw new Error(`Pencarian gagal: ${error.message}. Periksa apakah URL diblokir oleh CORS atau internet offline.`);
  }
}
