import path from 'path';
import fs from 'fs-extra';
import { generateOBJFromPixels, generateMTL } from './objGenerator.js';
import { generateFBXFromPixels, resetFbxIdCounter } from './fbxGenerator.js';
import { generateGLBFromPixels } from './glbGenerator.js';
import {
  findPngFiles,
  validateImage,
  extractPixelData,
  writeOBJFile,
  writeMTLFile,
  getRelativeTexturePath,
  generateOutputPaths,
  upscaleTexture,
  calculatePixelBounds,
  writePixelSizesLua
} from './fileHandler.js';
import { formatError, getBaseName } from './utils.js';
import { ProgressTracker } from './progress.js';

/**
 * Convert a single texture file to OBJ/MTL and/or FBX using pixel-based voxel extrusion
 * @param {Object} options - Conversion options
 * @param {string} options.texturePath - Path to texture file
 * @param {string} options.inputBaseDir - Base input directory
 * @param {string} options.outputBaseDir - Base output directory
 * @param {number} options.scale - Scale factor
 * @param {string} options.coordinateSystem - Coordinate system
 * @param {string} options.format - Output format: 'obj', 'fbx', or 'both'
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: boolean, error?: string, warning?: string}>}
 */
export async function convertTexture({
  texturePath,
  inputBaseDir,
  outputBaseDir,
  scale = 1.0,
  coordinateSystem = 'z-up',
  format = 'both',
  onProgress
}) {
  try {
    // Validate image
    const imageInfo = await validateImage(texturePath);
    if (!imageInfo.valid) {
      return {
        success: false,
        error: imageInfo.error || 'Invalid image file'
      };
    }

    // Extract pixel data with alpha channel
    const pixelData = await extractPixelData(texturePath);

    // Generate output paths
    const { obj: objPath, mtl: mtlPath, baseName } = generateOutputPaths(
      texturePath,
      inputBaseDir,
      outputBaseDir
    );

    // Generate separate textures folder (sibling to models folder)
    // Structure: outputBaseDir/models/items/*.obj, *.mtl
    //           outputBaseDir/textures/items/*_1024.png
    const modelsDir = path.dirname(objPath);
    // Go up to the parent of 'models' folder (e.g., export/GoodVibes)
    const texturepackDir = path.dirname(path.dirname(modelsDir));
    const folderName = path.basename(modelsDir); // 'items' or 'blocks'
    const texturesDir = path.join(texturepackDir, 'textures', folderName);

    // Ensure textures directory exists
    await fs.ensureDir(texturesDir);

    // Generate upscaled texture path in separate textures folder
    const upscaledTexturePath = path.join(texturesDir, `${baseName}_1024.png`);

    // Upscale texture to 1024×1024 using nearest-neighbor
    await upscaleTexture(texturePath, upscaledTexturePath);

    // Generate material name (sanitized base name)
    const materialName = baseName.replace(/[^a-zA-Z0-9_]/g, '_');
    const mtlFileName = path.basename(mtlPath);

    // Calculate relative texture path from MTL to upscaled texture
    const relativeTexturePath = getRelativeTexturePath(mtlPath, upscaledTexturePath);

    const outputFiles = { texture: texturePath };

    // Generate OBJ format if requested
    if (format === 'obj' || format === 'both') {
      const objContent = generateOBJFromPixels({
        materialName,
        mtlFileName,
        width: pixelData.width,
        height: pixelData.height,
        pixels: pixelData.pixels,
        channels: pixelData.channels,
        scale,
        coordinateSystem
      });

      const mtlContent = generateMTL({
        materialName,
        texturePath: relativeTexturePath
      });

      await writeOBJFile(objPath, objContent);
      await writeMTLFile(mtlPath, mtlContent);
      outputFiles.obj = objPath;
      outputFiles.mtl = mtlPath;
    }

    // Generate FBX format if requested
    if (format === 'fbx') {
      const fbxPath = objPath.replace(/\.obj$/, '.fbx');
      
      const fbxContent = generateFBXFromPixels({
        modelName: baseName,
        texturePath: relativeTexturePath,
        width: pixelData.width,
        height: pixelData.height,
        pixels: pixelData.pixels,
        channels: pixelData.channels,
        scale,
        coordinateSystem
      });

      if (fbxContent) {
        await fs.ensureDir(path.dirname(fbxPath));
        await fs.writeFile(fbxPath, fbxContent, 'utf8');
        outputFiles.fbx = fbxPath;
      }
    }

    // Generate GLB format if requested (default for 'both')
    if (format === 'glb' || format === 'both') {
      const glbPath = objPath.replace(/\.obj$/, '.glb');
      
      // Read the upscaled texture for embedding (better quality)
      const textureBuffer = await fs.readFile(upscaledTexturePath);
      
      const glbContent = generateGLBFromPixels({
        modelName: baseName,
        width: pixelData.width,
        height: pixelData.height,
        pixels: pixelData.pixels,
        channels: pixelData.channels,
        scale,
        coordinateSystem,
        textureData: textureBuffer
      });

      if (glbContent) {
        await fs.ensureDir(path.dirname(glbPath));
        await fs.writeFile(glbPath, glbContent);
        outputFiles.glb = glbPath;
      }
    }

    if (onProgress) {
      onProgress({
        ...outputFiles,
        warning: imageInfo.warning
      });
    }

    return {
      success: true,
      warning: imageInfo.warning
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error, `Failed to convert ${texturePath}`)
    };
  }
}

