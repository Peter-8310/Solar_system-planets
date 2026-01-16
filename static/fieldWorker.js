self.onmessage = (e) => {
    if (e.data.type !== "vector") return;

    const points = e.data.points;
    const result = [];

    for (const [x, y] of points) {
        let gx = 0, gy = 0;

        for (const b of self.bodies) {   // or cached masses
            const dx = b.x - x;
            const dy = b.y - y;
            const r2 = dx*dx + dy*dy + 1e6;
            const invr3 = 1 / Math.pow(r2, 1.5);

            gx += b.GM * dx * invr3;
            gy += b.GM * dy * invr3;
        }

        result.push([x, y, gx, gy]);
    }

    postMessage({ type: "vector", data: result });
};
