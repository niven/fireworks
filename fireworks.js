let GRAVITY = v3(0, 9.8, 0); // m/s^2
let PI_2 = 2 * Math.PI;

let v0 = v3( 0, 0, 0 );

var DEBUG = true;
var SAMPLES = false;

// in pixels
let CANVAS_WIDTH = 1200;
let CANVAS_HEIGHT = 600;

// in meters
let WORLD_WIDTH = CANVAS_WIDTH;
let WORLD_HEIGHT = 600;

let BALL_SIZE = 30;
let BALL_SIZE_MIN = 10;

let FIREFLY_SPEED = 2;

var SMOKE_ON = true;
var SMOKE_DENSITY = 3;
var SMOKE_ARC_DEGREES = 15;

var FIRE_DENSITY = 4;
var FIRE_SIZE_MIN = 0.5;
var FIRE_SIZE_MAX = 8;

var ROCKET_HALO_COUNT = 5;
// we want the rockets to explode at about 2/3rds of the height of the canvas
// TODO: actual math here. Too early and I've had too little tea
let ROCKET_VELOCITY_Y = -250;

var STAR_SIZE = 3;

var SPRAY_MAX_AGE_MS = 1 * 1000;
var SPRAY_STAR_SPAWN_RATE = 50; // per second
var TWINKLE_FACTOR = 1;

let COLOR_FADE_NONE = 1; // Keep the color at 100%
let COLOR_FADE_DEFAULT = 0.98;
let COLOR_MIN = 20.0; // cutoff color value for removing fireflies
let GRADIENT_WIDTH = 100;
	
// control values for playing around, read from the DOM, but set a global to
// avoid reading world.controls.smoke_density.value every frame a billion times
var control_values_need_update = true;
var controls = {

	"debug_toggle": { "dom_id": "debug_toggle", "var": "DEBUG" },
	"samples_toggle": { "dom_id": "samples_toggle", "var": "SAMPLES" },

	"smoke_toggle": { "dom_id": "smoke_toggle", "var": "SMOKE_ON" },
	"smoke_density": { "dom_id": "smoke_density", "var": "SMOKE_DENSITY" },
	"smoke_arc": { "dom_id": "smoke_arc", "var": "SMOKE_ARC_DEGREES" },

	"fire_size_start": { "dom_id": "fire_size", "var": "FIRE_SIZE_MAX" },
	"fire_size_min": { "dom_id": "fire_size_min", "var": "FIRE_SIZE_MIN" },

	"rocket_halo_count": { "dom_id": "rocket_halo_count", "var": "ROCKET_HALO_COUNT" },

	"star_size": { "dom_id": "star_size", "var": "STAR_SIZE" },
	"twinkle": { "dom_id": "twinkle", "var": "TWINKLE_FACTOR" },
}

var world = {
	"fireflies": [],
	"rockets": [],
	"sprays": [],
	"balls": [],
	"lines": [],
	"smoke": [],
	"stars": [],
	"dots": [],
	"fire": [],
};

var ctx;
var fire_gradient;
var fire_colors;
var water_gradient;
var water_colors;

var running = true;
var frame_render_time_ms = new Array( 100 );

let COLOR_WHITE = v3( 255, 255, 255 );
let colors = [
	v3(200, 20, 20),
	v3(250, 250, 0),
	v3(150, 240, 150),
	v3(80, 250, 250),
	v3(250, 20, 150),
	v3(127,255,212), // aquamarine
	v3(153,50,204), // darkorchid
	v3(255,215,0 ), // gold
	v3(255,165,0), // orange
];

let use_preballs = false;
var preballs = [
	
	{
		"color" : colors[0],
		"position" : v3( 100, 105, 0),
		"velocity" : v3( 3, -3, 0),
		"radius": 50,
		"id" : 1,
	},
	{
		"color" : colors[1],
		"position" : v3( 400, 200, 0),
		"velocity" : v3( -5, 1, 0),
		"radius": 50,
		"id" : 2,
	},

];

function pick_color() {
   return colors[Math.floor(Math.random()*colors.length)];
}

function css_string_from_color( color ) {
   return 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
}

function mouse_coords_from_event( e ) {
	var x = 0;
	var y = 0;
	if (!e) var e = window.event;
	if (e.pageX || e.pageY) 	{
		x = e.pageX;
		y = e.pageY;
	}
	else if (e.clientX || e.clientY ){
		x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
		y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
	}

	return v3( x - e.originalTarget.offsetLeft, y - e.originalTarget.offsetTop, 0 );
}

function read_control_values() {

	for( var key in controls ) {
		let el = document.getElementById( controls[key].dom_id );
		var new_value = null;
		switch( el.type ) {
			case "checkbox": {
				new_value = el.checked;
				break;
			}
			default:
				new_value = Number.parseFloat( el.value );
		}
		
		// console.log( key + " from " + window[controls[key].var] + " to " + new_value );
		window[ controls[key].var ] = new_value;
	}

	if( !DEBUG ) {
		world.lines = [];
		world.dots = [];
	}

	control_values_need_update = false;
}

