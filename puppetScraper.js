const puppeteer = require('puppeteer');
const fs = require('fs');

const randomDelay = (min, max) => { 
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
};

const humanScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = Math.floor(Math.random() * 100) + 100; 
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, Math.floor(Math.random() * 50) + 50); 
    });
  });
};

const randomMouseMovement = async (page) => {
  const width = page.viewport().width;
  const height = page.viewport().height;
  
  const x = Math.floor(Math.random() * width);
  const y = Math.floor(Math.random() * height);
  
  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
};

// ฟังก์ชันดึงเบอร์โทรศัพท์แบบปรับปรุง
const extractPhoneNumbers = (text) => {
  const phonePatterns = [
    /(\+66|0)?[\s-]?[689]\d{1}[\s-]?\d{3}[\s-]?\d{4}/g, // 08x-xxx-xxxx, 09x-xxx-xxxx
    /(\+66|0)?[\s-]?[2-9]\d{1}[\s-]?\d{3}[\s-]?\d{4}/g, // เบอร์บ้าน 02-xxx-xxxx
    /\d{3}[-\s]?\d{3}[-\s]?\d{4}/g, // xxx-xxx-xxxx
    /\d{2}[-\s]?\d{3}[-\s]?\d{4}/g, // xx-xxx-xxxx
  ];
  
  let phones = [];
  phonePatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    phones = phones.concat(matches);
  });
  
  // ทำความสะอาดและกรองเบอร์ที่ไม่ถูกต้อง
  phones = phones.map(phone => {
    return phone.replace(/[\s-]/g, ''); // ลบช่องว่างและขีด
  }).filter(phone => {
    // กรองเฉพาะเบอร์ที่มี 9-10 หลัก
    const digitOnly = phone.replace(/\+66/, '0');
    return digitOnly.length >= 9 && digitOnly.length <= 10;
  });
  
  return [...new Set(phones)]; // ลบเบอร์ซ้ำ
};

// ฟังก์ชันดึง LINE ID แบบปรับปรุง
const extractLineIds = (text) => {
  const linePatterns = [
    /(?:line|ไลน์|line\s*id|id|ไอดี)[\s:]*[@]?([a-zA-Z0-9._-]+)/gi,
    /@([a-zA-Z0-9._-]+)/g, // @username
    /id[\s:]*([a-zA-Z0-9._-]+)/gi,
  ];
  
  let lineIds = [];
  linePatterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    lineIds = lineIds.concat(matches.map(m => m[1]));
  });
  
  // กรอง LINE ID ที่ถูกต้อง
  lineIds = lineIds.filter(id => {
    if (!id) return false;
    // ต้องมีความยาว 4-30 ตัวอักษร
    if (id.length < 4 || id.length > 30) return false;
    // ไม่เอาคำทั่วไป
    const commonWords = ['line', 'chat', 'contact', 'inbox', 'message', 'ไลน์'];
    if (commonWords.includes(id.toLowerCase())) return false;
    // ไม่เอาตัวเลขเบอร์โทร
    if (/^\d{9,10}$/.test(id)) return false;
    return true;
  });
  
  return [...new Set(lineIds)];
};

// ฟังก์ชันดึงราคาแบบปรับปรุง
const extractPrices = (text) => {
  const pricePatterns = [
    /(\d{1,3}(?:,\d{3})*|\d+)[\s]*(?:บาท|฿|baht|บ\.)/gi,
    /(?:ราคา|price|ขาย)[\s:]*(\d{1,3}(?:,\d{3})*|\d+)/gi,
    /(\d{1,3}(?:,\d{3})*|\d+)[\s]*(?:-|บาท)/gi,
  ];
  
  let prices = [];
  pricePatterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    prices = prices.concat(matches.map(m => m[1]));
  });
  
  // แปลงเป็นตัวเลขและกรอง
  prices = prices.map(price => {
    const numPrice = parseInt(price.replace(/,/g, ''));
    return numPrice;
  }).filter(price => {
    // กรองเฉพาะราคาที่สมเหตุสมผล (50-100,000 บาท)
    return price >= 50 && price <= 100000;
  });
  
  return [...new Set(prices)];
};

