/**
 * Entity GLB Generator
 * Generates GLB 2.0 binary format from parsed Minecraft JSON models
 */

import { buildGeometry, calculateBounds } from './geometryBuilder.js';

/**
 * Generate GLB binary content from a parsed model
 * @param {Object} options - Generation options
 * @param {Object} options.model - Parsed model from jsonModelLoader
 * @param {Object} options.textureAtlas - TextureAtlas instance with loaded textures
 * @param {number} options.scale - Scale factor (default: 1/16)
 * @returns {Buffer} GLB binary content
 */
export function generateEntityGLB({ model, textureAtlas, scale = 1/16 }) {
  // Build geometry
  const geometry = buildGeometry(model, textureAtlas, scale);
  
  if (geometry.positions.length === 0) {
    console.warn(`Model ${model.name} has no geometry`);
    return null;
  }
  
  // Calculate bounds
  const bounds = calculateBounds(geometry.positions);
  
  // Get texture data
  const textureData = textureAtlas.getAtlasBuffer();
  
  // Build GLB
  return buildGLB(model.name, geometry, bounds, textureData);
}

/**
 * Build GLB binary from geometry data
 */
function buildGLB(modelName, geometry, bounds, textureData) {
  const { positions, normals, uvs, indices } = geometry;
  
  // Calculate buffer sizes and offsets (4-byte aligned)
  const align4 = (n) => Math.ceil(n / 4) * 4;
  
  const positionByteLength = positions.byteLength;
  const normalByteLength = normals.byteLength;
  const uvByteLength = uvs.byteLength;
  const indexByteLength = indices.byteLength;
  const imageByteLength = textureData ? textureData.length : 0;
  
  let offset = 0;
  const positionOffset = offset;
  offset += align4(positionByteLength);
  
  const normalOffset = offset;
  offset += align4(normalByteLength);
  
  const uvOffset = offset;
  offset += align4(uvByteLength);
  
  const indexOffset = offset;
  offset += align4(indexByteLength);
  
  let imageOffset = 0;
  if (textureData) {
    imageOffset = offset;
    offset += align4(imageByteLength);
  }
  
  const totalBufferLength = offset;
  
  // Build GLTF JSON
  const gltf = {
    asset: {
      version: "2.0",
      generator: "texturepack-converter-entity"
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{
      mesh: 0,
      name: modelName
    }],
    meshes: [{
      name: modelName,
      primitives: [{
        attributes: {
          POSITION: 0,
          NORMAL: 1,
          TEXCOORD_0: 2
        },
        indices: 3,
        material: 0
      }]
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: positions.length / 3,
        type: "VEC3",
        min: bounds.min,
        max: bounds.max
      },
      {
        bufferView: 1,
        componentType: 5126, // FLOAT
        count: normals.length / 3,
        type: "VEC3"
      },
      {
        bufferView: 2,
        componentType: 5126, // FLOAT
        count: uvs.length / 2,
        type: "VEC2"
      },
      {
        bufferView: 3,
        componentType: indices instanceof Uint32Array ? 5125 : 5123, // UNSIGNED_INT or UNSIGNED_SHORT
        count: indices.length,
        type: "SCALAR"
      }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: positionOffset, byteLength: positionByteLength },
      { buffer: 0, byteOffset: normalOffset, byteLength: normalByteLength },
      { buffer: 0, byteOffset: uvOffset, byteLength: uvByteLength },
      { buffer: 0, byteOffset: indexOffset, byteLength: indexByteLength }
    ],
    buffers: [{ byteLength: totalBufferLength }],
    materials: [{
      name: `${modelName}_material`,
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1
      },
      doubleSided: true,
      alphaMode: "MASK",
      alphaCutoff: 0.5
    }]
  };
  
  // Add texture if provided
  if (textureData) {
    gltf.bufferViews.push({
      buffer: 0,
      byteOffset: imageOffset,
      byteLength: imageByteLength
    });
    gltf.images = [{
      bufferView: 4,
      mimeType: "image/png"
    }];
    gltf.textures = [{
      source: 0,
      sampler: 0
    }];
    gltf.samplers = [{
      magFilter: 9728, // NEAREST (preserve pixel art)
      minFilter: 9728, // NEAREST
      wrapS: 33071,    // CLAMP_TO_EDGE
      wrapT: 33071     // CLAMP_TO_EDGE
    }];
    gltf.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  }
  
  // Convert GLTF JSON to buffer
  const jsonString = JSON.stringify(gltf);
  const jsonBuffer = Buffer.from(jsonString, 'utf8');
  const jsonPaddedLength = align4(jsonBuffer.length);
  const jsonPadding = jsonPaddedLength - jsonBuffer.length;
  
  // Create binary buffer
  const binBuffer = Buffer.alloc(totalBufferLength);
  Buffer.from(positions.buffer).copy(binBuffer, positionOffset);
  Buffer.from(normals.buffer).copy(binBuffer, normalOffset);
  Buffer.from(uvs.buffer).copy(binBuffer, uvOffset);
  Buffer.from(indices.buffer).copy(binBuffer, indexOffset);
  if (textureData) {
    textureData.copy(binBuffer, imageOffset);
  }
  
  const binPaddedLength = align4(binBuffer.length);
  const binPadding = binPaddedLength - binBuffer.length;
  
  // Calculate total GLB size
  // 12 byte header + JSON chunk (8 byte header + padded data) + BIN chunk (8 byte header + padded data)
  const totalLength = 12 + 8 + jsonPaddedLength + 8 + binPaddedLength;
  const glb = Buffer.alloc(totalLength);
  let writeOffset = 0;
  
  // GLB Header
  glb.writeUInt32LE(0x46546C67, writeOffset); // magic "glTF"
  writeOffset += 4;
  glb.writeUInt32LE(2, writeOffset); // version 2
  writeOffset += 4;
  glb.writeUInt32LE(totalLength, writeOffset); // total length
  writeOffset += 4;
  
  // JSON Chunk Header
  glb.writeUInt32LE(jsonPaddedLength, writeOffset); // chunk length
  writeOffset += 4;
  glb.writeUInt32LE(0x4E4F534A, writeOffset); // chunk type "JSON"
  writeOffset += 4;
  
  // JSON Chunk Data
  jsonBuffer.copy(glb, writeOffset);
  writeOffset += jsonBuffer.length;
  // Pad with spaces (0x20)
  for (let i = 0; i < jsonPadding; i++) {
    glb.writeUInt8(0x20, writeOffset++);
  }
  
  // BIN Chunk Header
  glb.writeUInt32LE(binPaddedLength, writeOffset); // chunk length
  writeOffset += 4;
  glb.writeUInt32LE(0x004E4942, writeOffset); // chunk type "BIN\0"
  writeOffset += 4;
  
  // BIN Chunk Data
  binBuffer.copy(glb, writeOffset);
  writeOffset += binBuffer.length;
  // Pad with zeros
  for (let i = 0; i < binPadding; i++) {
    glb.writeUInt8(0x00, writeOffset++);
  }
  
  return glb;
}

/**
 * Generate metadata for an entity
 * @param {Object} model - Parsed model
 * @returns {Object} Metadata object
 */
export function generateEntityMetadata(model) {
  // Calculate dimensions from elements
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (const element of model.elements) {
    if (!element.from || !element.to) continue;
    minX = Math.min(minX, element.from[0], element.to[0]);
    minY = Math.min(minY, element.from[1], element.to[1]);
    minZ = Math.min(minZ, element.from[2], element.to[2]);
    maxX = Math.max(maxX, element.from[0], element.to[0]);
    maxY = Math.max(maxY, element.from[1], element.to[1]);
    maxZ = Math.max(maxZ, element.from[2], element.to[2]);
  }
  
  return {
    elements: model.elements.length,
    dimensions: {
      x: Math.round(maxX - minX),
      y: Math.round(maxY - minY),
      z: Math.round(maxZ - minZ)
    },
    assetId: null
  };
}
