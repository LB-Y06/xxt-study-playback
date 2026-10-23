/**
 * 学习通自动刷视频 v10 - 点击目录+自动播放版
 */
(function () {
    'use strict';

    var VIDEO_URLS = [
        // 在这里填入你有权访问的课程页面地址，并用逗号分隔。
    ];

    var CFG = {
        playRate: 1.0,
        pauseIntervalMin: 60,
        pauseIntervalMax: 90,
        pauseDurationMin: 3,
        pauseDurationMax: 6,
        switchDelayMin: 8,
        switchDelayMax: 15,
        seekBackChance: 0.05,
        seekBackMin: 3,
        seekBackMax: 15,
        watchTimeMin: 0.95
    };

    var S = {
        running: false,
        currentIndex: 0,
        videoCount: 0,
        lastPauseTime: 0,
        nextPauseIn: 0,
        pauseTimer: null,
        isPaused: false,
        lastVideoSrc: '',
        hasSeekBack: false,
        retryCount: 0,
        switching: false
    };

    try {
        var savedIdx = sessionStorage.getItem('ap_idx');
        var savedCnt = sessionStorage.getItem('ap_cnt');
        if (savedIdx) S.currentIndex = parseInt(savedIdx);
        if (savedCnt) S.videoCount = parseInt(savedCnt);
    } catch(e) {}

    function log(msg, lv) {
        var t = new Date().toLocaleTimeString();
        var c = { info: '#3A8BFF', ok: '#4CAF50', warn: '#FF9800', err: '#f44336' };
        console.log('%c[刷视频 ' + t + '] ' + msg, 'color:' + (c[lv] || c.info));
    }

    function ri(a, b) {
        return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    function getVideo() {
        var v = document.querySelector('video');
        if (v) return v;
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

    function getChapterIdFromUrl(url) {
        var m = url.match(/chapterId=(\d+)/);
        return m ? m[1] : '';
    }

    function getCurrentChapterId() {
        return new URLSearchParams(location.search).get('chapterId') || '';
    }

    function findNextChapterElement() {
        var cid = getCurrentChapterId();
        var items = document.querySelectorAll('.posCatalog_select');
        if (!items.length) return null;

        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var rawId = it.id || '';
            var id = '';
            if (rawId.indexOf('cur') === 0) id = rawId.substring(3);
            else if (/^\d+$/.test(rawId)) id = rawId;

            if (id === cid) {
                for (var j = i + 1; j < items.length; j++) {
                    var next = items[j];
                    var nId = '';
                    var nRaw = next.id || '';
                    if (nRaw.indexOf('cur') === 0) nId = nRaw.substring(3);
                    else if (/^\d+$/.test(nRaw)) nId = nRaw;

                    if (nId) return next;
                }
                break;
            }
        }
        return null;
    }

    function clickChapter(el) {
        var span = el.querySelector('span.posCatalog_name');
        if (!span) span = el.querySelector('span');
        if (!span) span = el;

        var onclick = span.getAttribute('onclick') || '';
        var params = onclick.match(/getTeacherAjax\('([^']+)','([^']+)','([^']+)'\)/);
        if (params && typeof getTeacherAjax === 'function') {
            log('调用getTeacherAjax切换', 'ok');
            getTeacherAjax(params[1], params[2], params[3], '', '', '', 'false', 1);
            return true;
        }

        try {
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(function() {
                var rect = span.getBoundingClientRect();
                var ev = new MouseEvent('click', {
                    view: window, bubbles: true, cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                span.dispatchEvent(ev);
                log('已点击目录项', 'ok');
            }, 300);
            return true;
        } catch (e) {
            log('点击失败: ' + e.message, 'warn');
            return false;
        }
    }

    function tryPlayAfterSwitch() {
        var attempts = 0;
        var maxAttempts = 8;

        function doTry() {
            if (attempts >= maxAttempts) return;
            attempts++;

            var v = getVideo();
            if (!v) {
                setTimeout(doTry, 2000);
                return;
            }

            if (!v.paused) {
                log('视频已在播放', 'ok');
                return;
            }

            log('尝试播放 ' + attempts + '/' + maxAttempts, 'info');
            try { v.play(); } catch (e) {}
            try { v.click(); } catch (e) {}

            if (v.paused) {
                setTimeout(doTry, 2000);
            }
        }

        setTimeout(doTry, 3000);
    }

    function goToNext() {
        if (S.switching) return;
        S.switching = true;

        var nextEl = findNextChapterElement();
        if (!nextEl) {
            log('所有章节已完成!', 'ok');
            updStatus('全部完成!');
            try { sessionStorage.removeItem('ap_idx'); sessionStorage.removeItem('ap_cnt'); } catch(e) {}
            stop();
            return;
        }

        S.videoCount++;
        var delay = ri(CFG.switchDelayMin, CFG.switchDelayMax) * 1000;
        log('准备切换下一章, 延迟' + (delay/1000) + 's', 'info');

        setTimeout(function () {
            if (!S.running) { S.switching = false; return; }
            log('正在点击切换...', 'info');
            clickChapter(nextEl);

            setTimeout(function() {
                S.switching = false;
                S.lastVideoSrc = '';
                S.videoFinished = false;
                tryPlayAfterSwitch();
            }, 5000);
        }, delay);
    }

    function ensurePlaying(v) {
        if (!v || !v.paused) return;
        try { v.play(); return; } catch (e) {}
        try { v.click(); return; } catch (e) {}
        try {
            var r = v.getBoundingClientRect();
            var ev = new MouseEvent('click', { view: window, bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
            v.dispatchEvent(ev);
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

    function maybePause(v) {
        if (S.isPaused || v.paused || !v.duration || v.duration < 30) return;
        var played = v.currentTime - S.lastPauseTime;
        if (played >= S.nextPauseIn) {
            var dur = ri(CFG.pauseDurationMin, CFG.pauseDurationMax);
            log('拟人暂停 ' + dur + 's (已播' + Math.floor(played) + 's)', 'info');
            S.lastPauseTime = v.currentTime;
            S.isPaused = true;
            v.pause();
            if (S.pauseTimer) clearTimeout(S.pauseTimer);
            S.pauseTimer = setTimeout(function () {
                if (S.running) {
                    try { v.play(); } catch (e) {}
                    S.nextPauseIn = ri(CFG.pauseIntervalMin, CFG.pauseIntervalMax);
                    log('恢复播放, 下次间隔' + S.nextPauseIn + 's', 'info');
                }
                S.isPaused = false;
                S.pauseTimer = null;
            }, dur * 1000);
        }
    }

    function maybeSeekBack(v) {
        if (S.hasSeekBack || !v.duration || v.currentTime < 30 || v.currentTime > v.duration - 20) return;
        if (Math.random() > CFG.seekBackChance) return;
        var secs = ri(CFG.seekBackMin, CFG.seekBackMax);
        var newPos = Math.max(5, v.currentTime - secs);
        log('拟人回退 ' + secs + 's', 'info');
        v.currentTime = newPos;
        S.hasSeekBack = true;
    }

    function verifyWatchTime(v) {
        if (!v || !v.duration) return true;
        var watched = v.currentTime;
        var required = v.duration * CFG.watchTimeMin;
        if (watched >= required) return true;
        log('时长不足: 已看' + watched.toFixed(0) + 's / 需' + required.toFixed(0) + 's', 'warn');
        return false;
    }

    var loopT = null;

    function loop() {
        if (!S.running) return;
        var v = getVideo();

        if (!v) {
            S.retryCount++;
            if (S.retryCount >= 30 && !S.switching) {
                S.retryCount = 0;
                log('找不到视频, 尝试切换', 'warn');
                goToNext();
            }
            loopT = setTimeout(loop, 2000);
            return;
        }

        S.retryCount = 0;

        if (v.src && v.src !== S.lastVideoSrc) {
            S.lastVideoSrc = v.src;
            S.lastPauseTime = v.currentTime || 0;
            S.nextPauseIn = ri(CFG.pauseIntervalMin, CFG.pauseIntervalMax);
            S.hasSeekBack = false;
            S.switching = false;
            log('新视频加载: ' + (v.duration ? Math.floor(v.duration) + 's' : '未知时长'), 'ok');
        }

        setRate(v);
        if (!S.isPaused) ensurePlaying(v);

        if (!S.isPaused) {
            maybePause(v);
            maybeSeekBack(v);
        }

        if (isFinished(v) && !S.switching && verifyWatchTime(v)) {
            log('完成 第' + S.videoCount + '个', 'ok');
            updStatus('已刷 ' + S.videoCount + ' 个');

            S.lastPauseTime = 0;
            S.nextPauseIn = ri(CFG.pauseIntervalMin, CFG.pauseIntervalMax);
            S.hasSeekBack = false;

            try { v.pause(); v.loop = false; } catch (e) {}
            if (S.pauseTimer) { clearTimeout(S.pauseTimer); S.pauseTimer = null; }

            goToNext();
        }

        loopT = setTimeout(loop, 2000);
    }

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
            '<div style="font:bold 14px sans-serif;margin-bottom:6px;">自动刷视频 v10</div>' +
            '<div style="font-size:10px;color:#888;margin-bottom:8px;">1x倍速 | 点击目录</div>' +
            '<div id="ap-course" style="color:#4ade80;margin-bottom:6px;">' + VIDEO_URLS.length + ' 个视频</div>' +
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

    function start() {
        if (S.running) return;
        S.running = true;
        S.retryCount = 0;
        log('=== 开始 ===', 'ok');
        loop();
    }

    function stop() {
        S.running = false;
        if (loopT) { clearTimeout(loopT); loopT = null; }
        if (S.pauseTimer) { clearTimeout(S.pauseTimer); S.pauseTimer = null; }
        log('=== 停止 ===', 'warn');
    }

    function reset() {
        stop();
        S.currentIndex = 0;
        S.videoCount = 0;
        S.retryCount = 0;
        S.lastVideoSrc = '';
        S.lastPauseTime = 0;
        S.nextPauseIn = 0;
        S.isPaused = false;
        S.hasSeekBack = false;
        S.switching = false;
    }

    function init() {
        makePanel();
        setTimeout(function () {
            log('自动启动', 'ok');
            start();
            updStatus('自动运行中');
        }, 3000);
    }

    window.autoPlayVideo = { start: start, stop: stop, reset: reset };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
