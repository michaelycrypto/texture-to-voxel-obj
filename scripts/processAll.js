#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { processItems } from './processItems.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process all item categories from input folder
 * Standardized workflow: input/ -> export/{category}/
 *
 * @param {Object} options
 * @param {string} options.inputDir - Input directory (default: ./input)
 * @param {string} options.outputDir - Output directory (default: ./export)
 * @param {number} options.scale - Scale factor for models
 * @param {string} options.coordinateSystem - Coordinate system
 */
export async function processAll({
  inputDir = './input',
  outputDir = './export',
  scale = 1.0,
  coordinateSystem = 'z-up'
}) {
  const projectRoot = path.resolve(__dirname, '..');
  const inputPath = path.resolve(inputDir);
  const outputPath = path.resolve(outputDir);

  console.log('🚀 Starting standardized item processing workflow');
  console.log(`   Input: ${inputPath}`);
  console.log(`   Output: ${outputPath}\n`);

  // Ensure input directory exists
  if (!(await fs.pathExists(inputPath))) {
    console.error(`❌ Input directory does not exist: ${inputPath}`);
    console.log(`\n💡 Create the input directory and organize it like this:`);
    console.log(`   input/`);
    console.log(`   ├── foods/`);
    console.log(`   │   └── items/  (texture PNG files)`);
    console.log(`   ├── weapons/`);
    console.log(`   │   └── items/  (texture PNG files)`);
    console.log(`   └── tools/`);
    console.log(`       └── items/  (texture PNG files)`);
    console.log(`\n   Any folder name works! The script will process all folders.`);
    process.exit(1);
  }

  // Find all category folders in input directory
  const entries = await fs.readdir(inputPath, { withFileTypes: true });
  const categoryFolders = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  if (categoryFolders.length === 0) {
    console.error(`❌ No category folders found in: ${inputPath}`);
    console.log(`\n💡 Create category folders like this:`);
    console.log(`   input/`);
    console.log(`   ├── foods/`);
    console.log(`   │   └── items/  (texture PNG files)`);
    console.log(`   ├── weapons/`);
    console.log(`   │   └── items/  (texture PNG files)`);
    console.log(`   └── tools/`);
    console.log(`       └── items/  (texture PNG files)`);
    process.exit(1);
  }

  // Process each category folder
  const processedCategories = [];
  for (let i = 0; i < categoryFolders.length; i++) {
    const categoryName = categoryFolders[i];
    const categoryInputPath = path.join(inputPath, categoryName);

    if (i > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Process without item list - will process all textures found
    // Item list is optional and must be provided explicitly if pixel size calculation is needed
    await processItems({
      inputDir: categoryInputPath,
      outputDir: outputPath,
      categoryName: categoryName,
      itemListPath: null, // No auto-search - user must provide explicitly if needed
      scale,
      coordinateSystem
    });

    processedCategories.push(categoryName);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ All processing complete!');
  console.log(`\n📁 Output structure:`);
  console.log(`   ${outputPath}/`);
  for (let i = 0; i < processedCategories.length; i++) {
    const categoryName = processedCategories[i];
    const isLast = i === processedCategories.length - 1;
    const prefix = isLast ? '   └──' : '   ├──';
    console.log(`${prefix} ${categoryName}/`);
    console.log(`   ${isLast ? '    ' : '│   '} ├── models/     (OBJ, MTL, textures)`);
    console.log(`   ${isLast ? '    ' : '│   '} ├── textures/   (upscaled PNG files)`);
    console.log(`   ${isLast ? '    ' : '│   '} └── item_pixel_sizes.lua`);
  }
}

/**
 * Main function (for CLI usage)
 */
async function main() {
  const args = process.argv.slice(2);

  const inputDir = args[0] || './input';
  const outputDir = args[1] || './export';
  const scale = parseFloat(args[2]) || 1.0;
  const coordinateSystem = args[3] || 'z-up';

  await processAll({
    inputDir,
    outputDir,
    scale,
    coordinateSystem
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
