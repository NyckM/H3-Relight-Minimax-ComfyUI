"""Relight H3 da Bruxos do VFX: light planning for ethanfel's H3 Edit, compiled locally into prompts.

The panel in web/ writes one JSON widget. This module turns it into:
  * a lighting reference image (a lit sphere) for the encoder's reference_image, i.e. <Picture 2>;
  * a complete H3 prompt that follows the MiniMax Relight skill: analyse, plan each light's role,
    direction, intensity, softness and colour, keep it physically coherent, preserve the subject;
  * the 14 option keys the H3 Edit encoder reads.
No API calls. numpy is needed for the render; torch is imported only when ComfyUI hands us tensors.
"""
import json
import math
import os
import re

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))


def _load_data():
    text = open(os.path.join(HERE, 'web', 'relight_data.js'), encoding='utf-8').read()
    return json.loads(text[text.index('{'):text.rindex('}') + 1])


DATA = _load_data()
LIGHT_TYPES = DATA['light_types']
BACKGROUNDS = DATA['backgrounds']
EFFECTS = {e['id']: e for e in DATA['effects']}
PRESETS = {p['id']: p for p in DATA['presets']}
LIMITS = DATA['limits']
FPS = 24.0

# Direction words follow the light-direction-ball convention (Eric Venti's Sun-Direction LoRA, also used by
# the LTX-2.3 Relight IC-LoRA): rotation 0 is the camera side, 90 is frame right, 180 is behind the subject.
DIRECTIONS = ['the front', 'the front-right', 'the right', 'the back-right', 'behind', 'the back-left',
              'the left', 'the front-left']
LTX_TRIGGER = 'relight the video to match the light-direction ball.'

RUNTIME_TASKS = {
    'still | 5-frame relight': dict(quality='recommended | 5-frame context -> 1 image', frames=5, directed=False),
    'still | 13-frame relight': dict(quality='high | 13-frame context -> 1 image', frames=13, directed=False),
    'directed | 39-frame settle': dict(quality='directed change | 39-frame settle -> 1 image', frames=39,
                                       directed=True),
}
PRIMARY_ANCHOR = 'edit | strong scene anchor (FL2VA)'
PRIMARY_NATIVE = 'generate | native Picture 1 (REF2VA)'
SUBJECTS = ['auto', 'portrait', 'product', 'scene / exterior']
STRENGTHS = ['subtle', 'balanced', 'strong']
REFERENCE_MODES = ['semantic sphere (Picture 2)', 'text only']
BALL_STYLES = ['sphere (MiniMax)', 'sphere + ground shadow (LTX/Venti)']

DEFAULT_LIGHTING = json.dumps(dict(version=1, preset=None, lights=[dict(DATA['default_light'])],
                                   background='default', effect='default'))


# --------------------------------------------------------------------------------------------- parsing

def _clamp(value, low, high):
    return max(low, min(high, value))


def _number(value, field):
    if isinstance(value, str):
        value = value.strip().rstrip('°Kk').strip()
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f'{field} must be a number, got {value!r}.') from None
    if isinstance(value, bool) or not math.isfinite(number):
        raise ValueError(f'{field} must be a finite number.')
    return number


def _hex(value):
    text = str(value or '').strip().lower()
    if re.fullmatch(r'#[0-9a-f]{3}', text):
        text = '#' + ''.join(ch * 2 for ch in text[1:])
    if not re.fullmatch(r'#[0-9a-f]{6}', text):
        raise ValueError(f'Light color must be #RRGGBB, got {value!r}.')
    return text


def _light(item, index):
    if not isinstance(item, dict):
        raise ValueError(f'Light {index} must be an object.')
    # Accept both this node's keys and the MiniMax skill's (lightType / lightness / horizontalAngle ...).
    kind = item.get('type', item.get('lightType', 'spotlight'))
    if kind not in LIGHT_TYPES:
        raise ValueError(f'Light {index}: type must be one of {", ".join(LIGHT_TYPES)}.')
    if 'intensity' in item:
        intensity = _number(item['intensity'], 'intensity')
    elif 'lightness' in item:
        intensity = _number(item['lightness'], 'lightness') * 10
    else:
        intensity = 50
    azimuth = _number(item.get('azimuth', item.get('horizontalAngle', 0)), 'azimuth')
    elevation = _number(item.get('elevation', item.get('verticalAngle', 0)), 'elevation')
    has_kelvin = 'kelvin' in item or 'colorTemp' in item
    mode = item.get('colorMode') or ('kelvin' if has_kelvin and 'color' not in item else 'hex')
    if mode not in ('hex', 'kelvin'):
        raise ValueError(f'Light {index}: colorMode must be hex or kelvin.')
    kelvin = _number(item.get('kelvin', item.get('colorTemp', 6500)), 'kelvin')
    color = _hex(item.get('color', '#ffffff'))
    lo, hi = LIMITS['intensity']
    if not lo <= intensity <= hi:
        raise ValueError(f'Light {index}: intensity must be {lo}..{hi}.')
    # Wrap azimuth instead of rejecting it: the MiniMax presets use -180..180, the ball convention 0..360.
    azimuth = ((azimuth + 180) % 360) - 180
    if azimuth == -180:
        azimuth = 180.0
    if not -90 <= elevation <= 90:
        raise ValueError(f'Light {index}: elevation must be -90..90.')
    if mode == 'kelvin' and not LIMITS['kelvin'][0] <= kelvin <= LIMITS['kelvin'][1]:
        raise ValueError(f'Light {index}: kelvin must be {LIMITS["kelvin"][0]}..{LIMITS["kelvin"][1]}.')
    return dict(type=kind, intensity=round(intensity), azimuth=round(azimuth), elevation=round(elevation),
                colorMode=mode, color=color, kelvin=int(round(_clamp(kelvin, *LIMITS['kelvin']))))


def parse_lighting(raw):
    """Normalise the panel JSON. Also reads the MiniMax Relight skill payloads, so a setup can be pasted."""
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except (TypeError, ValueError) as exc:
        raise ValueError('lighting must be JSON.') from exc
    if isinstance(data, list):
        # MiniMax rawPrompt: [{"id": "setting", "data": "{...}"}, {"id": "light1", "data": "{...}"}]
        items = {entry.get('id'): entry.get('data') for entry in data if isinstance(entry, dict)}
        data = {k: (json.loads(v) if isinstance(v, str) and v else v) for k, v in items.items()}
        setting = data.pop('setting', None) or {}
        data = dict(setting, **data)
    if not isinstance(data, dict):
        raise ValueError('lighting must be a JSON object.')
    lights = data.get('lights')
    if lights is None:
        # MiniMax generate params: light1/light2/light3 as JSON strings, empty when unused.
        lights = []
        for key in ('light1', 'light2', 'light3'):
            value = data.get(key)
            if isinstance(value, str):
                value = json.loads(value) if value.strip() else None
            if value:
                lights.append(value)
    if not isinstance(lights, list) or not LIMITS['lights'][0] <= len(lights) <= LIMITS['lights'][1]:
        raise ValueError('Use between 1 and 3 lights.')
    background = data.get('background') or data.get('studioMode') or 'default'
    if background not in BACKGROUNDS:
        raise ValueError(f'background must be one of {", ".join(BACKGROUNDS)}.')
    effect = (data.get('effect') or data.get('effectType') or 'default').strip()
    if effect != 'default' and effect not in EFFECTS:
        raise ValueError(f'Unknown atmosphere effect {effect!r}.')
    preset = data.get('preset')
    return dict(lights=[_light(item, i + 1) for i, item in enumerate(lights)], background=background,
                effect=effect, preset=preset if preset in PRESETS else None)


def minimax_params(lighting):
    """The same setup in the MiniMax Relight skill's generate params (light1..3 as JSON strings)."""
    out = {}
    for i in range(3):
        if i < len(lighting['lights']):
            light = lighting['lights'][i]
            entry = dict(lightType=light['type'], lightness=f"{light['intensity'] / 10:.1f}",
                         azimuth=f"{light['azimuth']}°", elevation=f"{light['elevation']}°")
            if light['colorMode'] == 'kelvin':
                entry['kelvin'] = f"{light['kelvin']}K"
            else:
                entry['color'] = light['color']
            out[f'light{i + 1}'] = json.dumps(entry, ensure_ascii=False)
        else:
            out[f'light{i + 1}'] = ''
    out['background'] = lighting['background']
    out['effect'] = lighting['effect']
    return out


# --------------------------------------------------------------------------------------------- colour