/************** Create world objects **************************/

function firefly( position, color, velocity ) {
	
   world.fireflies.push(
		{ 
			"position": position,
			"color": color, 
			"velocity": velocity
		} 
	);
}

function line( start, delta, velocity, color, optional_rotation_rad, optional_fade ) {
	
	world.lines.push(
		{
			"start": start,
			"delta": delta,
			"velocity": velocity,
			"color": color,
			"rotation": optional_rotation_rad || 0,
			"fade": optional_fade || COLOR_FADE_DEFAULT,
		}
	);
}

function rocket( position, velocity ) {

	world.rockets.push(
		{
			"position": position,
			"color": pick_color(),
			"velocity": velocity,
			"radius": 3,
			"time": Date.now()
		}
	);
}

function ball( pos ) {

	let velocity_x = rnd( 150, -150 );
	let velocity_y = rnd( 150, -150 );
	
	world.balls.push(
		{
	   	"color": pick_color(),
	      "position": pos,
	      "velocity": v3( velocity_x, velocity_y, 0),
	      "radius": rnd( BALL_SIZE, BALL_SIZE_MIN ),
	      "id": Date.now(),
		}
	);
}

function spray( position, velocity, color ) {
	
	world.sprays.push(
		{
			"position": position,
			"velocity": velocity,
			"color": color,
			"stars_spawned": 0,
			"age": 0,
		}
	);
}

function dot( position, velocity, size, color ) {

	world.dots.push(
		{
			"position": position,
			"velocity": velocity,
			"size": size,
			"color": color
		}
	);
}

function star( position, velocity, size, color ) {
	
	// the rotation does not cost more to animation, just how the "twinkle" effect looks
	// fast: very winkly, slow some other nice effect
	world.stars.push(
		{
			"position": position,
			"velocity": velocity,
			"size": size,
			"color": color,
			"rotation": rnd( 0, PI_2 )
		}
	);
}

/********************* effects ************************/

function smoke( position, velocity ) {
	
	if( !SMOKE_ON ) {
		return;
	}
	
	let angle_range_degrees = SMOKE_ARC_DEGREES;
	let angle_range_radians = PI_2 * angle_range_degrees / 360;
	let vopp_small = mul( velocity, 0.015 );
	let smoke_col = v3( 80, 80, 80 );
	for( var i=0; i<SMOKE_DENSITY; i++ ) {
		let angle = rnd( angle_range_radians/2, -angle_range_radians/2 );
		smoke_v = rotate( vopp_small, angle );
		world.smoke.push( { "position": position, "velocity": smoke_v, "color": mul( smoke_col, Math.random() * .4 ), "radius": 5 } );
	}

}

function fire( position, velocity ) {
	
	let angle_range_degrees = SMOKE_ARC_DEGREES;
	let angle_range_radians = PI_2 * angle_range_degrees / 360;
	let smoke_col = v3( 200, 90, 90 );
	for( var i=0; i<FIRE_DENSITY; i++ ) {
		let angle = rnd( angle_range_radians/2, -angle_range_radians/2 );
		fire_v = rotate( velocity, angle );
		fire_v = mul( fire_v, 1 + Math.random() * 0.1 );
		world.fire.push( { "position": position, "velocity": fire_v, "color": mul( smoke_col, Math.random() * .4 ), "radius": rnd(FIRE_SIZE_MAX, FIRE_SIZE_MIN), "age": 0 } );
	}

}

function flutter( position, velocity ) {
	let ctx = document.getElementById("scene").getContext("2d");

	let vopposite = mul( velocity, -1 );
	
	ctx.strokeStyle = 'mediumorchid';
	let vopp_small = mul( vopposite, 0.5 );
	let angle_range_degrees = 90;
	let angle_range_radians = PI_2 * angle_range_degrees / 360;
	for( var i=0; i<10; i++ ) {
		let angle = rnd( angle_range_radians/2, -angle_range_radians/2 );
		ctx.beginPath();
		endpoint = add( position, rotate( vopp_small, angle ) );
		ctx.moveTo( position.x, position.y );
		ctx.lineTo( endpoint.x, endpoint.y );
		ctx.stroke();		
	}
	
}

/*************** Setup ***********************/

function create_initial_objects() {

	if( use_preballs ) {
		world.balls = preballs;
	}

	// let spray_color = pick_color();
	// let spray_loc = v3(300, 200, 0);
	// spray( spray_loc, v3(150, -130,0), spray_color );
	// spray( spray_loc, v3(130, 150,0), spray_color );
	// spray( spray_loc, v3(-130, 150,0), spray_color );
	// spray( spray_loc, v3(-130, -150,0), spray_color );
	// spray( spray_loc, v3(0, -150,0), spray_color );
	// spray( spray_loc, v3(0, 150,0), spray_color );
	// spray( spray_loc, v3(150, 0,0), spray_color );
	// spray( spray_loc, v3(-150, 0,0), spray_color );
	// // rocket( v3(400, world.height - 1, 0), v3( 0, ROCKET_VELOCITY_Y, 0) );
	//
	// let center = v3(600, 200, 0);
	// let N = 5;
	// let vectors = radial_vectors( N );
	// console.log( vectors);
	// for( var i=0; i<N; i++) {
	// 	spray( center, mul(vectors[i], 150), spray_color );
	// 	line( center, mul(vectors[i], 200), v0, COLOR_WHITE );
	// }
	
	
}

