const BACKGROUND_COLOR = '#2A383E';
const BERNSTEIN_BOX_COLOR_FUNCS = ['magenta', 'royalblue', 'springgreen', 'yellow'];
const BERNSTEIN_BOX_COLOR_BCKG = 'black';
const BERNSTEIN_BOX_COLOR_BORDER = 'white';

const BEZIER_COLOR = 'red';
const BEZIER_COLOR_ACTIVE = 'tomato';
// const BEZIER_COLOR_LERPS = ['chocolate', 'coral', 'bisque'];
const BEZIER_COLOR_LERPS = ['#C9CC3F', '#C9CC3F', '#C9CC3F'];
const BEZIER_COLOR_BOUNDS = 'blue';
const BEZIER_COLOR_TANGENT = '#FF47A6';
const BEZIER_COLOR_NORMAL = '#B6FF72';
const BEZIER_COLOR_OSCULATING_CIRCLE = 'white';

const POINT_DRAW_RADIUS = 3;

const POINT_STANDARD = 0;
const POINT_MOVING = 1;
const POINT_FORMING_BEZIER = 2;
const POINT_ORIGIN = 3;
const POINT_ACTIVE = 4;

const POINT_COLORS = ['yellow', 'red', 'orange', 'black', 'red']
const POINT_COLORS_BORDER = ['yellow', 'red', 'orange', 'white', BEZIER_COLOR_ACTIVE];


class Point {

    constructor(x, y) {
        this.move(x, y);
        this.moving = false;
        this.radius = POINT_DRAW_RADIUS;
        this.mode = POINT_STANDARD;
    }

    move(x, y) {
        if (typeof x === 'number' && typeof y === 'number')
            this.x = x, this.y = y;
        else
            throw new Error("Point constructor: at least one argument is not a number");
    }

    draw(ctx) {
        if ('color' in this) {
            ctx.fillStyle = 'color';
        } else {
            ctx.fillStyle = POINT_COLORS[this.mode];
            ctx.strokeStyle = POINT_COLORS_BORDER[this.mode];
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        if (!('color' in this))
            ctx.stroke();
    }
}


class CubicBezier {

    constructor(pts) {
        if (pts.length == 4 && pts[0] instanceof Point && pts[1] instanceof Point && pts[2] instanceof Point && pts[3] instanceof Point) {
            this.points = pts;
            this.calc_center();
        } else {
            throw new Error("CubicBezier constructor: curve must be defined by 4 points");
        }
    }

    /*  the "origin" point used to draw the visual of the linear combination vectors can be any arbitrary point, 
        but the average of the Bezier's four points makes for a good choice visually */

    calc_center() {
        this.origin = new Point(
            this.points.map(p => p.x).reduce((sum, val) => sum + val, 0) / 4,
            this.points.map(p => p.y).reduce((sum, val) => sum + val, 0) / 4
        );
        this.origin.mode = POINT_ORIGIN;
    }

    /*   The Bernstein functions use the Bernstein polynomial form of Bezier curves to calculate the x and y
         values of the curve for a given t parameter; polynomials expressed using Horner's method
         https://en.wikipedia.org/wiki/Bernstein_polynomial */

    points_linear_comb(coefficients) {
        return new Point(
            this.points.map(p => p.x).reduce((sum, val, i) => sum + val * coefficients[i], 0),
            this.points.map(p => p.y).reduce((sum, val, i) => sum + val * coefficients[i], 0)
        );
    }

    calc_bernstein(t) {
        return this.points_linear_comb([
            ((-t + 3)*t - 3)*t + 1, ((3*t - 6)*t + 3)*t, ((-3*t + 3)*t)*t, t*t*t    
        ]);
    }

    calc_bernstein_derivative(t) {
        return this.points_linear_comb([
            (-3*t + 6)*t - 3, (9*t - 12)*t + 3, (-9*t + 6)*t, 3*t*t
        ]);
    }

    calc_bernstein_second_derivative(t) {
        return this.points_linear_comb([-6*t + 6, 18*t - 12, -18*t + 6, 6*t]);
    }