def kelvin_rgb(kelvin):
    table = DATA['kelvin_table']
    k = _clamp(kelvin, table[0][0], table[-1][0])
    for a, b in zip(table, table[1:]):
        if a[0] <= k <= b[0]:
            u = 0 if b[0] == a[0] else (k - a[0]) / (b[0] - a[0])
            # Same rounding as the skill's Ne(): the panel shows the identical swatch.
            return tuple(int(math.floor(a[i] + (b[i] - a[i]) * u + 0.5)) for i in (1, 2, 3))
    return tuple(table[-1][1:])


def light_rgb(light):
    if light['colorMode'] == 'kelvin':
        return kelvin_rgb(light['kelvin'])
    value = light['color']
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))


def srgb_to_linear(values):
    c = np.asarray(values, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(values):
    x = np.clip(values, 0.0, 1.0)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def light_direction(azimuth, elevation):
    a, e = math.radians(azimuth), math.radians(elevation)
    return np.array([math.cos(e) * math.sin(a), math.sin(e), math.cos(e) * math.cos(a)])


def light_strength(light):
    # Same curve as the skill's three.js reference, scaled for the exponential tone curve below.
    return (light['intensity'] / 100 * 3.2 + 0.3) * LIGHT_TYPES[light['type']]['factor'] * 0.55


# --------------------------------------------------------------------------------------------- render

def render_ball(lights, background='default', style='sphere', width=1024, height=1024, fraction=None,
                center=None, plate=None):
    """Orthographic ray-cast of a white sphere under up to three lights. Returns HxWx3 float32 in 0..1.

    style 'sphere' is the MiniMax reference: a sphere on a flat plate.
    style 'sun' adds a ground plane seen from 25 degrees above with the true cast shadow of every light,
    the light-direction-ball convention. web/relight_render.js runs the same arithmetic for the preview.
    """
    width, height = max(1, int(width)), max(1, int(height))
    bg = BACKGROUNDS[background]
    sun = style == 'sun'
    pitch = math.radians(25.0 if sun else 0.0)
    fraction = fraction or (0.36 if sun else 0.46)
    cx, cy = center or ((0.5, 0.38) if sun else (0.5, 0.5))
    plate = np.array(plate if plate is not None else ((173, 173, 173) if sun else bg['plate']), dtype=np.float64)
    s = 2.0 / (fraction * min(width, height))  # world units per pixel; sphere radius is 1
    d = np.array([0.0, -math.sin(pitch), -math.cos(pitch)])
    up = np.array([0.0, math.cos(pitch), -math.sin(pitch)])
    view = -d
    sphere_y = 1.08 if sun else 0.0
    px = (np.arange(width) + 0.5 - cx * width) * s
    py = -(np.arange(height) + 0.5 - cy * height) * s
    u, v = np.meshgrid(px, py)
    r2 = u * u + v * v
    r = np.sqrt(r2)
    coverage = np.clip((1.0 - r) / s + 0.5, 0.0, 1.0)
    depth = np.sqrt(np.clip(1.0 - np.minimum(r2, 0.9999), 0.0, 1.0))
    n = u[..., None] * np.array([1.0, 0.0, 0.0]) + v[..., None] * up + depth[..., None] * view
    n /= np.linalg.norm(n, axis=-1, keepdims=True)

    sky = np.ones(3)
    ground = srgb_to_linear(bg['ground'])
    hemi = (n[..., 1:2] + 1) / 2
    light_sum = bg['ambient'] + bg['hemisphere'] * (ground + (sky - ground) * hemi)
    spec_sum = np.zeros_like(n)
    for light in lights[:3]:
        kind = LIGHT_TYPES[light['type']]
        L = light_direction(light['azimuth'], light['elevation'])
        color = srgb_to_linear(light_rgb(light))
        power = light_strength(light)
        ndl = n @ L
        diffuse = np.maximum(0.0, (ndl + kind['wrap']) / (1 + kind['wrap']))
        light_sum = light_sum + (power * diffuse)[..., None] * color
        if kind['spec'] > 0:
            half = (L + view) / max(np.linalg.norm(L + view), 1e-9)
            spec = kind['spec'] * np.power(np.maximum(n @ half, 0.0), kind['shininess']) * (ndl > 0)
            spec_sum = spec_sum + (power * spec)[..., None] * color
    # A light behind the sphere shades only the hidden half, so a physically plain render of a backlight is
    # a flat grey disc that says nothing. Rim and halo terms make the backlight readable, biased to its side.
    ndv = np.clip(n @ view, 0.0, 1.0)
    halo = np.zeros((height, width, 3))
    outside = np.clip(r - 1.0, 0.0, None)
    for light in lights[:3]:
        L = light_direction(light['azimuth'], light['elevation'])
        back = max(0.0, -float(L @ view))
        if back <= 0.0:
            continue
        kind = LIGHT_TYPES[light['type']]
        color = srgb_to_linear(light_rgb(light))
        power = light_strength(light)
        flat = L - (L @ view) * view
        norm = np.linalg.norm(flat)
        if norm > 1e-3:
            flat = flat / norm
            side = np.clip(0.35 + 0.65 * (n @ flat), 0.0, 1.0)
            ring = u * flat[0] + v * (flat @ up)
            ring_side = np.clip(0.35 + 0.65 * ring / np.maximum(r, 1e-6), 0.0, 1.0)
        else:
            side = np.ones((height, width))
            ring_side = np.ones((height, width))
        rim = back * (1.0 - ndv) ** 3 * side * kind['rim']
        spec_sum = spec_sum + (power * rim)[..., None] * color
        if not sun:
            glow = back * np.exp(-outside * 9.0) * ring_side * kind['rim'] * 0.22 * power * (r > 1.0)
            halo = halo + glow[..., None] * color
    radiance = 0.85 * light_sum + spec_sum
    ball = linear_to_srgb(1.0 - np.exp(-radiance))

    base = np.broadcast_to(plate / 255.0, (height, width, 3)).copy()
    base = np.clip(base + halo, 0.0, 1.0)
    if sun:
        # Ground point hit by each pixel's ray; the sphere floats just above it.
        origin_y = sphere_y + v * up[1] - 10 * d[1]
        t = origin_y / -d[1]
        gx = u
        gz = v * up[2] - 10 * d[2] + t * d[2]
        weights = np.array([light_strength(l) for l in lights[:3]])
        weights = weights / max(weights.sum(), 1e-9)
        darkness = np.zeros((height, width))
        for light, weight in zip(lights[:3], weights):
            kind = LIGHT_TYPES[light['type']]
            L = light_direction(light['azimuth'], light['elevation'])
            if L[1] <= 0.02:
                continue  # a light at or below the horizon casts no ground shadow in view
            vx, vy, vz = -gx, sphere_y, -gz  # from ground point to sphere centre
            along = vx * L[0] + vy * L[1] + vz * L[2]
            dist = np.sqrt(np.maximum((vx - along * L[0]) ** 2 + (vy - along * L[1]) ** 2
                                      + (vz - along * L[2]) ** 2, 0.0))
            soft = kind['penumbra'] * (0.25 + np.maximum(along, 0.0) * 0.35) + 0.02
            edge = np.clip((1.0 + soft - dist) / (2 * soft), 0.0, 1.0)
            shadow = edge * edge * (3 - 2 * edge) * (along > 0)
            darkness = np.maximum(darkness, shadow * kind['shadow'] * (0.45 + 0.55 * weight))
        base = base * (1.0 - 0.72 * darkness[..., None])
    out = base + (ball - base) * coverage[..., None]
    return out.astype(np.float32)


# Sphere-Light-Render's scene (js/preview.js there), the ball convention the Sun-Direction and LTX-2.3 Relight
# LoRAs read. Brightness is calibrated to the LTX card (lit plane about 173, shadow about 65); the GIF of that node
# shows a darker build of the same scene, and the LTX card says any correctly rendered ball works. Perspective camera, fov 35, at (0, 6, 8) looking at (0, -0.5, 0); a #cccccc sphere of radius 1 resting
# on a #8a8a8a plane at y = -1; ambient 0.2; directional lights; no tone mapping, sRGB output.
VENTI_EYE = np.array([0.0, 6.0, 8.0])
VENTI_TARGET = np.array([0.0, -0.5, 0.0])
VENTI_FOV = 35.0


def venti_camera():
    forward = VENTI_TARGET - VENTI_EYE
    forward = forward / np.linalg.norm(forward)
    right = np.array([1.0, 0.0, 0.0])
    up = np.array([0.0, -forward[2], forward[1]])
    return forward, right, up


def venti_intensity(light):
    """The relight 10..100 scale onto Sphere-Light-Render's 0..3 intensity: 50 is its default 1.5."""
    return light['intensity'] / 100 * 3.0


def render_venti(lights, width=512, height=512):
    width, height = max(1, int(width)), max(1, int(height))
    forward, right, up = venti_camera()
    th = math.tan(math.radians(VENTI_FOV / 2))
    aspect = width / height
    x = ((np.arange(width) + 0.5) / width * 2 - 1) * th * aspect
    y = (1 - (np.arange(height) + 0.5) / height * 2) * th
    X, Y = np.meshgrid(x, y)
    d = forward + X[..., None] * right + Y[..., None] * up
    d /= np.linalg.norm(d, axis=-1, keepdims=True)
    eye = VENTI_EYE
    b = d @ eye
    cc = float(eye @ eye)
    closest = np.sqrt(np.maximum(cc - b * b, 0.0))
    pixel = 2 * th / height * math.sqrt(cc)
    coverage = np.clip((1.0 - closest) / pixel + 0.5, 0.0, 1.0) * (b < 0)
    t = -b - np.sqrt(np.maximum(b * b - cc + 1.0, 0.0))
    n = eye + t[..., None] * d
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    tp = (-1.0 - eye[1]) / d[..., 1]
    P = eye + tp[..., None] * d
    sphere = np.full(n.shape, 0.2)
    plane = np.full(n.shape, 0.2)
    spec = np.zeros(n.shape)
    view = -d
    for light in lights[:3]:
        kind = LIGHT_TYPES[light['type']]
        L = light_direction(light['azimuth'], light['elevation'])
        color = srgb_to_linear(light_rgb(light))
        power = venti_intensity(light)
        ndl = np.maximum(n @ L, 0.0)
        sphere = sphere + (power * ndl)[..., None] * color
        half = L + view
        half /= np.linalg.norm(half, axis=-1, keepdims=True)
        spec = spec + (power * 0.05 * np.power(np.maximum(np.sum(n * half, axis=-1), 0.0), 6) * (ndl > 0))[..., None] * color
        if L[1] > 0:
            v = -P
            along = v @ L
            dist = np.linalg.norm(v - along[..., None] * L, axis=-1)
            soft = 0.02 + 0.08 * kind['penumbra'] * np.maximum(along, 0.0)
            edge = np.clip((1.0 + soft - dist) / (2 * soft), 0.0, 1.0)
            lit = 1.0 - edge * edge * (3 - 2 * edge) * (along > 0)
            plane = plane + (power * L[1] * lit)[..., None] * color
    sphere_rgb = linear_to_srgb(srgb_to_linear((204, 204, 204)) * sphere + spec)
    plane_rgb = linear_to_srgb(srgb_to_linear((138, 138, 138)) * plane)
    out = plane_rgb + (sphere_rgb - plane_rgb) * coverage[..., None]
    return out.astype(np.float32)


def ltx_patch_geometry(width, height):
    """Ball patch size and margin scaled from the LTX training frame: 143 px, 22 px margin at 1280x704."""
    scale = math.sqrt(width * height / (1280 * 704))
    return max(24, int(round(143 * scale))), max(2, int(round(22 * scale)))


# --------------------------------------------------------------------------------------------- words

def direction_index(azimuth):
    return int(math.floor(((azimuth % 360) + 22.5) / 45.0)) % 8


def direction_phrase(azimuth):
    return DIRECTIONS[direction_index(azimuth)]


def altitude_band(elevation):
    """The LTX bands for exteriors, with two ends added for studio lights."""
    if elevation <= -15:
        return 'from below'
    if elevation < 33:
        return 'low'
    if elevation < 58:
        return 'mid'
    if elevation < 80:
        return 'high'
    return 'overhead'


def _height_words(elevation):
    band = altitude_band(elevation)
    if band == 'from below':
        return f'from below the subject ({elevation:g} degrees, an uplight)'
    if band == 'overhead':
        return f'from directly overhead ({elevation:g} degrees, a top light)'
    if elevation < -3:
        return f'just below eye level ({elevation:g} degrees)'
    if elevation < 8:
        return 'at eye level'
    words = {'low': 'low', 'mid': 'at mid height', 'high': 'high'}[band]
    return f'{words}, {elevation:g} degrees above the horizon'


def _side_words(azimuth):
    index = direction_index(azimuth)
    if index in (1, 2, 3):
        return ('It sits on the viewer\'s right side of the frame, which is the subject\'s own left when the '
                'subject faces the camera.')
    if index in (5, 6, 7):
        return ('It sits on the viewer\'s left side of the frame, which is the subject\'s own right when the '
                'subject faces the camera.')
    if index == 0:
        return 'It sits on the camera side, facing the subject.'
    return 'It sits behind the subject, facing back toward the camera.'


def _shadow_words(azimuth, elevation):
    if elevation >= 80:
        return 'Cast shadows pool short and directly beneath the subject.'
    index = direction_index(azimuth)
    fall = {0: 'straight back behind the subject, mostly hidden by it',
            1: 'back and toward the viewer\'s left', 2: 'toward the viewer\'s left',
            3: 'forward toward the camera and to the viewer\'s left', 4: 'forward, toward the camera',
            5: 'forward toward the camera and to the viewer\'s right', 6: 'toward the viewer\'s right',
            7: 'back and toward the viewer\'s right'}[index]
    length = ('long' if elevation < 20 else 'medium-length' if elevation < 50 else 'short')
    facing = {0: 'surfaces facing the camera', 1: 'surfaces facing the camera and the viewer\'s right',
              2: 'surfaces facing the viewer\'s right', 3: 'edges on the viewer\'s right and the back',
              4: 'the outline and back edges', 5: 'edges on the viewer\'s left and the back',
              6: 'surfaces facing the viewer\'s left', 7: 'surfaces facing the camera and the viewer\'s left'}[index]
    if elevation <= -15:
        return (f'Highlights land on the undersides of {facing}; shadows are thrown upward, above and behind the '
                f'subject.')
    return f'Highlights land on {facing}; {length} cast shadows fall {fall}.'


def _kelvin_words(kelvin):
    if kelvin < 2000:
        return 'deep amber, candle and firelight warmth'
    if kelvin < 2800:
        return 'warm orange tungsten'
    if kelvin < 3600:
        return 'warm tungsten'
    if kelvin < 4800:
        return 'slightly warm neutral'
    if kelvin < 6000:
        return 'neutral daylight white'
    if kelvin < 7500:
        return 'cool daylight'
    if kelvin < 9000:
        return 'cool blue'
    return 'deep cold blue'


def _hex_words(rgb):
    r, g, b = (c / 255 for c in rgb)
    high, low = max(r, g, b), min(r, g, b)
    lightness = (high + low) / 2
    chroma = high - low
    if chroma < 0.08:
        return 'neutral white' if lightness > 0.85 else 'neutral grey-white'
    saturation = chroma / (1 - abs(2 * lightness - 1)) if lightness not in (0, 1) else 0
    if high == r:
        hue = 60 * (((g - b) / chroma) % 6)
    elif high == g:
        hue = 60 * ((b - r) / chroma + 2)
    else:
        hue = 60 * ((r - g) / chroma + 4)
    names = [(12, 'red'), (35, 'orange'), (50, 'amber'), (68, 'yellow'), (95, 'yellow-green'),
             (150, 'green'), (175, 'teal'), (195, 'cyan'), (215, 'sky blue'), (245, 'blue'),
             (270, 'violet'), (292, 'purple'), (330, 'magenta'), (350, 'pink'), (361, 'red')]
    name = next(label for limit, label in names if hue < limit)
    tone = ('deep ' if lightness < 0.32 else 'pale ' if lightness > 0.78 else '')
    vivid = 'saturated ' if saturation > 0.7 and not tone else ''
    return f'{vivid}{tone}{name}'


def color_words(light):
    rgb = light_rgb(light)
    if light['colorMode'] == 'kelvin':
        return f'{_kelvin_words(light["kelvin"])} ({light["kelvin"]}K)'
    return f'{_hex_words(rgb)} ({light["color"].upper()})'


def _is_warm(light):
    if light['colorMode'] == 'kelvin':
        return light['kelvin'] < 4000
    r, g, b = light_rgb(light)
    return r > b + 40 and r >= g


def _is_cool(light):
    if light['colorMode'] == 'kelvin':
        return light['kelvin'] > 6500
    r, g, b = light_rgb(light)
    return b > r + 30


def _intensity_words(intensity):
    level = intensity / 10
    if level <= 2.5:
        return 'faint'
    if level <= 4.5:
        return 'moderate'
    if level <= 6.5:
        return 'bright'
    if level <= 8.5:
        return 'strong'
    return 'very strong'


def light_roles(lights):
    """Key is the strongest light; lights behind become rims, the rest fills or second keys."""
    order = sorted(range(len(lights)), key=lambda i: (-lights[i]['intensity'], i))
    key = order[0]
    roles = {}
    for i, light in enumerate(lights):
        back = direction_index(light['azimuth']) in (3, 4, 5)
        if i == key:
            roles[i] = 'backlight key' if back and len(lights) == 1 else 'key light'
        elif back:
            roles[i] = 'rim light'
        elif light['intensity'] >= 0.8 * lights[key]['intensity']:
            roles[i] = 'second key light'
        else:
            roles[i] = 'fill light'
    return key, roles


def light_sentence(light, role, key_light=None):
    kind = light['type']
    softness = {
        'spotlight': 'a hard, direct source: crisp sharp-edged shadows and bright specular highlights',
        'rectAreaLight': 'a soft, large diffused source: gentle wrap-around light and feathered shadow edges',
        'directionalLight': 'broad skylight: very soft, even and directional, with faint diffuse shadows',
    }[kind]
    relative = ''
    if key_light is not None and key_light is not light:
        share = round(100 * light['intensity'] / max(key_light['intensity'], 1))
        relative = f' at about {share}% of the key\'s strength'
    return (f'{role[0].upper() + role[1:]}: {_intensity_words(light["intensity"])}{relative}, '
            f'{color_words(light)}, coming from {direction_phrase(light["azimuth"])} '
            f'(azimuth {light["azimuth"]:g}), '
            f'{_height_words(light["elevation"])}. It is {softness}. {_side_words(light["azimuth"])} '
            f'{_shadow_words(light["azimuth"], light["elevation"])}')


def ltx_look(light):
    """Map the key light to one of the 12 looks the LTX-2.3 Relight IC-LoRA was trained on."""
    index = direction_index(light['azimuth'])
    hard = light['type'] == 'spotlight'
    el = light['elevation']
    if index in (3, 4, 5):
        return 'strong backlight with rim light' if hard else 'soft hazy backlight'
    if light['type'] == 'directionalLight' and light['intensity'] <= 40:
        return 'dim overcast light'
    if _is_warm(light) and el < 33:
        return 'warm golden low front sun' if index in (0, 1, 7) else 'warm golden low side sun'
    if hard:
        if el >= 58:
            return 'hard high-angle sunlight'
        if el < 33 and index not in (0,):
            return 'hard low-angle sunlight'
        if index == 0:
            return 'frontal sunlight'
        return 'hard directional sunlight'
    if _is_warm(light) or (light['colorMode'] == 'kelvin' and light['kelvin'] < 4800):
        return 'soft warm afternoon light'
    if _is_cool(light):
        return 'cool soft daylight'
    return 'soft diffused daylight'


def ltx_prompt(lighting):
    key, _ = light_roles(lighting['lights'])
    light = lighting['lights'][key]
    return f'{LTX_TRIGGER} {ltx_look(light)} from {direction_phrase(light["azimuth"])}'


# --------------------------------------------------------------------------------------------- prompt

BACKGROUND_WORDS = {
    'default': ('Keep the original background and environment. Relight it with the same lights as the subject, '
                'so the background receives the same direction and colour of light; do not replace or restyle it.'),
    'black': ('Replace the background with a seamless studio-black backdrop. No environment remains visible; the '
              'subject separates cleanly from the black, and light falls off into darkness around it.'),
    'white': ('Replace the background with a seamless studio-white, high-key backdrop. The subject keeps clean '
              'edges and a soft grounded contact shadow; no environment remains visible.'),
}
SUBJECT_WORDS = {
    'auto': '',
    'portrait': (' Keep natural, believable skin tones and real skin texture; the eyes keep their shape and '
                 'gain catchlights that agree with the key direction; no change to makeup, age or face shape.'),
    'product': (' Keep the product\'s exact silhouette, proportions, colours, labels and legible text; '
                'reflections and specular highlights on glossy, metallic or glass surfaces move to agree with '
                'the new lights.'),
    'scene / exterior': (' Keep the architecture, terrain, vegetation, sky layout and object placement; for an '
                         'exterior, treat the key light as the sun and keep the sky brightness coherent with it.'),
}
STRENGTH_WORDS = {
    'subtle': ('Gentle relight: move the lighting toward this plan while keeping much of the original exposure and '
               'mood. Prefer preservation over change.'),
    'balanced': 'Replace the original lighting with this plan.',
    'strong': ('Complete, unmistakable relight: remove every trace of the original light direction. Shadows and '
               'highlights must make the new key direction obvious at a glance, with clear separation between the '
               'key, fill and rim roles rather than extra effects.'),
}
PRESERVE = ('Preserve the subject and the scene exactly: identity, facial features, expression, pose, proportions, '
            'hair, wardrobe, product shape, materials, surface textures, printed text and logos, scene geometry, '
            'composition, framing, lens and camera position. Only the light changes: its direction, intensity, '
            'colour, shadows, highlights, reflections and colour spill. Where people appear, skin keeps a natural, '
            'believable tone and texture. Subject edges stay clean and the separation from the background stays '
            'believable.')
AZIMUTH_WORDS = ('Azimuth is measured around the subject starting from the camera: 0 is the camera side, +90 the '
                 "viewer's right, 180 directly behind the subject, -90 the viewer's left.")
FORBID = ('Neutral colours stay neutral except where a coloured light tints them. No new objects, people, text, '
          'watermarks or geometry, no identity change, no subject motion and no camera motion.')


def picture2_words():
    return ('<Picture 2> is a lighting reference only: a plain white sphere shaded by exactly the target lights. '
            'Read the light direction from its bright side and shadow terminator, the softness from how gradual '
            'that terminator is, and the colour from its tint. Do not copy the sphere, its grey background, or '
            'anything else from <Picture 2> into the image.')


def lighting_plan(lighting, subject):
    lights = lighting['lights']
    key, roles = light_roles(lights)
    key_light = lights[key]
    ordered = [key] + [i for i in range(len(lights)) if i != key]
    sentences = [light_sentence(lights[i], roles[i], key_light) for i in ordered]
    coherence = ('Keep the setup physically coherent: every highlight and cast shadow agrees with these directions, '
                 'and coloured light tints nearby surfaces consistently.')
    if len(lights) > 1:
        coherence += (f' The {roles[key]} from {direction_phrase(key_light["azimuth"])} is dominant; the other '
                      'lights shape and separate without creating competing primary shadows.')
    effect = ''
    if lighting['effect'] != 'default':
        effect = (f'Atmosphere: {EFFECTS[lighting["effect"]]["prompt"]}. Use it only as far as it supports the '
                  'mood; it must never obscure the subject\'s face, eyes or the product.')
    return dict(key=key, roles=roles, lights=' '.join(sentences), coherence=coherence,
                background=BACKGROUND_WORDS[lighting['background']], effect=effect,
                preserve=PRESERVE + SUBJECT_WORDS[subject])


def _plan_text(plan, strength, instruction):
    parts = [f'Lighting plan. {STRENGTH_WORDS[strength]}', AZIMUTH_WORDS, plan['lights'], plan['coherence'],
             plan['background']]
    if plan['effect']:
        parts.append(plan['effect'])
    parts += [plan['preserve'], FORBID]
    if instruction:
        parts.append('Additional direction: ' + instruction)
    return ' '.join(parts)


STATIC_LIGHTS = ('The lights are fixed in place from the first frame: they never move, sweep, rotate, fade in, dim, '
                 'pulse or flicker, and no shadow, highlight or reflection travels across the scene.')


def build_still_prompt(plan, strength, instruction, reference):
    """Picture 1 as a native reference, not a frame-zero anchor, so no frame carries the original lighting.

    With the strong anchor the encoder pins frame 0 to the source pixels; the model then has to fade the old light
    into the new one (lights appear to move), and the one-image decoder can even pick that pristine frame 0.
    """
    guide = (' ' + picture2_words()) if reference else ''
    return ('<Picture 1> is the source photograph, given as a native Qwen+VAE reference. Reproduce its exact scene: '
            'the same composition, framing, lens and camera position, every subject with identical identity, pose and '
            'expression, and every object, material, texture, printed text and background detail. Change only the '
            'lighting. <Picture 1> is not a frame anchor and its original lighting never appears: the very first '
            'generated frame already shows the fully relit result.' + guide +
            ' Hold that finished relit image unchanged across the short internal frame packet: locked camera, fixed '
            'composition, no subject motion and no temporal progression. ' + STATIC_LIGHTS +
            ' Every generated frame must read as the same crisp finished still image. '
            + _plan_text(plan, strength, instruction))


def build_directed_prompt(plan, strength, instruction, reference, frames):
    """Strong anchor (upstream requires it for the 39-frame profile) with an instantaneous lighting cut.

    Frame 0 is the source; the next frame is already relit, like the hard cuts upstream uses for camera coverage.
    The decoder reads the settled tail, so frame 0 is never the answer.
    """
    duration = frames / FPS
    first = 1 / FPS
    guide = ((' <Picture 2> is a semantic Qwen-only guide with no timeline alignment or VAE pixel anchor; '
              + picture2_words()) if reference else '')
    return (
        'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully '
        'referenced.\n\n'
        'integrated_multimodal_description: [Shot 1] The first frame is exactly <Picture 1>, with its composition, '
        'pixels, subjects, environment and original lighting.' + guide +
        ' Requested transformation: relight the scene with one instantaneous lighting cut. The camera remains '
        f'completely static and nothing in the scene moves. The very next frame, at 00:{first:06.3f}, is already the '
        'fully relit scene: the new lighting design is established at once, with every shadow, highlight, reflection '
        'and colour tint already in its final place. Never fade, dissolve, dim, pulse, flicker, sweep, rotate or move '
        'any light, and never animate shadows or highlights between positions. '
        f'From 00:{first:06.3f} through 00:{duration:06.3f} every frame is the same crisp, fully relit still image; hold '
        'it perfectly unchanged so the tail is a sequence of matching stills. '
        + _plan_text(plan, strength, instruction) +
        '\n\noverall_soundscape: N/A\n\nnon_diegetic_music: N/A')


def build_sections_prompt(plan, strength, instruction, reference):
    """The camera node's H3 sections layout, for native H3 or other encoders."""
    subjects = ('<Picture 1> is the exact source image to relight. The relit result is shown from the first frame, '
                'with the lights fixed in place.')
    retention = '<Picture 1>: preserve every subject, object and the scene geometry; change only the lighting.'
    if reference:
        subjects += ' <Picture 2> is a lighting reference sphere, not content.'
        retention += ' <Picture 2>: lighting information only; nothing from it appears in the image.'
    detail = (picture2_words() + ' ' if reference else '') + _plan_text(plan, strength, instruction)
    return (f'subject_definitions:\n{subjects}\n\n'
            'summary:\nThe same image with a new, deliberate lighting design.\n\n'
            f'retention_analysis:\n{retention}\n\n'
            f'detailed_description:\n{detail}\n\n'
            'overall_soundscape:\nSilence.\n\nnon_diegetic_music:\nN/A')


def _choice(value, allowed, fallback):
    """Workflows saved before a widget existed deserialize it as '' or None; use the default."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return fallback
    if value not in allowed:
        raise ValueError(f'Unknown option {value!r}. Allowed: {", ".join(allowed)}.')
    return value


def reference_size(image):
    """Match the source aspect, 1024 px on the long side, like the skill's reference render."""
    shape = getattr(image, 'shape', None)
    if shape is None or len(shape) < 3:
        return 1024, 1024
    height, width = int(shape[-3]), int(shape[-2])
    if width <= 0 or height <= 0:
        return 1024, 1024
    ratio = width / height
    if ratio >= 1:
        return 1024, max(64, int(round(1024 / ratio)))
    return max(64, int(round(1024 * ratio))), 1024


def warnings(lighting, subject):
    notes = []
    lights = lighting['lights']
    hard = [l for l in lights if l['type'] == 'spotlight']
    if len(hard) >= 2 and len({direction_index(l['azimuth']) for l in hard}) > 1:
        top = max(l['intensity'] for l in hard)
        if sum(1 for l in hard if l['intensity'] >= 0.8 * top) >= 2:
            notes.append('Duas luzes duras de força parecida: sombras duplas são esperadas. Se atrapalhar, deixe uma '
                         'dominante (a skill manda simplificar para uma luz principal quando as sombras brigam).')
    key, _ = light_roles(lights)
    if direction_index(lights[key]['azimuth']) in (3, 4, 5) and subject in ('auto', 'portrait'):
        notes.append('A luz principal está atrás: o rosto tende a ficar escuro. Some uma luz de preenchimento na '
                     'frente se precisar do rosto legível.')
    if lighting['effect'] in ('Tyndall', 'Blinds', 'Caustic Refraction', 'Optical Caustics', 'Dune Oasis'):
        notes.append('Atmosfera marcante: se ela cobrir o sujeito, desligue e reaplique só a luz base.')
    if len(lights) >= 2 and not any(direction_index(l['azimuth']) in (3, 4, 5) for l in lights):
        levels = [l['intensity'] for l in lights]
        if max(levels) < 1.35 * min(levels):
            notes.append('Luzes de força parecida e nenhuma atrás: o resultado pode sair chapado. A skill manda '
                         'separar os papéis (subir a principal, baixar o preenchimento ou pôr um recorte atrás) em vez '
                         'de acrescentar efeitos.')
    if any(l['elevation'] <= -15 for l in lights):
        notes.append('Luz vindo de baixo: é um visual intencionalmente estranho (terror, fogueira).')
    return notes


DRIVEN = ('light1_azimuth', 'light1_elevation', 'light1_intensity', 'light1_kelvin')


def apply_drive(lighting, drive):
    """Graph inputs win over the panel for light 1. Returns the names that were driven."""
    drive = {k: v for k, v in (drive or {}).items() if k in DRIVEN and v is not None}
    if not drive:
        return []
    light = lighting['lights'][0]
    for key, value in drive.items():
        number = _number(value, key)
        if key == 'light1_azimuth':
            light['azimuth'] = round(((number + 180) % 360) - 180) or 0
            if light['azimuth'] == -180:
                light['azimuth'] = 180
        elif key == 'light1_elevation':
            light['elevation'] = round(_clamp(number, -90, 90))
        elif key == 'light1_intensity':
            light['intensity'] = round(_clamp(number, *LIMITS['intensity']))
        else:
            light['kelvin'] = int(round(_clamp(number, *LIMITS['kelvin'])))
            light['colorMode'] = 'kelvin'
    lighting['preset'] = None
    return sorted(drive)


def compile_relight(lighting_raw, runtime_task, instruction, image=None, subject=None, relight_strength=None,
                    light_reference=None, ball_style=None, drive=None):
    runtime_task = _choice(runtime_task, RUNTIME_TASKS, 'still | 5-frame relight')
    subject = _choice(subject, SUBJECTS, 'auto')
    relight_strength = _choice(relight_strength, STRENGTHS, 'balanced')
    light_reference = _choice(light_reference, REFERENCE_MODES, REFERENCE_MODES[0])
    ball_style = _choice(ball_style, BALL_STYLES, BALL_STYLES[0])
    lighting = parse_lighting(lighting_raw)
    driven = apply_drive(lighting, drive)
    task = RUNTIME_TASKS[runtime_task]
    reference = light_reference == REFERENCE_MODES[0]
    instruction = (instruction or '').strip()
    plan = lighting_plan(lighting, subject)

    if task['directed']:
        compiled = build_directed_prompt(plan, relight_strength, instruction, reference, task['frames'])
    else:
        compiled = build_still_prompt(plan, relight_strength, instruction, reference)
    sections = build_sections_prompt(plan, relight_strength, instruction, reference)

    # Upstream validates the mode name and then reads the frame profile; the text itself comes from
    # compiled_prompt. The directed profile borrows the camera-angle mode, exactly as Camera H3 does,
    # because it is the tested route to the 39-frame settled-tail decoder, and upstream requires the strong
    # anchor there. Still tasks use Picture 1 as a native REF2VA reference: no frame-zero keyframe, so every
    # frame is relit and the one-image decoder cannot hand back the original.
    mode, prompt_mode = (('directed | new camera angle', 'directed | new camera angle') if task['directed']
                         else ('still | edit or generate', 'edit instruction'))
    primary_role = PRIMARY_ANCHOR if task['directed'] else PRIMARY_NATIVE
    options = {
        'mode': mode, 'show_overrides': True, 'prompt_mode': prompt_mode, 'quality_profile': task['quality'],
        'primary_image_role': primary_role,
        'reference_mode': 'semantic (Qwen only)' if reference else 'none (source only)',
        'source_fit': 'crop center', 'semantic_resolution': 1024, 'native_reference_size': 'match output area',
        'coverage_views': 12, 'coverage_arc_degrees': 360.0, 'coverage_direction': 'clockwise / camera right',
        'coverage_hold_frames': 5, 'coverage_loop_closure': False,
    }

    if ball_style == BALL_STYLES[1]:
        ball = render_venti(lighting['lights'], 1024, 1024)
    else:
        width, height = reference_size(image)
        ball = render_ball(lighting['lights'], lighting['background'], 'sphere', width, height)
    composite = ltx_composite(lighting, image)

    key, roles = plan['key'], plan['roles']
    key_light = lighting['lights'][key]
    params = minimax_params(lighting)
    params_json = json.dumps(dict(params, user_intent=instruction, runtime_task=runtime_task, subject=subject,
                                  relight_strength=relight_strength), ensure_ascii=False, indent=2)
    summary = '; '.join(
        f"luz {i + 1} ({roles[i]}): {direction_phrase(l['azimuth'])}, {altitude_band(l['elevation'])}, "
        f"{LIGHT_TYPES[l['type']]['label'].lower()}, {l['intensity'] / 10:.1f}"
        for i, l in enumerate(lighting['lights']))
    notes = warnings(lighting, subject)
    if image is None:
        notes.insert(0, 'Nenhuma imagem em image: ligue a mesma foto do source_image. Sem ela a esfera sai quadrada e o '
                        'ball_composite sai só com a bola.')
    if driven:
        names = {'light1_azimuth': 'azimute', 'light1_elevation': 'elevação', 'light1_intensity': 'intensidade',
                 'light1_kelvin': 'Kelvin'}
        notes.insert(0, 'Luz 1 conduzida pelo grafo (' + ', '.join(names[k] for k in driven) + '): as entradas '
                     'ligadas vencem o painel.')
    frame_note = ('frame 0 = foto original, corte de luz no frame 1, imagem tirada da cauda' if task['directed'] else
                  'foto como referência nativa (REF2VA), sem âncora: todos os frames já com a luz nova')
    info = (f'Relight H3 v1.1 | {runtime_task} | {task["frames"]} frames | {frame_note} | referência de luz: '
            f'{"esfera semântica em <Picture 2>" if reference else "só texto"} | fundo {lighting["background"]} | '
            f'atmosfera {lighting["effect"]}.\n{summary}.\n'
            'Ligue compiled_prompt E options no Text Encode H3 Edit' +
            (', e light_reference no reference_image dele' if reference else '') +
            '. Decodifique com Decode H3 Edit to One Image.\n'
            'Candidatos: um por execução. Para comparar, rode o mesmo plano com seeds diferentes (ou batch no sampler); '
            'mude a luz só depois de comparar.\n'
            f'LTX-2.3 Relight: "{ltx_look(key_light)} from {direction_phrase(key_light["azimuth"])}", faixa '
            f'{altitude_band(key_light["elevation"])} sun.' + ('\n' + '\n'.join(notes) if notes else ''))
    resolved = dict(driven=driven, light=lighting['lights'][0])
    return (compiled, options, ball, info, sections, params_json, ltx_prompt(lighting), composite, resolved)


def ltx_composite(lighting, image):
    """Source frames with the ball patch in the top-right corner, the LTX-2.3 Relight control signal.

    The patch is Sphere-Light-Render's render at the patch size: at 512 px its sphere is a third of the width
    and sits in the upper half, which is exactly the patch the LTX card measures.
    """
    if image is None:
        return render_venti(lighting['lights'], 512, 512)[None]
    frames = np.asarray(image.cpu().numpy() if hasattr(image, 'cpu') else image, dtype=np.float32)
    if frames.ndim == 3:
        frames = frames[None]
    _, height, width, _ = frames.shape
    size, margin = ltx_patch_geometry(width, height)
    size = min(size, width - margin, height - margin)
    patch = render_venti(lighting['lights'], size, size)
    out = frames.copy()
    x0 = width - margin - size
    out[:, margin:margin + size, x0:x0 + size, :3] = patch
    return out


def _sun():
    try:
        from . import sun
    except ImportError:  # imported as a top-level module by the tests
        import sun
    return sun


def _to_image(array):
    import torch
    batch = array if array.ndim == 4 else array[None]
    return torch.from_numpy(np.ascontiguousarray(batch, dtype=np.float32))


class H3RelightEditor:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'lighting': ('STRING', {'default': DEFAULT_LIGHTING, 'multiline': True, 'tooltip':
                    'A iluminação em JSON, escrita pelo painel acima: de 1 a 3 luzes, cada uma com type, intensity '
                    '(10 a 100), azimuth (-180 a 180, 0 é o lado da câmera, 90 é a direita do quadro), elevation '
                    '(-90 a 90), cor em HEX ou Kelvin; mais background e effect. Aceita também, colado, o JSON de '
                    'parâmetros da skill Relight da MiniMax.'}),
                'runtime_task': (list(RUNTIME_TASKS), {'default': 'still | 5-frame relight', 'tooltip':
                    'still: a foto entra como referência nativa (REF2VA), sem âncora no frame 0, então todos os '
                    'frames já nascem com a luz nova e parada. É o padrão. '
                    'directed: 39 frames com a foto travada no frame 0 e um corte instantâneo de luz no frame 1; o '
                    'decodificador tira a imagem da cauda. Use se o still mudar a composição ou a identidade. Também '
                    'tem botão na barra Testes do painel (Âncora na foto).'}),
                'instruction': ('STRING', {'default': '', 'multiline': True, 'tooltip':
                    'Texto livre, acrescentado UMA vez no fim do prompt. Escreva só o que o node não sabe: qual é o '
                    'sujeito quando há vários, material que deve brilhar, intenção de clima. Não repita direção, '
                    'cor ou intensidade: isso já sai do painel, e repetir com outras palavras cria contradição.'}),
            },
            'optional': {
                'image': ('IMAGE', {'tooltip':
                    'Ligue o MESMO LoadImage que alimenta o source_image do H3 Edit. A foto aparece no painel, a '
                    'esfera de referência sai na mesma proporção dela, e a saída ball_composite usa esses frames.'}),
                'subject': (SUBJECTS, {'default': 'auto', 'tooltip':
                    'Acrescenta a regra de preservação certa: portrait cuida de pele, olhos e catchlights; product '
                    'de silhueta, rótulo e reflexos; scene / exterior trata a luz principal como sol.'}),
                'relight_strength': (STRENGTHS, {'default': 'balanced', 'tooltip':
                    'Quanto da luz original sai. Se a identidade ou a geometria mudarem, a skill manda reduzir a '
                    'força do pedido: use subtle. Se o resultado sair chapado, strong.'}),
                'light_reference': (REFERENCE_MODES, {'default': REFERENCE_MODES[0], 'tooltip':
                    'semantic sphere: a esfera iluminada vai como <Picture 2> só pelo Qwen, sem VAE, e o prompt diz '
                    'para ler dela apenas a luz. Ligue light_reference no reference_image do encoder. text only: '
                    'o prompt não cita <Picture 2> e o options desliga a referência.'}),
                'light1_azimuth': ('FLOAT', {'forceInput': True, 'tooltip':
                    'Conduz o azimute da luz 1 pelo grafo (-180 a 180; 0 é o lado da câmera, 90 a direita do quadro). '
                    'Ligado, vence o painel, que passa a espelhar o valor. Ligue a saída azimuth do Sol H3.'}),
                'light1_elevation': ('FLOAT', {'forceInput': True, 'tooltip':
                    'Conduz a elevação da luz 1 (-90 a 90). Ligue a saída elevation do Sol H3.'}),
                'light1_intensity': ('FLOAT', {'forceInput': True, 'tooltip':
                    'Conduz a intensidade da luz 1, na escala do painel: 10 a 100.'}),
                'light1_kelvin': ('INT', {'forceInput': True, 'tooltip':
                    'Conduz a cor da luz 1 em Kelvin (1000 a 10000) e põe ela em modo Kelvin. Ligue a saída kelvin '
                    'do Sol H3 para a cor do sol pela altura.'}),
                'ball_style': (BALL_STYLES, {'default': BALL_STYLES[0], 'tooltip':
                    'Aparência da esfera de referência. sphere: como a skill da MiniMax, esfera sobre fundo liso. '
                    'ground shadow: a convenção da bola de direção de luz (Eric Venti, LTX Relight), com chão e a '
                    'sombra projetada de cada luz. Também tem botão na barra Testes.'}),
            },
        }

    OUTPUT_TOOLTIPS = (
        'Prompt completo de relight. Ligue no compiled_prompt do Text Encode H3 Edit.',
        'As chaves que o encoder do H3 Edit lê, com a tarefa e o perfil de frames certos. OBRIGATÓRIO junto com o '
        'prompt: chave ausente faz o upstream cair nos widgets legados escondidos dele.',
        'A esfera iluminada pelas suas luzes. Ligue no reference_image do Text Encode H3 Edit: vira <Picture 2>.',
        'Diagnóstico legível: tarefa, papel de cada luz, avisos da skill, e a frase equivalente do LTX Relight.',
        'O mesmo plano de luz nas seções do H3 (subject_definitions, summary, ...). ALTERNATIVA ao compiled_prompt.',
        'A iluminação no formato de parâmetros da skill Relight da MiniMax (light1..3, background, effect).',
        'Legenda no formato do LTX-2.3 Relight IC-LoRA: gatilho, um dos 12 looks treinados e a direção.',
        'Os frames de image com a bola de direção no canto superior direito (143 px a 1280x704), o sinal de '
        'controle do LTX-2.3 Relight. Sem image ligada, sai só a bola.',
    )
    RETURN_TYPES = ('STRING', 'H3EDIT_OPTIONS', 'IMAGE', 'STRING', 'STRING', 'STRING', 'STRING', 'IMAGE')
    RETURN_NAMES = ('compiled_prompt', 'options', 'light_reference', 'info', 'minimax_prompt', 'lighting_json',
                    'ltx_prompt', 'ball_composite')
    FUNCTION = 'run'
    CATEGORY = 'BruxosDoVFX/Relight H3'
    DESCRIPTION = (
        '#BruxosDoVFX | Estúdio de luz para o MiniMax H3. Arraste até 3 luzes na cúpula, escolha tipo, intensidade '
        'e cor, fundo e atmosfera, ou parta de um dos 20 presets. O node renderiza uma esfera iluminada como '
        'referência e compila o plano de luz num prompt de relight, seguindo a skill Relight da MiniMax.\n\n'
        'LIGAÇÃO MÍNIMA: compiled_prompt E options no Text Encode H3 Edit, light_reference no reference_image '
        'dele, e a sua foto em image e no source_image.\n\n'
        'É orientação por prompt e por uma imagem de referência lida pelo Qwen: não existe adaptador de luz '
        'treinado para o H3, então direção e intensidade ainda dependem do modelo.'
    )

    @classmethod
    def VALIDATE_INPUTS(cls, subject=None, relight_strength=None, light_reference=None, ball_style=None,
                        runtime_task=None):
        for value, allowed in ((subject, SUBJECTS), (relight_strength, STRENGTHS),
                               (light_reference, REFERENCE_MODES), (ball_style, BALL_STYLES),
                               (runtime_task, RUNTIME_TASKS)):
            if value is None or (isinstance(value, str) and not value.strip()):
                continue
            if value not in allowed:
                return f'Unknown option {value!r}. Allowed: {", ".join(allowed)}.'
        return True

    def run(self, lighting, runtime_task, instruction, image=None, subject=None, relight_strength=None,
            light_reference=None, ball_style=None, **drive):
        result = compile_relight(lighting, runtime_task, instruction, image, subject, relight_strength,
                                 light_reference, ball_style, drive)
        compiled, options, ball, info, sections, params, ltx, composite, resolved = result
        # The panel mirrors driven values after each run; the saved lighting widget is left as the user set it.
        return {'ui': {'relight_driven': [json.dumps(resolved)]},
                'result': (compiled, options, _to_image(ball), info, sections, params, ltx, _to_image(composite))}


