// ==================== 动态（朋友圈）功能模块 ====================
(function() {
    console.log('[动态] 模块加载开始');

    // 统一管理弹窗层级
    let currentOverlays = [];

    function closeAllMomentOverlays() {
        currentOverlays.forEach(o => {
            if (o && o.parentNode) o.remove();
        });
        currentOverlays = [];
    }

    function registerOverlay(overlay) {
        closeAllMomentOverlays();  // 关闭之前的弹窗
        currentOverlays.push(overlay);
    }

    // 存储 key
    const MOMENTS_KEY = 'CHAT_APP_V3_moments_data';
    const MOMENT_CARDS_KEY = 'CHAT_APP_V3_moment_cards';
    const MOMENT_IMAGES_KEY = 'CHAT_APP_V3_moment_images';

    // 数据
    let momentsData = { moments: [] };      // 动态列表
    let momentCards = [];                    // 动态字卡
    let momentImages = [];                   // 动态配图

    // 设置
    let momentSettings = {
        partnerPostFrequency: 1,   // 梦角每天发动态数量 0-5
    };

    // 定时器
    let momentCheckTimer = null;
    let pendingReplies = [];  // 待处理的回复

    // ==================== 数据加载 ====================
    async function loadMomentsData() {
        try {
            const saved = await localforage.getItem(MOMENTS_KEY);
            if (saved) momentsData = saved;
            const cards = await localforage.getItem(MOMENT_CARDS_KEY);
            if (cards) momentCards = cards;
            const images = await localforage.getItem(MOMENT_IMAGES_KEY);
            if (images) momentImages = images;
        } catch(e) {
            console.warn('[动态] 数据加载失败', e);
        }
    }

    function saveMomentsData() {
        localforage.setItem(MOMENTS_KEY, momentsData);
    }

    function saveMomentCards() {
        localforage.setItem(MOMENT_CARDS_KEY, momentCards);
    }

    function saveMomentImages() {
        localforage.setItem(MOMENT_IMAGES_KEY, momentImages);
    }
    
    // ==================== 动态发布 ====================
    function addMoment(text, images, sender) {
        const moment = {
            id: 'moment_' + Date.now(),
            sender: sender,           // 'user' 或 'partner'
            text: text,
            images: images || [],     // 最多6张(user)/3张(partner)
            timestamp: Date.now(),
            likes: [],
            comments: [],
            isNew: sender === 'partner' // 梦角的新动态标记
        };
        momentsData.moments.unshift(moment);
        saveMomentsData();

        // 如果是我发的动态，梦角会回复
        if (sender === 'user') {
            schedulePartnerReply(moment.id);
        }

        // 更新红点
        updateMomentBadge();
        
        return moment;
    }

    // ==================== 梦角回复 ====================
    function schedulePartnerReply(momentId) {
        // 随机延迟 30分钟到4小时
        const minDelay = 30 * 60 * 1000;
        const maxDelay = 4 * 60 * 60 * 1000;
        const delay = minDelay + Math.random() * (maxDelay - minDelay);
        
        pendingReplies.push({
            momentId: momentId,
            triggerTime: Date.now() + delay
        });

        // 发送聊天通知
        if (typeof addMessage === 'function') {
            setTimeout(() => {
                const partnerName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
                addMessage({
                    id: Date.now(),
                    sender: 'system',
                    text: partnerName + ' 评论了你的动态',
                    timestamp: new Date(),
                    type: 'system'
                });
            }, delay);
        }
    }

    function checkPendingReplies() {
        const now = Date.now();
        const toProcess = pendingReplies.filter(p => now >= p.triggerTime);
        pendingReplies = pendingReplies.filter(p => now < p.triggerTime);

        toProcess.forEach(p => {
            const moment = momentsData.moments.find(m => m.id === p.momentId);
            if (moment && !moment.comments.some(c => c.sender === 'partner')) {
                // 从动态字卡库随机抽取回复
                let replyText = '听起来不错呢~';
                if (momentCards.length > 0) {
                    replyText = momentCards[Math.floor(Math.random() * momentCards.length)];
                } else if (typeof customReplies !== 'undefined' && customReplies.length > 0) {
                    replyText = customReplies[Math.floor(Math.random() * customReplies.length)];
                }

                const partnerName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
                const myName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';

                moment.comments.push({
                    id: 'comment_' + Date.now(),
                    sender: 'partner',
                    text: partnerName + ' 回复 @' + myName + '：' + replyText,
                    timestamp: Date.now()
                });
                moment.likes.push('partner'); // 自动点赞
                moment.isNew = true;
                saveMomentsData();
                updateMomentBadge();
            }
        });
    }

    // ==================== 梦角自动发动态 ====================
    function checkPartnerAutoPost() {
        const frequency = momentSettings.partnerPostFrequency || 1;
        if (frequency <= 0) return;

        const now = new Date();
        const todayStr = now.toDateString();
        
        // 检查今天梦角发了多少条
        const todayMoments = momentsData.moments.filter(m => {
            return m.sender === 'partner' && new Date(m.timestamp).toDateString() === todayStr;
        });

        if (todayMoments.length >= frequency) return;

        // 随机决定是否现在发（每小时检查一次，根据剩余条数调整概率）
        const remaining = frequency - todayMoments.length;
        const hourOfDay = now.getHours();
        const remainingHours = Math.max(1, 24 - hourOfDay);
        const prob = remaining / remainingHours;

        if (Math.random() < prob) {
            // 从动态字卡库随机选
            let postText = '今天天气真好~';
            if (momentCards.length > 0) {
                postText = momentCards[Math.floor(Math.random() * momentCards.length)];
            } else if (typeof customReplies !== 'undefined' && customReplies.length > 0) {
                postText = customReplies[Math.floor(Math.random() * customReplies.length)];
            }

            // 随机决定是否配图
            let postImages = [];
            if (Math.random() < 0.5) {
                const imagePool = [...momentImages];
                // 也从表情库随机选
                if (typeof stickerLibrary !== 'undefined' && stickerLibrary.length > 0) {
                    imagePool.push(...stickerLibrary);
                }
                if (imagePool.length > 0) {
                    const count = Math.min(3, 1 + Math.floor(Math.random() * 3));
                    for (let i = 0; i < count; i++) {
                        postImages.push(imagePool[Math.floor(Math.random() * imagePool.length)]);
                    }
                }
            }

            addMoment(postText, postImages, 'partner');
        }
    }

    // ==================== 红点管理 ====================
    function updateMomentBadge() {
        const hasNew = momentsData.moments.some(m => m.isNew && m.sender === 'partner') ||
                       momentsData.moments.some(m => m.comments.some(c => c.isNew));
        
        const badge = document.getElementById('moment-badge');
        if (badge) {
            badge.style.display = hasNew ? 'inline-block' : 'none';
        }
    }

    function clearMomentBadge() {
        // 标记所有动态为已读
        momentsData.moments.forEach(m => {
            m.isNew = false;
            m.comments.forEach(c => c.isNew = false);
        });
        saveMomentsData();
        updateMomentBadge();
    }
    
    // ==================== 动态弹窗渲染 ====================
    function renderMomentsModal() {
        // 移除旧弹窗
        const oldModal = document.getElementById('moments-modal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'moments-modal';
        modal.className = 'moment-modal-overlay';
        modal.setAttribute('data-no-auto-close', 'true');
        modal.style.cssText = 'display:flex;position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;width:94%;max-height:85vh;display:flex;flex-direction:column;padding:0;overflow:hidden;" onclick="event.stopPropagation()">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-shrink:0;">
                    <div style="font-size:16px;font-weight:700;color:var(--text-primary);">动态</div>
                    <div style="display:flex;gap:8px;">
                        <button id="moment-post-btn" style="padding:6px 14px;border-radius:20px;border:none;background:var(--accent-color);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-family);">
                            <i class="fas fa-plus"></i> 发布
                        </button>
                        <button id="moment-settings-btn" style="width:34px;height:34px;border-radius:50%;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button id="moment-close-btn" style="width:34px;height:34px;border-radius:50%;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;">×</button>
                    </div>
                </div>
                <div id="moments-list" style="flex:1;overflow-y:auto;padding:16px 20px;">
                    ${renderMomentsList()}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        registerOverlay(modal);

        setTimeout(() => {
            var list = document.getElementById('moments-list');
            if (list) list.innerHTML = renderMomentsList();
        }, 100);

        // 强制显示弹窗内容
        var mc = modal.querySelector('.modal-content');
        if (mc) {
            mc.style.opacity = '1';
            mc.style.transform = 'translateY(0) scale(1)';
        }

        // 关闭弹窗的统一函数
        function closeModal() {
            currentOverlays = currentOverlays.filter(o => o !== modal);
            modal.remove();
            clearMomentBadge();
        }

        // 事件绑定
        modal.querySelector('#moment-close-btn').onclick = closeModal;
        modal.querySelector('#moment-post-btn').onclick = () => openPostMomentDialog();
        modal.querySelector('#moment-settings-btn').onclick = () => openMomentSettings();
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    function renderMomentsList() {
        if (momentsData.moments.length === 0) {
            return `<div style="text-align:center;padding:60px 0;color:var(--text-secondary);opacity:0.6;">
                <div style="font-size:40px;margin-bottom:12px;">📸</div>
                <div>还没有动态</div>
                <div style="font-size:12px;margin-top:4px;">点击"发布"分享你的第一条动态吧</div>
            </div>`;
        }

        const myName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
        const partnerName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';

        return momentsData.moments.map(moment => {
            const senderName = moment.sender === 'user' ? myName : partnerName;
            const timeStr = formatMomentTime(moment.timestamp);
            const isNew = moment.isNew && moment.sender === 'partner';
            const likedByUser = moment.likes && moment.likes.includes('user');
            
            // 图片展示
            let imagesHtml = '';
            if (moment.images && moment.images.length > 0) {
                const count = moment.images.length;
                const gridClass = count === 1 ? 'moment-img-single' : count === 2 ? 'moment-img-double' : 'moment-img-grid';
                imagesHtml = `<div class="moment-images ${gridClass}">` +
                    moment.images.map(img => `<div class="moment-img-wrap"><img src="${img}" loading="lazy" onclick="viewImage('${img}')"></div>`).join('') +
                    `</div>`;
            }

            // 评论展示
            let commentsHtml = '';
            if (moment.comments && moment.comments.length > 0) {
                commentsHtml = moment.comments.map(c => `
                    <div class="moment-comment">
                        <span class="moment-comment-text">${c.text}</span>
                    </div>
                `).join('');
            }

            // 点赞
            const liked = moment.likes && moment.likes.length > 0;
            const likeCount = moment.likes ? moment.likes.length : 0;

            return `
                <div class="moment-item" style="margin-bottom:16px;${isNew ? 'border-left:3px solid var(--accent-color);padding-left:10px;' : ''}">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                        <div style="width:36px;height:36px;border-radius:50%;background:${moment.sender === 'user' ? 'var(--accent-color)' : 'var(--border-color)'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;">
                            ${senderName.charAt(0)}
                        </div>
                        <div>
                            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${senderName}</div>
                            <div style="font-size:10px;color:var(--text-secondary);">${timeStr}</div>
                        </div>
                        ${isNew ? '<span style="font-size:10px;background:var(--accent-color);color:#fff;padding:1px 6px;border-radius:8px;">新</span>' : ''}
                    </div>
                    <div style="font-size:14px;color:var(--text-primary);margin-bottom:8px;line-height:1.6;">${moment.text}</div>
                    ${imagesHtml}
                    ${commentsHtml ? `<div class="moment-comments-section">${commentsHtml}</div>` : ''}
                    <div style="display:flex;gap:16px;margin-top:6px;font-size:11px;color:var(--text-secondary);">
                        <span style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;${likedByUser ? 'color:var(--accent-color);font-weight:700;' : 'color:var(--text-secondary);'}" onclick="window._likeMoment('${moment.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="${likedByUser ? 'var(--accent-color)' : 'none'}" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                            ${likeCount > 0 ? likeCount : '赞'}
                        </span>
                        <span style="cursor:pointer;color:var(--text-secondary);" onclick="window._commentMoment('${moment.id}')">💬 评论</span>
                        <span style="cursor:pointer;color:var(--text-secondary);" onclick="window._deleteMoment('${moment.id}')">🗑 删除</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function formatMomentTime(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return '昨天 ' + date.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
        }
        
        return date.toLocaleDateString('zh-CN', {month:'numeric',day:'numeric'}) + ' ' +
               date.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
    }

    // ==================== 发布动态弹窗 ====================
    function openPostMomentDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
        overlay.setAttribute('data-no-auto-close', 'true');
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg);border-radius:20px;padding:24px;width:92%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:16px;">发布动态</div>
                <textarea id="moment-text-input" rows="4" placeholder="分享你的想法..." style="width:100%;padding:12px;border:1.5px solid var(--border-color);border-radius:12px;font-size:14px;font-family:var(--font-family);background:var(--primary-bg);color:var(--text-primary);resize:none;outline:none;box-sizing:border-box;"></textarea>
                <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;" id="moment-images-preview"></div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
                    <button id="moment-add-image-btn" style="padding:6px 14px;border-radius:20px;border:1.5px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;font-size:12px;font-family:var(--font-family);">
                        <i class="fas fa-image"></i> 添加图片
                    </button>
                    <button id="moment-add-sticker-btn" style="padding:6px 14px;border-radius:20px;border:1.5px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;font-size:12px;font-family:var(--font-family);">
                        <i class="fas fa-smile"></i> 表情包
                    </button>
                    <span style="font-size:11px;color:var(--text-secondary);margin-left:auto;" id="moment-image-count">最多6张</span>
                </div>
                <input type="file" id="moment-image-input" accept="image/*" multiple style="display:none;">
                <div style="display:flex;gap:10px;margin-top:20px;">
                    <button id="moment-post-cancel" style="flex:1;padding:10px;border:1.5px solid var(--border-color);border-radius:12px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">取消</button>
                    <button id="moment-post-confirm" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--font-family);">发布</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        registerOverlay(overlay);

        // 统一关闭
        function closeOverlay() {
            currentOverlays = currentOverlays.filter(o => o !== overlay);
            overlay.remove();
        }

        let selectedImages = [];

        const textInput = overlay.querySelector('#moment-text-input');
        const previewDiv = overlay.querySelector('#moment-images-preview');
        const countSpan = overlay.querySelector('#moment-image-count');

        function updatePreview() {
            previewDiv.innerHTML = selectedImages.map((img, i) => `
                <div style="position:relative;width:60px;height:60px;border-radius:8px;overflow:hidden;flex-shrink:0;">
                    <img src="${img}" style="width:100%;height:100%;object-fit:cover;">
                    <button onclick="this.parentElement.remove();selectedImages.splice(${i},1);updatePreview();" style="position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;border:none;cursor:pointer;font-size:10px;line-height:1;">×</button>
                </div>
            `).join('');
            countSpan.textContent = `已选${selectedImages.length}/6张`;
        }

        overlay.querySelector('#moment-add-image-btn').onclick = () => {
            const input = overlay.querySelector('#moment-image-input');
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const files = e.target.files;
                for (const file of files) {
                    if (selectedImages.length >= 6) break;
                    if (file.size > 10 * 1024 * 1024) {
                        showNotification('图片不能超过10MB', 'error');
                        continue;
                    }
                    const base64 = await optimizeImageToBase64(file);
                    selectedImages.push(base64);
                }
                updatePreview();
                e.target.value = '';
            };
            input.click();
        };

        overlay.querySelector('#moment-add-sticker-btn').onclick = () => {
            if (typeof stickerLibrary === 'undefined' || stickerLibrary.length === 0) {
                showNotification('表情库为空', 'warning');
                return;
            }
            const sticker = stickerLibrary[Math.floor(Math.random() * stickerLibrary.length)];
            if (selectedImages.length < 6) {
                selectedImages.push(sticker);
                updatePreview();
            }
        };

        // 关闭按钮
        overlay.querySelector('#moment-post-cancel').onclick = closeOverlay;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

        // 发布成功
        overlay.querySelector('#moment-post-confirm').onclick = () => {
            const text = textInput.value.trim();
            if (!text && selectedImages.length === 0) {
                showNotification('请输入文字或添加图片', 'warning');
                return;
            }
            addMoment(text || '', selectedImages, 'user');
            closeOverlay();
            refreshMomentsList();
            showNotification('动态已发布', 'success');
        };
    }

    function optimizeImageToBase64(file) {
        return new Promise((resolve, reject) => {
            if (typeof optimizeImage === 'function') {
                optimizeImage(file, 400, 0.6).then(resolve).catch(reject);
            } else {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            }
        });
    }

    function refreshMomentsList() {
        const list = document.getElementById('moments-list');
        if (list) {
            list.innerHTML = renderMomentsList();
        }
    }

    // ==================== 回复动态 ====================
    window._replyMoment = function(momentId) {
        const myName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
        const replyText = prompt('输入回复内容：');
        if (!replyText || !replyText.trim()) return;

        const moment = momentsData.moments.find(m => m.id === momentId);
        if (moment) {
            moment.comments.push({
                id: 'comment_' + Date.now(),
                sender: 'user',
                text: myName + '：' + replyText.trim(),
                timestamp: Date.now()
            });
            saveMomentsData();
            refreshMomentsList();
            showNotification('回复成功', 'success');
        }
    };

    // ==================== 点赞动态 ====================
    window._likeMoment = function(momentId) {
        const moment = momentsData.moments.find(m => m.id === momentId);
        if (moment) {
            const myName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
            if (!moment.likes) moment.likes = [];
            const idx = moment.likes.indexOf('user');
            if (idx > -1) {
                moment.likes.splice(idx, 1);
            } else {
                moment.likes.push('user');
            }
            saveMomentsData();
            refreshMomentsList();
        }
    };

    // ==================== 删除动态 ====================
    window._deleteMoment = function(momentId) {
        const moment = momentsData.moments.find(m => m.id === momentId);
        if (!moment) return;
        
        const confirmText = moment.sender === 'partner' 
            ? '确定删除梦角的这条动态吗？'
            : '确定删除这条动态吗？';
            
        if (confirm(confirmText)) {
            momentsData.moments = momentsData.moments.filter(m => m.id !== momentId);
            saveMomentsData();
            refreshMomentsList();
            showNotification('已删除', 'success');
        }
    };

   window._commentMoment = function(momentId) {
    const myName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div style="background:var(--secondary-bg);border-radius:16px;padding:20px;width:88%;max-width:320px;">
            <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">💬 评论动态</div>
            <textarea id="_comment_input" rows="3" placeholder="输入评论..." style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:10px;font-size:14px;background:var(--primary-bg);color:var(--text-primary);outline:none;resize:none;box-sizing:border-box;font-family:var(--font-family);"></textarea>
            <div style="display:flex;gap:8px;margin-top:12px;">
                <button id="_comment_cancel" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:none;color:var(--text-secondary);font-size:13px;">取消</button>
                <button id="_comment_ok" style="flex:1;padding:10px;border:none;border-radius:10px;background:var(--accent-color);color:#fff;font-size:13px;font-weight:600;">评论</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    
    overlay.querySelector('#_comment_cancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#_comment_ok').onclick = () => {
        const commentText = overlay.querySelector('#_comment_input').value.trim();
        overlay.remove();
        if (!commentText) return;
        const moment = momentsData.moments.find(m => m.id === momentId);
        if (moment) {
            moment.comments.push({
                id: 'comment_' + Date.now(),
                sender: 'user',
                text: myName + '：' + commentText,
                timestamp: Date.now(),
                isNew: true
            });
            saveMomentsData();
            refreshMomentsList();
            updateMomentBadge();
            showNotification('评论成功', 'success');
            schedulePartnerReply(momentId);
        }
    };
    overlay.querySelector('#_comment_input').focus();
};

    // ==================== 动态设置 ====================
    function openMomentSettings() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:6500;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
        overlay.setAttribute('data-no-auto-close', 'true');
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg);border-radius:20px;padding:24px;width:92%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:20px;">动态设置</div>
                
                <div style="margin-bottom:16px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:13px;color:var(--text-primary);">梦角发动态频率</span>
                        <span id="freq-value" style="font-size:12px;color:var(--accent-color);font-weight:600;">${momentSettings.partnerPostFrequency} 条/天</span>
                    </div>
                    <input type="range" id="freq-slider" min="0" max="5" value="${momentSettings.partnerPostFrequency}" style="width:100%;accent-color:var(--accent-color);">
                    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-secondary);padding:0 2px;">
                        <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                    </div>
                </div>
                
                <div style="margin-bottom:20px;">
                    <button id="open-card-manager-btn" style="width:100%;padding:12px;border:1.5px solid var(--border-color);border-radius:12px;background:var(--primary-bg);color:var(--text-primary);cursor:pointer;font-size:13px;font-family:var(--font-family);display:flex;align-items:center;justify-content:center;gap:8px;">
                        <i class="fas fa-list"></i> 动态字卡管理
                    </button>
                </div>

                <div style="display:flex;gap:10px;">
                    <button id="settings-close" style="flex:1;padding:10px;border:1.5px solid var(--border-color);border-radius:12px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        registerOverlay(overlay);

        // 统一关闭
        function closeOverlay() {
            currentOverlays = currentOverlays.filter(o => o !== overlay);
            overlay.remove();
        }

        const freqSlider = overlay.querySelector('#freq-slider');
        const freqValue = overlay.querySelector('#freq-value');
        freqSlider.addEventListener('input', () => {
            momentSettings.partnerPostFrequency = parseInt(freqSlider.value);
            freqValue.textContent = freqSlider.value + ' 条/天';
        });

        // 关闭按钮
        overlay.querySelector('#settings-close').onclick = closeOverlay;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

        // 打开字卡管理（先关闭当前设置弹窗）
        overlay.querySelector('#open-card-manager-btn').onclick = () => {
            closeOverlay();
            openMomentCardManager();
        };
    }

    // ==================== 动态字卡管理 ====================
    function openMomentCardManager() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:7000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
        overlay.setAttribute('data-no-auto-close', 'true');
        overlay.innerHTML = `
            <div style="background:var(--secondary-bg);border-radius:20px;padding:24px;width:92%;max-width:420px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-shrink:0;">
                    <div style="font-size:16px;font-weight:700;color:var(--text-primary);">动态字卡管理</div>
                    <div style="display:flex;gap:6px;">
                        <button id="card-tab-words" class="card-tab-btn active" style="padding:5px 12px;border-radius:20px;border:1px solid var(--border-color);background:var(--accent-color);color:#fff;font-size:12px;cursor:pointer;font-family:var(--font-family);">字卡</button>
                        <button id="card-tab-images" class="card-tab-btn" style="padding:5px 12px;border-radius:20px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:var(--font-family);">配图</button>
                    </div>
                </div>
                
                <!-- 字卡面板 -->
                <div id="words-panel" style="flex:1;overflow-y:auto;min-height:0;">
                    <div style="margin-bottom:12px;">
                        <textarea id="new-card-input" rows="4" placeholder="输入字卡内容，每行一条..." style="width:100%;padding:8px 12px;border:1.5px solid var(--border-color);border-radius:10px;font-size:13px;background:var(--primary-bg);color:var(--text-primary);outline:none;font-family:var(--font-family);resize:vertical;box-sizing:border-box;"></textarea>
                     </div>
                     <div style="display:flex;gap:8px;margin-bottom:10px;">
                        <button id="add-card-btn" style="flex:1;padding:8px 16px;border:none;border-radius:10px;background:var(--accent-color);color:#fff;font-size:13px;cursor:pointer;font-family:var(--font-family);">添加</button>
                    </div>
                    <div style="display:flex;gap:6px;margin-bottom:10px;">
                        <input type="text" id="card-search-input" placeholder="搜索..." style="flex:1;padding:7px 12px;border:1.5px solid var(--border-color);border-radius:10px;font-size:12px;background:var(--primary-bg);color:var(--text-primary);outline:none;font-family:var(--font-family);">
                    </div>
                    <div id="cards-list" style="display:flex;flex-direction:column;gap:6px;">
                        ${renderCardsList()}
                    </div>
                </div>
                
                <!-- 配图面板 -->
                <div id="images-panel" style="display:none;flex:1;overflow-y:auto;min-height:0;">
                    <div style="display:flex;gap:8px;margin-bottom:12px;">
                        <button id="add-image-btn" style="flex:1;padding:8px;border:1.5px dashed var(--border-color);border-radius:10px;background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;font-size:13px;font-family:var(--font-family);">
                            <i class="fas fa-plus"></i> 上传图片
                        </button>
                    </div>
                    <input type="file" id="moment-image-upload" accept="image/*" multiple style="display:none;">
                    <div id="images-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                        ${renderImagesGrid()}
                    </div>
                </div>

                <button id="card-manager-close" style="margin-top:14px;padding:10px;border:1.5px solid var(--border-color);border-radius:12px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);flex-shrink:0;">关闭</button>
            </div>
        `;
        document.body.appendChild(overlay);
        registerOverlay(overlay);

        // 统一关闭
        function closeOverlay() {
            currentOverlays = currentOverlays.filter(o => o !== overlay);
            overlay.remove();
        }

        // Tab 切换
        overlay.querySelector('#card-tab-words').onclick = () => {
            overlay.querySelector('#words-panel').style.display = 'block';
            overlay.querySelector('#images-panel').style.display = 'none';
            overlay.querySelector('#card-tab-words').style.background = 'var(--accent-color)';
            overlay.querySelector('#card-tab-words').style.color = '#fff';
            overlay.querySelector('#card-tab-images').style.background = 'var(--primary-bg)';
            overlay.querySelector('#card-tab-images').style.color = 'var(--text-secondary)';
        };
        overlay.querySelector('#card-tab-images').onclick = () => {
            overlay.querySelector('#words-panel').style.display = 'none';
            overlay.querySelector('#images-panel').style.display = 'block';
            overlay.querySelector('#card-tab-images').style.background = 'var(--accent-color)';
            overlay.querySelector('#card-tab-images').style.color = '#fff';
            overlay.querySelector('#card-tab-words').style.background = 'var(--primary-bg)';
            overlay.querySelector('#card-tab-words').style.color = 'var(--text-secondary)';
        };

       // 添加字卡（支持批量，每行一条）
overlay.querySelector('#add-card-btn').onclick = () => {
    const input = overlay.querySelector('#new-card-input');
    const text = input.value.trim();
    if (!text) return;
    // 按换行分割，过滤空行
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    momentCards.push(...lines);
    saveMomentCards();
    input.value = '';
    refreshCardsList(overlay);
    showNotification('已添加 ' + lines.length + ' 条字卡', 'success');
};

        // 搜索
        overlay.querySelector('#card-search-input').oninput = (e) => {
            refreshCardsList(overlay, e.target.value);
        };

        // 配图上传
        overlay.querySelector('#add-image-btn').onclick = () => overlay.querySelector('#moment-image-upload').click();
        overlay.querySelector('#moment-image-upload').onchange = async (e) => {
            const files = e.target.files;
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) {
                    showNotification('图片不能超过10MB', 'error');
                    continue;
                }
                const base64 = await optimizeImageToBase64(file);
                momentImages.push(base64);
            }
            saveMomentImages();
            refreshImagesGrid(overlay);
            e.target.value = '';
        };

        // 关闭按钮和遮罩点击
        overlay.querySelector('#card-manager-close').onclick = closeOverlay;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
    }

    function renderCardsList(filter = '') {
        let cards = momentCards;
        if (filter) {
            cards = cards.filter(c => c.toLowerCase().includes(filter.toLowerCase()));
        }
        if (cards.length === 0) {
            return '<div style="text-align:center;padding:20px;color:var(--text-secondary);opacity:0.6;font-size:12px;">暂无字卡</div>';
        }
        return cards.slice(0, 30).map((card, i) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--primary-bg);">
                <span style="font-size:13px;color:var(--text-primary);">${card}</span>
                <button onclick="window._deleteMomentCard(${i})" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:12px;">×</button>
            </div>
        `).join('');
    }

    function refreshCardsList(overlay, filter = '') {
        const list = overlay.querySelector('#cards-list');
        if (list) list.innerHTML = renderCardsList(filter);
    }

    window._deleteMomentCard = function(index) {
        momentCards.splice(index, 1);
        saveMomentCards();
        const overlay = document.querySelector('#card-manager-close')?.closest('[style*=fixed]');
        if (overlay) refreshCardsList(overlay);
    };

    function renderImagesGrid() {
        if (momentImages.length === 0) {
            return '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-secondary);opacity:0.6;font-size:12px;">暂无配图</div>';
        }
        return momentImages.map((img, i) => `
            <div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;">
                <img src="${img}" style="width:100%;height:100%;object-fit:cover;">
                <button onclick="window._deleteMomentImage(${i})" style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;border:none;cursor:pointer;font-size:10px;">×</button>
            </div>
        `).join('');
    }

    function refreshImagesGrid(overlay) {
        const grid = overlay.querySelector('#images-grid');
        if (grid) grid.innerHTML = renderImagesGrid();
    }

    window._deleteMomentImage = function(index) {
        momentImages.splice(index, 1);
        saveMomentImages();
        const overlay = document.querySelector('#card-manager-close')?.closest('[style*=fixed]');
        if (overlay) refreshImagesGrid(overlay);
    };

    // ==================== 入口按钮和红点 ====================
    function addMomentEntryButton() {
        // 在 header-actions 中添加动态按钮
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions || document.getElementById('moment-entry-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'moment-entry-btn';
        btn.className = 'action-btn';
        btn.title = '动态';
        btn.style.position = 'relative';
        btn.innerHTML = '<i class="fas fa-compass"></i><span id="moment-badge" style="display:none;position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#ef4444;"></span>';
        btn.onclick = () => {
            renderMomentsModal();
        };

        // 插入到 group-chat-btn 后面
        const groupChatBtn = document.getElementById('group-chat-btn');
        if (groupChatBtn) {
            groupChatBtn.after(btn);
        } else {
            headerActions.appendChild(btn);
        }

        updateMomentBadge();
    }

    // 在高级功能面板中添加入口
    function addMomentAdvancedEntry() {
        const checkInterval = setInterval(() => {
            const settingsItemList = document.querySelector('#advanced-modal .settings-item-list');
            if (settingsItemList && !document.getElementById('moment-function')) {
                const envelopeItem = document.getElementById('envelope-function');
                const entryHTML = `
                    <div class="settings-item" id="moment-function" style="cursor:pointer;">
                        <i class="fas fa-compass"></i>
                        <span>动态</span>
                    </div>
                `;
                if (envelopeItem) {
                    envelopeItem.insertAdjacentHTML('afterend', entryHTML);
                } else {
                    settingsItemList.insertAdjacentHTML('beforeend', entryHTML);
                }
                
                const entry = document.getElementById('moment-function');
                if (entry) {
                    entry.addEventListener('click', () => {
                        const advancedModal = document.getElementById('advanced-modal');
                        if (advancedModal && typeof hideModal === 'function') hideModal(advancedModal);
                        setTimeout(() => renderMomentsModal(), 100);
                    });
                }
                clearInterval(checkInterval);
            }
        }, 200);
    }

    // ==================== 定时器 ====================
    function startMomentTimers() {
        // 每小时检查一次梦角是否需要发动态
        if (momentCheckTimer) clearInterval(momentCheckTimer);
        momentCheckTimer = setInterval(() => {
            checkPartnerAutoPost();
            checkPendingReplies();
        }, 60 * 60 * 1000); // 每小时

        // 立即检查一次
        setTimeout(() => {
            checkPartnerAutoPost();
            checkPendingReplies();
        }, 5000);
    }

    // ==================== 初始化 ====================
    async function initMoments() {
        await loadMomentsData();
        addMomentEntryButton();
        addMomentAdvancedEntry();
        startMomentTimers();
        updateMomentBadge();
        console.log('[动态] 模块初始化完成');
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMoments);
    } else {
        setTimeout(initMoments, 500);
    }

    // 暴露到全局
    window.openMoments = renderMomentsModal;
    window._likeMoment = window._likeMoment;
    window._replyMoment = window._replyMoment;
    window._deleteMoment = window._deleteMoment;
    window._deleteMomentCard = window._deleteMomentCard;
    window._deleteMomentImage = window._deleteMomentImage;

})();