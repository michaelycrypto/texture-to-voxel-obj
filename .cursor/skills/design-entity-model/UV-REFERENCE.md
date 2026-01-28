# UV Mapping Reference

Quick reference for UV calculations and common texture layouts.

## UV Coordinate System

```
Texture Space (0-16 UV units for any texture size):

(0,0) ────────────────────► U (16)
  │
  │    ┌─────────────────┐
  │    │                 │
  │    │    Texture      │
  │    │                 │
  │    └─────────────────┘
  ▼
  V (16)
```

## Texture Size to UV Scale

| Texture Size | 1 UV Unit = | Full Texture |
|--------------|-------------|--------------|
| 16×16        | 1 pixel     | UV 0-16      |
| 32×32        | 2 pixels    | UV 0-16      |
| 64×64        | 4 pixels    | UV 0-16      |
| 64×32        | 4px (U), 2px (V) | U: 0-16, V: 0-8 |
| 128×128      | 8 pixels    | UV 0-16      |

## UV Calculation Formula

For a face with dimensions `width × height` (in model units):

```
UV width  = face_width × (16 / texture_width_in_model_units)
UV height = face_height × (16 / texture_height_in_model_units)
```

**Example**: 6×7 face on 64×64 texture (where 16 units = 64px):
- Scale factor = 16/16 = 1 (since texture maps to 16 model units)
- UV size = 6 × 7 (same as face size in this case)

## Standard Box UV Layout

For a cuboid element, UV faces unwrap in this pattern:

```
        ┌─────┐
        │ Top │
  ┌─────┼─────┼─────┬─────┐
  │West │North│ East│South│
  └─────┼─────┼─────┴─────┘
        │Bottm│
        └─────┘
```

**Unwrap order** (Minecraft/Blockbench standard):
- North face → Front
- South face → Back
- West face → Left
- East face → Right
- Up face → Top
- Down face → Bottom

## Common Entity Texture Layouts

### Chest (64×64)

```
 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16
 ┌───┬───────────────┬───────────────┐
0│Knb│               │               │
 ├───┴───────────────┼───────────────┤
1│                   │               │
 │    Lid Top        │   Lid Top     │
 │   (inside)        │   (outside)   │
4├───────────────────┼───────────────┤
 │Lid│    Lid N      │Lid│   Lid S   │
 │ W │               │ E │           │
5├───┴───────────────┼───┴───────────┤
 │                   │               │
 │   Base Top        │  Base Top     │
 │  (inside)         │  (outside)    │
8├───────────────────┼───────────────┤
 │Bas│   Base N      │Bas│  Base S   │
 │ W │               │ E │           │
11└───┴───────────────┴───┴───────────┘
```

### Bed (64×64)

```
 0   2   4   6   8  10  12  14  16
 ┌───────────────────┬──────────┐
0│                   │          │
 │   Head Top        │  Legs    │
 │                   │          │
4├───────────────────┼──────────┤
 │                   │          │
 │   Head Sides      │  Legs    │
 │                   │          │
8├───────────────────┼──────────┤
 │                   │          │
 │   Foot Top        │          │
 │                   │          │
12├───────────────────┤          │
 │                   │          │
 │   Foot Sides      │          │
16└───────────────────┴──────────┘
```

### Shulker (64×64)

```
 0   4   8  12  16
 ┌───┬───┬───┬───┐
0│   │Top│   │   │
 │   │Lid│   │   │
4├───┼───┼───┼───┤
 │ W │ N │ E │ S │  ← Lid Sides
 │   │   │   │   │
8├───┼───┼───┼───┤
 │   │Top│   │   │
 │   │Bas│   │   │
12├───┼───┼───┼───┤
 │ W │ N │ E │ S │  ← Base Sides
16└───┴───┴───┴───┘
```

### Sign (64×32)

```
 0   1   7   8  14  16
 ┌───┬─────┬─────┬──┐
0│   │Board│Board│  │
 │   │ Top │Bottm│  │ V: 0-1
1├───┼─────┼─────┼──┤
 │ E │Board│Board│  │
 │   │North│South│  │ V: 1-4
4├───┼─────┴─────┴──┤
 │Pos│              │
 │ t │              │ V: 4-8
8└───┴──────────────┘
```

## Face Direction Reference

```
          +Y (Up)
           │
           │
    +X ────┼──── -X
  (East)   │   (West)
           │
          -Y (Down)

Looking from above (+Y):
        -Z (North)
           │
    -X ────┼──── +X
  (West)   │   (East)
           │
        +Z (South)
```

## UV Rotation

Rotation values rotate the UV mapping on the face:

| Rotation | Effect |
|----------|--------|
| 0        | Default orientation |
| 90       | Rotate 90° clockwise |
| 180      | Flip upside down |
| 270      | Rotate 90° counter-clockwise |

**Common use**: `"rotation": 180` on `"up"` faces to flip texture correctly.

## UV Flipping

When `u1 > u2` or `v1 > v2`, the texture is mirrored:

```json
// Normal
"uv": [0, 0, 4, 4]

// Flipped horizontally (u1 > u2)
"uv": [4, 0, 0, 4]

// Flipped vertically (v1 > v2)
"uv": [0, 4, 4, 0]
```

## Practical UV Examples

### 14×10×14 Chest Base (64×64 texture)

Face dimensions and UV regions:

| Face | Model Size | UV Region |
|------|------------|-----------|
| North | 14×10 | `[3.5, 8.25, 7.0, 10.75]` (3.5 wide, 2.5 tall) |
| East | 14×10 | `[0.0, 8.25, 3.5, 10.75]` |
| South | 14×10 | `[10.5, 8.25, 14.0, 10.75]` |
| West | 14×10 | `[7.0, 8.25, 10.5, 10.75]` |
| Up | 14×14 | `[3.5, 4.75, 7.0, 8.25]` |
| Down | 14×14 | `[10.5, 4.75, 7.0, 8.25]` |

### 6×7×6 Lantern Body (16×16 texture)

| Face | Model Size | UV Region |
|------|------------|-----------|
| North | 6×7 | `[0, 2, 6, 9]` |
| South | 6×7 | `[0, 2, 6, 9]` (same texture) |
| Up | 6×6 | `[0, 9, 6, 15]` |
| Down | 6×6 | `[0, 9, 6, 15]` |

## Troubleshooting UV Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Stretched texture | UV size ≠ face size | Match UV dimensions to face dimensions |
| Wrong orientation | Missing rotation | Add `"rotation": 90/180/270` |
| Mirrored texture | u1/u2 or v1/v2 swapped | Check coordinate order |
| Texture offset | Wrong UV origin | Adjust start coordinates |
| Black/missing face | Invalid UV or missing texture ref | Verify `#key` exists in textures |
