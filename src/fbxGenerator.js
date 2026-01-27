/**
 * FBX ASCII Generator for pixel-based 3D models
 * Generates FBX 7.4 ASCII format compatible with Roblox
 */

/**
 * Generate a unique ID for FBX objects
 */
let fbxIdCounter = 1000000000;
function generateFbxId() {
  return fbxIdCounter++;
}

/**
 * Reset ID counter (call between files to keep IDs reasonable)
 */
export function resetFbxIdCounter() {
  fbxIdCounter = 1000000000;
}

/**
 * Generate FBX ASCII content from pixel data
 * @param {Object} options - Generation options
 * @param {string} options.modelName - Name of the model
 * @param {string} options.texturePath - Relative path to texture file
 * @param {number} options.width - Texture width in pixels
 * @param {number} options.height - Texture height in pixels
 * @param {Uint8Array} options.pixels - RGBA pixel data
 * @param {number} options.channels - Number of channels (should be 4)
 * @param {number} options.scale - Scale factor
 * @param {string} options.coordinateSystem - 'z-up' or 'y-up'
 * @returns {string} FBX ASCII content
 */
export function generateFBXFromPixels({
  modelName,
  texturePath,
  width,
  height,
  pixels,
  channels = 4,
  scale = 1.0,
  coordinateSystem = 'z-up'
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

  // Generate vertices and faces for all opaque pixels
  const vertices = [];
  const uvs = [];
  const faces = [];
  const uvIndices = [];

  for (const pixel of opaquePixels) {
    const baseVertexIndex = vertices.length / 3;
    const baseUvIndex = uvs.length / 2;

    // Calculate pixel bounds in world space
    const left = pixel.x * pixelSize - halfWidth;
    const right = (pixel.x + 1) * pixelSize - halfWidth;
    const top = (height - pixel.y) * pixelSize - halfHeight;
    const bottom = (height - pixel.y - 1) * pixelSize - halfHeight;

    // UV coordinates for this pixel
    const uvLeft = pixel.x / width;
    const uvRight = (pixel.x + 1) / width;
    const uvTop = 1 - pixel.y / height;
    const uvBottom = 1 - (pixel.y + 1) / height;

    // Add 8 vertices for the voxel (box)
    if (coordinateSystem === 'z-up') {
      // Front face (z = thickness/2)
      vertices.push(left, bottom, thickness / 2);   // 0
      vertices.push(right, bottom, thickness / 2);  // 1
      vertices.push(right, top, thickness / 2);     // 2
      vertices.push(left, top, thickness / 2);      // 3
      // Back face (z = -thickness/2)
      vertices.push(left, bottom, -thickness / 2);  // 4
      vertices.push(right, bottom, -thickness / 2); // 5
      vertices.push(right, top, -thickness / 2);    // 6
      vertices.push(left, top, -thickness / 2);     // 7
    } else {
      // Y-up coordinate system
      vertices.push(left, top, thickness / 2);      // 0
      vertices.push(right, top, thickness / 2);     // 1
      vertices.push(right, bottom, thickness / 2);  // 2
      vertices.push(left, bottom, thickness / 2);   // 3
      vertices.push(left, top, -thickness / 2);     // 4
      vertices.push(right, top, -thickness / 2);    // 5
      vertices.push(right, bottom, -thickness / 2); // 6
      vertices.push(left, bottom, -thickness / 2);  // 7
    }

    // UVs for each face (4 UVs per face, 6 faces)
    // Front and back use the texture
    uvs.push(uvLeft, uvBottom);  // 0
    uvs.push(uvRight, uvBottom); // 1
    uvs.push(uvRight, uvTop);    // 2
    uvs.push(uvLeft, uvTop);     // 3
    // For sides, use edge UVs
    uvs.push(uvLeft, uvBottom);  // 4
    uvs.push(uvRight, uvBottom); // 5
    uvs.push(uvRight, uvTop);    // 6
    uvs.push(uvLeft, uvTop);     // 7

    const v = baseVertexIndex;
    const u = baseUvIndex;

    // Front face
    faces.push(v + 0, v + 1, v + 2, v + 3);
    uvIndices.push(u + 0, u + 1, u + 2, u + 3);

    // Back face
    faces.push(v + 5, v + 4, v + 7, v + 6);
    uvIndices.push(u + 1, u + 0, u + 3, u + 2);

    // Top face
    faces.push(v + 3, v + 2, v + 6, v + 7);
    uvIndices.push(u + 3, u + 2, u + 6, u + 7);

    // Bottom face
    faces.push(v + 4, v + 5, v + 1, v + 0);
    uvIndices.push(u + 4, u + 5, u + 1, u + 0);

    // Right face
    faces.push(v + 1, v + 5, v + 6, v + 2);
    uvIndices.push(u + 1, u + 5, u + 6, u + 2);

    // Left face
    faces.push(v + 4, v + 0, v + 3, v + 7);
    uvIndices.push(u + 0, u + 4, u + 7, u + 3);
  }

  // Generate FBX IDs
  const geometryId = generateFbxId();
  const modelId = generateFbxId();
  const materialId = generateFbxId();
  const textureId = generateFbxId();
  const videoId = generateFbxId();

  // Build FBX ASCII content
  let fbx = '';

  // FBX Header
  fbx += `; FBX 7.4.0 project file
; Generated by texturepack-converter
; ----------------------------------------------------

FBXHeaderExtension:  {
\tFBXHeaderVersion: 1003
\tFBXVersion: 7400
\tCreationTimeStamp:  {
\t\tVersion: 1000
\t\tYear: 2024
\t\tMonth: 1
\t\tDay: 1
\t\tHour: 0
\t\tMinute: 0
\t\tSecond: 0
\t\tMillisecond: 0
\t}
\tCreator: "texturepack-converter"
}

GlobalSettings:  {
\tVersion: 1000
\tProperties70:  {
\t\tP: "UpAxis", "int", "Integer", "",${coordinateSystem === 'z-up' ? '2' : '1'}
\t\tP: "UpAxisSign", "int", "Integer", "",1
\t\tP: "FrontAxis", "int", "Integer", "",${coordinateSystem === 'z-up' ? '1' : '2'}
\t\tP: "FrontAxisSign", "int", "Integer", "",1
\t\tP: "CoordAxis", "int", "Integer", "",0
\t\tP: "CoordAxisSign", "int", "Integer", "",1
\t\tP: "OriginalUpAxis", "int", "Integer", "",-1
\t\tP: "OriginalUpAxisSign", "int", "Integer", "",1
\t\tP: "UnitScaleFactor", "double", "Number", "",1
\t}
}

; Documents Description
Documents:  {
\tCount: 1
\tDocument: 1000000000, "", "Scene" {
\t\tProperties70:  {
\t\t\tP: "SourceObject", "object", "", ""
\t\t\tP: "ActiveAnimStackName", "KString", "", "", ""
\t\t}
\t\tRootNode: 0
\t}
}

; Object definitions
Definitions:  {
\tVersion: 100
\tCount: 5
\tObjectType: "GlobalSettings" {
\t\tCount: 1
\t}
\tObjectType: "Geometry" {
\t\tCount: 1
\t\tPropertyTemplate: "FbxMesh" {
\t\t\tProperties70:  {
\t\t\t}
\t\t}
\t}
\tObjectType: "Model" {
\t\tCount: 1
\t\tPropertyTemplate: "FbxNode" {
\t\t\tProperties70:  {
\t\t\t}
\t\t}
\t}
\tObjectType: "Material" {
\t\tCount: 1
\t\tPropertyTemplate: "FbxSurfaceLambert" {
\t\t\tProperties70:  {
\t\t\t}
\t\t}
\t}
\tObjectType: "Texture" {
\t\tCount: 1
\t\tPropertyTemplate: "FbxFileTexture" {
\t\t\tProperties70:  {
\t\t\t}
\t\t}
\t}
\tObjectType: "Video" {
\t\tCount: 1
\t\tPropertyTemplate: "FbxVideo" {
\t\t\tProperties70:  {
\t\t\t}
\t\t}
\t}
}

; Object properties
Objects:  {
`;

  // Geometry
  fbx += `\tGeometry: ${geometryId}, "Geometry::${modelName}", "Mesh" {
\t\tVertices: *${vertices.length} {
\t\t\ta: ${vertices.join(',')}
\t\t}
\t\tPolygonVertexIndex: *${faces.length} {
\t\t\ta: `;

  // Convert quad indices to FBX format (negative index marks end of polygon)
  const polygonIndices = [];
  for (let i = 0; i < faces.length; i += 4) {
    polygonIndices.push(faces[i], faces[i + 1], faces[i + 2], -(faces[i + 3] + 1));
  }
  fbx += polygonIndices.join(',');

  fbx += `
\t\t}
\t\tGeometryVersion: 124
\t\tLayerElementNormal: 0 {
\t\t\tVersion: 102
\t\t\tName: ""
\t\t\tMappingInformationType: "ByPolygonVertex"
\t\t\tReferenceInformationType: "Direct"
\t\t\tNormals: *${faces.length * 3} {
\t\t\t\ta: `;

  // Generate normals (simplified - all faces get appropriate normals)
  const normals = [];
  for (let i = 0; i < faces.length / 4; i++) {
    const faceType = i % 6;
    let nx = 0, ny = 0, nz = 0;
    if (coordinateSystem === 'z-up') {
      switch (faceType) {
        case 0: nz = 1; break;  // Front
        case 1: nz = -1; break; // Back
        case 2: ny = 1; break;  // Top
        case 3: ny = -1; break; // Bottom
        case 4: nx = 1; break;  // Right
        case 5: nx = -1; break; // Left
      }
    } else {
      switch (faceType) {
        case 0: nz = 1; break;  // Front
        case 1: nz = -1; break; // Back
        case 2: ny = 1; break;  // Top
        case 3: ny = -1; break; // Bottom
        case 4: nx = 1; break;  // Right
        case 5: nx = -1; break; // Left
      }
    }
    // 4 vertices per face
    for (let j = 0; j < 4; j++) {
      normals.push(nx, ny, nz);
    }
  }
  fbx += normals.join(',');

  fbx += `
\t\t\t}
\t\t}
\t\tLayerElementUV: 0 {
\t\t\tVersion: 101
\t\t\tName: "UVMap"
\t\t\tMappingInformationType: "ByPolygonVertex"
\t\t\tReferenceInformationType: "IndexToDirect"
\t\t\tUV: *${uvs.length} {
\t\t\t\ta: ${uvs.join(',')}
\t\t\t}
\t\t\tUVIndex: *${uvIndices.length} {
\t\t\t\ta: ${uvIndices.join(',')}
\t\t\t}
\t\t}
\t\tLayerElementMaterial: 0 {
\t\t\tVersion: 101
\t\t\tName: ""
\t\t\tMappingInformationType: "AllSame"
\t\t\tReferenceInformationType: "IndexToDirect"
\t\t\tMaterials: *1 {
\t\t\t\ta: 0
\t\t\t}
\t\t}
\t\tLayer: 0 {
\t\t\tVersion: 100
\t\t\tLayerElement:  {
\t\t\t\tType: "LayerElementNormal"
\t\t\t\tTypedIndex: 0
\t\t\t}
\t\t\tLayerElement:  {
\t\t\t\tType: "LayerElementMaterial"
\t\t\t\tTypedIndex: 0
\t\t\t}
\t\t\tLayerElement:  {
\t\t\t\tType: "LayerElementUV"
\t\t\t\tTypedIndex: 0
\t\t\t}
\t\t}
\t}
`;

  // Model
  fbx += `\tModel: ${modelId}, "Model::${modelName}", "Mesh" {
\t\tVersion: 232
\t\tProperties70:  {
\t\t\tP: "ScalingMax", "Vector3D", "Vector", "",0,0,0
\t\t\tP: "DefaultAttributeIndex", "int", "Integer", "",0
\t\t}
\t\tShading: T
\t\tCulling: "CullingOff"
\t}
`;

  // Material
  fbx += `\tMaterial: ${materialId}, "Material::${modelName}_mat", "" {
\t\tVersion: 102
\t\tShadingModel: "lambert"
\t\tMultiLayer: 0
\t\tProperties70:  {
\t\t\tP: "DiffuseColor", "Color", "", "A",1,1,1
\t\t\tP: "Emissive", "Vector3D", "Vector", "",0,0,0
\t\t\tP: "Ambient", "Vector3D", "Vector", "",0.2,0.2,0.2
\t\t\tP: "Diffuse", "Vector3D", "Vector", "",1,1,1
\t\t\tP: "Opacity", "double", "Number", "",1
\t\t}
\t}
`;

  // Texture
  fbx += `\tTexture: ${textureId}, "Texture::${modelName}_tex", "" {
\t\tType: "TextureVideoClip"
\t\tVersion: 202
\t\tTextureName: "Texture::${modelName}_tex"
\t\tMedia: "Video::${modelName}_video"
\t\tFileName: "${texturePath}"
\t\tRelativeFilename: "${texturePath}"
\t\tProperties70:  {
\t\t\tP: "UseMaterial", "bool", "", "",1
\t\t}
\t}
`;

  // Video (texture source)
  fbx += `\tVideo: ${videoId}, "Video::${modelName}_video", "Clip" {
\t\tType: "Clip"
\t\tProperties70:  {
\t\t\tP: "Path", "KString", "XRefUrl", "", "${texturePath}"
\t\t}
\t\tFileName: "${texturePath}"
\t\tRelativeFilename: "${texturePath}"
\t}
}

; Object connections
Connections:  {
\tC: "OO",${modelId},0
\tC: "OO",${geometryId},${modelId}
\tC: "OO",${materialId},${modelId}
\tC: "OP",${textureId},${materialId}, "DiffuseColor"
\tC: "OO",${videoId},${textureId}
}
`;

  return fbx;
}
