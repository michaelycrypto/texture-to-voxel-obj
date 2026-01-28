#!/usr/bin/env node

/**
 * Entity Parser - Main CLI entry point
 * Converts Minecraft JSON model definitions into GLB 3D models
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';
import chalk from 'chalk';
import { loadModel, loadAllModels, getModelTextures, resolveTexturePath } from './jsonModelLoader.js';
import { createTextureAtlas } from './textureAtlas.js';
import { generateEntityGLB, generateEntityMetadata } from './entityGlbGenerator.js';
import { ProgressTracker } from './progress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load entity categories
async function loadCategories() {
  const categoriesPath = path.join(__dirname, '..', 'config', 'entityCategories.json');
  if (await fs.pathExists(categoriesPath)) {
    return await fs.readJson(categoriesPath);
  }
  return {};
}

/**
 * Get category for an entity
 */
function getCategory(entityName, categories) {
  for (const [category, entities] of Object.entries(categories)) {
    if (entities.includes(entityName)) {
      return category;
    }
  }
  return 'Uncategorized';
}

/**
 * Resolve texture path to use upscaled textures from export folder
 * Falls back to original entities folder or input folder if upscaled not found
 * Block textures: 4096x (for entities), Entity textures: 4096x
 * @param {string} textureRef - Texture reference (e.g., "block/anvil")
 * @param {string} exportTexturesDir - Export textures directory (e.g., export/Skyblox/textures)
 * @param {string} entitiesDir - Original entities directory (fallback)
 * @param {string} inputDir - Input texture pack directory (fallback for entity textures)
 * @returns {string} Resolved texture path
 */
function resolveUpscaledTexturePath(textureRef, exportTexturesDir, entitiesDir, inputDir) {
  if (!textureRef || textureRef.startsWith('#')) {
    return textureRef;
  }

  // Remove minecraft: prefix if present
  let cleanRef = textureRef.replace('minecraft:', '');

  // Build paths to check (upscaled first, then original)
  const pathsToCheck = [];

  if (cleanRef.startsWith('block/')) {
    const textureName = cleanRef.replace('block/', '');
    // Check 4096x version first (in block_4096 folder for entities)
    pathsToCheck.push(path.join(exportTexturesDir, 'block_4096', `${textureName}_4096.png`));
    // Fallback to 1024x version
    pathsToCheck.push(path.join(exportTexturesDir, 'block', `${textureName}_1024.png`));
    // Fallback to original in entities folder
    pathsToCheck.push(path.join(entitiesDir, 'block', `${textureName}.png`));
    // Fallback to input folder
    if (inputDir) {
      pathsToCheck.push(path.join(inputDir, 'block', `${textureName}.png`));
    }
  } else if (cleanRef.startsWith('entity/')) {
    const textureName = cleanRef.replace('entity/', '');
    // Check upscaled version first (entities are 4096x)
    pathsToCheck.push(path.join(exportTexturesDir, 'entity', `${textureName}_4096.png`));
    // Fallback to 1024 version
    pathsToCheck.push(path.join(exportTexturesDir, 'entity', `${textureName}_1024.png`));
    // Fallback to original in entities folder
    pathsToCheck.push(path.join(entitiesDir, 'texture', `${textureName}.png`));
    // Fallback to input folder entity textures (most entity textures are here!)
    if (inputDir) {
      pathsToCheck.push(path.join(inputDir, 'entity', `${textureName}.png`));
    }
  } else {
    // Try block_4096 folder first (4096x for entities)
    pathsToCheck.push(path.join(exportTexturesDir, 'block_4096', `${cleanRef}_4096.png`));
    // Fallback to block folder (1024x)
    pathsToCheck.push(path.join(exportTexturesDir, 'block', `${cleanRef}_1024.png`));
    pathsToCheck.push(path.join(entitiesDir, 'block', `${cleanRef}.png`));
    // Fallback to input folder
    if (inputDir) {
      pathsToCheck.push(path.join(inputDir, 'block', `${cleanRef}.png`));
    }
  }

  // Return first path that exists (or first option if none exist)
  for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return pathsToCheck[0];
}

