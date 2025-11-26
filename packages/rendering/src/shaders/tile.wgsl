// WebGPU shader for tile rendering
// Renders textured quads for image tiles with support for:
// - View transformation (pan, zoom, rotation)
// - Multiple tiles per draw call (instanced rendering)
// - Smooth interpolation

// Uniform buffer for view transformation
struct ViewUniforms {
    // 3x3 view matrix stored as 3 vec4s (row-major)
    // [m00, m01, m02, 0]
    // [m10, m11, m12, 0]
    // [m20, m21, m22, 0]
    view_matrix_row0: vec4<f32>,
    view_matrix_row1: vec4<f32>,
    view_matrix_row2: vec4<f32>,
    // Viewport size
    viewport_size: vec2<f32>,
    // Padding for alignment
    _padding: vec2<f32>,
}

// Per-tile instance data
struct TileInstance {
    // Position in image space (imageX, imageY, width, height)
    rect: vec4<f32>,
    // UV coordinates in atlas (u0, v0, u1, v1)
    uv_rect: vec4<f32>,
    // Tile opacity (for progressive loading blending)
    opacity: f32,
    // Atlas layer index (for texture array)
    atlas_layer: f32,
    // Padding
    _padding: vec2<f32>,
}

// Vertex input
struct VertexInput {
    @builtin(vertex_index) vertex_index: u32,
    @builtin(instance_index) instance_index: u32,
}

// Vertex output / Fragment input
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) opacity: f32,
    @location(2) @interpolate(flat) atlas_layer: u32,
}

// Bindings
@group(0) @binding(0) var<uniform> view: ViewUniforms;
@group(0) @binding(1) var<storage, read> tiles: array<TileInstance>;
@group(1) @binding(0) var tile_texture: texture_2d<f32>;
@group(1) @binding(1) var tile_sampler: sampler;

// Transform a point from image space to clip space
fn image_to_clip(pos: vec2<f32>) -> vec4<f32> {
    // Apply view matrix (image -> screen)
    let m0 = view.view_matrix_row0;
    let m1 = view.view_matrix_row1;
    
    let screen_x = m0.x * pos.x + m0.y * pos.y + m0.z;
    let screen_y = m1.x * pos.x + m1.y * pos.y + m1.z;
    
    // Convert screen space to clip space
    // Screen: (0, 0) top-left, (width, height) bottom-right
    // Clip: (-1, 1) top-left, (1, -1) bottom-right
    let clip_x = (screen_x / view.viewport_size.x) * 2.0 - 1.0;
    let clip_y = 1.0 - (screen_y / view.viewport_size.y) * 2.0;
    
    return vec4<f32>(clip_x, clip_y, 0.0, 1.0);
}

// Vertex shader
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    let tile = tiles[input.instance_index];
    
    // Generate quad vertices (2 triangles, 6 vertices)
    // Vertex order: 0-1-2, 2-1-3 (two triangles)
    //   0---1
    //   | / |
    //   2---3
    var local_pos: vec2<f32>;
    var local_uv: vec2<f32>;
    
    switch (input.vertex_index) {
        case 0u: {
            local_pos = vec2<f32>(0.0, 0.0);
            local_uv = vec2<f32>(0.0, 0.0);
        }
        case 1u, 4u: {
            local_pos = vec2<f32>(1.0, 0.0);
            local_uv = vec2<f32>(1.0, 0.0);
        }
        case 2u, 3u: {
            local_pos = vec2<f32>(0.0, 1.0);
            local_uv = vec2<f32>(0.0, 1.0);
        }
        case 5u: {
            local_pos = vec2<f32>(1.0, 1.0);
            local_uv = vec2<f32>(1.0, 1.0);
        }
        default: {
            local_pos = vec2<f32>(0.0, 0.0);
            local_uv = vec2<f32>(0.0, 0.0);
        }
    }
    
    // Transform to image space
    let image_pos = vec2<f32>(
        tile.rect.x + local_pos.x * tile.rect.z,
        tile.rect.y + local_pos.y * tile.rect.w
    );
    
    // Map to atlas UV coordinates
    output.uv = vec2<f32>(
        tile.uv_rect.x + local_uv.x * (tile.uv_rect.z - tile.uv_rect.x),
        tile.uv_rect.y + local_uv.y * (tile.uv_rect.w - tile.uv_rect.y)
    );
    
    output.position = image_to_clip(image_pos);
    output.opacity = tile.opacity;
    output.atlas_layer = u32(tile.atlas_layer);
    
    return output;
}

// Fragment shader
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Sample from tile texture
    let color = textureSample(tile_texture, tile_sampler, input.uv);
    
    // Apply opacity (for progressive loading)
    return vec4<f32>(color.rgb, color.a * input.opacity);
}

// Simpler variant: Single texture per draw call (no atlas)
// This is used when atlas is not available

struct SimpleTileUniforms {
    // View matrix
    view_matrix_row0: vec4<f32>,
    view_matrix_row1: vec4<f32>,
    view_matrix_row2: vec4<f32>,
    viewport_size: vec2<f32>,
    // Tile rectangle in image space
    tile_rect: vec4<f32>,
    // Opacity
    opacity: f32,
    _padding: vec3<f32>,
}

@group(0) @binding(0) var<uniform> simple_view: SimpleTileUniforms;
@group(1) @binding(0) var simple_texture: texture_2d<f32>;
@group(1) @binding(1) var simple_sampler: sampler;

struct SimpleVertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

fn simple_image_to_clip(pos: vec2<f32>) -> vec4<f32> {
    let m0 = simple_view.view_matrix_row0;
    let m1 = simple_view.view_matrix_row1;
    
    let screen_x = m0.x * pos.x + m0.y * pos.y + m0.z;
    let screen_y = m1.x * pos.x + m1.y * pos.y + m1.z;
    
    let clip_x = (screen_x / simple_view.viewport_size.x) * 2.0 - 1.0;
    let clip_y = 1.0 - (screen_y / simple_view.viewport_size.y) * 2.0;
    
    return vec4<f32>(clip_x, clip_y, 0.0, 1.0);
}

@vertex
fn vs_simple(input: VertexInput) -> SimpleVertexOutput {
    var output: SimpleVertexOutput;
    
    var local_pos: vec2<f32>;
    var local_uv: vec2<f32>;
    
    switch (input.vertex_index) {
        case 0u: {
            local_pos = vec2<f32>(0.0, 0.0);
            local_uv = vec2<f32>(0.0, 0.0);
        }
        case 1u, 4u: {
            local_pos = vec2<f32>(1.0, 0.0);
            local_uv = vec2<f32>(1.0, 0.0);
        }
        case 2u, 3u: {
            local_pos = vec2<f32>(0.0, 1.0);
            local_uv = vec2<f32>(0.0, 1.0);
        }
        case 5u: {
            local_pos = vec2<f32>(1.0, 1.0);
            local_uv = vec2<f32>(1.0, 1.0);
        }
        default: {
            local_pos = vec2<f32>(0.0, 0.0);
            local_uv = vec2<f32>(0.0, 0.0);
        }
    }
    
    let rect = simple_view.tile_rect;
    let image_pos = vec2<f32>(
        rect.x + local_pos.x * rect.z,
        rect.y + local_pos.y * rect.w
    );
    
    output.position = simple_image_to_clip(image_pos);
    output.uv = local_uv;
    
    return output;
}

@fragment
fn fs_simple(input: SimpleVertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(simple_texture, simple_sampler, input.uv);
    return vec4<f32>(color.rgb, color.a * simple_view.opacity);
}
