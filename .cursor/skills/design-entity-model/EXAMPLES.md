# Entity Model Examples

Complete examples for common model types.

## Simple Container: Chest

3 elements with 64×64 texture atlas.

```json
{
  "name": "chest",
  "credit": "Community Recreation",
  "__comment": "Standard chest with base, lid, and knob",
  "textures": {
    "0": "entity/chest/normal"
  },
  "__texture_info": "64x64 texture. UV scale: 16 units = 64px",
  "elements": [
    {
      "__comment": "Base - 14×10×14 container body",
      "from": [1.0, 0.0, 1.0],
      "to": [15.0, 10.0, 15.0],
      "faces": {
        "north": { "texture": "#0", "uv": [3.5, 8.25, 7.0, 10.75] },
        "east": { "texture": "#0", "uv": [0.0, 8.25, 3.5, 10.75] },
        "south": { "texture": "#0", "uv": [10.5, 8.25, 14.0, 10.75] },
        "west": { "texture": "#0", "uv": [7.0, 8.25, 10.5, 10.75] },
        "up": { "texture": "#0", "uv": [3.5, 4.75, 7.0, 8.25], "rotation": 180 },
        "down": { "texture": "#0", "uv": [10.5, 4.75, 7.0, 8.25] }
      }
    },
    {
      "__comment": "Knob - small latch on front",
      "from": [7.0, 8.0, 0.0],
      "to": [9.0, 12.0, 1.0],
      "faces": {
        "north": { "texture": "#0", "uv": [0.25, 0.25, 0.75, 1.25] },
        "east": { "texture": "#0", "uv": [0.0, 0.25, 0.25, 1.25] },
        "south": { "texture": "#0", "uv": [1.0, 0.25, 1.5, 1.25] },
        "west": { "texture": "#0", "uv": [0.75, 0.25, 1.0, 1.25] },
        "up": { "texture": "#0", "uv": [0.75, 0.0, 0.25, 0.25] },
        "down": { "texture": "#0", "uv": [1.25, 0.0, 0.75, 0.25] }
      }
    },
    {
      "__comment": "Lid - top section that opens",
      "from": [1.0, 9.0, 1.0],
      "to": [15.0, 14.0, 15.0],
      "faces": {
        "north": { "texture": "#0", "uv": [3.5, 3.5, 7.0, 4.75] },
        "east": { "texture": "#0", "uv": [0.0, 3.5, 3.5, 4.75] },
        "south": { "texture": "#0", "uv": [10.5, 3.5, 14.0, 4.75] },
        "west": { "texture": "#0", "uv": [7.0, 3.5, 10.5, 4.75] },
        "up": { "texture": "#0", "uv": [3.5, 0.0, 7.0, 3.5], "rotation": 180 },
        "down": { "texture": "#0", "uv": [10.5, 0.0, 7.0, 3.5] }
      }
    }
  ]
}
```

## Decorative with Rotations: Lantern

4 elements including rotated handle planes.

```json
{
  "name": "lantern",
  "credit": "Minecraft Default Assets",
  "__comment": "Hanging/standing lantern with handle",
  "textures": {
    "particle": "#lantern",
    "lantern": "block/lantern"
  },
  "elements": [
    {
      "__comment": "Main body - glass housing 6×7×6",
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
    },
    {
      "__comment": "Top cap - metal top 4×2×4",
      "from": [6, 7, 6],
      "to": [10, 9, 10],
      "faces": {
        "up": { "uv": [1, 10, 5, 14], "texture": "#lantern" },
        "north": { "uv": [1, 0, 5, 2], "texture": "#lantern" },
        "south": { "uv": [1, 0, 5, 2], "texture": "#lantern" },
        "west": { "uv": [1, 0, 5, 2], "texture": "#lantern" },
        "east": { "uv": [1, 0, 5, 2], "texture": "#lantern" }
      }
    },
    {
      "__comment": "Handle part 1 - rotated plane",
      "from": [6.5, 9, 8],
      "to": [9.5, 11, 8],
      "rotation": { "origin": [8, 8, 8], "axis": "y", "angle": 45 },
      "shade": false,
      "faces": {
        "north": { "uv": [14, 1, 11, 3], "texture": "#lantern" },
        "south": { "uv": [11, 1, 14, 3], "texture": "#lantern" }
      }
    },
    {
      "__comment": "Handle part 2 - perpendicular rotated plane",
      "from": [8, 9, 6.5],
      "to": [8, 11, 9.5],
      "rotation": { "origin": [8, 8, 8], "axis": "y", "angle": 45 },
      "shade": false,
      "faces": {
        "west": { "uv": [14, 10, 11, 12], "texture": "#lantern" },
        "east": { "uv": [11, 10, 14, 12], "texture": "#lantern" }
      }
    }
  ]
}
```

