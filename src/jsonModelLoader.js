/**
 * JSON Model Loader for Minecraft JSON model definitions
 * Parses JSON models and resolves texture references
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Load and parse a JSON model file
 * @param {string} modelPath - Path to the JSON model file
 * @param {string} entitiesDir - Base entities directory
 * @returns {Promise<Object>} Parsed model with resolved textures
 */
export async function loadModel(modelPath, entitiesDir) {
  const modelData = await fs.readJson(modelPath);
  const modelName = path.basename(modelPath, '.json');
  
  // Handle parent inheritance if present
  if (modelData.parent) {
    const parentModel = await loadParentModel(modelData.parent, entitiesDir);
    modelData.elements = modelData.elements || parentModel.elements;
    modelData.textures = { ...parentModel.textures, ...modelData.textures };
  }
  
  // Resolve texture paths
  const resolvedTextures = {};
  for (const [key, value] of Object.entries(modelData.textures || {})) {
    resolvedTextures[key] = resolveTexturePath(value, entitiesDir);
  }
  
  return {
    name: modelData.name || modelName,
    elements: modelData.elements || [],
    textures: resolvedTextures,
    rawTextures: modelData.textures || {},
    ambientocclusion: modelData.ambientocclusion !== false,
    credit: modelData.credit
  };
}

/**
 * Load a parent model
 * @param {string} parentRef - Parent reference (e.g., "block/cube")
 * @param {string} entitiesDir - Base entities directory
 * @returns {Promise<Object>} Parent model data
 */
async function loadParentModel(parentRef, entitiesDir) {
  // Try to find parent in models directory
  const possiblePaths = [
    path.join(entitiesDir, 'model', `${parentRef}.json`),
    path.join(entitiesDir, 'model', `${parentRef.replace('block/', '')}.json`),
    path.join(entitiesDir, 'model', `${parentRef.replace('minecraft:', '')}.json`)
  ];
  
  for (const parentPath of possiblePaths) {
    if (await fs.pathExists(parentPath)) {
      return loadModel(parentPath, entitiesDir);
    }
  }
  
  // Return empty parent if not found
  console.warn(`Parent model not found: ${parentRef}`);
  return { elements: [], textures: {} };
}

/**
 * Resolve a texture reference to an actual file path
 * @param {string} textureRef - Texture reference (e.g., "block/anvil" or "#body")
 * @param {string} entitiesDir - Base entities directory
 * @returns {string} Resolved file path
 */
export function resolveTexturePath(textureRef, entitiesDir) {
  // If it's a reference to another key, return as-is for later resolution
  if (textureRef.startsWith('#')) {
    return textureRef;
  }
  
  // Remove minecraft: prefix if present
  let cleanRef = textureRef.replace('minecraft:', '');
  
  // Handle different texture paths
  if (cleanRef.startsWith('block/')) {
    return path.join(entitiesDir, 'block', `${cleanRef.replace('block/', '')}.png`);
  } else if (cleanRef.startsWith('entity/')) {
    return path.join(entitiesDir, 'texture', `${cleanRef.replace('entity/', '')}.png`);
  } else if (cleanRef.startsWith('item/')) {
    return path.join(entitiesDir, 'item', `${cleanRef.replace('item/', '')}.png`);
  } else {
    // Try block first, then texture
    const blockPath = path.join(entitiesDir, 'block', `${cleanRef}.png`);
    const texturePath = path.join(entitiesDir, 'texture', `${cleanRef}.png`);
    return blockPath; // Default to block path
  }
}

/**
 * Resolve texture key references in a model
 * @param {string} textureKey - Texture key (e.g., "#body")
 * @param {Object} textures - Texture mappings
 * @param {string} entitiesDir - Base entities directory
 * @returns {string} Resolved file path
 */
export function resolveTextureKey(textureKey, textures, entitiesDir) {
  if (!textureKey) return null;
  
  // Remove # prefix
  const key = textureKey.startsWith('#') ? textureKey.slice(1) : textureKey;
  
  // Look up in textures
  const textureRef = textures[key];
  if (!textureRef) {
    console.warn(`Texture key not found: ${textureKey}`);
    return null;
  }
  
  // If still a reference, resolve recursively (but limit depth)
  if (textureRef.startsWith('#')) {
    return resolveTextureKey(textureRef, textures, entitiesDir);
  }
  
  return textureRef;
}

/**
 * Get all unique texture paths used by a model
 * @param {Object} model - Parsed model
 * @returns {string[]} Array of unique texture paths
 */
export function getModelTextures(model) {
  const texturePaths = new Set();
  
  for (const element of model.elements) {
    if (!element.faces) continue;
    
    for (const [faceName, faceData] of Object.entries(element.faces)) {
      if (faceData.texture) {
        const key = faceData.texture.startsWith('#') 
          ? faceData.texture.slice(1) 
          : faceData.texture;
        const resolved = model.textures[key];
        if (resolved && !resolved.startsWith('#')) {
          texturePaths.add(resolved);
        }
      }
    }
  }
  
  return Array.from(texturePaths);
}

/**
 * Load all models from a directory
 * @param {string} modelsDir - Path to models directory
 * @param {string} entitiesDir - Base entities directory
 * @returns {Promise<Object[]>} Array of parsed models
 */
export async function loadAllModels(modelsDir, entitiesDir) {
  const models = [];
  const files = await fs.readdir(modelsDir);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    try {
      const modelPath = path.join(modelsDir, file);
      const model = await loadModel(modelPath, entitiesDir);
      models.push(model);
    } catch (err) {
      console.error(`Failed to load model ${file}: ${err.message}`);
    }
  }
  
  return models;
}