class H3SunPosition:
    """Real sun for a place, date, time and camera heading, in the relight convention."""

    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {
            'location': ('STRING', {'default': 'São Paulo, Brasil', 'tooltip':
                'Cidade ("Curitiba, Brasil", "Austin, TX", "Londres") ou coordenadas ("-25.43, -49.27"). O mesmo '
                'campo aceita os dois: coordenadas usam o fuso da cidade listada mais próxima. Sem acento funciona.'}),
            'year': ('INT', {'default': 2026, 'min': 1, 'max': 9999}),
            'month': ('INT', {'default': 6, 'min': 1, 'max': 12}),
            'day': ('INT', {'default': 21, 'min': 1, 'max': 31}),
            'hour': ('INT', {'default': 16, 'min': 0, 'max': 23, 'tooltip': 'Hora do relógio local, horário de '
                                                                             'verão incluído.'}),
            'minute': ('INT', {'default': 0, 'min': 0, 'max': 59}),
            'heading': ('FLOAT', {'default': 0.0, 'min': 0.0, 'max': 360.0, 'step': 1.0, 'tooltip':
                'Para onde a câmera aponta, em graus de bússola: 0 norte, 90 leste, 180 sul, 270 oeste. Arraste a '
                'bússola do node. Câmera virada para o sol dá contraluz; de costas para ele, luz de frente.'}),
        }}

    RETURN_TYPES = ('FLOAT', 'FLOAT', 'INT', 'STRING')
    RETURN_NAMES = ('azimuth', 'elevation', 'kelvin', 'info')
    OUTPUT_TOOLTIPS = (
        'Azimute do sol na convenção do Relight: 0 lado da câmera, 90 direita do quadro, 180 atrás do sujeito. '
        'Ligue em light1_azimuth.',
        'Altura do sol em graus. À noite sai 0 (horizonte) e o info avisa. Ligue em light1_elevation.',
        'Cor aproximada da luz direta do sol pela altura: ~2000K no horizonte, 5600K acima de 60 graus.',
        'O que foi resolvido: lugar, fuso, hora em UTC, posição do sol na bússola e o aviso de noite.',
    )
    FUNCTION = 'run'
    CATEGORY = 'BruxosDoVFX/Relight H3'
    DESCRIPTION = ('#BruxosDoVFX | Posição real do sol para um lugar, data, hora e direção da câmera, já na '
                   'convenção do Relight H3. Ligue azimuth, elevation e kelvin nas entradas light1_* do Relight. '
                   'Calculado no servidor: funciona pela API, em lote e em timelapse, sem navegador aberto.')

    def run(self, location, year, month, day, hour, minute, heading):
        S = _sun()
        r = S.resolve_sun(location, year, month, day, hour, minute, heading)
        night = ' Sol abaixo do horizonte: elevation vai como 0.' if r['below_horizon'] else ''
        info = (f"☀ {r['where']} · {r['tz']} · {int(day):02d}/{int(month):02d}/{int(year)} {int(hour):02d}:"
                f"{int(minute):02d} ({r['utc']}).\nSol: altura {r['altitude']:.1f}°, bússola {r['sun_azimuth']:.1f}° "
                f"({S.compass_word(r['sun_azimuth'])}); câmera para {r['heading']:.0f}° "
                f"({S.compass_word(r['heading'])}).\nNo Relight: azimute {r['azimuth']:.1f}° "
                f"({direction_phrase(r['azimuth'])}), elevação {r['elevation']:.1f}°, {r['kelvin']}K.{night}")
        return {'ui': {'h3_sun': [json.dumps(r)]},
                'result': (float(r['azimuth']), float(r['elevation']), int(r['kelvin']), info)}


