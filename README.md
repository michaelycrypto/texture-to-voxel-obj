# Texture-to-Voxel-OBJ

A Node.js tool that converts 16×16 pixel Minecraft item textures into 3D OBJ models using pixel-based voxel extrusion. Each opaque pixel becomes a 3D voxel, creating rigid 3D models that follow the shape of the texture.

## Features

- **Pixel-Based Extrusion**: Only opaque pixels (alpha ≥ 128) generate 3D geometry
- **1-Pixel Depth**: Each voxel has exactly 1 pixel depth for authentic Minecraft item proportions
- **Proper UV Mapping**: Each voxel uses the correct texture coordinates for its pixel region
- **Batch Processing**: Convert entire folders of textures at once
- **Recursive Support**: Process subdirectories automatically
- **Transparent Pixel Handling**: Transparent areas are excluded from the 3D model

## Requirements

- Node.js v16.0.0 or higher
- npm (comes with Node.js)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd texture-to-voxel-obj

# Install dependencies
npm install
```

## Usage

### Basic Usage

Convert all PNG textures in a folder:

```bash
node src/index.js --input ./items --output ./models
```

### Command Line Options

```
Options:
  -i, --input <path>            Input folder path containing PNG textures (required)
  -o, --output <path>           Output folder path (defaults to input folder)
  -r, --recursive               Process subdirectories recursively (default: true)
  --no-recursive                Disable recursive processing
  -s, --scale <number>          Scale factor for model size (default: 1.0)
  --coordinate-system <system>   Coordinate system: 'z-up' or 'y-up' (default: "z-up")
  -h, --help                    Display help
```

### Examples

```bash
# Convert items folder to models folder
node src/index.js -i ./items -o ./models

# Convert with custom scale (2x larger)
node src/index.js -i ./items -o ./models -s 2.0

# Convert single directory (non-recursive)
node src/index.js -i ./items -o ./models --no-recursive

# Use Y-up coordinate system
node src/index.js -i ./items -o ./models --coordinate-system y-up
```

## How It Works

1. **Pixel Analysis**: Reads PNG files and extracts pixel data with alpha channel
2. **Voxel Generation**: For each opaque pixel (alpha ≥ 128), creates a 1-pixel cube (voxel)
3. **UV Mapping**: Maps each voxel to the correct texture region (pixel coordinates → UV coordinates)
4. **3D Geometry**: Generates OBJ file with vertices, texture coordinates, normals, and faces
5. **Material File**: Creates corresponding MTL file referencing the original texture

### Technical Details

- **Voxel Size**: Each voxel is `scale/textureWidth` units in all dimensions
- **Depth**: Exactly 1 pixel deep (for 16×16 textures with scale=1.0: 0.0625 units)
- **Texture Mapping**: Each voxel's front and back faces use UV coordinates corresponding to its pixel position
- **Coordinate Systems**: Supports both Z-up (default) and Y-up coordinate systems

## Output

For each input PNG file, the tool generates:

- **`.obj` file**: 3D model geometry with proper UV mapping
- **`.mtl` file**: Material file referencing the original texture

The OBJ files are compatible with standard 3D software:
- Blender
- Maya
- 3ds Max
- Unity
- Unreal Engine
- And other OBJ-compatible software

## Project Structure

```
texture-to-voxel-obj/
├── src/
│   ├── index.js          # CLI entry point
│   ├── converter.js      # Core conversion logic
│   ├── fileHandler.js    # File I/O and pixel extraction
│   ├── objGenerator.js   # OBJ/MTL file generation
│   └── utils.js          # Utility functions
├── config/
│   └── default.json      # Default configuration
├── tests/                # Test directory
├── package.json
├── PRD.md               # Product Requirements Document
└── README.md
```

## Configuration

Default settings can be modified in `config/default.json`:

```json
{
  "scale": 1.0,
  "recursive": true,
  "coordinateSystem": "z-up"
}
```

## Development

```bash
# Run the converter
npm start

# Run tests (when implemented)
npm test
```

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Designed for Minecraft 16×16 item textures
- Inspired by BlockBench's texture import functionality
- Built with Node.js, Sharp, and Commander
