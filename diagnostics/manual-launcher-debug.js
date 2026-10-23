/**
 * 学习通自动刷视频 v5 - 最终版
 *
 * 【重要】使用前先刷新页面(F5)清除所有旧脚本！
 * 然后复制本文件全部内容，粘贴到控制台，按Enter执行
 */

(function () {
    'use strict';

    // 在顶层和目录iframe中运行，不在其他iframe中运行
    // 检测是否在目录iframe中：检查是否有.posCatalog_select元素
    var hasCatalog = document.querySelectorAll('.posCatalog_select').length > 0;
    var isTop = window.top === window;
    if (!isTop && !hasCatalog) return;

    // ==================== 课程配置 ====================
    // 只需配置当前正在刷的课程
    var CURRENT_COURSE = {
        name: '当前课程',
        courseId: '',
        clazzId: '',
        cpi: '',
        ut: 's'
    };

    // 从URL自动填充课程参数
    var urlParams = new URLSearchParams(location.search);
    if (urlParams.get('courseId')) CURRENT_COURSE.courseId = urlParams.get('courseId');
    if (urlParams.get('clazzid')) CURRENT_COURSE.clazzId = urlParams.get('clazzid');
    if (urlParams.get('cpi')) CURRENT_COURSE.cpi = urlParams.get('cpi');
    // ==================================================

    // ==================== 配置参数 ====================
    var CFG = {
        playRate: 1.0,                    // 播放倍速（原倍速）
        pauseIntervalMin: 60,             // 随机暂停：每60-90秒触发一次
        pauseIntervalMax: 90,
        pauseDurationMin: 3,              // 每次暂停3-6秒
        pauseDurationMax: 6,
        switchDelayMin: 8,                // 章节切换额外延迟8-15秒（防检测）
        switchDelayMax: 15,
        mouseMoveInterval: 45,            // 鼠标移动模拟间隔（秒）
        seekBackChance: 0.05,             // 进度条回退概率5%
        seekBackMin: 3,                   // 回退3-15秒
        seekBackMax: 15,
        watchTimeMin: 0.95                // 观看时长验证：至少95%
    };
    // ==================================================

    // ==================== 运行状态 ====================
    var S = {
        running: false,
        retry: 0,
        doneChapters: new Set(),
        videoCount: 0,
        // 暂停相关
        lastPauseTime: 0,
        nextPauseIn: 0,
        pauseTimer: null,
        isPaused: false,
        // 切换相关
        switching: false,
        switchTimer: null,
        // 鼠标模拟
        mouseTimer: null,
        // 视频状态
        lastVideoSrc: '',
        videoFinished: false,  // 标记视频是否已完成，防止重播
        // 回退相关
        hasSeekBack: false
    };
    // ==================================================

    function log(msg, lv) {
        var t = new Date().toLocaleTimeString();
        var c = { info: '#3A8BFF', ok: '#4CAF50', warn: '#FF9800', err: '#f44336' };
        console.log('%c[刷视频 ' + t + '] ' + msg, 'color:' + (c[lv] || c.info));
    }

    function ri(a, b) {
        return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    // ============================================================
    //  视频操作
    // ============================================================

    function getVideo() {
        // 先在顶层找
        var v = document.querySelector('video');
        if (v) return v;
        // 递归搜索嵌套iframe
        function deep(doc, d) {
            if (d > 5) return null;
            var ifs = doc.querySelectorAll('iframe');
            for (var i = 0; i < ifs.length; i++) {
                try {
                    var id = ifs[i].contentDocument || ifs[i].contentWindow.document;
                    if (!id) continue;
                    var iv = id.querySelector('video');
                    if (iv) return iv;
                    var r = deep(id, d + 1);
                    if (r) return r;
                } catch (e) {}
            }
            return null;
        }
        return deep(document, 0);
    }

    function ensurePlaying(v) {
        if (!v || !v.paused) return;
        try { v.play(); return; } catch (e) {}
        try { v.click(); return; } catch (e) {}
        try {
            var r = v.getBoundingClientRect();
            var cx = r.left + r.width / 2;
            var cy = r.top + r.height / 2;
            v.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
            v.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
        } catch (e) {}
    }

    function setRate(v) {
        try { if (Math.abs(v.playbackRate - CFG.playRate) > 0.01) v.playbackRate = CFG.playRate; } catch (e) {}
    }

    function isFinished(v) {
        if (!v) return false;
        try {
            if (v.ended) return true;
            if (v.duration && v.currentTime >= v.duration - 0.5) return true;
        } catch (e) {}
        return false;
    }

    // ============================================================
    //  拟人化1: 随机暂停（每60-90秒暂停3-6秒）
    // ============================================================

    function maybePause(v) {
        if (S.isPaused || v.paused || !v.duration || v.duration < 30) return;

        var played = v.currentTime - S.lastPauseTime;
        if (played >= S.nextPauseIn) {
            var dur = ri(CFG.pauseDurationMin, CFG.pauseDurationMax); // 3-6秒
            log('拟人暂停 ' + dur + 's (已播' + Math.floor(played) + 's)', 'info');

            S.lastPauseTime = v.currentTime;
            S.isPaused = true;
            v.pause();

            if (S.pauseTimer) clearTimeout(S.pauseTimer);
            S.pauseTimer = setTimeout(function () {
                if (S.running) {
                    try { v.play(); } catch (e) {}
                    S.nextPauseIn = ri(CFG.pauseIntervalMin, CFG.pauseIntervalMax); // 下次60-90秒后
                    log('恢复播放, 下次间隔' + S.nextPauseIn + 's', 'info');
                }
                S.isPaused = false;
                S.pauseTimer = null;
            }, dur * 1000);
        }
    }

    // ============================================================
    //  拟人化2: 模拟鼠标移动
    // ============================================================

    function startMouse() {
        stopMouse();
        S.mouseTimer = setInterval(function () {
            if (!S.running) { stopMouse(); return; }
            var e = new MouseEvent('mousemove', {
                view: window, bubbles: true, cancelable: true,
                clientX: ri(100, innerWidth - 100),
                clientY: ri(100, innerHeight - 100)
            });
            document.dispatchEvent(e);
        }, CFG.mouseMoveInterval * 1000);
    }

    function stopMouse() {
        if (S.mouseTimer) { clearInterval(S.mouseTimer); S.mouseTimer = null; }
    }

    // ============================================================
    //  拟人化3: 进度条回退（15%概率，回退3-15秒）
    // ============================================================

    function maybeSeekBack(v) {
        if (S.hasSeekBack || !v.duration || v.currentTime < 30 || v.currentTime > v.duration - 20) return;
        if (Math.random() > CFG.seekBackChance) return;

        var secs = ri(CFG.seekBackMin, CFG.seekBackMax);
        var newPos = Math.max(5, v.currentTime - secs);
        log('拟人回退 ' + secs + 's (' + v.currentTime.toFixed(0) + 's → ' + newPos.toFixed(0) + 's)', 'info');
        v.currentTime = newPos;
        S.hasSeekBack = true;
    }

    // ============================================================
    //  拟人化4: 观看时长验证（确保实际观看 ≥ 视频时长的95%）
    // ============================================================

    function verifyWatchTime(v) {
        if (!v || !v.duration) return true;
        var watched = v.currentTime;
        var required = v.duration * CFG.watchTimeMin;
        if (watched >= required) return true;
        log('时长不足: 已看' + watched.toFixed(0) + 's / 需' + required.toFixed(0) + 's，等待...', 'warn');
        return false;
    }

    // ============================================================
    //  章节/课程切换
    // ============================================================

    function curChapterId() {
        return new URLSearchParams(location.search).get('chapterId') || '';
    }

    // 查找目录元素（支持iframe）
    function findCatalogItems() {
        // 先在顶层找
        var items = document.querySelectorAll('.posCatalog_select');
        if (items.length) return items;

        // 在iframe中找
        function deep(doc, d) {
            if (d > 5) return null;
            var ifs = doc.querySelectorAll('iframe');
            for (var i = 0; i < ifs.length; i++) {
                try {
                    var id = ifs[i].contentDocument || ifs[i].contentWindow.document;
                    if (!id) continue;
                    var it = id.querySelectorAll('.posCatalog_select');
                    if (it.length) return it;
                    var r = deep(id, d + 1);
                    if (r) return r;
                } catch (e) {}
            }
            return null;
        }
        return deep(document, 0) || [];
    }

    function findNext() {
        try {
            var items = findCatalogItems();
            if (!items.length) {
                log('找不到目录元素(.posCatalog_select)', 'warn');
                return null;
            }

            log('找到 ' + items.length + ' 个目录项', 'info');

            var cid = curChapterId();
            log('当前 chapterId: ' + cid, 'info');

            // 从目录项提取chapterId的辅助函数
            // 优先从元素 id 提取: curYOUR_CHAPTER_ID -> YOUR_CHAPTER_ID
            // 其次从onclick的getTeacherAjax调用提取
            // 最后从href提取
            function extractChapterId(it) {
                // 方法1: 从元素id提取
                var rawId = it.id || '';
                if (rawId.indexOf('cur') === 0) return rawId.substring(3);

                // 方法2: 从<a>标签的onclick中提取getTeacherAjax的chapterId参数
                var a = it.querySelector('a');
                if (a) {
                    var onclick = a.getAttribute('onclick') || '';
                    var m = onclick.match(/getTeacherAjax\([^,]+,[^,]+,(\d+)/);
                    if (m) return m[1];

                    // 方法3: 从href提取
                    var href = a.getAttribute('href') || '';
                    var m2 = href.match(/chapterId=(\d+)/);
                    if (m2) return m2[1];
                }
                return '';
            }

            // 调试：打印前5个目录项的提取结果
            for (var d = 0; d < Math.min(5, items.length); d++) {
                var dit = items[d];
                var da = dit.querySelector('a');
                var doc = da ? da.getAttribute('onclick') || '' : '';
                var dex = extractChapterId(dit);
                log('目录项[' + d + '] id=' + dit.id + ' onclick=' + doc.substring(0, 40) + ' 提取id=' + dex, 'info');
            }

            var found = false;

            // 策略1: 找到当前激活项后的第一个未处理章节
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                var id = extractChapterId(it);
                if (!id) continue;  // 跳过无法提取id的项
                if (it.classList.contains('posCatalog_active')) {
                    log('找到激活项: ' + (it.textContent || '').trim().substring(0, 20) + ' (id=' + id + ')', 'info');
                    found = true;
                    continue;
                }
                if (S.doneChapters.has(id)) continue;
                if (found) {
                    log('策略1找到: ' + (it.textContent || '').trim().substring(0, 30) + ' (id=' + id + ')', 'ok');
                    var na = it.querySelector('a');
                    return { el: it, a: na || null, id: id, name: (it.textContent || '').trim().substring(0, 40) };
                }
            }

            // 策略2: 按URL中的chapterId顺序找
            if (cid) {
                var fc = false;
                for (var i = 0; i < items.length; i++) {
                    var it = items[i];
                    var id = extractChapterId(it);
                    if (!id) continue;
                    if (id === cid) { fc = true; continue; }
                    if (fc && !S.doneChapters.has(id)) {
                        log('策略2找到: ' + (it.textContent || '').trim().substring(0, 30) + ' (id=' + id + ')', 'ok');
                        var na = it.querySelector('a');
                        return { el: it, a: na || null, id: id, name: (it.textContent || '').trim().substring(0, 40) };
                    }
                }
            }

            // 策略3: 任意未处理的章节
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                var id = extractChapterId(it);
                if (id && !S.doneChapters.has(id)) {
                    log('策略3找到: ' + (it.textContent || '').trim().substring(0, 30) + ' (id=' + id + ')', 'ok');
                    var na = it.querySelector('a');
                    return { el: it, a: na || null, id: id, name: (it.textContent || '').trim().substring(0, 40) };
                }
            }

            log('所有 ' + items.length + ' 个章节都已处理', 'warn');
            return null;
        } catch (e) {
            log('findNext异常: ' + e.message, 'err');
            return null;
        }
    }

    function goNext() {
        log('goNext() 被调用', 'info');
        try {
            var n = findNext();
            if (!n) {
                log('当前课程所有章节已完成，停止', 'ok');
                updStatus('课程已完成!');
                stop();
                return false;
            }

            log('下一章: ' + n.name + ' (' + n.id + ')', 'ok');
            S.doneChapters.add(n.id);
            S.switching = true;
            S.videoFinished = true;  // 确保在切换期间不会尝试播放
            if (S.switchTimer) clearTimeout(S.switchTimer);

            // 立即暂停视频防止重播
            var v = getVideo();
            if (v) {
                try { v.pause(); } catch (e) {}
                try { v.currentTime = 0; } catch (e) {}
                try { v.loop = false; } catch (e) {}
            }

            var delay = ri(CFG.switchDelayMin, CFG.switchDelayMax) * 1000;
            log('切换延迟: ' + delay + 'ms', 'info');
            S.switchTimer = setTimeout(function () {
                if (!S.running) {
                    log('切换时脚本已停止', 'warn');
                    S.switching = false;
                    return;
                }

                // 获取URL参数
                var p = new URLSearchParams(location.search);
                var courseId = p.get('courseId') || '';
                var clazzid = p.get('clazzid') || p.get('clazzId') || '';
                var cpi = p.get('cpi') || '';
                var enc = p.get('enc') || '';
                var ut = p.get('ut') || 's';

                // 直接刷新整个页面（唯一可靠方式）
                var url = location.origin + location.pathname +
                    '?chapterId=' + n.id +
                    '&courseId=' + courseId +
                    '&clazzid=' + clazzid +
                    '&cpi=' + cpi +
                    '&enc=' + enc +
                    '&ut=' + ut;
                log('刷新页面切换: chapterId=' + n.id, 'ok');
                location.href = url;
            }, delay);

            return true;
        } catch (e) {
            log('goNext异常: ' + e.message, 'err');
            return false;
        }
    }

    // ============================================================
    //  主循环（2秒间隔）
    // ============================================================

    var loopT = null;

    function loop() {
        if (!S.running) return;

        // 切换中则等待
        if (S.switching) {
            // 如果切换后视频已加载（通过视频存在判断），清除切换状态
            var v = getVideo();
            if (v && v.src && v.src !== S.lastVideoSrc) {
                log('切换完成，新视频已加载', 'ok');
                S.switching = false;
                S.videoFinished = false;
                // 继续执行下面的视频处理逻辑
            } else {
                loopT = setTimeout(loop, 2000);
                return;
            }
        }

        var v = getVideo();

        // 找不到视频
        if (!v) {
            S.retry++;
            if (S.retry >= 15) {
                S.retry = 0;
                log('重试过多，尝试切换', 'warn');
                if (!goNext()) return;
            }
            loopT = setTimeout(loop, 2000);
            return;
        }

        S.retry = 0;

        // 新视频检测（通过src判断）
        if (v.src && v.src !== S.lastVideoSrc) {
            S.lastVideoSrc = v.src;
            S.lastPauseTime = v.currentTime || 0;
            S.nextPauseIn = ri(CFG.pauseIntervalMin, CFG.pauseIntervalMax);
            S.hasSeekBack = false;
            S.videoFinished = false;  // 新视频，清除完成标记

            // 如果视频时长未知，等待加载
            if (!v.duration || v.duration === 0) {
                log('新视频加载: ' + (v.src || '').substring(0, 60) + '...', 'info');
            } else {
                log('新视频: ' + Math.floor(v.duration || 0) + 's', 'ok');
            }
        }

        // 基础操作
        setRate(v);
        // 只有在视频未完成且未暂停时才尝试播放
        if (!S.isPaused && !S.videoFinished) ensurePlaying(v);

        // 拟人化
        if (!S.isPaused && !S.videoFinished) {
            maybePause(v);
            maybeSeekBack(v);
        }

        // 完成检测
        if (isFinished(v) && !S.switching && verifyWatchTime(v)) {
            S.videoCount++;
            S.videoFinished = true;  // 立即标记已完成
            log('完成 (第' + S.videoCount + '个)', 'ok');
            updStatus('已刷 ' + S.videoCount + ' 个');

            S.lastPauseTime = 0;
            S.nextPauseIn = ri(CFG.pauseIntervalMin, CFG.pauseIntervalMax);
            S.hasSeekBack = false;

            // 立即暂停视频，清除暂停定时器
            try { v.pause(); v.loop = false; } catch (e) {}
            if (S.pauseTimer) { clearTimeout(S.pauseTimer); S.pauseTimer = null; }

            log('准备切换下一章...', 'info');
            try {
                var result = goNext();
                log('goNext返回: ' + result, 'info');
                if (!result) return;
            } catch (e) {
                log('切换异常: ' + e.message, 'err');
                log('异常堆栈: ' + e.stack, 'err');
                S.switching = false;
                S.videoFinished = false;
            }
        }

        loopT = setTimeout(loop, 2000);
    }

    // ============================================================
    //  控制面板
    // ============================================================

    function updStatus(t) {
        var e = document.getElementById('ap-st');
        if (e) e.textContent = t;
    }

    function makePanel() {
        if (document.getElementById('ap-panel')) return;

        var d = document.createElement('div');
        d.id = 'ap-panel';
        d.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#1e1e2e;color:#fff;padding:14px 18px;border-radius:10px;font:13px/1.6 sans-serif;min-width:260px;box-shadow:0 8px 32px rgba(0,0,0,.4);';

        d.innerHTML =
            '<div style="font:bold 14px sans-serif;margin-bottom:6px;">自动刷视频 v5</div>' +
            '<div style="font-size:10px;color:#888;margin-bottom:8px;">1x倍速 | 暂停60-90s/3-6s | 鼠标模拟 | 进度回退5%</div>' +
            '<div id="ap-course" style="color:#4ade80;margin-bottom:6px;">当前课程</div>' +
            '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
            '<button id="ap-go" style="flex:1;padding:6px;border:none;border-radius:5px;background:#22c55e;color:#fff;cursor:pointer;font-size:12px;">开始</button>' +
            '<button id="ap-stop" style="flex:1;padding:6px;border:none;border-radius:5px;background:#ef4444;color:#fff;cursor:pointer;font-size:12px;">停止</button></div>' +
            '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
            '<button id="ap-rst" style="flex:1;padding:5px;border:none;border-radius:5px;background:#f59e0b;color:#fff;cursor:pointer;font-size:11px;">重置</button></div>' +
            '<div id="ap-st" style="font-size:11px;background:rgba(255,255,255,.08);padding:5px 8px;border-radius:4px;">等待启动</div>';

        document.body.appendChild(d);

        document.getElementById('ap-go').onclick = function () { start(); updStatus('运行中'); };
        document.getElementById('ap-stop').onclick = function () { stop(); updStatus('已停止'); };
        document.getElementById('ap-rst').onclick = function () { reset(); updStatus('已重置'); };
    }

    // ============================================================
    //  启停控制
    // ============================================================

    function start() {
        if (S.running) return;
        S.running = true;
        S.retry = 0;
        S.switching = false;
        log('=== 开始 ===', 'ok');
        loop();
        startMouse();
    }

    function stop() {
        S.running = false;
        if (loopT) { clearTimeout(loopT); loopT = null; }
        if (S.pauseTimer) { clearTimeout(S.pauseTimer); S.pauseTimer = null; }
        if (S.switchTimer) { clearTimeout(S.switchTimer); S.switchTimer = null; }
        stopMouse();
        log('=== 停止 ===', 'warn');
    }

    function reset() {
        stop();
        S.doneChapters.clear();
        S.videoCount = 0;
        S.retry = 0;
        S.lastVideoSrc = '';
        S.lastPauseTime = 0;
        S.nextPauseIn = 0;
        S.switching = false;
        S.isPaused = false;
        S.hasSeekBack = false;
        S.videoFinished = false;
    }

    // ============================================================
    //  入口
    // ============================================================

    function init() {
        makePanel();
        // 显示当前课程名
        var courseEl = document.getElementById('ap-course');
        if (courseEl && CURRENT_COURSE.name) {
            courseEl.textContent = CURRENT_COURSE.name;
        }
        setTimeout(function () {
            log('自动启动', 'ok');
            start();
            updStatus('自动运行中');
        }, 5000);
    }

    window.autoPlayVideo = { start: start, stop: stop, reset: reset };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