// ฟังก์ชันดึงยี่ห้อเบียร์แบบปรับปรุง
const extractBeerBrands = (text) => {
  const brands = [
    'สิงห์', 'ช้าง', 'ลีโอ', 'leo', 'heineken', 'ไฮเนเก้น', 'corona', 'โคโรนา',
    'หมีขาว', 'carlsberg', 'คาร์ลส์เบิร์ก', 'tiger', 'ไทเกอร์', 'asahi', 'อาซาฮี',
    'budweiser', 'บัดไวเซอร์', 'hoegaarden', 'เฮอการ์เดน', 'stella', 'สเตลล่า',
    'guinness', 'กินเนส', 'peroni', 'เปโรนี', 'san miguel', 'ซานมิเกล',
    'tsingtao', 'ชิงเต่า', 'kirin', 'คิริน', 'sapporo', 'ซัปโปโร',
    'erdinger', 'เออดิงเงอร์', 'paulaner', 'เปาลาเนอร์', 'franziskaner', 'ฟรานซิสกาเนอร์'
  ];
  
  const lowerText = text.toLowerCase();
  const foundBrands = [];
  
  brands.forEach(brand => {
    if (lowerText.includes(brand.toLowerCase())) {
      // เอาเฉพาะรูปแบบที่อ่านง่าย
      if (brand === 'leo' || brand === 'tiger' || brand === 'asahi' || 
          brand === 'heineken' || brand === 'corona' || brand === 'budweiser') {
        foundBrands.push(brand.charAt(0).toUpperCase() + brand.slice(1));
      } else {
        foundBrands.push(brand);
      }
    }
  });
  
  return [...new Set(foundBrands)];
};

// ฟังก์ชันดึงพื้นที่แบบปรับปรุง
const extractLocations = (text) => {
  const provinces = [
    'กรุงเทพ', 'กทม', 'กรุงเทพมหานคร', 'bangkok',
    'สมุทรปราการ', 'นนทบุรี', 'ปทุมธานี', 'สมุทรสาคร', 'นครปฐม',
    'ชลบุรี', 'พัทยา', 'ระยอง', 'ฉะเชิงเทรา', 'สระแก้ว',
    'เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน',
    'ภูเก็ต', 'กระบี่', 'พังงา', 'สุราษฎร์ธานี', 'นครศรีธรรมราช',
    'ขอนแก่น', 'อุดรธานี', 'อุบลราชธานี', 'นครราชสีมา', 'โคราช',
    'อยุธยา', 'พระนครศรีอยุธยา', 'ลพบุรี', 'สิงห์บุรี', 'อ่างทอง',
    'หาดใหญ่', 'สงขลา', 'ปัตตานี', 'ยะลา', 'นราธิวาส'
  ];
  
  const foundLocations = [];
  provinces.forEach(province => {
    if (text.includes(province)) {
      foundLocations.push(province);
    }
  });
  
  // เช็ครูปแบบอำเภอ/ตำบล
  const districtPattern = /(?:อ\.|อำเภอ|ตำบล|ต\.)([ก-๙a-zA-Z]+)/g;
  const districtMatches = [...text.matchAll(districtPattern)];
  districtMatches.forEach(match => {
    if (match[1] && match[1].length > 2) {
      foundLocations.push(`อ.${match[1]}`);
    }
  });
  
  return [...new Set(foundLocations)];
};

