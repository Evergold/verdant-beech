import * as BABYLON from "@babylonjs/core";

export function buildCartographyTools(scene, shadowGenerators) {
    const tools = [];

    // --- MATERIALS ---
    const brassMat = new BABYLON.StandardMaterial("brassMat", scene);
    brassMat.diffuseColor = new BABYLON.Color3(0.8, 0.65, 0.2);
    brassMat.specularColor = new BABYLON.Color3(1, 0.9, 0.5);
    brassMat.specularPower = 32;

    const steelMat = new BABYLON.StandardMaterial("steelMat", scene);
    steelMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.75);
    steelMat.specularColor = new BABYLON.Color3(1, 1, 1);
    steelMat.specularPower = 64;

    const plasticMat = new BABYLON.StandardMaterial("plasticMat", scene);
    plasticMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    plasticMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    const woodMat = new BABYLON.StandardMaterial("woodMat", scene);
    woodMat.diffuseColor = new BABYLON.Color3(0.6, 0.4, 0.2);

    const yellowMat = new BABYLON.StandardMaterial("yellowMat", scene);
    yellowMat.diffuseColor = new BABYLON.Color3(0.9, 0.7, 0.1);

    const tapeMat = new BABYLON.StandardMaterial("tapeMat", scene);
    tapeMat.diffuseColor = new BABYLON.Color3(0.95, 0.9, 0.8);
    tapeMat.roughness = 0.9;

    // Helper to add shadows
    const addShadows = (mesh) => {
        mesh.receiveShadows = true;
        shadowGenerators.forEach(sg => sg.addShadowCaster(mesh));
        tools.push(mesh);
    };

    // 1. T-Square (Wood & Plastic edge)
    const tsArm = BABYLON.MeshBuilder.CreateBox("tsArm", {width: 14, height: 0.1, depth: 1.5}, scene);
    const tsHead = BABYLON.MeshBuilder.CreateBox("tsHead", {width: 1.5, height: 0.2, depth: 5}, scene);
    tsHead.position.x = -6.5;
    const tSquare = BABYLON.Mesh.MergeMeshes([tsArm, tsHead], true, true);
    tSquare.material = woodMat;
    tSquare.position = new BABYLON.Vector3(-10, 0.05, 14.5);
    tSquare.rotation.y = Math.PI / 16;
    addShadows(tSquare);

    // 2. Drafting Compass (Pair of compasses) - Steel & Brass
    const compArm1 = BABYLON.MeshBuilder.CreateCylinder("cArm1", {height: 5, diameter: 0.3}, scene);
    compArm1.rotation.z = Math.PI / 12;
    compArm1.position.x = -0.5;
    const compArm2 = BABYLON.MeshBuilder.CreateCylinder("cArm2", {height: 5, diameter: 0.3}, scene);
    compArm2.rotation.z = -Math.PI / 12;
    compArm2.position.x = 0.5;
    const compHinge = BABYLON.MeshBuilder.CreateSphere("cHinge", {diameter: 0.6}, scene);
    compHinge.position.y = 2.4;
    const dCompass = BABYLON.Mesh.MergeMeshes([compArm1, compArm2, compHinge], true, true);
    dCompass.material = steelMat;
    dCompass.rotation.x = Math.PI / 2; // lay flat
    dCompass.rotation.y = -Math.PI / 6;
    dCompass.position = new BABYLON.Vector3(-4, 0.15, 13.5);
    addShadows(dCompass);

    // 3. Protractor (Circular) - Brass
    const protractor = BABYLON.MeshBuilder.CreateCylinder("protractor", {height: 0.05, diameter: 4, tessellation: 64}, scene);
    protractor.material = brassMat;
    protractor.position = new BABYLON.Vector3(0, 0.025, 14);
    addShadows(protractor);

    // 4. Set Square (Triangle) - Plastic
    const triangle = BABYLON.MeshBuilder.CreateCylinder("triangle", {height: 0.05, diameter: 4, tessellation: 3}, scene);
    triangle.material = plasticMat;
    triangle.position = new BABYLON.Vector3(4, 0.025, 13.5);
    triangle.rotation.y = Math.PI / 5;
    addShadows(triangle);

    // 5. Technical Pen (Staedtler style)
    const penBody = BABYLON.MeshBuilder.CreateCylinder("penBody", {height: 4, diameter: 0.3}, scene);
    const penCap = BABYLON.MeshBuilder.CreateCylinder("penCap", {height: 1, diameter: 0.35}, scene);
    penCap.position.y = -2;
    const penTip = BABYLON.MeshBuilder.CreateCylinder("penTip", {height: 0.5, diameterTop: 0.05, diameterBottom: 0.3}, scene);
    penTip.position.y = 2.25;
    const techPen = BABYLON.Mesh.MergeMeshes([penBody, penCap, penTip], true, true);
    techPen.material = plasticMat;
    techPen.rotation.x = Math.PI / 2;
    techPen.rotation.y = Math.PI / 3;
    techPen.position = new BABYLON.Vector3(8, 0.15, 13.5);
    addShadows(techPen);

    // 6. Drafting Tape (Masking tape roll)
    const tapeCore = BABYLON.MeshBuilder.CreateTube("tapeCore", {path: [new BABYLON.Vector3(0,0,0), new BABYLON.Vector3(0,0.8,0)], radius: 1.2, thickness: 0.1}, scene);
    const tapeOuter = BABYLON.MeshBuilder.CreateTube("tapeOuter", {path: [new BABYLON.Vector3(0,0,0), new BABYLON.Vector3(0,0.8,0)], radius: 1.5, thickness: 0.3}, scene);
    const tape = BABYLON.Mesh.MergeMeshes([tapeCore, tapeOuter], true, true);
    tape.material = tapeMat;
    tape.position = new BABYLON.Vector3(12, 0, 14.5);
    addShadows(tape);

    // 7. Laser Distance Measurer (Modern Industrial Tool)
    const laserBase = BABYLON.MeshBuilder.CreateBox("laserBase", {width: 1.2, height: 0.5, depth: 3}, scene);
    const laserScreen = BABYLON.MeshBuilder.CreateBox("laserScreen", {width: 0.8, height: 0.55, depth: 1}, scene);
    laserScreen.position.z = -0.5;
    const laser = BABYLON.Mesh.MergeMeshes([laserBase, laserScreen], true, true);
    laser.material = yellowMat;
    laser.position = new BABYLON.Vector3(14.5, 0.25, 13);
    laser.rotation.y = -Math.PI / 6;
    addShadows(laser);

    return tools;
}
