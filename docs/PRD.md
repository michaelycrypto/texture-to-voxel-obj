# Product Requirements Document: BlockBench Texture-to-OBJ Batch Converter

## 1. User Story & Use Case

**As a** Minecraft modder or resource pack creator
**I want to** automatically convert a folder of 16x16 Minecraft item textures to 3D OBJ models
**So that** I can batch process item textures without manually importing each texture in BlockBench

**Primary Use Case:**
- User has a folder containing 16x16 pixel Minecraft item texture files (PNG format)
- User wants corresponding OBJ files generated for each item texture
- Process should replicate BlockBench's "import from texture" behavior automatically
- Output OBJ files can be used for 3D item models in Minecraft or other applications
- User has a texturepack structure with an "items" folder and wants to process all textures in that folder
- User wants to apply a uniform scale factor to the entire texture pack (all models scaled consistently)

**Secondary Use Cases:**
- Converting Minecraft resource pack item textures to 3D models
- Batch processing custom item textures for mods
- Automating repetitive texture-to-model workflows for Minecraft assets
- Processing texturepack structures with nested folder organization
- Scaling entire texture packs uniformly for consistent model sizes

---

## 2. Functional Requirements

### 2.1 Input Handling
- **FR-1.1**: Accept a folder path as input (via CLI argument or config)
- **FR-1.2**: Recursively scan folder for PNG texture files (`.png`)
- **FR-1.3**: Validate texture files:
  - Are readable and contain valid image data
  - Are 16x16 pixels (warn but allow non-16x16 files)
  - Have valid PNG format
- **FR-1.4**: Support single file input mode (process one texture file)
- **FR-1.5**: Generate output filenames based on input texture names (e.g., `diamond_sword.png` → `diamond_sword.obj`)
- **FR-1.6**: Support texturepack structure detection:
  - Automatically detect and process files in "items" and "blocks" folders within the texturepack structure
  - If input path contains an "items" folder, process all PNG files within that folder (generate OBJ models)
  - If input path contains a "blocks" folder, process all PNG files within that folder (upscale textures only, no OBJ generation)
  - Preserve texturepack directory structure in output (e.g., `texturepack/items/` → `output/models/items/`)
- **FR-1.7**: Texturepack-aware processing:
  - When processing a texturepack, apply uniform scale to all item textures in the pack
  - Scale factor applies consistently across all item models in the texturepack
  - Blocks textures are only upscaled to 1024×1024 resolution (no OBJ generation)

### 2.2 Conversion Logic
- **FR-2.1**: Replicate BlockBench's "import from texture" algorithm (for items only):
  - Assume 16x16 pixel textures (square)
  - Generate UV-mapped quad geometry (2 triangles forming a square)
  - Map texture coordinates to cover full quad (0,0 to 1,1)
  - Set appropriate vertex normals (typically facing forward: 0, 0, 1)
  - **Note**: This applies only to textures in "items" folders, not "blocks" folders
- **FR-2.2**: Quad dimensions:
  - Default: 1x1 unit (square, matching 16x16 texture aspect ratio)
  - Optional: Custom scale via config (maintains square aspect ratio)
- **FR-2.3**: Generate OBJ-compliant geometry (for items only):
  - Vertex positions (v) - 4 vertices forming a square quad
  - Texture coordinates (vt) - Full UV mapping (0,0), (1,0), (1,1), (0,1)
  - Face definitions (f) with vertex/texture indices
  - Vertex normals (vn) - Forward-facing normals
- **FR-2.4**: Texturepack-wide scaling:
  - Apply uniform scale factor to all item models within a texturepack
  - Scale factor specified via CLI or config applies to entire texturepack
  - All OBJ files in the texturepack use the same scale factor for consistency
  - Scale applies to model geometry (vertex positions), not texture resolution
- **FR-2.5**: Blocks texture processing:
  - Blocks textures are upscaled to 1024×1024 using nearest-neighbor interpolation
  - No OBJ or MTL files are generated for blocks textures
  - Upscaled blocks textures are saved in the output texturepack's models folder