    calc_bounds() {

        function quadratic_formula(a, b, c) {
            let discriminant = b*b - 4*a*c;
            if (discriminant < 0)
                return [];

            return [
                (-b + Math.sqrt(discriminant)) / (2 * a),
                (-b - Math.sqrt(discriminant)) / (2 * a)
            ];
        }

        // the curve passes through the first and last points, so these are potential extrema as per extreme value theorem
        let potential_x = [this.points[0].x, this.points[this.points.length - 1].x];
        let potential_y = [this.points[0].y, this.points[this.points.length - 1].y];

        let a = this.points_linear_comb([-3, 9, -9, 3]);
        let b = this.points_linear_comb([6, -12, 6, 0]);
        let c = this.points_linear_comb([-3, 3, 0, 0]);

        // We find where the derivatives of the x, y components equals 0, these are other potential extrema, domain of t: 0<=t<=1
        for (let root of quadratic_formula(a.x, b.x, c.x)) {
            if (root >= 0 && root <= 1)
                potential_x.push(this.calc_bernstein(root).x);
        }
        for (let root of quadratic_formula(a.y, b.y, c.y)) {
            if (root >= 0 && root <= 1)
                potential_y.push(this.calc_bernstein(root).y);
        }

        return [new Point(Math.min(...potential_x), Math.min(...potential_y)), 
                new Point(Math.max(...potential_x), Math.max(...potential_y))];
    }

    draw(ctx, flags, active) {
        for (let point of this.points)
            point.draw(ctx);

        ctx.strokeStyle = active ? BEZIER_COLOR_ACTIVE : BEZIER_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.bezierCurveTo(this.points[1].x, this.points[1].y, this.points[2].x, this.points[2].y, this.points[3].x, this.points[3].y);
        ctx.stroke();
        ctx.lineWidth = 1;

        if (flags.show_handles)
            this.draw_handles(ctx);

        if (active) {
            if (flags['show_lerps'])
                this.draw_lerps(ctx, this.points, flags.t_param, BEZIER_COLOR_LERPS.slice());

            let P = this.calc_bernstein(flags.t_param);
            let dP = this.calc_bernstein_derivative(flags.t_param);
            let ddP = this.calc_bernstein_second_derivative(flags.t_param);

            P.mode = POINT_ACTIVE;
            P.radius += 1;
            P.draw(ctx);
            
            if (flags['show_box'])
                this.draw_bounds(ctx);

            if (flags['show_lc'])
                this.draw_lc(ctx, flags.t_param);

            if (flags['show_tangent'])
                drawArrow(P.x, P.y, P.x + dP.x / 5, P.y + dP.y / 5, ctx, BEZIER_COLOR_TANGENT);

            if (flags['show_normal']) {
                if (dP.y * ddP.x - dP.x * ddP.y >= 0) {
                    drawArrow(P.x, P.y, P.x + dP.y / 5, P.y - dP.x / 5, ctx, BEZIER_COLOR_NORMAL);
                } else {
                    drawArrow(P.x, P.y, P.x - dP.y / 5, P.y + dP.x / 5, ctx, BEZIER_COLOR_NORMAL);
                }
            }

            if (flags['show_osculating']) {
                let d_len = Math.hypot(dP.x, dP.y);
                let r = ((dP.x * dP.x) + (dP.y * dP.y))**(1.5) / Math.abs(dP.x * ddP.y - dP.y * ddP.x);

                let normal = new Point(dP.y / d_len * r, -dP.x / d_len * r);

                if (normal.x * ddP.x + normal.y * ddP.y < 0) {
                    normal.x *= -1;
                    normal.y *= -1;
                }
                let center_x = P.x + normal.x, center_y = P.y + normal.y;

                drawArrow(P.x, P.y, center_x, center_y, ctx, BEZIER_COLOR_OSCULATING_CIRCLE, 1, 0.5, [2, 5], 3);

                ctx.strokeStyle = BEZIER_COLOR_OSCULATING_CIRCLE;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(center_x, center_y, r, 0, Math.PI * 2);
                ctx.stroke();

                ctx.lineWidth = 1;
            }
        }
    }
    
    /*  Recursively draws linear interpolations between a set of points for a given t parameter, 
        each successive call uses a different color from the colors array */

