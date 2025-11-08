# Tessera Documentation

Welcome to the Tessera project documentation. This folder contains comprehensive documentation for building a WebGPU deep zoom renderer with advanced annotation and measurement capabilities.

## Documentation Index

### Getting Started
1. **[00-project-overview.md](./00-project-overview.md)** - Project vision, purpose, and key differentiators
2. **[12-implementation-guide.md](./12-implementation-guide.md)** - Step-by-step implementation guide and roadmap

### Core Concepts
3. **[01-core-features.md](./01-core-features.md)** - Core features (must-have) and side features (nice-to-have)
4. **[02-tech-stack.md](./02-tech-stack.md)** - Technology choices, dependencies, and browser support
5. **[03-architecture.md](./03-architecture.md)** - High-level architecture, components, and data flow

### System Design
6. **[04-modules.md](./04-modules.md)** - Detailed module breakdown and dependencies
7. **[05-components.md](./05-components.md)** - UI components and internal library components
8. **[11-folder-structure.md](./11-folder-structure.md)** - Proposed project structure and organization

### Feature Documentation
9. **[06-annotation-system.md](./06-annotation-system.md)** - Plugin-based annotation system
10. **[07-drawing-tools.md](./07-drawing-tools.md)** - Interactive drawing and editing tools
11. **[08-color-management.md](./08-color-management.md)** - Color pipeline, LUTs, and calibration
12. **[09-units-system.md](./09-units-system.md)** - Units, measurements, and calibration tools
13. **[10-plugin-system.md](./10-plugin-system.md)** - Plugin architecture and extensibility
14. **[13-webgpu-implementation-details.md](./13-webgpu-implementation-details.md)** - WebGPU-specific implementation, optimizations, and advanced features
15. **[14-package-dependencies.md](./14-package-dependencies.md)** - Package dependency graph, rules, and architecture
16. **[15-package-flow.md](./15-package-flow.md)** - How packages flow together, data flow, and runtime execution

## Quick Start

1. **New to the project?** Start with [00-project-overview.md](./00-project-overview.md)
2. **Ready to build?** Follow [12-implementation-guide.md](./12-implementation-guide.md)
3. **Need specific info?** Jump to the relevant feature documentation

## Documentation Structure

The documentation is organized into logical sections:

- **00-02**: Project foundation and overview
- **03-05**: Architecture and design
- **06-10**: Feature-specific documentation
- **11-12**: Implementation details
- **13**: WebGPU-specific implementation details

## Key Concepts

### Core Principles
- **Image-space coordinates**: All geometry stored in image pixels (zoom-invariant)
- **Plugin architecture**: Extensible annotation and tool system
- **Multi-backend rendering**: WebGPU → WebGL2 → WebGL → Canvas2D fallback
- **Color accuracy**: Linear working space, proper color management
- **Unit awareness**: Physical measurements with calibration support

### Architecture Highlights
- **Modular design**: Separate packages for different concerns
- **Framework-agnostic**: Core library works with any UI framework
- **Type-safe**: Full TypeScript support
- **Performance-focused**: Optimized rendering and caching

## Reading Order

### For Project Managers
1. Project Overview
2. Core Features
3. Implementation Guide (timeline)

### For Architects
1. Architecture
2. Modules
3. Components
4. Folder Structure

### For Developers
1. Implementation Guide
2. Feature-specific docs (as needed)
3. Plugin System (for extensibility)

## Contributing

When adding new features:
1. Update relevant feature documentation
2. Update architecture docs if structure changes
3. Add examples to implementation guide
4. Keep folder structure doc up to date

## Questions?

Refer to the specific documentation file for detailed information. Each file is self-contained but cross-references related topics.

