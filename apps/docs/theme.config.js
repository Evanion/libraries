export default {
  projectLink: 'https://github.com/evanion/open-source',
  docsRepositoryBase: 'https://github.com/evanion/open-source/blob/main',
  titleSuffix: ' – Evanion Open Source',
  nextLinks: true,
  prevLinks: true,
  search: true,
  darkMode: true,
  footer: true,
  footerText: `MIT ${new Date().getFullYear()} © Evanion.`,
  footerEditLink: `Edit this page on GitHub`,
  logo: (
    <>
      <span>📚</span>
      <span>Evanion Open Source</span>
    </>
  ),
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="Documentation for Evanion Open Source libraries"
      />
      <meta name="og:title" content="Evanion Open Source Documentation" />
    </>
  ),
};