/**
 * Convert all textures in a directory
 * @param {Object} options - Conversion options
 * @param {string} options.inputDir - Input directory
 * @param {string} options.outputDir - Output directory (optional)
 * @param {boolean} options.recursive - Process subdirectories
 * @param {number} options.scale - Scale factor
 * @param {string} options.coordinateSystem - Coordinate system
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: number, failed: number, warnings: number, errors: string[]}>}
 */
export async function convertDirectory({
  inputDir,
  outputDir,
  recursive = true,
  scale = 1.0,
  coordinateSystem = 'z-up',
  onProgress
}) {
  const results = {
    success: 0,
    failed: 0,
    warnings: 0,
    errors: []
  };

  try {
    // Find all PNG files
    const textureFiles = await findPngFiles(inputDir, recursive);

    if (textureFiles.length === 0) {
      results.errors.push(`No PNG files found in ${inputDir}`);
      return results;
    }

    // Use input directory as output if not specified
    const outputBaseDir = outputDir || inputDir;

    // Process each texture
    for (const texturePath of textureFiles) {
      const result = await convertTexture({
        texturePath,
        inputBaseDir: inputDir,
        outputBaseDir,
        scale,
        coordinateSystem,
        onProgress
      });

      if (result.success) {
        results.success++;
        if (result.warning) {
          results.warnings++;
        }
      } else {
        results.failed++;
        results.errors.push(result.error || 'Unknown error');
      }
    }

    return results;
  } catch (error) {
    results.errors.push(formatError(error, 'Directory conversion failed'));
    return results;
  }
}

/**
 * Find folder in texturepack (supports various structures)
 * @param {string} texturepackPath - Path to texturepack folder
 * @param {string[]} folderNames - Array of folder names to search for (e.g., ['items', 'item'] or ['blocks', 'block'])
 * @returns {Promise<string|null>} Path to folder or null if not found
 */
async function findFolder(texturepackPath, folderNames) {
  // Common paths to check (in order of preference)
  const possiblePaths = [];
  for (const folderName of folderNames) {
    possiblePaths.push(
      path.join(texturepackPath, folderName),
      path.join(texturepackPath, 'textures', folderName)
    );
  }

  // Check each possible path
  for (const folderPath of possiblePaths) {
    if (await fs.pathExists(folderPath)) {
      const stats = await fs.stat(folderPath);
      if (stats.isDirectory()) {
        return folderPath;
      }
    }
  }

  // If not found, recursively search for folders with matching names
  async function searchRecursive(dir, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return null;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryPath = path.join(dir, entry.name);
          if (folderNames.includes(entry.name)) {
            return entryPath;
          }
          // Recursively search subdirectories
          const found = await searchRecursive(entryPath, depth + 1, maxDepth);
          if (found) return found;
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    return null;
  }

  return await searchRecursive(texturepackPath);
}