/**
 * Process a single model
 */
async function processModel(modelName, options) {
  const { entitiesDir, outputDir, pack, scale, verbose, exportTexturesDir, inputDir } = options;
  
  // Model JSON files are in entities/model/ (the static model definitions)
  const modelPath = path.join(entitiesDir, `${modelName}.json`);
  
  if (!await fs.pathExists(modelPath)) {
    throw new Error(`Model not found: ${modelPath}`);
  }
  
  if (verbose) console.log(chalk.gray(`  Loading model: ${modelName}`));
  
  // Load model - use the directory containing models for resolving texture refs
  const entitiesBaseDir = path.dirname(entitiesDir);
  const model = await loadModel(modelPath, entitiesBaseDir);
  
  // Get texture paths - use upscaled textures from export folder
  const texturePaths = [];
  for (const [key, value] of Object.entries(model.rawTextures || {})) {
    if (value && !value.startsWith('#')) {
      // Resolve to upscaled texture path in export folder (with inputDir fallback)
      const resolved = resolveUpscaledTexturePath(value, exportTexturesDir, entitiesBaseDir, inputDir);
      if (!texturePaths.includes(resolved)) {
        texturePaths.push(resolved);
      }
    }
  }
  
  if (verbose) console.log(chalk.gray(`  Textures: ${texturePaths.length}`));
  
  // Update model.textures with resolved paths for atlas creation
  const resolvedTextures = {};
  for (const [key, value] of Object.entries(model.rawTextures || {})) {
    if (value && !value.startsWith('#')) {
      resolvedTextures[key] = resolveUpscaledTexturePath(value, exportTexturesDir, entitiesBaseDir, inputDir);
    }
  }
  model.textures = resolvedTextures;
  
  // Create texture atlas
  const textureAtlas = await createTextureAtlas(model, texturePaths);
  
  // Generate GLB
  const glbData = generateEntityGLB({
    model,
    textureAtlas,
    scale
  });
  
  if (!glbData) {
    throw new Error(`Failed to generate GLB for ${modelName}`);
  }
  
  // Get category
  const categories = await loadCategories();
  const category = getCategory(modelName, categories);
  
  // Create output path
  const outputPath = path.join(outputDir, pack, 'models', 'entities', category, `${modelName}.glb`);
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, glbData);
  
  // Generate metadata
  const metadata = generateEntityMetadata(model);
  metadata.category = category;
  
  return {
    name: modelName,
    category,
    outputPath,
    metadata
  };
}

/**
 * Process all models
 */
async function processAllModels(options) {
  const { entitiesDir, outputDir, pack, scale, verbose, exportTexturesDir } = options;
  
  const files = await fs.readdir(entitiesDir);
  const modelFiles = files.filter(f => f.endsWith('.json'));
  
  console.log(chalk.bold(`\nProcessing ${modelFiles.length} entity models...\n`));
  
  const results = [];
  const errors = [];
  const categories = await loadCategories();
  const categoryResults = {};
  
  for (const file of modelFiles) {
    const modelName = path.basename(file, '.json');
    process.stdout.write(`  ${chalk.cyan(modelName.padEnd(25))}`);
    
    try {
      const result = await processModel(modelName, options);
      results.push(result);
      
      // Track by category
      if (!categoryResults[result.category]) {
        categoryResults[result.category] = [];
      }
      categoryResults[result.category].push(result.name);
      
      console.log(chalk.green('✓'));
    } catch (err) {
      errors.push({ name: modelName, error: err.message });
      console.log(chalk.red(`✗ ${err.message}`));
    }
  }
  
  // Generate output files
  const exportDir = path.join(outputDir, pack);
  
  // 1. Generate entity_metadata.lua
  await generateMetadataLua(results, exportDir, pack);
  
  // 2. Generate list files
  await generateListFiles(results, categoryResults, exportDir);
  
  // Summary
  console.log(chalk.bold(`\n${'─'.repeat(50)}`));
  console.log(chalk.bold(`Results:`));
  console.log(chalk.green(`  ✓ Processed: ${results.length} models`));
  if (errors.length > 0) {
    console.log(chalk.red(`  ✗ Errors: ${errors.length} models`));
  }
  console.log(chalk.gray(`  Output: ${exportDir}`));
  console.log('');
  
  return { results, errors };
}

