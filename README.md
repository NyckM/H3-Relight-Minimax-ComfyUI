# bruxosdovfx · Relight H3

Estúdio de luz para **MiniMax H3** dentro do ComfyUI.  
Lighting studio for **MiniMax H3** inside ComfyUI.

Posicione até três luzes, escolha direção, intensidade, cor, fundo e atmosfera, e gere uma referência de luz + prompt para H3 Edit.  
Place up to three lights, choose direction, intensity, color, background and atmosphere, and generate a lighting reference + prompt for H3 Edit.

> **PT:** O node compila prompt e referência visual. Não é um adaptador de luz e não garante que o H3 siga a iluminação perfeitamente.  
> **EN:** The node compiles a prompt and visual reference. It is not a lighting adapter and cannot guarantee perfect H3 lighting control.

---

## Instalação / Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/<seu-usuario>/ComfyUI-H3-Relight
```

Instale as dependências / Install dependencies:

```bash
pip install -r ComfyUI/custom_nodes/ComfyUI-H3-Relight/requirements.txt
```

Reinicie o ComfyUI. Os nodes aparecem em:

```text
Bruxos do VFX/Relight H3
```

Também requer / Also requires:

[`ethanfel/ComfyUI-MiniMax-H3-Edit`](https://github.com/ethanfel/ComfyUI-MiniMax-H3-Edit)

---

## Nodes

### bruxosdovfx · Relight H3

Estúdio de iluminação com até três luzes.  
Lighting studio with up to three lights.

O node gera:

- `compiled_prompt`
- `options`
- `light_reference`
- `minimax_prompt`
- `lighting_json`
- `ltx_prompt`
- `ball_composite`
- `info`

### bruxosdovfx · Sun H3

Calcula a posição real do sol usando local, data, hora e direção da câmera.  
Calculates the real sun position using location, date, time and camera heading.

---

## Ligações principais / Main connections

| Saída / Output | Ligue em / Connect to |
|---|---|
| `compiled_prompt` | H3 Edit Text Encode / Generate |
| `options` | H3 Edit Text Encode / Generate |
| `light_reference` | `reference_image` do H3 Edit |
| `image` | mesma imagem usada como `source_image` |
| `minimax_prompt` | workflows H3 nativos / native H3 workflows |

`compiled_prompt` + `options` trabalham juntos no H3 Edit.  
`compiled_prompt` + `options` are used together with H3 Edit.

A esfera iluminada entra como **Picture 2** e ajuda o modelo a entender direção, dureza e cor da luz.  
The illuminated sphere is sent as **Picture 2** and helps the model understand light direction, hardness and color.

---

## Como usar / Basic use

- Ligue sua imagem em `image`. / Connect your image to `image`.
- Arraste as luzes na cúpula 3D. / Drag the lights on the 3D dome.
- Use até 3 luzes. / Use up to 3 lights.
- Ajuste direção, elevação, intensidade e cor. / Adjust direction, elevation, intensity and color.
- Escolha fundo e atmosfera. / Choose background and atmosphere.
- Use um dos 20 presets, se quiser. / Use one of the 20 presets if desired.
- Ligue `compiled_prompt`, `options` e `light_reference` ao H3 Edit. / Connect them to H3 Edit.

A prévia no painel é apenas uma aproximação visual.  
The panel preview is only a visual approximation.

---

## Luzes / Lights

Cada luz pode controlar:

| Controle / Control | Uso / Use |
|---|---|
| Azimuth | direção horizontal / horizontal direction |
| Elevation | altura da luz / light height |
| Intensity | força relativa / relative strength |
| Kelvin / HEX | cor da luz / light color |
| Type | dura, suave ou céu / hard, soft or sky |

O papel das luzes é calculado automaticamente: principal, preenchimento ou recorte.  
Light roles are assigned automatically: key, fill or rim.

---

## Presets e atmosfera / Presets and atmosphere

O painel inclui:

- **20 presets de iluminação** / 20 lighting presets
- **25 atmosferas** / 25 atmosphere options
- **Original**
- **Black Studio**
- **White Studio**

Os presets seguem a skill Relight da MiniMax.  
The presets follow the MiniMax Relight skill.

---

## Light Reference

### `semantic sphere (Picture 2)`

Envia a esfera iluminada como referência sem usar os pixels dela como conteúdo da cena.  
Sends the illuminated sphere as a semantic reference without treating its pixels as scene content.

### `text only`

Usa somente o prompt.  
Uses only the prompt.

---

## Ball Style

### `sphere (MiniMax)`

Esfera simples sobre fundo neutro.  
Simple sphere on a neutral background.

### `sphere + ground shadow (LTX/Venti)`

Esfera com chão e sombra projetada, compatível com workflows de direção de luz baseados em esfera.  
Sphere with ground and cast shadow, compatible with sphere-based light-direction workflows.

---

## Runtime Task

### `still | 5-frame relight`

Modo padrão para relight de imagem.  
Default still-image relight mode.

### `still | 13-frame relight`

Mais frames para tentar estabilizar o resultado.  
More frames for additional stabilization.

### `directed | 39-frame settle`

Ancora a imagem no frame 0 e aplica a nova iluminação nos frames seguintes.  
Anchors the image at frame 0 and applies the new lighting in subsequent frames.

Use quando o modo still alterar demais identidade ou composição.  
Use it when still mode changes identity or composition too much.

---

## Sun H3

`Sun H3` calcula a direção real do sol.

`Sun H3` calculates the real sun direction.

Entradas principais / Main inputs:

| Entrada / Input | Uso / Use |
|---|---|
| `location` | cidade ou coordenadas / city or coordinates |
| `year/month/day` | data / date |
| `hour/minute` | hora local / local time |
| `heading` | direção da câmera / camera direction |

Saídas / Outputs:

| Output | Connect to |
|---|---|
| `azimuth` | `light1_azimuth` |
| `elevation` | `light1_elevation` |
| `kelvin` | `light1_kelvin` |

Virar a câmera para o sol cria contraluz.  
Pointing the camera toward the sun creates backlight.

Ficar de costas para o sol cria luz frontal.  
Pointing away from the sun creates front lighting.

---

## Principais controles / Main controls

| Controle | PT | EN |
|---|---|---|
| `lighting` | Configuração das luzes em JSON. | Lighting setup as JSON. |
| `runtime_task` | Modo de geração. | Generation mode. |
| `instruction` | Instrução extra. | Extra instruction. |
| `subject` | Retrato, produto, cena ou auto. | Portrait, product, scene or auto. |
| `relight_strength` | Subtle, balanced ou strong. | Subtle, balanced or strong. |
| `light_reference` | Esfera ou somente texto. | Sphere or text only. |
| `ball_style` | Estilo da esfera. | Sphere style. |

Entradas como `light1_azimuth`, `light1_elevation`, `light1_intensity` e `light1_kelvin` podem ser controladas diretamente pelo grafo.  
Inputs such as `light1_azimuth`, `light1_elevation`, `light1_intensity` and `light1_kelvin` can be driven directly by the graph.

---

## Saídas / Outputs

| Saída / Output | Uso / Use |
|---|---|
| `compiled_prompt` | Prompt completo para H3 Edit |
| `options` | Opções do encoder H3 Edit |
| `light_reference` | Esfera iluminada |
| `info` | Diagnóstico |
| `minimax_prompt` | Prompt alternativo para H3 |
| `lighting_json` | Configuração da iluminação |
| `ltx_prompt` | Prompt para LTX-2.3 Relight |
| `ball_composite` | Imagem/vídeo com esfera composta |

---

## Limitações / Limitations

- O H3 ainda pode errar direção, intensidade e sombras. / H3 can still miss direction, intensity and shadows.
- A prévia do painel não representa o resultado final. / The panel preview does not represent the final result.
- O modo still não trava a imagem pixel a pixel. / Still mode does not lock the image pixel-for-pixel.
- A esfera funciona como guia semântico, não como controle geométrico exato. / The sphere is a semantic guide, not exact geometric control.
- `Sun H3` precisa de `tzdata` no Windows para horário de verão correto. / `Sun H3` needs `tzdata` on Windows for correct daylight-saving handling.

---

## Créditos / Credits

Node dos **Bruxos do VFX**.  
Node by **Bruxos do VFX**.

Relight presets and lighting structure follow the **MiniMax Relight skill**.

Light-direction sphere conventions are based on work by **Eric Venti**, with compatibility for **LTX-2.3 Relight IC-LoRA**.

Sun-position calculations and camera-to-sun mapping are based on work by **Christopher Connock**.

Cities database: **GeoNames cities15000**, CC BY 4.0.

Detalhes das licenças em `NOTICE.md`.  
License details are available in `NOTICE.md`.
