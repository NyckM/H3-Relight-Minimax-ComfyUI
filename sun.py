"""Sun position for the relight node: where the real sun is for a place, a date, a time and a camera heading.

Ported from Sphere-Light-Render-ComfyUI (MIT; sun features by Christopher Connock): the NOAA solar position
algorithm, the city lookup rules and the scene mapping. The difference is where it runs. That node computes in
the browser because its render only exists there; here the render is in Python too, so the sun is computed on the
server and every input can be driven from the graph, batched, or run through the API with no browser open.

City data: GeoNames cities15000 (CC BY 4.0), as trimmed by that project, gzipped in data/cities.json.gz.
"""
import datetime as _dt
import gzip
import json
import math
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
_CITIES = None

# Country and region names people actually type, in Portuguese and English, mapped to GeoNames names.
ALIASES = {
    'uk': 'united kingdom', 'u.k.': 'united kingdom', 'reino unido': 'united kingdom', 'inglaterra': 'england',
    'usa': 'united states', 'us': 'united states', 'u.s.': 'united states', 'u.s.a.': 'united states',
    'america': 'united states', 'eua': 'united states', 'estados unidos': 'united states', 'uae': 'united arab emirates',
    'brasil': 'brazil', 'alemanha': 'germany', 'espanha': 'spain', 'franca': 'france', 'italia': 'italy',
    'japao': 'japan', 'mexico': 'mexico', 'portugal': 'portugal', 'argentina': 'argentina', 'chile': 'chile',
    'colombia': 'colombia', 'peru': 'peru', 'uruguai': 'uruguay', 'paraguai': 'paraguay', 'bolivia': 'bolivia',
    'canada': 'canada', 'china': 'china', 'coreia do sul': 'south korea', 'india': 'india', 'holanda': 'netherlands',
    'paises baixos': 'netherlands', 'belgica': 'belgium', 'suica': 'switzerland', 'suecia': 'sweden',
    'noruega': 'norway', 'dinamarca': 'denmark', 'grecia': 'greece', 'turquia': 'turkey', 'egito': 'egypt',
    'africa do sul': 'south africa', 'marrocos': 'morocco', 'australia': 'australia', 'nova zelandia': 'new zealand',
    'irlanda': 'ireland', 'escocia': 'scotland', 'russia': 'russia', 'polonia': 'poland', 'austria': 'austria',
}
CITY_ALIASES = {
    'nova york': 'new york city', 'nova iorque': 'new york city', 'new york': 'new york city', 'londres': 'london',
    'toquio': 'tokyo', 'roma': 'rome', 'lisboa': 'lisbon', 'pequim': 'beijing', 'moscou': 'moscow',
    'cidade do mexico': 'mexico city', 'berlim': 'berlin', 'genebra': 'geneva', 'veneza': 'venice',
    'florenca': 'florence', 'atenas': 'athens', 'xangai': 'shanghai', 'varsovia': 'warsaw', 'praga': 'prague',
    'viena': 'vienna', 'bruxelas': 'brussels', 'amsterda': 'amsterdam', 'copenhague': 'copenhagen',
    'estocolmo': 'stockholm', 'edimburgo': 'edinburgh', 'nova delhi': 'new delhi', 'cidade do cabo': 'cape town',
    'joanesburgo': 'johannesburg', 'seul': 'seoul', 'singapura': 'singapore', 'filadelfia': 'philadelphia',
    'nova orleans': 'new orleans', 'sao francisco': 'san francisco', 'munique': 'munich', 'milao': 'milan',
    'napoles': 'naples', 'sevilha': 'sevilla', 'marselha': 'marseille', 'colonia': 'cologne', 'hamburgo': 'hamburg',
}
COORDS = re.compile(r'^\s*([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$')


def fold(text):
    """Lower-case and strip accents, so 'Sao Paulo' finds 'São Paulo' and 'Brasil' finds 'Brazil'."""
    text = unicodedata.normalize('NFKD', str(text or '')).encode('ascii', 'ignore').decode('ascii')
    return ' '.join(text.lower().split())


