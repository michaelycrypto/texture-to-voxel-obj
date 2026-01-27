# Minecraft Entity/Block Models

This folder contains JSON model definitions for Minecraft blocks and entities in the standard Minecraft block model format.

## Format

Each JSON file follows Minecraft's block model format:

```json
{
  "name": "block_name",
  "textures": {
    "texture_key": "path/to/texture"
  },
  "elements": [
    {
      "from": [x1, y1, z1],     // Start corner (0-16 scale)
      "to": [x2, y2, z2],       // End corner (0-16 scale)
      "faces": {
        "north": { "uv": [u1, v1, u2, v2], "texture": "#texture_key" },
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

## Coordinate System

- Values range from 0 to 16 (representing one Minecraft block = 16 pixels)
- `from` is the minimum corner, `to` is the maximum corner
- UV coordinates also range from 0-16

## Available Models

### Block Entities (Hardcoded in Java, recreated as JSON)
- `chest.json` - Single chest with base, lid, and knob
- `bed.json` - Simplified bed with mattress and legs
- `door.json` - Door panel template

### Utility Blocks
- `anvil.json` - Anvil with base, middle, and top
- `hopper.json` - Hopper with funnel and spout
- `brewing_stand.json` - Brewing stand with pole and base
- `cauldron.json` - Cauldron with legs and walls
- `grindstone.json` - Grindstone with legs, pivots, and wheel
- `stonecutter.json` - Stonecutter with base and saw blade
- `composter.json` - Composter bin
- `lectern.json` - Lectern with base, post, and angled top
- `enchanting_table.json` - Enchanting table base

### Decorative Blocks
- `lantern.json` - Lantern with body, cap, and handle
- `campfire.json` - Campfire with logs
- `torch.json` - Torch with cross faces
- `flower_pot.json` - Flower pot with dirt
- `bell_floor.json` - Bell stand structure
- `dragon_egg.json` - Dragon egg with layered shape

### Structural Blocks
- `stairs.json` - Stair template
- `fence_post.json` - Fence post template
- `ladder.json` - Flat ladder
- `end_portal_frame.json` - End portal frame

## Usage

To convert these to 3D models (FBX/OBJ/GLB):

1. Parse the JSON `elements` array
2. For each element, create a box from `from` to `to` coordinates
3. Apply UV mapping from the `faces` definitions
4. Map textures using the `textures` object

## Sources

- Most models are from Minecraft Default Assets (via InventivetalentDev/minecraft-assets)
- Entity models (chest, bed) are community recreations based on the original game
- Licensed for educational and personal use

## Adding New Models

1. Create a JSON file with the model name
2. Define textures using Minecraft texture paths
3. Add elements with `from`/`to` coordinates (0-16 scale)
4. Define faces with UV coordinates and texture references
