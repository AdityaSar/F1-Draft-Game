/**
 * One-time GeoJSON-to-SVG conversion script for all F1 circuits
 * from bacinger/f1-circuits dataset.
 */
const fs = require('fs');

const geojsonPath = '/tmp/f1-circuits.geojson';
const locationsPath = '/tmp/f1-locations.json';

const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
const locations = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));

const locMap = {};
locations.forEach(l => {
  locMap[l.id] = l;
});

// Map of feature ID to key name
// Keep the 6 existing keys: monaco, monza, spa, silverstone, suzuka, interlagos
// And map all others cleanly
const ID_TO_KEY = {
  'mc-1929': 'monaco',
  'it-1922': 'monza',
  'be-1925': 'spa',
  'gb-1948': 'silverstone',
  'jp-1962': 'suzuka',
  'br-1940': 'interlagos',

  // Modern F1 Circuits
  'au-1953': 'albert_park',
  'bh-2002': 'bahrain',
  'sa-2021': 'jeddah',
  'az-2016': 'baku',
  'us-2022': 'miami',
  'it-1953': 'imola',
  'es-1991': 'barcelona',
  'ca-1978': 'montreal',
  'at-1969': 'red_bull_ring',
  'hu-1986': 'hungaroring',
  'nl-1948': 'zandvoort',
  'sg-2008': 'singapore',
  'us-2012': 'cota',
  'mx-1962': 'mexico_city',
  'us-2023': 'las_vegas',
  'qa-2004': 'lusail',
  'ae-2009': 'yas_marina',
  'cn-2004': 'shanghai',

  // Additional circuits in repo
  'fr-1969': 'paul_ricard',
  'de-1932': 'hockenheimring',
  'de-1927': 'nurburgring',
  'pt-2008': 'portimao',
  'it-1914': 'mugello',
  'my-1999': 'sepang',
  'tr-2005': 'istanbul',
  'ru-2014': 'sochi'
};

const tracks = {};

geojson.features.forEach(feat => {
  const id = feat.properties && feat.properties.id;
  const key = ID_TO_KEY[id];
  if (!key) return; // Skip historical / non-standard if not mapped

  const loc = locMap[id] || {};
  let coords = [];

  if (feat.geometry.type === 'LineString') {
    coords = feat.geometry.coordinates;
  } else if (feat.geometry.type === 'MultiLineString') {
    coords = feat.geometry.coordinates[0];
  } else if (feat.geometry.type === 'Polygon') {
    coords = feat.geometry.coordinates[0];
  }

  if (!coords || coords.length === 0) return;

  // 1. Project: scale lon by cos(lat)
  // 2. Flip y-axis
  const projected = coords.map(([lon, lat]) => {
    const latRad = (lat * Math.PI) / 180;
    const x = lon * Math.cos(latRad);
    const y = -lat; // flip y
    return [x, y];
  });

  // Calculate bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  projected.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  // Target viewBox: 800 x 500 with padding 50
  const targetW = 800 - 100; // 700
  const targetH = 500 - 100; // 400
  const scale = Math.min(targetW / width, targetH / height);

  const scaledW = width * scale;
  const scaledH = height * scale;

  // Center within 800 x 500 viewBox
  const offsetX = (800 - scaledW) / 2;
  const offsetY = (500 - scaledH) / 2;

  const normalized = projected.map(([x, y]) => {
    const normX = Math.round((offsetX + (x - minX) * scale) * 100) / 100;
    const normY = Math.round((offsetY + (y - minY) * scale) * 100) / 100;
    return [normX, normY];
  });

  // Build SVG path string
  let pathD = '';
  normalized.forEach(([x, y], idx) => {
    if (idx === 0) {
      pathD += `M ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
    }
  });
  pathD += ' Z';

  tracks[key] = {
    path: pathD,
    points: normalized,
    name: loc.name || feat.properties.name || key,
    location: loc.location || feat.properties.Location || '',
    id: id
  };
});

const output = `/**
 * Real F1 Circuit Layouts converted from GeoJSON (bacinger/f1-circuits)
 * Normalized to 800x500 viewBox.
 * Attribution: bacinger/f1-circuits (MIT License)
 */
const TRACK_DATA = ${JSON.stringify(tracks, null, 2)};
`;

fs.writeFileSync('scripts/tracks.js', output, 'utf8');
console.log(`Successfully generated scripts/tracks.js with ${Object.keys(tracks).length} circuits!`);
