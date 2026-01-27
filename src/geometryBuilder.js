/**
 * Geometry Builder for Minecraft JSON models
 * Converts JSON elements to mesh geometry (vertices, normals, UVs, indices)
 */

/**
 * Face definitions with vertex indices and normals
 */
const FACE_DEFINITIONS = {
  north: { verts: [1, 0, 3, 2], normal: [0, 0, -1], uvOrder: [0, 1, 2, 3] },
  south: { verts: [4, 5, 6, 7], normal: [0, 0, 1], uvOrder: [0, 1, 2, 3] },
  east:  { verts: [5, 1, 2, 6], normal: [1, 0, 0], uvOrder: [0, 1, 2, 3] },
  west:  { verts: [0, 4, 7, 3], normal: [-1, 0, 0], uvOrder: [0, 1, 2, 3] },
  up:    { verts: [3, 7, 6, 2], normal: [0, 1, 0], uvOrder: [0, 1, 2, 3] },
  down:  { verts: [0, 1, 5, 4], normal: [0, -1, 0], uvOrder: [0, 1, 2, 3] }
};

/**
 * Build geometry from a model's elements
 * @param {Object} model - Parsed model with elements
 * @param {Object} textureAtlas - Texture atlas with UV mappings
 * @param {number} scale - Scale factor (default: 1/16 to convert to 1 unit = 1 block)
 * @returns {Object} Geometry data { positions, normals, uvs, indices }
 */
export function buildGeometry(model, textureAtlas, scale = 1/16) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  
  for (const element of model.elements) {
    buildElement(element, model, textureAtlas, scale, positions, normals, uvs, indices);
  }
  
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)
  };
}

/**
 * Build geometry for a single element
 */
function buildElement(element, model, textureAtlas, scale, positions, normals, uvs, indices) {
  const { from, to, rotation, faces } = element;
  
  if (!from || !to || !faces) return;
  
  // Create 8 vertices of the cuboid
  let vertices = [
    [from[0], from[1], from[2]], // 0: left-bottom-back (min x, min y, min z)
    [to[0],   from[1], from[2]], // 1: right-bottom-back (max x, min y, min z)
    [to[0],   to[1],   from[2]], // 2: right-top-back (max x, max y, min z)
    [from[0], to[1],   from[2]], // 3: left-top-back (min x, max y, min z)
    [from[0], from[1], to[2]],   // 4: left-bottom-front (min x, min y, max z)
    [to[0],   from[1], to[2]],   // 5: right-bottom-front (max x, min y, max z)
    [to[0],   to[1],   to[2]],   // 6: right-top-front (max x, max y, max z)
    [from[0], to[1],   to[2]],   // 7: left-top-front (min x, max y, max z)
  ];
  
  // Apply rotation if present
  if (rotation) {
    vertices = applyRotation(vertices, rotation);
  }
  
  // Scale vertices
  vertices = vertices.map(v => v.map(c => (c - 8) * scale)); // Center at origin, then scale
  
  // Build each defined face
  for (const [faceName, faceData] of Object.entries(faces)) {
    const faceDef = FACE_DEFINITIONS[faceName];
    if (!faceDef) continue;
    
    const baseIndex = positions.length / 3;
    
    // Get UV coordinates
    const uv = faceData.uv || autoGenerateUV(element, faceName);
    const atlasUV = textureAtlas.getUV(faceData.texture, uv, model.rawTextures, faceName);
    
    // Apply UV rotation if specified
    const rotatedUV = applyUVRotation(atlasUV, faceData.rotation || 0);
    
    // Add 4 vertices for this face (quad)
    for (let i = 0; i < 4; i++) {
      const vertIdx = faceDef.verts[i];
      const vertex = vertices[vertIdx];
      
      // Position
      positions.push(vertex[0], vertex[1], vertex[2]);
      
      // Normal (may need to be rotated if element has rotation)
      let normal = [...faceDef.normal];
      if (rotation) {
        normal = rotateNormal(normal, rotation);
      }
      normals.push(normal[0], normal[1], normal[2]);
      
      // UV
      const uvIdx = i;
      uvs.push(rotatedUV[uvIdx * 2], rotatedUV[uvIdx * 2 + 1]);
    }
    
    // Add indices for two triangles (quad)
    indices.push(
      baseIndex, baseIndex + 1, baseIndex + 2,
      baseIndex, baseIndex + 2, baseIndex + 3
    );
  }
}

