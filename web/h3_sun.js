import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';
import { createSunCompass } from './sun_compass.js';

const FIELDS = ['location', 'year', 'month', 'day', 'hour', 'minute', 'heading'];

app.registerExtension({
  name: 'bruxos.h3.sun',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== 'H3SunPosition') return;
    const created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const result = created?.apply(this, arguments);
      const node = this, find = n => node.widgets.find(w => w.name === n);
      const heading = find('heading');
      node.properties = node.properties || {};
      node.properties.bruxos_language = node.properties.bruxos_language || 'pt';
      const compass = createSunCompass({
        getLanguage: () => node.properties.bruxos_language,
        setLanguage: v => { node.properties.bruxos_language = v; node.setDirtyCanvas(true, true); },
        getHeading: () => Number(heading?.value) || 0,
        // The compass writes the real heading widget, so the value is saved and can still be converted to an input.
        setHeading: v => { if (!heading) return; heading.value = v; heading.callback?.(v); node.setDirtyCanvas(true, true); },
      });
      const widget = node.addDOMWidget('sun_compass', 'H3_SUN_COMPASS', compass.element, { serialize: false });
      widget.computeSize = () => [400, 260];
      let timer = 0, seq = 0;
      const live = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const mine = ++seq, q = new URLSearchParams(Object.fromEntries(FIELDS.map(n => [n, String(find(n)?.value ?? '')])));
          try {
            const res = await api.fetchApi(`/bruxos_h3/sun?${q}`);
            const data = await res.json();
            if (mine === seq) compass.show(data);
          } catch { /* route missing: the status fills in after the node runs */ }
        }, 220);
      };
      for (const n of FIELDS) {
        const w = find(n); if (!w) continue; const cb = w.callback;
        w.callback = function () { const r = cb?.apply(this, arguments); compass.redraw(); live(); return r; };
      }
      // Driven inputs (or a run through the API) arrive here; the compass mirrors what was computed.
      const executed = node.onExecuted;
      node.onExecuted = function (message) {
        const r = executed?.apply(this, arguments);
        try { const data = JSON.parse(message?.h3_sun?.[0] || 'null'); if (data) { if (heading && data.heading != null) heading.value = data.heading; compass.show(data); } } catch { }
        return r;
      };
      const configure = node.onConfigure;
      node.onConfigure = function () { const r = configure?.apply(this, arguments); compass.redraw(); live(); return r; };
      node.setSize([Math.max(node.size[0], 420), Math.max(node.size[1], 500)]);
      const removed = node.onRemoved;
      node.onRemoved = function () { clearTimeout(timer); seq++; compass.destroy(); return removed?.apply(this, arguments); };
      live();
      return result;
    };
  },
});
