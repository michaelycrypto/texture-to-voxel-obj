import path from 'path';
import fs from 'fs-extra';
import { generateOBJFromPixels, generateMTL } from './objGenerator.js';
import {
  findPngFiles,
  validateImage,
  extractPixelData,
  writeOBJFile,
  writeMTLFile,
  getRelativeTexturePath,
  generateOutputPaths,
  upscaleTexture
} from './fileHandler.js';
import { formatError, getBaseName } from './utils.js';

/**
 * Convert a single texture file to OBJ/MTL using pixel-based voxel extrusion
 * @param {Object} options - Conversion options
 * @param {string} options.texturePath - Path to texture file
 * @param {string} options.inputBaseDir - Base input directory
 * @param {string} options.outputBaseDir - Base output directory
 * @param {number} options.scale - Scale factor
 * @param {string} options.coordinateSystem - Coordinate system
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: boolean, error?: string, warning?: string}>}
 */
export async function convertTexture({
  texturePath,
  inputBaseDir,
  outputBaseDir,
  scale = 1.0,
  coordinateSystem = 'z-up',
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

    // Generate OBJ content from pixel data (voxel-based)
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

    // Generate MTL content
    const mtlContent = generateMTL({
      materialName,
      texturePath: relativeTexturePath
    });

    // Write files
    await writeOBJFile(objPath, objContent);
    await writeMTLFile(mtlPath, mtlContent);

    if (onProgress) {
      onProgress({
        texture: texturePath,
        obj: objPath,
        mtl: mtlPath,
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

    // Generate output path for upscaled texture in separate textures folder
    // Structure: outputBaseDir/models/blocks/... -> outputBaseDir/textures/blocks/...
    const baseName = getBaseName(texturePath);
    const relativePath = path.relative(inputBaseDir, path.dirname(texturePath));

    // Convert models/blocks to textures/blocks
    const modelsDir = relativePath && relativePath !== '.'
      ? path.join(outputBaseDir, relativePath)
      : outputBaseDir;
    // Go up to the parent of 'models' folder (e.g., export/GoodVibes)
    const texturepackDir = path.dirname(path.dirname(modelsDir));
    const folderName = path.basename(modelsDir); // 'blocks' or 'block'
    let texturesDir = path.join(texturepackDir, 'textures', folderName);

    // Preserve subdirectory structure if exists
    if (relativePath && relativePath !== '.') {
      const subDir = path.dirname(relativePath);
      if (subDir && subDir !== '.') {
        texturesDir = path.join(texturesDir, subDir);
      }
    }

    // Ensure textures directory exists
    await fs.ensureDir(texturesDir);

    const upscaledTexturePath = path.join(texturesDir, `${baseName}_1024.png`);

    // Upscale texture to 1024×1024 using nearest-neighbor
    await upscaleTexture(texturePath, upscaledTexturePath);

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
 * Process a folder of textures (items or blocks)
 * @param {Object} options - Processing options
 * @param {string} options.folderPath - Path to folder (items or blocks)
 * @param {string} options.folderName - Name of folder ('items' or 'blocks')
 * @param {string} options.outputDir - Output directory
 * @param {number} options.scale - Scale factor (only used for items)
 * @param {string} options.coordinateSystem - Coordinate system (only used for items)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: number, failed: number, warnings: number, errors: string[]}>}
 */
async function processTextureFolder({
  folderPath,
  folderName,
  outputDir,
  scale,
  coordinateSystem,
  onProgress
}) {
  const results = {
    success: 0,
    failed: 0,
    warnings: 0,
    errors: []
  };

  // Find all PNG files in folder (recursively to handle subfolders)
  const textureFiles = await findPngFiles(folderPath, true);

  if (textureFiles.length === 0) {
    results.errors.push(`No PNG files found in ${folderName} folder: ${folderPath}`);
    return results;
  }

  // Determine if this is a blocks folder (only upscale) or items folder (generate OBJ)
  const isBlocksFolder = folderName === 'blocks' || folderName === 'block';

  // Process each texture in batches to manage memory
  const batchSize = 50; // Process 50 textures at a time
  for (let i = 0; i < textureFiles.length; i += batchSize) {
    const batch = textureFiles.slice(i, i + batchSize);

    for (const texturePath of batch) {
      let result;

      if (isBlocksFolder) {
        // Blocks: only upscale, no OBJ generation
        result = await upscaleBlocksTexture({
          texturePath,
          inputBaseDir: folderPath,
          outputBaseDir: outputDir,
          onProgress
        });
      } else {
        // Items: generate OBJ/MTL and upscale texture
        result = await convertTexture({
          texturePath,
          inputBaseDir: folderPath,
          outputBaseDir: outputDir,
          scale,
          coordinateSystem,
          onProgress
        });
      }

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

    // Force garbage collection hint after each batch (if available)
    if (global.gc && i + batchSize < textureFiles.length) {
      global.gc();
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
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{success: number, failed: number, warnings: number, errors: string[]}>}
 */
export async function convertTexturepack({
  texturepackPath,
  outputBaseDir,
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
    // Get texturepack name for output structure
    const texturepackName = path.basename(texturepackPath);
    // Output OBJ/MTL files and 1024x textures to models folder
    const outputTexturepackDir = path.join(outputBaseDir, texturepackName, 'models');

    // Find and process items folder
    const itemsPath = await findItemsFolder(texturepackPath);
    if (itemsPath) {
      // Output items to models/items folder
      const itemsOutputDir = path.join(outputTexturepackDir, 'items');
      const itemsResults = await processTextureFolder({
        folderPath: itemsPath,
        folderName: 'items',
        outputDir: itemsOutputDir,
        scale,
        coordinateSystem,
        onProgress
      });

      results.success += itemsResults.success;
      results.failed += itemsResults.failed;
      results.warnings += itemsResults.warnings;
      results.errors.push(...itemsResults.errors);
    }
    // Note: items folder is optional if blocks folder exists

    // Find and process blocks folder
    const blocksPath = await findBlocksFolder(texturepackPath);
    if (blocksPath) {
      // Output blocks to models/blocks folder (only upscaled textures, no OBJ)
      const blocksOutputDir = path.join(outputTexturepackDir, 'blocks');
      const blocksResults = await processTextureFolder({
        folderPath: blocksPath,
        folderName: 'blocks',
        outputDir: blocksOutputDir,
        scale, // Not used for blocks, but passed for consistency
        coordinateSystem, // Not used for blocks, but passed for consistency
        onProgress
      });

      results.success += blocksResults.success;
      results.failed += blocksResults.failed;
      results.warnings += blocksResults.warnings;
      results.errors.push(...blocksResults.errors);
    }
    // Note: blocks folder is optional, so we don't error if not found

    // If no folders were found, return error
    if (!itemsPath && !blocksPath) {
      results.errors.push(`Neither items nor blocks folder found in texturepack: ${texturepackPath}`);
      return results;
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
