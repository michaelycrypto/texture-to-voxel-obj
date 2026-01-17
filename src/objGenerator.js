import path from 'path';

/**
 * Generate a single voxel (cube) vertices, texture coordinates, and faces
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} z - Center Z position
 * @param {number} size - Size of the voxel (half-extent)
 * @param {number} vertexOffset - Starting vertex index (1-based)
 * @param {number} textureOffset - Starting texture coordinate index (1-based)
 * @param {Object} uvCoords - UV coordinates for this pixel {uMin, uMax, vMin, vMax}
 * @param {string} coordinateSystem - Coordinate system
 * @returns {{vertices: string[], textureCoords: string[], faces: string[]}}
 */
function generateVoxel(x, y, z, size, vertexOffset, textureOffset, uvCoords, coordinateSystem = 'z-up') {
  const s = size;
  let vertices;

  if (coordinateSystem === 'z-up') {
    // 8 vertices for a cube centered at (x, y, z)
    vertices = [
      `v ${x - s} ${y - s} ${z + s}`,  // Front bottom-left
      `v ${x + s} ${y - s} ${z + s}`,  // Front bottom-right
      `v ${x + s} ${y + s} ${z + s}`,  // Front top-right
      `v ${x - s} ${y + s} ${z + s}`,  // Front top-left
      `v ${x - s} ${y - s} ${z - s}`,  // Back bottom-left
      `v ${x + s} ${y - s} ${z - s}`,  // Back bottom-right
      `v ${x + s} ${y + s} ${z - s}`,  // Back top-right
      `v ${x - s} ${y + s} ${z - s}`   // Back top-left
    ];
  } else {
    // Y-up coordinate system
    vertices = [
      `v ${x - s} ${y + s} ${z - s}`,  // Front bottom-left
      `v ${x + s} ${y + s} ${z - s}`,  // Front bottom-right
      `v ${x + s} ${y + s} ${z + s}`,  // Front top-right
      `v ${x - s} ${y + s} ${z + s}`,  // Front top-left
      `v ${x - s} ${y - s} ${z - s}`,  // Back bottom-left
      `v ${x + s} ${y - s} ${z - s}`,  // Back bottom-right
      `v ${x + s} ${y - s} ${z + s}`,  // Back top-right
      `v ${x - s} ${y - s} ${z + s}`   // Back top-left
    ];
  }

  // Generate texture coordinates for this voxel (4 corners of the pixel)
  // UV coordinates: bottom-left, bottom-right, top-right, top-left
  const textureCoords = [
    `vt ${uvCoords.uMin} ${uvCoords.vMin}`,  // Bottom-left
    `vt ${uvCoords.uMax} ${uvCoords.vMin}`,  // Bottom-right
    `vt ${uvCoords.uMax} ${uvCoords.vMax}`,  // Top-right
    `vt ${uvCoords.uMin} ${uvCoords.vMax}`   // Top-left
  ];

  // Faces for a cube (6 faces, 2 triangles each)
  // Using relative vertex and texture indices
  const baseIdx = vertexOffset;
  const baseTexIdx = textureOffset;
  const faces = [
    // Front face (with texture)
    `f ${baseIdx}/${baseTexIdx}/1 ${baseIdx + 1}/${baseTexIdx + 1}/1 ${baseIdx + 2}/${baseTexIdx + 2}/1`,
    `f ${baseIdx}/${baseTexIdx}/1 ${baseIdx + 2}/${baseTexIdx + 2}/1 ${baseIdx + 3}/${baseTexIdx + 3}/1`,
    // Back face (with texture, flipped)
    `f ${baseIdx + 5}/${baseTexIdx + 1}/2 ${baseIdx + 4}/${baseTexIdx}/2 ${baseIdx + 7}/${baseTexIdx + 3}/2`,
    `f ${baseIdx + 5}/${baseTexIdx + 1}/2 ${baseIdx + 7}/${baseTexIdx + 3}/2 ${baseIdx + 6}/${baseTexIdx + 2}/2`,
    // Top face (no texture on sides, reuse coords)
    `f ${baseIdx + 3}/${baseTexIdx + 3}/3 ${baseIdx + 2}/${baseTexIdx + 2}/3 ${baseIdx + 6}/${baseTexIdx + 2}/3`,
    `f ${baseIdx + 3}/${baseTexIdx + 3}/3 ${baseIdx + 6}/${baseTexIdx + 2}/3 ${baseIdx + 7}/${baseTexIdx + 1}/3`,
    // Bottom face
    `f ${baseIdx}/${baseTexIdx}/4 ${baseIdx + 4}/${baseTexIdx + 3}/4 ${baseIdx + 5}/${baseTexIdx + 2}/4`,
    `f ${baseIdx}/${baseTexIdx}/4 ${baseIdx + 5}/${baseTexIdx + 2}/4 ${baseIdx + 1}/${baseTexIdx + 1}/4`,
    // Right face
    `f ${baseIdx + 1}/${baseTexIdx + 1}/5 ${baseIdx + 5}/${baseTexIdx}/5 ${baseIdx + 6}/${baseTexIdx + 3}/5`,
    `f ${baseIdx + 1}/${baseTexIdx + 1}/5 ${baseIdx + 6}/${baseTexIdx + 3}/5 ${baseIdx + 2}/${baseTexIdx + 2}/5`,
    // Left face
    `f ${baseIdx + 4}/${baseTexIdx + 1}/6 ${baseIdx}/${baseTexIdx}/6 ${baseIdx + 3}/${baseTexIdx + 3}/6`,
    `f ${baseIdx + 4}/${baseTexIdx + 1}/6 ${baseIdx + 3}/${baseTexIdx + 3}/6 ${baseIdx + 7}/${baseTexIdx + 2}/6`
  ];

  return { vertices, textureCoords, faces };
}

