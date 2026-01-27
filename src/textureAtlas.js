/**
 * Texture Atlas Manager for Minecraft JSON models
 * Handles texture loading, atlas creation, and UV coordinate mapping
 */

import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

/**
 * TextureAtlas class for managing textures and UV mappings
 */
export class TextureAtlas {
  constructor() {
    this.textures = new Map(); // path -> { image, width, height, x, y }
    this.atlasImage = null;
    this.atlasWidth = 0;
    this.atlasHeight = 0;
    this.textureSize = 16; // Default Minecraft texture size
  }
  
  /**
   * Load all textures for a model
   * @param {string[]} texturePaths - Array of texture file paths
   * @returns {Promise<void>}
   */
  async loadTextures(texturePaths) {
    for (const texturePath of texturePaths) {
      if (this.textures.has(texturePath)) continue;
      
      try {
        if (await fs.pathExists(texturePath)) {
          const image = sharp(texturePath);
          const metadata = await image.metadata();
          
          this.textures.set(texturePath, {
            path: texturePath,
            image,
            width: metadata.width,
            height: metadata.height,
            x: 0,
            y: 0
          });
          
          // Update texture size if different
          if (metadata.width > this.textureSize) {
            this.textureSize = metadata.width;
          }
        } else {
          console.warn(`Texture not found: ${texturePath}`);
        }
      } catch (err) {
        console.warn(`Failed to load texture ${texturePath}: ${err.message}`);
      }
    }
  }
  
