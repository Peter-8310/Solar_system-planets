/* ------------------------
    CANVAS SETUP
--------------------------- */
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
resize();
window.onresize = resize;
/* ★ NEW */
let lastFieldUpdate = 0;
const FIELD_INTERVAL = 250; // ms (4 Hz)

let lastHeatUpdate = 0;
const HEAT_INTERVAL = 250; // ms

let lagrangeBusy = false;
let lagrangeDirty = true;
let lastLagrangeUpdate = 0;

const LAGRANGE_INTERVAL = 250; // ms (≈ 1.25 Hz)


const VECTOR_SPACING_PX = 40;
let selectedPlanet = null;
let followPlanet = null;

let vectorBusy = false;
let vectorDirty = true;

let heatBusy = false;
let heatmap = null;

let lagrangePoints = null;

/* ------------------------CAMERA--------------------------- */
let scale = 57.9e9 / 200;  
let offsetX = 0;
let offsetY = 0;
let trails = [];
const maxTrail = 500;
let islabel = false;
let vectorField = [];

let isVectorFeild = false;
let isHeatMap = false;

let sun_x = 0;
let sun_y = 0;
let earth_x = 0;
let earth_y = 0;

function markLagrangeDirty() {
    lagrangeDirty = true;
}

async function loadLagrangePointsAsync() {
    if (!selectedPlanet || selectedPlanet.name === "Sun") {
        lagrangePoints = null;
        lagrangeDirty = false;
        return;
    }

    const res = await fetch("/lagrange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planet: selectedPlanet.name })
    });

    if (!res.ok) {
        console.warn("Lagrange fetch failed");
        return;
    }

    const json = await res.json();
    lagrangePoints = json.points;
}

 
async function loadVectorField() {
    const xmin = offsetX - canvas.width  * scale / 2;
    const xmax = offsetX + canvas.width  * scale / 2;
    const ymin = offsetY - canvas.height * scale / 2;
    const ymax = offsetY + canvas.height * scale / 2;

    const step = VECTOR_SPACING_PX * scale;

    const res = await fetch("/vector_field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmin, xmax, ymin, ymax, step })
    });

    const json = await res.json();
    vectorField = json.vectors;
}

async function loadAccelHeatmap() {
    const xmin = offsetX - canvas.width  * scale / 2;
    const xmax = offsetX + canvas.width  * scale / 2;
    const ymin = offsetY - canvas.height * scale / 2;
    const ymax = offsetY + canvas.height * scale / 2;
    const step = VECTOR_SPACING_PX * scale;

    const res = await fetch("/accel_heatmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmin, xmax, ymin, ymax, step })
    });

    const json = await res.json();
    return {
        grid: json.grid,
        bounds: { xmin, ymin, step }
    };
}

async function updateHeatmap() {
    heatmap = await loadAccelHeatmap();
    heatmapDirty = false;
}

    /* ------------------------INPUT CONTROLS--------------------------- */
document.addEventListener("keydown", e => {
    const p = 40 * scale;
    if (e.key === "w") offsetY += p;
    if (e.key === "s") offsetY -= p;
    if (e.key === "a") offsetX -= p;
    if (e.key === "d") offsetX += p;
    if (e.key === "e" || e.key === "=") scale *= 0.9;
    if (e.key === "q" || e.key === "_") scale *= 1.1;
    if (e.key === "f") {followPlanet = followPlanet ? null : selectedPlanet;}
    if (e.key === "w" || e.key === "a" || e.key === "s" || e.key === "d") {markLagrangeDirty();}


});
/* Scroll zoom */
canvas.addEventListener("wheel", e => {
    markLagrangeDirty();
    e.preventDefault();
    scale *= (e.deltaY < 0 ? 0.9 : 1.1);
    vectorDirty = true;
});
/* ------------------------COLLAPSIBLE PANEL--------------------------- */
const head = document.getElementById("control-header");
const body = document.getElementById("control-body");
let collapsed = false;
head.onclick = () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? "none" : "block";
    head.textContent = collapsed ? "⚙ Controls ▲" : "⚙ Controls ▼";
};

/* ------------------------TIME SCALE CONTROL--------------------------- */
const slider = document.getElementById("time_slider");
const tsVal = document.getElementById("ts_val");
let currentScale = 1;
async function setTime(v){
    currentScale = v;
    markLagrangeDirty();
    slider.value = v;
    tsVal.textContent = v + "×";
    await fetch("/set_time_scale", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ scale:v })
    });
}
slider.oninput = () => setTime(Number(slider.value));

