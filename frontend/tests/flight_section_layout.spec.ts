import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`in-page flight content stays within its card and under the sticky header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#replay');
    const header = page.locator('.site-header');
    const section = page.locator('#replay');
    const card = page.locator('#replay .season-next');
    const viewport = page.locator('#replay .flight-viewport');
    await expect(viewport).toBeVisible();
    await expect.poll(() => viewport.evaluate(el => getComputedStyle(el).zIndex)).toBe('auto');

    for (const selector of ['.destination-copy', '.flight-city', '.launch-route-labels', '.flight-swipe']) {
      const bounds = await page.locator(`#replay ${selector}`).boundingBox();
      const cardBounds = await card.boundingBox();
      const sectionBounds = await section.boundingBox();
      expect(bounds).not.toBeNull();
      expect(cardBounds).not.toBeNull();
      expect(sectionBounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(cardBounds!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(cardBounds!.x + cardBounds!.width);
      expect(bounds!.y).toBeGreaterThanOrEqual(sectionBounds!.y);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(sectionBounds!.y + sectionBounds!.height);
    }

    const headerBounds = await header.boundingBox();
    const viewportBounds = await viewport.boundingBox();
    expect(headerBounds).not.toBeNull();
    expect(viewportBounds).not.toBeNull();
    const scrollY = await page.evaluate(() => window.scrollY);
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }),
      viewportBounds!.y + scrollY - headerBounds!.height / 2);
    const headerHit = await page.evaluate(() => {
      const header = document.querySelector('.site-header')!;
      return header.contains(document.elementFromPoint(innerWidth / 2, header.getBoundingClientRect().height / 2));
    });
    expect(headerHit).toBe(true);
  });
}
