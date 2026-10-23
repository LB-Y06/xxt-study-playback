// ==UserScript==
// @name         学习页面播放助手（实验原型）
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description   学习页面视频元素检测与播放状态辅助，课程地址需由使用者自行配置。
// @author       Project Maintainer
// @match        *://*.chaoxing.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 防止重复注入
    if (window._autoVideoScriptInjected) {
        return;
    }
    window._autoVideoScriptInjected = true;

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

    // 使用全局状态（SPA模式下保持共享）
    if (!window._autoVideoState) {
        window._autoVideoState = {
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
            switching: false,
            autoPlayAttempted: false
        };
    }
    var S = window._autoVideoState;

    // 从 sessionStorage 恢复状态
    try {
        var savedIdx = sessionStorage.getItem('ap_idx');
        var savedCnt = sessionStorage.getItem('ap_cnt');
        var savedRunning = sessionStorage.getItem('ap_running');
        if (savedIdx) S.currentIndex = parseInt(savedIdx);
        if (savedCnt) S.videoCount = parseInt(savedCnt);
        if (savedRunning === '1') S.running = true;
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
        // 尝试从顶层页面获取chapterId（视频在iframe里）
        try {
            if (window.top && window.top !== window) {
                var topParams = new URLSearchParams(window.top.location.search);
                var topCid = topParams.get('chapterId');
                if (topCid) return topCid;
            }
        } catch (e) {}
        
        // 兜底：从当前页面获取
        return new URLSearchParams(location.search).get('chapterId') || '';
    }

    function goToNext() {
        if (S.switching) return;
        S.switching = true;

        var cid = getCurrentChapterId();
        var nextIdx = -1;
        for (var i = 0; i < VIDEO_URLS.length; i++) {
            if (getChapterIdFromUrl(VIDEO_URLS[i]) === cid) {
                nextIdx = i + 1;
                break;
            }
        }

        if (nextIdx < 0) nextIdx = S.currentIndex;
        if (nextIdx >= VIDEO_URLS.length) {
            log('所有章节已完成!', 'ok');
            updStatus('全部完成!');
            try {
                sessionStorage.removeItem('ap_idx');
                sessionStorage.removeItem('ap_cnt');
                sessionStorage.removeItem('ap_running');
            } catch(e) {}
            stop();
            return;
        }

        S.currentIndex = nextIdx;
        S.autoPlayAttempted = false;
        try {
            sessionStorage.setItem('ap_idx', nextIdx);
            sessionStorage.setItem('ap_cnt', S.videoCount);
            sessionStorage.setItem('ap_running', '1');
        } catch(e) {}

        var delay = ri(CFG.switchDelayMin, CFG.switchDelayMax) * 1000;
        log('准备跳转第' + (nextIdx + 1) + '/' + VIDEO_URLS.length + '个视频, 延迟' + (delay/1000) + 's', 'info');

        var nextUrl = VIDEO_URLS[nextIdx];
        if (nextUrl.indexOf('autoPlay=1') === -1) {
            nextUrl = nextUrl + '&autoPlay=1';
        }

        setTimeout(function () {
            if (!S.running) { S.switching = false; return; }
            log('正在跳转...', 'info');
            if (window.top && window.top !== window) {
                window.top.location.href = nextUrl;
            } else {
                window.location.href = nextUrl;
            }
        }, delay);
    }

    function tryAutoPlay() {
        if (S.autoPlayAttempted) return;
        S.autoPlayAttempted = true;

        var attempts = 0;
        var maxAttempts = 10;

        function doTry() {
            if (attempts >= maxAttempts) {
                log('自动播放放弃', 'warn');
                return;
            }
            attempts++;

            var v = getVideo();
            if (!v) {
                log('尝试播放 ' + attempts + '/' + maxAttempts + ' (找不到视频)', 'info');
                setTimeout(doTry, 2000);
                return;
            }

            if (!v.paused) {
                log('视频已在播放', 'ok');
                return;
            }

            log('尝试播放 ' + attempts + '/' + maxAttempts, 'info');
            try { v.play(); } catch (e) {
                log('play()失败: ' + e.message, 'warn');
            }
            try { v.click(); } catch (e) {}

            if (v.paused) {
                setTimeout(doTry, 2000);
            }
        }

        setTimeout(doTry, 2000);
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
            if (v.paused && v.currentTime > 0 && v.currentTime >= (v.duration || 0) * 0.95) return true;
        } catch (e) {}
        return false;
    }

    // 劫持学习通的完成回调
    function hookComplete() {
        if (window._hookedComplete) return;
        window._hookedComplete = true;

        // 拦截 JC.completed
        try {
            if (typeof JC !== 'undefined' && JC.completed) {
                var origCompleted = JC.completed;
                JC.completed = function() {
                    log('检测到 JC.completed, 准备跳转', 'ok');
                    if (S.running && !S.switching) {
                        setTimeout(function() { goToNext(); }, 2000);
                    }
                    return origCompleted.apply(this, arguments);
                };
                log('已劫持 JC.completed', 'ok');
            }
        } catch (e) {}

        // 拦截 ed_completed
        try {
            var origEdComplete = window.ed_completed;
            if (typeof origEdComplete === 'function') {
                window.ed_completed = function() {
                    log('检测到 ed_completed, 准备跳转', 'ok');
                    if (S.running && !S.switching) {
                        setTimeout(function() { goToNext(); }, 2000);
                    }
                    return origEdComplete.apply(this, arguments);
                };
                log('已劫持 ed_completed', 'ok');
            }
        } catch (e) {}
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
                log('找不到视频, 尝试跳转', 'warn');
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

            if (new URLSearchParams(location.search).get('autoPlay') === '1') {
                tryAutoPlay();
            }
        }

        setRate(v);
        if (!S.isPaused) ensurePlaying(v);

        if (!S.isPaused) {
            maybePause(v);
            maybeSeekBack(v);
        }

        if (isFinished(v) && !S.switching && verifyWatchTime(v)) {
            S.videoCount++;
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
            '<div style="font:bold 14px sans-serif;margin-bottom:6px;">自动刷视频 v12 (SPA版)</div>' +
            '<div style="font-size:10px;color:#888;margin-bottom:8px;">1x倍速 | URL跳转+自动播放 | SPA兼容</div>' +
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
        S.autoPlayAttempted = false;
        try { sessionStorage.setItem('ap_running', '1'); } catch(e) {}
        log('=== 开始 ===', 'ok');
        loop();
    }

    function stop() {
        S.running = false;
        if (loopT) { clearTimeout(loopT); loopT = null; }
        if (S.pauseTimer) { clearTimeout(S.pauseTimer); S.pauseTimer = null; }
        try { sessionStorage.removeItem('ap_running'); } catch(e) {}
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
        S.autoPlayAttempted = false;
        try {
            sessionStorage.removeItem('ap_idx');
            sessionStorage.removeItem('ap_cnt');
            sessionStorage.removeItem('ap_running');
        } catch(e) {}
    }

    function init() {
        makePanel();
        hookComplete();

        if (new URLSearchParams(location.search).get('autoPlay') === '1' && S.running) {
            log('检测到自动跳转，恢复运行', 'ok');
            setTimeout(function() {
                loop();
                updStatus('自动运行中');
            }, 2000);
        } else if (S.running) {
            setTimeout(function() {
                loop();
                updStatus('自动运行中');
            }, 3000);
        } else {
            setTimeout(function () {
                log('等待手动启动', 'info');
                updStatus('等待启动');
            }, 2000);
        }
    }

    window.autoPlayVideo = { start: start, stop: stop, reset: reset };

    // SPA URL 变化监听
    var lastUrl = location.href;
    function onUrlChange() {
        var currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            log('检测到URL变化: ' + currentUrl, 'info');

            // 移除旧面板
            var oldPanel = document.getElementById('ap-panel');
            if (oldPanel) oldPanel.remove();

            // 重置视频相关状态
            S.lastVideoSrc = '';
            S.switching = false;
            S.autoPlayAttempted = false;

            // 重新初始化
            init();
        }
    }

    // 监听 pushState / replaceState
    var origPushState = history.pushState;
    var origReplaceState = history.replaceState;
    history.pushState = function() {
        origPushState.apply(history, arguments);
        onUrlChange();
    };
    history.replaceState = function() {
        origReplaceState.apply(history, arguments);
        onUrlChange();
    };

    // 同时用定时器检测（兜底）
    setInterval(onUrlChange, 1000);

    // 监听 popstate（浏览器前进后退）
    window.addEventListener('popstate', onUrlChange);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