/**
 * Apply rotation to vertices
 * @param {number[][]} vertices - Array of vertex positions
 * @param {Object} rotation - Rotation definition { origin, axis, angle }
 * @returns {number[][]} Rotated vertices
 */
function applyRotation(vertices, rotation) {
  const { origin = [8, 8, 8], axis, angle } = rotation;
  
  if (!axis || !angle) return vertices;
  
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  
  return vertices.map(vertex => {
    // Translate to origin
    const v = [
      vertex[0] - origin[0],
      vertex[1] - origin[1],
      vertex[2] - origin[2]
    ];
    
    let rotated;
    switch (axis) {
      case 'x':
        rotated = [
          v[0],
          v[1] * cos - v[2] * sin,
          v[1] * sin + v[2] * cos
        ];
        break;
      case 'y':
        rotated = [
          v[0] * cos + v[2] * sin,
          v[1],
          -v[0] * sin + v[2] * cos
        ];
        break;
      case 'z':
        rotated = [
          v[0] * cos - v[1] * sin,
          v[0] * sin + v[1] * cos,
          v[2]
        ];
        break;
      default:
        rotated = v;
    }
    
    // Translate back
    return [
      rotated[0] + origin[0],
      rotated[1] + origin[1],
      rotated[2] + origin[2]
    ];
  });
}

/**
 * Rotate a normal vector
 */
function rotateNormal(normal, rotation) {
  const { axis, angle } = rotation;
  if (!axis || !angle) return normal;
  
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  
  switch (axis) {
    case 'x':
      return [
        normal[0],
        normal[1] * cos - normal[2] * sin,
        normal[1] * sin + normal[2] * cos
      ];
    case 'y':
      return [
        normal[0] * cos + normal[2] * sin,
        normal[1],
        -normal[0] * sin + normal[2] * cos
      ];
    case 'z':
      return [
        normal[0] * cos - normal[1] * sin,
        normal[0] * sin + normal[1] * cos,
        normal[2]
      ];
    default:
      return normal;
  }
}

/**
 * Auto-generate UV coordinates based on element position
 */
function autoGenerateUV(element, faceName) {
  const { from, to } = element;
  
  switch (faceName) {
    case 'north':
    case 'south':
      return [from[0], 16 - to[1], to[0], 16 - from[1]];
    case 'east':
    case 'west':
      return [from[2], 16 - to[1], to[2], 16 - from[1]];
    case 'up':
    case 'down':
      return [from[0], from[2], to[0], to[2]];
    default:
      return [0, 0, 16, 16];
  }
}

/**
 * Apply UV rotation (0, 90, 180, 270 degrees)
 * @param {number[]} uv - UV coordinates [u1, v1, u2, v2, u3, v3, u4, v4]
 * @param {number} rotation - Rotation in degrees
 * @returns {number[]} Rotated UV coordinates
 */
function applyUVRotation(uv, rotation) {
  if (!rotation || rotation === 0) return uv;
  
  // UV is [u0,v0, u1,v1, u2,v2, u3,v3] for quad vertices
  // Rotation shifts which vertex gets which UV
  const steps = (rotation / 90) % 4;
  
  const uvPairs = [
    [uv[0], uv[1]],
    [uv[2], uv[3]],
    [uv[4], uv[5]],
    [uv[6], uv[7]]
  ];
  
  const rotated = [];
  for (let i = 0; i < 4; i++) {
    const idx = (i + steps) % 4;
    rotated.push(uvPairs[idx][0], uvPairs[idx][1]);
  }
  
  return rotated;
}

/**
 * Calculate bounding box of geometry
 * @param {Float32Array} positions - Position data
 * @returns {Object} { min: [x,y,z], max: [x,y,z] }
 */
export function calculateBounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  
  for (let i = 0; i < positions.length; i += 3) {
    min[0] = Math.min(min[0], positions[i]);
    min[1] = Math.min(min[1], positions[i + 1]);
    min[2] = Math.min(min[2], positions[i + 2]);
    max[0] = Math.max(max[0], positions[i]);
    max[1] = Math.max(max[1], positions[i + 1]);
    max[2] = Math.max(max[2], positions[i + 2]);
  }
  
  return { min, max };
}
