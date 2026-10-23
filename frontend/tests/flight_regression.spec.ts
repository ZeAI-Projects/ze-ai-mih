import { test, expect } from '@playwright/test';

test('keyboard launch, mid-flight resize, escape and registration remain usable', async ({ page }) => {
  await page.goto('/#replay');
  await page.getByRole('button', { name: /Launch flight/ }).focus();
  await page.keyboard.press('Space');
  const canvas = page.locator('.flight-viewport canvas');
  await expect(canvas).toHaveAttribute('data-running', 'true');
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator('.flight-overlay')).toHaveCSS('width', '360px');
  await expect.poll(async () => Number(await canvas.getAttribute('data-progress'))).toBeGreaterThan(.1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Skip flight' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.flight-overlay')).toHaveCount(0);
  await expect(page.locator('.prize-unlocked')).toBeFocused();
  await page.getByRole('link', { name: /REGISTER FOR 2027/ }).click();
  await expect(page.locator('#register')).toBeInViewport();
});

test('touch swipe cancels short drags and launches once at the threshold', async ({ page, context }) => {
  await page.goto('/#replay');
  const track = page.locator('.flight-swipe');
  await track.scrollIntoViewIfNeeded();
  const rect = (await track.boundingBox())!;
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', {enabled:true});
  const swipe = async (distance:number) => {
    const x=rect.x+30,y=rect.y+rect.height/2;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let step=1;step<=8;step++) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+distance*step/8,y}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await swipe(25);
  await expect(page.locator('.flight-overlay')).toHaveCount(0);
  await expect(track.locator('progress')).toHaveAttribute('value','0');
  await swipe(rect.width-50);
  await expect(page.locator('.flight-viewport canvas')).toHaveCount(1);
  await page.getByRole('button',{name:'Skip flight'}).click();
  await expect(page.locator('.prize-unlocked')).toBeVisible();
});

test('curved nine-second flight keeps skyline static, exits and replays', async ({ page }, info) => {
  await page.goto('/#replay');
  await page.getByRole('button', { name: /Launch flight/ }).click();
  await expect(page.getByRole('dialog', { name: 'Flight to Kuala Lumpur' })).toBeVisible();
  const stage = await page.locator('.flight-overlay .flight-viewport').boundingBox();
  expect(stage!.width).toBe(page.viewportSize()!.width);
  const canvas = page.locator('.flight-viewport canvas');
  await expect(canvas).toHaveAttribute('data-running', 'true');
  const started = Date.now() - Number(await canvas.getAttribute('data-elapsed-ms'));
  const image = page.locator('.flight-city');
  const initial = await image.boundingBox();
  await page.evaluate(() => {
    const samples: {x:number;y:number;left:number;right:number;top:number;bottom:number;p:number}[] = [];
    (window as unknown as {flightSamples: typeof samples}).flightSamples = samples;
    const record = () => {
      const c = document.querySelector<HTMLCanvasElement>('.flight-viewport canvas');
      if (!c) return;
      if (c.dataset.bounds) samples.push({...JSON.parse(c.dataset.bounds),x:Number(c.dataset.screenX),y:Number(c.dataset.screenY),p:Number(c.dataset.progress)});
      requestAnimationFrame(record);
    }; record();
  });
  await expect.poll(async () => Number(await canvas.getAttribute('data-progress')), { intervals: [50], timeout: 8000 }).toBeGreaterThan(.62);
  expect(Number(await canvas.getAttribute('data-reveal'))).toBeGreaterThan(0);
  await expect(image).toHaveCSS('mask-image', 'none');
  await expect(image).toHaveCSS('opacity', '1');
  const bounds = JSON.parse((await canvas.getAttribute('data-bounds'))!);
  expect(bounds.bottom).toBeLessThan(.62);
  expect(await image.boundingBox()).toEqual(initial);
  await page.locator('.flight-viewport').screenshot({ path: info.outputPath('middle.png') });
  await expect(page.locator('.prize-unlocked')).toBeVisible({ timeout: 6000 });
  expect(Date.now() - started).toBeGreaterThan(8500);
  expect(Date.now() - started).toBeLessThan(11000);
  await expect(canvas).toHaveCount(0);
  const samples = await page.evaluate(() => (window as unknown as {flightSamples: {x:number;y:number;left:number;right:number;top:number;bottom:number;p:number}[]}).flightSamples);
  expect(samples.some(s => s.x < .25 && s.y > .3)).toBe(true);
  for (let i = 1; i < samples.length; i++) {
    expect(samples[i].x).toBeGreaterThanOrEqual(samples[i-1].x);
    expect(samples[i].y).toBeLessThanOrEqual(samples[i-1].y);
  }
  expect(samples.at(-1)!.left > 1 || samples.at(-1)!.bottom < 0).toBe(true);
  for (const s of samples) {
    const overlapsX = s.right > (initial!.x-stage!.x)/stage!.width && s.left < (initial!.x+initial!.width-stage!.x)/stage!.width;
    if (overlapsX && s.p > .62) expect(s.bottom).toBeLessThan((initial!.y-stage!.y)/stage!.height);
  }
  await expect(page.locator('.flight-overlay')).toHaveCount(0);
  await expect(page.locator('.prize-unlocked > strong')).toHaveCSS('animation-name', 'prize-boom');
  await page.waitForTimeout(500);
  await page.screenshot({ path: info.outputPath('prize-burst.png') });
  await page.waitForTimeout(1000);
  await expect(page.locator('.flight-city')).toHaveCSS('clip-path', 'none');
  await page.locator('.flight-viewport').screenshot({ path: info.outputPath('destination.png') });
  await page.getByRole('button', { name: /Replay flight/ }).click();
  await expect(canvas).toHaveAttribute('data-running', 'true');
  expect(Number(await canvas.getAttribute('data-reveal'))).toBe(1);
  await page.getByRole('button', { name: 'Skip flight' }).click();
  await expect(canvas).toHaveCount(0);
  await expect(page.locator('.flight-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.getByRole('link', { name: 'REGISTER FOR 2027 →' }).click();
  await expect(page).toHaveURL(/#register$/);
});

test('reduced motion and unavailable WebGL retain usable rewards', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#replay');
  await page.getByRole('button', { name: /Launch flight/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.prize-unlocked')).toContainText('₹20,00,000');
  await expect(page.locator('.flight-viewport canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.reload();
  await page.getByRole('button', { name: /Launch flight/ }).click();
  await expect(page.locator('.flight-status')).toContainText('3D is unavailable');
  await expect(page.locator('.flight-viewport canvas')).toHaveCount(0);
});
