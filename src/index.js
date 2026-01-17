#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { convertDirectory } from './converter.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load default config
const defaultConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/default.json'), 'utf8')
);

const program = new Command();

program
  .name('texturepack-converter')
  .description('Convert Minecraft 16x16 item textures to OBJ 3D models')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', 'Input folder path containing PNG textures')
  .option('-o, --output <path>', 'Output folder path (defaults to input folder)')
  .option('-r, --recursive', 'Process subdirectories recursively', defaultConfig.recursive)
  .option('--no-recursive', 'Disable recursive processing')
  .option('-s, --scale <number>', 'Scale factor for model size', parseFloat, defaultConfig.scale)
  .option('--coordinate-system <system>', 'Coordinate system (z-up or y-up)', defaultConfig.coordinateSystem)
  .action(async (options) => {
    const spinner = ora('Initializing converter...').start();

    try {
      // Validate input directory
      const inputDir = path.resolve(options.input);
      if (!(await fs.pathExists(inputDir))) {
        spinner.fail(chalk.red(`Input directory does not exist: ${inputDir}`));
        process.exit(1);
      }

      const stats = await fs.stat(inputDir);
      if (!stats.isDirectory()) {
        spinner.fail(chalk.red(`Input path is not a directory: ${inputDir}`));
        process.exit(1);
      }

      // Resolve output directory
      const outputDir = options.output ? path.resolve(options.output) : inputDir;

      spinner.succeed(chalk.green('Input directory validated'));

      // Start conversion
      spinner.start('Scanning for PNG files...');

      const results = await convertDirectory({
        inputDir,
        outputDir,
        recursive: options.recursive,
        scale: options.scale,
        coordinateSystem: options.coordinateSystem,
        onProgress: (progress) => {
          // Silent progress for batch processing
          // Could be enhanced with progress bar in future
        }
      });

      spinner.stop();

      // Display results
      console.log('\n' + chalk.bold('Conversion Summary:'));
      console.log(chalk.green(`✓ Successfully converted: ${results.success} files`));

      if (results.warnings > 0) {
        console.log(chalk.yellow(`⚠ Warnings: ${results.warnings} files`));
      }

      if (results.failed > 0) {
        console.log(chalk.red(`✗ Failed: ${results.failed} files`));
        console.log(chalk.red('\nErrors:'));
        results.errors.forEach((error, index) => {
          console.log(chalk.red(`  ${index + 1}. ${error}`));
        });
      }

      // Set exit code
      if (results.failed > 0 && results.success === 0) {
        process.exit(1); // Complete failure
      } else if (results.failed > 0) {
        process.exit(2); // Partial success
      } else {
        process.exit(0); // Complete success
      }
    } catch (error) {
      spinner.fail(chalk.red(`Fatal error: ${error.message}`));
      console.error(error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