_INPUT_HELP = {'lighting': 'PT: A iluminação em JSON, escrita pelo painel acima: de 1 a 3 luzes, cada uma com type, intensity (10 a 100), azimuth (-180 a 180, 0 é o lado da câmera, 90 é a direita do quadro), elevation (-90 a 90), cor em HEX ou Kelvin; mais background e effect. Aceita também, colado, o JSON de parâmetros da skill Relight da MiniMax.\n\nEN: Lighting JSON edited by the panel: 1–3 lights, type, intensity (10–100), azimuth (−180–180), elevation (−90–90), HEX/Kelvin color, background and effect. Also accepts MiniMax Relight parameter JSON.', 'runtime_task': 'PT: still: a foto entra como referência nativa (REF2VA), sem âncora no frame 0, então todos os frames já nascem com a luz nova e parada. É o padrão. directed: 39 frames com a foto travada no frame 0 e um corte instantâneo de luz no frame 1; o decodificador tira a imagem da cauda. Use se o still mudar a composição ou a identidade. Também tem botão na barra Testes do painel (Âncora na foto).\n\nEN: still: native photo reference, 5 frames with the new lighting. directed: anchors the photo at frame 0, changes lighting at frame 1 and settles for 39 frames; use if still changes composition or identity.', 'instruction': 'PT: Texto livre, acrescentado UMA vez no fim do prompt. Escreva só o que o node não sabe: qual é o sujeito quando há vários, material que deve brilhar, intenção de clima. Não repita direção, cor ou intensidade: isso já sai do painel, e repetir com outras palavras cria contradição.\n\nEN: Extra text appended once to the prompt. Specify the subject, material or mood. Avoid repeating directions, colors or intensity already set in the panel.', 'image': 'PT: Ligue o MESMO LoadImage que alimenta o source_image do H3 Edit. A foto aparece no painel, a esfera de referência sai na mesma proporção dela, e a saída ball_composite usa esses frames.\n\nEN: Connect the same LoadImage used by H3 Edit source_image. Displays the photo, sets the sphere aspect ratio and supplies frames for ball_composite.', 'subject': 'PT: Acrescenta a regra de preservação certa: portrait cuida de pele, olhos e catchlights; product de silhueta, rótulo e reflexos; scene / exterior trata a luz principal como sol.\n\nEN: Select preservation rules: portrait protects skin, eyes and catchlights; product protects silhouette, label and reflections; scene / exterior treats the key as sunlight.', 'relight_strength': 'PT: Quanto da luz original sai. Se a identidade ou a geometria mudarem, a skill manda reduzir a força do pedido: use subtle. Se o resultado sair chapado, strong.\n\nEN: How strongly to replace the original lighting: subtle for better identity/geometry preservation, balanced by default, strong for a stronger lighting change.', 'light_reference': 'PT: semantic sphere: a esfera iluminada vai como <Picture 2> só pelo Qwen, sem VAE, e o prompt diz para ler dela apenas a luz. Ligue light_reference no reference_image do encoder. text only: o prompt não cita <Picture 2> e o options desliga a referência.\n\nEN: semantic sphere sends the sphere as Picture 2 through Qwen without VAE. Connect light_reference to the encoder reference_image. text only removes Picture 2 from the prompt and disables the reference in options.', 'light1_azimuth': 'PT: Conduz o azimute da luz 1 pelo grafo (-180 a 180; 0 é o lado da câmera, 90 a direita do quadro). Ligado, vence o painel, que passa a espelhar o valor. Ligue a saída azimuth do Sol H3.\n\nEN: Drive light 1 from the graph: −180 to 180 degrees, 0 camera side, 90 frame right. Overrides the panel. Connect Sun H3 azimuth.', 'light1_elevation': 'PT: Conduz a elevação da luz 1 (-90 a 90). Ligue a saída elevation do Sol H3.\n\nEN: Drive light 1 elevation (−90 to 90 degrees). Overrides the panel. Connect Sun H3 elevation.', 'light1_intensity': 'PT: Conduz a intensidade da luz 1, na escala do painel: 10 a 100.\n\nEN: Drive light 1 intensity (10–100). Overrides the panel.', 'light1_kelvin': 'PT: Conduz a cor da luz 1 em Kelvin (1000 a 10000) e põe ela em modo Kelvin. Ligue a saída kelvin do Sol H3 para a cor do sol pela altura.\n\nEN: Drive light 1 color temperature (1000–10000 K), enabling Kelvin mode. Overrides the panel. Connect Sun H3 kelvin.', 'ball_style': 'PT: Aparência da esfera de referência. sphere: como a skill da MiniMax, esfera sobre fundo liso. ground shadow: a convenção da bola de direção de luz (Eric Venti, LTX Relight), com chão e a sombra projetada de cada luz. Também tem botão na barra Testes.\n\nEN: sphere: sphere against a plain background. ground shadow: Venti/LTX-style direction sphere with a ground plane and a projected shadow for each light.', 'location': 'PT: Cidade ("Curitiba, Brasil", "Austin, TX", "Londres") ou coordenadas ("-25.43, -49.27"). O mesmo campo aceita os dois: coordenadas usam o fuso da cidade listada mais próxima. Sem acento funciona.\n\nEN: City (for example Austin, TX) or latitude, longitude (for example −25.43, −49.27). Coordinates use the nearest listed city timezone. Accents are optional.', 'year': 'PT: Ano do calendário local (1–9999).\n\nEN: Local calendar year (1–9999).', 'month': 'PT: Mês do calendário local (1–12).\n\nEN: Local calendar month (1–12).', 'day': 'PT: Dia local. Use uma data válida para o mês e ano escolhidos.\n\nEN: Local calendar day. Use a valid date for the selected month and year.', 'hour': 'PT: Hora do relógio local, horário de verão incluído.\n\nEN: Local clock hour (0–23), including daylight saving time.', 'minute': 'PT: Minuto do relógio local (0–59).\n\nEN: Local clock minute (0–59).', 'heading': 'PT: Para onde a câmera aponta, em graus de bússola: 0 norte, 90 leste, 180 sul, 270 oeste. Arraste a bússola do node. Câmera virada para o sol dá contraluz; de costas para ele, luz de frente.\n\nEN: Camera compass heading: 0 north, 90 east, 180 south, 270 west. Drag the compass or use the arrow keys. Facing the sun produces backlight; facing away produces front light.'}


