/* --- ELEMENTOS BÁSICOS --- */
const board = document.getElementById('board');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let nodes = [];
let connections = [];
let draggedNode = null;
let connectingFrom = null;
let offsetX, offsetY;
let nodeIdCounter = 0;

/* --- TIPOS DE CONEXÕES (DO JS #1) --- */
const connectionTypes = {
    'positive_reinforcement': { name: 'Reforço Positivo', color: '#10b981' },
    'negative_reinforcement': { name: 'Reforço Negativo', color: '#3b82f6' },
    'positive_punishment': { name: 'Punição Positiva', color: '#ef4444' },
    'negative_punishment': { name: 'Punição Negativa', color: '#f97316' },
    'other': { name: 'Outro', color: '#8b5cf6' }
};

/* --- ZOOM E PAN (DO JS #2) --- */
let scale = 1;
let translateX = 0;
let translateY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

/* --- RESPONSIVE CANVAS --- */
function resizeCanvas() {
    const container = document.querySelector('.container.app');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    drawConnections();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* --- APLICAR TRANSFORMAÇÃO DO ZOOM/PAN --- */
function applyTransform() {
    board.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    board.style.transformOrigin = '0 0';
}

/* --- ZOOM COM A RODA DO MOUSE --- */
canvas.addEventListener('wheel', function(e) {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - translateX) / scale;
    const worldY = (mouseY - translateY) / scale;

    const zoomSpeed = 0.1;
    const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    const newScale = Math.min(Math.max(0.3, scale + delta), 3);

    translateX = mouseX - worldX * newScale;
    translateY = mouseY - worldY * newScale;

    scale = newScale;

    applyTransform();
    drawConnections();
});

/* --- PAN (BOTÃO DO MEIO OU SHIFT + Arrastar) --- */
canvas.addEventListener('mousedown', function(e) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault();
        isPanning = true;
        startPanX = e.clientX - translateX;
        startPanY = e.clientY - translateY;
        canvas.style.cursor = 'grabbing';
    }
});

document.addEventListener('mousemove', function(e) {
    if (isPanning) {
        translateX = e.clientX - startPanX;
        translateY = e.clientY - startPanY;
        applyTransform();
        drawConnections();
    }
});

document.addEventListener('mouseup', function(e) {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'default';
    }
});

/* --- MODAIS (JS #1) --- */
function openAddModal() {
    document.getElementById('addModal').classList.add('active');
    document.getElementById('itemName').focus();
}
function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
    document.getElementById('itemName').value = '';
}

function openConnectionTypeModal() {
    document.getElementById('connectionTypeModal').classList.add('active');
}
function closeConnectionTypeModal() {
    document.getElementById('connectionTypeModal').classList.remove('active');
    document.getElementById('customConnectionName').value = '';
    document.getElementById('customNameSection').style.display = 'none';
}

/* --- CRIAÇÃO DE CONEXÕES COM TIPOS --- */
function selectConnectionType(type) {
    if (type === 'other') {
        document.getElementById('customNameSection').style.display = 'block';
        document.getElementById('customConnectionName').focus();
        return;
    }
    createConnection(type, connectionTypes[type].name);
}

function confirmCustomConnection() {
    const customName = document.getElementById('customConnectionName').value.trim();
    if (!customName) {
        alert('Por favor, insira um nome para a conexão.');
        return;
    }
    createConnection('other', customName);
}

function createConnection(type, label) {
    if (connectingFrom === null) return;

    const targetNodeId = parseInt(
        document.querySelector('.node.connecting-target')?.id.split('-')[1]
    );

    if (!targetNodeId) return;

    const exists = connections.some(c =>
        (c.from === connectingFrom && c.to === targetNodeId) ||
        (c.from === targetNodeId && c.to === connectingFrom)
    );

    if (!exists) {
        connections.push({
            from: connectingFrom,
            to: targetNodeId,
            type,
            label,
            color: connectionTypes[type].color
        });
        drawConnections();
    }

    document.getElementById('node-' + connectingFrom).classList.remove('connecting');
    document.querySelectorAll('.node.connecting-target').forEach(n => n.classList.remove('connecting-target'));

    connectingFrom = null;
    closeConnectionTypeModal();
}

