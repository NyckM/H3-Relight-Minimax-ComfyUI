"""Run: python3 tests/test_relight.py  (needs numpy and node on PATH)."""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import relight as R  # noqa: E402


def L(az, el, kind='spotlight', i=60, k=5600, hexc=None):
    d = dict(type=kind, intensity=i, azimuth=az, elevation=el, colorMode='kelvin', kelvin=k, color='#ffffff')
    if hexc:
        d.update(colorMode='hex', color=hexc)
    return d


def test_parity_with_panel():
    cases = [
        dict(lights=[L(90, 40)], background='default', style='sphere', w=96, h=64),
        dict(lights=[L(180, 0, k=2000)], background='black', style='sphere', w=80, h=80),
        dict(lights=[L(-55, -10, hexc='#ff00ee'), L(55, -10, hexc='#1a33ff')], background='white', style='sphere',
             w=72, h=90),
        dict(lights=[L(45, 35, 'rectAreaLight'), L(-120, 20, 'directionalLight', 30)], background='default',
             style='sun', w=100, h=100),
        dict(lights=[L(0, 90, 'rectAreaLight', 80, 3200)], background='default', style='sun', w=64, h=64,
             opts=dict(fraction=1 / 3, center=[0.5, 0.36], plate=[173, 173, 173])),
        dict(lights=[L(-36, 27, i=100)], background='default', style='venti', w=96, h=96),
        dict(lights=[L(118, 41, 'rectAreaLight', 70, 3000), L(-60, 20, 'directionalLight', 30, hexc='#4aa8ff')],
             background='default', style='venti', w=80, h=64),
    ]
    raw = subprocess.run(['node', os.path.join(ROOT, 'tests', 'parity.mjs'), json.dumps(cases)],
                         capture_output=True, text=True, check=True).stdout
    js = json.loads(raw)
    for case, values in zip(cases, js['out']):
        lights = R.parse_lighting(dict(lights=case['lights'], background=case['background']))['lights']
        opts = case.get('opts', {})
        py = (R.render_venti(lights, case['w'], case['h']) if case['style'] == 'venti' else
              R.render_ball(lights, case['background'], case['style'], case['w'], case['h'],
                            fraction=opts.get('fraction'), center=opts.get('center'), plate=opts.get('plate')))
        diff = np.abs(py.reshape(-1) - np.array(values, dtype=np.float32))
        assert diff.max() < 2 / 255, (case, float(diff.max()))
    assert js['words'] == [R.direction_phrase(a) for a in
                           [-180, -135, -91, -46, -22, 0, 22, 23, 44, 90, 135, 157, 158, 180, 270, 359]]
    assert js['bands'] == [R.altitude_band(e) for e in [-40, -15, -14, 0, 32, 33, 57, 58, 79, 80, 90]]
    assert [tuple(k) for k in js['kelvins']] == [R.kelvin_rgb(k) for k in
                                                  [1000, 1500, 1800, 2500, 3200, 4500, 5600, 6500, 7000, 8500, 10000]]
    compass = js['compass']
    assert [round(c) for c in compass[:4]] == [0, 90, 180, 270] and compass[4] is None and round(compass[5]) == 45
    for preset, roles in zip(R.DATA['presets'], js['roles']):
        key, py_roles = R.light_roles(R.parse_lighting(dict(lights=preset['lights']))['lights'])
        assert roles['key'] == key and {int(k): v for k, v in roles['roles'].items()} == py_roles


def test_direction_table_matches_ltx_card():
    table = {0: 'the front', 45: 'the front-right', 90: 'the right', 135: 'the back-right', 180: 'behind',
             225: 'the back-left', 270: 'the left', 315: 'the front-left', 350: 'the front', -90: 'the left'}
    for az, phrase in table.items():
        assert R.direction_phrase(az) == phrase, az
    assert R.altitude_band(22) == 'low' and R.altitude_band(45) == 'mid' and R.altitude_band(58) == 'high'


def test_minimax_payloads_round_trip():
    preset = R.PRESETS['Blade Runner']
    ours = R.parse_lighting(dict(lights=preset['lights'], background='default', effect='Blade Runner'))
    params = R.minimax_params(ours)
    assert json.loads(params['light1'])['color'] == '#ff00ee' and params['light3'] == ''
    again = R.parse_lighting(params)
    assert again['lights'] == ours['lights'] and again['effect'] == 'Blade Runner'
    raw_prompt = json.dumps([
        {'id': 'setting', 'data': json.dumps({'background': 'default', 'effect': 'Dune Oasis'})},
        {'id': 'light1', 'data': json.dumps({'lightType': 'spotlight', 'kelvin': '1800K', 'lightness': '7.3',
                                             'azimuth': '-135°', 'elevation': '45°'})}])
    dune = R.parse_lighting(raw_prompt)
    assert dune['lights'][0] == dict(type='spotlight', intensity=73, azimuth=-135, elevation=45, colorMode='kelvin',
                                     color='#ffffff', kelvin=1800)


