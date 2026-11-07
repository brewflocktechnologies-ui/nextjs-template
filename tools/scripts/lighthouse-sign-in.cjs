// Lighthouse CI puppeteer script (lighthouserc.json): signs in as t_acme through the development
// tenant switcher before Lighthouse loads /settings/theme. Development only (D-12).
module.exports = async (browser) => {
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/dev/session');
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[aria-label="Sign in as Acme Corp"]'),
  ]);
  await page.close();
};
