#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculate the bounding box of non-transparent pixels in an image
 * @param {string} imagePath - Path to the image file
 * @param {number} alphaThreshold - Alpha threshold (0-255, default: 128)
 * @returns {Promise<{x: number, y: number, width: number, height: number} | null>}
 */
async function calculatePixelBounds(imagePath, alphaThreshold = 128) {
  try {
    const { data, info } = await sharp(imagePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels; // Should be 4 for RGBA

    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;

    // Find bounding box of non-transparent pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * channels;
        const alpha = data[index + 3]; // Alpha is the 4th channel

        if (alpha >= alphaThreshold) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // If no opaque pixels found, return null
    if (minX > maxX || minY > maxY) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  } catch (error) {
    console.error(`Error processing ${imagePath}:`, error.message);
    return null;
  }
}

/**
 * Find texture file for an item name
 * @param {string} itemName - Name of the item
 * @param {string} texturepackPath - Path to texturepack
 * @returns {Promise<string | null>} Path to texture file or null if not found
 */
async function findTextureFile(itemName, texturepackPath) {
  // Try different possible paths
  const possiblePaths = [
    path.join(texturepackPath, 'minecraft', 'textures', 'item', `${itemName}.png`),
    path.join(texturepackPath, 'textures', 'item', `${itemName}.png`),
    path.join(texturepackPath, 'items', `${itemName}.png`),
  ];

  for (const filePath of possiblePaths) {
    if (await fs.pathExists(filePath)) {
      return filePath;
    }
  }

  return null;
}

/**
 * Main function to calculate pixel sizes for all food items
 */
async function main() {
  const projectRoot = __dirname;
  const foodNamesPath = path.join(projectRoot, 'food_names.txt');
  const outputPath = path.join(projectRoot, 'foods', 'item_pixel_sizes.lua');

  // Default texturepack path
  const texturepackPath = path.join(projectRoot, 'texturepacks', 'GoodVibes');

  // Read food names
  const foodNamesContent = await fs.readFile(foodNamesPath, 'utf8');
  const foodNames = foodNamesContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  console.log(`Processing ${foodNames.length} food items...`);

  const results = {};
  const notFound = [];
  const errors = [];

  for (const itemName of foodNames) {
    const texturePath = await findTextureFile(itemName, texturepackPath);

    if (!texturePath) {
      notFound.push(itemName);
      console.warn(`⚠️  Texture not found for: ${itemName}`);
      continue;
    }

    const bounds = await calculatePixelBounds(texturePath);

    if (!bounds) {
      errors.push(itemName);
      console.warn(`⚠️  No opaque pixels found for: ${itemName}`);
      continue;
    }

    results[itemName] = {
      x: bounds.width,
      y: bounds.height
    };

    console.log(`✓ ${itemName}: ${bounds.width}x${bounds.height}`);
  }

  // Generate Lua table
  let luaTable = '-- Item pixel sizes calculated from texture files\n';
  luaTable += '-- Generated automatically by calculateItemPixelSizes.js\n\n';
  luaTable += 'local ITEM_PX_SIZES = {\n';

  // Add tools section (for reference)
  luaTable += '    -- Tools (special sizes)\n';
  luaTable += '    ["Sword"] = {x = 14, y = 14},\n';
  luaTable += '    ["Axe"] = {x = 12, y = 14},\n';
  luaTable += '    ["Shovel"] = {x = 12, y = 12},\n';
  luaTable += '    ["Pickaxe"] = {x = 13, y = 13},\n';
  luaTable += '    ["Bow"] = {x = 14, y = 14},\n';
  luaTable += '    ["Arrow"] = {x = 14, y = 13},\n\n';

  // Add food items
  luaTable += '    -- Food items\n';
  for (const itemName of foodNames) {
    if (results[itemName]) {
      const { x, y } = results[itemName];
      luaTable += `    ["${itemName}"] = {x = ${x}, y = ${y}},\n`;
    }
  }

  luaTable += '}\n\n';
  luaTable += 'return ITEM_PX_SIZES\n';

  // Ensure output directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Write output file
  await fs.writeFile(outputPath, luaTable, 'utf8');

  console.log(`\n✅ Generated ${Object.keys(results).length} pixel sizes`);
  console.log(`📄 Output written to: ${outputPath}`);

  if (notFound.length > 0) {
    console.log(`\n⚠️  ${notFound.length} items not found:`);
    notFound.forEach(name => console.log(`   - ${name}`));
  }

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} items had errors:`);
    errors.forEach(name => console.log(`   - ${name}`));
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
