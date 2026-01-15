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



def simulate(bodies, dt):
    # 1. First half: update positions using current acceleration
    for b in bodies:
        b.update_position(dt)

    # 2. Recompute accelerations based on new positions
    compute_gravity(bodies)

    # 3. Second half: update velocities using old+new acceleration
    for b in bodies:
        b.update_velocity(dt)