/**
 * Generate OBJ file content from pixel data (voxel-based extrusion)
 * @param {Object} options - Generation options
 * @param {string} options.materialName - Name of the material
 * @param {string} options.mtlFileName - Name of the MTL file
 * @param {number} options.width - Texture width in pixels
 * @param {number} options.height - Texture height in pixels
 * @param {Uint8Array} options.pixels - Pixel data (RGBA format)
 * @param {number} options.channels - Number of channels (4 for RGBA)
 * @param {number} options.scale - Scale factor
 * @param {string} options.coordinateSystem - Coordinate system ('z-up' or 'y-up')
 * @returns {string} OBJ file content
 */
export function generateOBJFromPixels({
  materialName,
  mtlFileName,
  width,
  height,
  pixels,
  channels = 4,
  scale = 1.0,
  coordinateSystem = 'z-up'
}) {
  // Calculate pixel size in units
  // For a 16x16 texture with scale=1.0: pixelSize = 1.0/16 = 0.0625
  const pixelSize = scale / width;
  const halfPixel = pixelSize / 2;
  const depth = pixelSize; // 1 pixel deep

  // Center offset to center the model at origin
  const centerX = -scale / 2;
  const centerY = -scale / 2;

  // Collect all voxels
  const allVertices = [];
  const allTextureCoords = [];
  const allFaces = [];
  let vertexIndex = 1; // OBJ uses 1-based indexing
  let textureIndex = 1; // OBJ uses 1-based indexing

  // Vertex normals (same for all voxels)
  const normals = coordinateSystem === 'z-up' ? [
    'vn 0.0 0.0 1.0',   // 1: Front face (+Z)
    'vn 0.0 0.0 -1.0',  // 2: Back face (-Z)
    'vn 0.0 1.0 0.0',   // 3: Top face (+Y)
    'vn 0.0 -1.0 0.0',  // 4: Bottom face (-Y)
    'vn 1.0 0.0 0.0',   // 5: Right face (+X)
    'vn -1.0 0.0 0.0'   // 6: Left face (-X)
  ] : [
    'vn 0.0 1.0 0.0',   // 1: Front face (+Y)
    'vn 0.0 -1.0 0.0',  // 2: Back face (-Y)
    'vn 0.0 0.0 1.0',   // 3: Top face (+Z)
    'vn 0.0 0.0 -1.0',  // 4: Bottom face (-Z)
    'vn 1.0 0.0 0.0',   // 5: Right face (+X)
    'vn -1.0 0.0 0.0'   // 6: Left face (-X)
  ];

  // Note: We check alpha directly here instead of importing to avoid circular dependency

  // Process each pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Check if pixel is opaque (alpha >= 128)
      const index = (y * width + x) * channels;
      const alpha = pixels[index + 3];

      if (alpha >= 128) { // Opaque pixel
        // Calculate pixel center position
        // Flip Y coordinate (texture Y=0 is top, but we want Y=0 at bottom)
        const pixelX = centerX + (x + 0.5) * pixelSize;
        const pixelY = centerY + (height - y - 0.5) * pixelSize;
        const pixelZ = 0; // Centered on Z axis (depth extends from -halfPixel to +halfPixel)

        // Calculate UV coordinates for this pixel
        // In texture coordinates: u goes 0-1 left to right, v goes 0-1 bottom to top
        // Pixel at (x, y) where y=0 is top of image
        // UV: u = x/width to (x+1)/width, v = (height-1-y)/height to (height-y)/height
        const uMin = x / width;
        const uMax = (x + 1) / width;
        const vMin = (height - 1 - y) / height; // Bottom of pixel in UV space
        const vMax = (height - y) / height;     // Top of pixel in UV space

        // Generate voxel at this pixel position with correct UV mapping
        const voxel = generateVoxel(
          pixelX,
          pixelY,
          pixelZ,
          halfPixel,
          vertexIndex,
          textureIndex,
          { uMin, uMax, vMin, vMax },
          coordinateSystem
        );

        allVertices.push(...voxel.vertices);
        allTextureCoords.push(...voxel.textureCoords);
        allFaces.push(...voxel.faces);

        vertexIndex += 8; // Each voxel has 8 vertices
        textureIndex += 4; // Each voxel has 4 texture coordinates
      }
    }
  }

  // Build OBJ content
  const voxelCount = (vertexIndex - 1) / 8; // Total number of voxels generated
  const lines = [
    `# OBJ file generated by texturepack-converter`,
    `# Voxel-based 3D geometry from pixel data`,
    `# Material library`,
    `mtllib ${mtlFileName}`,
    ``,
    `# Vertices (${allVertices.length} vertices from ${voxelCount} voxels)`,
    ...allVertices,
    ``,
    `# Texture coordinates (${allTextureCoords.length} texture coordinates)`,
    ...allTextureCoords,
    ``,
    `# Vertex normals`,
    ...normals,
    ``,
    `# Material`,
    `usemtl ${materialName}`,
    ``,
    `# Faces`,
    ...allFaces,
    ``
  ];

  return lines.join('\n');
}