## Hollow Container: Hopper

7 elements forming funnel shape with multiple textures.

```json
{
  "name": "hopper",
  "credit": "Minecraft Default Assets",
  "__comment": "Redstone component - funnel with walls",
  "ambientocclusion": false,
  "textures": {
    "particle": "block/hopper_outside",
    "top": "block/hopper_top",
    "side": "block/hopper_outside",
    "inside": "block/hopper_inside"
  },
  "elements": [
    {
      "__comment": "Top rim - full width ring",
      "from": [0, 10, 0],
      "to": [16, 11, 16],
      "faces": {
        "down": { "texture": "#inside" },
        "up": { "texture": "#inside", "cullface": "up" },
        "north": { "texture": "#side", "cullface": "north" },
        "south": { "texture": "#side", "cullface": "south" },
        "west": { "texture": "#side", "cullface": "west" },
        "east": { "texture": "#side", "cullface": "east" }
      }
    },
    {
      "__comment": "West wall",
      "from": [0, 11, 0],
      "to": [2, 16, 16],
      "faces": {
        "up": { "texture": "#top", "cullface": "up" },
        "north": { "texture": "#side", "cullface": "north" },
        "south": { "texture": "#side", "cullface": "south" },
        "west": { "texture": "#side", "cullface": "west" },
        "east": { "texture": "#side", "cullface": "up" }
      }
    },
    {
      "__comment": "East wall",
      "from": [14, 11, 0],
      "to": [16, 16, 16],
      "faces": {
        "up": { "texture": "#top", "cullface": "up" },
        "north": { "texture": "#side", "cullface": "north" },
        "south": { "texture": "#side", "cullface": "south" },
        "west": { "texture": "#side", "cullface": "up" },
        "east": { "texture": "#side", "cullface": "east" }
      }
    },
    {
      "__comment": "North wall",
      "from": [2, 11, 0],
      "to": [14, 16, 2],
      "faces": {
        "up": { "texture": "#top", "cullface": "up" },
        "north": { "texture": "#side", "cullface": "north" },
        "south": { "texture": "#side", "cullface": "up" }
      }
    },
    {
      "__comment": "South wall",
      "from": [2, 11, 14],
      "to": [14, 16, 16],
      "faces": {
        "up": { "texture": "#top", "cullface": "up" },
        "north": { "texture": "#side", "cullface": "up" },
        "south": { "texture": "#side", "cullface": "south" }
      }
    },
    {
      "__comment": "Center funnel - middle section",
      "from": [4, 4, 4],
      "to": [12, 10, 12],
      "faces": {
        "down": { "texture": "#inside" },
        "north": { "texture": "#side" },
        "south": { "texture": "#side" },
        "west": { "texture": "#side" },
        "east": { "texture": "#side" }
      }
    },
    {
      "__comment": "Bottom spout - output tube",
      "from": [6, 0, 6],
      "to": [10, 4, 10],
      "faces": {
        "down": { "texture": "#inside", "cullface": "down" },
        "north": { "texture": "#side" },
        "south": { "texture": "#side" },
        "west": { "texture": "#side" },
        "east": { "texture": "#side" }
      }
    }
  ]
}
```

