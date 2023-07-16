import './typedefs.js';

import { getStreetData } from './streets.js';

import Map from 'https://js.arcgis.com/4.27/@arcgis/core/Map.js';
import MapView from 'https://js.arcgis.com/4.27/@arcgis/core/views/MapView.js';
import VectorTileLayer from 'https://js.arcgis.com/4.27/@arcgis/core/layers/VectorTileLayer.js';
import GraphicsLayer from 'https://js.arcgis.com/4.27/@arcgis/core/layers/GraphicsLayer.js';
import Graphic from 'https://js.arcgis.com/4.27/@arcgis/core/Graphic.js';
import Point from 'https://js.arcgis.com/4.27/@arcgis/core/geometry/Point.js';
import Circle from 'https://js.arcgis.com/4.27/@arcgis/core/geometry/Circle.js';
import SimpleFillSymbol from 'https://js.arcgis.com/4.27/@arcgis/core/symbols/SimpleFillSymbol.js';
import * as projection from 'https://js.arcgis.com/4.27/@arcgis/core/geometry/projection.js';
import Draw from 'https://js.arcgis.com/4.27/@arcgis/core/views/draw/Draw.js';
import { distance } from 'https://js.arcgis.com/4.27/@arcgis/core/geometry/geometryEngine.js';

const circleSymbol = new SimpleFillSymbol({
  color: [0, 0, 0, 0],
  outline: {
    color: [255, 0, 0],
    width: 2,
    style: 'dash'
  }
});

const streetsLayer = new GraphicsLayer();

const map = new Map({
  basemap: {
    baseLayers: [new VectorTileLayer({ portalItem: { id: 'd6e5bfbe9e0b4ad0bd200262bef745b0' } })]
  },
  layers: [streetsLayer]
});

const view = new MapView({
  container: "viewDiv",
  map,
  center: [24.9, 60.2],
  zoom: 10
});

let draw = new Draw({ view });

await view.when();
const streetsLayerView = await view.whenLayerView(streetsLayer);

const settingsModalEl = document.getElementById('settingsModal');
const loadingStreetsModalEl = document.getElementById('laodingStreetsModal');
const foundStreetsModalEl = document.getElementById('foundStreetsModal');
const changeAreaEl = document.getElementById('changeArea');
const nameToStreetEl = document.getElementById('nameToStreet');
const streetToNameEl = document.getElementById('streetToName');
const hasTimeLimitEl = document.getElementById('hasTimeLimit');
const timeLimitEl = document.getElementById('timeLimit');
const hasQuestionLimitEl = document.getElementById('hasQuestionLimit');
const questionLimitEl = document.getElementById('questionLimit');
const resetSettingsEl = document.getElementById('resetSettings');
const startGameEl = document.getElementById('startGame');
const foundStreetsCountEl = document.getElementById('foundStreetsCount');
const foundStreetsCancelEl = document.getElementById('foundStreetsCancel');
const foundStreetsOKEl = document.getElementById('foundStreetsOK');
const nameToStreetControlsEl = document.getElementById('nameToStreetControls');
const nameToStreetNameEl = document.getElementById('nameToStreetName');
const nameToStreetConfirmEl = document.getElementById('nameToStreetConfirm');
const streetToNameControlsEl = document.getElementById('streetToNameControls');
const streetToNameNameEl = document.getElementById('streetToNameName');
const streetToNameConfirmEl = document.getElementById('streetToNameConfirm');
const gameStatusEl = document.getElementById('gameStatus');
const questionIndexEl = document.getElementById('questionIndex');
const questionCountEl = document.getElementById('questionCount');
const pointsEl = document.getElementById('points');

const settingsModal = new bootstrap.Modal(settingsModalEl);
const loadingStreetsModal = new bootstrap.Modal(loadingStreetsModalEl);
const foundStreetsModal = new bootstrap.Modal(foundStreetsModalEl);

/** @type {Settings} */
let settings;
/** @type {Graphic[]} */
let streets;
let circleGraphic;
let isGameRunning = false;
let questionIndex = 0;
let questionCount = 0;
let points = 0;
let guessedStreet;

function resetSettings() {
  settings = {
    mode: 'name-to-street',
    hasTimeLimit: true,
    timeLimit: 3,
    hasQuestionLimit: true,
    questionLimit: 30,
    circle: {
      x: 24.9,
      y: 60.2,
      radius: 3000,
      srid: 4326
    }
  };
}

function updateFormFromSettings() {
  nameToStreetEl.checked = settings.mode == 'name-to-street';
  streetToNameEl.checked = settings.mode == 'street-to-name';
  hasTimeLimitEl.checked = settings.hasTimeLimit;
  timeLimitEl.value = settings.timeLimit;
  hasQuestionLimitEl.checked = settings.hasQuestionLimit;
  questionLimitEl.value = settings.questionLimit;
}

function updateSettingsFromForm() {
  if (nameToStreetEl.checked) {
    settings.mode = 'name-to-street';
  }
  if (streetToNameEl.checked) {
    settings.mode = 'street-to-name';
  }
  settings.hasTimeLimit = hasTimeLimitEl.checked;
  settings.timeLimit = parseInt(timeLimitEl.value);
  settings.hasQuestionLimit = hasQuestionLimitEl.checked;
  settings.questionLimit = parseInt(questionLimitEl.value);
}

