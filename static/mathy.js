const BACKGROUND_COLOR = '#2A383E';

const BEZIER_COLOR = 'red';

const POINT_DRAW_RADIUS = 3;

const POINT_STANDARD = 0;
const POINT_MOVING = 1;
const POINT_FORMING_BEZIER = 2;
const POINT_ORIGIN = 3;

const POINT_COLORS = ['yellow', 'red', 'orange', 'black']
const POINT_COLORS_BORDER = ['yellow', 'red', 'orange', 'white'];


class Point {

    constructor(x, y) {
        this.move(x, y);

        this.radius = POINT_DRAW_RADIUS;
        this.mode = POINT_STANDARD;

        this.visible = true;
        this.moving = false;
    }

    move(x, y) {
        if (typeof x === 'number' && typeof y === 'number')
            this.x = x, this.y = y;
        else
            throw new Error("Point constructor: at least one argument is not a number");
    }

    draw(ctx) {
        ctx.fillStyle = POINT_COLORS[this.mode];
        ctx.strokeStyle = POINT_COLORS_BORDER[this.mode];

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}


class CubicBezier {

    constructor(pts) {
        if (pts.length == 4 && pts[0] instanceof Point && pts[1] instanceof Point && pts[2] instanceof Point && pts[3] instanceof Point) {
            this.points = pts;
            this.calc_center();
            this.box = this.calculate_bounds();

            this.color = BEZIER_COLOR;
            this.mode = POINT_STANDARD;
            this.visible = true;

            this.show_lerps = false;
            this.show_handles = false;
            this.show_box = false;
            this.show_tangent = true;
            this.show_normal = true;
            this.show_lc = true;
            this.show_osculating = true;
            this.color_lerps = ['chocolate', 'coral', 'bisque'];
            this.t_param = 0.5;
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


    calculate_bounds() {

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

    draw(ctx) {
        for (let point of this.points) {
            point.draw(ctx);
        }

        ctx.strokeStyle = this.color;
        if (this.show_lerps || this.show_tangent || this.show_lc) {
            ctx.strokeStyle = 'tomato';
        }
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.bezierCurveTo(this.points[1].x, this.points[1].y, this.points[2].x, this.points[2].y, this.points[3].x, this.points[3].y);
        ctx.stroke();
        ctx.lineWidth = 1;

        let cur_t = this.calc_bernstein(this.t_param);

        if (this.show_lerps) {
            this.draw_lerps(this.points, this.t_param, this.color_lerps, ctx);
        } else if (this.show_handles) {
            this.draw_handles(ctx);
        }
        if (this.show_lerps || this.show_tangent || this.show_normal || this.show_lc || this.show_osculating) {
            cur_t.color = 'red';
            cur_t.radius += 1;
            cur_t.draw(ctx);
        }
        if (this.show_box) {
            let bounds = this.calculate_bounds();
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = 'blue';
            ctx.strokeRect(bounds[0].x, bounds[0].y, bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y);
            ctx.fillStyle = 'blue';
            ctx.globalAlpha = 0.03;
            ctx.fillRect(bounds[0].x, bounds[0].y, bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y);
            ctx.globalAlpha = 1.0;
        }
        if (this.show_tangent || this.show_normal) {
            let deriv = this.calc_bernstein_derivative(this.t_param);
            let der2 = this.calc_bernstein_second_derivative(this.t_param);

            if (this.show_tangent) {
                drawArrow(cur_t.x, cur_t.y, cur_t.x + deriv.x / 5, cur_t.y + deriv.y / 5, ctx, '#FF47A6');
            }

            if (this.show_normal) {
                if (deriv.y * der2.x - deriv.x * der2.y >= 0) {
                    drawArrow(cur_t.x, cur_t.y, cur_t.x + deriv.y / 5, cur_t.y - deriv.x / 5, ctx, '#B6FF72');
                } else {
                    drawArrow(cur_t.x, cur_t.y, cur_t.x - deriv.y / 5, cur_t.y + deriv.x / 5, ctx, '#B6FF72');
                }
            }

            // drawArrow(cur_t.x, cur_t.y, cur_t.x + der2.x / 5, cur_t.y + der2.y / 5, context, 'red' ) 2nd der vector for testing
        }
        if (this.show_lc) {
            this.origin.draw(ctx);

            // draw dotted vectors between "origin" and curve control points
            for (let i = 0; i < this.points.length; i++) {
                drawArrow(
                    this.origin.x, this.origin.y,
                    this.points[i].x, this.points[i].y,
                    ctx, BernsteinBox.colors[i], 2, 0.35, [3, 5], 10
                );
            }

            let start_x = this.origin.x;
            let start_y = this.origin.y;

            for (let i = 0; i < this.points.length; i++) {
                let mult = BernsteinBox.functions[i](this.t_param);
                let dx = (this.points[i].x - this.origin.x) * mult;
                let dy = (this.points[i].y - this.origin.y) * mult;
                drawArrow(start_x, start_y, start_x + dx, start_y + dy,
                    ctx, BernsteinBox.colors[i], 3, 1.0, [], 5);
                start_x = start_x + dx;
                start_y = start_y + dy;
            }
        }
        if (this.show_osculating) {
            let d = this.calc_bernstein_derivative(this.t_param);
            let d2 = this.calc_bernstein_second_derivative(this.t_param);

            let d_len = Math.hypot(d.x, d.y);
            let r = ((d.x * d.x) + (d.y * d.y))**(1.5) / Math.abs(d.x * d2.y - d.y * d2.x);

            let normal = new Point(d.y / d_len * r, -d.x / d_len * r);

            if (normal.x * d2.x + normal.y * d2.y < 0) {
                normal.x *= -1;
                normal.y *= -1;
            }
            let center_x = cur_t.x + normal.x, center_y = cur_t.y + normal.y;

            drawArrow(cur_t.x, cur_t.y, center_x, center_y, ctx, 'white', 1, 0.5, [2, 5], 3);

            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(center_x, center_y, r, 0, Math.PI * 2);
            ctx.stroke();

            ctx.lineWidth = 1;
        }

    }

    draw_handles(context) {
        context.strokeStyle = this.color_lerps[0];
        context.globalAlpha = 0.5;
        for (let a of [[0, 1], [2, 3]]) {
            context.beginPath();
            context.moveTo(this.points[a[0]].x, this.points[a[0]].y);
            context.lineTo(this.points[a[1]].x, this.points[a[1]].y);
            context.stroke();
        }
        context.globalAlpha = 1.0;
    }
        
    draw_lerps(pts, t, colors, context) {

        function lerp(A, B, t) {
            return new Point(A.x * (1 - t) + B.x * t, A.y * (1 - t) + B.y * t);
        }

        context.strokeStyle = colors[0];
        let lerp_points = [];
        for (let i = 0; i < pts.length - 1; i++) {
            context.beginPath();
            context.moveTo(pts[i].x, pts[i].y);
            context.lineTo(pts[i + 1].x, pts[i + 1].y);
            context.stroke();

            let lerp_pt = lerp(pts[i], pts[i + 1], t);
            lerp_pt.color = context.strokeStyle;
            lerp_pt.radius -= 1;
            lerp_pt.draw(context);
            lerp_points.push(lerp_pt);
        }
        if (lerp_points.length > 1) {
            this.draw_lerps(lerp_points, t, colors.slice(1), context)
        }
    }
}


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
        this.active = true; // actively adding new curves to this spline
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
        for (let c of this.constraints) {
            c.check_changes();
        }
    }

    draw(context) {
        for (let curve of this.curves) {
            curve.draw(context);
        }
    }
}

class BernsteinBox {
    static functions = [
        function(t) {return -(t**3) + 3*(t**2) - 3*t + 1;},
        function(t) {return 3*(t**3) - 6*(t**2) + 3*t;},
        function(t) {return -3*(t**3) + 3*(t**2);},
        function(t) {return t**3;}
    ];