## Multi-Block: Bed

6 elements spanning 2 blocks (32 units) with legs.

```json
{
  "name": "bed",
  "credit": "Community Recreation",
  "__comment": "Full 2-block bed with head (pillow) and foot sections",
  "textures": {
    "0": "entity/bed/red"
  },
  "__texture_info": "64x64 texture. UVs in 0-16 scale where 16=64px",
  "elements": [
    {
      "__comment": "Head section (block with pillow) - back part",
      "from": [0, 3, 16],
      "to": [16, 9, 32],
      "faces": {
        "up": { "texture": "#0", "uv": [1.5, 1.5, 5.5, 5.5], "rotation": 180 },
        "down": { "texture": "#0", "uv": [5.5, 1.5, 9.5, 5.5] },
        "north": { "texture": "#0", "uv": [5.5, 5.5, 9.5, 7] },
        "south": { "texture": "#0", "uv": [1.5, 5.5, 5.5, 7] },
        "west": { "texture": "#0", "uv": [0, 1.5, 4, 3] },
        "east": { "texture": "#0", "uv": [0, 1.5, 4, 3] }
      }
    },
    {
      "__comment": "Foot section - front part",
      "from": [0, 3, 0],
      "to": [16, 9, 16],
      "faces": {
        "up": { "texture": "#0", "uv": [1.5, 7, 5.5, 11], "rotation": 180 },
        "down": { "texture": "#0", "uv": [5.5, 7, 9.5, 11] },
        "north": { "texture": "#0", "uv": [1.5, 11, 5.5, 12.5] },
        "south": { "texture": "#0", "uv": [5.5, 11, 9.5, 12.5] },
        "west": { "texture": "#0", "uv": [0, 7, 4, 8.5] },
        "east": { "texture": "#0", "uv": [0, 7, 4, 8.5] }
      }
    },
    {
      "__comment": "Head leg 1 (back-left) - 3×3×3",
      "from": [0, 0, 29],
      "to": [3, 3, 32],
      "faces": {
        "down": { "texture": "#0", "uv": [12.75, 1.25, 13.5, 2], "cullface": "down" },
        "north": { "texture": "#0", "uv": [12.75, 2, 13.5, 2.75] },
        "south": { "texture": "#0", "uv": [13.5, 2, 14.25, 2.75] },
        "west": { "texture": "#0", "uv": [12, 2, 12.75, 2.75] },
        "east": { "texture": "#0", "uv": [14.25, 2, 15, 2.75] }
      }
    },
    {
      "__comment": "Head leg 2 (back-right)",
      "from": [13, 0, 29],
      "to": [16, 3, 32],
      "faces": {
        "down": { "texture": "#0", "uv": [13.25, 1.25, 14, 2], "cullface": "down" },
        "north": { "texture": "#0", "uv": [13.25, 2, 14, 2.75] },
        "south": { "texture": "#0", "uv": [14, 2, 14.75, 2.75] },
        "west": { "texture": "#0", "uv": [12.5, 2, 13.25, 2.75] },
        "east": { "texture": "#0", "uv": [14.75, 2, 15.5, 2.75] }
      }
    },
    {
      "__comment": "Foot leg 1 (front-left)",
      "from": [0, 0, 0],
      "to": [3, 3, 3],
      "faces": {
        "down": { "texture": "#0", "uv": [12.75, 4.25, 13.5, 5], "cullface": "down" },
        "north": { "texture": "#0", "uv": [13.5, 5, 14.25, 5.75] },
        "south": { "texture": "#0", "uv": [12.75, 5, 13.5, 5.75] },
        "west": { "texture": "#0", "uv": [12, 5, 12.75, 5.75] },
        "east": { "texture": "#0", "uv": [14.25, 5, 15, 5.75] }
      }
    },
    {
      "__comment": "Foot leg 2 (front-right)",
      "from": [13, 0, 0],
      "to": [16, 3, 3],
      "faces": {
        "down": { "texture": "#0", "uv": [13.25, 4.25, 14, 5], "cullface": "down" },
        "north": { "texture": "#0", "uv": [14, 5, 14.75, 5.75] },
        "south": { "texture": "#0", "uv": [13.25, 5, 14, 5.75] },
        "west": { "texture": "#0", "uv": [12.5, 5, 13.25, 5.75] },
        "east": { "texture": "#0", "uv": [14.75, 5, 15.5, 5.75] }
      }
    }
  ]
}
```

