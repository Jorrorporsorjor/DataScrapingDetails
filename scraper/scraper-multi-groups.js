const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');

class TaskQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.results = [];
    this.errors = [];
    this.status = 'idle'; 
  }

  async add(task, metadata = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        metadata,
        resolve,
        reject,
        retries: 0,
        maxRetries: 2
      });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.status = 'running';
    this.running++;
    const item = this.queue.shift();

    try {
      console.log(`\n🔄 [Queue] กำลังประมวลผล: ${item.metadata.name || 'Unknown'}`);
      console.log(`   📊 คงเหลือในคิว: ${this.queue.length} | กำลังทำงาน: ${this.running}`);
      
      const result = await item.task();
      
      this.results.push({
        metadata: item.metadata,
        result,
        success: true,
        timestamp: new Date().toISOString()
      });
      
      item.resolve(result);
      console.log(`✅ [Queue] สำเร็จ: ${item.metadata.name || 'Unknown'}`);
      
    } catch (error) {
      console.error(`❌ [Queue] ล้มเหลว: ${item.metadata.name || 'Unknown'}`);
      console.error(`   เหตุผล: ${error.message}`);
      
      if (item.retries < item.maxRetries) {
        item.retries++;
        console.log(`🔁 [Queue] ลองใหม่ครั้งที่ ${item.retries}/${item.maxRetries}`);
        this.queue.push(item);
      } else {
        this.errors.push({
          metadata: item.metadata,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        item.reject(error);
      }
    } finally {
      this.running--;
      this.process();
    }
  }

  async waitForCompletion() {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.status = 'completed';
  }

  isRunning() {
    return this.status === 'running' || this.running > 0 || this.queue.length > 0;
  }

  reset() {
    this.results = [];
    this.errors = [];
    this.status = 'idle';
  }

  getSummary() {
    return {
      total: this.results.length + this.errors.length,
      successful: this.results.length,
      failed: this.errors.length,
      successRate: ((this.results.length / (this.results.length + this.errors.length)) * 100).toFixed(2) + '%'
    };
  }
}

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

const extractPhoneNumbers = (text) => {
  const phonePatterns = [
    /(\+66|0)?[\s-]?[689]\d{1}[\s-]?\d{3}[\s-]?\d{4}/g,
    /(\+66|0)?[\s-]?[2-9]\d{1}[\s-]?\d{3}[\s-]?\d{4}/g,
    /\d{3}[-\s]?\d{3}[-\s]?\d{4}/g,
    /\d{2}[-\s]?\d{3}[-\s]?\d{4}/g,
  ];
  
  let phones = [];
  phonePatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    phones = phones.concat(matches);
  });
  
  phones = phones.map(phone => phone.replace(/[\s-]/g, ''))
    .filter(phone => {
      const digitOnly = phone.replace(/\+66/, '0');
      return digitOnly.length >= 9 && digitOnly.length <= 10;
    });
  
  return [...new Set(phones)];
};

const extractLineIds = (text) => {
  const linePatterns = [
    /(?:line|ไลน์|line\s*id|id|ไอดี)[\s:]*[@]?([a-zA-Z0-9._-]+)/gi,
    /@([a-zA-Z0-9._-]+)/g,
    /id[\s:]*([a-zA-Z0-9._-]+)/gi,
  ];
  
  let lineIds = [];
  linePatterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    lineIds = lineIds.concat(matches.map(m => m[1]));
  });
  
  lineIds = lineIds.filter(id => {
    if (!id) return false;
    if (id.length < 4 || id.length > 30) return false;
    const commonWords = ['line', 'chat', 'contact', 'inbox', 'message', 'ไลน์', 'ความคิดเห็น', 'ถูกใจ', 'แชร์'];
    if (commonWords.includes(id.toLowerCase())) return false;
    if (/^\d{9,10}$/.test(id)) return false;
    return true;
  });
  
  return [...new Set(lineIds)];
};

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
  
  prices = prices.map(price => parseInt(price.replace(/,/g, '')))
    .filter(price => price >= 50 && price <= 100000);
  
  return [...new Set(prices)];
};