/* ------------------------CLICK HANDLING--------------------------- */
canvas.addEventListener("mousedown", e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - canvas.width/2) * scale + offsetX;
    const wy = (canvas.height/2 - my) * scale + offsetY;
    let clicked = null;
        for (const b of (window.bodies || [])) {
        const dx = wx - b.x;
        const dy = wy - b.y;
        const dist = Math.hypot(dx, dy);

        // detection radius based on pixels, not world size
        const tolerance = 50 * scale;

        if (dist < tolerance) {
            clicked = b;
            break;
        }
    }

    if (e.button === 0) {
    if (clicked) {
        selectedPlanet = clicked;
        markLagrangeDirty();
        updateInfoBox();
    } else {
        // ★ CLICKED EMPTY SPACE → CLEAR SELECTION
        selectedPlanet = null;
        lagrangePoints = null;
        updateInfoBox();
    }
}


});
/* Disable context menu (right-click) */
canvas.oncontextmenu = e => e.preventDefault();

/* ------------------------FETCH LOOP--------------------------- */
async function update(){
    const res = await fetch("/state");
    const t   = await fetch("/time");

    const bodies = await res.json();
    const time = await t.json();
    window.bodies = bodies;
    document.getElementById("timerBox").innerHTML = `
    <div class="countdown-item"><div>${time.years}</div><span>Years</span></div>
    <div class="countdown-item"><div>${time.days}</div><span>Days</span></div>
    <div class="countdown-item"><div>${time.hours.toString().padStart(2, '0')}</div><span>Hours</span></div>
    <div class="countdown-item"><div>${time.minutes.toString().padStart(2, '0')}</div><span>Minutes</span></div>
    <div class="countdown-item"><div>${time.seconds.toString().padStart(2, '0')}</div><span>Seconds</span></div>
    `
    if (followPlanet) {
        const p = window.bodies.find(b => b.name === followPlanet.name);
        markLagrangeDirty();
        if (p) {
            offsetX = p.x;
            offsetY = p.y;
        } else {
            followPlanet = null;
        }
    }

    bodies.forEach((b, i) => {
        if (!trails[i]) trails[i] = [];
        trails[i].push({ x:b.x, y:b.y });
        if (trails[i].length > maxTrail) trails[i].shift();
    });
    if (selectedPlanet && window.bodies.some(b => b.name === selectedPlanet.name)) {
        updateInfoBox();
    }

    draw();
    requestAnimationFrame(update);
}
/* ------------------------INFO BOX UPDATE (★ NEW)--------------------------- */
function updateInfoBox(){
    const box = document.getElementById("infoBox");
    if (!selectedPlanet) {
        box.style.display = "none";
        return;
    }
    const p = window.bodies.find(b => b.name === selectedPlanet.name);
    if (!p) return;
    const sun_dist = Math.hypot(p.x - sun_x, p.y - sun_y);
    const earth_dist = Math.hypot(p.x - earth_x, p.y - earth_y)
    const AU = 1.496e11;
    box.style.display = "block";
    if(p.name === "Earth"){
        box.innerHTML = `
        <b>${p.name}</b><br>
        Distance from Sun: ${(sun_dist/AU).toFixed(3)} AU<br>
        Orbital velocity: ${(p.v_total).toFixed(3)} m/s<br>
        Total accelaration: ${(p.a_total).toFixed(3)} m/s<sup>2</sup> <br>
        Mass : ${p.m}<br>
        Diameter: ${p.d} km<br>`;
    } else if (p.name === "Sun"){
        box.innerHTML = `
        <b>${p.name}</b><br>
        Distance from Earth: ${(earth_dist/AU).toFixed(3)} AU<br>
        Orbital velocity: ${(p.v_total).toFixed(3)} m/s<br>
        Total accelaration: ${(p.a_total).toFixed(3)} m/s<sup>2</sup> <br>
        Mass : ${p.m}<br>
        Diameter: ${p.d} km<br>`;
    } else {
        box.innerHTML = `
        <b>${p.name}</b><br>
        Distance from Earth: ${(earth_dist/AU).toFixed(3)} AU<br>
        Distance from Sun: ${(sun_dist/AU).toFixed(3)} AU<br>
        Orbital velocity: ${(p.v_total).toFixed(3)} m/s<br>
        Total accelaration: ${(p.a_total).toFixed(3)} m/s<sup>2</sup> <br>
        Mass : ${p.m} <br>
        Diameter: ${p.d} km<br>`;
    }
}
/* ------------------------DRAW HELPERS--------------------------- */
function worldToScreen(x, y){ return {sx: canvas.width/2 + (x - offsetX)/scale, sy: canvas.height/2 - (y - offsetY)/scale}; }
function drawGlow(x, y, r, color){
    const g = ctx.createRadialGradient(x,y,0, x,y,r*8);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r*8, 0, 2*Math.PI);
    ctx.fill();
}