/* --- CRIAÇÃO DE NÓS --- */
function addItem() {
    const name = document.getElementById('itemName').value.trim();
    if (!name) {
        alert('Por favor, insira um nome para o item.');
        return;
    }

    const node = {
        id: nodeIdCounter++,
        name,
        x: Math.random() * (canvas.width - 200) + 100,
        y: Math.random() * (canvas.height - 200) + 100
    };

    nodes.push(node);
    createNodeElement(node);
    closeAddModal();
}

function createNodeElement(node) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'node';
    nodeEl.id = 'node-' + node.id;
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';

    nodeEl.innerHTML = `
        <div class="node-name">${node.name}</div>
        <div class="node-actions">
            <button class="node-btn btn-connect" onclick="toggleConnect(${node.id})">Conectar</button>
            <button class="node-btn btn-delete" onclick="deleteNode(${node.id})">Excluir</button>
        </div>
    `;

    nodeEl.addEventListener('mousedown', startDrag);
    board.appendChild(nodeEl);
}

/* --- ARRASTAR NÓS (COM ZOOM CORRIGIDO) --- */
function startDrag(e) {
    if (e.target.classList.contains('node-btn')) return;
    if (isPanning) return;

    draggedNode = e.currentTarget;

    const rect = draggedNode.getBoundingClientRect();
    offsetX = (e.clientX - rect.left) / scale;
    offsetY = (e.clientY - rect.top) / scale;

    draggedNode.classList.add('dragging');

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

function drag(e) {
    if (!draggedNode) return;

    const containerRect = board.getBoundingClientRect();

    let x = ((e.clientX - containerRect.left) / scale) - offsetX;
    let y = ((e.clientY - containerRect.top) / scale) - offsetY;

    draggedNode.style.left = x + 'px';
    draggedNode.style.top = y + 'px';

    const nodeId = parseInt(draggedNode.id.split('-')[1]);
    const node = nodes.find(n => n.id === nodeId);

    node.x = x;
    node.y = y;

    drawConnections();
}

function stopDrag() {
    draggedNode?.classList.remove('dragging');
    draggedNode = null;

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
}

/* --- CLICK PARA CONECTAR --- */
function toggleConnect(nodeId) {
    const nodeEl = document.getElementById('node-' + nodeId);

    if (connectingFrom === null) {
        connectingFrom = nodeId;
        nodeEl.classList.add('connecting');
    } else if (connectingFrom === nodeId) {
        connectingFrom = null;
        nodeEl.classList.remove('connecting');
    } else {
        nodeEl.classList.add('connecting-target');
        openConnectionTypeModal();
    }
}

/* --- EXCLUIR NÓ --- */
function deleteNode(nodeId) {
    if (!confirm('Deseja realmente excluir este item?')) return;

    nodes = nodes.filter(n => n.id !== nodeId);
    connections = connections.filter(c => c.from !== nodeId && c.to !== nodeId);

    document.getElementById('node-' + nodeId)?.remove();
    drawConnections();
}

// Limpa todas as conexões (botão/atalho pode chamar esta função)
function clearConnections() {
    if (!connections || connections.length === 0) return;
    if (!confirm('Deseja realmente limpar todas as conexões?')) return;

    connections = [];
    drawConnections();
}


/* --- FUNÇÕES PARA CLIQUE NA LINHA --- */

function isPointNearLine(px, py, x1, y1, x2, y2, threshold = 8) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len === 0) return false;

    const t = ((px - x1)*(x2-x1)+(py-y1)*(y2-y1)) / (len*len);
    if (t < 0 || t > 1) return false;

    const cx = x1 + t * (x2 - x1);
    const cy = y1 + t * (y2 - y1);
    const dist = Math.hypot(px - cx, py - cy);

    return dist <= threshold;
}

