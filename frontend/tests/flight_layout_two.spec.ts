import { test, expect } from '@playwright/test';

for (const width of [360, 390, 768, 1024, 1440, 1920]) {
  test(`complete aircraft and banner clear static skyline at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 360 ? 800 : width < 768 ? 844 : width === 1920 ? 1080 : 900 });
    await page.goto('/#replay');
    await page.evaluate(() => document.fonts.ready);
    const launch = page.getByRole('button', { name: /Launch flight/ });
    await launch.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('idle.png') });
    // A short mouse drag cancels; an 80% drag launches once.
    const track = page.locator('.flight-swipe');
    const rect = (await track.boundingBox())!;
    const y = rect.y + rect.height / 2;
    await page.mouse.move(rect.x + 30, y); await page.mouse.down();
    await page.mouse.move(rect.x + 55, y, { steps: 3 }); await page.mouse.up();
    await expect(page.locator('.flight-overlay')).toHaveCount(0);
    await expect(track.locator('progress')).toHaveAttribute('value', '0');
    await page.mouse.move(rect.x + 30, y); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width - 15, y, { steps: 12 }); await page.mouse.up();
    const canvas = page.locator('.flight-viewport canvas');
    await expect(canvas).toHaveAttribute('data-running', 'true');
    await expect(canvas).toHaveAttribute('data-banner', 'attached');
    await expect(page.locator('.flight-city')).toHaveCSS('opacity', '1');
    await page.screenshot({path:info.outputPath('launch-environment.png')});
    await page.evaluate(() => {
      const frames: {left:number;right:number;top:number;bottom:number;progress:number;clear:boolean}[] = [];
      (window as unknown as {flightFrames: typeof frames}).flightFrames = frames;
      const collect = () => {
        const canvas = document.querySelector<HTMLCanvasElement>('.flight-viewport canvas');
        if (!canvas) return;
        const stage = canvas.getBoundingClientRect();
        const city = document.querySelector('.flight-city')!.getBoundingClientRect();
        if (canvas.dataset.bounds) {
          const b = JSON.parse(canvas.dataset.bounds);
          frames.push({...b, progress:Number(canvas.dataset.progress), clear:
            b.left > (city.right-stage.left)/stage.width || b.right < (city.left-stage.left)/stage.width || b.bottom < (city.top-stage.top)/stage.height});
        }
        requestAnimationFrame(collect);
      }; collect();
    });
    const image = page.locator('.flight-city');
    const initial = await image.boundingBox();
    for (const [name, progress] of [['entry',.16], ['left-turn',.36], ['climb',.48], ['flyover',.68], ['exit',.85]] as const) {
      await expect.poll(async () => Number(await canvas.getAttribute('data-progress')), { intervals:[20] }).toBeGreaterThan(progress);
      await expect(page.locator('.prize-unlocked')).toHaveCount(0);
      expect(await image.boundingBox()).toEqual(initial);
      await page.screenshot({path:info.outputPath(`${name}.png`)});
    }
    await expect(page.locator('.prize-unlocked')).toBeVisible();
    await expect(page.locator('.flight-overlay')).toHaveCount(0);
    const frames = await page.evaluate(() => (window as unknown as {flightFrames:{left:number;bottom:number;clear:boolean}[]}).flightFrames);
    await info.attach('projected-bounds', {body:JSON.stringify(frames),contentType:'application/json'});
    expect(frames.length).toBeGreaterThan(40);
    expect(frames.every(frame => frame.clear)).toBe(true);
    expect(frames.at(-1)!.left > 1 || frames.at(-1)!.bottom < 0).toBe(true);
    await page.waitForTimeout(1600); // Capture the settled, finite reward animation.
    await page.screenshot({path:info.outputPath('reward.png')});
    await page.keyboard.press('Escape');
    await expect(page.locator('.flight-overlay')).toHaveCount(0);
  });
}
