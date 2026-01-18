from astro import *
from Lagrange import *
from quart import Quart, jsonify, render_template, request
from math import hypot
import numpy as np


app = Quart(__name__, static_folder="static")

bodies = [
    Body("Sun", "#ffff00ff",   1.98847e30, 1392700, [0.0, 0.0],      [0.0, 0.0]),

    Body("Mercury",  '#b7b7b7', 0.33e24,  4879,    [57.9e9, 0.0],   [0.0, 47.4e3]),
    Body("Venus",    '#e0c080', 4.872e24, 12104,   [108.2e9, 0.0],  [0.0, -35.0e3]),
    Body("Earth",    '#4da6ff', 5.972e24, 12756,   [AU, 0.0],       [0.0, 29.78e3]),
    Body("Moon",     "#969696", 0.073e24,  3475,   [AU+384e6,0]  ,  [0.0, 29.78e3+1.022e3]),
    Body("Mars",     '#ff5533', 6.42e24,   6792,   [227.9e9, 0.0],  [0.0, 24.1e3]),
    Body("Jupiter",  '#d9b38c', 1898e24, 142984,   [778.6e9, 0.0],  [0.0, 13.1e3]),
    Body("Saturn",   '#e8d7a8', 568e24,  120536,   [1433.5e9, 0.0], [0.0, 9.7e3]),
    Body("Uranus",   '#66ccff', 96.8e24,  51118,   [2872.5e9, 0.0], [0.0, -6.8e3]),
    Body("Neptune",  '#3366ff', 102e24,   49528,   [4495.1e9, 0.0], [0.0, 5.4e3]),
]

# GLOBAL time multiplier
TIME_SCALE = 1.0
TIME_ELAPSED = 0.0    

dt_base = 1800  # 30-minute internal step
dt_stored = 0

@app.route("/")
async def index():
    return await render_template("index.html")

@app.route("/time")
async def time():
    global TIME_ELAPSED

    years, t = divmod(TIME_ELAPSED, 3600*24*365)
    days, t = divmod(t, 3600*24)
    hours, t = divmod(t, 3600)
    minutes, t = divmod(t, 60)
    seconds, t = divmod(t, 1)

    return jsonify(
            {
            "years":years,
            "days":days,
            "hours":hours,
            "minutes":minutes,
            "seconds":seconds
        }
    )

@app.post("/vector_field")
async def vector_field():
    data = await request.get_json()

    xmin = data["xmin"]
    xmax = data["xmax"]
    ymin = data["ymin"]
    ymax = data["ymax"]
    step = data["step"]

    vectors = []
    for x in np.arange(xmin, xmax, step):
        for y in np.arange(ymin, ymax, step):
            gx, gy = GravityField(np.array([x, y]), bodies)
            vectors.append([
                float(x), float(y),
                float(gx), float(gy)
            ])

    return jsonify({"vectors": vectors})

@app.post("/accel_heatmap")
async def accel_heatmap():
    data = await request.get_json()

    xmin = data["xmin"]
    xmax = data["xmax"]
    ymin = data["ymin"]
    ymax = data["ymax"]
    step = data["step"]

    grid = sample_acceleration_heatmap(
        bodies,
        xmin, xmax,
        ymin, ymax,
        step
    )

    return jsonify({
        "grid": grid
    })

@app.post("/lagrange")
async def lagrange():
    data = await request.get_json()
    planet_name = data["planet"]

    sun = next(b for b in bodies if b.name == "Sun")
    planet = next(b for b in bodies if b.name == planet_name)

    raw = instantaneous_lagrange_points(sun, planet)

    # JSON-safe conversion
    points = {
        name: [float(p[0]), float(p[1])]
        for name, p in raw.items()
    }

    return jsonify({"points": points})

@app.route("/state")
async def state():
    global TIME_SCALE, TIME_ELAPSED

    # Number of physics steps per frame
    steps = int(max(1, TIME_SCALE))

    # fractional time step preserved for accuracy
    dt_frac = TIME_SCALE / steps  

    for _ in range(steps):
        dt = dt_base * dt_frac
        TIME_ELAPSED += dt

        for b in bodies: 
            b.update_position(dt)
        compute_gravity(bodies)
        for b in bodies:
            b.update_velocity(dt)
            
    return jsonify([
        {
        "name": b.name,
        "x": float(b.pos[0]), 
        "y": float(b.pos[1]),

        "v_x":float(b.v[0]),
        "v_y":float(b.v[1]),
        "v_total": hypot(float(b.v[0]), float(b.v[1])),

        "a_x":float(b.a[0]),
        "a_y":float(b.a[1]),
        "a_total": hypot(float(b.a[0]), float(b.a[1])),
        
        "d":  b.radius*2,
        "r": max(1, (b.radius / 5000)),
        "m": b.m,
        "color":b.color
        }
        for b in bodies
    ])

@app.post("/set_time_scale")
async def set_time_scale():
    global TIME_SCALE
    data = await request.get_json()
    TIME_SCALE = float(data["scale"])
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(debug=True)