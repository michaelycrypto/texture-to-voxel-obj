---
name: design-entity-model
description: Design and create JSON entity models for the texturepack converter. Use when creating new 3D models, designing UGC entities, building block/entity geometry, or asking about model format, UV mapping, or Blockbench-style modeling.
---

# Entity Model Design Guide

Create JSON entity models that convert to GLB for Roblox. Models follow Minecraft/Blockbench conventions with cuboid elements, per-face UV mapping, and 16-unit coordinate system.

## Quick Reference

**Model Location**: `entities/model/{name}.json`
**Coordinate System**: 16 units = 1 block (1 meter)
**UV System**: 0-16 range (maps to 0-1 in GLB)
**Categories**: Containers, Utility, Decorative, Redstone, Structural

## Model JSON Structure

```json
{
  "name": "model_name",
  "credit": "Author/Source",
  "__comment": "Description of the model",
  "textures": {
    "0": "entity/category/texture_name",
    "key": "block/texture_name"
  },
  "__texture_info": "Texture dimensions and UV scale notes",
  "elements": [
    {
      "__comment": "Element description",
      "from": [x1, y1, z1],
      "to": [x2, y2, z2],
      "rotation": {
        "origin": [ox, oy, oz],
        "axis": "x|y|z",
        "angle": -45|-22.5|0|22.5|45
      },
      "shade": true,
      "faces": {
        "north": { "texture": "#0", "uv": [u1, v1, u2, v2], "rotation": 0|90|180|270, "cullface": "north" },
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

## Blockbench Best Practices

### 1. Element Count - Keep it Minimal

Minecraft style prioritizes **simple geometry, detailed texturing**:

| Approach | When to Use |
|----------|-------------|
| Single cuboid | Spherical/cylindrical objects (barrels, logs, pumpkins) |
| Few elements | Distinct visual parts (chest: base + lid + knob = 3 elements) |
| Planes + transparency | Small details (handles, chains, thin parts) |

**Bad**: Many tiny cubes to form curves/details
**Good**: Larger elements with texture-based detail

### 2. Shape Depiction Rules

```
DO:
- Use rotations for slants (45°, 22.5° angles)
- Depict round shapes as single cuboids
- Use transparency for small parts

DON'T:
- Create staircase patterns for curves
- Chain rotated elements to form curves
- Use elements smaller than 1 unit (mixels)
```

### 3. UV Mapping Principles

**1:1 Pixel Ratio**: 1 texture pixel = 1 model unit. Never stretch/squash textures.

```
UV Calculation for 64x64 texture:
- 16 UV units = 64 pixels
- 1 UV unit = 4 pixels

For face dimensions (width × height) in model units:
- UV width = face_width × (16 / texture_width_in_units)
- UV height = face_height × (16 / texture_height_in_units)
```

### 4. Avoid Mixels

Elements must be ≥1 unit. Sub-unit elements break the pixel art style.

```
Bad:  "from": [7.5, 0, 7.5], "to": [8.5, 1, 8.5]  // 1×1×1 - too small for detail
Good: "from": [6, 0, 6], "to": [10, 4, 10]        // 4×4×4 - proper scale
```

## Element Design Workflow

### Step 1: Plan the Decomposition

Break object into logical parts:

```
Lantern Example:
├── Main body (5,0,5 → 11,7,11) - 6×7×6 cuboid
├── Top cap (6,7,6 → 10,9,10) - 4×2×4 cuboid
└── Handle (planes with rotation)
```

### Step 2: Define Each Element

```json
{
  "__comment": "Main body - glass housing",
  "from": [5, 0, 5],
  "to": [11, 7, 11],
  "faces": {
    "down": { "uv": [0, 9, 6, 15], "texture": "#lantern", "cullface": "down" },
    "up": { "uv": [0, 9, 6, 15], "texture": "#lantern" },
    "north": { "uv": [0, 2, 6, 9], "texture": "#lantern" },
    "south": { "uv": [0, 2, 6, 9], "texture": "#lantern" },
    "west": { "uv": [0, 2, 6, 9], "texture": "#lantern" },
    "east": { "uv": [0, 2, 6, 9], "texture": "#lantern" }
  }
}
```

### Step 3: Calculate UV Coordinates

For each face, determine texture region:

```
Face Size: to[axis] - from[axis]
UV Size: face_size × scale_factor