def test_validation():
    for bad in ('[]', '{"lights": []}', '{"lights": [{"intensity": 5}]}', '{"lights": [{"elevation": 95}]}',
                '{"lights": [{}], "effect": "Nope"}', '{"lights": [{"color": "red"}]}', 'nope',
                json.dumps({'lights': [{}, {}, {}, {}]})):
        try:
            R.parse_lighting(bad)
        except ValueError:
            continue
        raise AssertionError(bad)
    assert R.parse_lighting('{"lights": [{"azimuth": 270}]}')['lights'][0]['azimuth'] == -90


def test_compile_still_and_directed():
    lighting = json.dumps(dict(lights=[L(90, 40), L(-60, 20, 'rectAreaLight', 30)], background='black',
                               effect='Chiaroscuro Drama'))
    compiled, options, ball, info, sections, params, ltx, comp, resolved = R.compile_relight(
        lighting, 'still | 5-frame relight', 'the woman on the left is the subject', None, 'portrait')
    assert resolved['driven'] == []
    assert compiled.startswith('<Picture 1> is the source photograph, given as a native Qwen+VAE reference')
    assert 'the very first generated frame already shows the fully relit result' in compiled
    assert 'never move, sweep, rotate, fade in' in compiled and 'frame-zero anchor' not in compiled
    assert options['primary_image_role'] == 'generate | native Picture 1 (REF2VA)'
    assert '<Picture 2> is a lighting reference only' in compiled
    assert 'Key light: strong' not in compiled and 'Key light:' in compiled and 'Fill light:' in compiled
    assert 'from the right' in compiled and "viewer's right side of the frame" in compiled
    assert 'studio-black' in compiled and 'chiaroscuro' in compiled and 'catchlights' in compiled
    assert compiled.rstrip().endswith('the woman on the left is the subject')
    assert 'Preserve the source identity, facial structure, pose, framing, lighting' not in compiled
    assert options['reference_mode'] == 'semantic (Qwen only)' and len(options) == 14
    assert options['quality_profile'] == 'recommended | 5-frame context -> 1 image'
    assert ball.shape == (1024, 1024, 3) and comp.shape == (1, 512, 512, 3)
    assert ltx == 'relight the video to match the light-direction ball. hard directional sunlight from the right'
    assert 'subject_definitions:' in sections and json.loads(params)['background'] == 'black'

    compiled, options, *_ = R.compile_relight(lighting, 'directed | 39-frame settle', '', None,
                                              light_reference='text only')
    assert 'one instantaneous lighting cut' in compiled and 'The very next frame, at 00:00.042' in compiled
    assert 'From 00:00.042 through 00:01.625' in compiled
    for animated in ('fades in', 'fade out', 'migrating', 'smoothly', 'Complete the change'):
        assert animated not in compiled, animated
    assert options['primary_image_role'] == 'edit | strong scene anchor (FL2VA)'  # upstream requires it here
    assert '<Picture 2>' not in compiled and options['reference_mode'] == 'none (source only)'
    assert options['quality_profile'] == 'directed change | 39-frame settle -> 1 image'
    assert options['mode'] == 'directed | new camera angle'
    assert compiled.endswith('non_diegetic_music: N/A')


def test_every_preset_compiles():
    for preset in R.DATA['presets']:
        lighting = json.dumps(dict(lights=preset['lights'], background=preset['background'], effect=preset['effect']))
        compiled, *_, ltx, _, _ = R.compile_relight(lighting, 'still | 5-frame relight', '')
        assert R.EFFECTS[preset['effect']]['prompt'] in compiled
        assert ltx.startswith(R.LTX_TRIGGER)
    looks = {R.ltx_look(R.parse_lighting(dict(lights=p['lights']))['lights'][0]) for p in R.DATA['presets']}
    trained = {'hard directional sunlight', 'hard high-angle sunlight', 'hard low-angle sunlight',
               'soft diffused daylight', 'soft warm afternoon light', 'cool soft daylight', 'dim overcast light',
               'strong backlight with rim light', 'soft hazy backlight', 'warm golden low front sun',
               'warm golden low side sun', 'frontal sunlight'}
    assert looks <= trained, looks - trained