## Sign with Post

2 elements - board and post.

```json
{
  "name": "sign",
  "credit": "Community Recreation",
  "__comment": "Standing sign with post. Texture is 64x32 (non-square)",
  "textures": {
    "0": "entity/sign"
  },
  "__texture_info": "64x32 texture. U: 0-16 (64px), V: 0-8 (32px)",
  "elements": [
    {
      "__comment": "Sign board - 16 wide, 8 tall, 2 thick",
      "from": [0, 7, 7],
      "to": [16, 15, 9],
      "faces": {
        "north": { "texture": "#0", "uv": [0.5, 1, 6.5, 4] },
        "south": { "texture": "#0", "uv": [7, 1, 13, 4] },
        "west": { "texture": "#0", "uv": [6.5, 1, 7, 4] },
        "east": { "texture": "#0", "uv": [0, 1, 0.5, 4] },
        "up": { "texture": "#0", "uv": [0.5, 0, 6.5, 1] },
        "down": { "texture": "#0", "uv": [6.5, 0, 12.5, 1] }
      }
    },
    {
      "__comment": "Post - 2×2 wide, 7 tall",
      "from": [7, 0, 7],
      "to": [9, 7, 9],
      "faces": {
        "north": { "texture": "#0", "uv": [0.5, 4, 1, 7.5] },
        "south": { "texture": "#0", "uv": [1, 4, 1.5, 7.5] },
        "west": { "texture": "#0", "uv": [0, 4, 0.5, 7.5] },
        "east": { "texture": "#0", "uv": [1.5, 4, 2, 7.5] },
        "down": { "texture": "#0", "uv": [1, 7.5, 1.5, 8], "cullface": "down" }
      }
    }
  ]
}
```

## Shulker Box (Animated Parts)

2 overlapping elements representing closed state.

```json
{
  "name": "shulker_box",
  "credit": "Community Recreation",
  "__comment": "Shulker box closed state. Top overlaps bottom for seamless look",
  "textures": {
    "0": "entity/shulker/shulker"
  },
  "__texture_info": "64x64 texture. 16 UV units = 64px",
  "elements": [
    {
      "__comment": "Bottom shell (base) - 16×8×16",
      "from": [0, 0, 0],
      "to": [16, 8, 16],
      "faces": {
        "down": { "texture": "#0", "uv": [4, 12, 8, 16], "cullface": "down" },
        "up": { "texture": "#0", "uv": [4, 8, 8, 12] },
        "north": { "texture": "#0", "uv": [0, 14, 4, 16] },
        "south": { "texture": "#0", "uv": [8, 14, 12, 16] },
        "west": { "texture": "#0", "uv": [4, 14, 8, 16] },
        "east": { "texture": "#0", "uv": [12, 14, 16, 16] }
      }
    },
    {
      "__comment": "Top shell (lid) - 16×12×16, overlaps base",
      "from": [0, 4, 0],
      "to": [16, 16, 16],
      "faces": {
        "up": { "texture": "#0", "uv": [4, 0, 8, 4], "cullface": "up" },
        "north": { "texture": "#0", "uv": [0, 4, 4, 7] },
        "south": { "texture": "#0", "uv": [8, 4, 12, 7] },
        "west": { "texture": "#0", "uv": [4, 4, 8, 7] },
        "east": { "texture": "#0", "uv": [12, 4, 16, 7] }
      }
    }
  ]
}
```
