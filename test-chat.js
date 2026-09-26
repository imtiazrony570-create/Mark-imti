const { chromium } = require('playwright');

async function testChat() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  page.on('console', msg => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[ERROR] ${err.message}`));

  try {
    // Step 1: Go to login page
    console.log('Navigating to login page...');
    await page.goto('https://mark-imti-web.onrender.com/auth/login?redirect=%2F', { 
      waitUntil: 'networkidle',
      timeout: 120000 
    });
    
    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
    
    // Fill login form
    console.log('Filling login form...');
    await page.fill('input[type="email"], input[name="email"]', 'kevin.clientmanager@gmail.com');
    await page.fill('input[type="password"], input[name="password"]', 'Masteradmin');
    
    // Submit login
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    
    // Wait for redirect to chat or dashboard
    await page.waitForURL('**/chat**', { timeout: 60000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
    
    console.log('Current URL:', page.url());
    
    // Step 2: Go to chat page if not already there
    if (!page.url().includes('/chat')) {
      console.log('Navigating to chat page...');
      await page.goto('https://mark-imti-web.onrender.com/chat', { waitUntil: 'networkidle', timeout: 60000 });
    }
    
    // Wait for chat UI to load
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="message"], textarea[placeholder*="chat"], textarea', { timeout: 30000 });
    
    // Step 3: Start a NEW chat - look for new chat button
    const newChatBtn = page.locator('button:has-text("New chat"), button:has-text("New Chat"), [aria-label*="new chat" i]').first();
    if (await newChatBtn.count() > 0) {
      console.log('Clicking New Chat button...');
      await newChatBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Step 4: Type the question
    console.log('Typing question...');
    const input = page.locator('[data-testid="chat-input"], textarea[placeholder*="message"], textarea[placeholder*="chat"], textarea').first();
    await input.fill('What is the capital of France? Answer in one short sentence.');
    
    // Step 5: Send the message
    console.log('Sending message...');
    await page.keyboard.press('Enter');
    
    // Step 6: Wait for reply (up to 90 seconds)
    console.log('Waiting for assistant reply...');
    
    // Wait for assistant message to appear
    // Look for the assistant message bubble
    const assistantMessage = page.locator('[data-testid="assistant-message"], [data-role="assistant"], .assistant-message, .message-assistant, [class*="assistant"]').first();
    
    // Also try generic selectors
    const messageSelectors = [
      '[data-testid="assistant-message"]',
      '[data-role="assistant"]',
      '.assistant-message',
      '.message-assistant',
      '[class*="assistant"]',
      'div[class*="message"]:last-child',
      '[class*="chat-message"]:last-child'
    ];
    
    let replyText = '';
    let found = false;
    
    for (let i = 0; i < 90; i++) {
      await page.waitForTimeout(1000);
      
      // Check for any new message that looks like an assistant reply
      for (const selector of messageSelectors) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          const text = await lastElement.textContent();
          if (text && text.trim().length > 0) {
            // Check if this looks like an assistant message (not our sent message)
            if (!text.includes('What is the capital of France')) {
              replyText = text.trim();
              found = true;
              break;
            }
          }
        }
      }
      if (found) break;
      
      // Also check for streaming/loading indicators
      const loading = await page.locator('[class*="loading"], [class*="spinner"], [class*="typing"]').count();
      if (loading === 0 && i > 5) {
        // No loading indicator, might be done
      }
    }
    
    console.log('\n=== CHAT REPLY ===');
    if (replyText) {
      console.log('REPLY:', replyText);
      
      // Categorize
      if (replyText.toLowerCase().includes('paris')) {
        console.log('CATEGORY: (a) a real answer to the question');
      } else if (replyText.toLowerCase().includes('provider') || replyText.toLowerCase().includes('connected') || replyText.toLowerCase().includes('error') || replyText.toLowerCase().includes('fallback') || replyText.toLowerCase().includes('no provider')) {
        console.log('CATEGORY: (b) an error/fallback notice saying no provider connected');
      } else {
        console.log('CATEGORY: (c) nothing at all / empty / spinning forever or unexpected');
      }
    } else {
      console.log('REPLY: (empty - no assistant message found)');
      console.log('CATEGORY: (c) nothing at all / empty / spinning forever');
    }
    
    // Step 7: Check provider status at /ai
    console.log('\n=== CHECKING AI STUDIO / PROVIDER STATUS ===');
    await page.goto('https://mark-imti-web.onrender.com/ai', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // Look for provider status indicators
    const pageText = await page.textContent('body');
    console.log('AI Studio page content (first 3000 chars):');
    console.log(pageText.substring(0, 3000));
    
    // Search for key indicators
    const hasKeySaved = pageText.toLowerCase().includes('key saved');
    const hasConnected = pageText.toLowerCase().includes('connected');
    const hasProvider = pageText.toLowerCase().includes('provider');
    
    console.log('\n=== PROVIDER STATUS ===');
    console.log('Has "Key saved":', hasKeySaved);
    console.log('Has "Connected":', hasConnected);
    console.log('Has "Provider":', hasProvider);
    
    // Take screenshot for reference
    await page.screenshot({ path: 'chat-test-result.png', fullPage: true });
    console.log('\nScreenshot saved to chat-test-result.png');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: 'chat-test-error.png', fullPage: true });
    console.log('Error screenshot saved to chat-test-error.png');
  } finally {
    await browser.close();
  }
}

testChat().catch(console.error);