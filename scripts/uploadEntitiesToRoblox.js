#!/usr/bin/env node

/**
 * Upload Entities to Roblox
 * Uploads generated entity GLB files to Roblox and records asset IDs
 */

import Axios from 'axios';
import FormData from 'form-data';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRateLimitWaitTime(error) {
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after'];
    return retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
  }
  return null;
}

/**
 * Upload a GLB file to Roblox
 */
async function uploadAsset(modelPath, displayName, apiKey, creator, maxRetries = 5) {
  const fileName = path.basename(modelPath);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const bodyFormData = new FormData();
      
      bodyFormData.append('request', JSON.stringify({
        assetType: 'Model',
        creationContext: { creator },
        description: `3D entity model for ${displayName}`,
        displayName: displayName
      }));

      bodyFormData.append('fileContent', fs.createReadStream(modelPath), {
        filename: fileName,
        contentType: 'model/gltf-binary'
      });

      const response = await Axios.post('https://apis.roblox.com/assets/v1/assets', bodyFormData, {
        headers: {
          'x-api-key': apiKey,
          ...bodyFormData.getHeaders()
        }
      });

      return { operationPath: response.data.path };
    } catch (error) {
      const waitTime = getRateLimitWaitTime(error);
      
      if (waitTime && attempt < maxRetries) {
        console.log(chalk.yellow(`  ⏳ Rate limited. Waiting ${Math.ceil(waitTime / 1000)}s...`));
        await sleep(waitTime);
        continue;
      }
      
      throw error;
    }
  }
}

/**
 * Poll for operation completion
 */
async function pollForCompletion(operationPath, apiKey, maxAttempts = 30, delayMs = 2000) {
  let rateLimitRetries = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const fullUrl = operationPath.startsWith('operations/')
        ? `https://apis.roblox.com/assets/v1/${operationPath}`
        : `https://apis.roblox.com/${operationPath}`;
      
      const response = await Axios.get(fullUrl, {
        headers: { 'x-api-key': apiKey }
      });

      if (response.data.done) {
        if (response.data.error) {
          throw new Error(JSON.stringify(response.data.error));
        }
        
        const assetId = response.data.response?.assetId;
        if (assetId) return assetId;
        
        throw new Error(`Operation completed without asset ID`);
      }

      await sleep(delayMs);
    } catch (error) {
      const waitTime = getRateLimitWaitTime(error);
      
      if (waitTime && rateLimitRetries < 5) {
        await sleep(waitTime);
        rateLimitRetries++;
        attempt--;
        continue;
      }
      
      throw error;
    }
  }
  throw new Error('Polling timed out');
}

/**
 * Find all GLB files recursively
 */