def cities():
    global _CITIES
    if _CITIES is None:
        blob = json.loads(gzip.open(os.path.join(HERE, 'data', 'cities.json.gz'), 'rb').read().decode('utf-8'))
        fields = blob['fields']
        _CITIES = []
        for row in blob['rows']:
            record = dict(zip(fields, row))
            record['_city'] = fold(record['city'])
            record['_quals'] = {fold(record[k]) for k in ('region', 'regionCode', 'country', 'countryName') if record[k]}
            _CITIES.append(record)
    return _CITIES


def find_city(query):
    """'City' or 'City, State/Country'. Exact name first, then prefix; ties go to the most populous."""
    parts = [p.strip() for p in str(query or '').split(',') if p.strip()]
    if not parts:
        return None
    name = fold(parts[0])
    name = CITY_ALIASES.get(name, name)
    qual = fold(parts[1]) if len(parts) > 1 else ''
    quals = {qual, ALIASES.get(qual, qual)} if qual else set()
    ok = (lambda r: bool(quals & r['_quals'])) if quals else (lambda r: True)
    matches = [r for r in cities() if r['_city'] == name and ok(r)]
    if not matches:
        matches = [r for r in cities() if r['_city'].startswith(name) and ok(r)]
    return max(matches, key=lambda r: r['population'] or 0) if matches else None


def nearest_city(lat, lon):
    best, best_km = None, float('inf')
    for r in cities():
        km = haversine_km(lat, lon, r['lat'], r['lng'])
        if km < best_km:
            best, best_km = r, km
    return best, best_km


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0 * 2 * math.asin(min(1.0, math.sqrt(a)))


def city_label(r):
    region = r['region'] or r['regionCode']
    tail = f', {region}' if region and region != r['city'] else ''
    return f"{r['city']}{tail}, {r['country']}"


def solar_position(lat, lon, when_utc):
    """NOAA spreadsheet algorithm. Returns (altitude, azimuth) in degrees; azimuth from north, clockwise."""
    jd = when_utc.timestamp() / 86400.0 + 2440587.5
    jc = (jd - 2451545.0) / 36525.0
    gmls = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360
    gmas = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)
    ecc = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)
    r = math.radians
    ctr = (math.sin(r(gmas)) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
           + math.sin(r(2 * gmas)) * (0.019993 - 0.000101 * jc) + math.sin(r(3 * gmas)) * 0.000289)
    app_long = gmls + ctr - 0.00569 - 0.00478 * math.sin(r(125.04 - 1934.136 * jc))
    mean_obliq = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
    obliq = mean_obliq + 0.00256 * math.cos(r(125.04 - 1934.136 * jc))
    declin = math.degrees(math.asin(math.sin(r(obliq)) * math.sin(r(app_long))))
    y = math.tan(r(obliq / 2)) ** 2
    eq_time = 4 * math.degrees(y * math.sin(2 * r(gmls)) - 2 * ecc * math.sin(r(gmas))
                               + 4 * ecc * y * math.sin(r(gmas)) * math.cos(2 * r(gmls))
                               - 0.5 * y * y * math.sin(4 * r(gmls)) - 1.25 * ecc * ecc * math.sin(2 * r(gmas)))
    utc = when_utc.astimezone(_dt.timezone.utc)
    minutes = utc.hour * 60 + utc.minute + utc.second / 60
    true_solar = (minutes + eq_time + 4 * lon) % 1440
    hour_angle = true_solar / 4 + 180 if true_solar / 4 < 0 else true_solar / 4 - 180
    cos_zen = (math.sin(r(lat)) * math.sin(r(declin))
               + math.cos(r(lat)) * math.cos(r(declin)) * math.cos(r(hour_angle)))
    zenith = math.degrees(math.acos(max(-1.0, min(1.0, cos_zen))))
    denom = math.cos(r(lat)) * math.sin(r(zenith))
    if abs(denom) < 1e-9:
        azimuth = 180.0 if lat > 0 else 0.0
    else:
        cos_az = (math.sin(r(lat)) * math.cos(r(zenith)) - math.sin(r(declin))) / denom
        az = math.degrees(math.acos(max(-1.0, min(1.0, cos_az))))
        azimuth = (az + 180) % 360 if hour_angle > 0 else (540 - az) % 360
    return 90.0 - zenith, azimuth