/**
 * Process entities for a texturepack (called from converter.js)
 * Uses upscaled textures from the export folder
 * @param {Object} options - Processing options
 * @param {string} options.texturepackName - Name of the texturepack
 * @param {string} options.outputBaseDir - Base output directory (e.g., ./export)
 * @param {string} options.entitiesModelDir - Directory containing entity model JSON files
 * @param {string} options.inputDir - Input directory containing original textures (e.g., ./input/Skyblox)
 * @param {number} options.scale - Scale factor
 * @param {boolean} options.showProgress - Show progress output
 * @returns {Promise<{results: Object[], errors: Object[]}>}
 */
export async function processEntitiesForPack({
  texturepackName,
  outputBaseDir,
  entitiesModelDir,
  inputDir,
  scale = 1.0,
  showProgress = true
}) {
  const exportTexturesDir = path.join(outputBaseDir, texturepackName, 'textures');
  // Derive inputDir from outputBaseDir if not provided
  const effectiveInputDir = inputDir || path.join(path.dirname(outputBaseDir), 'input', texturepackName);
  
  // Check if model directory exists
  if (!await fs.pathExists(entitiesModelDir)) {
    console.log(chalk.yellow(`  Entity models directory not found: ${entitiesModelDir}`));
    return { results: [], errors: [] };
  }
  
  const files = await fs.readdir(entitiesModelDir);
  const modelFiles = files.filter(f => f.endsWith('.json'));
  
  if (modelFiles.length === 0) {
    console.log(chalk.yellow(`  No entity models found in: ${entitiesModelDir}`));
    return { results: [], errors: [] };
  }
  
  console.log(chalk.bold(`Processing ${modelFiles.length} entity models...`));
  
  const results = [];
  const errors = [];
  const categories = await loadCategories();
  const categoryResults = {};
  
  // Create progress tracker
  const progressTracker = showProgress ? new ProgressTracker({
    phase: `Generating entity GLBs`,
    total: modelFiles.length
  }) : null;
  
  if (progressTracker) progressTracker.render();
  
  for (const file of modelFiles) {
    const modelName = path.basename(file, '.json');
    
    if (progressTracker) {
      progressTracker.update({ currentItem: modelName });
    }
    
    try {
      const result = await processModel(modelName, {
        entitiesDir: entitiesModelDir,
        outputDir: outputBaseDir,
        pack: texturepackName,
        scale: 1/16 * scale,
        verbose: false,
        exportTexturesDir,
        inputDir: effectiveInputDir
      });
      
      results.push(result);
      
      // Track by category
      if (!categoryResults[result.category]) {
        categoryResults[result.category] = [];
      }
      categoryResults[result.category].push(result.name);
      
      if (progressTracker) {
        progressTracker.incrementSuccess(modelName);
      }
    } catch (err) {
      errors.push({ name: modelName, error: err.message });
      if (progressTracker) {
        progressTracker.incrementFailed(modelName);
      }
    }
  }
  
  if (progressTracker) {
    progressTracker.finish();
  }
  
  // Generate output files
  const exportDir = path.join(outputBaseDir, texturepackName);
  
  if (results.length > 0) {
    // Generate entity_metadata.lua
    await generateMetadataLua(results, exportDir, texturepackName);
    
    // Generate list files
    await generateListFiles(results, categoryResults, exportDir);
  }
  
  return { results, errors, categoryResults };
}

/**
 * Generate entity_metadata.lua
 */
