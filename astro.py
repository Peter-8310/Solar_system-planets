import numpy as np

G = 6.6743e-11
c = 299792458.0
AU = 1.49597871e11

class Body:
    def __init__(self, name, color, mass, diameter, position_initial, orbital_velocity):
        self.name = name
        self.color = color
        self.m = mass
        self.radius = diameter/2
        self.pos = np.array(position_initial, dtype=float)
        self.v = np.array(orbital_velocity, dtype=float)
        self.a = np.zeros(2)
        self.a_prev = np.zeros(2)

    def apply(self, force):
        self.a += force / self.m

    def update_position(self, dt):
        # x_{t+dt} = x_t + v_t*dt + 0.5*a_t*dt^2
        self.pos += (self.v + 0.5*self.a*dt) * dt
        self.a_prev = self.a.copy()
        self.a[:] = 0.0


    def update_velocity(self, dt):
        self.v += 0.5 * (self.a_prev + self.a) * dt

def compute_gravity(bodies: list[Body], softening: float = 1e7):
    n = len(bodies)
    for i in range(n):
        for j in range(i+1, n):
            bi = bodies[i]
            bj = bodies[j]

            r = bj.pos - bi.pos
            v = bj.v - bi.v

            r2 = r.dot(r) + softening*softening
            r_norm = np.sqrt(r2)
            r3 = r2 * r_norm

            if r_norm == 0:
                continue

            # ------------------------
            # Newtonian force
            # ------------------------
            force_newton = G * bi.m * bj.m * r / r3

            # ------------------------
            # Post-Newtonian relativistic correction
            # ------------------------
            vi2 = bi.v.dot(bi.v)
            vj2 = bj.v.dot(bj.v)
            vivj = bi.v.dot(bj.v)
            rv = r.dot(v)

            pref = G * bi.m * bj.m / (c**2 * r3)

            force_1pn = pref * (
                (4*G*(bi.m + bj.m)/r_norm - vi2 - 2*vj2 + 4*vivj) * r
                - 4 * rv * v
            )

            force = force_newton + force_1pn

            bi.apply(force)
            bj.apply(-force)

def compute_potentials(bodies):
    U = []
    for i, bi in enumerate(bodies):
        Ui = 0.0
        for k, bk in enumerate(bodies):
            if i == k:
                continue
            r = np.linalg.norm(bi.pos - bk.pos)
            Ui += G * bk.m / r
        U.append(Ui)
    return U


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


def simulate(bodies:list[Body], dt):
    # 1. First half: update positions using current acceleration
    for b in bodies:
        b.update_position(dt)

    # 2. Recompute accelerations based on new positions
    compute_gravity(bodies)

    # 3. Second half: update velocities using old+new acceleration
    for b in bodies:
        b.update_velocity(dt)

def trace_field_line(
    x0, y0,
    bodies:list[Body],
    step=1e9,
    max_steps=1000
):
    points = []
    x, y = x0, y0

    for _ in range(max_steps):
        gx, gy = GravityField(x, y, bodies)
        gmag = (gx*gx + gy*gy)**0.5
        if gmag < 1e-20:
            break

        # Normalize direction
        dx = gx / gmag
        dy = gy / gmag

        points.append((x, y))

        # RK4
        k1x, k1y = dx, dy
        k2x, k2y = GravityField(x + 0.5*step*k1x,
                                          y + 0.5*step*k1y,
                                          bodies)
        k3x, k3y = GravityField(x + 0.5*step*k2x,
                                          y + 0.5*step*k2y,
                                          bodies)
        k4x, k4y = GravityField(x + step*k3x,
                                          y + step*k3y,
                                          bodies)

        x += step * (k1x + 2*k2x + 2*k3x + k4x) / 6
        y += step * (k1y + 2*k2y + 2*k3y + k4y) / 6

        # Stop near massive body
        for b in bodies:
            if ((x - b.pos[0])**2 + (y - b.pos[1])**2)**0.5 < b.radius*2:
                return points

    return points

def generate_field_lines(bodies:list[Body], lines_per_body=12):
    lines = []

    for b in bodies:
        for i in range(lines_per_body):
            angle = 2 * np.pi * i / lines_per_body
            r = b.radius * 3

            x0 = b.pos[0] + r * np.cos(angle)
            y0 = b.pos[1] + r * np.sin(angle)

            line = trace_field_line(x0, y0, bodies)
            lines.append(line)

    return lines
