import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { isPngFile, validateTextureDimensions, ensureDirectoryExists, getBaseName } from './utils.js';

/**
 * Find all PNG files in a directory (recursively or not)
 * @param {string} dirPath - Directory to search
 * @param {boolean} recursive - Whether to search subdirectories
 * @returns {Promise<string[]>} Array of PNG file paths
 */
export async function findPngFiles(dirPath, recursive = true) {
  const files = [];

  async function scanDirectory(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory() && recursive) {
        await scanDirectory(fullPath);
      } else if (entry.isFile() && isPngFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  await scanDirectory(dirPath);
  return files;
}

/**
 * Validate and get image metadata
 * @param {string} filePath - Path to image file
 * @returns {Promise<{width: number, height: number, valid: boolean, warning?: string}>}
 */
export async function validateImage(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    const validation = validateTextureDimensions(metadata.width, metadata.height);

    return {
      width: metadata.width,
      height: metadata.height,
      valid: validation.valid,
      warning: validation.warning
    };
  } catch (error) {
    return {
      width: 0,
      height: 0,
      valid: false,
      error: error.message
    };
  }
}

/**
 * Extract pixel data with alpha channel from texture
 * @param {string} filePath - Path to image file
 * @returns {Promise<{width: number, height: number, pixels: Uint8Array, hasAlpha: boolean}>}
 */
export async function extractPixelData(filePath) {
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    return {
      width: metadata.width,
      height: metadata.height,
      pixels: data,
      channels: info.channels, // Should be 4 (RGBA)
      hasAlpha: info.hasAlpha !== false
    };
  } catch (error) {
    throw new Error(`Failed to extract pixel data: ${error.message}`);
  }
}

/**
 * Get alpha value for a pixel at given coordinates
 * @param {Uint8Array} pixels - Pixel data (RGBA format)
 * @param {number} width - Image width
 * @param {number} x - X coordinate (0-based)
 * @param {number} y - Y coordinate (0-based)
 * @param {number} channels - Number of channels (4 for RGBA)
 * @returns {number} Alpha value (0-255)
 */
export function getPixelAlpha(pixels, width, x, y, channels = 4) {
  const index = (y * width + x) * channels;
  return pixels[index + 3]; // Alpha is the 4th channel (index 3)
}

/**
 * Check if a pixel is opaque (alpha > threshold)
 * @param {Uint8Array} pixels - Pixel data
 * @param {number} width - Image width
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} channels - Number of channels
 * @param {number} threshold - Alpha threshold (default: 128, 50% opacity)
 * @returns {boolean} True if pixel is opaque
 */
export function isPixelOpaque(pixels, width, x, y, channels = 4, threshold = 128) {
  const alpha = getPixelAlpha(pixels, width, x, y, channels);
  return alpha >= threshold;
}

/**
 * Write OBJ file to disk
 * @param {string} filePath - Output file path
 * @param {string} content - OBJ file content
 * @returns {Promise<void>}
 */
export async function writeOBJFile(filePath, content) {
  await ensureDirectoryExists(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Write MTL file to disk
 * @param {string} filePath - Output file path
 * @param {string} content - MTL file content
 * @returns {Promise<void>}
 */
export async function writeMTLFile(filePath, content) {
  await ensureDirectoryExists(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Calculate relative path from MTL file to texture file
 * @param {string} mtlPath - Path to MTL file
 * @param {string} texturePath - Path to texture file
 * @returns {string} Relative path from MTL to texture
 */
export function getRelativeTexturePath(mtlPath, texturePath) {
  const mtlDir = path.dirname(mtlPath);
  const relativePath = path.relative(mtlDir, texturePath);
  // Use forward slashes for OBJ/MTL compatibility across platforms
  return relativePath.split(path.sep).join('/');
}

/**
 * Upscale texture to 1024×1024 using nearest-neighbor interpolation
 * @param {string} inputTexturePath - Path to input texture
 * @param {string} outputTexturePath - Path to save upscaled texture
 * @returns {Promise<void>}
 */
export async function upscaleTexture(inputTexturePath, outputTexturePath) {
  try {
    await ensureDirectoryExists(path.dirname(outputTexturePath));
    await sharp(inputTexturePath)
      .resize(1024, 1024, {
        kernel: sharp.kernel.nearest
      })
      .toFile(outputTexturePath);
  } catch (error) {
    throw new Error(`Failed to upscale texture: ${error.message}`);
  }
}

/**
 * Generate output file paths
 * @param {string} inputTexturePath - Path to input texture
 * @param {string} inputBaseDir - Base input directory
 * @param {string} outputBaseDir - Base output directory
 * @returns {{obj: string, mtl: string, baseName: string}}
 */
export function generateOutputPaths(inputTexturePath, inputBaseDir, outputBaseDir) {
  const baseName = getBaseName(inputTexturePath);

  // If output is same as input, use same directory structure
  if (outputBaseDir === inputBaseDir) {
    const dir = path.dirname(inputTexturePath);
    return {
      obj: path.join(dir, `${baseName}.obj`),
      mtl: path.join(dir, `${baseName}.mtl`),
      baseName
    };
  }

  // Otherwise, preserve relative structure
  const relativePath = path.relative(inputBaseDir, path.dirname(inputTexturePath));
  const outputDir = path.join(outputBaseDir, relativePath);

  return {
    obj: path.join(outputDir, `${baseName}.obj`),
    mtl: path.join(outputDir, `${baseName}.mtl`),
    baseName
  };
}