### 2.3 Output Generation
- **FR-3.1**: Generate `.obj` file for each processed item texture (not for blocks)
- **FR-3.2**: Create corresponding `.mtl` (Material Template Library) file for items:
  - Reference upscaled texture file path (1024×1024)
  - Set up material properties (diffuse map)
- **FR-3.3**: Support configurable output directory:
  - Default: Same directory as input texture
  - Optional: Specified output folder
- **FR-3.4**: Preserve relative directory structure in output (if recursive processing)
- **FR-3.5**: Generate OBJ files that are compatible with standard 3D software (Blender, Maya, etc.)
- **FR-3.6**: Texturepack structure output:
  - Output all files (OBJ, MTL, and upscaled textures) to a `models` folder within the output texturepack
  - When processing texturepack with "items" folder, generate OBJ/MTL files in `output/{texturepack}/models/items/`
  - When processing texturepack with "blocks" folder, generate upscaled 1024×1024 textures in `output/{texturepack}/models/blocks/`
  - Maintain folder structure in output (e.g., `texturepack/items/*.png` → `output/{texturepack}/models/items/*.obj` and `*_1024.png`)
  - All OBJ files in texturepack share the same scale factor for consistent sizing
  - All textures (items and blocks) are upscaled to 1024×1024 resolution

### 2.4 Error Handling
- **FR-4.1**: Skip invalid/corrupted texture files with error logging
- **FR-4.2**: Continue processing remaining files if one fails
- **FR-4.3**: Provide clear error messages for:
  - Invalid file paths
  - Unsupported formats
  - Corrupted image data
  - Write permission errors
- **FR-4.4**: Generate processing summary report (success/failure counts)

---

## 3. Technical Specifications

### 3.1 Dependencies
- **Node.js**: v16+ (ES modules support)
- **Core Libraries**:
  - `sharp` or `jimp` - Image processing and dimension detection
  - `fs-extra` or native `fs/promises` - File system operations
  - `commander` or `yargs` - CLI argument parsing
  - `path` - Path manipulation utilities
- **Optional**:
  - `chalk` - Colored terminal output
  - `ora` - Progress indicators

### 3.2 File Structure
```
texturepack-converter/
├── src/
│   ├── index.js              # Entry point
│   ├── converter.js          # Core conversion logic
│   ├── fileHandler.js       # Input/output file operations
│   ├── objGenerator.js      # OBJ file generation
│   └── utils.js             # Utility functions
├── config/
│   └── default.json         # Default conversion settings
├── tests/
│   └── converter.test.js    # Unit tests
├── package.json
├── README.md
└── PRD.md
```

### 3.3 CLI Interface
```bash
# Basic usage - convert Minecraft item textures folder
node src/index.js --input ./items --output ./models

# Options
--input, -i     Input folder path containing 16x16 PNG textures (required)
--output, -o    Output folder path (optional, defaults to input folder)
--recursive, -r   Process subdirectories recursively (default: true)
--scale          Scale factor for quad size (default: 1.0, maintains 1:1 aspect ratio)
                When processing texturepack, applies uniformly to all models in pack
--texturepack    Enable texturepack mode: automatically process "items" folder if present
--help, -h      Show help

# Examples
# Basic folder conversion
node src/index.js -i ./minecraft/textures/items -o ./output/models

# Texturepack processing (auto-detects items folder)
node src/index.js -i ./texturepack --texturepack -o ./output --scale 2.0

# Direct items folder processing
node src/index.js -i ./texturepack/items -o ./output/models --scale 1.5

# Non-recursive processing
node src/index.js --input ./items --recursive false
```

### 3.4 OBJ File Format Specification
- **Vertices**: 4 vertices forming a quad (rectangle)
- **Texture Coordinates**: Full UV mapping (0,0), (1,0), (1,1), (0,1)
- **Faces**: 2 triangles: (1,2,3) and (1,3,4)
- **Material Reference**: Include `mtllib` directive pointing to `.mtl` file
- **Coordinate System**: Right-handed (Y-up or Z-up, configurable)