/**
 * Find items folder in texturepack (supports various structures)
 * @param {string} texturepackPath - Path to texturepack folder
 * @returns {Promise<string|null>} Path to items folder or null if not found
 */
export async function findItemsFolder(texturepackPath) {
  return await findFolder(texturepackPath, ['items', 'item']);
}

/**
 * Find blocks folder in texturepack (supports various structures)
 * @param {string} texturepackPath - Path to texturepack folder
 * @returns {Promise<string|null>} Path to blocks folder or null if not found
 */
export async function findBlocksFolder(texturepackPath) {
  return await findFolder(texturepackPath, ['blocks', 'block']);
}

/**
 * Find entity folder in texturepack (supports various structures)
 * @param {string} texturepackPath - Path to texturepack folder
 * @returns {Promise<string|null>} Path to entity folder or null if not found
 */
export async function findEntityFolder(texturepackPath) {
  return await findFolder(texturepackPath, ['entity', 'entities', 'texture']);
}

/**
 * Upscale a blocks texture to 1024×1024 (no OBJ generation)
 * @param {Object} options - Upscaling options
 * @param {string} options.texturePath - Path to texture file
 * @param {string} options.inputBaseDir - Base input directory (blocks folder)
 * @param {string} options.outputBaseDir - Base output directory (models folder)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: boolean, error?: string, warning?: string}>}
 */
async function upscaleBlocksTexture({
  texturePath,
  inputBaseDir,
  outputBaseDir,
  size = 1024,
  onProgress
}) {
  try {
    // Validate image
    const imageInfo = await validateImage(texturePath);
    if (!imageInfo.valid) {
      return {
        success: false,
        error: imageInfo.error || 'Invalid image file'
      };
    }

    // Generate output path for upscaled texture
    const baseName = getBaseName(texturePath);
    const relativePath = path.relative(inputBaseDir, path.dirname(texturePath));

    // Output directly to the provided outputBaseDir
    let texturesDir = relativePath && relativePath !== '.'
      ? path.join(outputBaseDir, relativePath)
      : outputBaseDir;

    // Ensure textures directory exists
    await fs.ensureDir(texturesDir);

    const upscaledTexturePath = path.join(texturesDir, `${baseName}_${size}.png`);

    // Upscale texture using nearest-neighbor
    await upscaleTexture(texturePath, upscaledTexturePath, size);

    if (onProgress) {
      onProgress({
        texture: texturePath,
        upscaled: upscaledTexturePath,
        warning: imageInfo.warning
      });
    }

    return {
      success: true,
      warning: imageInfo.warning
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error, `Failed to upscale ${texturePath}`)
    };
  }
}

/**
 * Upscale an entity texture to 8192×8192 (no OBJ generation)
 * Preserves subdirectory structure for entity textures
 * @param {Object} options - Upscaling options
 * @param {string} options.texturePath - Path to texture file
 * @param {string} options.inputBaseDir - Base input directory (entity folder)
 * @param {string} options.outputBaseDir - Base output directory
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: boolean, error?: string, warning?: string}>}
 */
