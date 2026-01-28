import Axios from 'axios';
import FormData from 'form-data';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { ProgressTracker, Spinner } from './progress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load environment variables from .env file
 */
async function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (await fs.pathExists(envPath)) {
    const envContent = await fs.readFile(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').trim();
          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key.trim()] = value;
        }
      }
    });
  }
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a progress bar string
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @param {number} width - Bar width in characters
 * @returns {string} Progress bar string
 */
function createProgressBar(current, total, width = 30) {
  const percent = total > 0 ? current / total : 0;
  const filled = Math.round(width * percent);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const percentStr = (percent * 100).toFixed(1).padStart(5);
  return `${bar} ${percentStr}% (${current}/${total})`;
}

/**
 * Handle rate limit response and return wait time in ms
 * @param {Object} error - Axios error object
 * @returns {number|null} Wait time in ms, or null if not a rate limit error
 */
function getRateLimitWaitTime(error) {
  if (error.response?.status === 429) {
    // Check for Retry-After header (in seconds)
    const retryAfter = error.response.headers['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter, 10) * 1000;
    }
    // Default to 60 seconds if no header
    return 60000;
  }
  return null;
}

/**
 * Get the correct content-type for a model file
 * @param {string} filePath - Path to the file
 * @returns {string} Content-type string
 */
function getModelContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.fbx': 'model/fbx',
    '.obj': 'model/obj',
    '.rbxm': 'model/x-rbxm'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Upload a model file to Roblox with retry logic for rate limits
 * @param {string} modelPath - Path to model file (FBX, GLTF, GLB, etc.)
 * @param {string} displayName - Display name for the asset
 * @param {string} apiKey - Roblox API key
 * @param {Object} creator - Creator object ({ groupId } or { userId })
 * @param {number} maxRetries - Maximum number of retries for rate limits
 * @returns {Promise<{operationPath: string}>}
 */