/* ------------------------
    CONSTANTS FOR ARROWS
--------------------------- */
const velArrowLengthPixels = 50;
const accArrowLengthPixels = 40;

/* ------------------------
    LABELED ARROW (for acceleration)
--------------------------- */
function drawLabeledArrow(x1, y1, x2, y2, color="orange", label="") {
    const headLength = 10;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    // Line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - headLength * Math.cos(angle - Math.PI/6),
        y2 - headLength * Math.sin(angle - Math.PI/6)
    );
    ctx.lineTo(
        x2 - headLength * Math.cos(angle + Math.PI/6),
        y2 - headLength * Math.sin(angle + Math.PI/6)
    );
    ctx.closePath();
    ctx.fill();
    // Label
    if (label) {
        ctx.font = "14px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(label, x2 - 10, y2 - 5);
    }
}

function drawLagrangePoints(points) {
    ctx.save();
    ctx.fillStyle = "cyan";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;

    for (const [name, [x,y]] of Object.entries(points)) {
        const { sx, sy } = worldToScreen(x, y);

        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "13px monospace";
        ctx.fillText(name, sx + 7, sy - 7);
    }

    ctx.restore();
}

function drawArrowHead(x2, y2, x1, y1, color) {
    const headLength = 8;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - headLength * Math.cos(angle - Math.PI / 6),
        y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        x2 - headLength * Math.cos(angle + Math.PI / 6),
        y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

function drawVectorField(ctx) {
    if (!isVectorFeild) return;

    ctx.lineWidth = 1.6;

    vectorField.forEach(v => {
        const [x, y, gx, gy] = v;

        const gmag = Math.hypot(gx, gy);
        if (gmag === 0) return;

        // --- Screen position ---
        const p = worldToScreen(x, y);

        // --- SAME scaling as orange acceleration arrow ---
        let L = 25;
        const ux = gx / gmag;
        const uy = gy / gmag;

        // --- Shaft start/end (tail at grid point) ---
        const x1 = p.sx;
        const y1 = p.sy;
        const x2 = p.sx + ux * L;
        const y2 = p.sy - uy * L;

        // --- Color by magnitude ---
        const t = Math.min(1, Math.log10(gmag + 1e-30) / 12);

        const r = Math.floor(255 * t);
        const g = Math.floor(255 * (1 - Math.abs(t - 0.5) * 2));
        const b = Math.floor(255 * (1 - t));

        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.fillStyle   = `rgb(${r},${g},${b})`;

        // Shaft
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Head
        drawArrowHead(x2, y2, x1, y1, ctx.strokeStyle);
    });
}

document.addEventListener("keydown", e => {
    if (e.key === "v") {
        isVectorFeild = !isVectorFeild;
        vectorDirty = true;
    } if (e.key === "h"){
        isHeatMap = !isHeatMap;
        heatmapDirty = true;
    } if (e.key === "l"){
        islabel = !islabel;
    }
});

function accelToColor(a, amin, amax) {
    const t = Math.min(1,
        (Math.log10(a) - Math.log10(amin)) /
        (Math.log10(amax) - Math.log10(amin))
    );

    const r = Math.floor(255 * t);
    const b = Math.floor(255 * (1 - t));
    return `rgb(${r},0,${b})`;
}

function drawAccelHeatmap(grid, bounds) {
    const dx = VECTOR_SPACING_PX;
    const dy = VECTOR_SPACING_PX;

    let amin = Infinity, amax = 0;
    grid.flat().forEach(a => {
        amin = Math.min(amin, a);
        amax = Math.max(amax, a);
    });

    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
            const wx = bounds.xmin + i * bounds.step;
            const wy = bounds.ymin + j * bounds.step;
            const { sx, sy } = worldToScreen(wx, wy);

            ctx.fillStyle = accelToColor(grid[i][j], amin, amax);
            ctx.globalAlpha = 0.50;
            ctx.fillRect(sx, sy, dx, dy);
            ctx.globalAlpha = 1.0;

        }
    }
}

