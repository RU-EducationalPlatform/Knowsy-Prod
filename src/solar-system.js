// Solar System — full lesson page (/solar-system.html). Three.js scene
// with photorealistic NASA-derived textures from solarsystemscope.com
// (2K diffuse maps for every planet, Earth day/night/clouds/spec/normal,
// Saturn rings, Milky Way panorama), PBR lighting via a single
// PointLight at the Sun, ACES filmic tonemapping, WASD free-fly mode,
// and editorial info cards on click.

import './observability.js';
import { requireAuth, signOut } from './auth.js';
import { setUser, breadcrumb } from './observability.js';
import { mountNavbar } from './Navbar.js';
import * as THREE from '../vendor/three-0.170.0.module.js';

const root = document.documentElement;
root.classList.add('app-auth-pending');
const user = await requireAuth();
setUser(user);
breadcrumb('solar_system_loaded', { uid: user?.uid ?? null });
root.classList.remove('app-auth-pending');

await mountNavbar({
  user,
  currentModule: { id: 'webgl-solar-system', label: 'Solar System' },
  onSignOut: () => signOut(),
});

(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ============================================================
  // BODIES — art-directed sizes/distances + per-body texture key,
  // info-card content, and named moons.
  // ============================================================
  const BODIES = [
    { id: 'sun', name: 'Sun', kind: 'star', tex: 'sun',
      radius: 3.2, dist: 0, period: 0,
      eyebrow: 'STAR No. 01 / G-TYPE MAIN SEQUENCE',
      tag: 'the gravitational anchor',
      stats: { 'Diameter':'1 391 400 km','Mass':'1.989×10³⁰ kg','Surface temp':'~5 500 °C',
               'Composition':'H 73 % · He 25 %','Age':'~4.6 billion years','Light to Earth':'8 min 20 s' },
      blurb: 'A middle-aged main-sequence star fusing four million tonnes of hydrogen into helium every second. Its gravity holds every other body on this page in a slow, patient orbit.' },

    { id: 'mercury', name: 'Mercury', kind: 'planet', tex: 'mercury',
      radius: 0.32, dist: 8, period: 0.24, idx: 1, moons: [],
      eyebrow: 'PLANET No. 01 / TERRESTRIAL', tag: 'closest to the Sun',
      stats: { 'Diameter':'4 879 km','Day':'59 Earth days','Year':'88 Earth days','Distance':'0.39 AU',
               'Surface temp':'−180 → 430 °C','Moons':'none' },
      blurb: 'The smallest planet — barely larger than Earth\'s Moon — and the most cratered. A day on Mercury lasts longer than its year, so a single sunrise is a generations-spanning event.' },

    { id: 'venus', name: 'Venus', kind: 'planet', tex: 'venus_atmosphere',
      radius: 0.55, dist: 11, period: 0.62, idx: 2, moons: [],
      eyebrow: 'PLANET No. 02 / TERRESTRIAL', tag: 'the runaway greenhouse',
      stats: { 'Diameter':'12 104 km','Day':'243 days (retrograde)','Year':'225 Earth days',
               'Distance':'0.72 AU','Surface temp':'~465 °C','Atmosphere':'CO₂ 96 %' },
      blurb: 'Earth\'s near-twin in size, ruined by a runaway greenhouse. Surface pressure is 90× ours and the clouds are sulphuric acid. A perfect cautionary tale.' },

    { id: 'earth', name: 'Earth', kind: 'planet', tex: 'earth',
      radius: 0.62, dist: 15, period: 1.0, idx: 3, hasAtmosphere: true, hasClouds: true,
      moons: [{ id:'luna', name:'Luna', tex:'moon', radius:0.17, dist:1.5, period:0.075,
        eyebrow:'MOON No. 01 / EARTH', tag:'our nearest neighbour',
        stats:{ 'Diameter':'3 474 km','Distance':'384 400 km','Period':'27.3 days','Gravity':'1.62 m/s²' },
        blurb:'Tidal-locked to Earth — we always see the same face. Its mass stabilises Earth\'s axial tilt, which in turn stabilises our seasons.' }],
      eyebrow: 'PLANET No. 03 / TERRESTRIAL', tag: 'the only one we know with us on it',
      stats: { 'Diameter':'12 742 km','Day':'23 h 56 m','Year':'365.25 days','Distance':'1.00 AU',
               'Surface temp':'−88 → 58 °C','Moons':'1 (Luna)' },
      blurb: 'The pale blue dot. 71 % surface water, a magnetic field that deflects the solar wind, an oxygenated atmosphere — and one large, tide-raising moon that stabilises its axial tilt.' },

    { id: 'mars', name: 'Mars', kind: 'planet', tex: 'mars',
      radius: 0.42, dist: 20, period: 1.88, idx: 4,
      moons: [
        { id:'phobos', name:'Phobos', tex:'moon', dim:0.55, radius:0.07, dist:0.95, period:0.0009,
          eyebrow:'MOON / MARS', tag:'a captured asteroid', stats:{ 'Diameter':'22 km','Period':'7 h 39 m' },
          blurb:'Spiralling inward — in 50 million years it\'ll either crash into Mars or get torn into a ring.' },
        { id:'deimos', name:'Deimos', tex:'moon', dim:0.55, radius:0.05, dist:1.4, period:0.0034,
          eyebrow:'MOON / MARS', tag:'the smaller martian', stats:{ 'Diameter':'12 km','Period':'30 h 18 m' },
          blurb:'Even smaller than Phobos, drifting outward over time.' }],
      eyebrow: 'PLANET No. 04 / TERRESTRIAL', tag: 'the rusty desert',
      stats: { 'Diameter':'6 779 km','Day':'24 h 37 m','Year':'687 Earth days','Distance':'1.52 AU',
               'Surface temp':'−143 → 35 °C','Moons':'2 (Phobos, Deimos)' },
      blurb: 'Iron-oxide dust gives the surface its colour. It hosts Olympus Mons, a volcano three times the height of Everest, and Valles Marineris, a canyon that would stretch coast-to-coast across the United States.' },

    { id: 'jupiter', name: 'Jupiter', kind: 'planet', tex: 'jupiter',
      radius: 1.7, dist: 30, period: 11.86, idx: 5,
      moons: [
        { id:'io',       name:'Io',       tex:'moon', tint: [1.05, 0.95, 0.55], radius:0.14, dist:2.7, period:0.005,
          eyebrow:'MOON / JUPITER', tag:'the volcano world', stats:{ 'Diameter':'3 643 km','Period':'1.77 days' },
          blurb:'The most volcanically active body in the solar system. Tidal heating from Jupiter keeps its mantle molten.' },
        { id:'europa',   name:'Europa',   tex:'moon', tint: [1.10, 1.10, 1.05], radius:0.13, dist:3.3, period:0.01,
          eyebrow:'MOON / JUPITER', tag:'the icy ocean', stats:{ 'Diameter':'3 122 km','Period':'3.55 days' },
          blurb:'A salty subsurface ocean larger than all of Earth\'s oceans combined, sealed beneath a kilometres-thick ice shell. The leading candidate for life beyond Earth.' },
        { id:'ganymede', name:'Ganymede', tex:'moon', radius:0.20, dist:4.1, period:0.02,
          eyebrow:'MOON / JUPITER', tag:'the largest moon', stats:{ 'Diameter':'5 268 km','Period':'7.15 days' },
          blurb:'Bigger than Mercury. The only moon with its own magnetic field.' },
        { id:'callisto', name:'Callisto', tex:'moon', dim: 0.85, radius:0.18, dist:5.0, period:0.05,
          eyebrow:'MOON / JUPITER', tag:'the cratered hermit', stats:{ 'Diameter':'4 821 km','Period':'16.7 days' },
          blurb:'The most heavily cratered body in the solar system. Possibly hides an ocean too.' }],
      eyebrow: 'PLANET No. 05 / GAS GIANT', tag: 'the king of the planets',
      stats: { 'Diameter':'139 820 km','Mass':'1.898×10²⁷ kg (318 Earths)','Day':'9 h 56 m',
               'Year':'11.86 Earth years','Distance':'5.20 AU','Moons':'95 known' },
      blurb: 'A gas giant so massive that it doesn\'t orbit the Sun — they orbit a shared barycentre slightly outside the Sun\'s surface. The Great Red Spot is a storm that has raged for at least four hundred years.' },

    { id: 'saturn', name: 'Saturn', kind: 'planet', tex: 'saturn',
      radius: 1.45, dist: 40, period: 29.46, idx: 6, hasRings: true,
      moons: [
        { id:'titan',     name:'Titan',     tex:'moon', tint:[1.30,1.05,0.65], radius:0.18, dist:3.8, period:0.04,
          eyebrow:'MOON / SATURN', tag:'the alien world', stats:{ 'Diameter':'5 149 km','Period':'15.95 days' },
          blurb:'A thick nitrogen atmosphere, methane rivers and lakes. The only moon with seasons and weather like a planet\'s.' },
        { id:'enceladus', name:'Enceladus', tex:'moon', tint:[1.20,1.20,1.20], radius:0.07, dist:2.8, period:0.005,
          eyebrow:'MOON / SATURN', tag:'the geyser moon', stats:{ 'Diameter':'504 km','Period':'1.37 days' },
          blurb:'Cracks at its south pole erupt water vapour into space — a subsurface ocean is venting through the surface.' },
        { id:'rhea',      name:'Rhea',      tex:'moon', radius:0.09, dist:4.4, period:0.012,
          eyebrow:'MOON / SATURN', tag:'the tenuous-ringed moon', stats:{ 'Diameter':'1 527 km','Period':'4.52 days' },
          blurb:'Believed to have a thin ring system of its own — the only moon suspected of doing so.' }],
      eyebrow: 'PLANET No. 06 / GAS GIANT', tag: 'the one with the rings',
      stats: { 'Diameter':'116 460 km','Day':'10 h 33 m','Year':'29.5 Earth years','Distance':'9.54 AU',
               'Density':'0.687 g/cm³ (less than water)','Moons':'146 known' },
      blurb: 'Made of so much hydrogen and helium that its average density is less than water — it would float in a bathtub big enough to hold it. The rings are a thin shell of orbiting ice and rock, mostly less than ten metres deep.' },

    { id: 'uranus', name: 'Uranus', kind: 'planet', tex: 'uranus',
      radius: 1.0, dist: 48, period: 84.0, idx: 7, tilted: true,
      moons: [
        { id:'titania', name:'Titania', tex:'moon', radius:0.10, dist:2.4, period:0.024,
          eyebrow:'MOON / URANUS', tag:'the largest uranian', stats:{ 'Diameter':'1 578 km','Period':'8.7 days' },
          blurb:'Surface scarred by enormous canyons cutting across icy plains.' },
        { id:'oberon',  name:'Oberon',  tex:'moon', dim:0.85, radius:0.09, dist:3.1, period:0.037,
          eyebrow:'MOON / URANUS', tag:'the outermost', stats:{ 'Diameter':'1 523 km','Period':'13.5 days' },
          blurb:'Heavily cratered ice with an unusual reddish tint near its impact basins.' }],
      eyebrow: 'PLANET No. 07 / ICE GIANT', tag: 'the planet on its side',
      stats: { 'Diameter':'50 724 km','Day':'17 h 14 m','Year':'84 Earth years','Distance':'19.2 AU',
               'Axial tilt':'97.8°','Moons':'27 known' },
      blurb: 'Knocked over by a primordial collision: its rotational axis is nearly parallel to its orbital plane, so each pole receives 42 years of unbroken sunlight followed by 42 years of darkness.' },

    { id: 'neptune', name: 'Neptune', kind: 'planet', tex: 'neptune',
      radius: 0.97, dist: 56, period: 164.8, idx: 8,
      moons: [
        { id:'triton', name:'Triton', tex:'moon', tint:[1.15,1.05,0.95], radius:0.14, dist:2.6, period:0.016,
          eyebrow:'MOON / NEPTUNE', tag:'the backwards moon', stats:{ 'Diameter':'2 707 km','Period':'5.88 days (retrograde)' },
          blurb:'Orbits backwards relative to Neptune\'s rotation — almost certainly a captured Kuiper Belt object. Its surface has active nitrogen geysers.' }],
      eyebrow: 'PLANET No. 08 / ICE GIANT', tag: 'the windiest world',
      stats: { 'Diameter':'49 244 km','Day':'16 h 6 m','Year':'164.8 Earth years','Distance':'30.07 AU',
               'Wind speeds':'up to 2 100 km/h','Moons':'14 known' },
      blurb: 'Discovered first on paper — astronomers predicted its existence from perturbations in Uranus\' orbit, then pointed a telescope at the predicted spot and found it within an hour. Its winds are the fastest in the solar system.' },
  ];
  const PLANETS = BODIES.filter((b) => b.kind === 'planet');

  // ============================================================
  // HOTSPOTS — clickable surface features, lat/lon on each body.
  // Click any marker to open its own editorial popup (re-uses the
  // info-card UI). Markers only appear when the camera gets close
  // (hidden at overview-zoom so the scene stays clean).
  // ============================================================
  const HOTSPOTS = {
    mercury: [
      { name: 'Caloris Basin', lat: 30, lon: 160,
        eyebrow: 'IMPACT BASIN / MERCURY', tag: 'a 1 550 km crater',
        blurb: 'One of the largest impact craters in the solar system. Created ~3.8 billion years ago by an asteroid strike — the shockwave produced "weird terrain" on Mercury\'s far side.' },
    ],
    venus: [
      { name: 'Maxwell Montes', lat: 65, lon: 3,
        eyebrow: 'HIGHEST POINT / VENUS', tag: 'taller than Everest',
        blurb: 'A mountain range 11 km tall — Venus\'s highest. Named after James Clerk Maxwell. Even at this altitude the surface is 380 °C; the lower troposphere is hotter.' },
    ],
    earth: [
      { name: 'Mount Everest', lat: 27.99, lon: 86.93,
        eyebrow: 'HIGHEST PEAK / EARTH', tag: '8 849 m above sea level',
        blurb: 'The tallest mountain above sea level. The Himalayas rose because the Indian Plate is still ramming into the Eurasian Plate at about 5 cm per year.' },
      { name: 'Sahara', lat: 23, lon: 13,
        eyebrow: 'LARGEST HOT DESERT / EARTH', tag: '9.2 million km²',
        blurb: 'Roughly the area of the United States. Nine million years ago this was savannah; a slow oscillation in Earth\'s axial tilt cycles the region between green and bone-dry.' },
    ],
    mars: [
      { name: 'Olympus Mons', lat: 18.65, lon: -133.8,
        eyebrow: 'LARGEST VOLCANO / MARS', tag: 'three Everests stacked',
        blurb: 'A shield volcano 22 km tall and 600 km wide — covers an area the size of Arizona. It got this big because Mars has no plate tectonics: the magma plume kept building the same mountain for billions of years.' },
      { name: 'Valles Marineris', lat: -14, lon: -59,
        eyebrow: 'GRAND CANYON OF MARS', tag: '4 000 km long',
        blurb: 'Coast-to-coast across the United States. Up to 7 km deep — over four times deeper than the Grand Canyon. Likely formed when the crust split as the Tharsis volcanic plateau rose.' },
    ],
    jupiter: [
      { name: 'Great Red Spot', lat: -22, lon: -78,
        eyebrow: 'STORM / JUPITER', tag: 'twice the diameter of Earth',
        blurb: 'A high-pressure anticyclone observed continuously since at least the 1830s, possibly since 1665. Has shrunk over time, but still wide enough to swallow our planet.' },
    ],
    saturn: [
      { name: 'Hexagonal Storm', lat: 78, lon: 0,
        eyebrow: 'NORTH POLE / SATURN', tag: 'a perfect hexagon',
        blurb: 'A six-sided jet stream encircling Saturn\'s north pole, large enough to fit four Earths inside. Lab experiments suggest it\'s the natural shape a vortex takes at this latitude with this rotation rate.' },
    ],
    uranus: [
      { name: 'Uranian Dark Spot', lat: 27, lon: -45,
        eyebrow: 'STORM / URANUS', tag: 'rare and seasonal',
        blurb: 'Spotted by Hubble in 2006 — Uranus is normally featureless because of its tilt; storms only appear when the equinox brings sunlight to mid-latitudes and drives convection.' },
    ],
    neptune: [
      { name: 'Great Dark Spot', lat: -22, lon: 30,
        eyebrow: 'STORM (HISTORIC) / NEPTUNE', tag: 'photographed once, then gone',
        blurb: 'Photographed by Voyager 2 in 1989 — a Eurasia-sized high-pressure system. By 1994 it had dissolved, replaced by other dark spots elsewhere on the planet. Storms here are enormous but short-lived.' },
    ],
    luna: [
      { name: 'Mare Tranquillitatis', lat: 8.5, lon: 31.4,
        eyebrow: 'APOLLO 11 LANDING / MOON', tag: 'July 20, 1969',
        blurb: 'Where Armstrong and Aldrin first set foot on another world. The "sea" is a basalt plain from ancient lava flows that filled an impact basin about 3.7 billion years ago.' },
    ],
  };
  const allHotspotMeshes = []; // raycast targets

  // ============================================================
  // Three.js scene + renderer (PBR + ACES filmic + sRGB output)
  // ============================================================
  const canvas = $('#scene');
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 5000);
  camera.position.set(0, 28, 70);
  camera.lookAt(0, 0, 0);

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // ============================================================
  // Texture loading — local files at /data/space/textures/. The
  // legacy widget pulled these from solarsystemscope.com but their
  // CDN doesn't return CORS headers, so they're bundled into the
  // repo (~8 MB total).
  // ============================================================
  const TEX_BASE = '/data/space/textures/';
  const TEX_PATHS = {
    sun:               '2k_sun.jpg',
    mercury:           '2k_mercury.jpg',
    venus_surface:     '2k_venus_surface.jpg',
    venus_atmosphere:  '2k_venus_atmosphere.jpg',
    earth_day:         '2k_earth_daymap.jpg',
    earth_night:       '2k_earth_nightmap.jpg',
    earth_clouds:      '2k_earth_clouds.jpg',
    earth_normal:      '2k_earth_normal_map.png',
    earth_spec:        '2k_earth_specular_map.png',
    moon:              '2k_moon.jpg',
    mars:              '2k_mars.jpg',
    jupiter:           '2k_jupiter.jpg',
    saturn:            '2k_saturn.jpg',
    saturn_ring:       '2k_saturn_ring_alpha.png',
    uranus:            '2k_uranus.jpg',
    neptune:           '2k_neptune.jpg',
    stars_milky_way:   '2k_stars_milky_way.jpg',
  };

  const loadingMgr = new THREE.LoadingManager();
  let loadDone = 0, loadTotal = 0;
  loadingMgr.onStart = (_u, l, t) => { loadTotal = t; };
  loadingMgr.onProgress = (_u, l, t) => {
    loadDone = l; loadTotal = t;
    const pct = t ? Math.round(100 * l / t) : 0;
    const bar = $('#loadFill'); if (bar) bar.style.width = pct + '%';
    const pctEl = $('#loadPct'); if (pctEl) pctEl.textContent = pct + '%';
  };
  loadingMgr.onLoad = () => {
    const ov = $('#loadOverlay');
    if (ov) { ov.classList.add('is-done'); setTimeout(() => ov.remove(), 600); }
  };
  loadingMgr.onError = (url) => console.warn('Texture failed:', url);

  const texLoader = new THREE.TextureLoader(loadingMgr);
  function loadTex(key, { srgb = true, wrap = THREE.ClampToEdgeWrapping } = {}) {
    const t = texLoader.load(TEX_BASE + TEX_PATHS[key]);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.wrapS = wrap; t.wrapT = wrap;
    return t;
  }
  const TEX = {
    sun:              loadTex('sun'),
    mercury:          loadTex('mercury'),
    venus_atmosphere: loadTex('venus_atmosphere'),
    earth_day:        loadTex('earth_day'),
    earth_night:      loadTex('earth_night'),
    earth_clouds:     loadTex('earth_clouds'),
    earth_normal:     loadTex('earth_normal', { srgb: false }),
    earth_spec:       loadTex('earth_spec',   { srgb: false }),
    moon:             loadTex('moon'),
    mars:             loadTex('mars'),
    jupiter:          loadTex('jupiter'),
    saturn:           loadTex('saturn'),
    saturn_ring:      loadTex('saturn_ring'),
    uranus:           loadTex('uranus'),
    neptune:          loadTex('neptune'),
    stars_milky_way:  loadTex('stars_milky_way'),
  };

  // Milky Way panorama as the scene background (equirect mapping).
  TEX.stars_milky_way.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = TEX.stars_milky_way;
  scene.environment = TEX.stars_milky_way;

  // ============================================================
  // Lighting: a single bright PointLight at the Sun (origin), no
  // attenuation falloff over our compressed distances — and a touch
  // of ambient so unlit hemispheres still read.
  // ============================================================
  const sunLight = new THREE.PointLight(0xffffff, 2.6, 0, 0);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));

  // ============================================================
  // Sun — emissive, ignores scene lights.
  // ============================================================
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(BODIES[0].radius, 64, 64),
    new THREE.MeshBasicMaterial({ map: TEX.sun, toneMapped: false }));
  sun.userData.body = BODIES[0];
  scene.add(sun);

  // Sun corona — additive sprites stacked for a soft halo.
  function makeGlowSprite(rgb, opacity = 0.6) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const r = (rgb >> 16) & 0xff, g = (rgb >> 8) & 0xff, b = rgb & 0xff;
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.5)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
    return new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), color: 0xffffff,
      blending: THREE.AdditiveBlending, transparent: true,
      opacity, depthWrite: false, toneMapped: false,
    }));
  }
  // Three stacked additive halos approximate a real photographic
  // bloom — inner hot, mid yellow, outer faint. Toggle for a
  // postprocessing UnrealBloomPass later if perf allows.
  const sunCorona1 = makeGlowSprite(0xffba4a, 0.85); sunCorona1.scale.set(15, 15, 1); sun.add(sunCorona1);
  const sunCorona2 = makeGlowSprite(0xfff0c0, 0.45); sunCorona2.scale.set(28, 28, 1); sun.add(sunCorona2);
  const sunCorona3 = makeGlowSprite(0xffe7a8, 0.18); sunCorona3.scale.set(50, 50, 1); sun.add(sunCorona3);

  // ============================================================
  // Earth — custom shader: day map lit by sun, night map (city
  // lights) on the dark side, water specular highlight, normal map
  // for relief, smooth terminator with a faint sunset glow.
  // ============================================================
  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap:    { value: TEX.earth_day },
      nightMap:  { value: TEX.earth_night },
      specMap:   { value: TEX.earth_spec },
      normalMap: { value: TEX.earth_normal },
      sunPos:    { value: new THREE.Vector3(0, 0, 0) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldTangent;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        // Cheap tangent — good enough for cosmetic normal mapping.
        vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), vWorldNormal));
        if (length(t) < 0.01) t = vec3(1.0, 0.0, 0.0);
        vWorldTangent = t;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D specMap;
      uniform sampler2D normalMap;
      uniform vec3 sunPos;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldTangent;
      void main() {
        vec3 N = normalize(vWorldNormal);
        // Perturb the normal with a tiny influence from the normal
        // map for surface relief (subtle — full strength looks fake).
        vec3 nm = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
        vec3 T = normalize(vWorldTangent);
        vec3 B = normalize(cross(N, T));
        // Subtle relief — too strong reads as a "wet" gloss across
        // the whole landmass under specular shading.
        N = normalize(N + (T * nm.x + B * nm.y) * 0.30);

        vec3 L = normalize(sunPos - vWorldPos);
        float NdotL = dot(N, L);
        // Smooth day/night blend across the terminator.
        float dayBlend = smoothstep(-0.12, 0.22, NdotL);

        vec3 day  = texture2D(dayMap,   vUv).rgb;
        vec3 night= texture2D(nightMap, vUv).rgb;

        // Lit day side: clamp to 0 then add a small ambient lift.
        float lit = max(NdotL, 0.0) * 0.92 + 0.10;
        vec3 dayLit = day * lit;

        // Specular on water only. specMap.g goes black over land and
        // white over ocean — threshold it so coastlines don't smear,
        // tighten the lobe (high exponent = small glint), and dial
        // intensity way back so Earth doesn't look like a wet plastic
        // ball. Real ocean specular from orbit is a small bright dot.
        float waterMask = smoothstep(0.45, 0.75, texture2D(specMap, vUv).g);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 80.0) * waterMask * 0.22;

        // Sunset glow at the terminator — warms the limb a touch.
        float term = 1.0 - smoothstep(0.0, 0.22, abs(NdotL));
        vec3 sunsetGlow = vec3(1.0, 0.55, 0.25) * term * 0.10;

        vec3 col = mix(night * 1.6, dayLit + vec3(spec) + sunsetGlow, dayBlend);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  // Earth's clouds — separate sphere with cloud texture, transparent.
  const cloudMat = new THREE.MeshStandardMaterial({
    map: TEX.earth_clouds,
    alphaMap: TEX.earth_clouds,
    transparent: true,
    depthWrite: false,
    roughness: 1, metalness: 0,
  });
  // Earth atmosphere — Fresnel rim shell that shifts colour based on
  // the sun direction at each point. Pale blue on the dayside, warm
  // orange at the terminator (the iconic sunset glow you see from
  // ISS photos), darker on the night side. Fades on the back face
  // (rendered with side: BackSide, additive blending).
  const atmosphereMat = new THREE.ShaderMaterial({
    uniforms: { sunPos: { value: new THREE.Vector3(0, 0, 0) } },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 sunPos;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(sunPos - vWorldPos);
        float fres = pow(1.0 - abs(dot(N, V)), 2.4);
        float NdotL = dot(N, L);
        // Strongest where the sun is grazing this surface point — the
        // narrow strip between day and night. That's where Rayleigh
        // scattering reddens real-world sunlight.
        float term = 1.0 - smoothstep(0.0, 0.30, abs(NdotL));
        vec3 day    = vec3(0.40, 0.62, 1.00);
        vec3 sunset = vec3(1.00, 0.45, 0.18);
        vec3 col = mix(day, sunset, term * 0.85);
        // Strong on lit side, faint backside glow elsewhere.
        float intensity = mix(0.25, 1.05, max(NdotL, 0.0));
        gl_FragColor = vec4(col, fres * intensity);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending,
    side: THREE.BackSide, depthWrite: false,
  });

  // Standard textured material for everything else (PBR via PointLight).
  // Cratered rocky bodies (Moon, Mercury, Mars) reuse their diffuse
  // map as a bump map — the brightness gradients become surface
  // relief, so craters cast directional shadows under sun light.
  const BUMPABLE = new Set(['moon', 'mercury', 'mars']);
  function texturedMat(texKey, { tint = null, dim = 1, bumpScale } = {}) {
    const opts = { map: TEX[texKey], roughness: 1, metalness: 0 };
    if (BUMPABLE.has(texKey)) {
      opts.bumpMap = TEX[texKey];
      opts.bumpScale = bumpScale ?? 0.025;
    }
    const m = new THREE.MeshStandardMaterial(opts);
    if (tint) m.color = new THREE.Color(tint[0] * dim, tint[1] * dim, tint[2] * dim);
    else if (dim !== 1) m.color = new THREE.Color(dim, dim, dim);
    return m;
  }

  // ============================================================
  // Build planets + moons
  // ============================================================
  const planetMeshes = [];
  const allMoonMeshes = [];

  // Real axial tilts (degrees from the orbital plane). Uranus has
  // its own `tilted` flag because 97° is so dramatic it deserves the
  // visual call-out, but the rest get their literal IAU values.
  // Venus's 177° is conventionally "axis flipped" — combined with a
  // positive rotation period it reproduces Venus's retrograde spin
  // for free (same trick for Uranus at 98°).
  const AXIAL_TILT = {
    mercury:  0.034, venus: 177.36, earth: 23.4393, mars: 25.19,
    jupiter:  3.13,  saturn: 26.73, uranus: 97.77,  neptune: 28.32,
  };

  // ============================================================
  // REAL ORBITAL MECHANICS — J2000 Keplerian elements for every
  // planet, lifted from IAU / NASA-Horizons mean values. Each frame
  // we solve Kepler's equation for the eccentric anomaly, recover
  // the true anomaly, and place the planet on its actual ellipse:
  // eccentricity (so Mercury's 0.21 oblong orbit reads correctly),
  // inclination (so the ecliptic isn't a perfect plane), argument
  // of perihelion, longitude of ascending node, and mean longitude
  // at J2000 (so opening the page on any given date snaps the
  // planets to their real-world positions on that date).
  //
  // The art-direction distances (`p.dist`) are preserved as the
  // semi-major axis of each ellipse, so the visual scale of the
  // system is unchanged — only the orbital motion becomes real.
  // ============================================================
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  // e  : eccentricity                          (dimensionless)
  // i  : inclination to the ecliptic           (deg)
  // Om : longitude of ascending node (Ω)        (deg)
  // pi : longitude of perihelion     (ϖ = Ω+ω) (deg)
  // L0 : mean longitude at J2000               (deg)
  // T  : sidereal orbital period               (Julian years)
  const ORBITAL_ELEMENTS = {
    mercury: { e: 0.205630, i: 7.00497, Om: 48.33167,  pi: 77.45645,  L0: 252.25084, T: 0.2408467 },
    venus:   { e: 0.006772, i: 3.39467, Om: 76.68069,  pi: 131.53298, L0: 181.97973, T: 0.6151973 },
    earth:   { e: 0.016708, i: 0.00005, Om: -11.26064, pi: 102.94719, L0: 100.46435, T: 1.0000174 },
    mars:    { e: 0.093394, i: 1.84969, Om: 49.55953,  pi: 336.04084, L0: 355.45332, T: 1.8808476 },
    jupiter: { e: 0.048386, i: 1.30440, Om: 100.47391, pi: 14.72847,  L0: 34.39644,  T: 11.862615 },
    saturn:  { e: 0.054151, i: 2.48599, Om: 113.66242, pi: 92.59888,  L0: 49.95424,  T: 29.447498 },
    uranus:  { e: 0.047168, i: 0.77264, Om: 74.01693,  pi: 170.95427, L0: 313.23810, T: 84.016846 },
    neptune: { e: 0.008586, i: 1.77004, Om: 131.78423, pi: 44.96476,  L0: -55.12003, T: 164.79132 },
  };

  // Sidereal rotation periods (Earth days). Real ratios — Jupiter
  // spins ~24× faster than Earth, Mercury ~60× slower. Compressed
  // by ROT_TIME_FACTOR so the fastest spinners don't strobe at
  // default time pace and the slowest are still watchable. Venus
  // and Uranus appear retrograde for free via their >90° obliquity.
  const SIDEREAL_ROT_DAYS = {
    mercury: 58.6462,
    venus:   243.0185,
    earth:   0.99726968,
    mars:    1.02595675,
    jupiter: 0.41354,
    saturn:  0.44401,
    uranus:  0.71833,
    neptune: 0.67125,
  };
  // Slowdown so spin rates fit the simulation's compressed time —
  // ratios are real (Jupiter still spins ~24× faster than Earth)
  // but absolute speeds are watchable.
  const ROT_TIME_FACTOR = 140;
  const SUN_ROT_DAYS = 25.38; // solar equatorial sidereal rotation

  // Real semi-major axes in AU (for the AU readout in body labels —
  // the scene `p.dist` is compressed art-direction, this is physical).
  const REAL_SEMI_MAJOR_AU = {
    mercury: 0.387, venus: 0.723, earth: 1.000, mars: 1.524,
    jupiter: 5.203, saturn: 9.537, uranus: 19.189, neptune: 30.070,
  };

  // Moon orbital inclinations to the parent body's equator (deg).
  // Triton's 156.885° is its famous retrograde orbit — the only
  // large moon that orbits backwards relative to its planet's spin.
  const MOON_INCLINATION = {
    luna: 5.145,
    phobos: 1.093, deimos: 1.788,
    io: 0.04, europa: 0.470, ganymede: 0.204, callisto: 0.205,
    titan: 0.349, enceladus: 0.019, rhea: 0.345,
    titania: 0.340, oberon: 0.058,
    triton: 156.885,
  };

  // Solve M = E - e·sin(E) for the eccentric anomaly E (Newton's
  // method, converges in 3-4 steps for solar-system eccentricities).
  function keplerE(M, e) {
    let E = M;
    for (let k = 0; k < 6; k++) {
      const f = E - e * Math.sin(E) - M;
      const fp = 1 - e * Math.cos(E);
      E -= f / fp;
    }
    return E;
  }

  // Place a body on its ellipse given the eccentric anomaly E.
  // Returns scene-space coordinates (Y is up = ecliptic normal).
  // Used both each tick and at build-time (to trace the orbit ring
  // as the true ellipse, not a circle).
  function orbitPositionByE(el, a, E) {
    const e = el.e;
    const cosE = Math.cos(E), sinE = Math.sin(E);
    const nu = Math.atan2(Math.sqrt(1 - e * e) * sinE, cosE - e);
    const r = a * (1 - e * cosE);
    const iR  = el.i * DEG;
    const OmR = el.Om * DEG;
    const omR = (el.pi - el.Om) * DEG;
    const cnu = Math.cos(nu + omR), snu = Math.sin(nu + omR);
    const cOm = Math.cos(OmR),      sOm = Math.sin(OmR);
    const cI  = Math.cos(iR),        sI = Math.sin(iR);
    const x   = r * (cOm * cnu - sOm * snu * cI);
    const y3D = r * (sOm * cnu + cOm * snu * cI);
    const z3D = r * (snu * sI);
    // Ecliptic z → Three.js y (out-of-plane); ecliptic y → Three.js z.
    return new THREE.Vector3(x, z3D, y3D);
  }

  // Heliocentric position from the current simulated Julian Date.
  function planetPos(p) {
    const el = ORBITAL_ELEMENTS[p.id];
    if (!el) return new THREE.Vector3(p.dist, 0, 0);
    const days = currentJD - J2000_JD;
    const L = el.L0 * DEG + (TAU * days) / (el.T * 365.25);
    const M = L - el.pi * DEG;
    const E = keplerE(M, el.e);
    return orbitPositionByE(el, p.dist, E);
  }

  // Sample the orbit at uniform eccentric anomaly so the rendered
  // line is dense enough at perihelion (where the planet moves fast
  // and visual curvature is tightest).
  function buildOrbitLine(p) {
    const el = ORBITAL_ELEMENTS[p.id];
    const STEPS = 360;
    const pts = [];
    for (let k = 0; k <= STEPS; k++) {
      if (el) {
        pts.push(orbitPositionByE(el, p.dist, (k / STEPS) * TAU));
      } else {
        const a = (k / STEPS) * TAU;
        pts.push(new THREE.Vector3(Math.cos(a) * p.dist, 0, Math.sin(a) * p.dist));
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
      color: 0xb6c4e2, transparent: true, opacity: 0.35, depthWrite: false,
    }));
  }

  // Calendar utilities (used by both the orbital code above and the
  // date picker further down). Defined here so the orbital block is
  // self-contained.
  const J2000_JD = 2451545.0; // 2000-01-01 12:00 UTC
  function jdFromDate(d) { return d.getTime() / 86400000 + 2440587.5; }
  function dateFromJd(jd) { return new Date((jd - 2440587.5) * 86400000); }

  // Simulation clock starts at "today" so opening the page shows
  // every planet in its real-world position right now.
  let currentJD = jdFromDate(new Date());
  let speed = 1;
  let playing = true;
  // Days of simulation time advanced per real second at speed=1×.
  // Kept moderate so inner planets don't strobe past at default pace
  // — Mercury still does a full orbit in ~44 real seconds at 1×, but
  // the user can crank to 16× / 64× for a fast tour.
  const DAYS_PER_SECOND = 2;
  document.body.dataset.playing = 'true';

  // ============================================================
  // N-BODY SIMULATION — toggleable second physics mode.
  //
  // Kepler (default): each planet on its closed-form ellipse,
  //   independent of every other planet — analytically perfect for
  //   the two-body problem, but doesn't capture the perturbations
  //   that Jupiter (in particular) inflicts on everyone else.
  //
  // N-body (this block): velocity-Verlet integration of the full
  //   nine-body problem (Sun + eight planets) using real Standard
  //   Gravitational Parameters (GM, in AU³/day²). The integrator
  //   is symplectic — it conserves energy and angular momentum
  //   indefinitely, so the system stays stable over arbitrarily
  //   long runs. Mercury's perihelion now precesses from Jupiter's
  //   pull (sub-arcsec per orbit, accumulates noticeably over
  //   centuries — crank speed to 64× and watch).
  //
  // Visual scaling: the integrator works in REAL AU and AU/day so
  // gravity is physically meaningful, then each planet's real
  // position is mapped onto its compressed scene radius so the
  // visual layout doesn't change when you toggle. Perturbations
  // from mean orbit are scaled the same way and become visible
  // small deviations from the Keplerian ellipse.
  // ============================================================

  // Standard Gravitational Parameters in AU³/day² (JPL DE440).
  // GM_planet includes the planet's moon system where relevant
  // (so Earth's value is for the Earth-Moon barycentre).
  const GM_SUN = 2.959122082855911e-04;
  const GM_PLANET = {
    mercury: 4.91248045e-11,
    venus:   7.24345233e-10,
    earth:   8.99701140e-10, // Earth + Moon
    mars:    9.54954870e-11,
    jupiter: 2.82534585e-07,
    saturn:  8.45970592e-08,
    uranus:  1.29202482e-08,
    neptune: 1.52435911e-08,
  };

  // N-body state: each planet's (pos, vel) in real heliocentric AU
  // and AU/day. Lazy-initialised on first toggle-on; re-initialised
  // when the user date-picks across more than a year.
  const nBody = {
    enabled: false,
    state: null,           // { id: { pos: Vec3, vel: Vec3 } }
    lastJD: 0,
    // Cached working vectors so the hot path doesn't allocate.
    _tmp: new THREE.Vector3(),
  };

  function nBodyInit(JD) {
    const state = {};
    // Velocity comes from a tight finite difference of the analytic
    // position — accurate to ~1e-10 AU/day for ε = 1e-3 day.
    const EPS = 1e-3;
    Object.keys(ORBITAL_ELEMENTS).forEach((id) => {
      const el = ORBITAL_ELEMENTS[id];
      const aAU = REAL_SEMI_MAJOR_AU[id] || 1;
      const daysA = JD - J2000_JD;
      const daysB = daysA + EPS;
      const LA = el.L0 * DEG + (TAU * daysA) / (el.T * 365.25);
      const LB = el.L0 * DEG + (TAU * daysB) / (el.T * 365.25);
      const pos = orbitPositionByE(el, aAU, keplerE(LA - el.pi * DEG, el.e));
      const posB = orbitPositionByE(el, aAU, keplerE(LB - el.pi * DEG, el.e));
      const vel = posB.sub(pos).divideScalar(EPS);
      state[id] = { pos, vel };
    });
    return state;
  }

  // Sum -GM_sun·r̂/r² (Sun on each planet) plus pairwise planet
  // gravity. Returns a fresh acceleration map.
  function nBodyAccel(state) {
    const ids = Object.keys(state);
    const acc = {};
    ids.forEach((id) => { acc[id] = new THREE.Vector3(); });
    const tmp = nBody._tmp;
    // Sun's pull on each planet (Sun fixed at origin — its motion
    // around the barycentre is negligible at this visual scale).
    ids.forEach((id) => {
      const p = state[id].pos;
      const r2 = p.lengthSq();
      const r = Math.sqrt(r2);
      acc[id].addScaledVector(p, -GM_SUN / (r2 * r));
    });
    // Mutual planet-planet gravity — Newton's third law, one pair
    // computed, equal-and-opposite applied to both.
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        tmp.copy(state[b].pos).sub(state[a].pos);
        const r2 = tmp.lengthSq();
        const r = Math.sqrt(r2);
        const inv3 = 1 / (r2 * r);
        acc[a].addScaledVector(tmp,  GM_PLANET[b] * inv3);
        acc[b].addScaledVector(tmp, -GM_PLANET[a] * inv3);
      }
    }
    return acc;
  }

  // One velocity-Verlet step of size h days. Symplectic, 2nd order,
  // energy-conserving over indefinite integrations — won't drift
  // even after simulated centuries.
  function nBodyStep(state, h) {
    const ids = Object.keys(state);
    const a0 = nBodyAccel(state);
    const half_h2 = 0.5 * h * h;
    ids.forEach((id) => {
      state[id].pos
        .addScaledVector(state[id].vel, h)
        .addScaledVector(a0[id], half_h2);
    });
    const a1 = nBodyAccel(state);
    const half_h = 0.5 * h;
    ids.forEach((id) => {
      state[id].vel
        .addScaledVector(a0[id], half_h)
        .addScaledVector(a1[id], half_h);
    });
  }

  // Advance the N-body state from nBody.lastJD to targetJD using
  // ≤0.5-day sub-steps (Mercury's 88-day orbit gets ≥176 steps,
  // plenty for accuracy). A big delta (>1 year — typically the
  // user date-picking) triggers a re-seed from Kepler, since
  // integrating 30 years across a few frames would be wasteful and
  // wouldn't show anything useful anyway.
  function nBodyAdvance(targetJD) {
    if (!nBody.state) {
      nBody.state = nBodyInit(targetJD);
      nBody.lastJD = targetJD;
      return;
    }
    const dJD = targetJD - nBody.lastJD;
    if (dJD === 0) return;
    if (Math.abs(dJD) > 365) {
      nBody.state = nBodyInit(targetJD);
      nBody.lastJD = targetJD;
      return;
    }
    const MAX_H = 0.5;
    const sign = Math.sign(dJD);
    let remaining = Math.abs(dJD);
    // Cap iterations so a pathological dt (e.g. tab in background
    // then resumed) can't lock the renderer for a frame.
    let safety = 2000;
    while (remaining > 1e-9 && safety-- > 0) {
      const h = sign * Math.min(remaining, MAX_H);
      nBodyStep(nBody.state, h);
      remaining -= Math.abs(h);
    }
    nBody.lastJD = targetJD;
  }

  // ============================================================
  // Hotspot markers — billboarded sprites parented to each host
  // body so they orbit and rotate with it. Defined HERE (above the
  // PLANETS.forEach loop) because that loop calls spawnHotspots for
  // each planet, and `const HOTSPOT_TEX` must be initialised before
  // any spawn call (TDZ otherwise).
  // ============================================================
  function latLonToVec3(lat, lon, r) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = lon * Math.PI / 180;
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
  }
  // Shared crosshair texture for the hotspot sprites — outer halo +
  // ring + dot, transparent. One canvas allocation reused across
  // every marker.
  const HOTSPOT_TEX = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 28, 64, 64, 60);
    grad.addColorStop(0, 'rgba(255, 77, 77, 0.30)');
    grad.addColorStop(1, 'rgba(255, 77, 77, 0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(64, 64, 38, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath(); ctx.arc(64, 64, 14, 0, Math.PI * 2); ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  function spawnHotspots(parentMesh, body) {
    const list = HOTSPOTS[body.id] || [];
    list.forEach((h) => {
      const r = body.radius;
      const pos = latLonToVec3(h.lat, h.lon, r * 1.01);
      const size = Math.max(r * 0.55, 0.20);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: HOTSPOT_TEX, color: 0xffffff,
        transparent: true, opacity: 0,
        depthTest: false, depthWrite: false,
        toneMapped: false,
      }));
      sprite.scale.set(size, size, 1);
      sprite.position.copy(pos);
      sprite.renderOrder = 10;
      sprite.userData.hotspot = { ...h, parentBodyName: body.name };
      parentMesh.add(sprite);
      allHotspotMeshes.push(sprite);
    });
  }

  PLANETS.forEach((p) => {
    let mat;
    if (p.id === 'earth') mat = earthMat;
    else mat = texturedMat(p.tex);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 64, 64), mat);
    mesh.userData.body = p;
    // Apply axial tilt (Z rotation in our orbit-plane=XZ setup).
    const tiltDeg = AXIAL_TILT[p.id] ?? 0;
    mesh.rotation.z = tiltDeg * Math.PI / 180;
    scene.add(mesh);
    planetMeshes.push(mesh);

    // Orbit ring — actual ellipse (e ≠ 0 for every planet) with
    // its real inclination to the ecliptic. Mercury's 0.21 eccentric
    // ellipse and 7° tilt are immediately visible; the rest are
    // subtle but technically right.
    scene.add(buildOrbitLine(p));

    // Earth: clouds + atmosphere shells
    if (p.hasClouds) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius * 1.012, 64, 64), cloudMat.clone());
      clouds.userData.skipPick = true;
      mesh.add(clouds);
      mesh.userData.cloudShell = clouds;
    }
    if (p.hasAtmosphere) {
      const atm = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius * 1.06, 48, 48), atmosphereMat);
      atm.userData.skipPick = true;
      mesh.add(atm);
    }

    // Saturn rings — textured strip wrapped radially. RingGeometry's
    // default UV's wrap angularly; rewrite them to map U=radius so the
    // colour gradient on saturn_ring_alpha.png comes out right.
    if (p.hasRings) {
      const inner = p.radius * 1.45;
      const outer = p.radius * 2.55;
      const ringGeo = new THREE.RingGeometry(inner, outer, 128);
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const r = Math.sqrt(x * x + y * y);
        uv.setXY(i, (r - inner) / (outer - inner), 0.5);
      }
      uv.needsUpdate = true;
      const ringMat = new THREE.MeshBasicMaterial({
        map: TEX.saturn_ring,
        alphaMap: TEX.saturn_ring,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        opacity: 0.95,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      // Rings sit in the planet's equatorial plane. RingGeometry's
      // default plane is XY; rotate to XZ so it inherits the mesh's
      // axial tilt (Z rotation = 26.73°), giving the correct
      // photorealistic angle relative to the orbit.
      ring.rotation.x = Math.PI / 2;
      ring.userData.skipPick = true;
      mesh.add(ring);
    }

    // Moons live on a per-planet "moon hub" — a separate Object3D
    // parented to the scene that inherits the planet's axial tilt
    // (so moon orbits sit on the equatorial plane, e.g. Saturn's
    // moons get the ring-plane for free) but does NOT inherit the
    // planet's spin. Before this, moons were direct children of the
    // planet mesh and got dragged around by its rotation — Jupiter's
    // moons used to whip past at the planet's rotation rate added to
    // their own orbital rate, which was unphysical.
    let moonHub = null;
    if (p.moons && p.moons.length > 0) {
      moonHub = new THREE.Object3D();
      moonHub.rotation.z = tiltDeg * DEG;
      scene.add(moonHub);
      mesh.userData.moonHub = moonHub;
    }
    mesh.userData.moonPivots = (p.moons || []).map((m, mi) => {
      const moonMat = texturedMat(m.tex || 'moon', { tint: m.tint, dim: m.dim || 1 });
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(m.radius, 32, 32), moonMat);
      moonMesh.userData.body = m;
      moonHub.add(moonMesh);
      allMoonMeshes.push(moonMesh);
      // Moons can host hotspots too (Apollo 11 site on the Moon).
      spawnHotspots(moonMesh, m);
      return { mesh: moonMesh, dist: m.dist + p.radius * 0.85, period: m.period,
               phase: (mi * 1.7) % (Math.PI * 2),
               inclination: MOON_INCLINATION[m.id] || 0 };
    });
    // Hotspots on the planet itself.
    spawnHotspots(mesh, p);
  });

  // ============================================================
  // (hotspot helpers moved above the PLANETS.forEach build loop —
  // the loop calls spawnHotspots for each planet/moon, and the
  // shared HOTSPOT_TEX const has to be initialised before that
  // first call to avoid a temporal-dead-zone error.)

  // ============================================================
  // ORBIT TRAILS — each planet leaves a fading line behind it.
  // Stored as a fixed-size ring buffer of world positions; rebuilt
  // into a Line each frame with a per-vertex alpha attribute that
  // fades the older points to transparent.
  // ============================================================
  const TRAIL_LEN = 240;
  const trails = []; // { mesh, planetMesh, positions, head, count, geo, mat }
  PLANETS.forEach((pm, i) => {
    const positions = new Float32Array(TRAIL_LEN * 3);
    const alphas = new Float32Array(TRAIL_LEN);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x88aaff) } },
      vertexShader: /* glsl */`
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        varying float vAlpha;
        void main() { gl_FragColor = vec4(uColor, vAlpha * 0.55); }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    scene.add(line);
    trails.push({ line, planetMesh: planetMeshes[i], positions, alphas,
                  head: 0, count: 0, geo });
  });
  function updateTrails() {
    const wp = new THREE.Vector3();
    trails.forEach((tr) => {
      tr.planetMesh.getWorldPosition(wp);
      // Push current world position into the ring buffer.
      const idx = tr.head * 3;
      tr.positions[idx]     = wp.x;
      tr.positions[idx + 1] = wp.y;
      tr.positions[idx + 2] = wp.z;
      tr.head = (tr.head + 1) % TRAIL_LEN;
      tr.count = Math.min(tr.count + 1, TRAIL_LEN);

      // Rebuild a contiguous strip from oldest → newest with fading
      // alpha so the head is bright and the tail fades to nothing.
      const out = new Float32Array(tr.count * 3);
      const alphas = new Float32Array(tr.count);
      for (let i = 0; i < tr.count; i++) {
        const sourceIdx = (tr.head - tr.count + i + TRAIL_LEN) % TRAIL_LEN;
        out[i * 3]     = tr.positions[sourceIdx * 3];
        out[i * 3 + 1] = tr.positions[sourceIdx * 3 + 1];
        out[i * 3 + 2] = tr.positions[sourceIdx * 3 + 2];
        alphas[i] = i / tr.count; // 0 at oldest → 1 at newest
      }
      tr.geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
      tr.geo.setAttribute('alpha',    new THREE.BufferAttribute(alphas, 1));
      tr.geo.setDrawRange(0, tr.count);
      tr.geo.attributes.position.needsUpdate = true;
    });
  }

  // ============================================================
  // Animation — drives every body off the simulated Julian Date.
  // Planet positions come from the Keplerian solver up top
  // (eccentricity + inclination + perihelion + ascending node),
  // self-rotation uses real sidereal periods (compressed by
  // ROT_TIME_FACTOR), and moons sit on their planet's equatorial
  // plane via the moon-hub Object3D (so they inherit axial tilt
  // but not spin).
  // ============================================================
  function tick(dt) {
    const dJD = playing ? dt * speed * DAYS_PER_SECOND : 0;
    if (playing) currentJD += dJD;
    // When N-body is on, step the integrator from its last known
    // time to the new currentJD. Inside this call: velocity-Verlet
    // sub-stepping with mutual Sun+8-planet gravity, in real AU.
    if (nBody.enabled) nBodyAdvance(currentJD);
    PLANETS.forEach((p, i) => {
      const m = planetMeshes[i];
      // Heliocentric position. In Kepler mode: closed-form solution
      // to the two-body problem from this planet's orbital elements.
      // In N-body mode: pull the integrated real-AU position, then
      // remap to compressed scene units so the visual layout is
      // identical (perturbations show up as small deviations from
      // the orbit ring — invisible per-frame, accumulate over runs).
      if (nBody.enabled && nBody.state && nBody.state[p.id]) {
        const real = nBody.state[p.id].pos;
        const aAU = REAL_SEMI_MAJOR_AU[p.id] || 1;
        const scale = p.dist / aAU;
        m.position.set(real.x * scale, real.y * scale, real.z * scale);
      } else {
        m.position.copy(planetPos(p));
      }
      // Self-rotation at real sidereal rate (relative ratios are
      // exact — Jupiter spins ~24× faster than Earth, Mercury 60×
      // slower). Compressed by ROT_TIME_FACTOR so the fastest
      // spinners stay watchable.
      const rotDays = SIDEREAL_ROT_DAYS[p.id] || 1;
      m.rotation.y += (TAU * dJD) / (rotDays * ROT_TIME_FACTOR);
      // Keep the moon hub glued to the planet's world position; the
      // hub's tilt is constant, so moons orbit in the planet's
      // equatorial plane in inertial frame — independent of the
      // planet's spin.
      const hub = m.userData.moonHub;
      if (hub) hub.position.copy(m.position);
      m.userData.moonPivots.forEach((mp) => {
        const moonPeriodDays = Math.max(0.001, mp.period) * 365.25;
        const a = mp.phase + (TAU * (currentJD - J2000_JD)) / moonPeriodDays;
        // Real inclination — flat ring of an orbit tipped by `inc`
        // around the X axis. Triton's 156.885° gives it the right
        // retrograde motion automatically.
        const inc = (mp.inclination || 0) * DEG;
        const cosA = Math.cos(a), sinA = Math.sin(a);
        const sI = Math.sin(inc), cI = Math.cos(inc);
        mp.mesh.position.set(cosA * mp.dist, sinA * mp.dist * sI, sinA * mp.dist * cI);
        // Tidal lock — every major moon in the solar system keeps
        // the same face turned toward its primary, so spin == orbit.
        mp.mesh.rotation.y = -a + Math.PI / 2;
      });
      if (m.userData.cloudShell) {
        // Earth's clouds super-rotate slightly faster than the
        // surface (trade-wind belt) — visible drift in time-lapse.
        m.userData.cloudShell.rotation.y += (TAU * dJD) / (rotDays * ROT_TIME_FACTOR) * 0.04;
      }
    });
    // Sun: ~25.4-day equatorial sidereal rotation (real value at the
    // equator — the Sun differentially-rotates with latitude but a
    // single number reads fine here).
    sun.rotation.y += (TAU * dJD) / (SUN_ROT_DAYS * ROT_TIME_FACTOR);
    // Sync uniforms that depend on the sun's world position. Both
    // Earth's surface shader and its atmosphere shell use the sun
    // direction to colour day/night and the sunset rim.
    const sunWorld = sun.getWorldPosition(new THREE.Vector3());
    earthMat.uniforms.sunPos.value.copy(sunWorld);
    atmosphereMat.uniforms.sunPos.value.copy(sunWorld);

    // Hotspot LOD: hide markers when far from the host body so the
    // overview stays clean, but fade in earlier and over a wider
    // band than before — markers should already read at fly-to
    // distance (~6 body radii), not just point-blank.
    const camPos = camera.position;
    const tmpV = new THREE.Vector3();
    allHotspotMeshes.forEach((m) => {
      const host = m.parent; // planet/moon mesh
      if (!host) return;
      host.getWorldPosition(tmpV);
      const hr = host.geometry?.parameters?.radius || 0.3;
      const d = camPos.distanceTo(tmpV);
      const showAt = Math.max(hr * 35, 6);     // far edge of fade-in
      const fullAt = Math.max(hr * 8,  2);     // fully visible by here
      m.visible = d < showAt;
      m.material.opacity = Math.max(0, Math.min(1, (showAt - d) / (showAt - fullAt)));
    });

    // Reticle-hover state for the fly-mode crosshair.
    if (mode === 'fly') {
      ndc.set(0, 0);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([sun, ...planetMeshes, ...allMoonMeshes], false);
      document.body.dataset.flyhover = hits[0] ? 'true' : 'false';
    } else if (document.body.dataset.flyhover) {
      document.body.dataset.flyhover = 'false';
    }
  }

  // ============================================================
  // Camera control: ORBIT (default) + WASD FLY
  // ============================================================
  let mode = 'orbit';
  const cameraTarget = new THREE.Vector3(0, 0, 0);
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(cameraTarget));
  const flyEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const keys = {};
  let dragging = false, dragMoved = false, lastX = 0, lastY = 0;
  let tween = null;

  function applyOrbitCamera() {
    const v = new THREE.Vector3().setFromSpherical(spherical).add(cameraTarget);
    camera.position.copy(v);
    camera.lookAt(cameraTarget);
  }
  // Each frame in orbit mode (no tween in flight): keep cameraTarget
  // glued to the selected body so the camera follows it through its
  // orbit. The user's spherical (theta/phi/radius) stays preserved —
  // they keep the same relative offset they had when they landed.
  function trackSelectedBody() {
    if (mode !== 'orbit' || tween || !currentBodyId) return;
    const m = (currentBodyId === 'sun') ? sun :
      planetMeshes.find((pm) => pm.userData.body.id === currentBodyId) ||
      allMoonMeshes.find((mm) => mm.userData.body.id === currentBodyId);
    if (!m) return;
    m.getWorldPosition(cameraTarget);
    applyOrbitCamera();
  }
  function applyFlyCamera() { camera.quaternion.setFromEuler(flyEuler); }
  applyOrbitCamera();

  canvas.addEventListener('pointerdown', (e) => {
    if (mode === 'fly') return;
    dragging = true; dragMoved = false;
    lastX = e.clientX; lastY = e.clientY;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (mode === 'orbit') {
      if (!dragging) {
        const hit = raycastBody(e);
        canvas.classList.toggle('is-hovering', !!hit);
        return;
      }
      dragMoved = true;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      spherical.theta -= dx * 0.005;
      spherical.phi   -= dy * 0.005;
      spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi));
      cancelTween(); applyOrbitCamera();
    }
  });
  canvas.addEventListener('pointerup',     () => { dragging = false; canvas.classList.remove('is-dragging'); });
  canvas.addEventListener('pointercancel', () => { dragging = false; canvas.classList.remove('is-dragging'); });
  canvas.addEventListener('wheel', (e) => {
    if (mode !== 'orbit') return;
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.0015);
    spherical.radius = Math.max(2, Math.min(280, spherical.radius * factor));
    cancelTween(); applyOrbitCamera();
  }, { passive: false });

  canvas.addEventListener('click', (e) => {
    if (mode === 'fly') {
      // First click → engage pointer lock. Subsequent clicks while
      // already locked → raycast from the screen-centre reticle and
      // open the info card for whatever body the cursor is on.
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
        return;
      }
      ndc.set(0, 0);
      raycaster.setFromCamera(ndc, camera);
      const hot = raycaster.intersectObjects(allHotspotMeshes, false);
      if (hot[0]) { openHotspot(hot[0].object.userData.hotspot); return; }
      const hits = raycaster.intersectObjects([sun, ...planetMeshes, ...allMoonMeshes], false);
      if (hits[0]) {
        const body = hits[0].object.userData.body;
        if (comparing) { fillCompare(body); setComparing(false); }
        else openInfo(body);
      }
      return;
    }
    if (dragMoved) return;
    const obj = raycastBody(e);
    if (obj) {
      if (obj.userData.hotspot) { openHotspot(obj.userData.hotspot); return; }
      const body = obj.userData.body;
      // Compare mode redirects the click to the comparison panel and
      // disarms — leaves the right-hand info card alone, doesn't move
      // the camera (so users see both bodies framed simultaneously).
      if (comparing) {
        fillCompare(body);
        setComparing(false);
        return;
      }
      flyToBody(body, obj);
      openInfo(body);
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (mode !== 'fly' || document.pointerLockElement !== canvas) return;
    const sens = 0.0025;
    flyEuler.y -= e.movementX * sens;
    flyEuler.x -= e.movementY * sens;
    flyEuler.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, flyEuler.x));
    applyFlyCamera();
  });

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Escape' && mode === 'fly' && document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  function flyTick(dt) {
    if (mode !== 'fly') return;
    const fast = keys.ShiftLeft || keys.ShiftRight;
    const baseSpeed = fast ? 36 : 12;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const move = new THREE.Vector3();
    if (keys.KeyW) move.add(dir);
    if (keys.KeyS) move.sub(dir);
    if (keys.KeyA) move.sub(right);
    if (keys.KeyD) move.add(right);
    if (keys.Space) move.add(up);
    if (keys.KeyQ || keys.ControlLeft) move.sub(up);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(baseSpeed * dt);
      camera.position.add(move);
    }
  }

  function setMode(m) {
    mode = m;
    document.body.dataset.flymode = (m === 'fly') ? 'true' : 'false';
    if (m === 'fly') {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      flyEuler.y = Math.atan2(dir.x, -dir.z);
      flyEuler.x = Math.asin(dir.y);
      applyFlyCamera();
    } else {
      cameraTarget.set(0, 0, 0);
      if (currentBodyId) {
        const m2 = (currentBodyId === 'sun') ? sun :
          planetMeshes.find((pm) => pm.userData.body.id === currentBodyId) ||
          allMoonMeshes.find((mm) => mm.userData.body.id === currentBodyId);
        if (m2) cameraTarget.copy(m2.getWorldPosition(new THREE.Vector3()));
      }
      const offset = camera.position.clone().sub(cameraTarget);
      spherical.setFromVector3(offset);
      spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi));
      applyOrbitCamera();
    }
  }
  $$('.ss-hud-seg[data-seg="mode"] button').forEach((b) => {
    b.addEventListener('click', () => {
      $$('.ss-hud-seg[data-seg="mode"] button').forEach((x) => x.classList.remove('is-on'));
      b.classList.add('is-on');
      setMode(b.dataset.v);
    });
  });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function raycastBody(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    // Hotspots first — they sit just outside the surface so the
    // raycast through-test prefers them when the user actually
    // clicked the marker rather than the planet behind it.
    const hot = raycaster.intersectObjects(allHotspotMeshes, false);
    if (hot[0]) return hot[0].object;
    const hits = raycaster.intersectObjects([sun, ...planetMeshes, ...allMoonMeshes], false);
    return hits[0]?.object || null;
  }

  function cancelTween() { tween = null; }
  function flyToBody(body, mesh) {
    if (mode === 'fly') return;
    const targetPos = (mesh ? mesh.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3());
    const offset = Math.max(body.radius * 6, 5);
    // Land on the SUN-LIT side of the body so the day side faces us.
    const lit = (targetPos.length() > 0.01) ? targetPos.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const wantPos = lit.clone().multiplyScalar(offset * 0.92)
                       .add(new THREE.Vector3(0, offset * 0.45, 0));
    const newSpherical = new THREE.Spherical().setFromVector3(wantPos);
    tween = {
      from: { theta: spherical.theta, phi: spherical.phi, radius: spherical.radius,
              tx: cameraTarget.x, ty: cameraTarget.y, tz: cameraTarget.z },
      to:   { theta: newSpherical.theta, phi: newSpherical.phi, radius: newSpherical.radius,
              tx: targetPos.x, ty: targetPos.y, tz: targetPos.z },
      t: 0, duration: 1.2,
    };
    fadeHint();
    markActiveJump(body.id);
  }
  function stepTween(dt) {
    if (!tween) return;
    tween.t = Math.min(1, tween.t + dt / tween.duration);
    const k = easeInOutCubic(tween.t);
    spherical.theta  = lerp(tween.from.theta,  tween.to.theta,  k);
    spherical.phi    = lerp(tween.from.phi,    tween.to.phi,    k);
    spherical.radius = lerp(tween.from.radius, tween.to.radius, k);
    cameraTarget.set(
      lerp(tween.from.tx, tween.to.tx, k),
      lerp(tween.from.ty, tween.to.ty, k),
      lerp(tween.from.tz, tween.to.tz, k));
    applyOrbitCamera();
    if (tween.t >= 1) tween = null;
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeInOutCubic = (x) => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;

  // Info card
  let currentBodyId = null;
  function openInfo(body) {
    $('#info').hidden = false;
    $('#infoEyebrow').textContent = body.eyebrow || '';
    $('#infoName').textContent = body.name;
    $('#infoTag').textContent = body.tag || '';
    const stats = $('#infoStats'); stats.innerHTML = '';
    Object.entries(body.stats || {}).forEach(([k, v]) => {
      const wrap = document.createElement('div'); wrap.className = 'stat';
      const lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = k;
      const val = document.createElement('span'); val.className = 'val'; val.textContent = v;
      wrap.appendChild(lab); wrap.appendChild(val); stats.appendChild(wrap);
    });
    $('#infoBlurb').textContent = body.blurb || '';
    currentBodyId = body.id;
    updateChallengeStatus();
  }
  // Hotspots reuse the info-card UI but show their own content
  // (and don't move the camera — clicking a hotspot keeps the body
  // framed so the user can read the popup right next to the marker).
  function openHotspot(h) {
    $('#info').hidden = false;
    $('#infoEyebrow').textContent = h.eyebrow || '';
    $('#infoName').textContent = h.name;
    $('#infoTag').textContent = h.tag || '';
    const stats = $('#infoStats'); stats.innerHTML = '';
    if (h.lat != null) {
      const wrap = document.createElement('div'); wrap.className = 'stat';
      const lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = 'coords';
      const val = document.createElement('span'); val.className = 'val';
      val.textContent = `${h.lat.toFixed(2)}° ${h.lat >= 0 ? 'N' : 'S'} · ${h.lon.toFixed(2)}° ${h.lon >= 0 ? 'E' : 'W'}`;
      wrap.appendChild(lab); wrap.appendChild(val); stats.appendChild(wrap);
    }
    $('#infoBlurb').textContent = h.blurb || '';
  }

  $('#infoClose').addEventListener('click', () => {
    // Releasing tracking too — otherwise the camera target stays
    // glued to a fast-orbiting planet after the user dismisses the
    // panel, which feels like the whole scene is shaking around the
    // tracked body as it whips around the Sun.
    $('#info').hidden = true;
    currentBodyId = null;
    markActiveJump(null);
  });

  // ---- Compare mode ----
  // Click "Compare ↔" to arm; the next body click lands in the
  // left-hand panel so users can see two bodies side-by-side.
  let comparing = false;
  function setComparing(on) {
    comparing = on;
    document.body.dataset.comparing = String(on);
    $('#infoCompare')?.classList.toggle('is-on', on);
    if (on) $('#hint').classList.remove('is-faded');
  }
  function fillCompare(body) {
    $('#compare').hidden = false;
    $('#cmpEyebrow').textContent = body.eyebrow || '';
    $('#cmpName').textContent = body.name;
    $('#cmpTag').textContent = body.tag || '';
    const stats = $('#cmpStats'); stats.innerHTML = '';
    Object.entries(body.stats || {}).forEach(([k, v]) => {
      const wrap = document.createElement('div'); wrap.className = 'stat';
      const lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = k;
      const val = document.createElement('span'); val.className = 'val'; val.textContent = v;
      wrap.appendChild(lab); wrap.appendChild(val); stats.appendChild(wrap);
    });
    $('#cmpBlurb').textContent = body.blurb || '';
  }
  $('#infoCompare').addEventListener('click', () => setComparing(!comparing));
  $('#compareClose').addEventListener('click', () => {
    $('#compare').hidden = true;
    setComparing(false);
  });
  $('#infoNext').addEventListener('click', () => {
    const flat = [];
    BODIES.forEach((b) => { flat.push(b); (b.moons || []).forEach((m) => flat.push(m)); });
    const idx = flat.findIndex((b) => b.id === currentBodyId);
    const next = flat[(idx + 1) % flat.length];
    let mesh = (next.kind === 'star') ? sun :
      planetMeshes.find((pm) => pm.userData.body.id === next.id) ||
      allMoonMeshes.find((mm) => mm.userData.body.id === next.id);
    flyToBody(next, mesh); openInfo(next);
  });

  // HUD
  $('#playPause').addEventListener('click', () => {
    playing = !playing;
    document.body.dataset.playing = String(playing);
  });
  $$('.ss-hud-seg[data-seg="speed"] button').forEach((b) => {
    b.addEventListener('click', () => {
      $$('.ss-hud-seg[data-seg="speed"] button').forEach((x) => x.classList.remove('is-on'));
      b.classList.add('is-on');
      speed = parseFloat(b.dataset.v);
    });
  });
  // ---- Labels / Trails toggles ----
  // Labels default off because they get loud — user toggles on
  // explicitly. Trails default on (subtle and useful).
  document.body.dataset.labels = 'off';
  document.body.dataset.trails = 'on';
  $('#toggleLabels')?.addEventListener('click', () => {
    const btn = $('#toggleLabels');
    const on = !btn.classList.contains('is-on');
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    document.body.dataset.labels = on ? 'on' : 'off';
  });
  $('#toggleTrails')?.addEventListener('click', () => {
    const btn = $('#toggleTrails');
    const on = !btn.classList.contains('is-on');
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    document.body.dataset.trails = on ? 'on' : 'off';
    // Show/hide trail Lines directly (CSS can't reach scene children).
    trails.forEach((tr) => { tr.line.visible = on; });
  });
  // ---- N-body toggle ----
  // Off = Kepler (closed-form ellipse per planet, no mutual gravity).
  // On  = velocity-Verlet integration of the full nine-body problem
  //       (Sun + eight planets in real AU and AU/day with real GMs).
  // Toggling on re-seeds the integrator from Kepler at the current
  // sim date; toggling off clears state so the next on starts fresh.
  $('#toggleNBody')?.addEventListener('click', () => {
    const btn = $('#toggleNBody');
    const on = !btn.classList.contains('is-on');
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    nBody.enabled = on;
    if (on) {
      nBody.state = nBodyInit(currentJD);
      nBody.lastJD = currentJD;
    } else {
      nBody.state = null;
    }
  });

  $('#resetView').addEventListener('click', () => {
    $('#info').hidden = true; currentBodyId = null; markActiveJump(null);
    setMode('orbit');
    tween = {
      from: { theta: spherical.theta, phi: spherical.phi, radius: spherical.radius,
              tx: cameraTarget.x, ty: cameraTarget.y, tz: cameraTarget.z },
      to:   { theta: -Math.PI / 2.5, phi: Math.PI * 0.42, radius: 70,
              tx: 0, ty: 0, tz: 0 },
      t: 0, duration: 1.0,
    };
  });

  function buildJumpPills() {
    const wrap = $('#jumpRow');
    wrap.innerHTML = '';
    BODIES.forEach((b) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.dataset.id = b.id; btn.textContent = b.name;
      btn.addEventListener('click', () => {
        const mesh = (b.kind === 'star') ? sun : planetMeshes.find((pm) => pm.userData.body.id === b.id);
        flyToBody(b, mesh); openInfo(b);
      });
      wrap.appendChild(btn);
    });
  }
  function markActiveJump(id) {
    $$('#jumpRow button').forEach((b) => b.classList.toggle('is-active', b.dataset.id === id));
  }
  buildJumpPills();

  // ---- Custom date popover ----
  // The user opens it, picks a year (stepper or shortcut chips) and a
  // month, hits Done. While open, simYear/simMonth track the popover
  // selection; clicks snap currentJD to that date. While closed, we
  // sync simYear/simMonth back from currentJD so the popover always
  // reads the current simulation date when re-opened.
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let simYear = 2024;
  let simMonth = 0;
  function buildMonthGrid() {
    const grid = $('#moGrid');
    if (!grid) return;
    grid.innerHTML = '';
    MONTH_NAMES.forEach((n, i) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.dataset.month = String(i); btn.textContent = n;
      btn.addEventListener('click', () => { simMonth = i; applyDate(); });
      grid.appendChild(btn);
    });
  }
  function refreshDateUI() {
    $('#yrDisplay').textContent = String(simYear);
    $('#dateLabel').textContent = `${MONTH_FULL[simMonth]} ${simYear}`;
    $$('#moGrid button').forEach((b) => {
      b.classList.toggle('is-on', parseInt(b.dataset.month, 10) === simMonth);
    });
  }
  function applyDate() {
    // Anchor on the 15th UTC, noon — month resolution is plenty for
    // planet positions and saves the user from a day grid.
    const d = new Date(Date.UTC(simYear, simMonth, 15, 12, 0, 0));
    currentJD = jdFromDate(d);
    refreshDateUI();
  }
  function syncSimFromJD() {
    const d = dateFromJd(currentJD);
    const y = d.getUTCFullYear(); const m = d.getUTCMonth();
    if (y !== simYear || m !== simMonth) {
      simYear = y; simMonth = m;
      refreshDateUI();
    }
  }
  buildMonthGrid();
  syncSimFromJD();
  refreshDateUI();

  $('#yrPrev')?.addEventListener('click', () => { simYear -= 1; applyDate(); });
  $('#yrNext')?.addEventListener('click', () => { simYear += 1; applyDate(); });
  $$('.ss-date-yr-shortcuts button').forEach((b) => {
    b.addEventListener('click', () => { simYear = parseInt(b.dataset.yr, 10); applyDate(); });
  });
  $('#dateToday')?.addEventListener('click', () => { currentJD = jdFromDate(new Date()); syncSimFromJD(); });
  $('#dateClose')?.addEventListener('click', () => closeDatePop());

  let datePopOpen = false;
  function positionDatePop() {
    const trig = $('#dateTrigger'); const pop = $('#datePop');
    if (!trig || !pop) return;
    const r = trig.getBoundingClientRect();
    pop.style.top  = `${r.bottom + 8}px`;
    pop.style.left = `${Math.min(r.left, window.innerWidth - 340)}px`;
  }
  function openDatePop() {
    const pop = $('#datePop'); const trig = $('#dateTrigger');
    if (!pop || !trig) return;
    syncSimFromJD();
    pop.hidden = false; trig.setAttribute('aria-expanded', 'true');
    datePopOpen = true;
    positionDatePop();
    window.addEventListener('scroll', positionDatePop, true);
    window.addEventListener('resize', positionDatePop);
  }
  function closeDatePop() {
    const pop = $('#datePop'); const trig = $('#dateTrigger');
    if (!pop || !trig) return;
    pop.hidden = true; trig.setAttribute('aria-expanded', 'false');
    datePopOpen = false;
    window.removeEventListener('scroll', positionDatePop, true);
    window.removeEventListener('resize', positionDatePop);
  }
  $('#dateTrigger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    datePopOpen ? closeDatePop() : openDatePop();
  });
  document.addEventListener('click', (e) => {
    if (!datePopOpen) return;
    if (e.target.closest('#datePop') || e.target.closest('#dateTrigger')) return;
    closeDatePop();
  });

  // ============================================================
  // BODY LABELS — HTML overlays positioned each frame from the
  // body's projected screen coordinates. Cleaner than sprite labels
  // (no font texture issues) and they pick up Knowsy's editorial
  // typography for free.
  // ============================================================
  const labelMap = new Map(); // body id → { el, mesh }
  function buildLabels() {
    const wrap = $('#labels');
    if (!wrap) return;
    wrap.innerHTML = '';
    const all = [];
    BODIES.forEach((b) => {
      const mesh = (b.kind === 'star') ? sun :
        planetMeshes.find((pm) => pm.userData.body.id === b.id);
      if (mesh) all.push({ body: b, mesh });
    });
    // Moons too
    PLANETS.forEach((p) => {
      const planetMesh = planetMeshes.find((pm) => pm.userData.body.id === p.id);
      if (!planetMesh) return;
      planetMesh.userData.moonPivots.forEach((mp) => {
        all.push({ body: mp.mesh.userData.body, mesh: mp.mesh });
      });
    });
    all.forEach(({ body, mesh }) => {
      const el = document.createElement('div');
      el.className = 'ss-label';
      el.innerHTML = `<span class="name">${body.name}</span><span class="meta" data-meta></span>`;
      wrap.appendChild(el);
      labelMap.set(body.id, { el, mesh, body });
    });
  }
  buildLabels();

  const tmpProj = new THREE.Vector3();
  function updateLabels() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const camPos = camera.position;
    labelMap.forEach(({ el, mesh, body }) => {
      mesh.getWorldPosition(tmpProj);
      const dist = camPos.distanceTo(tmpProj);
      tmpProj.project(camera);
      const onScreen = tmpProj.z < 1 && tmpProj.x > -1.05 && tmpProj.x < 1.05 && tmpProj.y > -1.05 && tmpProj.y < 1.05;
      if (!onScreen) { el.classList.remove('is-near'); return; }
      // Distance-based visibility: planets always show; moons + Sun
      // appear when reasonably close.
      const isPlanet = body.kind === 'planet';
      const showAt = isPlanet ? 220 : 60;
      const near = dist < showAt;
      el.classList.toggle('is-near', near);
      el.classList.toggle('is-active', body.id === currentBodyId);
      const x = (tmpProj.x * 0.5 + 0.5) * w;
      const y = (-tmpProj.y * 0.5 + 0.5) * h;
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      // Heliocentric distance in AU — show the real semi-major axis
      // from each planet's orbital elements, not the compressed
      // scene distance. The previous label used `body.dist / 15`
      // (Earth at 15 = 1 AU) which gave nonsense values for the
      // outer planets, e.g. Neptune at 56/15 = 3.73 AU instead of
      // its actual 30 AU. Inner labels also got compressed.
      const meta = el.querySelector('[data-meta]');
      if (meta) {
        if (body.kind === 'star') meta.textContent = '0 AU · star';
        else if (isPlanet) {
          const aAU = REAL_SEMI_MAJOR_AU[body.id] ?? (body.dist / 15);
          meta.textContent = `${aAU.toFixed(2)} AU`;
        } else {
          meta.textContent = 'moon';
        }
      }
    });
  }

  let hintFadeTimer = null;
  function fadeHint() {
    clearTimeout(hintFadeTimer);
    hintFadeTimer = setTimeout(() => $('#hint').classList.add('is-faded'), 800);
  }

  // Challenges
  const CHALLENGES = [
    { label:'Find Earth',           meta:'PLANET', target:'earth',   prompt:'Fly to the <em>third planet</em> from the Sun.' },
    { label:'Land on the Moon',     meta:'MOON',   target:'luna',    prompt:'Click on Earth\'s <em>Moon</em>.' },
    { label:'Find the rings',       meta:'GAS',    target:'saturn',  prompt:'Find the planet that wears <em>rings</em>.' },
    { label:'The icy ocean',        meta:'MOON',   target:'europa',  prompt:'Visit Jupiter\'s moon with the <em>subsurface ocean</em>.' },
    { label:'The volcano world',    meta:'MOON',   target:'io',      prompt:'Find Jupiter\'s most <em>volcanic</em> moon.' },
    { label:'The largest planet',   meta:'GAS',    target:'jupiter', prompt:'Visit the <em>largest</em> planet — over 300 Earths in mass.' },
    { label:'The side-spinner',     meta:'ICE',    target:'uranus',  prompt:'Find the planet that <em>spins on its side</em>.' },
    { label:'Titan',                meta:'MOON',   target:'titan',   prompt:'Find the moon with a <em>thick atmosphere</em> and methane lakes.' },
    { label:'The windiest world',   meta:'ICE',    target:'neptune', prompt:'Visit the world with the <em>fastest winds</em> in the solar system.' },
    { label:'Visit the star',       meta:'STAR',   target:'sun',     prompt:'Pay your respects to the <em>gravitational anchor</em>.' },
  ];
  let challengeIdx = 0;
  const currentChallenge = () => CHALLENGES[challengeIdx];

  function refreshChallengeUI() {
    const ch = currentChallenge();
    const tag = $('#chalTag');
    if (tag) {
      const n = String(challengeIdx + 1).padStart(2, '0');
      const m = String(CHALLENGES.length).padStart(2, '0');
      tag.textContent = `Challenge ${n} / ${m}`;
    }
    $('#chalPrompt').innerHTML = ch.prompt;
    const lbl = $('#chalPickLabel');
    if (lbl) lbl.textContent = `${String(challengeIdx + 1).padStart(2, '0')} · ${ch.label}`;
    $$('#chalPickList li').forEach((el) => {
      el.setAttribute('aria-selected', el.dataset.idx === String(challengeIdx) ? 'true' : 'false');
    });
    updateChallengeStatus();
  }
  function updateChallengeStatus() {
    const ch = currentChallenge();
    const chal = $('#chal');
    const lab = chal?.querySelector('.status .lab');
    if (!chal || !lab) return;
    const ok = currentBodyId === ch.target;
    chal.classList.toggle('is-solved', ok);
    lab.textContent = ok ? 'Solved' : 'Try it';
    if (ok) setTimeout(() => {
      if (chal.classList.contains('is-solved')) applyChallenge(challengeIdx + 1);
    }, 1100);
  }
  function applyChallenge(idx) {
    challengeIdx = ((idx % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length;
    refreshChallengeUI();
  }
  function renderChallengePicker() {
    const list = $('#chalPickList');
    if (!list) return;
    list.innerHTML = CHALLENGES.map((c, i) => {
      const num = String(i + 1).padStart(2, '0');
      return `<li role="option" data-idx="${i}" tabindex="-1"
        aria-selected="${i === challengeIdx ? 'true' : 'false'}">
        <span class="num">${num}</span>
        <span class="lbl">${c.label}</span>
        <span class="meta">${c.meta}</span>
      </li>`;
    }).join('');
  }
  let chalOpen = false;
  function positionChalPop() {
    const btn = $('#chalPickBtn'); const list = $('#chalPickList');
    if (!btn || !list) return;
    const r = btn.getBoundingClientRect();
    list.style.top = `${r.bottom + 6}px`;
    list.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    list.style.left = 'auto';
    list.style.maxHeight = `${Math.max(160, window.innerHeight - r.bottom - 24)}px`;
  }
  function openChalPicker() {
    if (chalOpen) return;
    const list = $('#chalPickList'); const btn = $('#chalPickBtn');
    if (!list || !btn) return;
    list.hidden = false; btn.setAttribute('aria-expanded', 'true'); chalOpen = true;
    positionChalPop();
    window.addEventListener('scroll', positionChalPop, true);
    window.addEventListener('resize', positionChalPop);
    const sel = list.querySelector('[aria-selected="true"]') || list.firstElementChild;
    sel?.focus();
  }
  function closeChalPicker() {
    if (!chalOpen) return;
    const list = $('#chalPickList'); const btn = $('#chalPickBtn');
    if (list) list.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false');
    chalOpen = false;
    window.removeEventListener('scroll', positionChalPop, true);
    window.removeEventListener('resize', positionChalPop);
  }
  $('#chalPickBtn')?.addEventListener('click', (e) => {
    e.stopPropagation(); chalOpen ? closeChalPicker() : openChalPicker();
  });
  $('#chalPickList')?.addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li) return;
    closeChalPicker(); applyChallenge(parseInt(li.dataset.idx, 10));
    $('#chalPickBtn')?.focus();
  });
  document.addEventListener('click', (e) => {
    if (!chalOpen) return;
    if (e.target.closest('.ss-chal-pick-wrap')) return;
    closeChalPicker();
  });
  $('#chalSkip')?.addEventListener('click', () => applyChallenge(challengeIdx + 1));

  // Render loop
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt);
    if (mode === 'orbit') stepTween(dt); else flyTick(dt);
    // Camera tracking: keep the camera target glued to the active
    // body's current world position. Without this, simulation time
    // advances after the fly-to lands, the planet orbits forward,
    // and the camera ends up staring at empty space — what looked
    // like a "random refresh" was actually the planet drifting
    // away from a stale camera focus.
    trackSelectedBody();
    updateLabels();
    updateTrails();
    if (!datePopOpen) syncSimFromJD();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  renderChallengePicker();
  refreshChallengeUI();
  fadeHint();
  requestAnimationFrame(loop);
})();
