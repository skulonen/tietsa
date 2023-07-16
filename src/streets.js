import Graphic from 'https://js.arcgis.com/4.27/@arcgis/core/Graphic.js';
import Point from 'https://js.arcgis.com/4.27/@arcgis/core/geometry/Point.js';
import Polyline from 'https://js.arcgis.com/4.27/@arcgis/core/geometry/Polyline.js';
import Circle from 'https://js.arcgis.com/4.27/@arcgis/core/geometry/Circle.js';
import * as projection from 'https://js.arcgis.com/4.27/@arcgis/core/geometry/projection.js';
import { intersect, planarLength } from 'https://js.arcgis.com/4.27/@arcgis/core/geometry/geometryEngine.js';

/**
 * @param {SettingsCircle} circle
 * @returns {Promise<Graphic[]>}
 */
export async function getStreetData(circle) {
  const circleGeometry = new Circle({
    center: new Point({
      x: circle.x,
      y: circle.y,
      spatialReference: { wkid: circle.srid }
    }),
    radius: circle.radius,
    spatialReference: { wkid: circle.srid }
  });

  // Get bounding box of circle
  await projection.load();
  const projectedCircle = projection.project(circleGeometry, { wkid: 3067 });
  const { xmin, ymin, xmax, ymax } = projectedCircle.extent;
  const bbox = `${xmin},${ymin},${xmax},${ymax}`;

  // Build URL to query street data
  const params = {
    service: 'WFS',
    request: 'GetFeature',
    typeNames: 'digiroad:dr_tielinkki_hall_lk',
    propertyName: 'tienimi_su,tienimi_ru,geom',
    bbox
  };
  const url = new URL('https://avoinapi.vaylapilvi.fi/vaylatiedot/digiroad/ows');
  url.search = new URLSearchParams(params).toString();

  // Query street data and parse XML
  const response = await fetch(url);
  const text = await response.text();
  const featureCollection = new DOMParser().parseFromString(text, 'text/xml');

  // Group paths by name
  const pathsByName = {};
  featureCollection.querySelectorAll(':scope > member > dr_tielinkki_hall_lk').forEach(member => {
    const name = member.querySelector(':scope > tienimi_su')?.textContent;
    if (!name) return;

    if (!(name in pathsByName)) {
      pathsByName[name] = [];
    }

    const posList = member.querySelector(':scope > geom > LineString > posList')?.textContent;
    const coords = posList.split(' ');
    const path = [];
    for (let i = 0; i < coords.length; i += 3) {
      const x = parseFloat(coords[i]);
      const y = parseFloat(coords[i + 1]);
      path.push([x, y]);
    }
    pathsByName[name].push(path);
  });

  // Cut paths using circle, discard paths that are too short
  const graphics = [];
  for (let [name, paths] of Object.entries(pathsByName)) {
    const streetGeometry = new Polyline({ paths, spatialReference: { wkid: 3067 } });
    const cutStreetGeometry = intersect(projectedCircle, streetGeometry);
    if (!cutStreetGeometry) continue;
    if (planarLength(cutStreetGeometry) < 50) continue;
    graphics.push(new Graphic({
      attributes: { name },
      geometry: cutStreetGeometry
    }));
  }

  return graphics;
}
