export default new class Sukebei {
  base = 'https://sukebei.nyaa.si/api/v2'

  async single({ titles, episode, exclusions = [], resolution }) {
    if (!titles || !titles.length) return []

    try {
      const query = titles[0].replace(/[^\w\s-]/g, ' ').trim()
      const params = new URLSearchParams({
        q: query,
        s: 'seeders',
        o: 'desc'
      })
      const url = `${this.base}/search?${params}`

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      })
      if (!res.ok) return []

      const data = await res.json()
      
      if (!data || !data.torrents || !Array.isArray(data.torrents)) {
        return []
      }

      return this.map(data.torrents).filter(item => {
        const title = item.title.toLowerCase()

        if (exclusions && exclusions.length) {
          for (let i = 0; i < exclusions.length; i++) {
            if (title.includes(exclusions[i].toLowerCase())) return false
          }
        }

        if (resolution && !title.includes(resolution + 'p')) return false

        if (episode) {
          const epNum = String(episode).padStart(2, '0')
          const patterns = [
            new RegExp(`(?:^|[^0-9])${epNum}(?:[^0-9]|$)`),
            new RegExp(`(?:^|[^0-9])${episode}(?:[^0-9]|$)`),
            new RegExp(`(?:ep|e)${epNum}(?:[^0-9]|$)`, 'i')
          ]
          
          let found = false
          for (let i = 0; i < patterns.length; i++) {
            if (patterns[i].test(title)) {
              found = true
              break
            }
          }
          if (!found) return false
          if (/(?:batch|complete|e\d{2,3}[-_]\d{2,3})/i.test(title)) return false
        }

        return true
      })
    } catch {
      return []
    }
  }

  // ✅ PERBAIKAN: Ganti spread operator dengan Object.assign
  async batch(query) {
    if (!query || !query.titles || !query.titles.length) return []
    
    try {
      // PAKAI Object.assign BUKAN spread operator
      const batchQuery = Object.assign({}, query)
      delete batchQuery.episode
      
      const title = batchQuery.titles[0].replace(/[^\w\s-]/g, ' ').trim()
      const params = new URLSearchParams({
        q: title,
        s: 'size',
        o: 'desc'
      })
      const url = `${this.base}/search?${params}`

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      })
      if (!res.ok) return []

      const data = await res.json()
      if (!data || !data.torrents || !Array.isArray(data.torrents)) return []

      return this.map(data.torrents).filter(item => {
        const title = item.title.toLowerCase()
        
        if (batchQuery.exclusions && batchQuery.exclusions.length) {
          for (let i = 0; i < batchQuery.exclusions.length; i++) {
            if (title.includes(batchQuery.exclusions[i].toLowerCase())) return false
          }
        }

        return /(?:batch|complete|e\d{2,3}[-_]\d{2,3}|collection)/i.test(title)
      })
    } catch {
      return []
    }
  }

  // ✅ PERBAIKAN: Ganti spread operator dengan Object.assign
  async movie(query) {
    if (!query || !query.titles || !query.titles.length) return []
    
    try {
      const movieQuery = Object.assign({}, query)
      delete movieQuery.episode
      
      return this.single(movieQuery)
    } catch {
      return []
    }
  }

  map(torrents) {
    if (!torrents || !Array.isArray(torrents)) return []
    
    const results = []
    
    for (let i = 0; i < torrents.length; i++) {
      const item = torrents[i]
      if (!item) continue
      if (!item.hash && !item.magnet) continue
      if (!item.name || item.name.trim() === '') continue

      const title = item.name || 'Unknown'
      const isBatch = /(?:batch|complete|e\d{2,3}[-_]\d{2,3}|collection)/i.test(title)

      results.push({
        title: title,
        link: item.magnet || (item.hash ? `magnet:?xt=urn:btih:${item.hash}` : ''),
        hash: item.hash || '',
        seeders: parseInt(item.seeders) || 0,
        leechers: parseInt(item.leechers) || 0,
        downloads: parseInt(item.downloads) || 0,
        size: parseInt(item.filesize) || 0,
        date: new Date((item.timestamp || 0) * 1000),
        type: isBatch ? 'batch' : undefined,
        accuracy: 'medium'
      })
    }

    // Sort manual tanpa arrow function
    results.sort(function(a, b) {
      if (b.seeders !== a.seeders) return b.seeders - a.seeders
      return b.date - a.date
    })

    return results
  }

  async test() {
    try {
      const res = await fetch(`${this.base}/search?q=test&limit=1`, {
        headers: { 'Accept': 'application/json' }
      })

      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ': ' + res.statusText)
      }

      const data = await res.json()

      if (!data || !data.torrents || !Array.isArray(data.torrents)) {
        throw new Error('Response bukan format API')
      }

      if (data.torrents.length === 0) {
        throw new Error('Tidak ada hasil')
      }

      const result = this.map(data.torrents)
      if (!Array.isArray(result)) {
        throw new Error('Map tidak mengembalikan array')
      }

      return true
    } catch (error) {
      throw new Error('Sukebei error: ' + (error.message || 'Unknown error'))
    }
  }
}()