async function upscaleEntityTexture({
  texturePath,
  inputBaseDir,
  outputBaseDir,
  onProgress
}) {
  try {
    // Validate image
    const imageInfo = await validateImage(texturePath);
    if (!imageInfo.valid) {
      return {
        success: false,
        error: imageInfo.error || 'Invalid image file'
      };
    }

    // Generate output path preserving subdirectory structure
    const baseName = getBaseName(texturePath);
    const relativePath = path.relative(inputBaseDir, texturePath);
    const relativeDir = path.dirname(relativePath);

    // Output to textures/entity/{subdir}/ folder
    const texturesDir = relativeDir && relativeDir !== '.'
      ? path.join(outputBaseDir, relativeDir)
      : outputBaseDir;

    // Ensure textures directory exists
    await fs.ensureDir(texturesDir);

    const upscaledTexturePath = path.join(texturesDir, `${baseName}_8192.png`);

    // Upscale texture to 8192×8192 using nearest-neighbor (8x of 1024)
    await upscaleTexture(texturePath, upscaledTexturePath, 8192);

    if (onProgress) {
      onProgress({
        texture: texturePath,
        upscaled: upscaledTexturePath,
        warning: imageInfo.warning
      });
    }

    return {
      success: true,
      warning: imageInfo.warning
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error, `Failed to upscale ${texturePath}`)
    };
  }
}

/**
 * Process a folder of textures (items, blocks, or entity)
 * @param {Object} options - Processing options
 * @param {string} options.folderPath - Path to folder (items, blocks, or entity)
 * @param {string} options.folderName - Name of folder ('items', 'blocks', or 'entity')
 * @param {string} options.outputDir - Output directory
 * @param {number} options.scale - Scale factor (only used for items)
 * @param {string} options.coordinateSystem - Coordinate system (only used for items)
 * @param {string} options.format - Output format: 'obj', 'fbx', or 'both'
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: number, failed: number, warnings: number, errors: string[], pixelSizes: Object}>}
 */
async function processTextureFolder({
  folderPath,
  folderName,
  outputDir,
  scale,
  coordinateSystem,
  format = 'both',
  progressTracker = null
}) {
  const results = {
    success: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    pixelSizes: {}
  };

  // Find all PNG files in folder (recursively to handle subfolders)
  const textureFiles = await findPngFiles(folderPath, true);

  if (textureFiles.length === 0) {
    results.errors.push(`No PNG files found in ${folderName} folder: ${folderPath}`);
    return results;
  }

  // Determine folder type
  const isBlocksFolder = folderName === 'blocks' || folderName === 'block';
  const isBlocks4096Folder = folderName === 'blocks_4096';
  const isEntityFolder = folderName === 'entity' || folderName === 'entities' || folderName === 'texture';

  // Update progress tracker with total if provided
  if (progressTracker) {
    progressTracker.update({ total: progressTracker.total + textureFiles.length });
  }

  // Process each texture
  for (let i = 0; i < textureFiles.length; i++) {
    const texturePath = textureFiles[i];
    const itemName = getBaseName(texturePath);
    let result;

    if (progressTracker) {
      progressTracker.update({ currentItem: itemName });
    }

    if (isBlocksFolder) {
      // Blocks: only upscale to 1024x, no OBJ generation
      result = await upscaleBlocksTexture({
        texturePath,
        inputBaseDir: folderPath,
        outputBaseDir: outputDir
      });
    } else if (isBlocks4096Folder) {
      // Blocks 4096x: upscale to 4096x for entity use
      result = await upscaleBlocksTexture({
        texturePath,
        inputBaseDir: folderPath,
        outputBaseDir: outputDir,
        size: 4096
      });
    } else if (isEntityFolder) {
      // Entity: only upscale, preserve subdirectory structure
      result = await upscaleEntityTexture({
        texturePath,
        inputBaseDir: folderPath,
        outputBaseDir: outputDir
      });
    } else {
      // Items: generate OBJ/MTL/FBX/GLB and upscale texture
      result = await convertTexture({
        texturePath,
        inputBaseDir: folderPath,
        outputBaseDir: outputDir,
        scale,
        coordinateSystem,
        format
      });

      // Calculate pixel bounds for items
      const bounds = await calculatePixelBounds(texturePath);
      if (bounds) {
        results.pixelSizes[itemName] = bounds;
      }
    }

    if (result.success) {
      results.success++;
      if (result.warning) {
        results.warnings++;
        if (progressTracker) progressTracker.incrementWarning();
      }
      if (progressTracker) {
        progressTracker.incrementSuccess(itemName);
      }
    } else {
      results.failed++;
      results.errors.push(result.error || 'Unknown error');
      if (progressTracker) {
        progressTracker.incrementFailed(itemName);
      }
    }
  }

  return results;
}