const extractBeerBrands = (text) => {
  const brands = [
    'สิงห์', 'ช้าง', 'ลีโอ', 'leo', 'heineken', 'ไฮเนเก้น', 'corona', 'โคโรนา',
    'หมีขาว', 'carlsberg', 'คาร์ลส์เบิร์ก', 'tiger', 'ไทเกอร์', 'asahi', 'อาซาฮี',
    'budweiser', 'บัดไวเซอร์', 'hoegaarden', 'เฮอการ์เดน', 'stella', 'สเตลล่า',
    'guinness', 'กินเนส', 'peroni', 'เปโรนี', 'san miguel', 'ซานมิเกล'
  ];
  
  const lowerText = text.toLowerCase();
  const foundBrands = [];
  
  brands.forEach(brand => {
    if (lowerText.includes(brand.toLowerCase())) {
      if (['leo', 'tiger', 'asahi', 'heineken', 'corona', 'budweiser'].includes(brand)) {
        foundBrands.push(brand.charAt(0).toUpperCase() + brand.slice(1));
      } else {
        foundBrands.push(brand);
      }
    }
  });
  
  return [...new Set(foundBrands)];
};

const extractLocations = (text) => {
  const provinces = [
    'กรุงเทพ', 'กทม', 'กรุงเทพมหานคร', 'bangkok',
    'สมุทรปราการ', 'นนทบุรี', 'ปทุมธานี', 'สมุทรสาคร', 'นครปฐม',
    'ชลบุรี', 'พัทยา', 'ระยอง', 'ฉะเชิงเทรา', 'สระแก้ว',
    'เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน',
    'ภูเก็ต', 'กระบี่', 'พังงา', 'สุราษฎร์ธานี', 'นครศรีธรรมราช',
    'ขอนแก่น', 'อุดรธานี', 'อุบลราชธานี', 'นครราชสีมา', 'โคราช'
  ];
  
  const foundLocations = [];
  provinces.forEach(province => {
    if (text.includes(province)) {
      foundLocations.push(province);
    }
  });
  
  return [...new Set(foundLocations)];
};

const analyzeKeywords = (post) => {
  const foundKeywords = [];
  const lowerText = post.text.toLowerCase();
  
  const keywordGroups = {
    beer: ['เบียร์', 'beer', 'ขายเบียร์'],
    brands: ['สิงห์', 'ช้าง', 'ลีโอ', 'leo', 'heineken', 'ไฮเนเก้น', 'corona', 'โคโรนา', 
             'หมีขาว', 'carlsberg', 'tiger', 'asahi', 'budweiser', 'hoegaarden', 'stella', 
             'guinness', 'peroni', 'san miguel'],
    selling: ['ขาย', 'จำหน่าย', 'มีขาย', 'พร้อมส่ง', 'สั่งได้'],
    delivery: ['จัดส่ง', 'ส่งได้', 'พร้อมส่ง', 'delivery', 'นัดรับ', 'รับเอง', 'pickup'],
    price: ['ราคา', 'price', 'บาท', '฿', 'ถูก', 'ลดราคา', 'โปรโมชั่น', 'promotion'],
    contact: ['line', 'ไลน์', 'โทร', 'tel', 'สนใจ', 'inbox', 'dm']
  };
  
  for (const [category, keywords] of Object.entries(keywordGroups)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        foundKeywords.push({
          keyword: keyword,
          category: category
        });
      }
    }
  }
  
  return foundKeywords;
};

