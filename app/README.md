# Application Lumen (`app/`)

Interface web chargée par Electron ou servie en statique.

```
app/
├── pages/              # Pages HTML (points d’entrée)
│   ├── index.html      # Compression WebP
│   ├── wordpress.html  # Pack WordPress
│   └── icon.html       # Kit d’icônes
├── assets/
│   ├── css/            # styles.css, desktop.css, wordpress-pack.css
│   ├── js/
│   │   ├── core/       # env-loader, license-protection
│   │   ├── compression/
│   │   ├── icons/
│   │   └── wordpress/
│   └── icons/          # SVG Lumen
└── config/
    └── config.env.example
```

**Développement Electron :** `npm start` ouvre `app/pages/index.html`.

**Icône Windows :** avant un build distribuable, lancer `npm run icons` à la racine du projet (génère `build/icon.ico`).

**Config web :** copier `config/config.env.example` en `config/config.env`.
