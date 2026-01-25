# Texture Pack Converter

Convert Minecraft 16×16 item textures to 3D OBJ models with automated batch processing and pixel size calculation.

## Quick Start

```bash
npm install
npm run process:all
```

## Features

- **Pixel-based 3D models**: Converts textures to OBJ models using voxel extrusion
- **Batch processing**: Process entire folders automatically
- **Pixel size calculation**: Automatically calculates bounding boxes for proper scaling
- **Texture upscaling**: Generates 1024×1024 high-resolution textures
- **Folder-agnostic**: Works with any category folder structure

## Usage

### Standardized Workflow (Recommended)

1. **Organize your textures:**
   ```
   input/
   ├── foods/
   │   └── items/          # PNG texture files
   │       ├── apple.png
   │       └── bread.png
   └── weapons/
       └── items/
           └── sword.png
   ```

2. **Run processing:**
   ```bash
   npm run process:all
   ```

3. **Get organized output:**
   ```
   export/
   ├── foods/
   │   ├── models/         # OBJ, MTL, upscaled textures
   │   ├── textures/       # Upscaled 1024×1024 PNG files
   │   └── item_pixel_sizes.lua
   └── weapons/
       ├── models/
       ├── textures/
       └── item_pixel_sizes.lua
   ```

### NPM Scripts

```bash
# Process all categories in input/ (processes all textures found)
npm run process:all
```

### Manual Usage

```bash
# Process all categories
node scripts/processAll.js [inputDir] [outputDir] [scale] [coordinateSystem]

# Process single category (without item list)
node scripts/processItems.js <inputDir> <categoryName> [outputDir] [scale]

# Process single category (with item list for pixel sizes)
node scripts/processItems.js <inputDir> <categoryName> <itemListPath> [outputDir] [scale]

# Calculate pixel sizes only
node scripts/calculatePixelSizes.js <itemListPath> <texturepackPath> [outputPath] [categoryName]
```

### Original Texturepack Mode

For processing full texturepack structures:

```bash
node src/index.js -i ./texturepacks/my-texturepack -o ./export
```

## Item List Files (Optional)

Item lists are **optional**. The script will:
- ✅ Process all textures found in the `items/` folder
- ✅ Generate OBJ/MTL models and upscaled textures
- ✅ **Always calculate pixel sizes** for all textures found (even without item list)

**Without item list:** Automatically discovers all PNG files and calculates pixel sizes for them.

**With item list:** Only calculates pixel sizes for items in the list (useful for filtering):
```bash
node scripts/processItems.js ./input/foods foods /path/to/item_list.txt
```

**Format:** One item name per line (without `.png` extension), matching texture file names.

## Output

For each texture, generates:
- **`.obj`** - 3D model geometry
- **`.mtl`** - Material file
- **`*_1024.png`** - Upscaled 1024×1024 texture
- **`item_pixel_sizes.lua`** - Pixel dimensions table (if item list provided)

## Project Structure

```
texturepack-converter/
├── input/              # Place your texture folders here
├── export/             # Generated output
├── scripts/            # Processing scripts
│   ├── processAll.js
│   ├── processItems.js
│   └── calculatePixelSizes.js
├── src/                # Core converter
│   ├── index.js
│   ├── converter.js
│   ├── objGenerator.js
│   └── fileHandler.js
└── config/             # Configuration
```

## Requirements

- Node.js v16.0.0 or higher
- npm

## Configuration

Default settings in `config/default.json`:
```json
{
  "scale": 1.0,
  "recursive": true,
  "coordinateSystem": "z-up"
}
```

## How It Works

1. **Pixel Analysis**: Extracts pixel data with alpha channel
2. **Voxel Generation**: Creates 1-pixel cubes for opaque pixels
3. **UV Mapping**: Maps each voxel to correct texture coordinates
4. **3D Geometry**: Generates OBJ with vertices, UVs, normals, faces
5. **Upscaling**: Creates 1024×1024 texture versions
6. **Pixel Sizes**: Calculates bounding boxes for scaling

## License

MIT License
