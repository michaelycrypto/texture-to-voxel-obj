#!/usr/bin/env node
/**
 * Entity UV Validator
 * Validates that all face UVs in an entity model point to valid (non-transparent) texture regions
 * 
 * Usage:
 *   node scripts/validateEntityUV.js <model-name> [pack-name]
 *   node scripts/validateEntityUV.js bed Skyblox
 *   node scripts/validateEntityUV.js --analyze-texture entity/bed/red   # Just analyze texture
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import chalk from 'chalk';

const PACK_NAME = process.argv[3] || 'Skyblox';
const MODEL_NAME = process.argv[2];

// Texture cache
const textureCache = new Map();

/**
 * Load and analyze a texture file
 */
async function analyzeTexture(texturePath) {
  if (textureCache.has(texturePath)) {
    return textureCache.get(texturePath);
  }

  // Find the texture file
  const searchPaths = [
    path.join('input', PACK_NAME, texturePath + '.png'),
    path.join('entities/texture', texturePath.replace('entity/', '') + '.png'),
    path.join('input', PACK_NAME, 'assets/minecraft/textures', texturePath + '.png'),
  ];

  let filePath = null;
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.error(chalk.red(`Texture not found: ${texturePath}`));
    console.error('  Searched:', searchPaths.join('\n            '));
    return null;
  }

  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  
  const result = {
    path: filePath,
    width: info.width,
    height: info.height,
    channels: info.channels,
    data,
    
    // Get pixel at x,y
    getPixel(x, y) {
      x = Math.floor(x);
      y = Math.floor(y);
      if (x < 0 || x >= info.width || y < 0 || y >= info.height) {
        return { r: 0, g: 0, b: 0, a: 0 };
      }
      const idx = (y * info.width + x) * info.channels;
      return {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: info.channels > 3 ? data[idx + 3] : 255
      };
    },
    
    // Analyze a UV region (UV coords in 0-16 scale)
    analyzeUVRegion(u1, v1, u2, v2) {
      // Convert UV (0-16) to pixels
      const scale = info.width / 16;
      const px1 = Math.floor(Math.min(u1, u2) * scale);
      const py1 = Math.floor(Math.min(v1, v2) * scale);
      const px2 = Math.ceil(Math.max(u1, u2) * scale);
      const py2 = Math.ceil(Math.max(v1, v2) * scale);
      
      let transparent = 0, filled = 0;
      let colors = { red: 0, wood: 0, tan: 0, dark: 0, other: 0 };
      
      for (let y = py1; y < py2; y++) {
        for (let x = px1; x < px2; x++) {
          const p = this.getPixel(x, y);
          if (p.a < 50) {
            transparent++;
          } else {
            filled++;
            if (p.r > 150 && p.g < 100 && p.b < 100) colors.red++;
            else if (p.r > 150 && p.g > 100 && p.b < 100) colors.tan++;
            else if (p.r > 80 && p.g > 50 && p.b < 80) colors.wood++;
            else if (p.r < 60 && p.g < 60 && p.b < 60) colors.dark++;
            else colors.other++;
          }
        }
      }
      
      const total = transparent + filled;
      const dominantColor = Object.entries(colors).sort((a, b) => b[1] - a[1])[0];
      
      return {
        pixels: { x1: px1, y1: py1, x2: px2, y2: py2 },
        uv: { u1, v1, u2, v2 },
        total,
        filled,
        transparent,
        fillPercent: Math.round((filled / total) * 100),
        dominantColor: dominantColor[0],
        dominantPercent: filled > 0 ? Math.round((dominantColor[1] / filled) * 100) : 0,
        colors,
        isValid: filled > total * 0.5 // At least 50% filled
      };
    },
    
    // Print texture map
    printMap() {
      console.log(chalk.cyan(`\nTexture: ${filePath} (${info.width}x${info.height})`));
      console.log('Legend: R=Red, W=Wood, T=Tan, D=Dark, O=Other, .=Transparent\n');
      
      const cellSize = info.width > 32 ? 2 : 1;
      
      // Header
      let header = '    ';
      for (let x = 0; x < 16; x++) header += x.toString().padStart(2);
      console.log(header + ' (UV)');
      
      for (let uy = 0; uy < 16; uy++) {
        let row = uy.toString().padStart(2) + ' |';
        for (let ux = 0; ux < 16; ux++) {
          const px = ux * (info.width / 16) + (info.width / 32);
          const py = uy * (info.height / 16) + (info.height / 32);
          const p = this.getPixel(px, py);
          
          if (p.a < 50) row += ' .';
          else if (p.r > 150 && p.g < 100) row += ' R';
          else if (p.r > 150 && p.g > 100) row += ' T';
          else if (p.r > 80 && p.g > 50) row += ' W';
          else if (p.r < 60) row += ' D';
          else row += ' O';
        }
        console.log(row + '|');
      }
    },

    // Find all filled rectangular regions
    findFilledRegions(minWidth = 1, minHeight = 1) {
      const regions = [];
      const scale = info.width / 16;
      
      // Scan for filled regions
      for (let uy = 0; uy < 16; uy += 0.5) {
        for (let ux = 0; ux < 16; ux += 0.5) {
          // Try different region sizes
          for (let h of [1.5, 3, 4]) {
            for (let w of [1.5, 3, 4]) {
              if (w < minWidth || h < minHeight) continue;
              const analysis = this.analyzeUVRegion(ux, uy, ux + w, uy + h);
              if (analysis.fillPercent >= 90) {
                regions.push({
                  uv: [ux, uy, ux + w, uy + h],
                  ...analysis
                });
              }
            }
          }
        }
      }
      
      return regions;
    }
  };
  
  textureCache.set(texturePath, result);
  return result;
}

