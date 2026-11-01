// Site de L’Isoloir, publié sur GitHub Pages (https://chouvert.github.io/isoloir/).
// Les données viennent de ../donnees/base.json et l'identité de ../identite/ :
// le site ne recopie rien, il les lit au moment de la construction.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://chouvert.github.io',
  base: '/isoloir',
  trailingSlash: 'always',
  build: { format: 'directory' },
  vite: {
    server: { fs: { allow: ['..'] } },
  },
});
