#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertDirectory } from '../src/converter.js';
import { findPngFiles } from '../src/fileHandler.js';
import { calculatePixelSizes } from './calculatePixelSizes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process items from input folder to export folder
 * Creates organized structure: export/{category}/{models,textures,item_pixel_sizes.lua}
 *
 * Works with any category name - completely agnostic to folder names.
 *
 * @param {Object} options
 * @param {string} options.inputDir - Input directory (should contain items/ or blocks/ subfolders)
 * @param {string} options.outputDir - Output directory (default: ./export)
 * @param {string} options.categoryName - Category name (any name - e.g., "foods", "weapons", "tools")
 * @param {string} options.itemListPath - Optional: Path to file with item names (one per line). If not provided, automatically discovers all textures and calculates pixel sizes for them.
 * @param {number} options.scale - Scale factor for models
 * @param {string} options.coordinateSystem - Coordinate system
 */
export async function processItems({
  inputDir,
  outputDir = './export',
  categoryName,
  itemListPath,
  scale = 1.0,
  coordinateSystem = 'z-up'
}) {
  const projectRoot = path.resolve(__dirname, '..');
  const inputPath = path.resolve(inputDir);
  const outputPath = path.resolve(outputDir);

  console.log(`\n📦 Processing ${categoryName}...`);
  console.log(`   Input: ${inputPath}`);
  console.log(`   Output: ${outputPath}`);

  // Ensure output directory structure exists
  const categoryOutputDir = path.join(outputPath, categoryName);
  const modelsDir = path.join(categoryOutputDir, 'models');
  const texturesDir = path.join(categoryOutputDir, 'textures');

  await fs.ensureDir(modelsDir);
  await fs.ensureDir(texturesDir);

  // Step 1: Convert textures to models (if items folder exists)
  const itemsInputPath = path.join(inputPath, 'items');
  const hasItemsFolder = await fs.pathExists(itemsInputPath);

  if (hasItemsFolder) {
    console.log(`\n🔄 Converting textures to 3D models...`);

    const convertResults = await convertDirectory({
      inputDir: itemsInputPath,
      outputDir: modelsDir,
      recursive: false,
      scale,
      coordinateSystem,
      onProgress: (progress) => {
        if (progress.texture) {
          const baseName = path.basename(progress.texture, '.png');
          console.log(`   ✓ ${baseName}`);
        }
      }
    });

    // Move upscaled textures to textures folder
    const files = await fs.readdir(modelsDir);
    for (const file of files) {
      if (file.endsWith('_1024.png')) {
        const srcPath = path.join(modelsDir, file);
        const destPath = path.join(texturesDir, file);
        await fs.copy(srcPath, destPath);
      }
    }

    console.log(`\n✅ Conversion complete: ${convertResults.success} successful, ${convertResults.failed} failed`);
  } else {
    console.log(`\n⚠️  No items folder found at ${itemsInputPath}, skipping model conversion`);
  }

  // Step 2: Calculate pixel sizes (always done if textures found)
  if (hasItemsFolder) {
    console.log(`\n📏 Calculating pixel sizes...`);

    const pixelSizesPath = path.join(categoryOutputDir, 'item_pixel_sizes.lua');
    const texturepackPath = itemsInputPath; // Use items folder as texture source

    // If item list provided, use it; otherwise discover all textures
    let itemListToUse = itemListPath;

    if (!itemListToUse || !(await fs.pathExists(itemListToUse))) {
      // Auto-discover textures and create temporary item list
      const textureFiles = await findPngFiles(itemsInputPath, false);
      if (textureFiles.length === 0) {
        console.log(`\n⚠️  No textures found, skipping pixel size calculation`);
      } else {
        // Create temporary item list from discovered textures
        const tempListPath = path.join(categoryOutputDir, '.temp_item_list.txt');
        const itemNames = textureFiles.map(file => {
          const baseName = path.basename(file, '.png');
          return baseName;
        });

        await fs.writeFile(tempListPath, itemNames.join('\n'), 'utf8');
        itemListToUse = tempListPath;
        console.log(`   Discovered ${itemNames.length} textures automatically`);
      }
    }

    if (itemListToUse && await fs.pathExists(itemListToUse)) {
      await calculatePixelSizes({
        itemListPath: itemListToUse,
        texturepackPath,
        outputPath: pixelSizesPath,
        categoryName: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
        toolSizes: {
          'Sword': { x: 14, y: 14 },
          'Axe': { x: 12, y: 14 },
          'Shovel': { x: 12, y: 12 },
          'Pickaxe': { x: 13, y: 13 },
          'Bow': { x: 14, y: 14 },
          'Arrow': { x: 14, y: 13 }
        }
      });

      // Clean up temporary item list if we created it
      if (itemListToUse.includes('.temp_item_list.txt')) {
        await fs.remove(itemListToUse);
      }

      console.log(`\n✅ Pixel sizes calculated and saved to: ${pixelSizesPath}`);
    } else if (itemListPath) {
      console.log(`\n⚠️  Item list file not found at ${itemListPath}, skipping pixel size calculation`);
    }
  } else {
    console.log(`\n⚠️  No items folder found, skipping pixel size calculation`);
  }

  console.log(`\n✨ ${categoryName} processing complete!`);
  console.log(`   Models: ${modelsDir}`);
  console.log(`   Textures: ${texturesDir}`);
  console.log(`   Pixel sizes: ${path.join(categoryOutputDir, 'item_pixel_sizes.lua')}`);
}

/**
 * Main function (for CLI usage)
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: processItems.js <inputDir> <categoryName> [itemListPath] [outputDir] [scale]');
    console.error('Example: processItems.js ./input/foods foods ./export 1.0');
    console.error('Example (with item list): processItems.js ./input/foods foods /path/to/list.txt ./export 1.0');
    process.exit(1);
  }

  const inputDir = args[0];
  const categoryName = args[1];
  const itemListPath = args[2] || null; // Optional - can be null
  const outputDir = args[3] || './export';
  const scale = parseFloat(args[4]) || 1.0;

  await processItems({
    inputDir,
    outputDir,
    categoryName,
    itemListPath,
    scale
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