async function scrapeFacebookGroup() {
  const browser = await puppeteer.launch({ 
    headless: false, 
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    executablePath: undefined
  });

  try {
    const page = await browser.newPage();
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      window.chrome = {
        runtime: {},
      };

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['th-TH', 'th', 'en-US', 'en'],
      });
    });
    
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    ];
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
    
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 }
    ];
    await page.setViewport(viewports[Math.floor(Math.random() * viewports.length)]);

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    console.log('🔐 กำลังเข้าสู่ระบบ Facebook...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    
    await randomMouseMovement(page);
    await randomDelay(2000, 3000);

    // *** ใส่ Email และ Password ของคุณที่นี่ ***
    const EMAIL = 'test.face112@gmail.com';
    const PASSWORD = 'passW@rd';
    
    await page.waitForSelector('#email', { timeout: 10000 });
    await randomMouseMovement(page);
    await page.click('#email');
    await randomDelay(500, 1000);
    
    for (const char of EMAIL) {
      await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
    }
    
    await randomDelay(300, 700);
    await page.click('#pass');
    await randomDelay(500, 1000);
    
    for (const char of PASSWORD) {
      await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
    }
    
    await randomDelay(500, 1500);
    await randomMouseMovement(page);
    await page.click('button[name="login"]');
    
    console.log('⏳ รอการเข้าสู่ระบบ...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay(3000, 5000);
    
    await randomMouseMovement(page);
    await page.evaluate(() => window.scrollBy(0, Math.random() * 200 + 100));

    // *** ใส่ URL ของกลุ่ม Facebook ที่นี่ ***
    const GROUP_URL = 'https://www.facebook.com/groups/YOUR_GROUP_ID/';
    
    console.log(`📱 กำลังเข้าสู่กลุ่ม: ${GROUP_URL}`);
    await page.goto(GROUP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay(3000, 5000);
    await randomMouseMovement(page);

    const allPosts = [];
    const maxScrollTimes = 10; // เพิ่มจำนวนครั้งการเลื่อน
    const maxNoNewPostsCount = 2;
    let noNewPostsCount = 0;
    let previousPostCount = 0;
    let previousScrollHeight = 0;

    console.log('📜 กำลังเลื่อนและดึงข้อมูลโพสต์...');
    
    for (let i = 0; i < maxScrollTimes; i++) {
      console.log(`   เลื่อนครั้งที่ ${i + 1}/${maxScrollTimes}`);
      
      await randomMouseMovement(page);
      await randomDelay(1000, 2000);
      
      const currentScrollHeight = await page.evaluate(() => document.body.scrollHeight);
      
      // ดึงข้อมูลโพสต์จากหน้าปัจจุบัน
      const posts = await page.evaluate(() => {
        const postElements = document.querySelectorAll('[role="article"]');
        const postsData = [];

        postElements.forEach((post, index) => {
          try {
            // ดึงข้อความในโพสต์
            let text = '';
            const textSelectors = [
              '[data-ad-comet-preview="message"]',
              '[data-ad-preview="message"]',
              'div[dir="auto"][style*="text-align"]',
              '[data-ad-rendering-role="message"]',
              '.x193iq5w.xeuugli',
              '[data-ad-comet-preview="message"] span',
              'div[data-ad-comet-preview="message"] div'
            ];
            
            for (const selector of textSelectors) {
              const elements = post.querySelectorAll(selector);
              if (elements.length > 0) {
                // รวมข้อความจากทุก element
                const textArray = Array.from(elements).map(el => el.innerText.trim()).filter(t => t.length > 0);
                if (textArray.length > 0) {
                  text = textArray.join(' ');
                  break;
                }
              }
            }

            // ถ้ายังไม่มี text ให้ลองดึงจาก innerText ของ post ทั้งหมด
            if (!text || text.length < 10) {
              const allText = post.innerText;
              if (allText && allText.length > 10) {
                text = allText;
              }
            }

            // ดึงชื่อผู้โพสต์
            let author = 'Unknown';
            const authorSelectors = [
              'a[role="link"] span',
              'h4 a span',
              'strong a span',
              'a[href*="/user/"] span',
              'a[href*="/profile.php"] span',
              '[data-ad-rendering-role="profile_name"]',
              '.x1i10hfl.xjbqb8w span',
              'h3 span',
              'h4 span'
            ];
            
            for (const selector of authorSelectors) {
              const elements = post.querySelectorAll(selector);
              if (elements.length > 0) {
                for (const el of elements) {
                  const name = el.innerText.trim();
                  if (name && name.length > 1 && !name.includes('•') && 
                      !name.includes('ชั่วโมง') && !name.includes('นาที') &&
                      !name.includes('วัน') && !name.includes('h') && !name.includes('m')) {
                    author = name;
                    break;
                  }
                }
                if (author !== 'Unknown') break;
              }
            }

            if (author === 'Unknown') {
              const linkWithAria = post.querySelector('a[aria-label]');
              if (linkWithAria) {
                const ariaLabel = linkWithAria.getAttribute('aria-label');
                if (ariaLabel && !ariaLabel.includes('เมนู') && !ariaLabel.includes('ตัวเลือก')) {
                  author = ariaLabel;
                }
              }
            }

            // ดึง Facebook Profile Link
            let authorProfileLink = '';
            const profileLinkSelectors = [
              'a[href*="/user/"]',
              'a[href*="/profile.php"]',
              'h4 a',
              'strong a'
            ];
            
            for (const selector of profileLinkSelectors) {
              const linkEl = post.querySelector(selector);
              if (linkEl && linkEl.href && (linkEl.href.includes('/user/') || linkEl.href.includes('/profile.php'))) {
                authorProfileLink = linkEl.href.split('?')[0];
                break;
              }
            }

            // ดึงลิงก์โพสต์
            let postLink = '';
            const linkSelectors = [
              'a[href*="/posts/"]',
              'a[href*="/permalink/"]',
              'a[href*="/groups/"][href*="/posts/"]'
            ];
            
            for (const selector of linkSelectors) {
              const linkElement = post.querySelector(selector);
              if (linkElement) {
                postLink = linkElement.href;
                break;
              }
            }

            // ดึงรูปภาพ
            let imageUrl = '';
            const imgElement = post.querySelector('img[src*="scontent"]');
            if (imgElement) {
              imageUrl = imgElement.src;
            }

            // ดึงเวลาโพสต์
            let postTime = 'ไม่ระบุ';
            const timeElements = post.querySelectorAll('span');
            for (const el of timeElements) {
              const timeText = el.innerText;
              if (timeText && (timeText.includes('ชั่วโมง') || timeText.includes('นาที') || 
                  timeText.includes('วัน') || timeText.includes('ปี') || timeText.includes('สัปดาห์') ||
                  timeText.includes('h') || timeText.includes('m') || timeText.includes('d') ||
                  timeText.includes('w') || timeText.includes('y'))) {
                postTime = timeText;
                break;
              }
            }

            // ดึงจำนวน reactions
            let reactions = 0;
            const reactionElements = post.querySelectorAll('[aria-label*="คน"], [aria-label*="people"]');
            for (const el of reactionElements) {
              const ariaLabel = el.getAttribute('aria-label');
              const match = ariaLabel.match(/(\d+)/);
              if (match) {
                reactions = parseInt(match[1]);
                break;
              }
            }

            // ดึงจำนวน comments
            let comments = 0;
            const commentElements = post.querySelectorAll('[aria-label*="ความคิดเห็น"], [aria-label*="comment"]');
            for (const el of commentElements) {
              const text = el.innerText || el.getAttribute('aria-label');
              const match = text.match(/(\d+)/);
              if (match) {
                comments = parseInt(match[1]);
                break;
              }
            }

            // เก็บข้อมูลถ้ามีข้อความมากกว่า 10 ตัวอักษร
            if (text.length > 10) {
              postsData.push({
                author,
                authorProfileLink,
                text,
                postLink,
                imageUrl,
                postTime,
                engagement: {
                  reactions: reactions,
                  comments: comments
                },
                rawTimestamp: new Date().toISOString()
              });
            }
          } catch (error) {
            console.error('Error parsing post:', error);
          }
        });

        return postsData;
      });

      // ประมวลผลข้อมูลด้วย Node.js (ฝั่ง server)
      posts.forEach(post => {
        // ใช้ฟังก์ชันที่ปรับปรุงแล้ว
        const phones = extractPhoneNumbers(post.text);
        const lineIds = extractLineIds(post.text);
        const prices = extractPrices(post.text);
        const beerBrands = extractBeerBrands(post.text);
        const locations = extractLocations(post.text);
        
        // ดึงวิธีการส่ง
        const deliveryMethods = [];
        const lowerText = post.text.toLowerCase();
        if (lowerText.includes('จัดส่ง') || lowerText.includes('ส่งได้') || 
            lowerText.includes('มีส่ง') || lowerText.includes('พร้อมส่ง') || 
            lowerText.includes('ส่งฟรี') || lowerText.includes('delivery')) {
          deliveryMethods.push('จัดส่ง');
        }
        if (lowerText.includes('นัดรับ') || lowerText.includes('รับเอง') || 
            lowerText.includes('มารับ') || lowerText.includes('pickup')) {
          deliveryMethods.push('นัดรับ');
        }
        
        // สร้าง object ข้อมูลที่สมบูรณ์
        const processedPost = {
          ...post,
          contact: {
            phones: phones,
            lineIds: lineIds,
            hasContact: phones.length > 0 || lineIds.length > 0
          },
          productInfo: {
            prices: prices,
            beerBrands: beerBrands,
            locations: locations,
            deliveryMethods: deliveryMethods
          },
          timestamp: new Date().toISOString()
        };
        
        // เช็คว่าโพสต์นี้มีอยู่แล้วหรือไม่
        const exists = allPosts.some(p => 
          p.text === processedPost.text && p.author === processedPost.author
        );
        
        if (!exists) {
          allPosts.push(processedPost);
          
          // แสดงข้อมูลที่ดึงได้
          console.log(`   ✓ ${processedPost.author.substring(0, 25)}...`);
          if (processedPost.contact.hasContact) {
            console.log(`     📞 ${phones.join(', ')} | 💬 ${lineIds.join(', ')}`);
          }
          if (prices.length > 0) {
            console.log(`     💰 ${prices.join(', ')} บาท`);
          }
          if (beerBrands.length > 0) {
            console.log(`     🍺 ${beerBrands.join(', ')}`);
          }
          if (locations.length > 0) {
            console.log(`     📍 ${locations.join(', ')}`);
          }
        }
      });

      // เช็คว่ามีโพสต์ใหม่หรือไม่
      if (allPosts.length === previousPostCount) {
        noNewPostsCount++;
        console.log(`   ⚠️ ไม่มีโพสต์ใหม่ (${noNewPostsCount}/${maxNoNewPostsCount})`);
      } else {
        noNewPostsCount = 0;
        console.log(`   ✅ รวม ${allPosts.length} โพสต์`);
      }

      previousPostCount = allPosts.length;

      if (noNewPostsCount >= maxNoNewPostsCount) {
        console.log('   🛑 ไม่มีโพสต์ใหม่แล้ว - หยุดเลื่อน');
        break;
      }

      if (previousScrollHeight > 0 && currentScrollHeight === previousScrollHeight) {
        console.log('   🛑 ถึงจุดสิ้นสุดของหน้าแล้ว');
        break;
      }

      previousScrollHeight = currentScrollHeight;

      await humanScroll(page);
      await randomDelay(3000, 6000);
      
      if (Math.random() > 0.7) {
        await page.evaluate(() => window.scrollBy(0, -Math.random() * 100));
        await randomDelay(1000, 2000);
      }

      const hasEndMessage = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return bodyText.includes('ไม่มีโพสต์เพิ่มเติม') || 
               bodyText.includes('no more posts') ||
               bodyText.includes('คุณดูโพสต์ทั้งหมดแล้ว');
      });

      if (hasEndMessage) {
        console.log('   🛑 พบข้อความแจ้งว่าไม่มีโพสต์แล้ว');
        break;
      }
    }

    console.log(`\n✅ ดึงข้อมูลได้ทั้งหมด ${allPosts.length} โพสต์`);

    // กรองโพสต์ที่เกี่ยวข้องกับเบียร์
    const beerKeywords = [
      'เบียร์', 'beer', 'ขายเบียร์', 'เบียร์นำเข้า', 'craft beer',
      'สิงห์', 'ช้าง', 'ลีโอ', 'heineken', 'corona', 'หมีขาว',
      'ส่งด่วน', 'จัดส่ง', 'มีส่ง', 'พร้อมส่ง', 'ราคา', 'บาท',
      'สั่งได้', 'สนใจ', 'inbox', 'ไลน์', 'ถัง', 'ลัง', 'ขวด'
    ];

    const beerPosts = allPosts.filter(post => {
      const lowerText = post.text.toLowerCase();
      return beerKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    });

    console.log(`🍺 พบโพสต์เกี่ยวกับเบียร์ ${beerPosts.length} โพสต์`);

    // คำนวณสถิติ
    const postsWithContact = beerPosts.filter(p => p.contact.hasContact).length;
    const postsWithPrice = beerPosts.filter(p => p.productInfo.prices.length > 0).length;
    const postsWithBrand = beerPosts.filter(p => p.productInfo.beerBrands.length > 0).length;
    const postsWithLocation = beerPosts.filter(p => p.productInfo.locations.length > 0).length;

    // สร้าง object ผลลัพธ์
    const results = {
      scrapedAt: new Date().toISOString(),
      groupUrl: GROUP_URL,
      totalPosts: allPosts.length,
      beerRelatedPosts: beerPosts.length,
      statistics: {
        withContact: postsWithContact,
        withPrice: postsWithPrice,
        withBrand: postsWithBrand,
        withLocation: postsWithLocation,
        completenessRate: Math.round((postsWithContact / beerPosts.length) * 100) || 0
      },
      posts: beerPosts
    };

    // บันทึกลงไฟล์
    const filename = `facebook_beer_posts_${new Date().getTime()}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`💾 บันทึกข้อมูลลงไฟล์: ${filename}`);

    // แสดงสถิติ
    console.log('\n📊 สถิติการดึงข้อมูล:');
    console.log(`   - โพสต์ทั้งหมด: ${allPosts.length}`);
    console.log(`   - โพสต์เกี่ยวกับเบียร์: ${beerPosts.length}`);
    console.log(`   - มีข้อมูลติดต่อ: ${postsWithContact}/${beerPosts.length} (${Math.round((postsWithContact/beerPosts.length)*100)}%)`);
    console.log(`   - มีราคา: ${postsWithPrice}/${beerPosts.length} (${Math.round((postsWithPrice/beerPosts.length)*100)}%)`);
    console.log(`   - มียี่ห้อ: ${postsWithBrand}/${beerPosts.length} (${Math.round((postsWithBrand/beerPosts.length)*100)}%)`);
    console.log(`   - มีพื้นที่: ${postsWithLocation}/${beerPosts.length} (${Math.round((postsWithLocation/beerPosts.length)*100)}%)`);

    // แสดงตัวอย่างโพสต์ที่มีข้อมูลครบ
    const completePosts = beerPosts.filter(p => 
      p.contact.hasContact && 
      p.productInfo.prices.length > 0 && 
      p.productInfo.locations.length > 0
    );

    if (completePosts.length > 0) {
      console.log(`\n🎯 พบโพสต์ที่มีข้อมูลครบถ้วน ${completePosts.length} โพสต์:`);
      completePosts.slice(0, 5).forEach((post, index) => {
        console.log(`\n--- โพสต์ที่ ${index + 1} ---`);
        console.log(`ผู้โพสต์: ${post.author}`);
        console.log(`เวลา: ${post.postTime}`);
        console.log(`ข้อความ: ${post.text.substring(0, 80)}...`);
        console.log(`📞 เบอร์: ${post.contact.phones.join(', ')}`);
        if (post.contact.lineIds.length > 0) {
          console.log(`💬 LINE: ${post.contact.lineIds.join(', ')}`);
        }
        console.log(`💰 ราคา: ${post.productInfo.prices.join(', ')} บาท`);
        if (post.productInfo.beerBrands.length > 0) {
          console.log(`🍺 ยี่ห้อ: ${post.productInfo.beerBrands.join(', ')}`);
        }
        console.log(`📍 พื้นที่: ${post.productInfo.locations.join(', ')}`);
        console.log(`🔗 ${post.postLink}`);
      });
    }

    // แสดงโพสต์ที่ขาดข้อมูลติดต่อ (สำหรับติดตามเพิ่มเติม)
    const incompletePosts = beerPosts.filter(p => !p.contact.hasContact && p.productInfo.prices.length > 0);
    if (incompletePosts.length > 0) {
      console.log(`\n⚠️  พบโพสต์ที่ขาดข้อมูลติดต่อ ${incompletePosts.length} โพสต์ (แนะนำติดตามเพิ่มเติม)`);
    }

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ เสร็จสิ้นการทำงาน');
  }
}

// เรียกใช้งาน
scrapeFacebookGroup().catch(console.error);