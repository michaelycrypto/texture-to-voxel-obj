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
    path.join(texturepackPath, 'item', `${itemName}.png`),
    path.join(texturepackPath, `${itemName}.png`),
  ];

  for (const filePath of possiblePaths) {
    if (await fs.pathExists(filePath)) {
      return filePath;
    }
  }

  return null;
}

/**
 * Calculate pixel sizes for items from a list file
 * @param {Object} options
 * @param {string} options.itemListPath - Path to file with item names (one per line)
 * @param {string} options.texturepackPath - Path to texturepack folder
 * @param {string} options.outputPath - Path to output Lua file
 * @param {string} options.categoryName - Category name for comments (e.g., "Food items", "Non-food items")
 * @param {Object} options.toolSizes - Optional tool sizes to include in output
 * @returns {Promise<{success: number, notFound: string[], errors: string[]}>}
 */
export async function calculatePixelSizes({
  itemListPath,
  texturepackPath,
  outputPath,
  categoryName = 'Items',
  toolSizes = null
}) {
  // Read item names
  const itemNamesContent = await fs.readFile(itemListPath, 'utf8');
  const itemNames = itemNamesContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  console.log(`Processing ${itemNames.length} ${categoryName.toLowerCase()}...`);

  const results = {};
  const notFound = [];
  const errors = [];

  for (const itemName of itemNames) {
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
  let luaTable = '--[[\n';
  luaTable += `\tItem pixel sizes calculated from texture files\n`;
  luaTable += `\tGenerated automatically by calculatePixelSizes.js\n`;
  luaTable += `\tCategory: ${categoryName}\n`;
  luaTable += ']]\n\n';
  luaTable += 'local ITEM_PX_SIZES = {\n';

  // Add tools section if provided
  if (toolSizes) {
    luaTable += '\t-- Tools (special sizes)\n';
    for (const [toolName, size] of Object.entries(toolSizes)) {
      luaTable += `\t["${toolName}"] = {x = ${size.x}, y = ${size.y}},\n`;
    }
    luaTable += '\n';
  }

  // Add items
  luaTable += `\t-- ${categoryName}\n`;
  for (const itemName of itemNames) {
    if (results[itemName]) {
      const { x, y } = results[itemName];
      luaTable += `\t["${itemName}"] = {x = ${x}, y = ${y}},\n`;
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

  return {
    success: Object.keys(results).length,
    notFound,
    errors
  };
}

/**
 * Main function (for CLI usage)
 */
async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: calculatePixelSizes.js <itemListPath> <texturepackPath> [outputPath] [categoryName]');
    console.error('Example: calculatePixelSizes.js item_names.txt texturepacks/GoodVibes export/items/item_pixel_sizes.lua "Non-food items"');
    process.exit(1);
  }

  const itemListPath = path.resolve(args[0]);
  const texturepackPath = path.resolve(args[1]);
  const outputPath = args[2] ? path.resolve(args[2]) : path.join(projectRoot, 'export', 'item_pixel_sizes.lua');
  const categoryName = args[3] || 'Items';

  // Default tool sizes
  const toolSizes = {
    'Sword': { x: 14, y: 14 },
    'Axe': { x: 12, y: 14 },
    'Shovel': { x: 12, y: 12 },
    'Pickaxe': { x: 13, y: 13 },
    'Bow': { x: 14, y: 14 },
    'Arrow': { x: 14, y: 13 }
  };

  await calculatePixelSizes({
    itemListPath,
    texturepackPath,
    outputPath,
    categoryName,
    toolSizes
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
