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
    
    // Wait for redirect - could be onboarding or chat
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('Current URL after login:', page.url());
    
    // Handle onboarding if present
    if (page.url().includes('/onboarding')) {
      console.log('Onboarding page detected, completing...');
      // Look for continue/next/submit buttons
      const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next"), button:has-text("Submit"), button:has-text("Get Started"), button[type="submit"]').first();
      if (await continueBtn.count() > 0) {
        await continueBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        console.log('After onboarding:', page.url());
      }
    }
    
    // Step 2: Go to chat page
    console.log('Navigating to chat page...');
    await page.goto('https://mark-imti-web.onrender.com/chat', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    console.log('Chat page URL:', page.url());
    
    // Wait for chat UI to load - look for message list or input
    await page.waitForSelector('textarea, [contenteditable="true"], [data-testid="chat-input"]', { timeout: 30000 });
    
    // Step 3: Start a NEW chat - look for new chat button
    const newChatBtn = page.locator('button:has-text("New chat"), button:has-text("New Chat"), button[aria-label*="new" i], button[title*="new" i]').first();
    if (await newChatBtn.count() > 0) {
      console.log('Clicking New Chat button...');
      await newChatBtn.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('No New Chat button found, continuing with current chat...');
    }
    
    // Step 4: Find and type in the message input
    console.log('Finding message input...');
    // Try multiple selectors for the input
    const inputSelectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="chat" i]',
      'textarea[placeholder*="ask" i]',
      'textarea[data-testid="chat-input"]',
      '[contenteditable="true"][data-testid="chat-input"]',
      '[contenteditable="true"]',
      'textarea'
    ];
    
    let input = null;
    for (const selector of inputSelectors) {
      const el = page.locator(selector).first();
      if (await el.count() > 0) {
        input = el;
        console.log(`Found input with selector: ${selector}`);
        break;
      }
    }
    
    if (!input) {
      throw new Error('Could not find message input');
    }
    
    // Clear and type
    await input.click();
    await input.fill('What is the capital of France? Answer in one short sentence.');
    console.log('Typed question');
    
    // Step 5: Send the message - try Enter key or send button
    console.log('Sending message...');
    await page.keyboard.press('Enter');
    
    // Alternative: click send button if Enter doesn't work
    await page.waitForTimeout(1000);
    
    // Step 6: Wait for reply (up to 120 seconds for streaming)
    console.log('Waiting for assistant reply (up to 120s)...');
    
    let replyText = '';
    let found = false;
    let lastMessageCount = 0;
    
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(1000);
      
      // Look for all message elements
      const messageElements = await page.locator('[class*="message"], [data-testid*="message"], [role="log"] > *').all();
      
      if (messageElements.length > lastMessageCount) {
        lastMessageCount = messageElements.length;
        // Check the last message
        const lastMessage = messageElements[messageElements.length - 1];
        const text = await lastMessage.textContent();
        if (text && text.trim().length > 10) { // More than just "Paris"
          // Check if it's not our sent message
          if (!text.includes('What is the capital of France')) {
            replyText = text.trim();
            found = true;
            console.log(`Found reply at second ${i}: ${replyText.substring(0, 200)}`);
            break;
          }
        }
      }
      
      // Also check for streaming indicator
      const streaming = await page.locator('[class*="streaming"], [class*="typing"], [class*="loading"]').count();
      if (streaming === 0 && i > 10 && lastMessageCount > 0) {
        // Might be done streaming
        const lastMessage = messageElements[messageElements.length - 1];
        const text = await lastMessage.textContent();
        if (text && text.trim().length > 10 && !text.includes('What is the capital of France')) {
          replyText = text.trim();
          found = true;
          console.log(`Found reply after streaming stopped: ${replyText.substring(0, 200)}`);
          break;
        }
      }
      
      if (i % 10 === 0) {
        console.log(`  Waited ${i}s... (messages: ${lastMessageCount})`);
      }
    }
    
    console.log('\n=== CHAT REPLY ===');
    if (replyText) {
      console.log('REPLY:', replyText);
      
      // Categorize
      const lowerReply = replyText.toLowerCase();
      if (lowerReply.includes('paris')) {
        console.log('CATEGORY: (a) a real answer to the question');
      } else if (lowerReply.includes('provider') || lowerReply.includes('connected') || lowerReply.includes('error') || lowerReply.includes('fallback') || lowerReply.includes('no provider') || lowerReply.includes('not configured')) {
        console.log('CATEGORY: (b) an error/fallback notice saying no provider connected');
      } else {
        console.log('CATEGORY: (c) nothing at all / empty / spinning forever or unexpected');
      }
    } else {
      console.log('REPLY: (empty - no assistant message found after 120s)');
      console.log('CATEGORY: (c) nothing at all / empty / spinning forever');
    }
    
    // Take screenshot of chat
    await page.screenshot({ path: 'chat-reply.png', fullPage: true });
    console.log('\nChat screenshot saved to chat-reply.png');
    
    // Step 7: Check provider status at /ai
    console.log('\n=== CHECKING AI STUDIO / PROVIDER STATUS ===');
    await page.goto('https://mark-imti-web.onrender.com/ai', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // Look for provider status indicators
    const pageText = await page.textContent('body');
    console.log('AI Studio page content (first 5000 chars):');
    console.log(pageText.substring(0, 5000));
    
    // Search for key indicators
    const hasKeySaved = pageText.toLowerCase().includes('key saved');
    const hasConnected = pageText.toLowerCase().includes('connected');
    const hasProvider = pageText.toLowerCase().includes('provider');
    const hasNotSet = pageText.toLowerCase().includes('not set');
    
    console.log('\n=== PROVIDER STATUS ===');
    console.log('Has "Key saved":', hasKeySaved);
    console.log('Has "Connected":', hasConnected);
    console.log('Has "Provider":', hasProvider);
    console.log('Has "Not set":', hasNotSet);
    
    // Look for specific provider status elements
    const providerCards = await page.locator('[class*="provider"], [class*="card"]').all();
    console.log(`\nFound ${providerCards.length} provider cards`);
    
    for (let i = 0; i < Math.min(providerCards.length, 10); i++) {
      const text = await providerCards[i].textContent();
      if (text && (text.includes('Key') || text.includes('Connected') || text.includes('Not set') || text.includes('Save'))) {
        console.log(`Provider ${i}: ${text.trim().substring(0, 200)}`);
      }
    }
    
    await page.screenshot({ path: 'ai-studio.png', fullPage: true });
    console.log('\nAI Studio screenshot saved to ai-studio.png');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: 'chat-test-error.png', fullPage: true });
    console.log('Error screenshot saved to chat-test-error.png');
  } finally {
    await browser.close();
  }
}

testChat().catch(console.error);