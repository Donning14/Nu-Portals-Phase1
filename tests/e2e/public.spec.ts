import {test,expect} from '@playwright/test';
test('public homepage has Nu-Portals brand and services',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:/From AI idea/i})).toBeVisible();await expect(page.getByRole('link',{name:'Services'})).toBeVisible()});
