#!/usr/bin/env node

/**
 * Generate Hardcoded Entity Models
 * 
 * This script generates JSON model files for Minecraft entities that don't have
 * standard JSON model definitions (they're hardcoded in Java).
 * 
 * Usage:
 *   node scripts/generateHardcodedEntity.js --type chest --texture entity/chest/ender --name ender_chest
 *   node scripts/generateHardcodedEntity.js --type shulker --color red
 *   node scripts/generateHardcodedEntity.js --type bed --color blue
 *   node scripts/generateHardcodedEntity.js --list
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template definitions for hardcoded entities
const TEMPLATES = {
  chest: {
    credit: "Community Recreation - Based on Minecraft Default",
    elements: [
      {
        "__comment": "Base",
        "from": [1.0, 0.0, 1.0],
        "to": [15.0, 10.0, 15.0],
        "faces": {
          "north": { "texture": "#0", "uv": [3.5, 8.25, 7.0, 10.75] },
          "east": { "texture": "#0", "uv": [0.0, 8.25, 3.5, 10.75] },
          "south": { "texture": "#0", "uv": [10.5, 8.25, 14.0, 10.75] },
          "west": { "texture": "#0", "uv": [7.0, 8.25, 10.5, 10.75] },
          "up": { "texture": "#0", "uv": [3.5, 4.75, 7.0, 8.25], "rotation": 180 },
          "down": { "texture": "#0", "uv": [10.5, 4.75, 7.0, 8.25] }
        }
      },
      {
        "__comment": "Knob",
        "from": [7.0, 8.0, 0.0],
        "to": [9.0, 12.0, 1.0],
        "faces": {
          "north": { "texture": "#0", "uv": [0.25, 0.25, 0.75, 1.25] },
          "east": { "texture": "#0", "uv": [0.0, 0.25, 0.25, 1.25] },
          "south": { "texture": "#0", "uv": [1.0, 0.25, 1.5, 1.25] },
          "west": { "texture": "#0", "uv": [0.75, 0.25, 1.0, 1.25] },
          "up": { "texture": "#0", "uv": [0.75, 0.0, 0.25, 0.25] },
          "down": { "texture": "#0", "uv": [1.25, 0.0, 0.75, 0.25] }
        }
      },
      {
        "__comment": "Lid",
        "from": [1.0, 9.0, 1.0],
        "to": [15.0, 14.0, 15.0],
        "faces": {
          "north": { "texture": "#0", "uv": [3.5, 3.5, 7.0, 4.75] },
          "east": { "texture": "#0", "uv": [0.0, 3.5, 3.5, 4.75] },
          "south": { "texture": "#0", "uv": [10.5, 3.5, 14.0, 4.75] },
          "west": { "texture": "#0", "uv": [7.0, 3.5, 10.5, 4.75] },
          "up": { "texture": "#0", "uv": [3.5, 0.0, 7.0, 3.5], "rotation": 180 },
          "down": { "texture": "#0", "uv": [10.5, 0.0, 7.0, 3.5] }
        }
      }
    ]
  },
  
  bed: {
    credit: "Community Recreation - Based on Minecraft Default",
    "__comment": "Full 2-block bed model with head (pillow) and foot sections. Texture is 64x64.",
    "__texture_info": "64x64 texture. UVs in 0-16 scale where 16=64px, so 1 unit = 4px",
    elements: [
      {
        "__comment": "Head section (block with pillow) - back part of bed",
        "from": [0, 3, 16],
        "to": [16, 9, 32],
        "faces": {
          "up": { "texture": "#0", "uv": [1.5, 1.5, 5.5, 5.5] },
          "down": { "texture": "#0", "uv": [5.5, 1.5, 9.5, 5.5] },
          "north": { "texture": "#0", "uv": [1.5, 5.5, 5.5, 7] },
          "south": { "texture": "#0", "uv": [5.5, 5.5, 9.5, 7] },
          "west": { "texture": "#0", "uv": [0, 5.5, 1.5, 7] },
          "east": { "texture": "#0", "uv": [5.5, 5.5, 7, 7] }
        }
      },
      {
        "__comment": "Foot section - front part of bed",
        "from": [0, 3, 0],
        "to": [16, 9, 16],
        "faces": {
          "up": { "texture": "#0", "uv": [1.5, 7, 5.5, 11] },
          "down": { "texture": "#0", "uv": [5.5, 7, 9.5, 11] },
          "north": { "texture": "#0", "uv": [5.5, 11, 9.5, 12.5] },
          "south": { "texture": "#0", "uv": [1.5, 11, 5.5, 12.5] },
          "west": { "texture": "#0", "uv": [0, 7, 1.5, 11] },
          "east": { "texture": "#0", "uv": [5.5, 7, 7, 11] }
        }
      },
      {
        "__comment": "Head leg 1 (back-left)",
        "from": [0, 0, 29],
        "to": [3, 3, 32],
        "faces": {
          "down": { "texture": "#0", "uv": [12.75, 1.25, 13.5, 2], "cullface": "down" },
          "north": { "texture": "#0", "uv": [12.75, 2, 13.5, 2.75] },
          "south": { "texture": "#0", "uv": [13.5, 2, 14.25, 2.75] },
          "west": { "texture": "#0", "uv": [12, 2, 12.75, 2.75] },
          "east": { "texture": "#0", "uv": [14.25, 2, 15, 2.75] }
        }
      },
      {
        "__comment": "Head leg 2 (back-right)",
        "from": [13, 0, 29],
        "to": [16, 3, 32],
        "faces": {
          "down": { "texture": "#0", "uv": [13.25, 1.25, 14, 2], "cullface": "down" },
          "north": { "texture": "#0", "uv": [13.25, 2, 14, 2.75] },
          "south": { "texture": "#0", "uv": [14, 2, 14.75, 2.75] },
          "west": { "texture": "#0", "uv": [12.5, 2, 13.25, 2.75] },
          "east": { "texture": "#0", "uv": [14.75, 2, 15.5, 2.75] }
        }
      },
      {
        "__comment": "Foot leg 1 (front-left)",
        "from": [0, 0, 0],
        "to": [3, 3, 3],
        "faces": {
          "down": { "texture": "#0", "uv": [12.75, 4.25, 13.5, 5], "cullface": "down" },
          "north": { "texture": "#0", "uv": [13.5, 5, 14.25, 5.75] },
          "south": { "texture": "#0", "uv": [12.75, 5, 13.5, 5.75] },
          "west": { "texture": "#0", "uv": [12, 5, 12.75, 5.75] },
          "east": { "texture": "#0", "uv": [14.25, 5, 15, 5.75] }
        }
      },
      {
        "__comment": "Foot leg 2 (front-right)",
        "from": [13, 0, 0],
        "to": [16, 3, 3],
        "faces": {
          "down": { "texture": "#0", "uv": [13.25, 4.25, 14, 5], "cullface": "down" },
          "north": { "texture": "#0", "uv": [14, 5, 14.75, 5.75] },
          "south": { "texture": "#0", "uv": [13.25, 5, 14, 5.75] },
          "west": { "texture": "#0", "uv": [12.5, 5, 13.25, 5.75] },
          "east": { "texture": "#0", "uv": [14.75, 5, 15.5, 5.75] }
        }
      }
    ]
  },
  
  shulker: {
    credit: "Community Recreation - Based on Minecraft Default",
    "__comment": "Shulker box in closed state. Texture is 64x64.",
    "__texture_info": "64x64 texture. For 16-unit UV system: 16 units = 64px, so 1 unit = 4px",
    elements: [
      {
        "__comment": "Bottom shell (base) - 16x16x8 box",
        "from": [0, 0, 0],
        "to": [16, 8, 16],
        "faces": {
          "down": { "texture": "#0", "uv": [4, 12, 8, 16], "cullface": "down" },
          "up": { "texture": "#0", "uv": [4, 8, 8, 12] },
          "north": { "texture": "#0", "uv": [0, 14, 4, 16] },
          "south": { "texture": "#0", "uv": [8, 14, 12, 16] },
          "west": { "texture": "#0", "uv": [4, 14, 8, 16] },
          "east": { "texture": "#0", "uv": [12, 14, 16, 16] }
        }
      },
      {
        "__comment": "Top shell (lid) - 16x16x12 box, overlaps with base for closed appearance",
        "from": [0, 4, 0],
        "to": [16, 16, 16],
        "faces": {
          "up": { "texture": "#0", "uv": [4, 0, 8, 4], "cullface": "up" },
          "north": { "texture": "#0", "uv": [0, 4, 4, 7] },
          "south": { "texture": "#0", "uv": [8, 4, 12, 7] },
          "west": { "texture": "#0", "uv": [4, 4, 8, 7] },
          "east": { "texture": "#0", "uv": [12, 4, 16, 7] }
        }
      }
    ]
  },
  
  sign: {
    credit: "Community Recreation - Based on Minecraft Default",
    "__comment": "Standing sign with post. Texture is 64x32 (non-square). UVs scaled for 16-unit system.",
    "__texture_info": "64x32 texture. For 16-unit UV system: U spans 0-16 (64px), V spans 0-8 (32px)",
    elements: [
      {
        "__comment": "Sign board - 16 wide, 8 tall, 2 thick",
        "from": [0, 7, 7],
        "to": [16, 15, 9],
        "faces": {
          "north": { "texture": "#0", "uv": [0.5, 1, 6.5, 4] },
          "south": { "texture": "#0", "uv": [7, 1, 13, 4] },
          "west": { "texture": "#0", "uv": [6.5, 1, 7, 4] },
          "east": { "texture": "#0", "uv": [0, 1, 0.5, 4] },
          "up": { "texture": "#0", "uv": [0.5, 0, 6.5, 1] },
          "down": { "texture": "#0", "uv": [6.5, 0, 12.5, 1] }
        }
      },
      {
        "__comment": "Post - 2x2 pixels wide, 14 pixels tall",
        "from": [7, 0, 7],
        "to": [9, 7, 9],
        "faces": {
          "north": { "texture": "#0", "uv": [0.5, 4, 1, 7.5] },
          "south": { "texture": "#0", "uv": [1, 4, 1.5, 7.5] },
          "west": { "texture": "#0", "uv": [0, 4, 0.5, 7.5] },
          "east": { "texture": "#0", "uv": [1.5, 4, 2, 7.5] },
          "down": { "texture": "#0", "uv": [1, 7.5, 1.5, 8], "cullface": "down" }
        }
      }
    ]
  }
};

// Color definitions
const COLORS = [
  'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime',
  'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue',
  'brown', 'green', 'red', 'black'
];

function generateEntity(type, options = {}) {
  const template = TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown entity type: ${type}. Available: ${Object.keys(TEMPLATES).join(', ')}`);
  }
  
  const { name, texture, color } = options;
  
  let entityName = name;
  let texturePath = texture;
  
  // Handle color variants
  if (color) {
    switch (type) {
      case 'bed':
        entityName = entityName || `${color}_bed`;
        texturePath = texturePath || `entity/bed/${color}`;
        break;
      case 'shulker':
        entityName = entityName || `${color}_shulker_box`;
        texturePath = texturePath || `entity/shulker/shulker_${color}`;
        break;
      default:
        throw new Error(`Color variants not supported for type: ${type}`);
    }
  }
  
  if (!entityName || !texturePath) {
    throw new Error('Missing required --name and --texture options');
  }
  
  const model = {
    name: entityName,
    credit: template.credit,
    textures: { "0": texturePath },
    elements: template.elements
  };
  
  if (template.__comment) {
    model.__comment = template.__comment;
  }
  
  return model;
}

function generateAllColorVariants(type) {
  const models = [];
  for (const color of COLORS) {
    try {
      const model = generateEntity(type, { color });
      models.push(model);
    } catch (e) {
      // Skip unsupported
    }
  }
  return models;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--list')) {
    console.log('\nAvailable entity templates:');
    console.log('─'.repeat(40));
    for (const [type, template] of Object.entries(TEMPLATES)) {
      console.log(`  ${type.padEnd(12)} - ${template.credit}`);
    }
    console.log('\nAvailable colors for bed/shulker:');
    console.log(`  ${COLORS.join(', ')}`);
    console.log('\nExamples:');
    console.log('  node scripts/generateHardcodedEntity.js --type chest --texture entity/chest/ender --name ender_chest');
    console.log('  node scripts/generateHardcodedEntity.js --type shulker --color red');
    console.log('  node scripts/generateHardcodedEntity.js --type bed --all-colors');
    console.log('');
    return;
  }
  
  // Parse arguments
  const typeIdx = args.indexOf('--type');
  const textureIdx = args.indexOf('--texture');
  const nameIdx = args.indexOf('--name');
  const colorIdx = args.indexOf('--color');
  const allColors = args.includes('--all-colors');
  const outputDir = path.join(__dirname, '..', 'entities', 'model');
  
  if (typeIdx === -1) {
    console.error('Error: --type is required');
    console.log('Run with --list to see available types');
    process.exit(1);
  }
  
  const type = args[typeIdx + 1];
  
  if (allColors) {
    const models = generateAllColorVariants(type);
    console.log(`\nGenerating ${models.length} ${type} color variants...`);
    
    for (const model of models) {
      const filePath = path.join(outputDir, `${model.name}.json`);
      await fs.writeJson(filePath, model, { spaces: 2 });
      console.log(`  ✓ ${model.name}.json`);
    }
    console.log(`\nDone! Generated ${models.length} models.\n`);
    return;
  }
  
  const options = {
    texture: textureIdx !== -1 ? args[textureIdx + 1] : undefined,
    name: nameIdx !== -1 ? args[nameIdx + 1] : undefined,
    color: colorIdx !== -1 ? args[colorIdx + 1] : undefined
  };
  
  try {
    const model = generateEntity(type, options);
    const filePath = path.join(outputDir, `${model.name}.json`);
    await fs.writeJson(filePath, model, { spaces: 2 });
    console.log(`\n✓ Generated: ${filePath}\n`);
  } catch (e) {
    console.error(`\nError: ${e.message}\n`);
    process.exit(1);
  }
}

main().catch(console.error);
