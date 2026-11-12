import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Datacore',
  tagline: 'A shared query engine and views for Obsidian power users.',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://yankeeinlondon.github.io',
  baseUrl: '/datacore',
  trailingSlash: false,

  // GitHub pages deployment config.
  organizationName: 'yankeeinlondon',
  projectName: 'datacore',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: "/",
          editUrl: 'https://github.com/yankeeinlondon/datacore/tree/master/docs',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Datacore',
      logo: {
        alt: 'Datacore',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'default',
          position: 'left',
          label: 'Documentation',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/yankeeinlondon/datacore',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Documentation',
              to: '/',
            },
            {
              label: 'Blog',
              to: '/blog',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/yankeeinlondon/datacore',
            },
            {
              label: 'Upstream Datacore',
              href: 'https://github.com/blacksmithgu/datacore',
            },
            {
              label: 'Discord (upstream)',
              href: 'https://discord.gg/KwZUX4BYba',
            },
          ],
        },
      ],
      copyright: `Datacore © ${new Date().getFullYear()} Michael Brenan. Datacore Engine and Datacore View: Preact are a fork maintained by Ken Snyder. <a href="https://obsidian.md">Obsidian.md</a> is a trademark of Obsidian.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
