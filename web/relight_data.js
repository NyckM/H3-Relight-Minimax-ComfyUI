// Shared by the panel and by relight.py, which parses the object literal as JSON.
// Keep it strict JSON: double quotes, no comments or trailing commas inside the braces.
export const DATA = {
 "version": 1,
 "kelvin_table": [
  [
   1000,
   255,
   140,
   20
  ],
  [
   1800,
   255,
   179,
   71
  ],
  [
   3200,
   255,
   210,
   161
  ],
  [
   5600,
   255,
   255,
   255
  ],
  [
   7000,
   232,
   241,
   255
  ],
  [
   10000,
   150,
   157,
   245
  ]
 ],
 "limits": {
  "azimuth": [
   -180,
   180
  ],
  "elevation": [
   -90,
   90
  ],
  "intensity": [
   10,
   100
  ],
  "kelvin": [
   1000,
   10000
  ],
  "lights": [
   1,
   3
  ]
 },
 "light_types": {
  "spotlight": {
   "label": "Duro",
   "hint": "Fonte pequena e direta: sombra de borda nítida e brilho especular forte.",
   "factor": 1.2,
   "wrap": 0.0,
   "shininess": 48,
   "spec": 0.45,
   "penumbra": 0.05,
   "shadow": 0.78,
   "rim": 1.6
  },
  "rectAreaLight": {
   "label": "Suave",
   "hint": "Fonte grande e difusa: a luz abraça a forma e a borda da sombra se esfuma.",
   "factor": 0.95,
   "wrap": 0.35,
   "shininess": 10,
   "spec": 0.14,
   "penumbra": 0.32,
   "shadow": 0.62,
   "rim": 1.25
  },
  "directionalLight": {
   "label": "Céu",
   "hint": "Luz ampla de céu: direcional mas muito macia, com sombras fracas.",
   "factor": 1.15,
   "wrap": 0.5,
   "shininess": 4,
   "spec": 0.0,
   "penumbra": 0.85,
   "shadow": 0.4,
   "rim": 0.95
  }
 },
 "backgrounds": {
  "default": {
   "label": "Original",
   "ambient": 0.2,
   "hemisphere": 0.13,
   "ground": [
    220,
    224,
    234
   ],
   "plate": [
    108,
    108,
    108
   ]
  },
  "black": {
   "label": "Estúdio preto",
   "ambient": 0.06,
   "hemisphere": 0.05,
   "ground": [
    58,
    63,
    74
   ],
   "plate": [
    22,
    22,
    24
   ]
  },
  "white": {
   "label": "Estúdio branco",
   "ambient": 0.28,
   "hemisphere": 0.18,
   "ground": [
    236,
    238,
    243
   ],
   "plate": [
    232,
    232,
    234
   ]
  }
 },
 "default_light": {
  "type": "rectAreaLight",
  "intensity": 60,
  "azimuth": 45,
  "elevation": 35,
  "colorMode": "kelvin",
  "color": "#ffffff",
  "kelvin": 5600
 },
 "added_lights": [
  [
   0,
   0
  ],
  [
   60,
   30
  ],
  [
   -60,
   30
  ]
 ],
 "effects": [
  {
   "id": "Tyndall",
   "label": "Raios Tyndall",
   "prompt": "visible volumetric light shafts cutting through a faint haze along the key light direction; the rays pass around the subject and never veil the face or the product"
  },
  {
   "id": "Blinds",
   "label": "Persiana",
   "prompt": "hard parallel stripes of light and shadow, as if the key light passes through venetian blinds, projected across the subject and the background along the key direction"
  },
  {
   "id": "Caustic Refraction",
   "label": "Refração cáustica",
   "prompt": "rippling caustic light patterns, as if the key light is refracted through moving water or glass, playing across the surfaces it reaches"
  },
  {
   "id": "Chiaroscuro Drama",
   "label": "Claro-escuro",
   "prompt": "strong chiaroscuro: one dominant key, fast falloff into deep near-black shadow, high contrast and very little fill"
  },
  {
   "id": "Realistic Diffuse",
   "label": "Difusa realista",
   "prompt": "natural, realistic diffuse light with gradual shadow transitions, true-to-life color and no stylization"
  },
  {
   "id": "Dune Oasis",
   "label": "Oásis de duna",
   "prompt": "sun-baked desert warmth: amber-orange light, dusty warm haze in the air, sun-bleached highlights and warm bounce light from the ground"
  },
  {
   "id": "Wong Kar-wai",
   "label": "Wong Kar-wai",
   "prompt": "dreamy, melancholic film mood: saturated teal-blue light against warm practical accents, soft bloom on highlights, light smoky haze and rich shadows"
  },
  {
   "id": "Blade Runner",
   "label": "Neon noir",
   "prompt": "neon-noir: saturated magenta and electric-blue light from low side angles, deep blacks, light haze and wet, reflective highlights"
  },
  {
   "id": "Succession",
   "label": "Velho dinheiro",
   "prompt": "quiet old-money interior: warm tungsten window light from high front-right, restrained contrast, rich muted wood and leather tones"
  },
  {
   "id": "Wes Pink",
   "label": "Rosa pastel",
   "prompt": "flat, symmetrical frontal soft light, a pastel pink palette, even exposure and minimal shadows, a storybook look"
  },
  {
   "id": "Lost in Translation",
   "label": "Hora azul",
   "prompt": "cool blue-hour light from the side, soft and lonely city-night mood, gentle contrast with a faint neon spill"
  },
  {
   "id": "Stranger Things",
   "label": "Anos 80 sobrenatural",
   "prompt": "1980s supernatural mood: deep red practical light from one side against a cold blue beam from high behind, light haze and strong color contrast"
  },
  {
   "id": "Sunset Boulevard",
   "label": "Sunset Boulevard",
   "prompt": "warm low sunset backlight, a golden rim around the silhouette, long shadows reaching toward the camera and a classic Hollywood glow"
  },
  {
   "id": "Godfather",
   "label": "Luz de cima",
   "prompt": "top light from directly above: warm amber tungsten, eye sockets and the lower face falling into shadow, low-key with deep blacks"
  },
  {
   "id": "Oppie Monochrom",
   "label": "Monocromo",
   "prompt": "black-and-white monochrome with a rich tonal range and silver-gelatin contrast; every color is rendered as grayscale"
  },
  {
   "id": "Liquid Gold",
   "label": "Ouro líquido",
   "prompt": "warm backlight skimming glossy surfaces, molten golden reflections and bright specular streaks along the edges"
  },
  {
   "id": "Metallic Sharp",
   "label": "Metal afiado",
   "prompt": "cold hard backlight, crisp specular edge highlights on metal and glass, clean black reflections and high contrast"
  },
  {
   "id": "Velvet Skin",
   "label": "Pele de veludo",
   "prompt": "soft, flattering diffuse key with velvety smooth tonal gradients and gentle wrap-around, no harsh shadow edges"
  },
  {
   "id": "Rim Light Halo",
   "label": "Halo de contorno",
   "prompt": "a bright backlight rim that outlines the full silhouette with a glowing halo, clearly separating the subject from the background"
  },
  {
   "id": "Dramatized Texture",
   "label": "Textura rasante",
   "prompt": "hard light grazing across surfaces at a low angle to reveal texture and relief with strong micro-shadows"
  },
  {
   "id": "Butterfly Product",
   "label": "Borboleta comercial",
   "prompt": "high frontal soft source, a small symmetrical shadow directly beneath the subject, a clean polished commercial look"
  },
  {
   "id": "Product Spotlight",
   "label": "Spot de produto",
   "prompt": "a hard spotlight from above that pools light on the subject, with falloff into darker surroundings"
  },
  {
   "id": "Champagne Glow",
   "label": "Brilho champanhe",
   "prompt": "warm champagne-gold backlight glow with elegant soft highlights and a luxurious warm sheen"
  },
  {
   "id": "Symmetry Studio",
   "label": "Estúdio simétrico",
   "prompt": "two equal lights from exactly left and right at eye level, mirrored highlights on both sides and a darker central line, clean studio look"
  },
  {
   "id": "Optical Caustics",
   "label": "Cáustica óptica",
   "prompt": "cool light passing through glass or crystal, projecting sharp caustic light patterns onto nearby surfaces"
  }
 ],
 "presets": [
  {
   "id": "Dune Oasis",
   "label": "Oásis de duna",
   "category": "portrait",
   "background": "default",
   "effect": "Dune Oasis",
   "lights": [
    {
     "type": "spotlight",
     "intensity": 73,
     "azimuth": -135,
     "elevation": 45,
     "colorMode": "kelvin",
     "kelvin": 1800,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Wong Kar-wai",
   "label": "Wong Kar-wai",
   "category": "portrait",
   "background": "default",
   "effect": "Wong Kar-wai",
   "lights": [
    {
     "type": "directionalLight",
     "intensity": 50,
     "azimuth": 90,
     "elevation": 0,
     "colorMode": "hex",
     "color": "#52bdff",
     "kelvin": 6500
    }
   ]
  },
  {
   "id": "Blade Runner",
   "label": "Neon noir",
   "category": "portrait",
   "background": "default",
   "effect": "Blade Runner",
   "lights": [
    {
     "type": "spotlight",
     "intensity": 70,
     "azimuth": -55,
     "elevation": -10,
     "colorMode": "hex",
     "color": "#ff00ee",
     "kelvin": 6500
    },
    {
     "type": "spotlight",
     "intensity": 70,
     "azimuth": 55,
     "elevation": -10,
     "colorMode": "hex",
     "color": "#1a33ff",
     "kelvin": 6500
    }
   ]
  },
  {
   "id": "Succession",
   "label": "Velho dinheiro",
   "category": "portrait",
   "background": "default",
   "effect": "Succession",
   "lights": [
    {
     "type": "directionalLight",
     "intensity": 47,
     "azimuth": 45,
     "elevation": 45,
     "colorMode": "kelvin",
     "kelvin": 3200,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Wes Pink",
   "label": "Rosa pastel",
   "category": "portrait",
   "background": "default",
   "effect": "Wes Pink",
   "lights": [
    {
     "type": "rectAreaLight",
     "intensity": 43,
     "azimuth": 0,
     "elevation": 0,
     "colorMode": "kelvin",
     "kelvin": 3000,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Lost in Translation",
   "label": "Hora azul",
   "category": "portrait",
   "background": "default",
   "effect": "Lost in Translation",
   "lights": [
    {
     "type": "directionalLight",
     "intensity": 40,
     "azimuth": 90,
     "elevation": 15,
     "colorMode": "kelvin",
     "kelvin": 8500,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Stranger Things",
   "label": "Anos 80 sobrenatural",
   "category": "portrait",
   "background": "default",
   "effect": "Stranger Things",
   "lights": [
    {
     "type": "directionalLight",
     "intensity": 70,
     "azimuth": 90,
     "elevation": 0,
     "colorMode": "hex",
     "color": "#8c0000",
     "kelvin": 6500
    },
    {
     "type": "spotlight",
     "intensity": 70,
     "azimuth": -125,
     "elevation": 50,
     "colorMode": "hex",
     "color": "#0084ff",
     "kelvin": 6500
    }
   ]
  },
  {
   "id": "Sunset Boulevard",
   "label": "Sunset Boulevard",
   "category": "portrait",
   "background": "default",
   "effect": "Sunset Boulevard",
   "lights": [
    {
     "type": "spotlight",
     "intensity": 60,
     "azimuth": 180,
     "elevation": 10,
     "colorMode": "kelvin",
     "kelvin": 2200,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Godfather",
   "label": "Luz de cima",
   "category": "portrait",
   "background": "default",
   "effect": "Godfather",
   "lights": [
    {
     "type": "rectAreaLight",
     "intensity": 80,
     "azimuth": 0,
     "elevation": 90,
     "colorMode": "kelvin",
     "kelvin": 3200,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Oppie Monochrom",
   "label": "Monocromo",
   "category": "portrait",
   "background": "default",
   "effect": "Oppie Monochrom",
   "lights": [
    {
     "type": "rectAreaLight",
     "intensity": 58,
     "azimuth": 90,
     "elevation": 45,
     "colorMode": "kelvin",
     "kelvin": 5000,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Liquid Gold",
   "label": "Ouro líquido",
   "category": "product",
   "background": "default",
   "effect": "Liquid Gold",
   "lights": [
    {
     "type": "spotlight",
     "intensity": 70,
     "azimuth": 180,
     "elevation": 0,
     "colorMode": "kelvin",
     "kelvin": 2000,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Metallic Sharp",
   "label": "Metal afiado",
   "category": "product",
   "background": "default",
   "effect": "Metallic Sharp",
   "lights": [
    {
     "type": "spotlight",
     "intensity": 77,
     "azimuth": 180,
     "elevation": 0,
     "colorMode": "kelvin",
     "kelvin": 10000,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Velvet Skin",
   "label": "Pele de veludo",
   "category": "product",
   "background": "default",
   "effect": "Velvet Skin",
   "lights": [
    {
     "type": "rectAreaLight",
     "intensity": 50,
     "azimuth": 45,
     "elevation": 45,
     "colorMode": "kelvin",
     "kelvin": 4500,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Rim Light Halo",
   "label": "Halo de contorno",
   "category": "product",
   "background": "default",
   "effect": "Rim Light Halo",
   "lights": [
    {
     "type": "spotlight",
     "intensity": 80,
     "azimuth": 180,
     "elevation": 30,
     "colorMode": "kelvin",
     "kelvin": 4500,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Dramatized Texture",
   "label": "Textura rasante",
   "category": "product",
   "background": "default",
   "effect": "Dramatized Texture",
   "lights": [
    {
     "type": "spotlight",
     "intensity": 67,
     "azimuth": 90,
     "elevation": 0,
     "colorMode": "kelvin",
     "kelvin": 5000,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Butterfly Product",
   "label": "Borboleta comercial",
   "category": "product",
   "background": "default",
   "effect": "Butterfly Product",
   "lights": [
    {
     "type": "rectAreaLight",
     "intensity": 57,
     "azimuth": 0,
     "elevation": 58,
     "colorMode": "kelvin",
     "kelvin": 5500,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Product Spotlight",
   "label": "Spot de produto",
   "category": "product",
   "background": "default",
   "effect": "Product Spotlight",
   "lights": [
    {
     "type": "spotlight",
     "intensity": 73,
     "azimuth": 45,
     "elevation": 90,
     "colorMode": "kelvin",
     "kelvin": 5600,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Champagne Glow",
   "label": "Brilho champanhe",
   "category": "product",
   "background": "default",
   "effect": "Champagne Glow",
   "lights": [
    {
     "type": "rectAreaLight",
     "intensity": 60,
     "azimuth": 135,
     "elevation": 45,
     "colorMode": "kelvin",
     "kelvin": 3000,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Symmetry Studio",
   "label": "Estúdio simétrico",
   "category": "product",
   "background": "default",
   "effect": "Symmetry Studio",
   "lights": [
    {
     "type": "spotlight",
     "intensity": 57,
     "azimuth": 90,
     "elevation": 0,
     "colorMode": "kelvin",
     "kelvin": 5600,
     "color": "#ffffff"
    },
    {
     "type": "spotlight",
     "intensity": 57,
     "azimuth": -90,
     "elevation": 0,
     "colorMode": "kelvin",
     "kelvin": 5600,
     "color": "#ffffff"
    }
   ]
  },
  {
   "id": "Optical Caustics",
   "label": "Cáustica óptica",
   "category": "product",
   "background": "default",
   "effect": "Optical Caustics",
   "lights": [
    {
     "type": "rectAreaLight",
     "intensity": 63,
     "azimuth": 120,
     "elevation": 45,
     "colorMode": "kelvin",
     "kelvin": 7500,
     "color": "#ffffff"
    }
   ]
  }
 ]
};
