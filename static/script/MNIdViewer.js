const urls = {
    "ItemBlock": {url: "https://ksimg.dpdns.org/?file=data/MNItem.json", imgUrl: "https://ksimg.dpdns.org/?file=img/icon/item/", categoryName: "物品"},
    "Buff": {url: "https://ksimg.dpdns.org/?file=data/MNBuff.json", imgUrl: "https://ksimg.dpdns.org/?file=img/icon/buff/", categoryName: "状态"}
    // img: imgURL/{id}.png，若没有使用https://ksimg.dpdns.org/?file=img/icon/nil.png
    // 不提供imgURL请在imgURL键写: null
}; // 数据URL字典，支持多个URL。每个条目格式：categoryKey: {url, imgUrl， categoryName}
// categoryKey 会写入每条记录的 item.Category，用于筛选
// categoryName 用于在选项卡中显示名称

// 由 urls 构建的映射：key -> 显示名称，用于卡片中展示及其他用途
const categoryNames = Object.fromEntries(Object.entries(urls).map(([key, value]) => [key, value.categoryName]));
const ITEMS_PER_PAGE = 24; // 每页显示24个物品

// 缓存配置
const CACHE_KEY = 'itemDataCache';
const CACHE_DURATION = 7200000; // 缓存有效时间：2小时（7200000毫秒）
const LAST_UPDATE_KEY = 'itemDataLastUpdate';

// 全局状态变量
let itemsData = []; // 原始数据
let filteredItems = []; // 当前筛选后的数据
let currentPage = 1; // 当前页码
let totalPages = 1; // 总页数
// 默认选中第一个URL的分类
let currentCategory = Object.keys(urls)[0] || '';
let searchTerm = ''; // 当前搜索词

// 缓存相关函数
function getCachedData() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        const lastUpdate = localStorage.getItem(LAST_UPDATE_KEY);

        if (!cached || !lastUpdate) {
            console.log('无缓存数据');
            return null;
        }

        const now = Date.now();
        const lastUpdateTime = parseInt(lastUpdate, 10);
        const cacheAge = now - lastUpdateTime;

        if (cacheAge > CACHE_DURATION) {
            console.log(`缓存已过期，缓存时间: ${Math.round(cacheAge/1000/60)}分钟前`);
            clearCache(); // 清除过期缓存
            return null;
        }

        console.log(`使用缓存数据，缓存时间: ${Math.round(cacheAge/1000/60)}分钟前`);
        return JSON.parse(cached);
    } catch (error) {
        console.error('读取缓存失败:', error);
        clearCache(); // 如果缓存数据损坏，清除它
        return null;
    }
}

function saveToCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(LAST_UPDATE_KEY, Date.now().toString());
        console.log('数据已保存到缓存');
    } catch (error) {
        console.error('保存缓存失败:', error);
        // 如果存储失败，可能是存储空间不足，清除一些旧缓存
        clearCache();
    }
}

function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(LAST_UPDATE_KEY);
    console.log('缓存已清除');
}

// 添加清除缓存按钮到UI
function addCacheControls() {
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) return;

    const cacheControl = document.createElement('div');
    cacheControl.className = 'cache-controls';
    cacheControl.innerHTML = `
        <button id="clearCacheBtn" class="clear-cache-btn" title="清除缓存并重新获取数据">
            <i class="fas fa-sync-alt"></i> 刷新数据
        </button>
        <span id="cacheStatus" class="cache-status">
            <i class="fas fa-database"></i> 已缓存
        </span>
    `;

    headerControls.appendChild(cacheControl);

    // 绑定清除缓存按钮事件
    document.getElementById('clearCacheBtn').addEventListener('click', async function() {
        if (confirm('确定要清除缓存并重新获取最新数据吗？')) {
            clearCache();

            // 显示加载状态
            const itemsGrid = document.getElementById('itemsGrid');
            itemsGrid.innerHTML = '<div class="loading"><i class="fas fa-sync fa-spin"></i> 正在获取最新数据...</div>';

            // 更新缓存状态显示
            const cacheStatus = document.getElementById('cacheStatus');
            cacheStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> 获取中...';
            cacheStatus.className = 'cache-status loading';

            // 禁用按钮防止重复点击
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-sync fa-spin"></i> 获取中...';

            try {
                // 重新获取数据
                itemsData = await fetchData();
                filteredItems = [...itemsData];
                applyFilters();

                // 更新缓存状态
                cacheStatus.innerHTML = '<i class="fas fa-database"></i> 已更新';
                cacheStatus.className = 'cache-status';

                // 显示成功提示
                showMessage('数据已成功更新！', 'success');
            } catch (error) {
                cacheStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 获取失败';
                cacheStatus.className = 'cache-status error';
                showMessage('数据更新失败，请检查网络连接', 'error');
            } finally {
                // 恢复按钮状态
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新数据';
            }
        }
    });

    // 更新缓存状态显示
    updateCacheStatus();
}