# Bilingual UI metadata; generation inputs and workflow identifiers are unchanged.
def _bilingual_inputs(original):
    def get_inputs(cls):
        schema = original()
        for group in schema.values():
            for name, spec in group.items():
                if name in _INPUT_HELP:
                    spec[1]['tooltip'] = _INPUT_HELP[name]
        return schema
    return classmethod(get_inputs)

H3RelightEditor.INPUT_TYPES = _bilingual_inputs(H3RelightEditor.INPUT_TYPES)
H3RelightEditor.OUTPUT_TOOLTIPS = tuple('PT: ' + pt + '\n\nEN: ' + en for pt, en in zip(H3RelightEditor.OUTPUT_TOOLTIPS, ['Complete relight prompt. Connect to Text Encode H3 Edit compiled_prompt.', 'H3 Edit encoder options, including task and frame profile. Connect together with compiled_prompt.', 'Sphere rendered with your lights. Connect to Text Encode H3 Edit reference_image for Picture 2.', 'Readable diagnostics: task, light roles, warnings and equivalent LTX Relight phrase.', 'The lighting plan in H3 sections (subject_definitions, summary, etc.). Alternative to compiled_prompt.', 'Lighting in MiniMax Relight parameter format (light1..3, background, effect).', 'LTX-2.3 Relight IC-LoRA caption: trigger, one of the 12 trained looks and direction.', 'Input image frames with the direction sphere in the upper-right corner. LTX-2.3 control signal; without image input, outputs only the sphere.']))
H3RelightEditor.DESCRIPTION += '\n\nEN: #BruxosDoVFX | Lighting studio for MiniMax H3: up to 3 lights, presets, backgrounds and atmosphere. Connect compiled_prompt AND options to Text Encode H3 Edit; light_reference to reference_image; your photo to image and source_image. Prompt/reference guidance: direction and intensity depend on the model.'