function setup_input( canvas_element ) {

	document.body.onkeydown = function( event ) {
		switch(event.key) {
		    case "p": {
				event.preventDefault();
				running = !running; // toggle run/pause
				break;
		    }
		    case "s": {
				event.preventDefault();
				DEBUG = !DEBUG; // toggle stats
				break;
		    }
			 // space bar
			 case " ": {
				event.preventDefault();
				if( world.rockets.length < 10 ) {
					// let v = v3( rnd( 20, 10 ), rnd( -6 * GRAVITY.y, -2 * GRAVITY.y ), 0 );
					let v = v3( rnd( 5, -5 ), rnd( 1 * ROCKET_VELOCITY_Y, 0.9 * ROCKET_VELOCITY_Y), 0 );
					let pos = v3( rnd( world.width * 0.9, world.width * 0.1) , world.height - 1, 0);
					rocket( pos, v );					
				}
				break;
			 }
		 default:
	 		console.log("KEYPRESS key: " + event.key);
		}
	};
	
	canvas_element.onclick = function( click ) {
		let pos = mouse_coords_from_event( click );
		ball( pos );
	};

}

function create_materials() {
	
	fire_gradient = make_gradient( [
		[1, 'lightyellow'],
		[0.95, 'sandybrown'],
		[0.7, 'orangered'],
		[0.2, 'firebrick'],
		[0, 'maroon']
	], GRADIENT_WIDTH);
	
	fire_colors = css_colors_from_gradient( fire_gradient );

	water_gradient = make_gradient( [
		[1.0, 'dodgerblue'],
		[0.3, 'deepskyblue'],
		[0.0, 'powderblue']
	], GRADIENT_WIDTH);

	water_colors = css_colors_from_gradient( water_gradient );

}

function main() {

	var c = document.createElement("canvas");

	setup_input( c );

	c.setAttribute("width", CANVAS_WIDTH);
	c.setAttribute("height", CANVAS_HEIGHT);
	c.setAttribute("id", "scene");
	document.body.appendChild(c);

	world.width = WORLD_WIDTH;
	world.height = WORLD_HEIGHT;
	
	world.bottom = world.height;
	world.top = 0;
	world.left = 0;
	world.right = world.width;
	
	create_initial_objects();
	
	let trigger_reread_control_values = function() { control_values_need_update = true };
	Object.keys(controls).forEach( name => document.getElementById( controls[name].dom_id ).onchange = trigger_reread_control_values );

	create_materials();

	ctx = document.getElementById("scene").getContext("2d", { alpha: false });
	ctx.globalCompositeOperation = "lighter";
	ctx.font = "10px Menlo";

	world.time_at_frame_end = Date.now();
	world.last_time_ms = 0;

	window.requestAnimationFrame( draw );
}

function make_gradient( stops, size ) {
	
	let canvas = document.createElement("canvas");
	canvas.setAttribute("width", size);
	canvas.setAttribute("height", 10); // for rendering
	
	let ctx = canvas.getContext("2d");
	let gradient = ctx.createLinearGradient(0, 0, size, 1);
	for( var i=0; i<stops.length; i++ ) {
		gradient.addColorStop( stops[i][0],  stops[i][1] );
	}

	// Set the fill style and draw a rectangle
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, 1);

	return ctx.getImageData(0, 0, size, 1);
}

function css_colors_from_gradient( gradient ) {

	var result = [];
	for( var i=0; i<GRADIENT_WIDTH; i++ ) {
		result[i] = 'rgb(' + gradient.data[4*i + 0] + ',' + gradient.data[4*i + 1] + ',' + gradient.data[4*i + 2] + ')';
	}

	return result;
}

function draw_samples( ctx ) {
	
	// stationary smoke
	let base_vector = v3( -100, -20, 0 );
	let origin_2 = v3( 1000, 200, 0);
	smoke( origin_2, base_vector );

	// fire
	let origin_3 = v3( 400, 350, 0);
	let base_vector_3 = v3( 0, -30, 0 );
	fire( origin_3, base_vector_3 );

	// fire with smoke
	let origin_4 = v3( 500, 350, 0);
	fire( origin_4, base_vector_3 );
	smoke( origin_4, base_vector_3 );
	
	// works nice as a one off effect
	let origin_5 = v3( 600, 350, 0 );
	star( origin_5, v3(200,-100,0), STAR_SIZE, colors[1] );

}