const extractPostsWithTimeout = async (page, timeout = 15000) => {
  try {
    const posts = await Promise.race([
      page.evaluate(() => {
        const postElements = Array.from(document.querySelectorAll('[role="article"]'));
        const postsToProcess = postElements.slice(0, 50);
        const postsData = [];
        
        const filterWords = [
          'ความรู้สึกทั้งหมด', 'ความคิดเห็น', 'ถูกใจ', 'แสดงความคิดเห็น', 
          'แชร์', 'ตอบกลับ', 'ส่งความคิดเห็น', 'เขียนคำตอบ', 'ดูความคิดเห็น',
          'ครั้ง', 'การตอบกลับ', 'รายการ', 'ผู้เขียน', 'ได้ตอบกลับ'
        ];

        postsToProcess.forEach((post) => {
          try {
            let text = '';
            
            const mainContent = post.querySelector('[data-ad-comet-preview="message"]');
            if (mainContent) {
              text = mainContent.innerText.trim();
            } else {
              const allDivs = post.querySelectorAll('div[dir="auto"]');
              let longestText = '';
              const divsArray = Array.from(allDivs).slice(0, 20);
              
              divsArray.forEach(div => {
                const divText = div.innerText.trim();
                const isUIText = filterWords.some(word => divText.includes(word));
                if (!isUIText && divText.length > longestText.length && divText.length > 20) {
                  longestText = divText;
                }
              });
              
              text = longestText;
            }

            const lines = text.split('\n').filter(line => {
              const trimmed = line.trim();
              if (trimmed.length < 10) return false;
              return !filterWords.some(word => trimmed.includes(word));
            });
            
            text = lines.join(' ').trim();

            if (!text || text.length < 20) return;

            let author = 'Unknown';
            const authorElement = post.querySelector('a[role="link"] span, h4 span, strong span');
            if (authorElement) {
              const name = authorElement.innerText.trim();
              if (name && name.length > 1 && !name.includes('•') && !name.includes('ชั่วโมง')) {
                author = name;
              }
            }

            let postLink = '';
            const linkElement = post.querySelector('a[href*="/posts/"], a[href*="/permalink/"]');
            if (linkElement) {
              postLink = linkElement.href;
            }

            let authorProfileLink = '';
            const profileElement = post.querySelector('a[href*="/user/"], a[href*="/profile.php"]');
            if (profileElement) {
              authorProfileLink = profileElement.href.split('?')[0];
            }

            let imageUrl = '';
            const imgElement = post.querySelector('img[src*="scontent"]');
            if (imgElement) {
              imageUrl = imgElement.src;
            }

            let postTime = 'ไม่ระบุ';
            const timeElements = Array.from(post.querySelectorAll('span')).slice(0, 10);
            for (const el of timeElements) {
              const timeText = el.innerText;
              if (timeText && (timeText.includes('ชั่วโมง') || timeText.includes('นาที') || 
                  timeText.includes('วัน') || timeText.includes('h') || timeText.includes('m'))) {
                postTime = timeText;
                break;
              }
            }

            if (text.length >= 20 && postLink) {
              postsData.push({
                author,
                authorProfileLink,
                text,
                postLink,
                imageUrl,
                postTime,
                rawTimestamp: new Date().toISOString()
              });
            }
          } catch (error) {
            // Skip problematic posts
          }
        });

        return postsData;
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Evaluation timeout')), timeout)
      )
    ]);
    
    return posts;
  } catch (error) {
    console.warn(`   ⚠️ Timeout ในการดึงข้อมูล: ${error.message}`);
    return [];
  }
};

async function scrapeGroupWithQueue(page, group, groupIndex, totalGroups, keywordStats) {
  const GROUP_URL = group.url;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📱 [${groupIndex + 1}/${totalGroups}] กำลังเข้าสู่กลุ่ม: ${group.name}`);
  console.log(`🔗 ${GROUP_URL}`);
  console.log('='.repeat(60));
  
  await page.goto(GROUP_URL, { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });
  await randomDelay(3000, 5000);

  try {
    await page.evaluate(() => {
      const closeButtons = document.querySelectorAll('[aria-label="ปิด"], [aria-label="Close"]');
      closeButtons.forEach(btn => btn.click());
    });
  } catch (e) {}

  const allPosts = [];
  const maxScrollTimes = 4;
  let previousPostCount = 0;
  let noNewPostsCount = 0;

  console.log('📜 กำลังเลื่อนและดึงข้อมูลโพสต์...');
  
  for (let i = 0; i < maxScrollTimes; i++) {
    console.log(`   เลื่อนครั้งที่ ${i + 1}/${maxScrollTimes}`);
    
    await randomDelay(2000, 3000);
    
    const posts = await extractPostsWithTimeout(page, 15000);

    posts.forEach(post => {
      const phones = extractPhoneNumbers(post.text);
      const lineIds = extractLineIds(post.text);
      const prices = extractPrices(post.text);
      const beerBrands = extractBeerBrands(post.text);
      const locations = extractLocations(post.text);
      
      const deliveryMethods = [];
      const lowerText = post.text.toLowerCase();
      if (lowerText.includes('จัดส่ง') || lowerText.includes('ส่งได้') || 
          lowerText.includes('พร้อมส่ง') || lowerText.includes('delivery')) {
        deliveryMethods.push('จัดส่ง');
      }
      if (lowerText.includes('นัดรับ') || lowerText.includes('รับเอง') || 
          lowerText.includes('pickup')) {
        deliveryMethods.push('นัดรับ');
      }
      
      const processedPost = {
        ...post,
        contact: {
          phones,
          lineIds,
          hasContact: phones.length > 0 || lineIds.length > 0
        },
        productInfo: {
          prices,
          beerBrands,
          locations,
          deliveryMethods
        },
        timestamp: new Date().toISOString()
      };
      
      const exists = allPosts.some(p => p.postLink === processedPost.postLink);
      
      if (!exists && processedPost.text.length >= 20) {
        allPosts.push(processedPost);
        
        console.log(`   ✓ ${processedPost.author.substring(0, 30)}...`);
        if (processedPost.contact.hasContact) {
          console.log(`     📞 ${phones.join(', ')} | 💬 ${lineIds.join(', ')}`);
        }
      }
    });

    if (allPosts.length === previousPostCount) {
      noNewPostsCount++;
      console.log(`   ⚠️ ไม่มีโพสต์ใหม่ (${noNewPostsCount}/2)`);
      if (noNewPostsCount >= 2) {
        console.log('   🛑 หยุดเลื่อน');
        break;
      }
    } else {
      noNewPostsCount = 0;
      console.log(`   ✅ รวม ${allPosts.length} โพสต์`);
    }

    previousPostCount = allPosts.length;

    await humanScroll(page);
    await randomDelay(2000, 4000);
  }

  console.log(`\n✅ ดึงข้อมูลได้ทั้งหมด ${allPosts.length} โพสต์จากกลุ่ม "${group.name}"`);

  const beerKeywords = [
    'เบียร์', 'beer', 'ขายเบียร์', 'สิงห์', 'ช้าง', 'ลีโอ', 'heineken', 'สุรา',
    'ตัวแทนจำหน่าย', 'ร้านขาย', 'ร้าน', 'ร้านค้า', 'ตัวแทน', 'จัดส่ง', 'delivery',
  ];

  const beerPosts = allPosts.filter(post => {
    const lowerText = post.text.toLowerCase();
    return beerKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  });

  beerPosts.forEach(post => {
    const keywords = analyzeKeywords(post);
    keywords.forEach(({ keyword, category }) => {
      if (!keywordStats[keyword]) {
        keywordStats[keyword] = {
          keyword: keyword,
          category: category,
          count: 0,
          groups: new Set(),
          examples: []
        };
      }
      keywordStats[keyword].count++;
      keywordStats[keyword].groups.add(group.name);
      
      if (keywordStats[keyword].examples.length < 3) {
        keywordStats[keyword].examples.push({
          author: post.author,
          preview: post.text.substring(0, 100) + '...',
          postLink: post.postLink,
          groupName: group.name
        });
      }
    });
  });

  console.log(`🍺 พบโพสต์เกี่ยวกับเบียร์ ${beerPosts.length} โพสต์`);

  const postsWithContact = beerPosts.filter(p => p.contact.hasContact).length;

  return {
    groupName: group.name,
    groupUrl: GROUP_URL,
    scrapedAt: new Date().toISOString(),
    totalPosts: allPosts.length,
    beerRelatedPosts: beerPosts.length,
    statistics: {
      withContact: postsWithContact,
      completenessRate: Math.round((postsWithContact / (beerPosts.length || 1)) * 100)
    },
    posts: beerPosts
  };
}

async function saveResults(queue, keywordStats) {
  const successfulResults = queue.results.map(r => r.result);
  const failedTasks = queue.errors;

  console.log('\n' + '='.repeat(60));
  console.log('📊 สรุปผลรวมทั้งหมด');
  console.log('='.repeat(60));
  
  const totalAllPosts = successfulResults.reduce((sum, g) => sum + g.totalPosts, 0);
  const totalBeerPosts = successfulResults.reduce((sum, g) => sum + g.beerRelatedPosts, 0);
  const totalWithContact = successfulResults.reduce((sum, g) => sum + g.statistics.withContact, 0);
  
  console.log(`✅ ดึงข้อมูลสำเร็จจาก ${successfulResults.length} กลุ่ม`);
  console.log(`📝 โพสต์ทั้งหมด: ${totalAllPosts}`);
  console.log(`🍺 โพสต์เกี่ยวกับเบียร์: ${totalBeerPosts}`);
  console.log(`📞 โพสต์ที่มีข้อมูลติดต่อ: ${totalWithContact}`);

  const queueSummary = queue.getSummary();
  const results = {
    scrapedAt: new Date().toISOString(),
    status: failedTasks.length === 0 ? 'complete' : 'partial',
    queue: {
      total: queueSummary.total,
      successful: queueSummary.successful,
      failed: queueSummary.failed,
      successRate: queueSummary.successRate
    },
    summary: {
      totalPosts: totalAllPosts,
      totalBeerPosts: totalBeerPosts,
      totalWithContact: totalWithContact
    },
    groups: successfulResults,
    failedGroups: failedTasks
  };

  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output');
  }

  fs.writeFileSync('./output/all_posts_data.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n💾 บันทึกข้อมูลลงไฟล์: ./output/all_posts_data.json`);

  const keywordData = Object.values(keywordStats)
    .map(stat => ({
      keyword: stat.keyword,
      category: stat.category,
      count: stat.count,
      groups: Array.from(stat.groups),
      groupCount: stat.groups.size,
      examples: stat.examples
    }))
    .sort((a, b) => b.count - a.count);

  const keywordResults = {
    generatedAt: new Date().toISOString(),
    totalKeywords: keywordData.length,
    totalOccurrences: keywordData.reduce((sum, k) => sum + k.count, 0),
    summary: {
      byCategory: {}
    },
    keywords: keywordData
  };

  keywordData.forEach(k => {
    if (!keywordResults.summary.byCategory[k.category]) {
      keywordResults.summary.byCategory[k.category] = {
        count: 0,
        keywords: []
      };
    }
    keywordResults.summary.byCategory[k.category].count += k.count;
    keywordResults.summary.byCategory[k.category].keywords.push(k.keyword);
  });

  fs.writeFileSync('./output/success_keyword.json', JSON.stringify(keywordResults, null, 2), 'utf-8');
  console.log(`💾 บันทึกข้อมูลคีย์เวิร์ดลงไฟล์: ./output/success_keyword.json`);
  
  console.log('\n🔑 คีย์เวิร์ดที่พบมากที่สุด (Top 10):');
  keywordData.slice(0, 10).forEach((k, i) => {
    console.log(`   ${i + 1}. "${k.keyword}" - ${k.count} ครั้ง (${k.groupCount} กลุ่ม) [${k.category}]`);
  });

  console.log('\n📞 สรุปข้อมูลติดต่อ:');
  const allContacts = {
    phones: new Set(),
    lineIds: new Set()
  };

  successfulResults.forEach(group => {
    group.posts.forEach(post => {
      post.contact.phones.forEach(phone => allContacts.phones.add(phone));
      post.contact.lineIds.forEach(lineId => allContacts.lineIds.add(lineId));
    });
  });

  console.log(`   📱 เบอร์โทรศัพท์ทั้งหมด: ${allContacts.phones.size}`);
  console.log(`   💬 Line ID ทั้งหมด: ${allContacts.lineIds.size}`);

  if (failedTasks.length > 0) {
    console.log('\n⚠️ กลุ่มที่ไม่สามารถดึงข้อมูลได้:');
    failedTasks.forEach((task, i) => {
      console.log(`   ${i + 1}. ${task.metadata.name}`);
      console.log(`      เหตุผล: ${task.error}`);
    });

    fs.writeFileSync(
      './output/failed_groups.json', 
      JSON.stringify(failedTasks, null, 2), 
      'utf-8'
    );
    console.log(`💾 บันทึกรายการกลุ่มที่ล้มเหลว: ./output/failed_groups.json`);
  }
}

