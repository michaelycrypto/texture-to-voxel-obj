import path from 'path';
import { generateOBJFromPixels, generateMTL } from './objGenerator.js';
import {
  findPngFiles,
  validateImage,
  extractPixelData,
  writeOBJFile,
  writeMTLFile,
  getRelativeTexturePath,
  generateOutputPaths
} from './fileHandler.js';
import { formatError } from './utils.js';

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

    // Generate material name (sanitized base name)
    const materialName = baseName.replace(/[^a-zA-Z0-9_]/g, '_');
    const mtlFileName = path.basename(mtlPath);

    // Calculate relative texture path from MTL to texture
    const relativeTexturePath = getRelativeTexturePath(mtlPath, texturePath);

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
