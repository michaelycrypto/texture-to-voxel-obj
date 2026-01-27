/**
 * GLB (Binary GLTF) Generator for pixel-based 3D models
 * Generates GLB 2.0 format compatible with Roblox
 */

/**
 * Generate GLB binary content from pixel data
 * @param {Object} options - Generation options
 * @param {string} options.modelName - Name of the model
 * @param {number} options.width - Texture width in pixels
 * @param {number} options.height - Texture height in pixels
 * @param {Uint8Array} options.pixels - RGBA pixel data
 * @param {number} options.channels - Number of channels (should be 4)
 * @param {number} options.scale - Scale factor
 * @param {string} options.coordinateSystem - 'z-up' or 'y-up'
 * @param {Buffer} options.textureData - PNG texture data (optional, for embedded texture)
 * @returns {Buffer} GLB binary content
 */
export function generateGLBFromPixels({
  modelName,
  width,
  height,
  pixels,
  channels = 4,
  scale = 1.0,
  coordinateSystem = 'z-up',
  textureData = null
}) {
  // Collect all opaque pixel positions
  const opaquePixels = [];
  const alphaThreshold = 128;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      const alpha = pixels[index + 3];
      if (alpha >= alphaThreshold) {
        opaquePixels.push({ x, y });
      }
    }
  }

  if (opaquePixels.length === 0) {
    return null;
  }

  // Calculate pixel size
  const pixelSize = scale / Math.max(width, height);
  const halfWidth = (width * pixelSize) / 2;
  const halfHeight = (height * pixelSize) / 2;
  const thickness = pixelSize * 0.5;

  // Generate mesh data
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (const pixel of opaquePixels) {
    const baseIndex = positions.length / 3;

    // Calculate pixel bounds in world space
    const left = pixel.x * pixelSize - halfWidth;
    const right = (pixel.x + 1) * pixelSize - halfWidth;
    const bottom = (height - pixel.y - 1) * pixelSize - halfHeight;
    const top = (height - pixel.y) * pixelSize - halfHeight;

    // UV coordinates for this pixel (mirrored for correct orientation)
    // In GLTF, V=0 is at top of image, V=1 is at bottom
    const uvLeft = pixel.x / width;
    const uvRight = (pixel.x + 1) / width;
    const uvTop = pixel.y / height;
    const uvBottom = (pixel.y + 1) / height;

    // GLTF uses Y-up by default, so we need to convert if using Z-up
    const addVertex = (x, y, z, nx, ny, nz, u, v) => {
      if (coordinateSystem === 'z-up') {
        // Convert Z-up to Y-up for GLTF (swap Y and Z)
        positions.push(x, z, -y);
        normals.push(nx, nz, -ny);
      } else {
        positions.push(x, y, z);
        normals.push(nx, ny, nz);
      }
      uvs.push(u, v);
    };

    // Front face (+Z in model space)
    const frontZ = thickness / 2;
    addVertex(left, bottom, frontZ, 0, 0, 1, uvLeft, uvBottom);
    addVertex(right, bottom, frontZ, 0, 0, 1, uvRight, uvBottom);
    addVertex(right, top, frontZ, 0, 0, 1, uvRight, uvTop);
    addVertex(left, top, frontZ, 0, 0, 1, uvLeft, uvTop);
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    indices.push(baseIndex, baseIndex + 2, baseIndex + 3);

    // Back face (-Z in model space)
    const backZ = -thickness / 2;
    const backBase = positions.length / 3;
    addVertex(right, bottom, backZ, 0, 0, -1, uvLeft, uvBottom);
    addVertex(left, bottom, backZ, 0, 0, -1, uvRight, uvBottom);
    addVertex(left, top, backZ, 0, 0, -1, uvRight, uvTop);
    addVertex(right, top, backZ, 0, 0, -1, uvLeft, uvTop);
    indices.push(backBase, backBase + 1, backBase + 2);
    indices.push(backBase, backBase + 2, backBase + 3);

    // Top face (+Y in model space)
    const topBase = positions.length / 3;
    addVertex(left, top, frontZ, 0, 1, 0, uvLeft, uvTop);
    addVertex(right, top, frontZ, 0, 1, 0, uvRight, uvTop);
    addVertex(right, top, backZ, 0, 1, 0, uvRight, uvTop);
    addVertex(left, top, backZ, 0, 1, 0, uvLeft, uvTop);
    indices.push(topBase, topBase + 1, topBase + 2);
    indices.push(topBase, topBase + 2, topBase + 3);

    // Bottom face (-Y in model space)
    const bottomBase = positions.length / 3;
    addVertex(left, bottom, backZ, 0, -1, 0, uvLeft, uvBottom);
    addVertex(right, bottom, backZ, 0, -1, 0, uvRight, uvBottom);
    addVertex(right, bottom, frontZ, 0, -1, 0, uvRight, uvBottom);
    addVertex(left, bottom, frontZ, 0, -1, 0, uvLeft, uvBottom);
    indices.push(bottomBase, bottomBase + 1, bottomBase + 2);
    indices.push(bottomBase, bottomBase + 2, bottomBase + 3);

    // Right face (+X in model space)
    const rightBase = positions.length / 3;
    addVertex(right, bottom, frontZ, 1, 0, 0, uvRight, uvBottom);
    addVertex(right, bottom, backZ, 1, 0, 0, uvRight, uvBottom);
    addVertex(right, top, backZ, 1, 0, 0, uvRight, uvTop);
    addVertex(right, top, frontZ, 1, 0, 0, uvRight, uvTop);
    indices.push(rightBase, rightBase + 1, rightBase + 2);
    indices.push(rightBase, rightBase + 2, rightBase + 3);

    // Left face (-X in model space)
    const leftBase = positions.length / 3;
    addVertex(left, bottom, backZ, -1, 0, 0, uvLeft, uvBottom);
    addVertex(left, bottom, frontZ, -1, 0, 0, uvLeft, uvBottom);
    addVertex(left, top, frontZ, -1, 0, 0, uvLeft, uvTop);
    addVertex(left, top, backZ, -1, 0, 0, uvLeft, uvTop);
    indices.push(leftBase, leftBase + 1, leftBase + 2);
    indices.push(leftBase, leftBase + 2, leftBase + 3);
  }

  // Calculate bounds for accessor min/max
  let minPos = [Infinity, Infinity, Infinity];
  let maxPos = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    minPos[0] = Math.min(minPos[0], positions[i]);
    minPos[1] = Math.min(minPos[1], positions[i + 1]);
    minPos[2] = Math.min(minPos[2], positions[i + 2]);
    maxPos[0] = Math.max(maxPos[0], positions[i]);
    maxPos[1] = Math.max(maxPos[1], positions[i + 1]);
    maxPos[2] = Math.max(maxPos[2], positions[i + 2]);
  }

  // Create binary buffer
  const positionBuffer = new Float32Array(positions);
  const normalBuffer = new Float32Array(normals);
  const uvBuffer = new Float32Array(uvs);
  const indexBuffer = indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);

  // Calculate buffer offsets and lengths
  const positionByteLength = positionBuffer.byteLength;
  const normalByteLength = normalBuffer.byteLength;
  const uvByteLength = uvBuffer.byteLength;
  const indexByteLength = indexBuffer.byteLength;

  // Align to 4 bytes
  const align4 = (n) => Math.ceil(n / 4) * 4;
  
  let bufferOffset = 0;
  const positionOffset = bufferOffset;
  bufferOffset += align4(positionByteLength);
  
  const normalOffset = bufferOffset;
  bufferOffset += align4(normalByteLength);
  
  const uvOffset = bufferOffset;
  bufferOffset += align4(uvByteLength);
  
  const indexOffset = bufferOffset;
  bufferOffset += align4(indexByteLength);

  let imageOffset = 0;
  let imageByteLength = 0;
  if (textureData) {
    imageOffset = bufferOffset;
    imageByteLength = textureData.length;
    bufferOffset += align4(imageByteLength);
  }

  const totalBufferLength = bufferOffset;

  // Build GLTF JSON
  // Add rotation to correct orientation when using z-up conversion
  // The z-up conversion rotates the model, so we add a compensating rotation
  // Quaternion for 90° around X axis: [sin(45°), 0, 0, cos(45°)] = [0.7071068, 0, 0, 0.7071068]
  const nodeRotation = coordinateSystem === 'z-up' 
    ? [0.7071067811865475, 0, 0, 0.7071067811865476]  // 90° around X to stand model upright
    : undefined;

  const gltf = {
    asset: {
      version: "2.0",
      generator: "texturepack-converter"
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ 
      mesh: 0, 
      name: modelName,
      ...(nodeRotation && { rotation: nodeRotation })
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
        min: minPos,
        max: maxPos
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
        componentType: indices.length > 65535 ? 5125 : 5123, // UNSIGNED_INT or UNSIGNED_SHORT
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
      }
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
      magFilter: 9728, // NEAREST
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
  Buffer.from(positionBuffer.buffer).copy(binBuffer, positionOffset);
  Buffer.from(normalBuffer.buffer).copy(binBuffer, normalOffset);
  Buffer.from(uvBuffer.buffer).copy(binBuffer, uvOffset);
  Buffer.from(indexBuffer.buffer).copy(binBuffer, indexOffset);
  if (textureData) {
    textureData.copy(binBuffer, imageOffset);
  }

  const binPaddedLength = align4(binBuffer.length);
  const binPadding = binPaddedLength - binBuffer.length;

  // GLB structure:
  // - 12 byte header
  // - JSON chunk (8 byte header + padded JSON)
  // - BIN chunk (8 byte header + padded binary)
  const totalLength = 12 + 8 + jsonPaddedLength + 8 + binPaddedLength;
  const glb = Buffer.alloc(totalLength);
  let offset = 0;

  // GLB Header
  glb.writeUInt32LE(0x46546C67, offset); // magic "glTF"
  offset += 4;
  glb.writeUInt32LE(2, offset); // version 2
  offset += 4;
  glb.writeUInt32LE(totalLength, offset); // total length
  offset += 4;

  // JSON Chunk Header
  glb.writeUInt32LE(jsonPaddedLength, offset); // chunk length
  offset += 4;
  glb.writeUInt32LE(0x4E4F534A, offset); // chunk type "JSON"
  offset += 4;

  // JSON Chunk Data
  jsonBuffer.copy(glb, offset);
  offset += jsonBuffer.length;
  // Pad with spaces (0x20)
  for (let i = 0; i < jsonPadding; i++) {
    glb.writeUInt8(0x20, offset++);
  }

  // BIN Chunk Header
  glb.writeUInt32LE(binPaddedLength, offset); // chunk length
  offset += 4;
  glb.writeUInt32LE(0x004E4942, offset); // chunk type "BIN\0"
  offset += 4;

  // BIN Chunk Data
  binBuffer.copy(glb, offset);
  offset += binBuffer.length;
  // Pad with zeros
  for (let i = 0; i < binPadding; i++) {
    glb.writeUInt8(0x00, offset++);
  }

  return glb;
}