function draw_debug( ctx ) {

	draw_stats( ctx );
	draw_values( ctx );
	
	ctx.fillStyle = 'rgb(255,255,255)'; // white
	ctx.fillText('Fire gradient ', 100, 10);
	ctx.putImageData(fire_gradient, 190, 5);

	ctx.fillText('Water gradient', 100, 20);
	ctx.putImageData(water_gradient, 190, 15);	
}

function draw_values( ctx ) {

	ctx.fillStyle = 'rgb(255,255,255)'; // white

	var y = 10;
	for( var key in controls ) {
		ctx.fillText(key + ': ' + window[ controls[key].var ], world.width-200, y);
		y += 10;
	}
	
}

function draw_stats( ctx ) {

	ctx.fillStyle = 'rgb(255,255,255)'; // white

	let avg_render_time = Math.ceil( frame_render_time_ms.reduce( (acc, cur) => acc += cur, 0 ) / 100 );
	ctx.fillText('Frame ms ' + avg_render_time, 10, 10);

	ctx.fillText('Fireflies ' + world.fireflies.length, 10, 20);
	ctx.fillText('Smoke     ' + world.smoke.length, 10, 30);
	ctx.fillText('Fire      ' + world.fire.length, 10, 40);
	ctx.fillText('Lines     ' + world.lines.length, 10, 50);
	ctx.fillText('Dots      ' + world.dots.length, 10, 60);
	ctx.fillText('Sprays    ' + world.sprays.length, 10, 70);
	ctx.fillText('Stars     ' + world.stars.length, 10, 80);
	ctx.fillText('Rockets   ' + world.rockets.length, 10, 90);
	ctx.fillText('Balls     ' + world.balls.length, 10, 100);
}

function draw( time_since_start_rendering_ms ) {

	let time_delta_ms = time_since_start_rendering_ms - world.last_time_ms;
	world.last_time_ms = time_since_start_rendering_ms;
	
	let time_start = Date.now();

	let time_delta_seconds = time_delta_ms / 1000;

	if( !running ) {
		window.requestAnimationFrame( draw );
		return;
	}

	if( control_values_need_update ) {
		read_control_values();		
	}

	ctx.clearRect(0 ,0, CANVAS_WIDTH, CANVAS_HEIGHT);

	// set background
	ctx.fillStyle = 'rgb(0,0,0)'; // black
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

	if( DEBUG ) {
		draw_debug( ctx );
	}
	if( SAMPLES ) {
		draw_samples( ctx );
	}

	animate_dots( time_delta_ms );

	animate_balls( time_delta_ms );
	
	animate_rockets( time_delta_ms );

	animate_fireflies();

	animate_smoke();

	animate_fire( time_delta_ms );
	
	animate_lines( time_delta_ms );

	animate_sprays( time_delta_ms );

	animate_stars( time_delta_ms );
	
	let time_end = Date.now();
	frame_render_time_ms.push( time_end - time_start );
	frame_render_time_ms.shift();
	
	window.requestAnimationFrame( draw );
}

function animate_fire( time_passed_ms ) {
	
	for( var i=0; i<world.fire.length; i++ ) {
		
		let f = world.fire[i];

		let color_index = Math.floor( GRADIENT_WIDTH * ( (f.radius - FIRE_SIZE_MIN) / (FIRE_SIZE_MAX - FIRE_SIZE_MIN) ) );
		
	   ctx.beginPath();
	   ctx.fillStyle = fire_colors[color_index];
	   ctx.arc(f.position.x, f.position.y, f.radius, 0, PI_2, false);
	   ctx.closePath();
	   ctx.fill();

	   f.radius *= 0.96;
		f.position = add( f.position, mul( f.velocity, time_passed_ms/1000 ) );
		
		f.age += time_passed_ms;
	}

	world.fire = world.fire.filter( f => f.radius > FIRE_SIZE_MIN );	
}

function animate_smoke() {
	
	for( var i=0; i<world.smoke.length; i++) {
		let s = world.smoke[i];
	   ctx.beginPath();
	   ctx.fillStyle = css_string_from_color(s.color); // calling this a lot for the same color probably
	   ctx.arc(s.position.x, s.position.y, s.radius, 0, PI_2, false);
	   ctx.fill();

		s.radius *= 1.02;
	   s.position.x += s.velocity.x;
	   s.position.y += s.velocity.y;
		
		s.velocity.x *= 0.98;
		s.velocity.y *= 0.99;

	   s.color = mul(s.color, 0.96 );
	}

	world.smoke = world.smoke.filter( s => s.radius < 50 || (s.color.r > COLOR_MIN) );
}