/**
 * Convert a single texturepack (processes items and blocks folders within texturepack)
 * @param {Object} options - Conversion options
 * @param {string} options.texturepackPath - Path to texturepack folder
 * @param {string} options.outputBaseDir - Base output directory
 * @param {number} options.scale - Scale factor (applied uniformly to all textures in pack)
 * @param {string} options.coordinateSystem - Coordinate system
 * @param {string} options.format - Output format: 'obj', 'fbx', or 'both'
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: number, failed: number, warnings: number, errors: string[]}>}
 */
export async function convertTexturepack({
  texturepackPath,
  outputBaseDir,
  scale = 1.0,
  coordinateSystem = 'z-up',
  format = 'both',
  showProgress = true,
  processEntities = true,
  entitiesModelDir = null
}) {
  const results = {
    success: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    entityResults: null
  };

  // Collect all pixel sizes from items
  const allPixelSizes = {};

  try {
    // Get texturepack name for output structure
    const texturepackName = path.basename(texturepackPath);
    // Output OBJ/MTL files and 1024x textures to models folder
    const outputTexturepackDir = path.join(outputBaseDir, texturepackName, 'models');
    const outputTexturesDir = path.join(outputBaseDir, texturepackName, 'textures');

    // Create progress tracker
    const progressTracker = showProgress ? new ProgressTracker({
      phase: `Converting ${texturepackName}`,
      total: 0
    }) : null;

    // Find and process items folder
    const itemsPath = await findItemsFolder(texturepackPath);
    if (itemsPath) {
      if (progressTracker) {
        progressTracker.update({ phase: `Converting ${texturepackName} (items)` });
        progressTracker.render();
      }

      // Output items to models/items folder
      const itemsOutputDir = path.join(outputTexturepackDir, 'items');
      const itemsResults = await processTextureFolder({
        folderPath: itemsPath,
        folderName: 'items',
        outputDir: itemsOutputDir,
        scale,
        coordinateSystem,
        format,
        progressTracker
      });

      results.success += itemsResults.success;
      results.failed += itemsResults.failed;
      results.warnings += itemsResults.warnings;
      results.errors.push(...itemsResults.errors);

      // Collect pixel sizes
      Object.assign(allPixelSizes, itemsResults.pixelSizes);
    }
    // Note: items folder is optional if blocks folder exists

    // Find and process blocks folder
    const blocksPath = await findBlocksFolder(texturepackPath);
    if (blocksPath) {
      if (progressTracker) {
        progressTracker.update({ phase: `Converting ${texturepackName} (blocks 1024x)` });
      }

      // Output blocks to textures/block folder (1024x upscaled textures)
      const blocksOutputDir = path.join(outputTexturesDir, 'block');
      const blocksResults = await processTextureFolder({
        folderPath: blocksPath,
        folderName: 'blocks',
        outputDir: blocksOutputDir,
        scale, // Not used for blocks, but passed for consistency
        coordinateSystem, // Not used for blocks, but passed for consistency
        progressTracker
      });

      results.success += blocksResults.success;
      results.failed += blocksResults.failed;
      results.warnings += blocksResults.warnings;
      results.errors.push(...blocksResults.errors);

      // Also create 8192x versions for entity use (8x of 1024)
      if (progressTracker) {
        progressTracker.update({ phase: `Converting ${texturepackName} (blocks 8192x for entities)` });
      }

      const blocks8192OutputDir = path.join(outputTexturesDir, 'block_8192');
      const blocks8192Results = await processTextureFolder({
        folderPath: blocksPath,
        folderName: 'blocks_8192',
        outputDir: blocks8192OutputDir,
        scale,
        coordinateSystem,
        progressTracker
      });

      results.success += blocks8192Results.success;
      results.failed += blocks8192Results.failed;
      results.warnings += blocks8192Results.warnings;
      results.errors.push(...blocks8192Results.errors);
    }
    // Note: blocks folder is optional, so we don't error if not found

    // Find and process entity folder
    const entityPath = await findEntityFolder(texturepackPath);
    if (entityPath) {
      if (progressTracker) {
        progressTracker.update({ phase: `Converting ${texturepackName} (entity textures)` });
      }

      // Output entity textures to textures/entity folder
      const entityOutputDir = path.join(outputTexturesDir, 'entity');
      const entityResults = await processTextureFolder({
        folderPath: entityPath,
        folderName: 'entity',
        outputDir: entityOutputDir,
        scale,
        coordinateSystem,
        progressTracker
      });

      results.success += entityResults.success;
      results.failed += entityResults.failed;
      results.warnings += entityResults.warnings;
      results.errors.push(...entityResults.errors);
    }

    // Finish progress tracker
    if (progressTracker) {
      progressTracker.finish();
    }

    // If no folders were found, return error
    if (!itemsPath && !blocksPath && !entityPath) {
      results.errors.push(`No items, blocks, or entity folder found in texturepack: ${texturepackPath}`);
      return results;
    }

    // Write pixel sizes Lua file if we have any items
    if (Object.keys(allPixelSizes).length > 0) {
      const luaOutputPath = path.join(outputBaseDir, texturepackName, 'item_pixel_sizes.lua');
      await writePixelSizesLua(luaOutputPath, allPixelSizes, texturepackName);
    }

    // Process entity models if requested and entity textures were processed
    if (processEntities && (entityPath || blocksPath)) {
      const { processEntitiesForPack } = await import('./entityParser.js');
      
      // Determine where to find entity model JSON files
      const modelDir = entitiesModelDir || path.join(path.dirname(path.dirname(__dirname)), 'entities', 'model');
      
      if (await fs.pathExists(modelDir)) {
        console.log('\n');
        results.entityResults = await processEntitiesForPack({
          texturepackName,
          outputBaseDir,
          entitiesModelDir: modelDir,
          scale: 1.0,
          showProgress
        });
      }
    }

    return results;
  } catch (error) {
    results.errors.push(formatError(error, `Texturepack conversion failed: ${texturepackPath}`));
    return results;
  }
}

