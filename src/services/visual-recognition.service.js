class VisualRecognitionService {
  constructor() {
    this.featureCache = new Map();
  }

  async loadImage(source) {
    if (source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) {
      return source;
    }

    if (source instanceof HTMLVideoElement || source instanceof HTMLCanvasElement) {
      return source;
    }

    if (typeof source === 'string') {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image from source'));
        img.src = source;
      });
    }

    if (source instanceof Blob || source instanceof File) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to decode image file'));
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(source);
      });
    }

    throw new Error('Unsupported image source type');
  }

  computeDHash(canvas, ctx) {
    canvas.width = 17;
    canvas.height = 16;
    ctx.drawImage(canvas.__sourceImage, 0, 0, 17, 16);
    const imgData = ctx.getImageData(0, 0, 17, 16);
    const data = imgData.data;

    const grays = new Float32Array(17 * 16);
    for (let i = 0; i < 17 * 16; i++) {
      const idx = i * 4;
      grays[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    const hash = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const left = grays[y * 17 + x];
        const right = grays[y * 17 + (x + 1)];
        hash.push(left > right ? 1 : 0);
      }
    }
    return hash;
  }

  computeColorHistogram(canvas, ctx) {
    canvas.width = 48;
    canvas.height = 48;
    ctx.drawImage(canvas.__sourceImage, 0, 0, 48, 48);
    const imgData = ctx.getImageData(0, 0, 48, 48);
    const data = imgData.data;

    const bins = new Float32Array(64);
    const totalPixels = 48 * 48;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = Math.min(3, Math.floor(data[idx] / 64));
      const g = Math.min(3, Math.floor(data[idx + 1] / 64));
      const b = Math.min(3, Math.floor(data[idx + 2] / 64));
      const binIdx = r * 16 + g * 4 + b;
      bins[binIdx]++;
    }

    let norm = 0;
    for (let i = 0; i < 64; i++) {
      bins[i] = bins[i] / totalPixels;
      norm += bins[i] * bins[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < 64; i++) {
        bins[i] = bins[i] / norm;
      }
    }

    return bins;
  }

  computeLuminanceGrid(canvas, ctx) {
    canvas.width = 8;
    canvas.height = 8;
    ctx.drawImage(canvas.__sourceImage, 0, 0, 8, 8);
    const imgData = ctx.getImageData(0, 0, 8, 8);
    const data = imgData.data;

    const grid = new Float32Array(64);
    let norm = 0;
    for (let i = 0; i < 64; i++) {
      const idx = i * 4;
      const luma = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255;
      grid[i] = luma;
      norm += luma * luma;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < 64; i++) {
        grid[i] = grid[i] / norm;
      }
    }
    return grid;
  }

  async extractFeatures(source) {
    try {
      const img = await this.loadImage(source);
      const canvas = document.createElement('canvas');
      canvas.__sourceImage = img;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const dHash = this.computeDHash(canvas, ctx);
      const histogram = this.computeColorHistogram(canvas, ctx);
      const luminance = this.computeLuminanceGrid(canvas, ctx);

      return {
        dHash,
        histogram,
        luminance,
      };
    } catch (err) {
      return null;
    }
  }

  calculateSimilarity(f1, f2) {
    if (!f1 || !f2) return 0;

    let hashMatches = 0;
    const len = f1.dHash.length;
    for (let i = 0; i < len; i++) {
      if (f1.dHash[i] === f2.dHash[i]) {
        hashMatches++;
      }
    }
    const hashSimilarity = hashMatches / len;

    let histDot = 0;
    for (let i = 0; i < 64; i++) {
      histDot += f1.histogram[i] * f2.histogram[i];
    }
    const colorSimilarity = Math.max(0, Math.min(1, histDot));

    let lumaDot = 0;
    for (let i = 0; i < 64; i++) {
      lumaDot += f1.luminance[i] * f2.luminance[i];
    }
    const lumaSimilarity = Math.max(0, Math.min(1, lumaDot));

    const totalScore = hashSimilarity * 0.45 + colorSimilarity * 0.40 + lumaSimilarity * 0.15;
    return Math.max(0, Math.min(1, totalScore));
  }

  async getProductFeatures(product) {
    if (!product || !product.imageUrl) return null;

    const cacheKey = `${product.id || product.barcode}_${product.imageUrl}`;
    if (this.featureCache.has(cacheKey)) {
      return this.featureCache.get(cacheKey);
    }

    const features = await this.extractFeatures(product.imageUrl);
    if (features) {
      this.featureCache.set(cacheKey, features);
    }
    return features;
  }

  async findMatches(querySource, products, topN = 5) {
    const queryFeatures = await this.extractFeatures(querySource);
    if (!queryFeatures) {
      throw new Error('Unable to extract visual features from query image');
    }

    const eligible = (products || []).filter(p => p && p.isActive !== false && p.imageUrl);
    const results = [];

    for (const prod of eligible) {
      const prodFeatures = await this.getProductFeatures(prod);
      if (prodFeatures) {
        const score = this.calculateSimilarity(queryFeatures, prodFeatures);
        results.push({
          product: prod,
          score,
          confidencePercent: Math.round(score * 100),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topN);
  }

  async fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  clearCache() {
    this.featureCache.clear();
  }
}

export const visualRecognitionService = new VisualRecognitionService();