  /**
   * Build the texture atlas from loaded textures
   * @returns {Promise<Buffer>} Atlas image as PNG buffer
   */
  async buildAtlas() {
    const textureCount = this.textures.size;
    
    if (textureCount === 0) {
      // Create a placeholder magenta texture
      this.atlasWidth = 16;
      this.atlasHeight = 16;
      this.atlasImage = await sharp({
        create: {
          width: 16,
          height: 16,
          channels: 4,
          background: { r: 255, g: 0, b: 255, a: 255 }
        }
      }).png().toBuffer();
      return this.atlasImage;
    }
    
    if (textureCount === 1) {
      // Single texture - use directly
      const [texture] = this.textures.values();
      this.atlasWidth = texture.width;
      this.atlasHeight = texture.height;
      this.atlasImage = await sharp(texture.path).png().toBuffer();
      return this.atlasImage;
    }
    
    // Multiple textures - create atlas
    // Calculate atlas dimensions (power of 2, square)
    const gridSize = Math.ceil(Math.sqrt(textureCount));
    this.atlasWidth = gridSize * this.textureSize;
    this.atlasHeight = gridSize * this.textureSize;
    
    // Round up to power of 2
    this.atlasWidth = nextPowerOf2(this.atlasWidth);
    this.atlasHeight = nextPowerOf2(this.atlasHeight);
    
    // Position textures in grid
    let index = 0;
    for (const [texturePath, texture] of this.textures) {
      const gridX = index % gridSize;
      const gridY = Math.floor(index / gridSize);
      texture.x = gridX * this.textureSize;
      texture.y = gridY * this.textureSize;
      index++;
    }
    
    // Composite textures into atlas
    const composites = [];
    for (const [texturePath, texture] of this.textures) {
      // Resize texture to standard size if needed
      let input = texture.path;
      if (texture.width !== this.textureSize || texture.height !== this.textureSize) {
        input = await sharp(texture.path)
          .resize(this.textureSize, this.textureSize, { kernel: 'nearest' })
          .toBuffer();
      }
      
      composites.push({
        input: typeof input === 'string' ? input : input,
        left: texture.x,
        top: texture.y
      });
    }
    
    // Create atlas with transparent background
    this.atlasImage = await sharp({
      create: {
        width: this.atlasWidth,
        height: this.atlasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite(composites)
    .png()
    .toBuffer();
    
    return this.atlasImage;
  }
  
  /**
   * Get UV coordinates for a face
   * @param {string} textureRef - Texture reference (e.g., "#body")
   * @param {number[]} uv - Original UV coordinates [u1, v1, u2, v2]
   * @param {Object} rawTextures - Raw texture mappings from model
   * @param {string} faceName - Face name (north, south, east, west, up, down)
   * @returns {number[]} UV coordinates for quad vertices [u0,v0, u1,v1, u2,v2, u3,v3]
   */
  getUV(textureRef, uv, rawTextures, faceName = 'north') {
    // Default UV if not provided
    if (!uv) {
      uv = [0, 0, 16, 16];
    }
    
    // Resolve texture reference
    let texturePath = textureRef;
    if (textureRef && textureRef.startsWith('#')) {
      const key = textureRef.slice(1);
      texturePath = this.resolveTextureChain(key, rawTextures);
    }
    
    // Get texture info from atlas
    const texture = this.getTextureByRef(texturePath, rawTextures);
    
    // Normalize UV to 0-1 range
    let u1 = uv[0] / 16;
    let v1 = uv[1] / 16;
    let u2 = uv[2] / 16;
    let v2 = uv[3] / 16;
    
    // Handle UV flipping
    const flipU = u1 > u2;
    const flipV = v1 > v2;
    if (flipU) [u1, u2] = [u2, u1];
    if (flipV) [v1, v2] = [v2, v1];
    
    // If we have multiple textures, remap to atlas position
    if (texture && this.textures.size > 1) {
      const atlasU1 = texture.x / this.atlasWidth;
      const atlasV1 = texture.y / this.atlasHeight;
      const atlasU2 = (texture.x + this.textureSize) / this.atlasWidth;
      const atlasV2 = (texture.y + this.textureSize) / this.atlasHeight;
      
      // Remap UVs to atlas space
      u1 = atlasU1 + u1 * (atlasU2 - atlasU1);
      v1 = atlasV1 + v1 * (atlasV2 - atlasV1);
      u2 = atlasU1 + u2 * (atlasU2 - atlasU1);
      v2 = atlasV1 + v2 * (atlasV2 - atlasV1);
    }
    
    // Apply flipping
    if (flipU) [u1, u2] = [u2, u1];
    if (flipV) [v1, v2] = [v2, v1];
    
    // Return UV coordinates for quad (4 vertices)
    // Different vertex orders for different face orientations
    // Vertex order must match FACE_DEFINITIONS in geometryBuilder.js
    
    if (faceName === 'up') {
      // up face verts: [3, 7, 6, 2] = left-back, left-front, right-front, right-back
      // UV: u maps to X, v maps to Z (v1=back/minZ, v2=front/maxZ)
      return [
        u1, v1,  // left-back (minU, minV)
        u1, v2,  // left-front (minU, maxV)
        u2, v2,  // right-front (maxU, maxV)
        u2, v1   // right-back (maxU, minV)
      ];
    } else if (faceName === 'down') {
      // down face verts: [0, 1, 5, 4] = left-back, right-back, right-front, left-front
      return [
        u1, v1,  // left-back
        u2, v1,  // right-back
        u2, v2,  // right-front
        u1, v2   // left-front
      ];
    } else {
      // Side faces (north, south, east, west)
      // Order: bottom-left, bottom-right, top-right, top-left
      return [
        u1, v2,  // bottom-left
        u2, v2,  // bottom-right
        u2, v1,  // top-right
        u1, v1   // top-left
      ];
    }
  }
  
  /**
   * Resolve a texture reference chain
   */
  resolveTextureChain(key, rawTextures, depth = 0) {
    if (depth > 10) return null; // Prevent infinite loops
    
    const value = rawTextures[key];
    if (!value) return null;
    
    if (value.startsWith('#')) {
      return this.resolveTextureChain(value.slice(1), rawTextures, depth + 1);
    }
    
    return value;
  }
  
  /**
   * Get texture info by reference
   */
  getTextureByRef(ref, rawTextures) {
    // Try direct path lookup
    for (const [path, texture] of this.textures) {
      if (path.includes(ref) || path.includes(ref.replace('block/', '').replace('entity/', ''))) {
        return texture;
      }
    }
    
    // Return first texture as fallback
    if (this.textures.size > 0) {
      return this.textures.values().next().value;
    }
    
    return null;
  }
  
  /**
   * Get the atlas image buffer
   * @returns {Buffer} PNG image buffer
   */
  getAtlasBuffer() {
    return this.atlasImage;
  }
}

/**
 * Get next power of 2
 */
function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Create a texture atlas for a model
 * @param {Object} model - Parsed model
 * @param {string[]} texturePaths - Resolved texture paths
 * @returns {Promise<TextureAtlas>}
 */
export async function createTextureAtlas(model, texturePaths) {
  const atlas = new TextureAtlas();
  await atlas.loadTextures(texturePaths);
  await atlas.buildAtlas();
  return atlas;
}
