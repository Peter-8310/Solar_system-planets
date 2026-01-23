import numpy as np
from scipy.optimize import brentq
from astro import Body

G = 6.67430e-11

def instantaneous_lagrange_points(sun:Body, planet:Body):
    """
    Returns pseudo-L1..L5 points in world coordinates
    """
    S = np.array(sun.pos, dtype=float)
    P = np.array(planet.pos, dtype=float)

    m1 = sun.m
    m2 = planet.m

    r = P - S
    R = np.linalg.norm(r)
    if R == 0:
        return {}

    ux = r / R # Sun → planet unit vector
    uy = np.array([-ux[1], ux[0]])  # perpendicular

    # 1D collinear equation along Sun-planet axis
    def f(x):
        return (
            G*m1*(x)/abs(x)**3 +
            G*m2*(x - R)/abs(x - R)**3 -
            G*(m1 + m2)*x/R**3
        )

    points = {}

    # ---------- L1 ----------
    try:
        x = brentq(f, 0.001*R, 0.999*R)
        points["L1"] = S + ux * x
    except ValueError:
        pass

    # ---------- L2 ----------
    try:
        x = brentq(f, 1.01*R, 5*R)
        points["L2"] = S + ux * x
    except ValueError:
        pass

    # ---------- L3 ----------
    try:
        x = brentq(f, -5*R, -0.01*R)
        points["L3"] = S + ux * x
    except ValueError:
        pass

    # ---------- L4 / L5 (geometric, always defined) ----------
    h = np.sqrt(3)/2 * R
    base = S + 0.5 * r

    points["L4"] = base + uy * h
    points["L5"] = base - uy * h

    return points
