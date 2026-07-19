import * as BABYLON from "@babylonjs/core";

export function buildCartographyTools(scene, shadowGenerators) {
    const tools = [];

    // --- ENHANCED PHOTOREALISTIC MATERIALS ---
    const brassMat = new BABYLON.StandardMaterial("brassMat", scene);
    brassMat.diffuseColor = new BABYLON.Color3(0.5, 0.35, 0.1);
    brassMat.specularColor = new BABYLON.Color3(1.0, 0.8, 0.4);
    brassMat.specularPower = 64;

    const steelMat = new BABYLON.StandardMaterial("steelMat", scene);
    steelMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45);
    steelMat.specularColor = new BABYLON.Color3(1, 1, 1);
    steelMat.specularPower = 128;

    const plasticMat = new BABYLON.StandardMaterial("plasticMat", scene);
    plasticMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    plasticMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    plasticMat.specularPower = 16;

    const woodMat = new BABYLON.StandardMaterial("woodMat", scene);
    woodMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.15); // Rich dark drafting wood
    woodMat.specularColor = new BABYLON.Color3(0.2, 0.15, 0.1);
    woodMat.specularPower = 8;

    const yellowMat = new BABYLON.StandardMaterial("yellowMat", scene);
    yellowMat.diffuseColor = new BABYLON.Color3(0.8, 0.6, 0.05); // Industrial yellow
    yellowMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    yellowMat.specularPower = 32;

    const tapeMat = new BABYLON.StandardMaterial("tapeMat", scene);
    tapeMat.diffuseColor = new BABYLON.Color3(0.85, 0.8, 0.7);
    tapeMat.specularColor = new BABYLON.Color3(0, 0, 0); // Matte
    tapeMat.roughness = 1.0;

    const glassMat = new BABYLON.StandardMaterial("glassMat", scene);
    glassMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    glassMat.specularColor = new BABYLON.Color3(1, 1, 1);
    glassMat.specularPower = 128;

    const addShadows = (mesh) => {
        mesh.receiveShadows = true;
        shadowGenerators.forEach(sg => sg.addShadowCaster(mesh));
        tools.push(mesh);
    };

    // 1. T-Square (Wood & Plastic edge) - Scaled down to prevent table spillover
    const tsArm = BABYLON.MeshBuilder.CreateBox("tsArm", {width: 10, height: 0.08, depth: 1.2}, scene);
    const tsHead = BABYLON.MeshBuilder.CreateBox("tsHead", {width: 1.2, height: 0.15, depth: 4}, scene);
    tsHead.position.x = -4.5;
    const tSquare = BABYLON.Mesh.MergeMeshes([tsArm, tsHead], true, true);
    tSquare.material = woodMat;
    tSquare.position = new BABYLON.Vector3(-6, 0.04, 12); // Clustered safely inside table edge
    tSquare.rotation.y = Math.PI / 24;
    addShadows(tSquare);

    // 2. Drafting Compass (Pair of compasses)
    const compArm1 = BABYLON.MeshBuilder.CreateCylinder("cArm1", {height: 4, diameter: 0.25}, scene);
    compArm1.rotation.z = Math.PI / 10;
    compArm1.position.x = -0.4;
    const compArm2 = BABYLON.MeshBuilder.CreateCylinder("cArm2", {height: 4, diameter: 0.25}, scene);
    compArm2.rotation.z = -Math.PI / 10;
    compArm2.position.x = 0.4;
    const compHinge = BABYLON.MeshBuilder.CreateSphere("cHinge", {diameter: 0.5}, scene);
    compHinge.position.y = 1.9;
    const dCompass = BABYLON.Mesh.MergeMeshes([compArm1, compArm2, compHinge], true, true);
    dCompass.material = steelMat;
    dCompass.rotation.x = Math.PI / 2;
    dCompass.rotation.y = -Math.PI / 4;
    dCompass.position = new BABYLON.Vector3(-1.5, 0.125, 11.5);
    addShadows(dCompass);

    // 3. Protractor - Machined Brass Torus Ring for realism
    const protractor = BABYLON.MeshBuilder.CreateTorus("protractor", {diameter: 3.5, thickness: 0.15, tessellation: 64}, scene);
    protractor.scaling.y = 0.3; // Flatten it into a ruler profile
    protractor.material = brassMat;
    protractor.position = new BABYLON.Vector3(2, 0.05, 12.5);
    addShadows(protractor);

    // 4. Set Square (Triangle)
    const triangle = BABYLON.MeshBuilder.CreateCylinder("triangle", {height: 0.05, diameter: 3.5, tessellation: 3}, scene);
    triangle.material = plasticMat;
    triangle.position = new BABYLON.Vector3(5.5, 0.025, 11.8);
    triangle.rotation.y = Math.PI / 6;
    addShadows(triangle);

    // 5. Technical Pen
    const penBody = BABYLON.MeshBuilder.CreateCylinder("penBody", {height: 3.5, diameter: 0.3}, scene);
    const penCap = BABYLON.MeshBuilder.CreateCylinder("penCap", {height: 0.8, diameter: 0.35}, scene);
    penCap.position.y = -1.6;
    const penTip = BABYLON.MeshBuilder.CreateCylinder("penTip", {height: 0.4, diameterTop: 0.05, diameterBottom: 0.3}, scene);
    penTip.position.y = 1.95;
    const techPen = BABYLON.Mesh.MergeMeshes([penBody, penCap, penTip], true, true);
    techPen.material = plasticMat;
    techPen.rotation.x = Math.PI / 2;
    techPen.rotation.y = Math.PI / 2.5;
    techPen.position = new BABYLON.Vector3(9, 0.15, 11.5);
    addShadows(techPen);

    // 6. Drafting Tape
    const tapeCore = BABYLON.MeshBuilder.CreateTube("tapeCore", {path: [new BABYLON.Vector3(0,0,0), new BABYLON.Vector3(0,0.6,0)], radius: 1.0, thickness: 0.05}, scene);
    const tapeOuter = BABYLON.MeshBuilder.CreateTube("tapeOuter", {path: [new BABYLON.Vector3(0,0,0), new BABYLON.Vector3(0,0.6,0)], radius: 1.25, thickness: 0.25}, scene);
    const tape = BABYLON.Mesh.MergeMeshes([tapeCore, tapeOuter], true, true);
    tape.material = tapeMat;
    tape.position = new BABYLON.Vector3(12.5, 0, 12.5);
    addShadows(tape);

    // 7. Laser Distance Measurer
    const laserBase = BABYLON.MeshBuilder.CreateBox("laserBase", {width: 1.0, height: 0.4, depth: 2.5}, scene);
    laserBase.material = yellowMat;
    const laserScreen = BABYLON.MeshBuilder.CreateBox("laserScreen", {width: 0.7, height: 0.45, depth: 0.8}, scene);
    laserScreen.position = new BABYLON.Vector3(0, 0.02, -0.4);
    laserScreen.material = glassMat;
    laserScreen.setParent(laserBase);
    laserBase.position = new BABYLON.Vector3(10.5, 0.2, 9.5);
    laserBase.rotation.y = -Math.PI / 8;
    addShadows(laserBase);
    tools.push(laserScreen);

    // 8. Scale Ruler (Triangular Prism)
    const scaleRuler = BABYLON.MeshBuilder.CreateCylinder("scaleRuler", {height: 8, diameter: 0.6, tessellation: 3}, scene);
    scaleRuler.material = plasticMat;
    scaleRuler.rotation.z = Math.PI / 2;
    scaleRuler.rotation.x = Math.PI / 6;
    scaleRuler.position = new BABYLON.Vector3(0, 0.2, 10.5);
    addShadows(scaleRuler);

    // 9. Colored Pencils (Red, Blue, Yellow)
    const createPencil = (name, color, x, z, rotY) => {
        const pMat = new BABYLON.StandardMaterial(name + "Mat", scene);
        pMat.diffuseColor = color;
        const pBody = BABYLON.MeshBuilder.CreateCylinder(name + "Body", {height: 3.5, diameter: 0.2, tessellation: 6}, scene);
        pBody.material = pMat;
        const pTip = BABYLON.MeshBuilder.CreateCylinder(name + "Tip", {height: 0.5, diameterTop: 0.0, diameterBottom: 0.2}, scene);
        pTip.position.y = 2.0;
        pTip.material = woodMat;
        const pencil = BABYLON.Mesh.MergeMeshes([pBody, pTip], true, true);
        pencil.rotation.x = Math.PI / 2;
        pencil.rotation.y = rotY;
        pencil.position = new BABYLON.Vector3(x, 0.1, z);
        addShadows(pencil);
    };
    createPencil("pencilRed", new BABYLON.Color3(0.8, 0.1, 0.1), 3.5, 9.5, Math.PI / 8);
    createPencil("pencilBlue", new BABYLON.Color3(0.1, 0.3, 0.8), 4.0, 9.3, Math.PI / 10);
    createPencil("pencilYellow", new BABYLON.Color3(0.9, 0.8, 0.1), 3.8, 9.8, Math.PI / 6);

    // 10. Staedtler Eraser (White block with blue sleeve)
    const eraserWhite = BABYLON.StandardMaterial("eraserWhite", scene);
    eraserWhite.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    const eraserBlue = BABYLON.StandardMaterial("eraserBlue", scene);
    eraserBlue.diffuseColor = new BABYLON.Color3(0.1, 0.3, 0.7);
    const erBlock = BABYLON.MeshBuilder.CreateBox("erBlock", {width: 1.5, height: 0.4, depth: 0.8}, scene);
    erBlock.material = eraserWhite;
    const erSleeve = BABYLON.MeshBuilder.CreateBox("erSleeve", {width: 0.8, height: 0.42, depth: 0.82}, scene);
    erSleeve.material = eraserBlue;
    const eraser = BABYLON.Mesh.MergeMeshes([erBlock, erSleeve], true, true);
    eraser.position = new BABYLON.Vector3(7.5, 0.2, 9.5);
    eraser.rotation.y = Math.PI / 12;
    addShadows(eraser);

    // 11. Rubber Cement Vial
    const vialMat = new BABYLON.StandardMaterial("vialMat", scene);
    vialMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    vialMat.alpha = 0.6;
    vialMat.specularPower = 128;
    const vialBody = BABYLON.MeshBuilder.CreateCylinder("vialBody", {height: 1.5, diameter: 1.2}, scene);
    vialBody.material = vialMat;
    const vialCapMat = new BABYLON.StandardMaterial("vialCapMat", scene);
    vialCapMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    const vialCap = BABYLON.MeshBuilder.CreateCylinder("vialCap", {height: 0.4, diameter: 1.25}, scene);
    vialCap.material = vialCapMat;
    vialCap.position.y = 0.95;
    const vialBrush = BABYLON.MeshBuilder.CreateCylinder("vialBrush", {height: 1.0, diameter: 0.1}, scene);
    vialBrush.position.y = 0.5;
    const cementVial = BABYLON.Mesh.MergeMeshes([vialBody, vialCap, vialBrush], true, true);
    cementVial.position = new BABYLON.Vector3(6, 0.75, 11);
    addShadows(cementVial);

    return tools;
}
