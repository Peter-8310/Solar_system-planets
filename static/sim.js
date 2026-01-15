
/* ------------------------
    CANVAS SETUP
--------------------------- */
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
resize();
window.onresize = resize;
/* ★ NEW */
let selectedPlanet = null;
let followPlanet = null;
/* ------------------------CAMERA--------------------------- */
let scale = 57.9e9 / 200;  
let offsetX = 0;
let offsetY = 0;
let trails = [];
const maxTrail = 800;
let islabel = false;
let sun_x = 0;
let sun_y = 0;
let earth_x = 0;
let earth_y = 0;
function setlabel(){
    islabel = !islabel;
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

});
/* Scroll zoom */
canvas.addEventListener("wheel", e => {
    e.preventDefault();
    scale *= (e.deltaY < 0 ? 0.9 : 1.1);
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
        // ★ Left-click → select & show info
        selectedPlanet = clicked;
        updateInfoBox();
    }
});
/* Disable context menu (right-click) */
canvas.oncontextmenu = e => e.preventDefault();

/* ------------------------FETCH LOOP--------------------------- */
async function update(){
    const res = await fetch("/state");
    const t   = await fetch("/time")
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
/* ------------------------
    DRAW FRAME
--------------------------- */
function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (!window.bodies) return;
    const bodies = window.bodies;
    // Trails
    bodies.forEach((b,i)=>{
        ctx.beginPath();
        // ★ Highlight selected orbit
        ctx.strokeStyle =
            selectedPlanet && selectedPlanet.name === b.name
                ? b.color + "AA"
                : b.color + "40";
        trails[i].forEach((p,j)=>{
            const {sx,sy}=worldToScreen(p.x,p.y);
            if(j===0) ctx.moveTo(sx,sy);
            else ctx.lineTo(sx,sy);
        });
        ctx.stroke();
    });
    // Bodies
    bodies.forEach(b=>{
        const {sx,sy}=worldToScreen(b.x,b.y);

        const MIN_RADIUS_PX = 1.5;
        const MAX_RADIUS_PX = 20;

        let r = (b.r / scale)*(15e6);
        r = Math.max(MIN_RADIUS_PX, r);
        if (b.name==="Sun") drawGlow(sx,sy,r/2,"rgba(255,255,150,0.9)");
        if (b.name==="Sun"){
            sun_x=b.x;
            sun_y=b.y;
        }
        if (b.name==="Earth"){
            earth_x=b.x;
            earth_y=b.y
        }
        ctx.fillStyle=b.color;
        ctx.beginPath();
        ctx.arc(sx,sy,r,0,2*Math.PI);
        ctx.fill();
        if(islabel){
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "white";
            ctx.fillText(b.name, sx + 10, sy - 1.05*(r + 15));
        }
        if (selectedPlanet && selectedPlanet.name === b.name) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, r+4, 0, 2*Math.PI);
            ctx.stroke();
            const speed = Math.hypot(b.v_x, b.v_y);
            const arrowLengthPixels = 50;   // constant size on screen
            const arrowLength = arrowLengthPixels * scale;
            const vxUnit = b.v_x / speed;
            const vyUnit = b.v_y / speed;
            const worldEndX = b.x + vxUnit * arrowLength;
            const worldEndY = b.y + vyUnit * arrowLength;
            const end = worldToScreen(worldEndX, worldEndY);
            drawLabeledArrow(sx, sy, end.sx, end.sy, "white", "v");
            const ax = b.a_x;
            const ay = b.a_y;
            const amag = Math.hypot(ax, ay);
        if (amag > 0) {
            const accLength = accArrowLengthPixels * scale;
            const axUnit = ax / amag;
            const ayUnit = ay / amag;
            const worldEndX = b.x + axUnit * accLength;
            const worldEndY = b.y + ayUnit * accLength;
            const end = worldToScreen(worldEndX, worldEndY);
            drawLabeledArrow(sx, sy, end.sx, end.sy, "orange", "a");
        }
}});
}

update();