/* ------------------------
    DRAW FRAME
--------------------------- */
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Ensure bodies exist
    const bodies = window.bodies || [];
    if (bodies.length === 0) return;

    const now = performance.now();

    if (isVectorFeild && now - lastFieldUpdate > FIELD_INTERVAL && !vectorBusy) {
        vectorBusy = true;
        loadVectorField().then(() => {
            vectorBusy = false;
            lastFieldUpdate = now;
        });
    }
    
    if (isHeatMap && now - lastHeatUpdate > HEAT_INTERVAL && !heatBusy) {
        heatBusy = true;
        loadAccelHeatmap().then(h => {
            heatmap = h;
            heatBusy = false;
            lastHeatUpdate = now;
        });
    }

    if (isHeatMap && heatmap) {
        drawAccelHeatmap(heatmap.grid, heatmap.bounds);
    }

    if(selectedPlanet && !lagrangeBusy && now - lastLagrangeUpdate > LAGRANGE_INTERVAL) {
        lagrangeBusy = true;
        loadLagrangePointsAsync().then(() => {
            lagrangeBusy = false;
            lagrangeDirty = false;
            lastLagrangeUpdate = now;
        });
    }

    drawVectorField(ctx);   // background

    // Draw trails
    bodies.forEach((b, i) => {
        if (!trails[i]) trails[i] = [];
        trails[i].push({ x: b.x, y: b.y });
        if (trails[i].length > maxTrail) trails[i].shift();

        ctx.beginPath();
        ctx.strokeStyle = (selectedPlanet && selectedPlanet.name === b.name ? b.color + "AA" : b.color + "40");
        trails[i].forEach((p, j) => {
            const { sx, sy } = worldToScreen(p.x, p.y);
            if (j === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
    });

    // Draw bodies
    bodies.forEach(b => {
        const { sx, sy } = worldToScreen(b.x, b.y);

        const MIN_RADIUS_PX = 1.5;
        const MAX_RADIUS_PX = 20;

        let r = (b.r / scale) * (15e6);
        r = Math.max(MIN_RADIUS_PX, r);
        r = Math.min(MAX_RADIUS_PX, r);

        // Save Sun and Earth positions
        if (b.name === "Sun") {
            sun_x = b.x;
            sun_y = b.y;
            drawGlow(sx, sy, r / 2, "rgba(255,255,150,0.9)");
        }
        if (b.name === "Earth") {
            earth_x = b.x;
            earth_y = b.y;
        }

        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, 2 * Math.PI);
        ctx.fill();

        // Draw labels if enabled
        if (islabel) {
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "white";
            ctx.fillText(b.name, sx + 10, sy - 1.05 * (r + 15));
        }

        // Highlight selected planet and draw velocity/acceleration arrows
        if (selectedPlanet && selectedPlanet.name === b.name) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, r + 4, 0, 2 * Math.PI);
            ctx.stroke();

            // Velocity arrow
            const speed = Math.hypot(b.v_x, b.v_y);
            if (speed > 0) {
                const vxUnit = b.v_x / speed;
                const vyUnit = b.v_y / speed;
                const worldEndX = b.x + vxUnit * velArrowLengthPixels * scale;
                const worldEndY = b.y + vyUnit * velArrowLengthPixels * scale;
                const end = worldToScreen(worldEndX, worldEndY);
                drawLabeledArrow(sx, sy, end.sx, end.sy, "white", "v");
            }

            // Acceleration arrow
            const amag = Math.hypot(b.a_x, b.a_y);
            if (amag > 0) {
                const axUnit = b.a_x / amag;
                const ayUnit = b.a_y / amag;
                const worldEndX = b.x + axUnit * accArrowLengthPixels * scale;
                const worldEndY = b.y + ayUnit * accArrowLengthPixels * scale;
                const end = worldToScreen(worldEndX, worldEndY);
                drawLabeledArrow(sx, sy, end.sx, end.sy, "orange", "a");
            }
        }
    });
    if (lagrangePoints && selectedPlanet) {
        drawLagrangePoints(lagrangePoints);
    }

}


update();