import { pool } from "../db/mysql.js"
import { sendToESP32Root } from "../tcp/esp32_root_server.js"

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function macDotToColon(mac) {
    return mac.replace(/\./g, ":").toUpperCase();
}
// BFS: construir árbol
function buildTree(rootMac, links) {
    const depth = {};
    const parent = {};
    const queue = [rootMac];
    depth[rootMac] = 0;
    parent[rootMac] = null;
    while (queue.length) {
        const current = queue.shift();
        links
            .filter(l => l.parent_mac === current)
            .forEach(l => {
                if (depth[l.child_mac] !== undefined) return;
                depth[l.child_mac] = depth[current] + 1;
                parent[l.child_mac] = current;
                queue.push(l.child_mac);
            });
    }
    return { depth, parent };
}
// APLICAR MESH REAL
async function applyMesh() {

    const [nodes] = await pool.query("SELECT * FROM mesh_nodes");
    const [links] = await pool.query("SELECT * FROM mesh_links");

    const root = nodes.find(n => n.role === "root");
    if (!root) {
        console.error("No root definido");
        return;
    }
    const { depth, parent } = buildTree(root.mac, links);
    const ordered = Object.keys(depth)
        .sort((a, b) => depth[a] - depth[b]);
    console.log(":: Applying mesh:", ordered);
    for (const mac of ordered) {
        if (mac === root.mac) continue;

        const node = nodes.find(n => n.mac === mac);
        const pMac = parent[mac];
        const d = depth[mac];
        // hijos directos
        const children = links
            .filter(l => l.parent_mac === mac)
            .map(l => l.child_mac)
            .join(",");

        const cmd =
            `CFG_NODE:${macDotToColon(mac)}|${node.role}|` +
            `${macDotToColon(pMac)}|${macDotToColon(pMac)}|` +
            `${d}|${children.split(",").map(macDotToColon).join(",")}`;
        sendToESP32Root(cmd);
        await sleep(300);
    }
}

export const MeshService = {
    setParent(childMac, parentMac, depth) {
        const cmd = `SET_PARENT: ${childMac}|${parentMac}|${depth}`;
        sendToESP32Root(cmd);
    },
    sendMessage(dstMac, payload) {
        const cmd = `SEND_MSG: ${dstMac}|${payload}`;
        sendToESP32Root(cmd);
    },
    sendAlert() {
        sendToESP32Root("SEND_ALERT")
    },
    setRouteTable(table) {
        const cmd = `SET_ROUTE_TABLE: ${JSON.stringify(table)}`;
        sendToESP32Root(cmd);
    },
    applyMesh
};