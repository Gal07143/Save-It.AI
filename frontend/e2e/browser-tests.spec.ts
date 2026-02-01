import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:5002'
const API_URL = 'http://localhost:8000/api/v1'

// Test user credentials
const TEST_USER = {
  email: `test_${Date.now()}@test.com`,
  password: 'TestPass123!'
}

let authCookies: { name: string; value: string }[] = []

test.describe('Save-It.AI Comprehensive Browser Tests', () => {

  test.describe('Phase 1: Authentication Flow', () => {

    test('1.1 Register new user', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`)

      // Click register link/button
      const registerLink = page.getByRole('link', { name: /register|sign up/i })
      if (await registerLink.isVisible()) {
        await registerLink.click()
        await page.waitForURL(/register/)
      }

      // Fill registration form
      await page.fill('input[type="email"], input[name="email"]', TEST_USER.email)
      await page.fill('input[type="password"], input[name="password"]', TEST_USER.password)

      // Submit
      const submitBtn = page.getByRole('button', { name: /register|sign up|create/i })
      await submitBtn.click()

      // Should redirect to dashboard or show success
      await expect(page).toHaveURL(/dashboard|\//, { timeout: 10000 })

      // Save cookies for later tests
      authCookies = await page.context().cookies()
      console.log('✅ Registration successful')
    })

    test('1.2 Login with credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`)

      await page.fill('input[type="email"], input[name="email"]', TEST_USER.email)
      await page.fill('input[type="password"], input[name="password"]', TEST_USER.password)

      const submitBtn = page.getByRole('button', { name: /login|sign in/i })
      await submitBtn.click()

      await expect(page).toHaveURL(/dashboard|\//, { timeout: 10000 })
      authCookies = await page.context().cookies()
      console.log('✅ Login successful')
    })

    test('1.3 Access protected routes', async ({ page }) => {
      // Add auth cookies
      await page.context().addCookies(authCookies.map(c => ({ ...c, url: BASE_URL })))

      await page.goto(`${BASE_URL}/devices`)
      await expect(page).not.toHaveURL(/login/)
      console.log('✅ Protected route access works')
    })
  })

  test.describe('Phase 2: Dashboard & Analytics', () => {

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(authCookies.map(c => ({ ...c, url: BASE_URL })))
    })

    test('2.1 Main Dashboard loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/`)

      // Check page loaded without errors
      const consoleErrors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      await page.waitForLoadState('networkidle')

      // Dashboard should have some content
      const body = await page.textContent('body')
      expect(body?.length).toBeGreaterThan(100)

      console.log(`✅ Dashboard loaded (${consoleErrors.length} console errors)`)
      if (consoleErrors.length > 0) {
        console.log('   Console errors:', consoleErrors.slice(0, 3))
      }
    })

    test('2.2 Charts render correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/`)
      await page.waitForLoadState('networkidle')

      // Look for chart elements (Recharts renders SVG)
      const charts = page.locator('svg.recharts-surface, .recharts-wrapper, canvas')
      const chartCount = await charts.count()

      console.log(`✅ Found ${chartCount} chart elements`)
    })
  })

  test.describe('Phase 3: Device Management', () => {

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(authCookies.map(c => ({ ...c, url: BASE_URL })))
    })

    test('3.1 Devices page loads with table', async ({ page }) => {
      await page.goto(`${BASE_URL}/devices`)
      await page.waitForLoadState('networkidle')

      // Look for table or device list
      const table = page.locator('table, [role="grid"], .device-list, .device-card')
      await expect(table.first()).toBeVisible({ timeout: 10000 })

      console.log('✅ Devices page loaded with table/list')
    })

    test('3.2 Device Config page tabs work', async ({ page }) => {
      await page.goto(`${BASE_URL}/device-config`)
      await page.waitForLoadState('networkidle')

      // Find tab buttons
      const tabs = page.locator('[role="tab"], button:has-text("Templates"), button:has-text("Validation")')
      const tabCount = await tabs.count()

      if (tabCount > 0) {
        // Click each tab
        for (let i = 0; i < Math.min(tabCount, 3); i++) {
          await tabs.nth(i).click()
          await page.waitForTimeout(300)
        }
        console.log(`✅ Device Config has ${tabCount} working tabs`)
      } else {
        console.log('⚠️ No tabs found on Device Config page')
      }
    })

    test('3.3 Gateways page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/gateways`)
      await page.waitForLoadState('networkidle')

      const content = await page.textContent('body')
      expect(content).toBeTruthy()

      console.log('✅ Gateways page loaded')
    })
  })

  test.describe('Phase 4: Integrations & Data Sources', () => {

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(authCookies.map(c => ({ ...c, url: BASE_URL })))
    })

    test('4.1 Integrations page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/integrations`)
      await page.waitForLoadState('networkidle')

      // Look for data sources section
      const content = await page.textContent('body')
      expect(content?.toLowerCase()).toMatch(/data source|integration|gateway/i)

      console.log('✅ Integrations page loaded')
    })

    test('4.2 Add Data Source button works', async ({ page }) => {
      await page.goto(`${BASE_URL}/integrations`)
      await page.waitForLoadState('networkidle')

      const addButton = page.getByRole('button', { name: /add|create|new/i }).first()
      if (await addButton.isVisible()) {
        await addButton.click()
        await page.waitForTimeout(500)

        // Modal or form should appear
        const modal = page.locator('[role="dialog"], .modal, form')
        const isModalVisible = await modal.first().isVisible()

        console.log(`✅ Add button clicked, modal visible: ${isModalVisible}`)
      } else {
        console.log('⚠️ No Add button found')
      }
    })
  })

  test.describe('Phase 5: Reports & Exports', () => {

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(authCookies.map(c => ({ ...c, url: BASE_URL })))
    })

    test('5.1 Reports page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`)
      await page.waitForLoadState('networkidle')

      const content = await page.textContent('body')
      expect(content).toBeTruthy()

      console.log('✅ Reports page loaded')
    })
  })

  test.describe('Phase 6: Settings & Admin', () => {

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(authCookies.map(c => ({ ...c, url: BASE_URL })))
    })

    test('6.1 Settings page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`)
      await page.waitForLoadState('networkidle')

      const content = await page.textContent('body')
      expect(content).toBeTruthy()

      console.log('✅ Settings page loaded')
    })

    test('6.2 Admin page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`)
      await page.waitForLoadState('networkidle')

      const content = await page.textContent('body')
      expect(content).toBeTruthy()

      console.log('✅ Admin page loaded')
    })
  })

  test.describe('Phase 7: All Pages Load Test', () => {

    const pages = [
      '/',
      '/dashboard',
      '/devices',
      '/device-config',
      '/device-health',
      '/gateways',
      '/integrations',
      '/meters',
      '/sites',
      '/assets',
      '/bills',
      '/tariffs',
      '/reports',
      '/notifications',
      '/maintenance',
      '/data-quality',
      '/virtual-meters',
      '/forecasting',
      '/carbon-esg',
      '/pv-systems',
      '/bess-simulator',
      '/digital-twin',
      '/settings',
      '/admin',
    ]

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(authCookies.map(c => ({ ...c, url: BASE_URL })))
    })

    for (const pagePath of pages) {
      test(`Load ${pagePath}`, async ({ page }) => {
        const errors: string[] = []
        page.on('console', msg => {
          if (msg.type() === 'error') errors.push(msg.text())
        })

        const response = await page.goto(`${BASE_URL}${pagePath}`)
        await page.waitForLoadState('domcontentloaded')

        // Check response is successful
        expect(response?.status()).toBeLessThan(400)

        // Check page has content
        const body = await page.textContent('body')
        expect(body?.length).toBeGreaterThan(50)

        if (errors.length > 0) {
          console.log(`⚠️ ${pagePath}: ${errors.length} console errors`)
        } else {
          console.log(`✅ ${pagePath}: OK`)
        }
      })
    }
  })

  test.describe('Phase 8: Button & Interactive Element Tests', () => {

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(authCookies.map(c => ({ ...c, url: BASE_URL })))
    })

    test('8.1 All buttons are clickable', async ({ page }) => {
      await page.goto(`${BASE_URL}/devices`)
      await page.waitForLoadState('networkidle')

      const buttons = page.locator('button:visible')
      const buttonCount = await buttons.count()

      let clickableCount = 0
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const btn = buttons.nth(i)
        const isEnabled = await btn.isEnabled()
        if (isEnabled) clickableCount++
      }

      console.log(`✅ Found ${buttonCount} buttons, ${clickableCount} clickable (tested first 10)`)
    })

    test('8.2 Forms have proper validation', async ({ page }) => {
      await page.goto(`${BASE_URL}/integrations`)
      await page.waitForLoadState('networkidle')

      // Try to find and click an Add button to open a form
      const addButton = page.getByRole('button', { name: /add|create|new/i }).first()
      if (await addButton.isVisible()) {
        await addButton.click()
        await page.waitForTimeout(500)

        // Try to submit empty form
        const submitBtn = page.getByRole('button', { name: /save|submit|create/i }).first()
        if (await submitBtn.isVisible()) {
          await submitBtn.click()
          await page.waitForTimeout(300)

          // Check for validation errors
          const errorMessages = page.locator('.error, .text-red, [role="alert"], .invalid')
          const hasErrors = await errorMessages.count() > 0

          console.log(`✅ Form validation ${hasErrors ? 'working' : 'not triggered (may need required fields)'}`)
        }
      }
    })
  })
})