async function uploadAsset(modelPath, displayName, apiKey, creator, maxRetries = 5) {
  const contentType = getModelContentType(modelPath);
  const fileName = path.basename(modelPath);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const bodyFormData = new FormData();

      bodyFormData.append('request', JSON.stringify({
        assetType: 'Model',
        creationContext: {
          creator: creator
        },
        description: `3D model for ${displayName}`,
        displayName: displayName
      }));

      // Append file with correct content-type
      bodyFormData.append('fileContent', fs.createReadStream(modelPath), {
        filename: fileName,
        contentType: contentType
      });

      const response = await Axios.post('https://apis.roblox.com/assets/v1/assets', bodyFormData, {
        headers: {
          'x-api-key': apiKey,
          ...bodyFormData.getHeaders()
        }
      });

      return {
        operationPath: response.data.path
      };
    } catch (error) {
      const waitTime = getRateLimitWaitTime(error);

      if (waitTime && attempt < maxRetries) {
        console.log(`  ⏳ Rate limited. Waiting ${Math.ceil(waitTime / 1000)}s before retry (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(waitTime);
        continue;
      }

      throw error;
    }
  }
}

/**
 * Poll for operation completion and get asset ID
 * @param {string} operationPath - Operation path from upload response
 * @param {string} apiKey - Roblox API key
 * @param {number} maxAttempts - Maximum polling attempts
 * @param {number} delayMs - Delay between attempts
 * @returns {Promise<string>} Asset ID
 */
async function pollForCompletion(operationPath, apiKey, maxAttempts = 30, delayMs = 2000) {
  let rateLimitRetries = 0;
  const maxRateLimitRetries = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // The operationPath is "operations/xxx" but the full URL needs "/assets/v1/" prefix
      const fullUrl = operationPath.startsWith('operations/')
        ? `https://apis.roblox.com/assets/v1/${operationPath}`
        : `https://apis.roblox.com/${operationPath}`;

      const response = await Axios.get(fullUrl, {
        headers: {
          'x-api-key': apiKey
        }
      });

      if (response.data.done) {
        // Check for error in the response
        if (response.data.error) {
          throw new Error(JSON.stringify(response.data.error));
        }

        const assetId = response.data.response?.assetId;
        if (assetId) {
          return assetId;
        }

        // If no assetId but operation is done, something went wrong
        throw new Error(`Operation completed without asset ID: ${JSON.stringify(response.data)}`);
      }

      await sleep(delayMs);
    } catch (error) {
      const waitTime = getRateLimitWaitTime(error);

      if (waitTime && rateLimitRetries < maxRateLimitRetries) {
        console.log(`  ⏳ Rate limited during poll. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await sleep(waitTime);
        rateLimitRetries++;
        // Don't count this as a polling attempt
        attempt--;
        continue;
      }

      throw error;
    }
  }
  throw new Error('Polling timed out');
}

/**
 * Find all FBX files recursively (falls back to OBJ if no FBX found)
 * @param {string} dir - Directory to search
 * @param {string} extension - File extension to search for
 * @returns {Promise<string[]>} Array of file paths
 */
async function findModelFiles(dir, extension = '.fbx') {
  const files = [];
  if (!await fs.pathExists(dir)) return files;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findModelFiles(fullPath, extension));
    } else if (entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Upload all OBJs from a texturepack and save asset IDs to list files
 * @param {string} texturepackName - Name of the texturepack (e.g., 'Skyblox')
 * @param {string} exportBaseDir - Base export directory (default: './export')
 */
export async function uploadTexturepack(texturepackName, exportBaseDir = './export') {
  // Load environment variables
  await loadEnv();

  const API_KEY = process.env.ROBLOX_API_KEY;
  const GROUP_ID = process.env.ROBLOX_GROUP_ID;
  const USER_ID = process.env.ROBLOX_USER_ID;

  if (!API_KEY || API_KEY === 'your_api_key_here') {
    throw new Error('ROBLOX_API_KEY not configured in .env file');
  }

  const hasGroup = GROUP_ID && GROUP_ID !== 'your_group_id_here';
  const hasUser = USER_ID && USER_ID !== 'your_user_id_here';

  if (!hasGroup && !hasUser) {
    throw new Error('Neither ROBLOX_GROUP_ID nor ROBLOX_USER_ID configured in .env file');
  }

  const creator = hasGroup ? { groupId: GROUP_ID } : { userId: USER_ID };

  const exportDir = path.resolve(exportBaseDir, texturepackName);
  const modelsDir = path.join(exportDir, 'models', 'items');
  const listsDir = path.join(exportDir, 'lists');

  // Try GLB first, then FBX, then OBJ
  let modelFiles = await findModelFiles(modelsDir, '.glb');
  let fileType = 'GLB';

  if (modelFiles.length === 0) {
    modelFiles = await findModelFiles(modelsDir, '.fbx');
    fileType = 'FBX';
  }

  if (modelFiles.length === 0) {
    modelFiles = await findModelFiles(modelsDir, '.obj');
    fileType = 'OBJ';
  }

  if (modelFiles.length === 0) {
    console.log(`No GLB, FBX, or OBJ files found in ${modelsDir}`);
    return;
  }

  // Initialize progress tracker
  const progress = new ProgressTracker({
    phase: `Uploading ${fileType} Models`,
    total: modelFiles.length
  });

  // Track results by subfolder
  const results = {};
  const errors = [];
  // 1 second delay between uploads to avoid rate limits
  const delayBetweenUploads = 1000;
  const fileExtension = fileType === 'GLB' ? '.glb' : (fileType === 'FBX' ? '.fbx' : '.obj');

  progress.render();

  for (let i = 0; i < modelFiles.length; i++) {
    const modelPath = modelFiles[i];
    const itemName = path.basename(modelPath, fileExtension);
    const relativePath = path.relative(modelsDir, path.dirname(modelPath));
    const subfolder = relativePath || 'root';

    progress.update({ currentItem: `${itemName} (uploading...)` });

    try {
      const uploadResult = await uploadAsset(modelPath, itemName, API_KEY, creator);

      progress.update({ currentItem: `${itemName} (processing...)` });

      const assetId = await pollForCompletion(uploadResult.operationPath, API_KEY);

      if (!results[subfolder]) {
        results[subfolder] = {};
      }
      results[subfolder][itemName] = assetId;

      progress.incrementSuccess(itemName);

    } catch (err) {
      let errorMsg = err.message;
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMsg = err.response.data;
        } else if (err.response.data.message) {
          errorMsg = err.response.data.message;
        } else if (err.response.data.error) {
          errorMsg = err.response.data.error;
        } else {
          errorMsg = JSON.stringify(err.response.data);
        }
      }
      errors.push({ item: itemName, error: errorMsg });
      progress.incrementFailed(itemName);
    }

    if (i < modelFiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenUploads));
    }
  }

  progress.finish();

  // Save results to list files
  await fs.ensureDir(listsDir);

  console.log(chalk.bold('\nSaving asset lists...\n'));

  for (const [subfolder, items] of Object.entries(results)) {
    const listFileName = subfolder === 'root' ? 'items.txt' : `${subfolder}.txt`;
    const listPath = path.join(listsDir, listFileName);

    const content = Object.entries(items)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, assetId]) => `${name}=${assetId}`)
      .join('\n') + '\n';

    await fs.writeFile(listPath, content);
    console.log(`  ${chalk.green('✓')} ${listFileName} (${Object.keys(items).length} items)`);
  }

  if (errors.length > 0) {
    console.log(chalk.bold.red('\nFailed uploads:'));
    errors.slice(0, 10).forEach(({ item, error }) => {
      console.log(`  ${chalk.red('✗')} ${item}: ${error.substring(0, 60)}${error.length > 60 ? '...' : ''}`);
    });
    if (errors.length > 10) {
      console.log(chalk.gray(`  ... and ${errors.length - 10} more errors`));
    }
  }

  console.log('');
}
