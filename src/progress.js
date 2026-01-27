/**
 * CLI Progress Display Module
 * Provides interactive progress visualization for the converter
 */

import chalk from 'chalk';

/**
 * Create a progress bar string
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @param {number} width - Bar width in characters
 * @returns {string} Progress bar string
 */
export function createProgressBar(current, total, width = 30) {
  const percent = total > 0 ? current / total : 0;
  const filled = Math.round(width * percent);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const percentStr = (percent * 100).toFixed(1).padStart(5);
  return `${bar} ${percentStr}%`;
}

/**
 * Format elapsed time
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string
 */
export function formatTime(ms) {
  if (!ms || ms < 0) return '--';
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Progress tracker class for CLI visualization
 */
export class ProgressTracker {
  constructor(options = {}) {
    this.phase = options.phase || 'Processing';
    this.total = options.total || 0;
    this.current = 0;
    this.success = 0;
    this.failed = 0;
    this.warnings = 0;
    this.currentItem = '';
    this.startTime = Date.now();
    this.lastRender = 0;
    this.renderInterval = options.renderInterval || 100; // ms between renders
    this.isInteractive = process.stdout.isTTY !== false;
    this.lastLines = 0;
  }

  /**
   * Clear previous output lines
   */
  clearLines(count) {
    if (this.isInteractive && count > 0) {
      process.stdout.write(`\x1b[${count}A\x1b[0J`);
    }
  }

  /**
   * Update progress
   */
  update(options = {}) {
    if (options.current !== undefined) this.current = options.current;
    if (options.success !== undefined) this.success = options.success;
    if (options.failed !== undefined) this.failed = options.failed;
    if (options.warnings !== undefined) this.warnings = options.warnings;
    if (options.currentItem !== undefined) this.currentItem = options.currentItem;
    if (options.phase !== undefined) this.phase = options.phase;
    if (options.total !== undefined) this.total = options.total;

    const now = Date.now();
    if (now - this.lastRender >= this.renderInterval) {
      this.render();
      this.lastRender = now;
    }
  }

  /**
   * Increment success count
   */
  incrementSuccess(itemName) {
    this.current++;
    this.success++;
    this.currentItem = itemName;
    this.render();
  }

  /**
   * Increment failed count
   */
  incrementFailed(itemName) {
    this.current++;
    this.failed++;
    this.currentItem = itemName;
    this.render();
  }

  /**
   * Increment warning count
   */
  incrementWarning() {
    this.warnings++;
  }

  /**
   * Render the progress display
   */
  render() {
    const elapsed = Date.now() - this.startTime;
    const itemsPerSec = this.current > 0 ? (this.current / elapsed * 1000).toFixed(1) : '0.0';
    const etaMs = this.current > 0 ? (this.total - this.current) * (elapsed / this.current) : 0;
    const eta = this.current > 0 && this.current < this.total ? formatTime(etaMs) : '--';

    const progressBar = createProgressBar(this.current, this.total, 25);
    const truncatedItem = this.currentItem.length > 30 
      ? this.currentItem.substring(0, 27) + '...' 
      : this.currentItem.padEnd(30);

    const countStr = `${this.current}/${this.total}`;
    const speedStr = `${itemsPerSec}/s`;
    
    // Build status line without colors first to calculate padding
    const statusContent = `  ✓ ${String(this.success).padStart(4)}   ✗ ${String(this.failed).padStart(4)}   ⚠ ${String(this.warnings).padStart(4)}    Speed: ${speedStr.padStart(7)}   ETA: ${eta.padStart(6)}  `;

    const lines = [
      '',
      chalk.cyan('╔════════════════════════════════════════════════════════════╗'),
      chalk.cyan('║') + chalk.bold.white(` ${this.phase}`.padEnd(60)) + chalk.cyan('║'),
      chalk.cyan('╠════════════════════════════════════════════════════════════╣'),
      chalk.cyan('║') + `  ${progressBar}  ${countStr.padStart(12)}`.padEnd(60) + chalk.cyan('║'),
      chalk.cyan('║') + `  Current: ${truncatedItem}`.padEnd(60) + chalk.cyan('║'),
      chalk.cyan('║') + `  ${chalk.green('✓')}${String(this.success).padStart(5)}   ${chalk.red('✗')}${String(this.failed).padStart(5)}   ${chalk.yellow('⚠')}${String(this.warnings).padStart(5)}    Speed:${speedStr.padStart(8)}   ETA:${eta.padStart(7)}  ` + chalk.cyan('║'),
      chalk.cyan('╚════════════════════════════════════════════════════════════╝'),
      ''
    ];

    if (this.isInteractive) {
      this.clearLines(this.lastLines);
    }

    console.log(lines.join('\n'));
    this.lastLines = lines.length;
  }

  /**
   * Finish and show final summary
   */
  finish() {
    const elapsed = Date.now() - this.startTime;
    
    console.log('');
    console.log(chalk.bold('═'.repeat(56)));
    console.log(chalk.bold.white(`  ${this.phase} Complete!`));
    console.log(chalk.bold('═'.repeat(56)));
    console.log(`  ${chalk.green('✓ Successful:')} ${this.success}`);
    console.log(`  ${chalk.red('✗ Failed:')}     ${this.failed}`);
    console.log(`  ${chalk.yellow('⚠ Warnings:')}   ${this.warnings}`);
    console.log(`  ${chalk.blue('⏱ Time:')}       ${formatTime(elapsed)}`);
    console.log(chalk.bold('═'.repeat(56)));
    console.log('');
  }
}

/**
 * Simple spinner for waiting states
 */
export class Spinner {
  constructor(text = 'Processing...') {
    this.text = text;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.frameIndex = 0;
    this.interval = null;
    this.isInteractive = process.stdout.isTTY !== false;
  }

  start() {
    if (!this.isInteractive) {
      console.log(this.text);
      return;
    }
    
    this.interval = setInterval(() => {
      process.stdout.write(`\r${chalk.cyan(this.frames[this.frameIndex])} ${this.text}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
  }

  updateText(text) {
    this.text = text;
  }

  stop(finalText = null) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.isInteractive) {
      process.stdout.write('\r\x1b[K');
    }
    if (finalText) {
      console.log(finalText);
    }
  }

  succeed(text) {
    this.stop(`${chalk.green('✓')} ${text}`);
  }

  fail(text) {
    this.stop(`${chalk.red('✗')} ${text}`);
  }
}
