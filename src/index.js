#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { convertDirectory, convertTexturepacks, convertTexturepack, findItemsFolder, findBlocksFolder } from './converter.js';
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
  .description('Convert Minecraft texturepacks to OBJ 3D models')
  .version('1.0.0')
  .option('-i, --input <path>', 'Input folder path (texturepacks folder or specific texturepack)', './texturepacks')
  .option('-o, --output <path>', 'Output folder path', './export')
  .option('-r, --recursive', 'Process subdirectories recursively (for directory mode)', defaultConfig.recursive)
  .option('--no-recursive', 'Disable recursive processing')
  .option('-s, --scale <number>', 'Scale factor for model size (applied uniformly to texturepack)', parseFloat, defaultConfig.scale)
  .option('--coordinate-system <system>', 'Coordinate system (z-up or y-up)', defaultConfig.coordinateSystem)
  .option('--texturepack-mode', 'Process texturepacks (default: auto-detect)', false)
  .action(async (options) => {
    const spinner = ora('Initializing converter...').start();

    try {
      // Resolve paths
      const inputPath = path.resolve(options.input);
      const outputDir = path.resolve(options.output);

      // Validate input path
      if (!(await fs.pathExists(inputPath))) {
        spinner.fail(chalk.red(`Input path does not exist: ${inputPath}`));
        process.exit(1);
      }

      const inputStats = await fs.stat(inputPath);
      const isDirectory = inputStats.isDirectory();

      // Auto-detect texturepack mode: check if input is texturepacks folder or contains texturepack structure
      let useTexturepackMode = options.texturepackMode;
      if (!useTexturepackMode && isDirectory) {
        // First, check if the input path itself has an items or blocks folder (single texturepack)
        const itemsPath = await findItemsFolder(inputPath);
        const blocksPath = await findBlocksFolder(inputPath);

        if (itemsPath || blocksPath) {
          useTexturepackMode = true;
        } else {
          // If input path doesn't have items/blocks, check if it contains subdirectories with items/blocks (directory of texturepacks)
          const entries = await fs.readdir(inputPath, { withFileTypes: true });
          const hasSubdirs = entries.some(entry => entry.isDirectory());

          // Check if any subdirectory has an "items" or "blocks" folder (including nested paths)
          if (hasSubdirs) {
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const subdirPath = path.join(inputPath, entry.name);
                const subdirItemsPath = await findItemsFolder(subdirPath);
                const subdirBlocksPath = await findBlocksFolder(subdirPath);

                if (subdirItemsPath || subdirBlocksPath) {
                  useTexturepackMode = true;
                  break;
                }
              }
            }
          }
        }
      }

      // Ensure output directory exists
      await fs.ensureDir(outputDir);

      spinner.succeed(chalk.green('Input path validated'));

      let results;

      if (useTexturepackMode) {
        // Check if input path itself is a texturepack (has items or blocks folder, including nested)
        const itemsPath = await findItemsFolder(inputPath);
        const blocksPath = await findBlocksFolder(inputPath);

        if (itemsPath || blocksPath) {
          // Process as single texturepack
          spinner.start('Processing texturepack...');

          const packResults = await convertTexturepack({
            texturepackPath: inputPath,
            outputBaseDir: outputDir,
            scale: options.scale,
            coordinateSystem: options.coordinateSystem,
            onProgress: (progress) => {
              // Silent progress for batch processing
            }
          });

          results = {
            success: packResults.success,
            failed: packResults.failed,
            warnings: packResults.warnings,
            errors: packResults.errors,
            texturepacks: [{
              name: path.basename(inputPath),
              results: packResults
            }]
          };
        } else {
          // Process as directory of texturepacks
          spinner.start('Scanning for texturepacks...');

          results = await convertTexturepacks({
            texturepacksDir: inputPath,
            outputDir,
            scale: options.scale,
            coordinateSystem: options.coordinateSystem,
            onProgress: (progress) => {
              // Silent progress for batch processing
            }
          });
        }

        spinner.stop();

        // Display results
        console.log('\n' + chalk.bold('Texturepack Conversion Summary:'));
        console.log(chalk.cyan(`Processed ${results.texturepacks.length} texturepack(s)`));
        console.log(chalk.green(`✓ Successfully converted: ${results.success} files`));

        if (results.warnings > 0) {
          console.log(chalk.yellow(`⚠ Warnings: ${results.warnings} files`));
        }

        if (results.failed > 0) {
          console.log(chalk.red(`✗ Failed: ${results.failed} files`));
        }

        // Show per-texturepack breakdown
        if (results.texturepacks.length > 0) {
          console.log('\n' + chalk.bold('Per Texturepack:'));
          results.texturepacks.forEach(({ name, results: packResults }) => {
            console.log(`  ${chalk.cyan(name)}: ${chalk.green(packResults.success)} success, ${chalk.red(packResults.failed)} failed`);
          });
        }

        if (results.errors.length > 0) {
          console.log(chalk.red('\nErrors:'));
          results.errors.forEach((error, index) => {
            console.log(chalk.red(`  ${index + 1}. ${error}`));
          });
        }
      } else {
        // Directory mode: process single directory
        if (!isDirectory) {
          spinner.fail(chalk.red(`Input path is not a directory: ${inputPath}`));
          process.exit(1);
        }

        spinner.start('Scanning for PNG files...');

        results = await convertDirectory({
          inputDir: inputPath,
          outputDir,
          recursive: options.recursive,
          scale: options.scale,
          coordinateSystem: options.coordinateSystem,
          onProgress: (progress) => {
            // Silent progress for batch processing
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