function animate_fireflies() {

	world.fireflies.forEach(function(el, idx, ar){
		let screen_coords = screen_coords_from_world_coords( el.position );
	   ctx.beginPath();
	   ctx.fillStyle = css_string_from_color(el.color); // calling this a lot for the same color probably
	   ctx.arc( screen_coords.x, screen_coords.y, 3, 0, PI_2, false);
	   ctx.fill();

	   el.color = mul(el.color, 0.96 );
	   el.position.x += el.velocity.x;
	   el.position.y += el.velocity.y;
	});

	world.fireflies = world.fireflies.filter( f => (f.color.r > COLOR_MIN) || (f.color.g > COLOR_MIN) || (f.color.b > COLOR_MIN) );
}

function screen_coords_from_world_coords( position ) {
	let result = v3(
		position.x / WORLD_WIDTH * CANVAS_WIDTH,
		position.y / WORLD_HEIGHT * CANVAS_HEIGHT,
		position.z
	);
	return result;
}

function animate_rockets( time_delta_ms ) {
	
	// explode any rockets that have reached their maximum height (ish, it's easier to explode them when they slow down)
	world.rockets = world.rockets.filter( rocket => in_bounds( rocket.position, world.width, world.height) ); // only retain ones that are in view
	//
	let rocket_explode_velocity = -60; // m/s

	world.rockets.filter( rocket => rocket.velocity.y >= rocket_explode_velocity ).forEach( function( el, idx, arr ) {
		console.log ("splde");
		// poly does random 3,4,5,6 sides, plus circle plus spray there are 6 options
		let fraction = Math.random();
		if( fraction < 1/6 ) {
			rocket_burst_circle( el.position, 40, el.color );
		} else if( fraction < 2/6 ) {			
			rocket_burst_spray( el.position, 150, el.color );
		} else {
			rocket_burst_poly( el.position, 40, el.color );
		}
	});
	world.rockets = world.rockets.filter( rocket => rocket.velocity.y < rocket_explode_velocity );
	
	let time_delta_seconds = time_delta_ms / 1000;
	
	for( var i=0; i<world.rockets.length; i++ ) {
		let r = world.rockets[i];
		console.log( r.velocity );
		let screen_coords = screen_coords_from_world_coords( r.position );

		smoke( screen_coords, mul( r.velocity, -1 ) );

		if( DEBUG ) {
			dot( screen_coords, v0, 2, colors[0] );
		}

	   ctx.beginPath()
	   ctx.fillStyle = css_string_from_color(r.color);
	   ctx.arc( screen_coords.x, screen_coords.y, r.radius, 0, PI_2, false);
	   ctx.fill();
		
		// update position based on speed and time passed
	   r.position = add( r.position, mul( r.velocity, time_delta_seconds ) );
		// vertical speed is reduced by gravity (adding because y speed is negative)
		r.velocity = add( r.velocity, mul(GRAVITY, time_delta_seconds) );
		r.velocity.y += 50 * time_delta_seconds; // "fuel spent"
		
	}
	
}