/**
 * Load and validate a model
 */
async function validateModel(modelName) {
  const modelPath = path.join('entities/model', modelName + '.json');
  
  if (!fs.existsSync(modelPath)) {
    console.error(chalk.red(`Model not found: ${modelPath}`));
    return null;
  }
  
  const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  console.log(chalk.cyan(`\n=== Validating Model: ${modelName} ===`));
  console.log(`Elements: ${model.elements.length}`);
  console.log(`Textures: ${Object.keys(model.textures).join(', ')}`);
  
  // Load textures
  const textures = {};
  for (const [key, texPath] of Object.entries(model.textures)) {
    textures[key] = await analyzeTexture(texPath);
    if (textures[key]) {
      textures[key].printMap();
    }
  }
  
  // Validate each element's faces
  const issues = [];
  const faceResults = [];
  
  for (let i = 0; i < model.elements.length; i++) {
    const element = model.elements[i];
    const comment = element.__comment || `Element ${i}`;
    
    // Calculate face dimensions
    const size = {
      x: Math.abs(element.to[0] - element.from[0]),
      y: Math.abs(element.to[1] - element.from[1]),
      z: Math.abs(element.to[2] - element.from[2])
    };
    
    const faceDimensions = {
      north: { width: size.x, height: size.y },
      south: { width: size.x, height: size.y },
      east: { width: size.z, height: size.y },
      west: { width: size.z, height: size.y },
      up: { width: size.x, height: size.z },
      down: { width: size.x, height: size.z }
    };
    
    console.log(chalk.yellow(`\n[${comment}]`));
    console.log(`  Size: ${size.x}×${size.y}×${size.z} units`);
    
    if (!element.faces) continue;
    
    for (const [faceName, faceData] of Object.entries(element.faces)) {
      if (!faceData.uv) continue;
      
      const [u1, v1, u2, v2] = faceData.uv;
      const texKey = faceData.texture.replace('#', '');
      const texture = textures[texKey];
      
      if (!texture) {
        issues.push({ element: comment, face: faceName, issue: 'Texture not found' });
        continue;
      }
      
      const analysis = texture.analyzeUVRegion(u1, v1, u2, v2);
      const expectedDim = faceDimensions[faceName];
      const rotation = faceData.rotation || 0;
      
      // Check UV dimensions match face dimensions
      let uvWidth = Math.abs(u2 - u1);
      let uvHeight = Math.abs(v2 - v1);
      if (rotation === 90 || rotation === 270) {
        [uvWidth, uvHeight] = [uvHeight, uvWidth];
      }
      
      // For 64x64 texture with 16 UV scale: 1 UV unit = 4 pixels = 1 model unit at 1:1
      // But bed uses different ratio, so check if proportions match
      const expectedUVWidth = expectedDim.width / 4; // Assuming 64x64 texture
      const expectedUVHeight = expectedDim.height / 4;
      
      const dimMatch = Math.abs(uvWidth - expectedUVWidth) < 0.5 && Math.abs(uvHeight - expectedUVHeight) < 0.5;
      
      let status = '✓';
      let statusColor = chalk.green;
      
      if (analysis.fillPercent < 50) {
        status = '✗ TRANSPARENT';
        statusColor = chalk.red;
        issues.push({ element: comment, face: faceName, issue: `Only ${analysis.fillPercent}% filled`, uv: faceData.uv });
      } else if (!dimMatch) {
        status = '⚠ SIZE MISMATCH';
        statusColor = chalk.yellow;
        issues.push({ 
          element: comment, 
          face: faceName, 
          issue: `UV ${uvWidth.toFixed(1)}×${uvHeight.toFixed(1)} vs expected ${expectedUVWidth.toFixed(1)}×${expectedUVHeight.toFixed(1)}`,
          uv: faceData.uv 
        });
      }
      
      const uvStr = `[${u1},${v1},${u2},${v2}]`;
      const rotStr = rotation ? ` rot:${rotation}` : '';
      console.log(`  ${faceName.padEnd(6)} ${statusColor(status.padEnd(15))} UV${uvStr}${rotStr} → ${analysis.dominantColor}(${analysis.dominantPercent}%) fill:${analysis.fillPercent}%`);
      
      faceResults.push({
        element: comment,
        face: faceName,
        uv: faceData.uv,
        rotation,
        analysis,
        expectedDim,
        dimMatch
      });
    }
  }
  
  // Summary
  console.log(chalk.cyan('\n=== Summary ==='));
  if (issues.length === 0) {
    console.log(chalk.green('All faces validated successfully!'));
  } else {
    console.log(chalk.red(`Found ${issues.length} issues:\n`));
    for (const issue of issues) {
      console.log(chalk.red(`  • ${issue.element} → ${issue.face}: ${issue.issue}`));
      if (issue.uv) {
        console.log(chalk.gray(`    Current UV: [${issue.uv.join(', ')}]`));
      }
    }
  }
  
  return { model, textures, issues, faceResults };
}

