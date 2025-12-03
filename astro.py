import numpy as np

G = 6.6743e-11
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
            r = bodies[j].pos - bodies[i].pos
            dist_sq = r.dot(r) + softening*softening
            dist = np.sqrt(dist_sq)
            if dist == 0:
                continue
            # force magnitude = G*m1*m2 / r^2, and times r_hat -> divide by r^3
            fmag = G * bodies[i].m * bodies[j].m / (dist_sq * dist)
            force = fmag * r
            bodies[i].apply(force)
            bodies[j].apply(-force)


def simulate(bodies, dt):
    # 1. First half: update positions using current acceleration
    for b in bodies:
        b.update_position(dt)

    # 2. Recompute accelerations based on new positions
    compute_gravity(bodies)

    # 3. Second half: update velocities using old+new acceleration
    for b in bodies:
        b.update_velocity(dt)