# Standardized Workflow

This document describes the standardized workflow for processing item textures and generating 3D models.

## Folder Structure

### Input Structure
Place your texture files in the following structure. **Any folder name works!**

```
input/
├── foods/              # Any category name
│   └── items/          # PNG texture files
│       ├── apple.png
│       ├── bread.png
│       └── ...
├── weapons/            # Another category
│   └── items/
│       ├── sword.png
│       └── ...
└── tools/              # Yet another category
    └── items/
        ├── pickaxe.png
        └── ...
```

The script automatically discovers and processes all folders in the input directory.

### Output Structure
The processing scripts automatically generate output matching your input folder structure:

```
export/
├── foods/              # Matches input folder name
│   ├── models/          # OBJ, MTL files and upscaled textures
│   │   ├── apple.obj
│   │   ├── apple.mtl
│   │   ├── apple_1024.png
│   │   └── ...
│   ├── textures/        # Upscaled texture files (1024x1024)
│   │   ├── apple_1024.png
│   │   └── ...
│   └── item_pixel_sizes.lua
├── weapons/            # Matches input folder name
│   ├── models/
│   ├── textures/
│   └── item_pixel_sizes.lua
└── tools/              # Matches input folder name
    ├── models/
    ├── textures/
    └── item_pixel_sizes.lua
```

## Usage

### Process All Categories

```bash
node scripts/processAll.js [inputDir] [outputDir] [scale] [coordinateSystem]
```

**Example:**
```bash
node scripts/processAll.js ./input ./export 1.0 z-up
```

### Process Single Category

```bash
node scripts/processItems.js <inputDir> <categoryName> <itemListPath> [outputDir] [scale]
```

**Examples:**
```bash
# Process any category (with item list)
node scripts/processItems.js ./input/foods foods ./food_names.txt ./export 1.0

# Process any category (without item list - skips pixel size calculation)
node scripts/processItems.js ./input/weapons weapons ./export 1.0
```

### Calculate Pixel Sizes Only

```bash
node scripts/calculatePixelSizes.js <itemListPath> <texturepackPath> [outputPath] [categoryName]
```

**Example:**
```bash
node scripts/calculatePixelSizes.js ./food_names.txt ./input/foods ./export/foods/item_pixel_sizes.lua "Food items"
```

## Workflow Steps

1. **Place textures in input folder**
   - Organize textures by category (foods, items, etc.)
   - Place PNG files in `{category}/items/` subfolder

2. **Run processing script**
   - Use `processAll.js` to process all categories
   - Or use `processItems.js` for a specific category

3. **Get organized output**
   - Models (OBJ/MTL) in `export/{category}/models/`
   - Textures (upscaled) in `export/{category}/textures/`
   - Pixel sizes in `export/{category}/item_pixel_sizes.lua`

## Item List Files (Optional)

Item list files are **optional** - they're only used for calculating pixel sizes. If not provided, the script will still generate models and textures, but skip pixel size calculation.

The script looks for item list files in these locations (in order):
1. `{categoryName}_names.txt` in project root (e.g., `foods_names.txt`)
2. `{categoryName}/{categoryName}_names.txt` (e.g., `foods/foods_names.txt`)
3. `{categoryName}/item_names.txt` (e.g., `foods/item_names.txt`)
4. `input/{categoryName}/item_names.txt`

These files should contain the base names of items (without `.png` extension), matching the texture file names, one per line.

**Note:** If no item list is found, the script will still work - it just won't generate `item_pixel_sizes.lua`.

## Notes

- Texture files should be 16x16 PNG images
- Models are generated with 1-pixel depth
- Textures are automatically upscaled to 1024x1024
- Pixel sizes are calculated from non-transparent pixel bounding boxes