    draw_lerps(ctx, pts, t, colors) {
        
        function lerp(A, B, t) {
            return new Point(A.x * (1 - t) + B.x * t, A.y * (1 - t) + B.y * t);
        }

        ctx.strokeStyle = colors[0];
        let lerp_points = [];
        for (let i = 0; i < pts.length - 1; i++) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
            ctx.stroke();

            let lerp_pt = lerp(pts[i], pts[i + 1], t);
            lerp_pt.color = ctx.strokeStyle;
            lerp_pt.radius -= 1;
            lerp_pt.draw(ctx);
            lerp_points.push(lerp_pt);
        }
        if (lerp_points.length > 1) {
            this.draw_lerps(ctx, lerp_points, t, colors.slice(1))
        }
    }

    draw_handles(ctx) {
        ctx.strokeStyle = BEZIER_COLOR_LERPS[0];
        ctx.globalAlpha = 0.5;
        for (let a of [[0, 1], [2, 3]]) {
            ctx.beginPath();
            ctx.moveTo(this.points[a[0]].x, this.points[a[0]].y);
            ctx.lineTo(this.points[a[1]].x, this.points[a[1]].y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }

    draw_bounds(ctx) {
        let bounds = this.calc_bounds();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = BEZIER_COLOR_BOUNDS;
        ctx.strokeRect(bounds[0].x, bounds[0].y, bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y);
        ctx.fillStyle = BEZIER_COLOR_BOUNDS;
        ctx.globalAlpha = 0.03;
        ctx.fillRect(bounds[0].x, bounds[0].y, bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y);
        ctx.globalAlpha = 1.0;
    }

    draw_lc(ctx, t) {
        this.origin.draw(ctx);

        // draw dotted vectors between "origin" and curve control points
        for (let i = 0; i < this.points.length; i++) {
            drawArrow(
                this.origin.x, this.origin.y,
                this.points[i].x, this.points[i].y,
                ctx, BERNSTEIN_BOX_COLOR_FUNCS[i], 2, 0.35, [3, 5], 10
            );
        }

        let start_x = this.origin.x, start_y = this.origin.y;

        for (let i = 0; i < this.points.length; i++) {
            let mult = BernsteinBox.functions[i](t);
            let dx = (this.points[i].x - this.origin.x) * mult;
            let dy = (this.points[i].y - this.origin.y) * mult;
            drawArrow(start_x, start_y, start_x + dx, start_y + dy,
                ctx, BERNSTEIN_BOX_COLOR_FUNCS[i], 3, 1.0, [], 5);
            start_x = start_x + dx;
            start_y = start_y + dy;
        }
    }
}


/*  Used enforce C1 continuity between the different cubic bezier that make up a Spline curve.
    The control points of adjacent curves must be symmetric over their shared point */

class MirrorConstraint {

    constructor(start, center, end) {
        this.start = start;
        this.center = center;
        this.end = end;

        this.update_last_pos();
    }

    static calc_mirror(center, endpoint) {
        return {x: 2 * center.x - endpoint.x, y: 2 * center.y - endpoint.y};
    }

    update_last_pos() {
        this.start_last = new Point(this.start.x, this.start.y);
        this.center_last = new Point(this.center.x, this.center.y);
        this.end_last = new Point(this.end.x, this.end.y);
    }

    check_changes() {
        if (this.center.x != this.center_last.x || this.center.y != this.center_last.y) {
            let dx = this.center.x - this.center_last.x;
            let dy = this.center.y - this.center_last.y;

            this.start.x += dx;
            this.start.y += dy;
            this.end.x += dx;
            this.end.y += dy;
        } else if (this.start.x != this.start_last.x || this.start.y != this.start_last.y) {
            let mirror = MirrorConstraint.calc_mirror(this.center, this.start);
            this.end.x = mirror.x, this.end.y = mirror.y;
        } else if (this.end.x != this.end_last.x || this.end.y != this.end_last.y) {
            let mirror = MirrorConstraint.calc_mirror(this.center, this.end);
            this.start.x = mirror.x, this.start.y = mirror.y;
        }

        this.update_last_pos();
    }
}


class Spline {

    constructor() {
        this.curves = [];
        this.constraints = [];
        this.continuity = 1;
        this.next_curve_points = 4;
    }

    add_curve(points) {
        if (Array.isArray(points) ) {
            if (this.curves.length === 0 && points.length === 4) {
                this.curves.push(new CubicBezier(points));
                if (this.continuity === 0) {
                    this.next_curve_points = 3;
                } else if (this.continuity === 1) {
                    this.next_curve_points = 2;
                }
                return;
            } else if (this.curves.length > 0 && points.length === this.next_curve_points) {
                if (this.continuity === 1) {
                    let last_curve = this.curves[this.curves.length - 1];
                    let last_control = last_curve.points[last_curve.points.length - 2];
                    let knot = last_curve.points[last_curve.points.length - 1];

                    let new_control_coords = MirrorConstraint.calc_mirror(knot, last_control);
                    let new_control = new Point(new_control_coords.x, new_control_coords.y);
                    points.unshift(new_control);
                    points.unshift(knot);
                    this.curves.push(new CubicBezier(points));
                    this.constraints.push(new MirrorConstraint(last_control, knot, new_control));
                } else if (this.continuity === 0) {
                    return; // TO DO?: for C0
                }
                return;
            }
        }
        throw new Error("Spline next curve requires array of " + this.next_curve_points + " points.");
    }

    check_constraints() {
        for (let c of this.constraints)
            c.check_changes();
    }

    draw(ctx, flags, active) {
        for (let i = 0; i < this.curves.length; i++)
            this.curves[i].draw(ctx, flags, i === active);
    }
}


class BernsteinBox {
    static functions = [
        function(t) {return ((-t + 3)*t - 3)*t + 1;},
        function(t) {return ((3*t - 6)*t + 3)*t;},
        function(t) {return ((-3*t + 3)*t)*t;},
        function(t) {return t*t*t;}
    ];

    constructor() {
        this.width = 150;
        this.height = 150;
        this.padding = 30;
    }

    draw(ctx, flags) {
        if (!flags['show_lc'])
            return;
        
        ctx.fillStyle = BERNSTEIN_BOX_COLOR_BCKG;
        ctx.fillRect(
            ctx.canvas.width - this.width - this.padding,
            ctx.canvas.height - this.height - this.padding, this.width, this.height);

        for(let i = 0; i < BernsteinBox.functions.length; i++) {
            this.draw_function(ctx, BERNSTEIN_BOX_COLOR_FUNCS[i], BernsteinBox.functions[i]);
        }
        for (let i = 0; i < BernsteinBox.functions.length; i++) {
            let x = this.ctx_x(ctx, flags.t_param);
            let y = this.ctx_y(ctx, BernsteinBox.functions[i](flags.t_param));

            ctx.fillStyle = BERNSTEIN_BOX_COLOR_BCKG
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = BERNSTEIN_BOX_COLOR_FUNCS[i];
            ctx.stroke();

        }

        ctx.strokeStyle = BERNSTEIN_BOX_COLOR_BORDER;
        ctx.strokeRect(
            ctx.canvas.width - this.width - this.padding,
            ctx.canvas.height - this.height - this.padding, this.width, this.height);
    }

    draw_function(ctx, color, func) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(this.ctx_x(ctx, 0), this.ctx_y(ctx, func(0)));
        for (let pixelX = this.ctx_x(ctx, 0) + 1; pixelX <= this.ctx_x(ctx, 1); pixelX++) {
            ctx.lineTo(pixelX, this.ctx_y(ctx, func(this.func_x(ctx, pixelX))));
        }
        ctx.stroke();
    }

     /*  Helper functions to convert between pixel coords on the drawing context and
        Bernstein polynomial function values shown on the graph */

    func_x(ctx, ctx_x) {
        return (ctx_x - ctx.canvas.width + this.width + this.padding) / this.width;
    }
    ctx_x(ctx, x) {
        return ctx.canvas.width - this.width - this.padding + this.width * x;
    }
    ctx_y(ctx, y) {
        return ctx.canvas.height - this.height * y - this.padding;
    }
}