H3SunPosition.INPUT_TYPES = _bilingual_inputs(H3SunPosition.INPUT_TYPES)
H3SunPosition.OUTPUT_TOOLTIPS = tuple('PT: ' + pt + '\n\nEN: ' + en for pt, en in zip(H3SunPosition.OUTPUT_TOOLTIPS, ['Sun azimuth in Relight coordinates: 0 camera side, 90 frame right, 180 behind subject. Connect to light1_azimuth.', 'Sun altitude in degrees; returns 0 at night with a diagnostic. Connect to light1_elevation.', 'Approximate direct sunlight color: about 2000 K at the horizon to 5600 K above 60 degrees.', 'Resolved location, timezone, UTC time, compass sun position and nighttime warning.']))
H3SunPosition.DESCRIPTION += '\n\nEN: #BruxosDoVFX | Real sun position from location, date, local time and camera heading, in Relight coordinates. Connect azimuth, elevation and kelvin to Relight light1_* inputs. Computed on the server, including API and batch workflows.'

NODE_CLASS_MAPPINGS = {'H3RelightEditor': H3RelightEditor, 'H3SunPosition': H3SunPosition}
NODE_DISPLAY_NAME_MAPPINGS = {'H3RelightEditor': 'Relight H3 · BruxosDoVFX',
                              'H3SunPosition': 'Sun / Sol H3 · BruxosDoVFX'}


def _register_sun_route():
    """GET /bruxos_h3/sun: the same resolve_sun, so the node's compass shows the sun live while you type."""
    try:
        from aiohttp import web
        from server import PromptServer
    except Exception:
        return  # outside ComfyUI (tests): the node still works, only the live status is missing
    routes = PromptServer.instance.routes

    @routes.get('/bruxos_h3/sun')
    async def sun_status(request):
        S = _sun()
        q = request.rel_url.query
        try:
            r = S.resolve_sun(q.get('location', ''), int(q.get('year', 2026)), int(q.get('month', 1)),
                              int(q.get('day', 1)), int(q.get('hour', 12)), int(q.get('minute', 0)),
                              float(q.get('heading', 0)))
            r['phrase'] = direction_phrase(r['azimuth'])
            return web.json_response(r)
        except (ValueError, TypeError) as exc:
            return web.json_response({'error': str(exc)}, status=200)


_register_sun_route()
