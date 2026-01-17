import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the base name of a file without extension
 * @param {string} filePath - Path to the file
 * @returns {string} Base name without extension
 */
export function getBaseName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Check if a file is a PNG image
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if file is PNG
 */
export function isPngFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.png';
}

/**
 * Get relative path from base directory
 * @param {string} filePath - Full file path
 * @param {string} baseDir - Base directory
 * @returns {string} Relative path
 */
export function getRelativePath(filePath, baseDir) {
  return path.relative(baseDir, filePath);
}

/**
 * Ensure directory exists, create if it doesn't
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
export async function ensureDirectoryExists(dirPath) {
  const fs = await import('fs-extra');
  await fs.ensureDir(dirPath);
}

/**
 * Format error message for display
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @returns {string} Formatted error message
 */
export function formatError(error, context) {
  return `${context}: ${error.message}`;
}

/**
 * Validate texture dimensions (should be 16x16 for Minecraft items)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {{valid: boolean, warning?: string}} Validation result
 */
export function validateTextureDimensions(width, height) {
  if (width !== 16 || height !== 16) {
    return {
      valid: true, // Allow non-16x16 but warn
      warning: `Texture is ${width}x${height}, expected 16x16 for Minecraft items`
    };
  }
  return { valid: true };
}
