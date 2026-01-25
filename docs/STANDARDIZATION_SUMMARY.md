# Standardization Summary

## What Was Done

### 1. Created Standardized Folder Structure

**Input Structure:**
```
input/
├── foods/
│   └── items/          # Place food texture PNG files here
└── items/
    └── items/          # Place non-food texture PNG files here
```

**Output Structure (Auto-generated):**
```
export/
├── foods/
│   ├── models/         # OBJ, MTL files and upscaled textures
│   ├── textures/      # Upscaled 1024x1024 PNG files
│   └── item_pixel_sizes.lua
└── items/
    ├── models/         # OBJ, MTL files and upscaled textures
    ├── textures/       # Upscaled 1024x1024 PNG files
    └── item_pixel_sizes.lua
```

### 2. Created Processing Scripts

#### `scripts/processAll.js`
- Main orchestration script
- Processes all categories (foods, items) automatically
- Standardized workflow: `input/` → `export/`

#### `scripts/processItems.js`
- Processes a single category
- Handles texture conversion, model generation, and pixel size calculation
- Creates organized output structure

#### `scripts/calculatePixelSizes.js`
- Generic pixel size calculator (works with any item list)
- Calculates bounding box of non-transparent pixels
- Generates Lua table with pixel dimensions

### 3. Updated Existing Files

- **`items/non_food_items.txt`**: Created filtered list of 227 non-food items
- **`package.json`**: Added convenient npm scripts for processing

## How to Use

### Quick Start

1. **Place textures in input folder:**
   ```bash
   # Copy your food textures
   cp /path/to/food/textures/*.png input/foods/items/

   # Copy your non-food textures
   cp /path/to/item/textures/*.png input/items/items/
   ```

2. **Run the processing script:**
   ```bash
   npm run process:all
   # OR
   node scripts/processAll.js
   ```

3. **Get organized output in `export/` folder**

### NPM Scripts

```bash
# Process all categories
npm run process:all

# Process only foods
npm run process:foods

# Process only non-food items
npm run process:items

# Calculate pixel sizes only (foods)
npm run pixels:foods

# Calculate pixel sizes only (items)
npm run pixels:items
```

### Manual Usage

```bash
# Process all
node scripts/processAll.js [inputDir] [outputDir] [scale] [coordinateSystem]

# Process single category
node scripts/processItems.js <inputDir> <categoryName> <itemListPath> [outputDir] [scale]

# Calculate pixel sizes
node scripts/calculatePixelSizes.js <itemListPath> <texturepackPath> [outputPath] [categoryName]
```

## Benefits

1. **Standardized Structure**: Consistent folder organization for all item categories
2. **Automated Workflow**: One command processes everything
3. **Organized Output**: Models, textures, and pixel sizes in separate folders
4. **Reusable**: Works with any item category (not just foods)
5. **Maintainable**: Clear separation of concerns, easy to extend

## File Locations

- **Input folder**: `./input/` (user-created, contains textures)
- **Output folder**: `./export/` (auto-generated, contains models/textures/pixel sizes)
- **Item lists**:
  - `./food_names.txt` (food items)
  - `./items/non_food_items.txt` (non-food items)
- **Scripts**: `./scripts/` (processing scripts)

## Next Steps

1. Place your texture files in the `input/` folder structure
2. Run `npm run process:all` to generate everything
3. Use the organized output in `export/` for your Roblox project
