import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';
import { createRelightEditor } from './relight_panel.js';
import { resolveLinkedImage } from './linked-image.js';

app.registerExtension({
  name: 'bruxos.h3.relight',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== 'H3RelightEditor') return;
    const created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const result = created?.apply(this, arguments);
      const node = this, find = name => node.widgets.find(w => w.name === name), lighting = find('lighting');
      const value = name => String(find(name)?.value ?? '');
      node.properties = node.properties || {};
      node.properties.bruxos_language = node.properties.bruxos_language || 'pt';
      const editor = createRelightEditor({
        getLanguage: () => node.properties.bruxos_language,
        setLanguage: v => { node.properties.bruxos_language = v; node.setDirtyCanvas(true, true); },
        read: () => lighting.value,
        write: v => { lighting.value = v; lighting.callback?.(v); node.setDirtyCanvas(true, true); },
        linkedImage: () => { try { return resolveLinkedImage(app.graph, node, q => api.apiURL(q), 'image'); } catch { return ''; } },
        drivenInputs: () => (node.inputs || []).filter(i => i.name?.startsWith('light1_') && i.link != null).map(i => i.name),
        looks: () => ({ sun: value('ball_style').includes('ground'), reference: !value('light_reference').startsWith('text') }),
        // Buttons in the panel drive the real widgets, so a saved workflow keeps the choice and the two never disagree.
        switches: () => {
          const flip = (name, options, hint, label, isOn) => {
            const w = find(name); if (!w) return null;
            const on = isOn ? isOn(String(w.value)) : String(w.value) === options[1];
            return { label: label + (on ? ' ON' : ' OFF'), on, hint,
              toggle() { w.value = options[on ? 0 : 1]; w.callback?.(w.value); node.setDirtyCanvas(true, true); } };
          };
          return [
            flip('runtime_task', ['still | 5-frame relight', 'directed | 39-frame settle'],
              'Trava a foto no frame 0 e faz um corte instantâneo de luz no frame 1 (39 frames, imagem tirada da cauda). Use se o modo normal mudar a composição ou a identidade.',
              'Âncora na foto', v => v.startsWith('directed')),
            flip('light_reference', ['text only', 'semantic sphere (Picture 2)'],
              'Manda a esfera iluminada como <Picture 2> (só Qwen, sem VAE). Ligue a saída light_reference no reference_image do encoder.',
              'Esfera no Picture 2'),
            flip('ball_style', ['sphere (MiniMax)', 'sphere + ground shadow (LTX/Venti)'],
              'A cena do Sphere-Light-Render (Venti): câmera de cima, esfera no chão, sombra projetada. É a bola que as LoRAs de direção de luz leem. Desligado: esfera lisa como na skill da MiniMax.',
              'Sombra no chão'),
          ].filter(Boolean);
        },
      });
      const widget = node.addDOMWidget('relight_editor', 'H3_RELIGHT_EDITOR', editor.element, { serialize: false });
      widget.computeSize = () => [600, 900];
      widget.computeLayoutSize = () => ({ minHeight: 900, maxHeight: 900 });
      for (const name of ['lighting', 'runtime_task', 'light_reference', 'ball_style']) {
        const w = find(name); if (!w) continue; const callback = w.callback;
        w.callback = function () { const r = callback?.apply(this, arguments); editor.sync(); return r; };
      }
      const configure = node.onConfigure;
      node.onConfigure = function () { const r = configure?.apply(this, arguments); editor.sync(); return r; };
      const connections = node.onConnectionsChange;
      node.onConnectionsChange = function () { const r = connections?.apply(this, arguments); editor.sync(); return r; };
      // After a run, the resolved light 1 comes back in the ui payload; the panel mirrors it.
      const executed = node.onExecuted;
      node.onExecuted = function (message) {
        const r = executed?.apply(this, arguments);
        try { editor.reflect(JSON.parse(message?.relight_driven?.[0] || '{}')); } catch { /* older payload */ }
        return r;
      };
      const removed = node.onRemoved;
      node.onRemoved = function () { editor.destroy(); return removed?.apply(this, arguments); };
      node.setSize([650, Math.max(node.size[1], 1260)]);
      return result;
    };
  },
});