function animate_balls( time_passed_ms ) {
	
	let time_passed_seconds = time_passed_ms / 1000;
	var collisionIndex = 0;
	world.balls.forEach(function(el, idx, ar){

	   el.position.x += time_passed_seconds * el.velocity.x;
	   if(el.position.x + el.radius > world.width || el.position.x - el.radius < 0) {
		   el.velocity.x = -el.velocity.x; // reverse
	      // reposition: make sure the distances are correct, now it doesn't exactly bounce
	      el.position.x += time_passed_seconds * 2 * el.velocity.x;
	      el.radius = burst(el);
	   }
	   el.position.y += time_passed_seconds * el.velocity.y;
	   if(el.position.y + el.radius > world.height || el.position.y - el.radius < 0) {
	      el.velocity.y = -el.velocity.y; // reverse
	      // reposition: make sure the distances are correct, now it doesn't exactly bounce
	      el.position.y += time_passed_seconds * 2 * el.velocity.y;

	      let burstPoint = {
	         "color": el.color,
	         "velocity": el.velocity,
	         "position": el.position,
				"radius": el.radius
	      };
	     	el.radius = burst( burstPoint );

	   }
	   // check for collisions between balls
	   for(var i=collisionIndex; i<world.balls.length; i++) {
	      if(el.id == world.balls[i].id) {
	         return; // itself (shouldn't this be continue???)
	      }
	      if(intersect(el.position, el.radius, world.balls[i].position, world.balls[i].radius)) {

	         collisionIndex += i; // don't need to check again, col ab == col ba
	         var other = world.balls[i];
	         var burstPoint = {
	            "color": mul( add(el.color, world.balls[i].color), 0.5),
	            "velocity": sub(el.velocity, world.balls[i].velocity ),
	            "position": mul( add( el.position, world.balls[i].position), 0.5 ),
	            "radius": 5
	         };
				console.log("collision burst", burstPoint);
			
	         burst(burstPoint);
				// TODO: based on impact
				el.radius = 0.95 * el.radius;
				world.balls[i].radius = 0.95 * world.balls[i].radius;
			
			
				// change direction
				// math here
				// tut: http://www.director-online.com/buildArticle.php?id=532
				var b2 = el;
				var b1 = world.balls[i];
				var dx = b2.position.x - b1.position.x;
				var dy = b2.position.y - b1.position.y;
				var phi = dx == 0 ? Math.PI/2 : Math.atan(dy/dx);

				var v1i = length(b1.velocity);
				var v2i = length(b2.velocity);
				var theta1 = Math.atan2(b1.velocity.y, b1.velocity.x);
				var theta2 = Math.atan2(b2.velocity.y, b2.velocity.x);
				//console.log("theta_1: ", theta1 / Math.PI, " theta2: ", theta2 /Math.PI , " v1: ", v1i, " v2: ", v2i);
				// find the velocities in the new coords system
				var v1x_cm = v1i * Math.cos(theta1-phi);
				var v1y_cm = v1i * Math.sin(theta1-phi);
				var v2x_cm = v2i * Math.cos(theta2-phi);
				var v2y_cm = v2i * Math.sin(theta2-phi);
				//console.log("CM: v1x", v1x_cm, " v1y", v1y_cm, " v2x ", v2x_cm," v2y ", v2y_cm);

				// find the final velocities in the normal reference frame
				// the x velocities will obey the rules for a 1-D collision
				var m1 = b1.radius * b1.radius * Math.PI;
				var m2 = b2.radius * b1.radius * Math.PI;
				var u1x_cm = ((m1-m2)*v1x_cm+(m2+m2)*v2x_cm)/(m1+m2);
				var u2x_cm = ((m1+m1)*v1x_cm+(m2-m1)*v2x_cm)/(m1+m2);
				// the y velocities will also obey the rules for a 1-D collision
				var u1y_cm = ((m1-m2)*v1y_cm+(m2+m2)*v2y_cm)/(m1+m2);
				var u2y_cm = ((m1+m1)*v1y_cm+(m2-m1)*v2y_cm)/(m1+m2);

				// convert back to the standard x,y coordinates
				b1.velocity.x = Math.cos(phi)*u1x_cm+Math.cos(phi+Math.PI/2)*u1y_cm;
				b1.velocity.y = Math.sin(phi)*u1x_cm+Math.sin(phi+Math.PI/2)*u1y_cm;
				b2.velocity.x = Math.cos(phi)*u2x_cm+Math.cos(phi+Math.PI/2)*u2y_cm;
				b2.velocity.y = Math.sin(phi)*u2x_cm+Math.sin(phi+Math.PI/2)*u2y_cm;
				//console.log(b1, b2);
   
	      }
   
	   }

	});

	// draw balls
	world.balls.forEach(function(el, idx, ar){
	   ctx.beginPath()
	   ctx.fillStyle = css_string_from_color(el.color);
	   ctx.arc(el.position.x, el.position.y, el.radius, 0, PI_2, false);
	   ctx.closePath();
	   ctx.fill();
	});

	// remove any balls that are size 0 now
	world.balls = world.balls.filter( ball => ball.radius > 0 );
}

function animate_sprays( time_delta_ms ) {

	let time_delta_seconds = time_delta_ms / 1000;
	let gravity_drop = mul( GRAVITY, 3 * time_delta_seconds ); // gravity 10x since they go so fast
	let trail_angle_rad = PI_2 * (30/360);
	
	world.sprays = world.sprays.filter( s => in_bounds( s.position, world.width, world.height ) );
	world.sprays = world.sprays.filter( s => s.age < SPRAY_MAX_AGE_MS );
	
	for( var i=0; i<world.sprays.length; i++ ) {
		let s = world.sprays[i];
		s.age += time_delta_ms;

		// determines how wide the trail is
		let angle = rnd( trail_angle_rad, -trail_angle_rad );
		let star_direction = rotate( s.velocity, angle );
		let star_velocity = mul( star_direction, 0.08 );

		// spawn stars according to the spawn rate
		let stars_total = s.age * SPRAY_STAR_SPAWN_RATE / 1000;
		// WRONGGGG: multiple stars will have the same position and vector!
		for( var star_i = s.stars_spawned; star_i < stars_total; star_i++ ) {
			star( s.position, star_velocity, STAR_SIZE, s.color )
			s.stars_spawned++;
		}
		if( DEBUG ) {
			let delta = mul( s.velocity, time_delta_seconds );
			line( s.position, delta, v0, COLOR_WHITE, null, COLOR_FADE_NONE );
		}
		
		s.position = add( s.position, mul( s.velocity, time_delta_seconds ) );
		s.velocity = add( s.velocity, gravity_drop );
	}
	
}

function draw_line( from, to, color ) {

   ctx.beginPath();
   ctx.strokeStyle = css_string_from_color( color ); // calling this a lot for the same color probably
   ctx.moveTo( from.x, from.y );
   ctx.lineTo( to.x, to.y );
   ctx.stroke();
}

