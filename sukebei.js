export default new class Sukebei {
  base = 'https://sukebei.nyaa.si/api/v2'

  /** @type {import('./').SearchFunction} */
  async single({ titles, episode }) {
    if (!titles?.length) return []

    const query = titles[0].replace(/[^\w\s-]/g, ' ').trim()
    const url = `${this.base}/search?q=${encodeURIComponent(query)}&s=seeders&o=desc`

    const res = await fetch(url)
    const data = await res.json()

    if (!data?.torrents) return []

    return this.map(data.torrents)
  }

  /** @type {import('./').SearchFunction} */
  batch = this.single
  movie = this.single

  map(data) {
    return data.map(item => {
      const hash = item.hash || item.magnet?.match(/btih:([a-fA-F0-9]+)/)?.[1] || ''

      return {
        title: item.name || '',
        link: item.magnet || `magnet:?xt=urn:btih:${hash}`,
        hash,
        seeders: parseInt(item.seeders || '0'),
        leechers: parseInt(item.leechers || '0'),
        downloads: parseInt(item.downloads || '0'),
        size: parseInt(item.filesize || '0'),
        date: new Date((item.timestamp || 0) * 1000),
        type: undefined,
        accuracy: 'medium'
      }
    })
  }

  async test() {
    try {
      const res = await fetch(`${this.base}/search?q=test&limit=1`)
      return res.ok
    } catch {
      return false
    }
  }
}()