async function scrapeCycle(page, queue) {
  console.log('\n' + '🔄'.repeat(30));
  console.log('🔄 เริ่มต้นรอบการดึงข้อมูลใหม่');
  console.log('🔄'.repeat(30));
  console.log(`⏰ เวลา: ${new Date().toLocaleString('th-TH')}\n`);

  queue.reset();
  
  let groups = [];
  try {
  console.log('🌐 กำลังโหลด groups.json จาก API...');
  const res = await axios.get('http://localhost:3000/app/groups.json');
  groups = res.data;
  groups = groups.slice(1);
  console.log(`📋 โหลดข้อมูล ${groups.length} กลุ่มจาก API`);
  groups.forEach((g, i) => console.log(`   ${i + 1}. ${g.name}`));
} catch (error) {
  console.error('❌ โหลด groups.json จาก API ไม่สำเร็จ:', error.message);
  return false;
}

  const keywordStats = {};

  console.log('\n🚀 เริ่มเพิ่มงานเข้า Queue');
  for (let i = 0; i < groups.length; i++) {
    queue.add(
      () => scrapeGroupWithQueue(page, groups[i], i, groups.length, keywordStats),
      { 
        name: groups[i].name,
        url: groups[i].url,
        index: i + 1,
        total: groups.length
      }
    );
  }

  console.log('⏳ รอให้ Queue ประมวลผลทุกกลุ่ม...\n');
  await queue.waitForCompletion();

  const queueSummary = queue.getSummary();
  console.log('\n' + '='.repeat(60));
  console.log('📊 สรุปผล Queue System');
  console.log('='.repeat(60));
  console.log(`✅ สำเร็จ: ${queueSummary.successful} กลุ่ม`);
  console.log(`❌ ล้มเหลว: ${queueSummary.failed} กลุ่ม`);
  console.log(`📈 อัตราความสำเร็จ: ${queueSummary.successRate}`);

  await saveResults(queue, keywordStats);

  console.log('\n✅ เสร็จสิ้นรอบการทำงานนี้');
  console.log('📁 ไฟล์ที่สร้าง:');
  console.log('   - ./output/all_posts_data.json');
  console.log('   - ./output/success_keyword.json');
  if (queue.errors.length > 0) {
    console.log('   - ./output/failed_groups.json');
  }

  return true;
}