/**
 * Generate OBJ file content for a 3D box (card with thickness) - DEPRECATED
 * Kept for backward compatibility, but should use generateOBJFromPixels instead
 * @param {Object} options - Generation options
 * @param {string} options.materialName - Name of the material
 * @param {string} options.mtlFileName - Name of the MTL file
 * @param {number} options.scale - Scale factor for the box
 * @param {number} options.thickness - Thickness/depth of the box (default: 0.1)
 * @param {string} options.coordinateSystem - Coordinate system ('z-up' or 'y-up')
 * @returns {string} OBJ file content
 */
export function generateOBJ({ materialName, mtlFileName, scale = 1.0, thickness = 0.1, coordinateSystem = 'z-up' }) {
  const s = scale / 2; // Half scale for centering
  const t = thickness / 2; // Half thickness for centering

  // Generate 8 vertices for a 3D box
  let vertices;
  if (coordinateSystem === 'z-up') {
    // Z-up: box in XY plane, extending along Z axis
    // Front face (facing +Z)
    vertices = [
      `v ${-s} ${-s} ${t}`,   // 1: Front bottom-left
      `v ${s} ${-s} ${t}`,    // 2: Front bottom-right
      `v ${s} ${s} ${t}`,     // 3: Front top-right
      `v ${-s} ${s} ${t}`,    // 4: Front top-left
      // Back face (facing -Z)
      `v ${-s} ${-s} ${-t}`,  // 5: Back bottom-left
      `v ${s} ${-s} ${-t}`,   // 6: Back bottom-right
      `v ${s} ${s} ${-t}`,    // 7: Back top-right
      `v ${-s} ${s} ${-t}`    // 8: Back top-left
    ];
  } else {
    // Y-up: box in XZ plane, extending along Y axis
    // Front face (facing +Y)
    vertices = [
      `v ${-s} ${t} ${-s}`,   // 1: Front bottom-left
      `v ${s} ${t} ${-s}`,    // 2: Front bottom-right
      `v ${s} ${t} ${s}`,     // 3: Front top-right
      `v ${-s} ${t} ${s}`,    // 4: Front top-left
      // Back face (facing -Y)
      `v ${-s} ${-t} ${-s}`,  // 5: Back bottom-left
      `v ${s} ${-t} ${-s}`,   // 6: Back bottom-right
      `v ${s} ${-t} ${s}`,    // 7: Back top-right
      `v ${-s} ${-t} ${s}`    // 8: Back top-left
    ];
  }

  // Texture coordinates (UV mapping) - used for front and back faces
  const textureCoords = [
    'vt 0.0 0.0',  // Bottom-left
    'vt 1.0 0.0',  // Bottom-right
    'vt 1.0 1.0',  // Top-right
    'vt 0.0 1.0'   // Top-left
  ];

  // Vertex normals for all 6 faces
  let normals;
  if (coordinateSystem === 'z-up') {
    normals = [
      'vn 0.0 0.0 1.0',   // 1: Front face (+Z)
      'vn 0.0 0.0 -1.0',  // 2: Back face (-Z)
      'vn 0.0 1.0 0.0',   // 3: Top face (+Y)
      'vn 0.0 -1.0 0.0',  // 4: Bottom face (-Y)
      'vn 1.0 0.0 0.0',   // 5: Right face (+X)
      'vn -1.0 0.0 0.0'   // 6: Left face (-X)
    ];
  } else {
    normals = [
      'vn 0.0 1.0 0.0',   // 1: Front face (+Y)
      'vn 0.0 -1.0 0.0',  // 2: Back face (-Y)
      'vn 0.0 0.0 1.0',   // 3: Top face (+Z)
      'vn 0.0 0.0 -1.0',  // 4: Bottom face (-Z)
      'vn 1.0 0.0 0.0',   // 5: Right face (+X)
      'vn -1.0 0.0 0.0'   // 6: Left face (-X)
    ];
  }

  // Face definitions for a box (6 faces, each with 2 triangles)
  // OBJ uses 1-based indexing: vertex/texture/normal
  let faces;
  if (coordinateSystem === 'z-up') {
    faces = [
      // Front face (facing +Z) - with texture
      `f 1/1/1 2/2/1 3/3/1`,
      `f 1/1/1 3/3/1 4/4/1`,
      // Back face (facing -Z) - with texture (flipped)
      `f 6/2/2 5/1/2 8/4/2`,
      `f 6/2/2 8/4/2 7/3/2`,
      // Top face (facing +Y)
      `f 4/4/3 3/3/3 7/2/3`,
      `f 4/4/3 7/2/3 8/1/3`,
      // Bottom face (facing -Y)
      `f 1/1/4 5/4/4 6/3/4`,
      `f 1/1/4 6/3/4 2/2/4`,
      // Right face (facing +X)
      `f 2/2/5 6/1/5 7/4/5`,
      `f 2/2/5 7/4/5 3/3/5`,
      // Left face (facing -X)
      `f 5/2/6 1/1/6 4/4/6`,
      `f 5/2/6 4/4/6 8/3/6`
    ];
  } else {
    faces = [
      // Front face (facing +Y) - with texture
      `f 1/1/1 2/2/1 3/3/1`,
      `f 1/1/1 3/3/1 4/4/1`,
      // Back face (facing -Y) - with texture (flipped)
      `f 6/2/2 5/1/2 8/4/2`,
      `f 6/2/2 8/4/2 7/3/2`,
      // Top face (facing +Z)
      `f 4/4/3 3/3/3 7/2/3`,
      `f 4/4/3 7/2/3 8/1/3`,
      // Bottom face (facing -Z)
      `f 1/1/4 5/4/4 6/3/4`,
      `f 1/1/4 6/3/4 2/2/4`,
      // Right face (facing +X)
      `f 2/2/5 6/1/5 7/4/5`,
      `f 2/2/5 7/4/5 3/3/5`,
      // Left face (facing -X)
      `f 5/2/6 1/1/6 4/4/6`,
      `f 5/2/6 4/4/6 8/3/6`
    ];
  }

  // Build OBJ content
  const lines = [
    `# OBJ file generated by texturepack-converter`,
    `# 3D box geometry with thickness`,
    `# Material library`,
    `mtllib ${mtlFileName}`,
    ``,
    `# Vertices (8 vertices for 3D box)`,
    ...vertices,
    ``,
    `# Texture coordinates`,
    ...textureCoords,
    ``,
    `# Vertex normals`,
    ...normals,
    ``,
    `# Material`,
    `usemtl ${materialName}`,
    ``,
    `# Faces (6 faces: front, back, top, bottom, left, right)`,
    ...faces,
    ``
  ];

  return lines.join('\n');
}

/**
 * Generate MTL (Material Template Library) file content
 * @param {Object} options - Generation options
 * @param {string} options.materialName - Name of the material
 * @param {string} options.texturePath - Path to the texture file (relative to MTL file)
 * @returns {string} MTL file content
 */
export function generateMTL({ materialName, texturePath }) {
  const lines = [
    `# MTL file generated by texturepack-converter`,
    `newmtl ${materialName}`,
    `Ka 1.000 1.000 1.000`,  // Ambient color (white)
    `Kd 1.000 1.000 1.000`,  // Diffuse color (white)
    `Ks 0.000 0.000 0.000`,  // Specular color (black, no specular)
    `Ns 0.000`,              // Shininess (0 = no specular highlight)
    `d 1.0`,                 // Dissolve (opacity, 1.0 = fully opaque)
    `illum 1`,               // Illumination model (1 = flat)
    `map_Kd ${texturePath}`  // Diffuse texture map
  ];

  return lines.join('\n');
}
