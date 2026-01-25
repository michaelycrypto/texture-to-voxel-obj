# PRD Revision Plan: Texturepack Support & Scaling

## Overview
This document outlines the planned revisions to the PRD to support texturepack structures and uniform scaling across entire texture packs.

## Changes Made to PRD

### 1. User Story & Use Case Updates
- ✅ Added texturepack structure support to primary use case
- ✅ Added uniform scaling requirement for entire texture packs
- ✅ Expanded secondary use cases to include texturepack processing

### 2. Functional Requirements Updates

#### 2.1 Input Handling (FR-1.6, FR-1.7)
- ✅ **FR-1.6**: Added texturepack structure detection
  - Automatically detect and process files in "items" folder
  - Preserve texturepack directory structure in output
- ✅ **FR-1.7**: Added texturepack-aware processing
  - Apply uniform scale to all textures in the pack
  - Scale factor applies consistently across all models

#### 2.2 Conversion Logic (FR-2.4)
- ✅ **FR-2.4**: Added texturepack-wide scaling
  - Uniform scale factor for all models in texturepack
  - Scale applies to model geometry (vertex positions)
  - All OBJ files use same scale factor for consistency

#### 2.3 Output Generation (FR-3.6)
- ✅ **FR-3.6**: Added texturepack structure output
  - Maintain "items" folder structure in output
  - All OBJ files share same scale factor

### 3. Technical Specifications Updates

#### 3.3 CLI Interface
- ✅ Added `--texturepack` flag for texturepack mode
- ✅ Updated scale option description to clarify texturepack-wide application
- ✅ Added examples for texturepack processing

### 4. Acceptance Criteria Updates
- ✅ Added requirement for "items" folder detection
- ✅ Added requirement for uniform scale application
- ✅ Added requirement for preserving texturepack structure

### 5. Notes & Assumptions Updates
- ✅ Added assumptions about texturepack structure organization
- ✅ Added assumption about uniform scaling requirements

## Implementation Considerations

### Key Features to Implement

1. **Texturepack Detection**
   - Detect if input path contains "items" folder
   - Optionally auto-detect texturepack structure
   - Support `--texturepack` flag for explicit mode

2. **Items Folder Processing**
   - When texturepack mode is enabled, focus on "items" folder
   - Process all PNG files in "items" folder
   - Preserve folder structure in output

3. **Uniform Scaling**
   - Apply same scale factor to all models in texturepack
   - Scale should be configurable via CLI or config
   - Scale applies to geometry, not texture resolution

4. **Directory Structure Preservation**
   - Maintain "items" folder in output
   - Preserve relative paths from texturepack root
   - Support nested folder structures

### Technical Implementation Points

1. **File Detection Logic**
   - Check if input path contains "items" subdirectory
   - If `--texturepack` flag is set, prioritize "items" folder
   - Fall back to standard processing if "items" folder not found

2. **Scale Application**
   - Store scale factor at texturepack level
   - Apply same scale to all `convertTexture()` calls for texturepack
   - Ensure scale is consistent across all generated OBJ files

3. **Output Path Handling**
   - Map `texturepack/items/*.png` → `output/items/*.obj`
   - Preserve relative structure from texturepack root
   - Handle both absolute and relative paths

## Testing Scenarios

1. **Texturepack with Items Folder**
   - Input: `./texturepack/items/*.png`
   - Expected: `./output/items/*.obj` with uniform scale

2. **Direct Items Folder**
   - Input: `./items/*.png`
   - Expected: `./output/*.obj` (no items folder in output)

3. **Scale Application**
   - Input: texturepack with scale=2.0
   - Expected: All OBJ files use scale=2.0 consistently

4. **Nested Structure**
   - Input: `./texturepack/items/subfolder/*.png`
   - Expected: `./output/items/subfolder/*.obj`

## Next Steps

1. Review updated PRD with stakeholders
2. Implement texturepack detection logic
3. Add `--texturepack` CLI flag
4. Update conversion logic to apply uniform scale
5. Update output path generation for texturepack structure
6. Add tests for texturepack processing scenarios
7. Update documentation and examples
