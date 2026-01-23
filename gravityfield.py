import numpy as np
from astro import Body

G = 6.6743e-11
c = 299792458.0
AU = 1.49597871e11

def GravityField(pos:np.ndarray, bodies: list[Body], eps: float = 1e7):
    gx, gy = 0.0, 0.0

    for b in bodies:
        ds = pos - b.pos

        dx = ds[0]
        dy = ds[1]

        r2 = dx*dx + dy*dy + eps*eps
        r = r2**0.5

        g = -G * b.m / r2

        gx += g * dx / r
        gy += g * dy / r

    return gx, gy

def field_dir(x, y, bodies):
    gx, gy = GravityField(np.array([x, y]), bodies)
    gmag = np.hypot(gx, gy)
    if gmag < 1e-20:
        return 0.0, 0.0
    return gx / gmag, gy / gmag

def sample_vector_field(bodies, xmin, xmax, ymin, ymax, step):
    vectors = []

    x = xmin
    while x <= xmax:
        y = ymin
        while y <= ymax:
            gx, gy = GravityField(np.array([x, y]), bodies)
            vectors.append([x, y, gx, gy])
            y += step
        x += step

    return vectors

def sample_acceleration_heatmap(bodies, xmin, xmax, ymin, ymax, step):
    grid = []

    x = xmin
    while x <= xmax:
        row = []
        y = ymin
        while y <= ymax:
            gx, gy = GravityField(np.array([x, y]), bodies)
            amag = np.hypot(gx, gy)
            row.append(amag)
            y += step
        grid.append(row)
        x += step

    return grid
