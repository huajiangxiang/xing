// ==================== 帮我决定功能模块（最终版） ====================
(function() {
    console.log('[帮我决定] 模块加载开始');

    // DOM 元素
    let modal = null;
    let questionInput = null;
    let answersTextarea = null;
    let confirmBtn = null;
    let cancelBtn = null;
    let countSpan = null;
    let modeYesnoBtn = null;
    let modeCustomBtn = null;
    let yesnoPanel = null;
    let customPanel = null;
    let delayInput = null;

  

    let currentMode = 'yesno'; // 'yesno' 或 'custom'
    let currentDelay = 3; // 秒

    function initElements() {
        modal = document.getElementById('decision-helper-modal');
        questionInput = document.getElementById('decision-question');
        answersTextarea = document.getElementById('decision-answers');
        confirmBtn = document.getElementById('decision-confirm-btn');
        cancelBtn = document.getElementById('decision-cancel-btn');
        countSpan = document.getElementById('decision-answer-count');
        modeYesnoBtn = document.getElementById('decision-mode-yesno');
        modeCustomBtn = document.getElementById('decision-mode-custom');
        yesnoPanel = document.getElementById('decision-yesno-panel');
        customPanel = document.getElementById('decision-custom-panel');
        delayInput = document.getElementById('decision-delay-input');
        
        
        if (delayInput) {
            delayInput.addEventListener('input', function() {
                let val = parseInt(this.value);
                if (isNaN(val)) val = 3;
                if (val < 1) val = 1;
                if (val > 60) val = 60;
                currentDelay = val;
                this.value = val;
            });
        }
        
        if (modeYesnoBtn) {
            modeYesnoBtn.addEventListener('click', function() {
                switchMode('yesno');
            });
        }
        if (modeCustomBtn) {
            modeCustomBtn.addEventListener('click', function() {
                switchMode('custom');
            });
        }
    }

    function switchMode(mode) {
        currentMode = mode;
        if (mode === 'yesno') {
            if (modeYesnoBtn) {
                modeYesnoBtn.style.background = 'var(--accent-color)';
                modeYesnoBtn.style.color = 'white';
            }
            if (modeCustomBtn) {
                modeCustomBtn.style.background = 'transparent';
                modeCustomBtn.style.color = 'var(--text-secondary)';
            }
            if (yesnoPanel) yesnoPanel.style.display = 'block';
            if (customPanel) customPanel.style.display = 'none';
        } else {
            if (modeCustomBtn) {
                modeCustomBtn.style.background = 'var(--accent-color)';
                modeCustomBtn.style.color = 'white';
            }
            if (modeYesnoBtn) {
                modeYesnoBtn.style.background = 'transparent';
                modeYesnoBtn.style.color = 'var(--text-secondary)';
            }
            if (yesnoPanel) yesnoPanel.style.display = 'none';
            if (customPanel) customPanel.style.display = 'block';
        }
        validate();
    }

    function updateCount() {
        if (!answersTextarea) return;
        const text = answersTextarea.value;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (countSpan) countSpan.textContent = lines.length;
        return lines;
    }

    function validate() {
        if (!confirmBtn) return;
        const question = questionInput ? questionInput.value.trim() : '';
        let isValid = false;
        
        if (currentMode === 'yesno') {
            isValid = question.length > 0;
        } else {
            const lines = answersTextarea ? answersTextarea.value.split(/\r?\n/).filter(l => l.trim().length > 0) : [];
            isValid = question.length > 0 && lines.length >= 2;
        }
        confirmBtn.disabled = !isValid;
    }

    function resetForm() {
        if (questionInput) questionInput.value = '';
        if (answersTextarea) answersTextarea.value = '';
        if (delayInput) {
            delayInput.value = '3';
            currentDelay = 3;
        }
        switchMode('yesno');
        updateCount();
        validate();
    }

    // 获取决定结果
    function getDecision() {
        const question = questionInput ? questionInput.value.trim() : '';
        let answer = '';
        
        if (currentMode === 'yesno') {
            const random = Math.random();
            answer = random < 0.5 ? '是' : '否';
        } else {
            const lines = answersTextarea.value.split(/\r?\n/).filter(l => l.trim().length > 0);
            if (lines.length > 0) {
                const randomIndex = Math.floor(Math.random() * lines.length);
                answer = lines[randomIndex];
            }
        }
        
        return { question, answer };
    }

   
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function showToast(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#ff4444' : 'var(--accent-color, #8b5cf6)'};
            color: white;
            padding: 10px 20px;
            border-radius: 30px;
            font-size: 13px;
            z-index: 30001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

       function onConfirm() {
    if (!questionInput) return;
    
    const question = questionInput.value.trim();
    if (!question) return;
    
    if (currentMode === 'custom') {
        const lines = answersTextarea ? answersTextarea.value.split(/\r?\n/).filter(l => l.trim().length > 0) : [];
        if (lines.length < 2) {
            showToast('自定义模式至少需要2个选项', 'error');
            return;
        }
    }
    
    // 关闭主弹窗
    if (modal && typeof window.hideModal === 'function') {
        window.hideModal(modal);
    } else if (modal) {
        modal.style.display = 'none';
    }
    
    // 获取决定
    const { question: q, answer } = getDecision();
    
    // 立即发送我的问题
    var myText = '帮我决定：' + q;
    if (currentMode === 'custom') {
        var lines = answersTextarea ? answersTextarea.value.split(/\r?\n/).filter(l => l.trim().length > 0) : [];
        if (lines.length > 0) {
            myText += '\n选项：' + lines.join('、');
        }
    }
    
    // 发送我的消息
    if (typeof addMessage === 'function') {
        addMessage({
            id: Date.now(),
            sender: 'user',
            text: myText,
            timestamp: new Date(),
            status: 'sent',
            favorited: false,
            note: null,
            type: 'normal'
        });
    }
    
    // 延迟后发送梦角回复
    setTimeout(function() {
        var partnerText = '我选：' + answer;
        if (typeof addMessage === 'function') {
            addMessage({
                id: Date.now() + 1,
                sender: (typeof settings !== 'undefined' ? settings.partnerName : '梦角'),
                text: partnerText,
                timestamp: new Date(),
                status: 'received',
                favorited: false,
                note: null,
                type: 'normal'
            });
        }
        // 播放消息音效
        if (typeof playSound === 'function') {
            playSound('message');
        }
        // 触发保存
        if (typeof throttledSaveData === 'function') {
            throttledSaveData();
        }
    }, currentDelay * 1000);
    
    resetForm();
}
          function openModal() {
        if (!modal) initElements();
        if (!modal) {
            console.error('[帮我决定] 找不到弹窗元素');
            return;
        }
        
        resetForm();
        
        if (typeof window.showModal === 'function') {
            window.showModal(modal);
        } else {
            modal.style.display = 'flex';
        }
        
        setTimeout(function() {
            if (questionInput) questionInput.focus();
        }, 100);
    }
    function bindEvents() {
        if (!confirmBtn || !cancelBtn) return;
        
        var newConfirm = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        confirmBtn = newConfirm;
        confirmBtn.addEventListener('click', onConfirm);
        
        var newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        cancelBtn = newCancel;
        cancelBtn.addEventListener('click', function() {
            if (modal && typeof window.hideModal === 'function') {
                window.hideModal(modal);
            } else if (modal) {
                modal.style.display = 'none';
            }
            resetForm();
        });
        
        if (questionInput) {
            questionInput.addEventListener('input', validate);
        }
               if (answersTextarea) {
            answersTextarea.addEventListener('input', function() {
                updateCount();
                validate();
            });
        }
    } 

    function addCardToAdvanced() {
        initElements();
        bindEvents();
        
        var existingCard = document.getElementById('decision-helper-card');
        if (existingCard) {
            var newCard = existingCard.cloneNode(true);
            existingCard.parentNode.replaceChild(newCard, existingCard);
            newCard.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var advancedModal = document.getElementById('advanced-modal');
                if (advancedModal && typeof window.hideModal === 'function') {
                    window.hideModal(advancedModal);
                } else if (advancedModal) {
                    advancedModal.style.display = 'none';
                }
                setTimeout(function() { openModal(); }, 50);
            });
            console.log('[帮我决定] 卡片已绑定');
            return;
        }

        var attempts = 0;
        var checkInterval = setInterval(function() {
            attempts++;
            var settingsItemList = document.querySelector('#advanced-modal .settings-item-list');
            if (settingsItemList && !document.getElementById('decision-helper-card')) {
                var envelopeItem = document.getElementById('envelope-function');
                var newCardHTML = `
                    <div class="settings-item" id="decision-helper-card" style="cursor: pointer;">
                        <i class="fas fa-dice-d6"></i>
                        <span>让他决定</span>
                    </div>
                `;
                
                if (envelopeItem) {
                    envelopeItem.insertAdjacentHTML('afterend', newCardHTML);
                } else {
                    settingsItemList.insertAdjacentHTML('beforeend', newCardHTML);
                }
                
                var card = document.getElementById('decision-helper-card');
                if (card) {
                    card.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var advancedModal = document.getElementById('advanced-modal');
                        if (advancedModal && typeof window.hideModal === 'function') {
                            window.hideModal(advancedModal);
                        } else if (advancedModal) {
                            advancedModal.style.display = 'none';
                        }
                        setTimeout(function() { openModal(); }, 50);
                    });
                }
                clearInterval(checkInterval);
                console.log('[帮我决定] 卡片已添加并绑定');
            } else if (attempts >= 30) {
                clearInterval(checkInterval);
                console.warn('[帮我决定] 未找到高级功能面板');
            }
        }, 200);
    }

    window.openDecisionHelper = openModal;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addCardToAdvanced);
    } else {
        addCardToAdvanced();
    }
})();