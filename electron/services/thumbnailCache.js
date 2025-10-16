// electron/services/thumbnailCache.js
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class ThumbnailCache {
  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'thumbnail-cache');
    this.cacheIndex = new Map(); // 메모리 인덱스
    this.maxCacheSize = 100 * 1024 * 1024; // 100MB
    this.maxAge = 3600 * 1000; // 1시간
    this.initCache();
  }

  async initCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadIndex();
      await this.cleanOldEntries();
    } catch (error) {
      console.error('[cache] Initialization error:', error);
    }
  }

  generateKey(prompt, settings) {
    const normalized = {
      prompt: prompt.trim().toLowerCase(),
      provider: settings.provider || 'replicate',
      count: settings.count || 1,
      mode: settings.mode || 'dramatic',
      aspectRatio: settings.aspectRatio || '16:9',
      quality: settings.quality || 'balanced'
    };
    
    return crypto.createHash('md5')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  async get(prompt, settings) {
    const key = this.generateKey(prompt, settings);
    const entry = this.cacheIndex.get(key);
    
    if (!entry) {
      console.log('[cache] Cache miss for key:', key);
      return null;
    }
    
    // 만료 체크
    if (Date.now() - entry.timestamp > this.maxAge) {
      console.log('[cache] Entry expired for key:', key);
      await this.remove(key);
      return null;
    }
    
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const cached = JSON.parse(data);
      
      console.log('[cache] Cache hit for key:', key);
      
      // 히트 카운트 증가
      entry.hits = (entry.hits || 0) + 1;
      entry.lastAccess = Date.now();
      
      return cached.result;
    } catch (error) {
      console.error('[cache] Read error:', error);
      await this.remove(key);
      return null;
    }
  }

  async set(prompt, settings, result) {
    const key = this.generateKey(prompt, settings);
    
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      const data = {
        key,
        prompt,
        settings,
        result,
        timestamp: Date.now()
      };
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      // 인덱스 업데이트
      this.cacheIndex.set(key, {
        timestamp: Date.now(),
        size: JSON.stringify(data).length,
        hits: 0,
        lastAccess: Date.now()
      });
      
      console.log('[cache] Cached result for key:', key);
      
      // 캐시 크기 체크
      await this.checkCacheSize();
    } catch (error) {
      console.error('[cache] Write error:', error);
    }
  }

  async remove(key) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.unlink(filePath);
      this.cacheIndex.delete(key);
      console.log('[cache] Removed entry:', key);
    } catch (error) {
      console.error('[cache] Remove error:', error);
    }
  }

  async clear() {
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
      this.cacheIndex.clear();
      console.log('[cache] Cache cleared');
    } catch (error) {
      console.error('[cache] Clear error:', error);
    }
  }

  async loadIndex() {
    try {
      const files = await fs.readdir(this.cacheDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        const key = file.replace('.json', '');
        
        this.cacheIndex.set(key, {
          timestamp: stats.mtime.getTime(),
          size: stats.size,
          hits: 0,
          lastAccess: Date.now()
        });
      }
      
      console.log(`[cache] Loaded ${this.cacheIndex.size} entries`);
    } catch (error) {
      console.error('[cache] Load index error:', error);
    }
  }

  async cleanOldEntries() {
    const now = Date.now();
    const toRemove = [];
    
    for (const [key, entry] of this.cacheIndex) {
      if (now - entry.timestamp > this.maxAge) {
        toRemove.push(key);
      }
    }
    
    for (const key of toRemove) {
      await this.remove(key);
    }
    
    if (toRemove.length > 0) {
      console.log(`[cache] Cleaned ${toRemove.length} expired entries`);
    }
  }

  async checkCacheSize() {
    let totalSize = 0;
    const entries = Array.from(this.cacheIndex.entries());
    
    for (const [key, entry] of entries) {
      totalSize += entry.size || 0;
    }
    
    if (totalSize > this.maxCacheSize) {
      // LRU 정책으로 삭제
      entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      
      while (totalSize > this.maxCacheSize * 0.8 && entries.length > 0) {
        const [key, entry] = entries.shift();
        await this.remove(key);
        totalSize -= entry.size || 0;
      }
      
      console.log('[cache] Cache size reduced to:', totalSize);
    }
  }

  getStats() {
    const stats = {
      entries: this.cacheIndex.size,
      totalSize: 0,
      totalHits: 0,
      avgAge: 0
    };
    
    const now = Date.now();
    let ageSum = 0;
    
    for (const entry of this.cacheIndex.values()) {
      stats.totalSize += entry.size || 0;
      stats.totalHits += entry.hits || 0;
      ageSum += (now - entry.timestamp);
    }
    
    if (this.cacheIndex.size > 0) {
      stats.avgAge = Math.round(ageSum / this.cacheIndex.size / 1000); // 초 단위
    }
    
    return stats;
  }
}

// 싱글톤 인스턴스
let cacheInstance = null;

module.exports = {
  getThumbnailCache: () => {
    if (!cacheInstance) {
      cacheInstance = new ThumbnailCache();
    }
    return cacheInstance;
  }
};