/**
 * Convert all texturepacks in a directory
 * @param {Object} options - Conversion options
 * @param {string} options.texturepacksDir - Directory containing texturepack folders
 * @param {string} options.outputDir - Output directory
 * @param {number} options.scale - Scale factor (applied uniformly to all texturepacks)
 * @param {string} options.coordinateSystem - Coordinate system
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: number, failed: number, warnings: number, errors: string[], texturepacks: {name: string, results: object}[]}>}
 */
export async function convertTexturepacks({
  texturepacksDir,
  outputDir,
  scale = 1.0,
  coordinateSystem = 'z-up',
  onProgress
}) {
  const overallResults = {
    success: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    texturepacks: []
  };

  try {
    // Read all entries in texturepacks directory
    const entries = await fs.readdir(texturepacksDir, { withFileTypes: true });
    const texturepackDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(texturepacksDir, entry.name));

    if (texturepackDirs.length === 0) {
      overallResults.errors.push(`No texturepack folders found in ${texturepacksDir}`);
      return overallResults;
    }

    // Process each texturepack
    for (const texturepackPath of texturepackDirs) {
      const texturepackName = path.basename(texturepackPath);

      const packResults = await convertTexturepack({
        texturepackPath,
        outputBaseDir: outputDir,
        scale,
        coordinateSystem,
        onProgress
      });

      overallResults.success += packResults.success;
      overallResults.failed += packResults.failed;
      overallResults.warnings += packResults.warnings;
      overallResults.errors.push(...packResults.errors.map(err => `[${texturepackName}] ${err}`));
      overallResults.texturepacks.push({
        name: texturepackName,
        results: packResults
      });
    }

    return overallResults;
  } catch (error) {
    overallResults.errors.push(formatError(error, 'Texturepacks conversion failed'));
    return overallResults;
  }
}