async function generateMetadataLua(results, exportDir, pack) {
  const lines = [
    '--[[',
    `    Entity metadata for ${pack}`,
    '    Generated by texturepack-converter',
    ']]',
    '',
    'local ENTITY_METADATA = {'
  ];
  
  for (const result of results) {
    const { name, metadata } = result;
    lines.push(`    ["${name}"] = {`);
    lines.push(`        category = "${metadata.category}",`);
    lines.push(`        elements = ${metadata.elements},`);
    lines.push(`        dimensions = {x = ${metadata.dimensions.x}, y = ${metadata.dimensions.y}, z = ${metadata.dimensions.z}},`);
    lines.push(`        assetId = nil,`);
    lines.push('    },');
  }
  
  lines.push('}');
  lines.push('');
  lines.push('return ENTITY_METADATA');
  
  const luaPath = path.join(exportDir, 'entity_metadata.lua');
  await fs.ensureDir(exportDir);
  await fs.writeFile(luaPath, lines.join('\n'));
  console.log(chalk.gray(`  Generated: entity_metadata.lua`));
}

/**
 * Generate list files
 */
async function generateListFiles(results, categoryResults, exportDir) {
  const listsDir = path.join(exportDir, 'lists');
  await fs.ensureDir(listsDir);
  
  // All entities list
  const allEntities = results.map(r => `${r.name}=`).sort().join('\n') + '\n';
  await fs.writeFile(path.join(listsDir, 'all_entities.txt'), allEntities);
  console.log(chalk.gray(`  Generated: lists/all_entities.txt`));
  
  // Category lists
  for (const [category, entities] of Object.entries(categoryResults)) {
    const content = entities.sort().join('\n') + '\n';
    const fileName = `${category}.txt`;
    await fs.writeFile(path.join(listsDir, fileName), content);
    console.log(chalk.gray(`  Generated: lists/${fileName}`));
  }
}

// CLI Setup - only runs when executed directly
function runCLI() {
  program
    .name('entityParser')
    .description('Convert Minecraft JSON models to GLB')
    .version('1.0.0');

  program
    .option('-m, --model <name>', 'Process single model (without .json extension)')
    .option('-a, --all', 'Process all models')
    .option('-p, --pack <name>', 'Pack name for output', 'Skyblox')
    .option('-o, --output <dir>', 'Output base directory', './export')
    .option('-i, --input <dir>', 'Input texture pack directory (default: ./input/{pack})')
    .option('-s, --scale <number>', 'Scale factor (16 units = 1 unit at scale 1)', parseFloat, 1.0)
    .option('-e, --entities-dir <dir>', 'Path to entities model directory', './entities/model')
    .option('-t, --textures-dir <dir>', 'Path to upscaled textures (default: export/{pack}/textures)')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (options) => {
      try {
        // Resolve paths
        const entitiesDir = path.resolve(options.entitiesDir);
        const outputDir = path.resolve(options.output);
        const exportTexturesDir = options.texturesDir 
          ? path.resolve(options.texturesDir)
          : path.join(outputDir, options.pack, 'textures');
        const inputDir = options.input
          ? path.resolve(options.input)
          : path.join(path.resolve('.'), 'input', options.pack);
        const scale = 1 / 16 * options.scale;
        
        const processOptions = {
          entitiesDir,
          outputDir,
          pack: options.pack,
          scale,
          verbose: options.verbose,
          exportTexturesDir,
          inputDir
        };
        
        if (options.model) {
          // Process single model
          console.log(chalk.bold(`\nProcessing model: ${options.model}\n`));
          const result = await processModel(options.model, processOptions);
          console.log(chalk.green(`✓ Generated: ${result.outputPath}`));
          console.log(chalk.gray(`  Category: ${result.category}`));
          console.log(chalk.gray(`  Elements: ${result.metadata.elements}`));
          console.log('');
        } else if (options.all) {
          // Process all models
          await processAllModels(processOptions);
        } else {
          program.help();
        }
      } catch (err) {
        console.error(chalk.red(`\nError: ${err.message}`));
        if (options.verbose) {
          console.error(err.stack);
        }
        process.exit(1);
      }
    });

  program.parse();
}

// Only run CLI if this file is executed directly (not imported)
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('entityParser.js') || 
  process.argv[1].endsWith('entityParser')
);

if (isMainModule) {
  runCLI();
}
