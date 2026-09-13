export const HELP = {
  "H3RelightEditor": [
    [
      "Navegação 3D / 3D navigation",
      "Arraste a luz para mudar sua direção; arraste o fundo para girar a vista. Na esfera, arraste para apontar a luz; fora dela, mova para trás.",
      "Drag a light to change direction; drag the background to rotate the view. Drag on the sphere to aim; outside it to move the light behind."
    ],
    [
      "Luzes / Lights",
      "Adicione até 3 luzes, selecione pelo marcador ou botão e remova a selecionada. A mais forte define a principal.",
      "Add up to 3 lights, select a marker or chip and remove the selected light. The strongest light defines the key."
    ],
    [
      "Direção e elevação / Direction and elevation",
      "Azimute: 0° na câmera, 90° à direita, 180° atrás. Elevação: −90° abaixo, 0° horizonte, 90° acima.",
      "Azimuth: 0° camera side, 90° right, 180° behind. Elevation: −90° below, 0° horizon, 90° overhead."
    ],
    [
      "Tipo e intensidade / Type and intensity",
      "Duro: sombra nítida. Suave: sombra difusa. Céu: luz ampla e macia. Intensidade de 10 a 100 (leitura de 1 a 10).",
      "Hard: crisp shadows. Soft: diffuse shadows. Sky: broad, soft light. Intensity ranges from 10 to 100 (readout 1 to 10)."
    ],
    [
      "Kelvin / HEX",
      "Kelvin controla a temperatura de 1000 a 10000 K. HEX permite escolher uma cor exata no seletor ou por #RRGGBB.",
      "Kelvin controls temperature from 1000 to 10000 K. HEX selects an exact color with the picker or #RRGGBB."
    ],
    [
      "Presets",
      "Aplica um plano completo de luzes, fundo e atmosfera. Filtre por retrato ou produto. Editar um controle volta ao modo livre.",
      "Apply a complete plan of lights, background and atmosphere. Filter by portrait or product. Editing a control returns to custom lighting."
    ],
    [
      "Fundo / Background",
      "Original mantém o cenário; preto cria estúdio escuro; branco cria estúdio claro com sombra suave.",
      "Original keeps the scenery; black creates a dark studio; white creates a bright studio with soft shadows."
    ],
    [
      "Atmosfera / Atmosphere",
      "Escolha um efeito para acrescentar ao prompt. Nenhuma usa apenas as luzes. As descrições de todos os efeitos estão abaixo.",
      "Select an effect to append to the prompt. None uses only the lights. Descriptions for every effect are below."
    ],
    [
      "Imagem de referência / Reference image",
      "O arquivo local serve para prévia. Conecte image no grafo para gerar as saídas na proporção da foto e o ball_composite. Use “usar o node” para voltar à imagem conectada.",
      "A local file is used for preview. Connect image in the graph for photo-aspect outputs and ball_composite. Use “use connected node” to restore the linked image."
    ],
    [
      "Reiniciar / Reset",
      "Restaura uma luz suave de frente-direita e limpa preset, fundo e atmosfera.",
      "Restore one soft front-right light and reset preset, background and atmosphere."
    ],
    [
      "Âncora na foto / Photo anchor",
      "still: a foto entra como referência nativa (REF2VA), sem âncora no frame 0, então todos os frames já nascem com a luz nova e parada. É o padrão. directed: 39 frames com a foto travada no frame 0 e um corte instantâneo de luz no frame 1; o decodificador tira a imagem da cauda. Use se o still mudar a composição ou a identidade. Também tem botão na barra Testes do painel (Âncora na foto).",
      "still: native photo reference, 5 frames with the new lighting. directed: anchors the photo at frame 0, changes lighting at frame 1 and settles for 39 frames; use if still changes composition or identity."
    ],
    [
      "Esfera no Picture 2 / Sphere in Picture 2",
      "semantic sphere: a esfera iluminada vai como <Picture 2> só pelo Qwen, sem VAE, e o prompt diz para ler dela apenas a luz. Ligue light_reference no reference_image do encoder. text only: o prompt não cita <Picture 2> e o options desliga a referência.",
      "semantic sphere sends the sphere as Picture 2 through Qwen without VAE. Connect light_reference to the encoder reference_image. text only removes Picture 2 from the prompt and disables the reference in options."
    ],
    [
      "Sombra no chão / Ground shadow",
      "Aparência da esfera de referência. sphere: como a skill da MiniMax, esfera sobre fundo liso. ground shadow: a convenção da bola de direção de luz (Eric Venti, LTX Relight), com chão e a sombra projetada de cada luz. Também tem botão na barra Testes.",
      "sphere: sphere against a plain background. ground shadow: Venti/LTX-style direction sphere with a ground plane and a projected shadow for each light."
    ],
    [
      "Entradas do grafo / Graph inputs",
      "Entradas light1_* conectadas prevalecem sobre o painel. Desconecte para editar localmente; o valor calculado aparece após a execução.",
      "Connected light1_* inputs override the panel. Disconnect to edit locally; the resolved value appears after execution."
    ],
    [
      "Raios Tyndall / Tyndall",
      "Raios volumétricos atravessam uma névoa leve na direção da luz principal, sem cobrir o sujeito.",
      "visible volumetric light shafts cutting through a faint haze along the key light direction; the rays pass around the subject and never veil the face or the product"
    ],
    [
      "Persiana / Blinds",
      "Faixas paralelas de luz e sombra de persiana sobre o sujeito e o fundo.",
      "hard parallel stripes of light and shadow, as if the key light passes through venetian blinds, projected across the subject and the background along the key direction"
    ],
    [
      "Refração cáustica / Caustic Refraction",
      "Padrões ondulados de luz refratada por água ou vidro nas superfícies.",
      "rippling caustic light patterns, as if the key light is refracted through moving water or glass, playing across the surfaces it reaches"
    ],
    [
      "Claro-escuro / Chiaroscuro Drama",
      "Uma luz dominante, sombras profundas, contraste alto e pouco preenchimento.",
      "strong chiaroscuro: one dominant key, fast falloff into deep near-black shadow, high contrast and very little fill"
    ],
    [
      "Difusa realista / Realistic Diffuse",
      "Luz difusa natural, transições graduais de sombra e cores realistas.",
      "natural, realistic diffuse light with gradual shadow transitions, true-to-life color and no stylization"
    ],
    [
      "Oásis de duna / Dune Oasis",
      "Luz âmbar de deserto, névoa quente e reflexos quentes do chão.",
      "sun-baked desert warmth: amber-orange light, dusty warm haze in the air, sun-bleached highlights and warm bounce light from the ground"
    ],
    [
      "Wong Kar-wai / Wong Kar-wai",
      "Luz azul-petróleo com pontos quentes, brilho suave e névoa para um clima melancólico.",
      "dreamy, melancholic film mood: saturated teal-blue light against warm practical accents, soft bloom on highlights, light smoky haze and rich shadows"
    ],
    [
      "Neon noir / Blade Runner",
      "Neon magenta e azul de ângulos laterais baixos, pretos profundos e reflexos molhados.",
      "neon-noir: saturated magenta and electric-blue light from low side angles, deep blacks, light haze and wet, reflective highlights"
    ],
    [
      "Velho dinheiro / Succession",
      "Interior de tons discretos, luz quente alta de frente-direita, madeira e couro.",
      "quiet old-money interior: warm tungsten window light from high front-right, restrained contrast, rich muted wood and leather tones"
    ],
    [
      "Rosa pastel / Wes Pink",
      "Luz frontal suave e simétrica, rosa pastel, exposição uniforme e sombras mínimas.",
      "flat, symmetrical frontal soft light, a pastel pink palette, even exposure and minimal shadows, a storybook look"
    ],
    [
      "Hora azul / Lost in Translation",
      "Luz lateral fria da hora azul com contraste suave e um leve reflexo de neon.",
      "cool blue-hour light from the side, soft and lonely city-night mood, gentle contrast with a faint neon spill"
    ],
    [
      "Anos 80 sobrenatural / Stranger Things",
      "Vermelho de um lado e feixe azul frio alto por trás, névoa e contraste forte de cor.",
      "1980s supernatural mood: deep red practical light from one side against a cold blue beam from high behind, light haze and strong color contrast"
    ],
    [
      "Sunset Boulevard / Sunset Boulevard",
      "Contraluz baixo de pôr do sol, contorno dourado e sombras longas para a câmera.",
      "warm low sunset backlight, a golden rim around the silhouette, long shadows reaching toward the camera and a classic Hollywood glow"
    ],
    [
      "Luz de cima / Godfather",
      "Luz âmbar diretamente de cima, olhos e parte inferior do rosto em sombra profunda.",
      "top light from directly above: warm amber tungsten, eye sockets and the lower face falling into shadow, low-key with deep blacks"
    ],
    [
      "Monocromo / Oppie Monochrom",
      "Preto e branco com ampla escala tonal e contraste de fotografia em gelatina de prata.",
      "black-and-white monochrome with a rich tonal range and silver-gelatin contrast; every color is rendered as grayscale"
    ],
    [
      "Ouro líquido / Liquid Gold",
      "Contraluz quente sobre superfícies brilhantes com reflexos dourados nas bordas.",
      "warm backlight skimming glossy surfaces, molten golden reflections and bright specular streaks along the edges"
    ],
    [
      "Metal afiado / Metallic Sharp",
      "Contraluz frio e duro, reflexos nítidos em metal e vidro e contraste alto.",
      "cold hard backlight, crisp specular edge highlights on metal and glass, clean black reflections and high contrast"
    ],
    [
      "Pele de veludo / Velvet Skin",
      "Luz principal suave e envolvente com transições delicadas e sombras sem bordas duras.",
      "soft, flattering diffuse key with velvety smooth tonal gradients and gentle wrap-around, no harsh shadow edges"
    ],
    [
      "Halo de contorno / Rim Light Halo",
      "Contraluz forte cria um halo em toda a silhueta, separando o sujeito do fundo.",
      "a bright backlight rim that outlines the full silhouette with a glowing halo, clearly separating the subject from the background"
    ],
    [
      "Textura rasante / Dramatized Texture",
      "Luz dura rasante revela textura e relevo por pequenas sombras.",
      "hard light grazing across surfaces at a low angle to reveal texture and relief with strong micro-shadows"
    ],
    [
      "Borboleta comercial / Butterfly Product",
      "Fonte suave frontal alta, sombra pequena e simétrica sob o sujeito, aparência comercial.",
      "high frontal soft source, a small symmetrical shadow directly beneath the subject, a clean polished commercial look"
    ],
    [
      "Spot de produto / Product Spotlight",
      "Spot duro de cima concentra luz no produto e escurece os arredores.",
      "a hard spotlight from above that pools light on the subject, with falloff into darker surroundings"
    ],
    [
      "Brilho champanhe / Champagne Glow",
      "Contraluz dourado de champanhe com brilho quente e reflexos suaves.",
      "warm champagne-gold backlight glow with elegant soft highlights and a luxurious warm sheen"
    ],
    [
      "Estúdio simétrico / Symmetry Studio",
      "Duas luzes iguais à esquerda e direita, reflexos espelhados e centro mais escuro.",
      "two equal lights from exactly left and right at eye level, mirrored highlights on both sides and a darker central line, clean studio look"
    ],
    [
      "Cáustica óptica / Optical Caustics",
      "Luz fria através de vidro ou cristal projeta padrões cáusticos nítidos.",
      "cool light passing through glass or crystal, projecting sharp caustic light patterns onto nearby surfaces"
    ],
    [
      "lighting",
      "A iluminação em JSON, escrita pelo painel acima: de 1 a 3 luzes, cada uma com type, intensity (10 a 100), azimuth (-180 a 180, 0 é o lado da câmera, 90 é a direita do quadro), elevation (-90 a 90), cor em HEX ou Kelvin; mais background e effect. Aceita também, colado, o JSON de parâmetros da skill Relight da MiniMax.",
      "Lighting JSON edited by the panel: 1–3 lights, type, intensity (10–100), azimuth (−180–180), elevation (−90–90), HEX/Kelvin color, background and effect. Also accepts MiniMax Relight parameter JSON."
    ],
    [
      "runtime_task",
      "still: a foto entra como referência nativa (REF2VA), sem âncora no frame 0, então todos os frames já nascem com a luz nova e parada. É o padrão. directed: 39 frames com a foto travada no frame 0 e um corte instantâneo de luz no frame 1; o decodificador tira a imagem da cauda. Use se o still mudar a composição ou a identidade. Também tem botão na barra Testes do painel (Âncora na foto).",
      "still: native photo reference, 5 frames with the new lighting. directed: anchors the photo at frame 0, changes lighting at frame 1 and settles for 39 frames; use if still changes composition or identity."
    ],
    [
      "instruction",
      "Texto livre, acrescentado UMA vez no fim do prompt. Escreva só o que o node não sabe: qual é o sujeito quando há vários, material que deve brilhar, intenção de clima. Não repita direção, cor ou intensidade: isso já sai do painel, e repetir com outras palavras cria contradição.",
      "Extra text appended once to the prompt. Specify the subject, material or mood. Avoid repeating directions, colors or intensity already set in the panel."
    ],
    [
      "image",
      "Ligue o MESMO LoadImage que alimenta o source_image do H3 Edit. A foto aparece no painel, a esfera de referência sai na mesma proporção dela, e a saída ball_composite usa esses frames.",
      "Connect the same LoadImage used by H3 Edit source_image. Displays the photo, sets the sphere aspect ratio and supplies frames for ball_composite."
    ],
    [
      "subject",
      "Acrescenta a regra de preservação certa: portrait cuida de pele, olhos e catchlights; product de silhueta, rótulo e reflexos; scene / exterior trata a luz principal como sol.",
      "Select preservation rules: portrait protects skin, eyes and catchlights; product protects silhouette, label and reflections; scene / exterior treats the key as sunlight."
    ],
    [
      "relight_strength",
      "Quanto da luz original sai. Se a identidade ou a geometria mudarem, a skill manda reduzir a força do pedido: use subtle. Se o resultado sair chapado, strong.",
      "How strongly to replace the original lighting: subtle for better identity/geometry preservation, balanced by default, strong for a stronger lighting change."
    ],
    [
      "light_reference",
      "semantic sphere: a esfera iluminada vai como <Picture 2> só pelo Qwen, sem VAE, e o prompt diz para ler dela apenas a luz. Ligue light_reference no reference_image do encoder. text only: o prompt não cita <Picture 2> e o options desliga a referência.",
      "semantic sphere sends the sphere as Picture 2 through Qwen without VAE. Connect light_reference to the encoder reference_image. text only removes Picture 2 from the prompt and disables the reference in options."
    ],
    [
      "light1_azimuth",
      "Conduz o azimute da luz 1 pelo grafo (-180 a 180; 0 é o lado da câmera, 90 a direita do quadro). Ligado, vence o painel, que passa a espelhar o valor. Ligue a saída azimuth do Sol H3.",
      "Drive light 1 from the graph: −180 to 180 degrees, 0 camera side, 90 frame right. Overrides the panel. Connect Sun H3 azimuth."
    ],
    [
      "light1_elevation",
      "Conduz a elevação da luz 1 (-90 a 90). Ligue a saída elevation do Sol H3.",
      "Drive light 1 elevation (−90 to 90 degrees). Overrides the panel. Connect Sun H3 elevation."
    ],
    [
      "light1_intensity",
      "Conduz a intensidade da luz 1, na escala do painel: 10 a 100.",
      "Drive light 1 intensity (10–100). Overrides the panel."
    ],
    [
      "light1_kelvin",
      "Conduz a cor da luz 1 em Kelvin (1000 a 10000) e põe ela em modo Kelvin. Ligue a saída kelvin do Sol H3 para a cor do sol pela altura.",
      "Drive light 1 color temperature (1000–10000 K), enabling Kelvin mode. Overrides the panel. Connect Sun H3 kelvin."
    ],
    [
      "ball_style",
      "Aparência da esfera de referência. sphere: como a skill da MiniMax, esfera sobre fundo liso. ground shadow: a convenção da bola de direção de luz (Eric Venti, LTX Relight), com chão e a sombra projetada de cada luz. Também tem botão na barra Testes.",
      "sphere: sphere against a plain background. ground shadow: Venti/LTX-style direction sphere with a ground plane and a projected shadow for each light."
    ],
    [
      "compiled_prompt",
      "Prompt completo de relight. Ligue no compiled_prompt do Text Encode H3 Edit.",
      "Complete relight prompt. Connect to Text Encode H3 Edit compiled_prompt."
    ],
    [
      "options",
      "As chaves que o encoder do H3 Edit lê, com a tarefa e o perfil de frames certos. OBRIGATÓRIO junto com o prompt: chave ausente faz o upstream cair nos widgets legados escondidos dele.",
      "H3 Edit encoder options, including task and frame profile. Connect together with compiled_prompt."
    ],
    [
      "light_reference",
      "A esfera iluminada pelas suas luzes. Ligue no reference_image do Text Encode H3 Edit: vira <Picture 2>.",
      "Sphere rendered with your lights. Connect to Text Encode H3 Edit reference_image for Picture 2."
    ],
    [
      "info",
      "Diagnóstico legível: tarefa, papel de cada luz, avisos da skill, e a frase equivalente do LTX Relight.",
      "Readable diagnostics: task, light roles, warnings and equivalent LTX Relight phrase."
    ],
    [
      "minimax_prompt",
      "O mesmo plano de luz nas seções do H3 (subject_definitions, summary, ...). ALTERNATIVA ao compiled_prompt.",
      "The lighting plan in H3 sections (subject_definitions, summary, etc.). Alternative to compiled_prompt."
    ],
    [
      "lighting_json",
      "A iluminação no formato de parâmetros da skill Relight da MiniMax (light1..3, background, effect).",
      "Lighting in MiniMax Relight parameter format (light1..3, background, effect)."
    ],
    [
      "ltx_prompt",
      "Legenda no formato do LTX-2.3 Relight IC-LoRA: gatilho, um dos 12 looks treinados e a direção.",
      "LTX-2.3 Relight IC-LoRA caption: trigger, one of the 12 trained looks and direction."
    ],
    [
      "ball_composite",
      "Os frames de image com a bola de direção no canto superior direito (143 px a 1280x704), o sinal de controle do LTX-2.3 Relight. Sem image ligada, sai só a bola.",
      "Input image frames with the direction sphere in the upper-right corner. LTX-2.3 control signal; without image input, outputs only the sphere."
    ]
  ],
  "H3SunPosition": [
    [
      "location",
      "Cidade (\"Curitiba, Brasil\", \"Austin, TX\", \"Londres\") ou coordenadas (\"-25.43, -49.27\"). O mesmo campo aceita os dois: coordenadas usam o fuso da cidade listada mais próxima. Sem acento funciona.",
      "City (for example Austin, TX) or latitude, longitude (for example −25.43, −49.27). Coordinates use the nearest listed city timezone. Accents are optional."
    ],
    [
      "year",
      "Ano do calendário local (1–9999).",
      "Local calendar year (1–9999)."
    ],
    [
      "month",
      "Mês do calendário local (1–12).",
      "Local calendar month (1–12)."
    ],
    [
      "day",
      "Dia local. Use uma data válida para o mês e ano escolhidos.",
      "Local calendar day. Use a valid date for the selected month and year."
    ],
    [
      "hour",
      "Hora do relógio local, horário de verão incluído.",
      "Local clock hour (0–23), including daylight saving time."
    ],
    [
      "minute",
      "Minuto do relógio local (0–59).",
      "Local clock minute (0–59)."
    ],
    [
      "heading",
      "Para onde a câmera aponta, em graus de bússola: 0 norte, 90 leste, 180 sul, 270 oeste. Arraste a bússola do node. Câmera virada para o sol dá contraluz; de costas para ele, luz de frente.",
      "Camera compass heading: 0 north, 90 east, 180 south, 270 west. Drag the compass or use the arrow keys. Facing the sun produces backlight; facing away produces front light."
    ],
    [
      "azimuth",
      "Azimute do sol na convenção do Relight: 0 lado da câmera, 90 direita do quadro, 180 atrás do sujeito. Ligue em light1_azimuth.",
      "Sun azimuth in Relight coordinates: 0 camera side, 90 frame right, 180 behind subject. Connect to light1_azimuth."
    ],
    [
      "elevation",
      "Altura do sol em graus. À noite sai 0 (horizonte) e o info avisa. Ligue em light1_elevation.",
      "Sun altitude in degrees; returns 0 at night with a diagnostic. Connect to light1_elevation."
    ],
    [
      "kelvin",
      "Cor aproximada da luz direta do sol pela altura: ~2000K no horizonte, 5600K acima de 60 graus.",
      "Approximate direct sunlight color: about 2000 K at the horizon to 5600 K above 60 degrees."
    ],
    [
      "info",
      "O que foi resolvido: lugar, fuso, hora em UTC, posição do sol na bússola e o aviso de noite.",
      "Resolved location, timezone, UTC time, compass sun position and nighttime warning."
    ]
  ]
};