    static colors = ['magenta', 'royalblue', 'springgreen', 'yellow'];

    constructor() {
        this.width = 150;
        this.height = 150;
        this.padding = 30;
        this.t_param = 0.0;
    }

    draw(context) {
        context.fillStyle = 'black';
        context.fillRect(
            context.canvas.width - this.width - this.padding,
            context.canvas.height - this.height - this.padding, this.width, this.height);

        for(let i = 0; i < BernsteinBox.functions.length; i++) {
            this.draw_function(context, BernsteinBox.colors[i], BernsteinBox.functions[i]);
        }
        for (let i = 0; i < BernsteinBox.functions.length; i++) {
            let x = this.ctx_x(this.t_param);
            let y = this.ctx_y(BernsteinBox.functions[i](this.t_param));

            context.fillStyle = 'black';
            context.beginPath();
            context.arc(x, y, 3, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = BernsteinBox.colors[i];
            // context.arc(x, y, 4, 0, Math.PI * 2);
            context.stroke();

        }

        context.strokeStyle = 'white';
        context.strokeRect(
            context.canvas.width - this.width - this.padding,
            context.canvas.height - this.height - this.padding, this.width, this.height);
    }

     /*  Helper functions to convert between pixel coords on the drawing context and
        Bernstein polynomial function values shown on the graph */
    func_x(ctx_x) {
        return (ctx_x - context.canvas.width + this.width + this.padding) / this.width;
    }
    ctx_x(x) {
        return context.canvas.width - this.width - this.padding + this.width * x;
    }
    ctx_y(y) {
        return context.canvas.height - this.height * y - this.padding;
    }

    draw_function(context, color, func) {
        context.strokeStyle = color;
        context.beginPath();
        context.moveTo(this.ctx_x(0), this.ctx_y(func(0)));
        for (let pixelX = this.ctx_x(0) + 1; pixelX <= this.ctx_x(1); pixelX++) {
            context.lineTo(pixelX, this.ctx_y(func(this.func_x(pixelX))));
        }
        context.stroke();
    }
}