def local_to_utc(year, month, day, hour, minute, tz, lon=None):
    """Wall-clock time in an IANA zone to UTC, daylight saving included.

    Windows has no system zone database; ComfyUI there needs the tzdata package (listed in requirements.txt).
    Without it this falls back to the sun's own clock for the longitude and says so.
    """
    local = _dt.datetime(int(year), int(month), int(day), int(hour), int(minute))
    try:
        from zoneinfo import ZoneInfo
        return local.replace(tzinfo=ZoneInfo(tz)).astimezone(_dt.timezone.utc), tz
    except Exception:
        offset = round((lon or 0) / 15)
        zone = _dt.timezone(_dt.timedelta(hours=offset))
        return local.replace(tzinfo=zone).astimezone(_dt.timezone.utc), f'UTC{offset:+d} (sem base de fusos)'


def scene_azimuth(sun_azimuth, heading):
    """Compass sun bearing to the relight azimuth: 0 camera side, +90 frame right, 180 behind the subject.

    (azimuth - heading) is the sun relative to where the camera points, 0 dead ahead. Dead ahead means the
    sun is behind the subject, so it maps to 180; that 180 - x is the fix Sphere-Light-Render made after its
    first design had the front and back swapped.
    """
    a = (180.0 - (sun_azimuth - heading) + 180.0) % 360.0 - 180.0
    return 180.0 if a == -180.0 else a


KELVIN_BY_ALTITUDE = [(0, 2000), (3, 2400), (6, 2900), (10, 3300), (15, 3900), (20, 4300), (30, 4800),
                      (45, 5300), (60, 5600)]


def sun_kelvin(altitude):
    """Rough colour of direct sunlight by height: orange at the horizon, neutral daylight above ~50 degrees."""
    table = KELVIN_BY_ALTITUDE
    if altitude <= table[0][0]:
        return table[0][1]
    for (a0, k0), (a1, k1) in zip(table, table[1:]):
        if altitude <= a1:
            return int(round((k0 + (k1 - k0) * (altitude - a0) / (a1 - a0)) / 50) * 50)
    return table[-1][1]


def resolve_sun(location, year, month, day, hour, minute, heading):
    """Everything the node and the live status need. Raises ValueError with a message meant for people."""
    text = str(location or '').strip()
    match = COORDS.match(text)
    if match:
        lat, lon = float(match.group(1)), float(match.group(2))
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError('Coordenadas fora do mundo: latitude vai de -90 a 90, longitude de -180 a 180.')
        near, km = nearest_city(lat, lon)
        tz = near['tz'] if near else 'UTC'
        where = (f'{lat:.4f}, {lon:.4f} · fuso de {near["city"]}' + (f' (~{km:.0f} km)' if km >= 30 else '')
                 if near else f'{lat:.4f}, {lon:.4f}')
        source = 'coordenadas'
    else:
        if not text:
            raise ValueError('Escreva uma cidade ("Curitiba, Brasil") ou coordenadas ("-25.43, -49.27").')
        city = find_city(text)
        if not city:
            raise ValueError(f'"{text}" não encontrada. Confira a grafia, acrescente o país, ou use coordenadas '
                             '(cidades com menos de 15 mil habitantes não estão no banco).')
        lat, lon, tz = city['lat'], city['lng'], city['tz']
        where = city_label(city)
        source = 'cidade'
    try:
        when, zone = local_to_utc(year, month, day, hour, minute, tz, lon)
    except ValueError as exc:
        raise ValueError(f'Data inválida: {int(day):02d}/{int(month):02d}/{int(year)}.') from exc
    altitude, sun_az = solar_position(lat, lon, when)
    below = altitude <= 0
    heading = float(heading) % 360
    return dict(
        azimuth=round(scene_azimuth(sun_az, heading), 2), elevation=0.0 if below else round(altitude, 2),
        altitude=round(altitude, 2), sun_azimuth=round(sun_az, 2), heading=heading,
        kelvin=sun_kelvin(max(altitude, 0)), below_horizon=below, lat=lat, lon=lon, tz=zone, source=source,
        where=where, utc=when.strftime('%Y-%m-%d %H:%M UTC'),
    )


COMPASS_PT = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']


def compass_word(bearing):
    return COMPASS_PT[int(((bearing % 360) + 22.5) // 45) % 8]
