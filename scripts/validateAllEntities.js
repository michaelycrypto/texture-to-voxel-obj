#!/usr/bin/env node
/**
 * Batch Entity UV Validator
 * Validates all entity models in the entities/model folder
 * 
 * Usage:
 *   node scripts/validateAllEntities.js [pack-name]
 *   node scripts/validateAllEntities.js Skyblox
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import chalk from 'chalk';

const PACK_NAME = process.argv[2] || 'Skyblox';
const textureCache = new Map();

async function loadTexture(texturePath) {
  if (textureCache.has(texturePath)) return textureCache.get(texturePath);

  const searchPaths = [
    path.join('input', PACK_NAME, texturePath + '.png'),
    path.join('entities/texture', texturePath.replace('entity/', '') + '.png'),
    path.join('input', PACK_NAME, 'assets/minecraft/textures', texturePath + '.png'),
  ];

  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
      const result = { path: p, width: info.width, height: info.height, data, channels: info.channels };
      textureCache.set(texturePath, result);
      return result;
    }
  }
  return null;
}

function analyzeUVRegion(texture, u1, v1, u2, v2) {
  const scale = texture.width / 16;
  const px1 = Math.floor(Math.min(u1, u2) * scale);
  const py1 = Math.floor(Math.min(v1, v2) * scale);
  const px2 = Math.ceil(Math.max(u1, u2) * scale);
  const py2 = Math.ceil(Math.max(v1, v2) * scale);
  
  let transparent = 0, filled = 0;
  for (let y = py1; y < py2; y++) {
    for (let x = px1; x < px2; x++) {
      if (x < 0 || x >= texture.width || y < 0 || y >= texture.height) {
        transparent++;
        continue;
      }
      const idx = (y * texture.width + x) * texture.channels;
      const a = texture.channels > 3 ? texture.data[idx + 3] : 255;
      if (a < 50) transparent++;
      else filled++;
    }
  }
  
  const total = transparent + filled;
  return {
    fillPercent: total > 0 ? Math.round((filled / total) * 100) : 0,
    isValid: filled > total * 0.5
  };
}

async function validateModel(modelPath) {
  const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  const issues = [];
  
  for (let i = 0; i < model.elements.length; i++) {
    const element = model.elements[i];
    const comment = element.__comment || `Element ${i}`;
    
    if (!element.faces) continue;
    
    for (const [faceName, faceData] of Object.entries(element.faces)) {
      if (!faceData.uv) continue;
      
      const texKey = faceData.texture.replace('#', '');
      const texPath = model.textures[texKey];
      if (!texPath) continue;
      
      const texture = await loadTexture(texPath);
      if (!texture) {
        issues.push({ element: comment, face: faceName, issue: 'Texture not found: ' + texPath });
        continue;
      }
      
      const [u1, v1, u2, v2] = faceData.uv;
      const analysis = analyzeUVRegion(texture, u1, v1, u2, v2);
      
      if (!analysis.isValid) {
        issues.push({ 
          element: comment, 
          face: faceName, 
          issue: `Only ${analysis.fillPercent}% filled`,
          uv: faceData.uv
        });
      }
    }
  }
  
  return { name: model.name || path.basename(modelPath, '.json'), issues };
}

async function main() {
  console.log(chalk.cyan(`\n=== Validating All Entity Models (Pack: ${PACK_NAME}) ===\n`));
  
  const modelDir = 'entities/model';
  const files = fs.readdirSync(modelDir).filter(f => f.endsWith('.json'));
  
  let totalIssues = 0;
  const results = [];
  
  for (const file of files) {
    const modelPath = path.join(modelDir, file);
    const result = await validateModel(modelPath);
    results.push(result);
    
    if (result.issues.length === 0) {
      console.log(chalk.green(`✓ ${result.name}`));
    } else {
      console.log(chalk.red(`✗ ${result.name} (${result.issues.length} issues)`));
      for (const issue of result.issues) {
        console.log(chalk.gray(`    ${issue.element} → ${issue.face}: ${issue.issue}`));
        totalIssues++;
      }
    }
  }
  
  console.log(chalk.cyan(`\n=== Summary ===`));
  console.log(`Models validated: ${files.length}`);
  console.log(`Models with issues: ${results.filter(r => r.issues.length > 0).length}`);
  console.log(`Total issues: ${totalIssues}`);
  
  if (totalIssues === 0) {
    console.log(chalk.green('\nAll models passed validation!'));
  } else {
    console.log(chalk.yellow('\nRun: node scripts/validateEntityUV.js <model-name> ' + PACK_NAME));
    console.log('to see detailed suggestions for fixing issues.');
  }
}

main().catch(console.error);