Example (64×64 texture, 16-unit UV space):
- Face is 6 units wide × 7 units tall
- UV region: 6 × (16/64×4) = 6 units wide in UV space
- UV: [start_u, start_v, start_u + 6, start_v + 7]
```

### Step 4: Add Rotations (if needed)

```json
{
  "__comment": "Handle - rotated plane",
  "from": [6.5, 9, 8],
  "to": [9.5, 11, 8],
  "rotation": {
    "origin": [8, 8, 8],  // Center of rotation
    "axis": "y",           // Rotate around Y axis
    "angle": 45            // Only: -45, -22.5, 0, 22.5, 45
  },
  "shade": false,
  "faces": {
    "north": { "uv": [14, 1, 11, 3], "texture": "#lantern" },
    "south": { "uv": [11, 1, 14, 3], "texture": "#lantern" }
  }
}
```

## Common Model Patterns

### Container Pattern (Chest, Shulker)

```json
{
  "elements": [
    { "__comment": "Base container", "from": [1,0,1], "to": [15,10,15], ... },
    { "__comment": "Lid/top", "from": [1,9,1], "to": [15,14,15], ... },
    { "__comment": "Hardware (knob/latch)", "from": [7,8,0], "to": [9,12,1], ... }
  ]
}
```

### Hollow Container Pattern (Hopper, Cauldron)

Multiple wall elements forming hollow interior:

```json
{
  "elements": [
    { "__comment": "North wall", "from": [2,11,0], "to": [14,16,2], ... },
    { "__comment": "South wall", "from": [2,11,14], "to": [14,16,16], ... },
    { "__comment": "West wall", "from": [0,11,0], "to": [2,16,16], ... },
    { "__comment": "East wall", "from": [14,11,0], "to": [16,16,16], ... },
    { "__comment": "Bottom/funnel", "from": [4,4,4], "to": [12,10,12], ... }
  ]
}
```

### Decorative Pattern (Lantern, Torch)

Main body + accent elements:

```json
{
  "elements": [
    { "__comment": "Body", ... },
    { "__comment": "Cap/base", ... },
    { "__comment": "Detail planes (handle, flame)", "shade": false, ... }
  ]
}
```

### Multi-Part Pattern (Bed, Door)

Connected elements spanning multiple blocks:

```json
{
  "__comment": "Full bed spans 2 blocks (32 units Z)",
  "elements": [
    { "__comment": "Head section", "from": [0,3,16], "to": [16,9,32], ... },
    { "__comment": "Foot section", "from": [0,3,0], "to": [16,9,16], ... },
    { "__comment": "Legs (4x)", ... }
  ]
}
```

## Texture Reference Paths

| Prefix | Directory | Example |
|--------|-----------|---------|
| `block/` | `entities/block/` or `input/{pack}/block/` | `"block/anvil"` |
| `entity/` | `entities/texture/` or `input/{pack}/entity/` | `"entity/chest/normal"` |

## Face Properties Reference

| Property | Values | Purpose |
|----------|--------|---------|
| `texture` | `"#key"` | Reference to textures object |
| `uv` | `[u1,v1,u2,v2]` | Texture coordinates (0-16 range) |
| `rotation` | `0,90,180,270` | Rotate UV mapping |
| `cullface` | `north,south,east,west,up,down` | Skip face when adjacent to block |

## Validation Checklist

Before finalizing a model:

- [ ] Element count is minimal (prefer fewer, larger elements)
- [ ] No elements smaller than 1×1×1 units
- [ ] UV ratios match face dimensions (no stretching)
- [ ] All faces have explicit UV coordinates
- [ ] Texture references exist or will be created
- [ ] `__comment` on each element for clarity
- [ ] Model fits within category conventions
- [ ] Rotation angles are valid (-45, -22.5, 0, 22.5, 45)

## Testing the Model

```bash
# Generate single model
node src/entityParser.js --model {name} --pack Skyblox -v

# Check output
ls export/Skyblox/models/entities/{Category}/{name}.glb
```

## Adding to Category

Update `config/entityCategories.json`:

```json
{
  "Containers": ["chest", "bed", "your_new_container"],
  "Utility": ["anvil", "your_new_utility"],
  "Decorative": ["lantern", "your_new_decorative"],
  "Redstone": ["hopper"],
  "Structural": ["door", "ladder"]
}
```

## Additional Resources

- See [EXAMPLES.md](EXAMPLES.md) for complete model examples
- See [UV-REFERENCE.md](UV-REFERENCE.md) for texture atlas layouts