def test_reference_follows_image_aspect_and_composite():
    frames = np.zeros((2, 704, 1280, 3), dtype=np.float32)
    lighting = json.dumps(dict(lights=[L(135, 30)]))
    _, _, ball, _, _, _, _, comp, _ = R.compile_relight(lighting, 'still | 5-frame relight', '', frames)
    assert ball.shape == (563, 1024, 3)
    _, _, venti, _, _, _, _, _, _ = R.compile_relight(lighting, 'still | 5-frame relight', '', frames,
                                                      ball_style='sphere + ground shadow (LTX/Venti)')
    assert venti.shape == (1024, 1024, 3)  # square, like Sphere-Light-Render
    assert comp.shape == (2, 704, 1280, 3)
    patch = comp[0, 22:22 + 143, 1280 - 22 - 143:1280 - 22]
    assert float(patch.mean()) > 0.2 and np.allclose(comp[0], comp[1])  # same ball on every frame
    assert float(comp[0, 400, 400].max()) == 0.0 and float(comp[0, 10, 1270].max()) == 0.0  # rest untouched
    assert R.ltx_patch_geometry(1280, 704) == (143, 22)
    assert R.compile_relight(lighting, 'still | 5-frame relight', '')[7].shape == (1, 512, 512, 3)


def test_venti_scene_matches_the_convention():
    """Shadow opposite the light, sphere a third of the frame in its upper half, as in the LTX card."""
    img = R.render_venti([L(90, 30)], 256, 256)
    lum = img.mean(axis=-1)
    left, right = lum[150:200, 20:110].mean(), lum[150:200, 146:236].mean()
    assert left < right - 0.1  # light from frame right: shadow falls to the left
    back = R.render_venti([L(180, 25)], 256, 256).mean(axis=-1)
    assert back[200:250, 118:138].mean() < back[20:60, 118:138].mean() - 0.1  # backlight: shadow toward camera
    forward, right, up = R.venti_camera()
    to_center = -R.VENTI_EYE / np.linalg.norm(R.VENTI_EYE)
    y_ndc = (to_center @ up) / (to_center @ forward) / np.tan(np.radians(R.VENTI_FOV / 2))
    center_row = int(round((1 - y_ndc) / 2 * 512))
    assert center_row < 256  # sphere centred in the upper half, as the LTX card measures
    lum = R.render_venti([L(0, 45)], 512, 512).mean(axis=-1)[center_row]
    span = np.where(np.abs(lum - lum[5]) > 0.03)[0]
    assert abs((span.max() - span.min()) / 512 - 2 * np.degrees(np.arcsin(0.1)) / 35) < 0.02  # a third of the frame


def test_graph_inputs_win_for_light1():
    lighting = json.dumps(dict(lights=[L(45, 35, 'rectAreaLight'), L(-120, 20)]))
    drive = dict(light1_azimuth=-100.4, light1_elevation=12.6, light1_intensity=140, light1_kelvin=2400)
    compiled, *_, resolved = R.compile_relight(lighting, 'still | 5-frame relight', '', drive=drive)
    light = resolved['light']
    assert (light['azimuth'], light['elevation'], light['intensity'], light['kelvin']) == (-100, 13, 100, 2400)
    assert light['colorMode'] == 'kelvin' and resolved['driven'] == sorted(drive)
    assert 'from the left' in compiled and '2400K' in compiled
    out = R.H3RelightEditor().__class__.run  # the ComfyUI entry returns the ui mirror alongside the result
    assert set(R.H3RelightEditor.INPUT_TYPES()['optional']) >= set(R.DRIVEN)
    none = R.compile_relight(lighting, 'still | 5-frame relight', '', drive=dict(light1_azimuth=None))[-1]
    assert none['driven'] == [] and none['light']['azimuth'] == 45