async function findGLBFiles(dir) {
  const files = [];
  if (!await fs.pathExists(dir)) return files;
  
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findGLBFiles(fullPath));
    } else if (entry.name.endsWith('.glb')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Upload a single entity
 */
async function uploadSingleEntity(entityName, packName, exportBaseDir = './export') {
  await loadEnv();

  const API_KEY = process.env.ROBLOX_API_KEY;
  const GROUP_ID = process.env.ROBLOX_GROUP_ID;
  const USER_ID = process.env.ROBLOX_USER_ID;

  if (!API_KEY || API_KEY === 'your_api_key_here') {
    throw new Error('ROBLOX_API_KEY not configured in .env file');
  }

  const creator = GROUP_ID && GROUP_ID !== 'your_group_id_here'
    ? { groupId: GROUP_ID }
    : { userId: USER_ID };

  const exportDir = path.resolve(exportBaseDir, packName);
  const entitiesDir = path.join(exportDir, 'models', 'entities');
  
  // Find the GLB file
  const glbFiles = await findGLBFiles(entitiesDir);
  const targetFile = glbFiles.find(f => path.basename(f, '.glb') === entityName);
  
  if (!targetFile) {
    throw new Error(`Entity GLB not found: ${entityName}`);
  }

  console.log(chalk.bold(`\nUploading entity: ${entityName}\n`));
  console.log(chalk.gray(`  File: ${targetFile}`));

  try {
    process.stdout.write(`  Uploading...`);
    const uploadResult = await uploadAsset(targetFile, entityName, API_KEY, creator);
    
    process.stdout.write(` Processing...`);
    const assetId = await pollForCompletion(uploadResult.operationPath, API_KEY);
    
    console.log(chalk.green(` Done!`));
    console.log('');
    console.log(chalk.bold(`  Asset ID: ${chalk.cyan(assetId)}`));
    console.log(chalk.bold(`  rbxassetid://${assetId}`));
    console.log('');

    // Update the list file
    await updateEntityList(exportDir, entityName, assetId);
    
    return assetId;
  } catch (error) {
    console.log(chalk.red(` Failed!`));
    throw error;
  }
}

/**
 * Upload all entities for a pack
 */
async function uploadAllEntities(packName, exportBaseDir = './export') {
  await loadEnv();

  const API_KEY = process.env.ROBLOX_API_KEY;
  const GROUP_ID = process.env.ROBLOX_GROUP_ID;
  const USER_ID = process.env.ROBLOX_USER_ID;

  if (!API_KEY || API_KEY === 'your_api_key_here') {
    throw new Error('ROBLOX_API_KEY not configured in .env file');
  }

  const creator = GROUP_ID && GROUP_ID !== 'your_group_id_here'
    ? { groupId: GROUP_ID }
    : { userId: USER_ID };

  const exportDir = path.resolve(exportBaseDir, packName);
  const entitiesDir = path.join(exportDir, 'models', 'entities');
  
  const glbFiles = await findGLBFiles(entitiesDir);
  
  if (glbFiles.length === 0) {
    console.log(chalk.yellow(`No entity GLB files found in ${entitiesDir}`));
    return;
  }

  console.log(chalk.bold(`\nUploading ${glbFiles.length} entities to Roblox...\n`));

  const results = {};
  const errors = [];
  const delayBetweenUploads = 2000;

  for (let i = 0; i < glbFiles.length; i++) {
    const glbPath = glbFiles[i];
    const entityName = path.basename(glbPath, '.glb');
    const category = path.basename(path.dirname(glbPath));

    process.stdout.write(`  ${chalk.cyan(entityName.padEnd(25))} `);

    try {
      const uploadResult = await uploadAsset(glbPath, entityName, API_KEY, creator);
      const assetId = await pollForCompletion(uploadResult.operationPath, API_KEY);
      
      results[entityName] = { assetId, category };
      console.log(chalk.green(`✓ ${assetId}`));
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      errors.push({ name: entityName, error: errorMsg });
      console.log(chalk.red(`✗ ${errorMsg.substring(0, 40)}`));
    }

    if (i < glbFiles.length - 1) {
      await sleep(delayBetweenUploads);
    }
  }

  // Update list files
  await updateAllEntityLists(exportDir, results);

  // Summary
  console.log(chalk.bold(`\n${'─'.repeat(50)}`));
  console.log(chalk.green(`  ✓ Uploaded: ${Object.keys(results).length} entities`));
  if (errors.length > 0) {
    console.log(chalk.red(`  ✗ Failed: ${errors.length} entities`));
  }
  console.log('');

  return results;
}

/**
 * Update entity list file with asset ID
 */
async function updateEntityList(exportDir, entityName, assetId) {
  const listPath = path.join(exportDir, 'lists', 'all_entities.txt');
  
  if (await fs.pathExists(listPath)) {
    let content = await fs.readFile(listPath, 'utf8');
    const lines = content.split('\n');
    const updatedLines = lines.map(line => {
      if (line.startsWith(`${entityName}=`)) {
        return `${entityName}=${assetId}`;
      }
      return line;
    });
    await fs.writeFile(listPath, updatedLines.join('\n'));
    console.log(chalk.gray(`  Updated: lists/all_entities.txt`));
  }
}

/**
 * Update all entity list files with asset IDs
 */
async function updateAllEntityLists(exportDir, results) {
  const listsDir = path.join(exportDir, 'lists');
  
  // Update all_entities.txt
  const allEntitiesPath = path.join(listsDir, 'all_entities.txt');
  if (await fs.pathExists(allEntitiesPath)) {
    let content = await fs.readFile(allEntitiesPath, 'utf8');
    const lines = content.split('\n');
    const updatedLines = lines.map(line => {
      const [name] = line.split('=');
      if (results[name]) {
        return `${name}=${results[name].assetId}`;
      }
      return line;
    });
    await fs.writeFile(allEntitiesPath, updatedLines.join('\n'));
  }

  // Update entity_metadata.lua
  const metadataPath = path.join(exportDir, 'entity_metadata.lua');
  if (await fs.pathExists(metadataPath)) {
    let content = await fs.readFile(metadataPath, 'utf8');
    for (const [name, data] of Object.entries(results)) {
      // Replace assetId = nil with actual ID
      const pattern = new RegExp(`(\\["${name}"\\][^}]*assetId = )nil`, 'g');
      content = content.replace(pattern, `$1"${data.assetId}"`);
    }
    await fs.writeFile(metadataPath, content);
  }

  console.log(chalk.gray(`\n  Updated list files with asset IDs`));
}

// CLI
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage:');
  console.log('  Upload single entity: node uploadEntitiesToRoblox.js <entity-name> <pack-name>');
  console.log('  Upload all entities:  node uploadEntitiesToRoblox.js --all <pack-name>');
  console.log('');
  console.log('Examples:');
  console.log('  node uploadEntitiesToRoblox.js anvil Skyblox');
  console.log('  node uploadEntitiesToRoblox.js --all Skyblox');
  process.exit(1);
}

if (args[0] === '--all') {
  const packName = args[1] || 'Skyblox';
  uploadAllEntities(packName).catch(err => {
    console.error(chalk.red(`\nFatal error: ${err.message}`));
    process.exit(1);
  });
} else {
  const entityName = args[0];
  const packName = args[1] || 'Skyblox';
  uploadSingleEntity(entityName, packName).catch(err => {
    console.error(chalk.red(`\nFatal error: ${err.message}`));
    process.exit(1);
  });
}