/**
 * Suggest fixes for a model
 */
async function suggestFixes(modelName) {
  const result = await validateModel(modelName);
  if (!result || result.issues.length === 0) return;
  
  console.log(chalk.cyan('\n=== Suggested Fixes ===\n'));
  
  const texture = Object.values(result.textures)[0];
  if (!texture) return;
  
  for (const issue of result.issues) {
    if (issue.issue.includes('TRANSPARENT') || issue.issue.includes('filled')) {
      console.log(chalk.yellow(`${issue.element} → ${issue.face}:`));
      
      // Find alternative regions with same dimensions
      const faceResult = result.faceResults.find(f => f.element === issue.element && f.face === issue.face);
      if (faceResult) {
        const { expectedDim } = faceResult;
        const rotation = faceResult.rotation;
        
        let targetWidth = expectedDim.width / 4;
        let targetHeight = expectedDim.height / 4;
        if (rotation === 90 || rotation === 270) {
          [targetWidth, targetHeight] = [targetHeight, targetWidth];
        }
        
        console.log(`  Looking for ${targetWidth}×${targetHeight} UV region...`);
        
        // Scan for filled regions of this size
        for (let uy = 0; uy < 14; uy += 0.5) {
          for (let ux = 0; ux < 14; ux += 0.5) {
            const analysis = texture.analyzeUVRegion(ux, uy, ux + targetWidth, uy + targetHeight);
            if (analysis.fillPercent >= 80) {
              console.log(chalk.green(`  → Try UV [${ux}, ${uy}, ${ux + targetWidth}, ${uy + targetHeight}] (${analysis.dominantColor} ${analysis.fillPercent}%)`));
            }
          }
        }
      }
      console.log('');
    }
  }
}

// Main
async function main() {
  if (!MODEL_NAME) {
    console.log('Usage: node scripts/validateEntityUV.js <model-name> [pack-name]');
    console.log('       node scripts/validateEntityUV.js bed Skyblox');
    process.exit(1);
  }
  
  if (MODEL_NAME === '--analyze-texture') {
    const texPath = process.argv[3];
    const texture = await analyzeTexture(texPath);
    if (texture) {
      texture.printMap();
      console.log('\nFilled 4×1.5 regions (for 16×6 faces):');
      for (let y = 0; y < 12; y += 0.5) {
        for (let x = 0; x < 12; x += 0.5) {
          const a = texture.analyzeUVRegion(x, y, x + 4, y + 1.5);
          if (a.fillPercent >= 90) {
            console.log(`  [${x}, ${y}, ${x+4}, ${y+1.5}] → ${a.dominantColor} ${a.fillPercent}%`);
          }
        }
      }
    }
  } else {
    await suggestFixes(MODEL_NAME);
  }
}

main().catch(console.error);
