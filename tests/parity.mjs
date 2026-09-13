// Renders fixed setups with the panel's JS renderer and prints them as JSON for tests/test_relight.py.
import { renderBallFloat, renderVentiFloat, directionPhrase, altitudeBand, kelvinRgb, lightRoles } from '../web/relight_render.js';
import { DATA } from '../web/relight_data.js';
const cases = JSON.parse(process.argv[2]);
const out = cases.map(c => Array.from(c.style === 'venti' ? renderVentiFloat(c.lights, c.w, c.h) : renderBallFloat(c.lights, c.background, c.style, c.w, c.h, c.opts || {})));
const words = [-180, -135, -91, -46, -22, 0, 22, 23, 44, 90, 135, 157, 158, 180, 270, 359].map(a => directionPhrase(a));
const bands = [-40, -15, -14, 0, 32, 33, 57, 58, 79, 80, 90].map(altitudeBand);
const kelvins = [1000, 1500, 1800, 2500, 3200, 4500, 5600, 6500, 7000, 8500, 10000].map(kelvinRgb);
const roles = DATA.presets.map(p => lightRoles(p.lights));
const { pointerToHeading } = await import('../web/sun_compass.js');
const compass = [[50, 0], [100, 50], [50, 100], [0, 50], [50, 50], [99, 1]].map(([x, y]) => pointerToHeading(50, 50, x, y));
process.stdout.write(JSON.stringify({ out, words, bands, kelvins, roles, compass }));
