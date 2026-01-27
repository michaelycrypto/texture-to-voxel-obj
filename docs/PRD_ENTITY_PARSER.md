# Product Requirements Document: Minecraft JSON Model to GLB Parser

## 1. Overview

### 1.1 Purpose
Create a parser that converts Minecraft JSON block/entity model definitions into GLB (Binary glTF) 3D models by combining JSON geometry definitions with PNG textures.

### 1.2 User Story
**As a** Minecraft resource pack converter  
**I want to** automatically generate 3D GLB models from Minecraft JSON model definitions  
**So that** I can create accurate 3D representations of Minecraft blocks and entities for use in Roblox or other 3D applications

### 1.3 Key Difference from Existing System
| Aspect | Existing (Item Converter) | New (Entity Parser) |
|--------|---------------------------|---------------------|
| Input | 16x16 PNG textures | JSON model + PNG textures |
| Geometry | Pixel → Voxel (each pixel = cube) | JSON elements → Arbitrary cuboids |
| UV Mapping | Auto-generated per pixel | Defined in JSON per face |
| Shapes | Fixed voxel grid | Custom dimensions, rotations |
| Use Case | Flat item sprites | Complex 3D blocks/entities |

---

## 2. Input Specifications

### 2.1 Directory Structure
```
entities/
├── model/              # JSON model definitions
│   ├── anvil.json
│   ├── chest.json
│   ├── hopper.json
│   └── ...
├── block/              # Block textures (476 PNGs)
│   ├── anvil.png
│   ├── anvil_top.png
│   ├── hopper_inside.png
│   └── ...
└── texture/            # Entity textures (304 PNGs)
    ├── chest/
    │   ├── normal.png
    │   └── ender.png
    ├── bed/
    │   ├── red.png
    │   └── ...
    └── ...
```

### 2.2 JSON Model Format (Minecraft Standard)
```json
{
  "name": "model_name",
  "textures": {
    "texture_key": "block/texture_name",
    "another_key": "entity/chest/normal"
  },
  "elements": [
    {
      "from": [x1, y1, z1],
      "to": [x2, y2, z2],
      "rotation": {
        "origin": [ox, oy, oz],
        "axis": "x" | "y" | "z",
        "angle": -45 | -22.5 | 0 | 22.5 | 45
      },
      "faces": {
        "north": { "uv": [u1, v1, u2, v2], "texture": "#texture_key", "rotation": 0|90|180|270 },
        "south": { ... },
        "east": { ... },
        "west": { ... },
        "up": { ... },
        "down": { ... }
      }
    }
  ]
}
```

### 2.3 Coordinate System
- Minecraft uses a 16-unit grid (one block = 16 units)
- `from`/`to` values range from 0 to 16 (can extend to -16 to 32)
- UV coordinates range from 0 to 16
- Y is up in Minecraft

---

## 3. Functional Requirements

### 3.1 JSON Parsing
- **FR-1.1**: Parse JSON model files from `entities/model/` directory
- **FR-1.2**: Resolve texture references:
  - `"block/texture_name"` → `entities/block/texture_name.png`
  - `"entity/path/texture"` → `entities/texture/path/texture.png`
  - `"#texture_key"` → Look up in `textures` object
- **FR-1.3**: Handle `parent` references (load and merge parent model)
- **FR-1.4**: Support optional fields with defaults:
  - `ambientocclusion`: default `true`
  - `shade`: default `true`
  - `rotation`: default none
  - `cullface`: ignore for GLB output

### 3.2 Geometry Generation
- **FR-2.1**: For each element in `elements` array:
  - Create a cuboid from `from` to `to` coordinates
  - Generate 8 vertices (box corners)
  - Generate 6 faces (12 triangles)
- **FR-2.2**: Apply element rotation if specified:
  - Rotate around `origin` point
  - Rotate on specified `axis` (x, y, or z)
  - Apply `angle` in degrees
