import * as BABYLON from "@babylonjs/core";

export class MapLayerManager {
    constructor(scene, baseMapMesh) {
        this.scene = scene;
        this.baseMap = baseMapMesh;
        this.markerLayers = new Map();
        
        // Ensure baseMap is pickable for raycasting
        this.baseMap.isPickable = true;
    }

    /**
     * Applies CPU-side vertex displacement to the terrain.
     * This physically alters the 3D geometry of the parchment, allowing
     * markers and lighting to react properly to the new hills/valleys.
     */
    applyProceduralElevation(noiseScale = 0.5, elevationMultiplier = 1.0) {
        // Generate a simple procedural sine-noise pattern across the vertices
        const positions = this.baseMap.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const indices = this.baseMap.getIndices();
        
        if (!positions) return;

        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const z = positions[i + 2];
            
            // Basic procedural multi-octave noise approximation
            let y = Math.sin(x * noiseScale) * Math.cos(z * noiseScale);
            y += Math.sin(x * noiseScale * 2.5 + 1.5) * Math.cos(z * noiseScale * 2.5) * 0.5;
            
            // Normalize and apply elevation
            // Start the base Y slightly above the table (0.02)
            positions[i + 1] = 0.02 + Math.max(0, y) * elevationMultiplier;
        }

        this.baseMap.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        
        // Recompute normals for accurate lighting/shadows on the hills
        const normals = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        this.baseMap.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
        
        this.baseMap.refreshBoundingInfo();
        this._updateAllMarkerHeights();
    }

    /**
     * Resets the terrain to a completely flat parchment surface.
     */
    flattenTerrain() {
        const positions = this.baseMap.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const indices = this.baseMap.getIndices();
        if (!positions) return;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] = 0.02; // Flat baseline
        }

        this.baseMap.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        const normals = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        this.baseMap.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
        this.baseMap.refreshBoundingInfo();
        this._updateAllMarkerHeights();
    }

    /**
     * Adds a 3D marker (e.g., a City pin or Army piece) to a specific coordinate.
     * It automatically drops onto the terrain mesh.
     */
    addMarker(layerId, markerName, x, z, material) {
        if (!this.markerLayers.has(layerId)) {
            this.markerLayers.set(layerId, []);
        }

        // Create a simple wooden/metallic pin
        const marker = BABYLON.MeshBuilder.CreateCylinder(markerName, {
            diameterTop: 0.0, 
            diameterBottom: 0.3, 
            height: 0.6, 
            tessellation: 6
        }, this.scene);
        
        marker.material = material;
        marker.position.x = x;
        marker.position.z = z;
        marker.receiveShadows = true;

        this.markerLayers.get(layerId).push(marker);
        
        // Snap it to the terrain
        this._snapToTerrain(marker);
        return marker;
    }

    _updateAllMarkerHeights() {
        this.markerLayers.forEach(layer => {
            layer.forEach(marker => {
                this._snapToTerrain(marker);
            });
        });
    }

    _snapToTerrain(mesh) {
        // Fire a ray straight down from high up to find the exact terrain height at (X, Z)
        const ray = new BABYLON.Ray(
            new BABYLON.Vector3(mesh.position.x, 10, mesh.position.z),
            new BABYLON.Vector3(0, -1, 0),
            20
        );

        const hit = this.scene.pickWithRay(ray, (m) => m === this.baseMap);
        
        if (hit && hit.hit) {
            // Offset by half the marker height so its base rests on the map
            mesh.position.y = hit.pickedPoint.y + 0.3; 
        } else {
            mesh.position.y = 0.3; // Fallback
        }
    }
}
