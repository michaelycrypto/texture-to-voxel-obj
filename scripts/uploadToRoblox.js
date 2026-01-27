#!/usr/bin/env node

import { uploadTexturepack } from '../src/uploader.js';

// CLI
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node uploadToRoblox.js <texturepack-name>');
  console.log('Example: node uploadToRoblox.js Skyblox');
  process.exit(1);
}

uploadTexturepack(args[0]).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