- **FR-2.3**: Handle face culling:
  - Only generate faces that are defined in `faces` object
  - Skip undefined faces (they won't render)
- **FR-2.4**: Convert coordinate system:
  - Minecraft: Y-up, right-handed
  - GLB/glTF: Y-up, right-handed (same)
  - Scale: 16 units → 1 unit (or configurable)

### 3.3 UV Mapping
- **FR-3.1**: Map UV coordinates from JSON to GLB:
  - JSON UVs are in 0-16 range
  - GLB UVs are in 0-1 range
  - Convert: `glb_uv = json_uv / 16`
- **FR-3.2**: Handle UV rotation:
  - Apply face `rotation` (0, 90, 180, 270 degrees)
  - Rotate UV coordinates accordingly
- **FR-3.3**: Handle UV flipping:
  - If `u1 > u2`, flip horizontally
  - If `v1 > v2`, flip vertically
- **FR-3.4**: Auto-generate UVs if not specified:
  - Based on element position (Minecraft default behavior)

### 3.4 Texture Handling
- **FR-4.1**: Load referenced PNG textures
- **FR-4.2**: Create texture atlas if model uses multiple textures:
  - Combine textures into single atlas
  - Remap UV coordinates to atlas positions
- **FR-4.3**: Embed texture in GLB (single-file output)
- **FR-4.4**: Use nearest-neighbor filtering (preserve pixel art)
- **FR-4.5**: Handle missing textures gracefully:
  - Log warning
  - Use placeholder color or skip face

### 3.5 GLB Output
- **FR-5.1**: Generate valid GLB 2.0 binary format
- **FR-5.2**: Include in GLB:
  - Mesh with positions, normals, UVs, indices
  - Material with PBR properties (metallic=0, roughness=1)
  - Embedded texture(s)
- **FR-5.3**: Output file naming:
  - `{model_name}.glb`
  - Place in configurable output directory
- **FR-5.4**: Support batch processing:
  - Process all models in `entities/model/`
  - Generate one GLB per model

### 3.6 CLI Interface
```bash
# Process single model
node src/entityParser.js --model anvil --pack Skyblox

# Process all models for a pack
node src/entityParser.js --all --pack Skyblox

# Options
--model, -m      Model name (without .json extension)
--all, -a        Process all models in entities/model/
--pack, -p       Pack name for output (creates export/{pack}/models/entities/)
--output, -o     Output base directory (default: ./export)
--scale, -s      Scale factor (default: 1.0, where 16 units = 1 unit)
--entities-dir   Path to entities directory (default: ./entities)
--verbose, -v    Enable verbose logging

# Examples

# Generate all entities for Skyblox pack
node src/entityParser.js --all --pack Skyblox
# Output: export/Skyblox/models/entities/{Category}/*.glb
#         export/Skyblox/entity_metadata.lua
#         export/Skyblox/lists/all_entities.txt

# Generate single entity
node src/entityParser.js --model chest --pack Skyblox
# Output: export/Skyblox/models/entities/Containers/chest.glb

# Custom scale (for larger models in Roblox)
node src/entityParser.js --all --pack Skyblox --scale 2.0
```

---

## 4. Technical Specifications

### 4.1 New Files to Create
```
src/
├── entityParser.js       # Main entry point for entity parsing
├── jsonModelLoader.js    # Load and parse JSON model files
├── geometryBuilder.js    # Convert elements to mesh geometry
├── textureAtlas.js       # Combine multiple textures into atlas
└── entityGlbGenerator.js # Generate GLB from parsed model

config/
└── entityCategories.json # Category mapping for entities
```

### 4.1.1 Entity Category Configuration (`config/entityCategories.json`)
```json
{
  "Containers": ["chest", "bed", "barrel", "shulker_box"],
  "Utility": ["anvil", "grindstone", "lectern", "brewing_stand", "enchanting_table", "stonecutter", "cauldron"],
  "Decorative": ["lantern", "campfire", "flower_pot", "torch", "bell_floor", "dragon_egg"],
  "Redstone": ["hopper", "composter"],
  "Structural": ["stairs", "fence_post", "door", "ladder", "end_portal_frame"]
}
```

### 4.2 Data Flow
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  JSON Model     │────▶│  jsonModelLoader │────▶│  Parsed Model   │
│  (anvil.json)   │     │  - Parse JSON    │     │  - elements[]   │
└─────────────────┘     │  - Resolve refs  │     │  - textures{}   │
                        └──────────────────┘     └────────┬────────┘
                                                          │
┌─────────────────┐     ┌──────────────────┐              │
│  PNG Textures   │────▶│  textureAtlas    │◀─────────────┘
│  (block/*.png)  │     │  - Load PNGs     │
└─────────────────┘     │  - Create atlas  │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  geometryBuilder │
                        │  - Build vertices│
                        │  - Build UVs     │
                        │  - Build indices │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐     ┌─────────────────┐
                        │ entityGlbGen     │────▶│  Output GLB     │
                        │  - Create GLB    │     │  (anvil.glb)    │
                        └──────────────────┘     └─────────────────┘
```

### 4.3 Geometry Builder Algorithm
```javascript
function buildElement(element, textureAtlas) {
  const { from, to, rotation, faces } = element;
  
  // 1. Create 8 vertices of cuboid
  const vertices = [
    [from[0], from[1], from[2]], // 0: left-bottom-back
    [to[0],   from[1], from[2]], // 1: right-bottom-back
    [to[0],   to[1],   from[2]], // 2: right-top-back
    [from[0], to[1],   from[2]], // 3: left-top-back
    [from[0], from[1], to[2]],   // 4: left-bottom-front
    [to[0],   from[1], to[2]],   // 5: right-bottom-front
    [to[0],   to[1],   to[2]],   // 6: right-top-front
    [from[0], to[1],   to[2]],   // 7: left-top-front
  ];
  
  // 2. Apply rotation if present
  if (rotation) {
    vertices = applyRotation(vertices, rotation);
  }
  
  // 3. Scale to GLB units (16 → 1)
  vertices = vertices.map(v => v.map(c => c / 16));
  
  // 4. Generate faces with UVs
  const faceDefinitions = {
    north: { verts: [1, 0, 3, 2], normal: [0, 0, -1] },
    south: { verts: [4, 5, 6, 7], normal: [0, 0, 1] },
    east:  { verts: [5, 1, 2, 6], normal: [1, 0, 0] },
    west:  { verts: [0, 4, 7, 3], normal: [-1, 0, 0] },
    up:    { verts: [3, 7, 6, 2], normal: [0, 1, 0] },
    down:  { verts: [0, 1, 5, 4], normal: [0, -1, 0] },
  };
  
  // 5. For each defined face, generate triangles
  for (const [faceName, faceData] of Object.entries(faces)) {
    const def = faceDefinitions[faceName];
    const uv = faceData.uv || autoGenerateUV(element, faceName);
    const atlasUV = textureAtlas.getUV(faceData.texture, uv);
    
    // Add two triangles for quad
    addTriangle(def.verts[0], def.verts[1], def.verts[2], def.normal, atlasUV);
    addTriangle(def.verts[0], def.verts[2], def.verts[3], def.normal, atlasUV);
  }
}
```

### 4.4 Texture Atlas Strategy
- If model uses single texture: embed directly
- If model uses multiple textures:
  - Create power-of-2 atlas (256x256, 512x512, etc.)
  - Pack textures efficiently
  - Remap all UV coordinates to atlas space
- Use nearest-neighbor scaling to preserve pixel art

### 4.5 Dependencies
- Existing: `sharp` (image processing)
- Existing: `fs-extra`, `path`
- New: None required (reuse existing GLB generation logic)

---

## 5. Output Specifications (Roblox-Ready)

### 5.1 Export Directory Structure
```
export/{PackName}/
├── entity_metadata.lua              # Lua table with entity info
├── lists/
│   ├── all_entities.txt             # entity_name=roblox_asset_id
│   ├── Containers.txt               # chest, barrel, shulker_box
│   ├── Utility.txt                  # anvil, grindstone, lectern, brewing_stand
│   ├── Decorative.txt               # lantern, campfire, flower_pot, torch
│   ├── Redstone.txt                 # hopper, composter
│   └── Structural.txt               # stairs, fence_post, door, ladder
├── models/
│   └── entities/
│       ├── Containers/
│       │   ├── chest.glb
│       │   ├── bed.glb
│       │   └── ...
│       ├── Utility/
│       │   ├── anvil.glb
│       │   ├── grindstone.glb
│       │   └── ...
│       ├── Decorative/
│       │   ├── lantern.glb
│       │   ├── campfire.glb
│       │   └── ...
│       ├── Redstone/
│       │   ├── hopper.glb
│       │   └── ...
│       └── Structural/
│           ├── stairs.glb
│           ├── fence_post.glb
│           └── ...
└── textures/
    └── entities/
        └── *.png                    # Upscaled textures if needed
```

### 5.2 Entity Categories
| Category | Entities |
|----------|----------|
| Containers | chest, bed, barrel (future) |
| Utility | anvil, grindstone, lectern, brewing_stand, enchanting_table, stonecutter |
| Decorative | lantern, campfire, flower_pot, torch, bell_floor, dragon_egg |
| Redstone | hopper, composter |
| Structural | stairs, fence_post, door, ladder, end_portal_frame |

### 5.3 Lua Metadata File (`entity_metadata.lua`)
```lua
--[[
    Entity metadata for {PackName}
    Generated by texturepack-converter
]]

local ENTITY_METADATA = {
    ["anvil"] = {
        category = "Utility",
        elements = 4,
        dimensions = {x = 13, y = 16, z = 16},  -- in Minecraft pixels
        assetId = nil,  -- populated after Roblox upload
    },
    ["chest"] = {
        category = "Containers",
        elements = 3,
        dimensions = {x = 14, y = 14, z = 14},
        assetId = nil,
    },
    ["hopper"] = {
        category = "Redstone",
        elements = 7,
        dimensions = {x = 16, y = 16, z = 16},
        assetId = nil,
    },
    -- ... more entities
}

return ENTITY_METADATA
```

### 5.4 Entity List File (`lists/all_entities.txt`)
```
anvil=
chest=
hopper=
lantern=
campfire=
```
*(Asset IDs populated after Roblox upload)*

### 5.5 GLB Structure
```
anvil.glb
├── JSON Chunk
│   ├── asset: { version: "2.0", generator: "texturepack-converter" }
│   ├── scene: 0
│   ├── nodes: [{ mesh: 0, name: "anvil" }]
│   ├── meshes: [{ primitives: [...] }]
│   ├── accessors: [position, normal, uv, indices]
│   ├── bufferViews: [...]
│   ├── materials: [{ pbrMetallicRoughness: {...} }]
│   ├── textures: [{ source: 0, sampler: 0 }]
│   ├── images: [{ bufferView: N, mimeType: "image/png" }]
│   └── samplers: [{ magFilter: NEAREST, minFilter: NEAREST }]
└── BIN Chunk
    ├── Position data (Float32)
    ├── Normal data (Float32)
    ├── UV data (Float32)
    ├── Index data (Uint16/Uint32)
    └── Image data (PNG bytes)
```

### 5.6 Material Properties
```json
{
  "pbrMetallicRoughness": {
    "baseColorTexture": { "index": 0 },
    "baseColorFactor": [1, 1, 1, 1],
    "metallicFactor": 0,
    "roughnessFactor": 1
  },
  "doubleSided": true,
  "alphaMode": "MASK",
  "alphaCutoff": 0.5
}
```

---

## 6. Success Criteria

### 6.1 Functional
- [ ] Parse all 22 JSON models in `entities/model/`
- [ ] Generate valid GLB for each model
- [ ] GLB opens correctly in Blender, glTF Viewer, Roblox Studio
- [ ] Textures display correctly on model faces
- [ ] Element rotations render correctly
- [ ] Multi-texture models combine into atlas correctly

### 6.2 Visual Accuracy
- [ ] Anvil has correct base, middle, and top proportions
- [ ] Hopper has funnel shape with spout
- [ ] Chest has base, lid, and knob
- [ ] Lantern has body, cap, and handle
- [ ] Campfire logs are positioned correctly

### 6.3 Performance
- [ ] Process single model in < 1 second
- [ ] Process all 22 models in < 10 seconds
- [ ] Memory usage < 500MB during batch processing

---

## 7. Edge Cases & Error Handling

### 7.1 Edge Cases
| Case | Handling |
|------|----------|
| Missing texture file | Log warning, use magenta placeholder |
| Invalid JSON syntax | Log error, skip model |
| Element extends beyond 0-16 range | Allow (valid in Minecraft) |
| Rotation angle not in allowed set | Clamp to nearest valid angle |
| Parent reference not found | Log warning, process without parent |
| Empty elements array | Generate empty GLB (valid but no geometry) |
| Face without UV | Auto-generate based on element position |

### 7.2 Error Messages
```
[ERROR] Failed to parse model 'broken.json': Unexpected token at line 15
[WARN] Texture 'block/missing_texture' not found for model 'test'
[WARN] Model 'parent_test' references missing parent 'block/base'
[INFO] Processed 22/22 models successfully
[INFO] Output: ./output/entities/
```

---

## 8. Future Enhancements (Out of Scope)

- [ ] Animation support (for animated entities)
- [ ] Multi-part models (bed head + foot as separate meshes)
- [ ] Blockstate variants (different rotations/models per state)
- [ ] Multipart model composition (fences, walls)
- [ ] Level-of-detail (LOD) generation
- [ ] Normal map / PBR texture support
- [ ] Direct Roblox upload integration

---

## 9. Example Outputs

### 9.1 Full Pack Export
```bash
node src/entityParser.js --all --pack Skyblox
```

**Output Structure:**
```
export/Skyblox/
├── entity_metadata.lua
├── lists/
│   ├── all_entities.txt
│   ├── Containers.txt
│   ├── Utility.txt
│   ├── Decorative.txt
│   ├── Redstone.txt
│   └── Structural.txt
└── models/
    └── entities/
        ├── Containers/
        │   ├── chest.glb
        │   └── bed.glb
        ├── Utility/
        │   ├── anvil.glb
        │   ├── brewing_stand.glb
        │   ├── enchanting_table.glb
        │   ├── grindstone.glb
        │   ├── lectern.glb
        │   └── stonecutter.glb
        ├── Decorative/
        │   ├── bell_floor.glb
        │   ├── campfire.glb
        │   ├── dragon_egg.glb
        │   ├── flower_pot.glb
        │   ├── lantern.glb
        │   └── torch.glb
        ├── Redstone/
        │   ├── composter.glb
        │   └── hopper.glb
        └── Structural/
            ├── door.glb
            ├── end_portal_frame.glb
            ├── fence_post.glb
            ├── ladder.glb
            └── stairs.glb
```

### 9.2 Anvil
- Input: `entities/model/anvil.json` + `entities/block/anvil*.png`
- Output: `export/Skyblox/models/entities/Utility/anvil.glb`
- Category: Utility
- Elements: 4 (base, narrow, middle, top)
- Textures: 2 (body, top)

### 9.3 Chest
- Input: `entities/model/chest.json` + `entities/texture/chest/normal.png`
- Output: `export/Skyblox/models/entities/Containers/chest.glb`
- Category: Containers
- Elements: 3 (base, lid, knob)
- Textures: 1 (chest atlas)

### 9.4 Lantern
- Input: `entities/model/lantern.json` + `entities/block/lantern.png`
- Output: `export/Skyblox/models/entities/Decorative/lantern.glb`
- Category: Decorative
- Elements: 4 (body, cap, handle×2)
- Textures: 1 (lantern)

---

## 10. Acceptance Criteria

**Definition of Done:**
1. ✅ Parser reads all JSON models from `entities/model/`
2. ✅ Parser resolves texture paths to actual PNG files
3. ✅ Geometry builder creates correct cuboid shapes
4. ✅ UV mapping matches Minecraft's rendering
5. ✅ Element rotations are applied correctly
6. ✅ GLB output is valid and opens in 3D viewers
7. ✅ Textures are embedded and display correctly
8. ✅ CLI supports single model and batch processing
9. ✅ Error handling provides actionable feedback
10. ✅ Documentation explains usage and limitations

**Roblox-Ready Criteria:**
11. ✅ Output follows `export/{PackName}/` structure (matches item export)
12. ✅ GLB files organized by category folders
13. ✅ `entity_metadata.lua` generated with Lua table format
14. ✅ `lists/all_entities.txt` generated for upload tracking
15. ✅ Category list files generated (Containers.txt, Utility.txt, etc.)
16. ✅ GLB files compatible with Roblox MeshPart import
17. ✅ Nearest-neighbor texture filtering for pixel art style

---

## 11. Integration with Existing Upload System

The entity parser output integrates with the existing Roblox upload workflow:

### 11.1 After Generation
```bash
# 1. Generate entities for pack
node src/entityParser.js --all --pack Skyblox

# 2. Upload to Roblox (using existing uploader)
node scripts/uploadToRoblox.js --type entities --pack Skyblox

# 3. Asset IDs written to lists/all_entities.txt
```

### 11.2 Updated Files After Upload
```
export/Skyblox/
├── entity_metadata.lua              # assetId fields populated
└── lists/
    └── all_entities.txt             # anvil=123456789012345
```

### 11.3 Usage in Roblox
```lua
local EntityMetadata = require(game.ReplicatedStorage.EntityMetadata)

-- Get asset ID for anvil
local anvilAssetId = EntityMetadata["anvil"].assetId
local meshPart = Instance.new("MeshPart")
meshPart.MeshId = "rbxassetid://" .. anvilAssetId
```