function findClickedConnection(x, y) {
    for (let i = 0; i < connections.length; i++) {
        const c = connections[i];
        const from = nodes.find(n => n.id === c.from);
        const to = nodes.find(n => n.id === c.to);
        if (!from || !to) continue;

        const fromEl = document.getElementById("node-" + from.id);
        const toEl   = document.getElementById("node-" + to.id);

        const fromX = from.x + fromEl.offsetWidth/2;
        const fromY = from.y + fromEl.offsetHeight/2;
        const toX   = to.x + toEl.offsetWidth/2;
        const toY   = to.y + toEl.offsetHeight/2;

        if (isPointNearLine(x, y, fromX, fromY, toX, toY)) return i;
    }
    return -1;
}

canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();

    // converter coordenadas com o zoom/pan aplicados
    const x = (e.clientX - rect.left - translateX) / scale;
    const y = (e.clientY - rect.top - translateY) / scale;

    const connIndex = findClickedConnection(x, y);

    if (connIndex !== -1) {
        const c = connections[connIndex];
        const from = nodes.find(n => n.id === c.from);
        const to = nodes.find(n => n.id === c.to);

        if (confirm(`Excluir conexão "${c.label}" entre "${from.name}" e "${to.name}"?`)) {
            connections.splice(connIndex, 1);
            drawConnections();
        }
    }
});

/* --- MUDAR CURSOR AO PASSAR NA LINHA --- */
canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - translateX) / scale;
    const y = (e.clientY - rect.top - translateY) / scale;

    const idx = findClickedConnection(x, y);
    canvas.style.cursor = idx !== -1 ? "pointer" : "default";
});

/* --- DESENHAR CONEXÕES NO CANVAS --- */
function drawConnections() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    connections.forEach(conn => {
        const from = nodes.find(n => n.id === conn.from);
        const to = nodes.find(n => n.id === conn.to);

        const fromEl = document.getElementById('node-' + from.id);
        const toEl = document.getElementById('node-' + to.id);

        const fromX = from.x + fromEl.offsetWidth/2;
        const fromY = from.y + fromEl.offsetHeight/2;
        const toX = to.x + toEl.offsetWidth/2;
        const toY = to.y + toEl.offsetHeight/2;

        ctx.save();
        ctx.scale(scale, scale);
        ctx.translate(translateX / scale, translateY / scale);

        // Linha
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.strokeStyle = conn.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Seta
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const size = 12;
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - size * Math.cos(angle - Math.PI/6), toY - size * Math.sin(angle - Math.PI/6));
        ctx.lineTo(toX - size * Math.cos(angle + Math.PI/6), toY - size * Math.sin(angle + Math.PI/6));
        ctx.closePath();
        ctx.fillStyle = conn.color;
        ctx.fill();

        // Texto
        const midX = (fromX + toX)/2;
        const midY = (fromY + toY)/2;

        const text = conn.label;
        ctx.font = "bold 12px Poppins";
        ctx.textAlign = "center";

        const width = ctx.measureText(text).width;

        ctx.fillStyle = "rgba(30,58,138,0.9)";
        ctx.fillRect(midX - width/2 - 4, midY - 8, width + 8, 16);
        ctx.fillStyle = "#fff";
        ctx.fillText(text, midX, midY);

        ctx.restore();
    });
}

/* --- ATALHOS DE MODAL --- */
document.getElementById('itemName').addEventListener('keypress', e => {
    if (e.key === 'Enter') addItem();
});

document.getElementById('addModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddModal();
});

document.getElementById('connectionTypeModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
        if (connectingFrom !== null) {
            document.getElementById('node-'+connectingFrom).classList.remove('connecting');
            document.querySelectorAll('.node.connecting-target').forEach(n => n.classList.remove('connecting-target'));
            connectingFrom = null;
        }
        closeConnectionTypeModal();
    }
});

/* --- CARREGAR 3 NÓS INICIAIS --- */
window.addEventListener('load', () => {
    setTimeout(() => {
        ['Comportamento A', 'Comportamento B', 'Estímulo'].forEach(name => {
            document.getElementById('itemName').value = name;
            addItem();
        });
    }, 100);
});