function updateCircleGraphic(circle) {
  if (!circleGraphic) {
    circleGraphic = new Graphic({
      geometry: circle,
      symbol: circleSymbol
    });
    view.graphics.add(circleGraphic);
  } else {
    circleGraphic.geometry = circle;
  }
}

function updateCircleFromSettings() {
  const circleCenter = new Point({
    x: settings.circle.x,
    y: settings.circle.y,
    spatialReference: { wkid: settings.circle.srid }
  });

  const projectedCircleCenter = projection.project(circleCenter, view.spatialReference);

  const circle = new Circle({
    center: projectedCircleCenter,
    radius: settings.circle.radius,
    spatialReference: view.spatialReference
  });

  updateCircleGraphic(circle);
}

function storeSettings() {
  localStorage.setItem('TIETSA_SETTINGS', JSON.stringify(settings));
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

const settingsString = localStorage.getItem('TIETSA_SETTINGS');
if (settingsString) {
  settings = JSON.parse(settingsString);
} else {
  resetSettings();
}
updateFormFromSettings();
updateCircleFromSettings();

changeAreaEl.onclick = () => {
  settingsModal.hide();
  updateCircleGraphic(null);

  const action = draw.create('circle', { mode: 'click' });

  function createCircle(e) {
    const point1 = new Point({
      x: e.vertices[0][0],
      y: e.vertices[0][1],
      spatialReference: view.spatialReference
    });
    const point2 = new Point({
      x: e.vertices[1][0],
      y: e.vertices[1][1],
      spatialReference: view.spatialReference
    });

    const radius = distance(point1, point2);

    return new Circle({
      center: point1,
      radius: radius,
      spatialReference: view.spatialReference
    });
  }

  action.on('cursor-update', e => {
    if (e.vertexIndex == 1) {
      const circle = createCircle(e);
      updateCircleGraphic(circle);
    }
  });

  action.on('draw-complete', e => {
    const circle = createCircle(e);
    updateCircleGraphic(circle);
    settings.circle = {
      x: circle.center.x,
      y: circle.center.y,
      radius: circle.radius,
      srid: circle.spatialReference.wkid
    };

    settingsModal.show();
  });
};

resetSettingsEl.onclick = () => {
  resetSettings();
  updateFormFromSettings();
  updateCircleFromSettings();
  storeSettings();
};

startGameEl.onclick = () => {
  updateSettingsFromForm();
  storeSettings();

  settingsModal.hide();
  const promise = getStreetData(settings.circle);
  loadingStreetsModalEl.addEventListener('shown.bs.modal', async () => {
    streets = await promise;
    loadingStreetsModal.hide();
    foundStreetsCountEl.innerText = streets.length;
    foundStreetsModal.show();
  });
  loadingStreetsModal.show();
};

foundStreetsCancelEl.onclick = () => {
  foundStreetsModal.hide();
  settingsModal.show();
};

function updateGameStatus() {
  questionIndexEl.innerText = questionIndex;
  questionCountEl.innerText = questionCount;
  pointsEl.innerText = points;
}

foundStreetsOKEl.onclick = () => {
  foundStreetsModal.hide();

  shuffleArray(streets);
  streetsLayer.addMany(streets);

  isGameRunning = true;
  questionIndex = 0;
  questionCount = settings.hasQuestionLimit ? Math.min(streets.length, settings.questionLimit) : streets.length;
  points = 0;

  if (settings.mode == 'name-to-street') {
    nameToStreetControlsEl.classList.remove('d-none');
    nameToStreetNameEl.innerText = streets[questionIndex].attributes.name;
  } else if (settings.mode == 'street-to-name') {
    streetToNameControlsEl.classList.remove('d-none');
    streetToNameNameEl.focus();
    highlightHandle = streetsLayerView.highlight(streets[questionIndex]);
  }
  gameStatusEl.classList.remove('d-none');
  updateGameStatus();
};

let highlightHandle;
view.on('click', async event => {
  if (isGameRunning && settings.mode == 'name-to-street') {
    highlightHandle?.remove();
    nameToStreetConfirmEl.disabled = true;

    const result = await view.hitTest(event, { include: streetsLayer });
    if (result.results.length == 1) {
      guessedStreet = result.results[0].graphic;
      highlightHandle = streetsLayerView.highlight(guessedStreet);
      nameToStreetConfirmEl.disabled = false;
    }
  }
});

nameToStreetConfirmEl.onclick = () => {
  if (guessedStreet.attributes.name == streets[questionIndex].attributes.name) {
    points++;
  }
  questionIndex++;
  highlightHandle?.remove();
  nameToStreetConfirmEl.disabled = true;
  nameToStreetNameEl.innerText = streets[questionIndex].attributes.name;
  updateGameStatus();
};

streetToNameConfirmEl.onclick = () => {
  function normalize(str) {
    return str.trim().toLowerCase().replace(' ', '').replace('-', '');
  }
  const guessedName = normalize(streetToNameNameEl.value);
  const correctName = normalize(streets[questionIndex].attributes.name);
  if (guessedName == correctName) {
    points++;
  }
  questionIndex++;
  highlightHandle?.remove();
  highlightHandle = streetsLayerView.highlight(streets[questionIndex]);
  updateGameStatus();
  streetToNameNameEl.value = '';
  streetToNameNameEl.focus();
};

settingsModal.show();