function updateCacheStatus() {
    const cacheStatus = document.getElementById('cacheStatus');
    if (!cacheStatus) return;

    const lastUpdate = localStorage.getItem(LAST_UPDATE_KEY);
    if (!lastUpdate) {
        cacheStatus.innerHTML = '<i class="fas fa-times-circle"></i> 无缓存';
        cacheStatus.className = 'cache-status no-cache';
        return;
    }

    const now = Date.now();
    const lastUpdateTime = parseInt(lastUpdate, 10);
    const cacheAge = now - lastUpdateTime;
    const minutes = Math.floor(cacheAge / 60000);
    const hours = Math.floor(minutes / 60);

    let statusText = '已缓存';
    if (minutes < 1) {
        statusText = '刚刚更新';
    } else if (hours < 1) {
        statusText = `${minutes}分钟前`;
    } else {
        statusText = `${hours}小时前`;
    }

    cacheStatus.innerHTML = `<i class="fas fa-database"></i> ${statusText}`;
    cacheStatus.className = 'cache-status';

    // 如果缓存即将过期（剩下不到5分钟），显示警告
    if (cacheAge > CACHE_DURATION - 300000) { // 300000ms = 5分钟
        cacheStatus.className = 'cache-status warning';
    }
}

function showMessage(message, type = 'info') {
    // 移除现有的消息
    const existingMsg = document.querySelector('.message-toast');
    if (existingMsg) {
        existingMsg.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast ${type}`;
    messageDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(messageDiv);

    // 显示消息
    setTimeout(() => {
        messageDiv.classList.add('show');
    }, 10);

    // 3秒后自动隐藏
    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 300);
    }, 3000);
}

async function getData() {
    // 首先尝试从缓存获取数据
    const cachedData = getCachedData();
    if (cachedData) {
        console.log('从缓存加载数据');
        updateCacheStatus(); // 更新缓存状态显示
        return cachedData;
    }

    console.log('缓存不存在或已过期，从网络获取数据');

    // 如果没有缓存或缓存过期，从网络获取
    const freshData = await fetchData();
    return freshData;
}

async function fetchData() {
    let allItemData = [];

    try {
        // 循环获取每个URL的数据
        for (const [categoryKey, {url: apiUrl, categoryName}] of Object.entries(urls)) {
            console.log(`正在获取数据: ${apiUrl}`);

            const response = await fetch(apiUrl);

            if (!response.ok) {
                console.warn(`URL ${apiUrl} 响应错误: ${response.status}，跳过此URL`);
                continue; // 跳过失败的URL，继续下一个
            }

            let itemData = await response.json();
            console.log(`从 ${apiUrl} 获取到 ${itemData?.length || 0} 条记录`);

            // 如果数据是数组，先为每条记录添加分类字段，然后合并
            if (Array.isArray(itemData)) {
                itemData.forEach(item => {
                    if (categoryKey) {
                        item.Category = categoryKey;
                    }
                });
                allItemData = allItemData.concat(itemData);
            } else {
                console.warn(`从 ${apiUrl} 获取的数据不是数组格式，已跳过`);
            }
        }

        // 去重：根据ID去重，保留第一个出现的
        const seenIds = new Set();
        allItemData = allItemData.filter(item => {
            const id = item.ID || item.id;
            if (id && !seenIds.has(id)) {
                seenIds.add(id);
                return true;
            }
            return false;
        });

        console.log("合并并去重后，共", allItemData.length, "条记录");

        // 保存到缓存
        if (allItemData && allItemData.length > 0) {
            saveToCache(allItemData);
            updateCacheStatus(); // 更新缓存状态显示
        }

        return allItemData;
    } catch (error) {
        console.error('获取数据失败:', error);

        // 即使网络请求失败，也尝试从可能已过期的缓存中获取
        const expiredCache = localStorage.getItem(CACHE_KEY);
        if (expiredCache) {
            console.log('网络请求失败，使用已过期的缓存数据');
            showMessage('使用缓存数据（可能不是最新）', 'warning');
            return JSON.parse(expiredCache);
        }

        return []; // 返回空数组
    }
}

// 解析颜色代码的函数
function parseColorText(text) {
    return text.replace(/#([0-9a-fA-F]{7})(.+?)#n/g, function(match, color, content) {
        // 取前6位作为颜色码，最后一位忽略
        const validColor = color.substring(0, 6);
        return '<span style="color: #' + validColor + ';">' + content + '</span>';
    });
}

// 动态渲染物品卡片的函数
function renderItems(itemsArray, page = 1) {
    const itemsGrid = document.getElementById('itemsGrid');
    if (!itemsGrid) {
        console.error('找不到itemsGrid元素');
        return;
    }

    // 清空现有内容
    itemsGrid.innerHTML = '';

    // 检查是否有数据
    if (!itemsArray || itemsArray.length === 0) {
        itemsGrid.innerHTML = '<div class="no-data">暂无物品数据</div>';
        // 重置分页信息
        updatePageInfo(0, 1, false);
        return;
    }

    // 获取当前分类的imgUrl
    const imgUrl = urls[currentCategory]?.imgUrl;
    const hasImg = imgUrl !== null && imgUrl !== undefined;

    // 根据是否有imgUrl调整grid布局
    if (hasImg) {
        itemsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(174px, 1fr))';
    } else {
        itemsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    }

    // 计算分页起始和结束位置
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, itemsArray.length);

    // 获取当前页的物品
    const currentPageItems = itemsArray.slice(startIndex, endIndex);

    // 使用文档片段减少 DOM 重排
    const fragment = document.createDocumentFragment();

    // 遍历当前页数据数组，为每个物品创建卡片
    for (const item of currentPageItems) {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        // 存储分类用于筛选
        itemCard.setAttribute('data-category', item.Category || '');
        // 存储ID，便于复制功能使用
        itemCard.setAttribute('data-id', item.id || item.ID);
        itemCard.title = "点击复制ID"; // 添加悬停提示

        // 尝试获取类别的显示名称
        const displayCat = categoryNames[item.Category] || '';

        // 根据是否有imgUrl决定是否显示图片和隐藏desc
        let imgHtml = '';
        let descStyle = '';
        if (hasImg) {
            // 若 ID 不存在则使用占位图（nil.png）避免访问不合法 URL
            const iconId = item.id || item.ID;
            const imgSrc = iconId ? `${imgUrl}${iconId}.png` : `${imgUrl}nil.png`;
            imgHtml = `<img src="${imgSrc}" alt="icon" class="item-icon" loading="lazy" decoding="async" onerror="this.src='https://ksimg.dpdns.org/?file=img/icon/nil.png'">`;
            descStyle = 'style="display: none;"';
        }

        // 填充卡片内部HTML结构
        itemCard.innerHTML = `
            <div class="item-header">
                <span class="item-id"><i class="fas fa-hashtag"></i> ID: ${item.id || 'N/A'}</span>
                <span class="item-category">${displayCat}</span>
            </div>
            <h3 class="item-name">${item.name || '未命名物品'}</h3>
            ${imgHtml}
            <p class="item-desc" ${descStyle}>${parseColorText(item.desc || '暂无描述')}</p>
        `;

        // 为当前卡片绑定点击复制ID的事件
        itemCard.addEventListener('click', function(event) {
            // 阻止事件冒泡，避免与可能存在的父元素事件冲突
            event.stopPropagation();

            const idToCopy = this.getAttribute('data-id');
            if (!idToCopy) return;

            // 使用现代剪贴板API
            navigator.clipboard.writeText(idToCopy).then(() => {
                // 复制成功：提供视觉反馈
                this.style.borderColor = '#10b981'; // 成功绿色
                this.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.4)';

                // 短暂改变ID显示文本
                const idElement = this.querySelector('.item-id');
                if (idElement) {
                    const originalText = idElement.textContent;
                    idElement.innerHTML = '<i class="fas fa-check"></i> ID已复制!';
                    idElement.style.color = '#10b981';

                    setTimeout(() => {
                        idElement.innerHTML = `<i class="fas fa-hashtag"></i> ID: ${idToCopy}`;
                        idElement.style.color = '';
                        this.style.borderColor = '';
                        this.style.boxShadow = '';
                    }, 1500);
                }

            }).catch(err => {
                console.error('剪贴板API失败: ', err);

                // 降级方案：使用document.execCommand
                const textArea = document.createElement('textarea');
                textArea.value = idToCopy;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();

                try {
                    const success = document.execCommand('copy');
                    document.body.removeChild(textArea);

                    if (success) {
                        // 降级方案成功，同样提供视觉反馈
                        this.style.borderColor = '#10b981';
                        this.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.4)';

                        const idElement = this.querySelector('.item-id');
                        if (idElement) {
                            const originalText = idElement.textContent;
                            idElement.innerHTML = '<i class="fas fa-check"></i> ID已复制!';
                            idElement.style.color = '#10b981';

                            setTimeout(() => {
                                idElement.innerHTML = `<i class="fas fa-hashtag"></i> ID: ${idToCopy}`;
                                idElement.style.color = '';
                                this.style.borderColor = '';
                                this.style.boxShadow = '';
                            }, 1500);
                        }
                    } else {
                        alert(`复制失败，物品ID为: ${idToCopy}，请手动复制。`);
                    }
                } catch (err) {
                    console.error('降级复制失败: ', err);
                    alert(`复制失败，物品ID为: ${idToCopy}，请手动复制。`);
                }
            });
        });

        fragment.appendChild(itemCard);
    }

    itemsGrid.appendChild(fragment);

    // 更新页面信息
    updatePageInfo(itemsArray.length, page, true);

    // 更新分页控件
    updatePaginationControls(itemsArray.length, page);
}

// 更新页面信息显示
function updatePageInfo(totalItems, currentPage, hasItems = true) {
    const totalCountSpan = document.getElementById('totalCount');
    const currentCategorySpan = document.getElementById('currentCategory');
    const pageInfoSpan = document.getElementById('pageInfo');

    if (totalCountSpan) {
        totalCountSpan.textContent = totalItems;
    }

    if (currentCategorySpan) {
        const categoryName = document.querySelector('.tab.active')?.textContent || '';
        currentCategorySpan.textContent = categoryName;
    }

    if (pageInfoSpan) {
        if (!hasItems || totalItems === 0) {
            pageInfoSpan.textContent = "0 - 0 / 0";
        } else {
            const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
            const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
            pageInfoSpan.textContent = `显示 ${startItem} - ${endItem} 项，共 ${totalItems} 项`;
        }
    }
}

// 更新分页控件
function updatePaginationControls(totalItems, currentPage) {
    // 计算总页数
    totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    // 获取分页容器
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) {
        console.error('找不到分页容器元素');
        return;
    }

    // 清空现有分页按钮
    paginationContainer.innerHTML = '';

    // 如果没有数据，显示无分页状态
    if (totalItems === 0) {
        const noDataMsg = document.createElement('div');
        noDataMsg.className = 'no-data-msg';
        noDataMsg.textContent = '无数据显示';
        paginationContainer.appendChild(noDataMsg);
        return;
    }

    // 添加上一页按钮
    const prevButton = document.createElement('button');
    prevButton.id = 'prevPage';
    prevButton.className = 'page-btn';
    prevButton.textContent = '上一页';
    prevButton.disabled = currentPage <= 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    });
    paginationContainer.appendChild(prevButton);

    // 计算要显示的页码
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    // 调整页码范围，确保显示5个页码
    if (endPage - startPage < 4) {
        if (startPage === 1) {
            endPage = Math.min(startPage + 4, totalPages);
        } else if (endPage === totalPages) {
            startPage = Math.max(1, endPage - 4);
        }
    }

    // 添加页码按钮
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => goToPage(i));
        paginationContainer.appendChild(pageButton);
    }

    // 添加下一页按钮
    const nextButton = document.createElement('button');
    nextButton.id = 'nextPage';
    nextButton.className = 'page-btn';
    nextButton.textContent = '下一页';
    nextButton.disabled = currentPage >= totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
    });
    paginationContainer.appendChild(nextButton);

    // 添加跳转到指定页面的输入框和按钮
    const pageJumpContainer = document.createElement('div');
    pageJumpContainer.className = 'page-jump-container';

    const pageInput = document.createElement('input');
    pageInput.type = 'number';
    pageInput.id = 'pageJump';
    pageInput.min = 1;
    pageInput.max = totalPages;
    pageInput.placeholder = '页码';
    pageInput.value = currentPage;

    const goButton = document.createElement('button');
    goButton.id = 'goPage';
    goButton.textContent = '跳转';
    goButton.addEventListener('click', () => {
        const pageNum = parseInt(pageInput.value);
        if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
            goToPage(pageNum);
        }
    });

    // 按Enter键跳转
    pageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const pageNum = parseInt(pageInput.value);
            if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
                goToPage(pageNum);
            }
        }
    });

    const totalPageSpan = document.createElement('span');
    totalPageSpan.textContent = `/ ${totalPages}`;
    totalPageSpan.style.marginLeft = '5px';

    pageJumpContainer.appendChild(pageInput);
    pageJumpContainer.appendChild(totalPageSpan);
    pageJumpContainer.appendChild(goButton);

    paginationContainer.appendChild(pageJumpContainer);
}

// 跳转到指定页面
function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }

    currentPage = page;
    renderItems(filteredItems, currentPage);

    // 滚动到顶部，方便查看新页面内容
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用分类和搜索筛选
function applyFilters() {
    // 根据分类筛选
    let result = itemsData;

    if (currentCategory) {
        result = result.filter(item => (item.Category || '') === currentCategory);
    }

    // 根据搜索词筛选
    if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        let searchField = 'all'; // 默认搜索所有字段
        let actualTerm = term;

        // 检查前缀
        if (term.startsWith('@id:')) {
            searchField = 'id';
            actualTerm = term.substring(4).trim(); // 移除前缀
        } else if (term.startsWith('@name:')) {
            searchField = 'name';
            actualTerm = term.substring(6).trim(); // 移除前缀
        } else if (term.startsWith('@desc:')) {
            searchField = 'desc';
            actualTerm = term.substring(6).trim(); // 移除前缀
        }

        // 如果前缀后没有内容，则不进行筛选
        if (actualTerm === '') {
            result = [];
        } else {
            result = result.filter(item => {
                const name = item.name?.toLowerCase() || '';
                const id = item.id?.toString().toLowerCase() || '';
                const desc = item.desc?.toLowerCase() || '';

                switch (searchField) {
                    case 'id':
                        return id.includes(actualTerm);
                    case 'name':
                        return name.includes(actualTerm);
                    case 'desc':
                        return desc.includes(actualTerm);
                    default:
                        return name.includes(actualTerm) || id.includes(actualTerm) || desc.includes(actualTerm);
                }
            });
        }
    }

    filteredItems = result;
    currentPage = 1; // 重置到第一页

    // 立即更新页面信息，确保搜索结果为空时显示正确
    if (filteredItems.length === 0) {
        updatePageInfo(0, 1, false);

        // 清空分页控件
        const paginationContainer = document.getElementById('pagination');
        if (paginationContainer) {
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'no-data-msg';
            noDataMsg.textContent = '无数据显示';
            paginationContainer.innerHTML = '';
            paginationContainer.appendChild(noDataMsg);
        }
    }

    // 渲染筛选后的结果
    renderItems(filteredItems, currentPage);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('页面加载完成，开始初始化...');

    // 检查必需的元素是否存在
    if (!document.getElementById('itemsGrid')) {
        console.error('页面中缺少itemsGrid元素');
        return;
    }

    // 显示加载状态
    const itemsGrid = document.getElementById('itemsGrid');
    itemsGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 正在加载数据...</div>';

    try {
        // 添加缓存控制UI
        addCacheControls();

        // 添加控制台刷新缓存指令
        window.refreshCache = async function() {
            console.log('正在刷新缓存...');
            clearCache();

            // 显示加载状态
            const itemsGrid = document.getElementById('itemsGrid');
            itemsGrid.innerHTML = '<div class="loading"><i class="fas fa-sync fa-spin"></i> 正在刷新数据...</div>';

            try {
                // 重新获取数据
                itemsData = await fetchData();
                filteredItems = [...itemsData];
                applyFilters();

                console.log('缓存刷新完成！');
                showMessage('缓存已刷新！', 'success');
            } catch (error) {
                console.error('刷新缓存失败:', error);
                itemsGrid.innerHTML = '<div class="error"><i class="fas fa-exclamation-triangle"></i> 刷新失败，请检查网络连接</div>';
                showMessage('刷新失败，请检查网络连接', 'error');
            }
        };

        // 异步获取数据（会自动使用缓存）
        console.log('开始获取数据...');
        itemsData = await getData();
        console.log('数据获取完成，共获取到', itemsData?.length || 0, '条记录');

        // 如果没有获取到任何数据，则提醒用户
        if (!itemsData || itemsData.length === 0) {
            showMessage('未能获取到物品数据，请检查网络或缓存', 'error');
        }

        // 初始化筛选数据
        filteredItems = [...itemsData];

        // 动态生成分类选项卡（根据 urls 字典）
        const categoryTabs = document.getElementById('categoryTabs');
        if (categoryTabs) {
            categoryTabs.innerHTML = '';
            Object.entries(urls).forEach(([cat, {categoryName: catName}], idx) => {
                const tab = document.createElement('div');
                tab.className = 'tab' + (idx === 0 ? ' active' : '');
                tab.setAttribute('data-category', cat);
                tab.innerHTML = `<i class="fas fa-tag"></i> ${catName}`;
                categoryTabs.appendChild(tab);
            });
            // 如果有tab，确保currentCategory与第一个tab一致
            if (Object.keys(urls).length > 0) {
                currentCategory = Object.keys(urls)[0];
            }

        }

        // 绑定分类选项卡事件
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // 移除所有active类
                tabs.forEach(t => t.classList.remove('active'));
                // 给当前点击的选项卡添加active类
                this.classList.add('active');
                // 更新当前分类
                currentCategory = this.getAttribute('data-category');
                // 应用筛选
                applyFilters();
            });
        });

        // 绑定搜索功能
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', function() {
                // 使用防抖，避免频繁触发筛选
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchTerm = this.value;
                    applyFilters();
                }, 300); // 300毫秒后执行筛选
            });

            // 添加清空搜索按钮功能
            const clearSearchBtn = document.getElementById('clearSearchBtn');
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', function() {
                    searchInput.value = '';
                    searchTerm = '';
                    applyFilters();
                });
            }
        }

        // 初始渲染
        applyFilters();

    } catch (error) {
        console.error('初始化过程中发生错误:', error);
        itemsGrid.innerHTML = '<div class="error"><i class="fas fa-exclamation-triangle"></i> 加载数据失败，请检查网络连接或API配置</div>';
    }
});