def test_sun_math_and_places():
    import datetime as dt
    S = R._sun()
    reference = [(-25.4278, -49.2731, '2026-09-10T20:30:00+00:00', 7.8486, 279.0237),
                 (51.5, -0.12, '2026-06-21T11:00:00+00:00', 59.4821, 150.9823),
                 (35.68, 139.69, '2026-12-01T01:15:00+00:00', 29.8567, 159.841)]  # astral 3.2, no refraction
    for lat, lon, when, alt, az in reference:
        a, z = S.solar_position(lat, lon, dt.datetime.fromisoformat(when))
        assert abs(a - alt) < 0.01 and abs(z - az) < 0.01
    assert S.city_label(S.find_city('sao paulo, brasil')) == 'São Paulo, BR'
    assert S.find_city('Nova York')['tz'] == 'America/New_York' and S.find_city('Austin, TX')['region'] == 'Texas'
    assert S.find_city('Xyzzy') is None
    jan, _ = S.local_to_utc(2026, 1, 15, 12, 0, 'America/New_York')
    jul, _ = S.local_to_utc(2026, 7, 15, 12, 0, 'America/New_York')
    assert (jan.hour, jul.hour) == (17, 16)  # daylight saving
    assert S.scene_azimuth(90, 0) == 90       # sun east, camera north: light from frame right
    assert S.scene_azimuth(200, 200) == 180   # facing the sun: backlight
    assert S.scene_azimuth(20, 200) == 0      # sun behind the camera: front light
    night = S.resolve_sun('Tokyo', 2026, 6, 21, 23, 0, 0)
    assert night['below_horizon'] and night['elevation'] == 0.0
    coords = S.resolve_sun('-25.43, -49.27', 2026, 9, 10, 17, 30, 270)
    assert coords['source'] == 'coordenadas' and coords['tz'] == 'America/Sao_Paulo' and 'Curitiba' in coords['where']
    for bad in (('Xyzzy', 2026, 1, 1), ('', 2026, 1, 1), ('São Paulo', 2026, 2, 30), ('95, 10', 2026, 1, 1)):
        try:
            S.resolve_sun(*bad, 12, 0, 0)
        except ValueError:
            continue
        raise AssertionError(bad)
    assert S.sun_kelvin(0) == 2000 and S.sun_kelvin(70) == 5600 and S.sun_kelvin(8) < S.sun_kelvin(25)


def test_sun_node_output():
    out = R.H3SunPosition().run('Curitiba, Brasil', 2026, 9, 10, 17, 30, 270)
    az, el, kelvin, info = out['result']
    data = json.loads(out['ui']['h3_sun'][0])
    assert isinstance(az, float) and isinstance(el, float) and isinstance(kelvin, int)
    assert data['azimuth'] == az and 'Curitiba' in info and 'No Relight' in info


def test_legacy_blank_widgets():
    lighting = json.dumps(dict(lights=[L(0, 30)]))
    assert R.compile_relight(lighting, '', '', None, '', None, '', '')[1]['reference_mode'] == 'semantic (Qwen only)'
    assert R.H3RelightEditor.VALIDATE_INPUTS(subject='nope') != True  # noqa: E712
    assert R.H3RelightEditor.VALIDATE_INPUTS(subject='') is True


def test_skill_checklist():
    """Each requirement of the MiniMax Relight SKILL.md that the node can express."""
    lighting = json.dumps(dict(lights=[L(45, 35, i=70, k=3200), L(-60, 15, 'rectAreaLight', 30),
                                       L(170, 30, i=50, hexc='#88aaff')], background='default', effect='Tyndall'))
    compiled, _, _, info, *_ = R.compile_relight(lighting, 'still | 5-frame relight', '', None, 'auto')
    for phrase in ('Key light', 'Fill light', 'Rim light', "% of the key's strength", 'hard, direct',
                   'soft, large diffused', 'agrees with these directions', 'tints nearby surfaces',
                   'must never obscure', 'facial features', 'product shape', 'skin keeps a natural',
                   'Neutral colours stay neutral', 'Subject edges stay clean', 'separation from the background',
                   'No new objects', 'no identity change', 'dominant', 'Keep the original background'):
        assert phrase in compiled, phrase
    for phrase in ('key light', 'fill light', 'rim light', 'fundo', 'atmosfera', 'Candidatos', 'Nenhuma imagem',
                   'desligue'):
        assert phrase in info, phrase
    flat = R.compile_relight(json.dumps(dict(lights=[L(30, 20, 'rectAreaLight', 50), L(-30, 20, 'rectAreaLight', 45)])),
                             'still | 5-frame relight', '')[3]
    assert 'chapado' in flat
    assert 'separation between the key, fill and rim' in R.STRENGTH_WORDS['strong']
    assert 'Prefer preservation over change' in R.STRENGTH_WORDS['subtle']


if __name__ == '__main__':
    tests = [v for k, v in sorted(globals().items()) if k.startswith('test_')]
    for test in tests:
        test()
        print('ok', test.__name__)