### 3.5 Performance Requirements
- Process at least 200+ 16x16 textures/minute on average hardware (small file size advantage)
- Memory-efficient: Process files sequentially or in small batches
- Optimized for small 16x16 PNG files (typically < 1KB per file)

### 3.6 Error Handling Implementation
- Try-catch blocks around file I/O operations
- Validation before processing (file existence, format check)
- Graceful degradation (skip invalid files, continue processing)
- Exit codes: 0 (success), 1 (error), 2 (partial success)

---

## 4. Success Criteria

### 4.1 Functional Success
- ✅ Successfully converts 95%+ of valid texture files to OBJ format
- ✅ Generated OBJ files open correctly in Blender, Maya, or other 3D software
- ✅ Texture mapping is correctly applied (texture visible on model)
- ✅ All output files are valid OBJ format (parseable by standard tools)

### 4.2 Technical Success
- ✅ Processes batch of 100+ 16x16 Minecraft item textures without crashes
- ✅ Handles edge cases: non-16x16 textures (with warning), corrupted images, missing files
- ✅ CLI is intuitive and provides clear feedback
- ✅ Error messages are actionable and help users resolve issues

### 4.3 User Experience Success
- ✅ Single command processes entire Minecraft item texture folder
- ✅ Processing time is reasonable (< 30 seconds for 100+ 16x16 textures)
- ✅ Output files are organized and easy to locate
- ✅ Documentation enables users to use tool without support

---

## 5. Out of Scope Items

### 5.1 Explicitly Excluded
- ❌ GUI interface (CLI-only tool)
- ❌ Real-time preview or visualization
- ❌ Advanced BlockBench features (animations, custom geometry beyond quads)
- ❌ Texture editing or manipulation
- ❌ Support for 3D model formats other than OBJ (FBX, GLTF, etc.)
- ❌ Integration with BlockBench application directly
- ❌ Texture atlas splitting or sprite sheet parsing
- ❌ Automatic texture optimization or compression
- ❌ Multi-texture material support (normal maps, specular maps, etc.)
- ❌ Minecraft-specific model format output (JSON, BBModel) - OBJ only
- ❌ Support for non-16x16 textures (warn but allow)

### 5.2 Future Considerations (v2.0+)
- Custom geometry shapes beyond quads
- Batch processing with progress bars
- Configuration file support (JSON/YAML)
- Texture format conversion (e.g., PNG → JPG)
- Parallel processing for large batches
- Watch mode (auto-convert on file changes)

---

## 6. Acceptance Criteria

**Definition of Done:**
1. Tool accepts folder path and processes all valid 16x16 PNG textures
2. Each texture generates a corresponding OBJ + MTL file pair
3. OBJ files are valid and openable in standard 3D software (Blender, etc.)
4. Error handling prevents crashes and provides useful feedback
5. CLI documentation is complete and accurate
6. Tool correctly processes 16x16 Minecraft item texture format
7. Generated models display textures correctly when opened in 3D software
8. Tool detects and processes "items" folder within texturepack structure
9. Uniform scale factor applies consistently across all models in a texturepack
10. Output preserves texturepack directory structure (items folder maintained in output)

---

## 7. Notes & Assumptions

**Assumptions:**
- All input textures are 16x16 pixel PNG files (Minecraft item texture standard)
- BlockBench's "import from texture" creates a simple square quad/plane geometry
- Users have Node.js installed and basic CLI familiarity
- Texture files are named appropriately (no special character issues)
- Output directory permissions allow file creation
- Users want square quad models (1:1 aspect ratio) matching 16x16 texture format
- Texturepack structures follow standard Minecraft resource pack organization (with "items" folder)
- When scaling a texturepack, all models should use the same scale factor for consistency

**Technical Notes:**
- BlockBench's exact algorithm may need reverse-engineering or documentation review
- OBJ format is text-based and relatively simple to generate
- Material file (MTL) is required for proper texture display in most 3D software
- 16x16 textures are square, so quad generation is straightforward (1:1 aspect ratio)
- Minecraft item textures are typically small files, enabling fast batch processing
- Consider validating texture dimensions and warning if not 16x16