function animate_dots( time_passed_ms ) {
	
	let time_passed_seconds = time_passed_ms / 1000;
	
	world.dots = world.dots.filter( d => in_bounds( d.position, world.width, world.height ) );
	
	for( var i=0; i<world.dots.length; i++ ) {
		
		let d = world.dots[i];
		
	   ctx.beginPath();
	   ctx.fillStyle = css_string_from_color(d.color); // calling this a lot for the same color probably
	   ctx.arc(d.position.x, d.position.y, d.size, 0, PI_2, false);
	   ctx.fill();
		
		d.position = add( d.position, mul( d.velocity, time_passed_seconds) );
	}
	
}

function animate_lines( time_passed_ms ) {
	
	world.lines = world.lines.filter( l => (l.color.r > COLOR_MIN) || (l.color.g > COLOR_MIN) || (l.color.b > COLOR_MIN) );
	
	for( var i=0; i<world.lines.length; i++) {
		let l = world.lines[i];

		draw_line( l.start, add( l.start, l.delta ), l.color );

		if( l.rotation != 0 ) {
			l.delta = rotate( l.delta, 60 * time_passed_ms/1000 * l.rotation );			
		}
		// l.color = mul( l.color, l.fade );
		let distance = mul( l.velocity, time_passed_ms/1000 );
		l.start = add( l.start, distance );
	}
	
}

function animate_stars( time_passed_ms ) {
	
	
	// draw a + sign, several times overlapping, smaller each time to get a gradient
	// then rotate it for next time

	world.stars = world.stars.filter( s => ( in_bounds( s.position, world.width, world.height) ) && ( (s.color.r > COLOR_MIN) || (s.color.g > COLOR_MIN) || (s.color.b > COLOR_MIN) ) );

	let time_passed_seconds = time_passed_ms / 1000;
	let angles = 4;
	for( var i=0; i<world.stars.length; i++ ) {
		let s = world.stars[i];
		
		// console.log( angle_offset );
	   for( var a = 0; a < angles; a++ ) {
			let angle = s.rotation + ( a/angles * PI_2 );
	      let x = Math.cos( angle );
	      let y = Math.sin( angle );

			let min_distance = s.size / 3;
			let max_distance = s.size;
			let step = (max_distance - min_distance) / 3;
			for( var d = min_distance; d < max_distance; d += step) {
				let end = v3( d * x + s.position.x, d * y + s.position.y, 0); // outward from the center_velocity
				draw_line( v3(s.position.x, s.position.y, 0), end, s.color );
			}
   	}
		
		s.color = mul( s.color, COLOR_FADE_DEFAULT );
		s.position = add( s.position, mul( s.velocity, time_passed_ms/1000 ) );
		s.rotation = rnd( 0, PI_2 );
	}

}

// create a bunch of fading fireflies at the edge of circle (or point)
function burst( ball ) {

	let mass = ball.radius * ball.radius;
	let speed = length(ball.velocity);
	let momentum = mass * speed;
	
	let momentum_loss = 0.3 * momentum;
	let mass_after = (momentum - momentum_loss) / speed; // elastic collision
	let radius_after = mass_after < 20 ? 0 : Math.sqrt( mass_after ); // evaporate is when it becomes too small
	// console.log("BS: " + speed, "r: " + ball.radius + ' -> ' + radius_after);

	// for performance, cap it
	let fireflies_count = Math.min( 100, momentum_loss );
   for(var i=0; i<fireflies_count; i++) {
      // make sure they all start at the edge of the ball
      let angle = PI_2 * Math.random();
      let x = ball.radius * Math.cos(angle) + ball.position.x;
      let y = ball.radius * Math.sin(angle) + ball.position.y;
		let color = mul( ball.color, Math.random() + 0.5 ); // some brigther, some less -> feels more natural
		firefly( v3( x, y, 0), color,  v3( (Math.random() - 0.5)*4, (Math.random() - 0.5)*4, 0 ) );
   }
   return radius_after;
}

function rocket_burst_poly( center, power, base_color ) {

	// create concentric squares of fireflies around the center
	// What direction? out from center or in pure x or y?
	
	// distance is from center to corner
	let min_distance = 5;
	let max_distance = 50;
	let step = (max_distance - min_distance) / ROCKET_HALO_COUNT;
	let angle_offset = rnd( 0, PI_2 );
	
	let poly = rnd_int( 3, 7 );
	
	for( var d = min_distance; d < max_distance; d += step) {

		// calculate where the corners of a square with size 2d are
		let corners = [];
      for( var i = 0; i < poly; i++ ) {
			let angle = ( angle_offset + ( i/poly * PI_2) ) % PI_2;
	      let x = d * Math.cos(angle) + center.x;
	      let y = d * Math.sin(angle) + center.y;
			let end = v3( x, y, 0);
			corners.push( end );
			if( DEBUG ) {
				let screen_coords_center = screen_coords_from_world_coords( center );
				let screen_coords_end = screen_coords_from_world_coords( end );
				line( v3(screen_coords_center.x, screen_coords_center.y, 0), v3( screen_coords_end.x - screen_coords_center.x, screen_coords_end.y - screen_coords_center.y ), v3(0,0,0), base_color, null, COLOR_FADE_NONE );				
			}	
      }

		// for each line with those corners as endpoints make N fireflies
		for( var i = 0; i < poly; i++ ) {
			let c1 = corners[i];
			let c2 = corners[ (i+1) % poly ];
			let diff = sub( c2, c1 );
			if( DEBUG ) {
				let screen_coords_c1 = screen_coords_from_world_coords( c1 );
				line( screen_coords_c1, diff, v3(0,0,0), base_color, null, COLOR_FADE_NONE );				
			}	

			let fireflies_count = Math.min( 10, power * d );
			for( var j = 0; j < fireflies_count; j++ ) {
				// any point along the line [c1, c2] is c1 + [0,1] * (c2-c1);
				let pos = add( c1, mul( diff, Math.random() ) );
				let center_velocity = mul( v3( pos.x - center.x, pos.y - center.y, 0), FIREFLY_SPEED *  1/max_distance);
				let color = mul( base_color, Math.random() + 0.7 ); // some brigther, some less -> feels more natural
				firefly( pos, color, center_velocity );
			}
		}
		
	}

}