async function waitAndLoop(seconds) {
  console.log(`\n⏱️  รอ ${seconds} วินาที ก่อนเริ่มรอบใหม่...`);
  for (let i = seconds; i > 0; i--) {
    if (i % 10 === 0 || i <= 5) {
      console.log(`   ⏰ เหลืออีก ${i} วินาที...`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function scrapeFacebookGroup() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
    ],
    protocolTimeout: 60000,
  });

  try {
    const page = await browser.newPage();
    
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['th-TH', 'th', 'en-US', 'en'] });
    });
    
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
    
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    console.log('🔐 กำลังเข้าสู่ระบบ Facebook...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    
    await randomMouseMovement(page);
    await randomDelay(2000, 3000);

    const EMAIL = 'test.face112@gmail.com';
    const PASSWORD = 'passW@rd';
    
    await page.waitForSelector('#email', { timeout: 10000 });
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
    await page.click('button[name="login"]');
    
    console.log('⏳ รอการเข้าสู่ระบบ...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay(3000, 5000);

    console.log('✅ เข้าสู่ระบบสำเร็จ!\n');

    const queue = new TaskQueue(1);

    let cycleCount = 1;
    while (true) {
      console.log(`\n${'🔁'.repeat(30)}`);
      console.log(`🔁 รอบที่ ${cycleCount}`);
      console.log('🔁'.repeat(30));

      if (queue.isRunning()) {
        console.log('⚠️  Queue กำลังทำงานอยู่ รอให้เสร็จก่อน...');
        await queue.waitForCompletion();
      }

      const success = await scrapeCycle(page, queue);

      if (!success) {
        console.log('❌ รอบนี้ล้มเหลว รอก่อนลองใหม่');
      }

      cycleCount++;

      await waitAndLoop(30);
    }

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดร้ายแรง:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ ปิดเบราว์เซอร์แล้ว');
  }
}

scrapeFacebookGroup().catch(console.error);