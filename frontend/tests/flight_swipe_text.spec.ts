import { test, expect } from '@playwright/test';

for (const width of [360, 1440]) {
  test(`swipe text tracks and restores letters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto('/#replay');
    const track = page.locator('.flight-swipe');
    await track.scrollIntoViewIfNeeded();
    const bounds = (await track.boundingBox())!;
    const letters = track.locator('.launch-track-copy > span');
    await expect(letters).toHaveCount(19);
    await expect(track.locator('.launch-track-copy')).toHaveCSS('justify-content', 'space-between');
    const textBounds = await letters.evaluateAll(nodes => {
      const boxes = nodes.map(node => node.getBoundingClientRect());
      return { left: boxes[0].left, right: boxes.at(-1)!.right };
    });
    expect(textBounds.right - textBounds.left).toBeGreaterThanOrEqual(bounds.width - 150);

    const pointerStartX = bounds.x + 30;
    const pointerY = bounds.y + bounds.height / 2;
    await page.mouse.move(pointerStartX, pointerY);
    await page.mouse.down();
    const crossing = Number(await letters.nth(9).evaluate(node =>
      getComputedStyle(node).getPropertyValue('--letter-progress')));
    const moveToProgress = (progress: number) =>
      page.mouse.move(pointerStartX + (bounds.width - 64) * progress, pointerY, { steps: 1 });

    await moveToProgress(crossing - .02);
    await expect.poll(() => letters.nth(9).evaluate(node => getComputedStyle(node).opacity)).toBe('1');
    await moveToProgress(crossing + .025);
    await expect.poll(async () => Number(await letters.nth(9).evaluate(node => getComputedStyle(node).opacity)))
      .toBeGreaterThan(.35);
    await expect.poll(async () => Number(await letters.nth(9).evaluate(node => getComputedStyle(node).opacity)))
      .toBeLessThan(.65);
    await moveToProgress(crossing + .06);
    await expect.poll(() => letters.nth(9).evaluate(node => getComputedStyle(node).opacity)).toBe('0');

    await moveToProgress(.5);

    await expect.poll(async () => letters.evaluateAll(nodes => nodes.some(node => getComputedStyle(node).opacity === '0'))).toBe(true);
    await expect.poll(async () => letters.evaluateAll(nodes => nodes.some(node => getComputedStyle(node).opacity === '1'))).toBe(true);
    await expect.poll(async () => letters.evaluateAll(nodes => nodes.some(node => {
      const opacity = Number(getComputedStyle(node).opacity);
      return opacity > 0 && opacity < 1;
    }))).toBe(true);

    await page.mouse.up();
    await expect(track.locator('progress')).toHaveAttribute('value', '0');
    await expect.poll(async () => letters.evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === '1'))).toBe(true);
  });
}