function rocket_burst_circle( center, power, base_color ) {

	let min_distance = 5;
	let max_distance = 50;
	let step = (max_distance - min_distance) / ROCKET_HALO_COUNT;

	for( var radius = min_distance; radius < max_distance; radius += step) {

		// for performance, cap it
		let fireflies_count = Math.min( 40, power * radius );
	   for(var i=0; i<fireflies_count; i++) {
	      // create a circle of fireflies
	      let angle = PI_2 * Math.random();
	      let x = radius * Math.cos(angle) + center.x;
	      let y = radius * Math.sin(angle) + center.y;
		
			let color = mul( base_color, Math.random() + 0.5 ); // some brigther, some less -> feels more natural
			let center_velocity = mul( v3( x - center.x, y - center.y, 0), FIREFLY_SPEED *  1/max_distance);
			firefly( v3( x, y, 0), color, center_velocity );
	   }
	}

}

function rocket_burst_spray( center, power, base_color ) {

	let N = rnd_int( 9, 4 );
	let vectors = radial_vectors( N );
	console.log( vectors);
	for( var i=0; i<N; i++) {
		spray( center, mul(vectors[i], power), mul(base_color, 10) );
		if( DEBUG ) {
			line( center, mul(vectors[i], power), v0, COLOR_WHITE, null, COLOR_FADE_NONE );			
		}
	}

}

function in_bounds( position, width, height ) {
	return position.x > 0 && position.x < width && position.y > 0 && position.y < height;
}

// random float number from [0, max) or [min, max)
// min is optional
function rnd( max, min ) {

	min = min || 0;
	return min + Math.random() * (max-min);
}

function rnd_int( max, min ) {

	min = min || 0;
	return min + Math.floor(Math.random() * (max-min));
}

/********** Vector and math ******************/

function v3( a, b, c ) {
	return {
		"x": a, "y": b, "z": c,
		"r": a, "g": b, "b": c,
	};
}

function add( v1, v2 ) {
	let result = {};
	for( e in v1 ) {
		result[e] = v1[e] + v2[e];
	}
	return result;
}

function sub( v1, v2 ) {
	let result = {};
	for( e in v1 ) {
		result[e] = v1[e] - v2[e];
	}
	return result;
}

function mul( v, s ) {
	let result = {};
	for( e in v ) {
		result[e] = v[e] * s;
	}
	return result;
}

function length( v ) {
	return Math.sqrt( v.x*v.x + v.y*v.y + v.z*v.z );
}

function inner(u, v) {
   if(length(u) != length(v)) {
      console.log("Inner product fail: velocity's not of equal length", u, v);
      return -1;
   }
   var sum = 0;
   for(var i=0; i<length(u); i++) {
      sum += u[i] * v[i];
   }
   return sum;
}

function angle(v1, v2) {
   return Math.acos( inner(v1, v2) / ( length(v1) * length(v2) ) );
}

function unit( v ) {
	return mul( v, 1/length(v) );
}

function intersect(p1, r1, p2, r2) {
   return length( v3( p1.x-p2.x, p1.y-p2.y, 0 ) ) < (r1 + r2);
}

function rotate( vector, angle ) {
	
	let x1 = vector.x * Math.cos( angle ) - vector.y * Math.sin( angle );
	let y1 = vector.x * Math.sin( angle ) + vector.y * Math.cos( angle );

	return v3( x1, y1, 0 );
}

// create N unit vectors out from point
// Note: these are always the same, just translated. Precompute this for N=2,3,4,5,6,7 maybe?
// 		but what about rotations?
function radial_vectors( N ) {

	let result = [];
   for( var i = 0; i < N; i++ ) {
		let angle = i/N * PI_2;
      let x = Math.cos(angle);
      let y = Math.sin(angle);
		result.push( unit( v3(x, y, 0) ) );
	}

	return result;
}
