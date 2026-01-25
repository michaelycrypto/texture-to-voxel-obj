# Implementation Prompt: High-Resolution Texture Upscaling

## Task
Add functionality to generate 1024×1024 high-resolution texture versions using nearest-neighbor upscaling. Items textures get OBJ/MTL files generated with upscaled textures, while blocks textures are only upscaled (no OBJ generation).

## Requirements
1. **Texture Upscaling**: When processing each PNG texture, create an upscaled 1024×1024 version using nearest-neighbor interpolation (preserves pixel art style, no anti-aliasing)
2. **Items Processing**: For textures in "items" folders:
   - Generate OBJ and MTL files
   - Upscale texture to 1024×1024
   - Save upscaled texture in same directory as OBJ/MTL files with naming: `{basename}_1024.png`
   - MTL file references the 1024×1024 texture instead of the original 16×16 texture
3. **Blocks Processing**: For textures in "blocks" folders:
   - Only upscale texture to 1024×1024 (no OBJ/MTL generation)
   - Save upscaled texture in output texturepack's models/blocks folder with naming: `{basename}_1024.png`
4. **Output Structure**: Output all files to `output/{texturepack}/models/` folder:
   - Items: `output/{texturepack}/models/items/*.obj`, `*.mtl`, `*_1024.png`
   - Blocks: `output/{texturepack}/models/blocks/*_1024.png`
5. **Library**: Use Sharp's `resize()` method with `nearest` kernel option

## Implementation Points
- Texture upscaling function already exists in `fileHandler.js` using Sharp
- `converter.js` detects blocks vs items folders and handles differently:
  - Items: calls `convertTexture()` which generates OBJ/MTL and upscales texture
  - Blocks: calls `upscaleBlocksTexture()` which only upscales texture
- MTL generation in `objGenerator.js` already references `{basename}_1024.png`
- Output structure ensures models folder contains organized items and blocks subfolders

## Example
- Input Items: `texturepack/items/diamond_sword.png` (16×16)
- Output Items:
  - `output/texturepack/models/items/diamond_sword.obj`
  - `output/texturepack/models/items/diamond_sword.mtl`
  - `output/texturepack/models/items/diamond_sword_1024.png` (1024×1024)
- Input Blocks: `texturepack/blocks/stone.png` (16×16)
- Output Blocks:
  - `output/texturepack/models/blocks/stone_1024.png` (1024×1024)
  - (No OBJ or MTL files generated)
