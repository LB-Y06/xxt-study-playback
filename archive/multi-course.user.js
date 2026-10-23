// ==UserScript==
// @name         学习页面播放助手（实验原型）
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description   学习页面视频元素检测与播放状态辅助，课程地址需由使用者自行配置。
// @author       Project Maintainer
// @match        *://*.chaoxing.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// @all_frames   true
// ==/UserScript==

(function() {
    'use strict';

    console.log('%c[学习通脚本] 脚本已加载', 'color: green; font-size: 16px; font-weight: bold;');
    console.log('[学习通脚本] 当前 URL:', window.location.href);

    const COURSES = [
        {
            name: 'YOUR_COURSE_NAME',
            courseId: 'YOUR_COURSE_ID',
            clazzId: 'YOUR_CLASS_ID',
            cpi: 'YOUR_CPI',
            ut: 'YOUR_UT',
            startChapterId: 'YOUR_CHAPTER_ID'
        }
    ];

    const CONFIG = {
        checkInterval: 3000,
        switchDelay: 3000,
        courseSwitchDelay: 5000,
        playRate: 1.0,
        maxRetry: 10,
        autoStartDelay: 5000,
        enableAutoCourseSwitch: true,

        randomPauseEnabled: true,
        randomPauseMinSeconds: 5,
        randomPauseMaxSeconds: 30,
        randomPauseChance: 0.3,

        randomDelayEnabled: true,
        randomDelayMinSeconds: 3,
        randomDelayMaxSeconds: 15,

        mouseMoveEnabled: true,
        mouseMoveIntervalSeconds: 30,
        mouseMoveDuration: 500,

        seekBackEnabled: true,
        seekBackChance: 0.15,
        seekBackMinSeconds: 3,
        seekBackMaxSeconds: 15,

        watchTimeVerifyEnabled: true,
        watchTimeMinPercent: 0.95
    };

    let state = {
        isRunning: false,
        currentCourseIndex: parseInt(GM_getValue('currentCourseIndex', '0')) || 0,
        retryCount: 0,
        processedChapters: new Set(),
        lastChapterId: GM_getValue('lastChapterId', '') || '',
        videoCount: parseInt(GM_getValue('videoCount', '0')) || 0,
        currentVideo: null,
        videoStartTime: 0,
        videoStartPos: 0,
        isPausedByScript: false,
        seekBackDone: false,
        mouseMoveTimer: null
    };

    function log(msg, level) {
        var time = new Date().toLocaleTimeString();
        var colors = { info: '#3A8BFF', success: '#4CAF50', warning: '#FF9800', error: '#f44336' };
        var c = colors[level] || colors.info;
        console.log('%c[自动刷视频 ' + time + '] ' + msg, 'color: ' + c);
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    function delay(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    function getVideoElement() {
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
            try {
                var iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                if (iframeDoc) {
                    var video = iframeDoc.querySelector('video');
                    if (video) return { video: video, iframe: iframes[i], isIframe: true };
                }
            } catch (e) { continue; }
        }
        var video = document.querySelector('video');
        if (video) return { video: video, isIframe: false };
        return null;
    }

    function setVideoRate(video) {
        try {
            if (Math.abs(video.playbackRate - CONFIG.playRate) > 0.01) {
                video.playbackRate = CONFIG.playRate;
                log('已设置播放速率: ' + CONFIG.playRate + 'x', 'success');
            }
        } catch (e) {}
    }

    function playVideo(video) {
        try {
            if (video.paused) {
                video.play();
                log('开始播放视频', 'success');
                return true;
            }
        } catch (e) { log('播放失败: ' + e.message, 'error'); }
        return false;
    }

    function getCurrentChapterId() {
        var urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('chapterId') || '';
    }

    function findNextUnfinishedChapter() {
        log('查找下一个未完成视频...', 'info');

        var catalogItems = document.querySelectorAll('.posCatalog_select');
        if (catalogItems.length === 0) {
            log('未找到目录项，页面可能还在加载', 'warning');
            return null;
        }

        var foundCurrent = false;
        var currentChapterId = getCurrentChapterId();

        for (var i = 0; i < catalogItems.length; i++) {
            var item = catalogItems[i];
            var chapterLink = item.querySelector('a');
            if (!chapterLink) continue;

            var href = chapterLink.getAttribute('href') || '';
            var chapterIdMatch = href.match(/chapterId=(\d+)/);
            var chapterId = chapterIdMatch ? chapterIdMatch[1] : '';

            if (state.processedChapters.has(chapterId)) continue;

            var hasVideoIcon = item.querySelector('.catalog_ico_video, .Mca01') !== null;
            var isActive = item.classList.contains('posCatalog_active');

            if (chapterId === currentChapterId) {
                foundCurrent = true;
                continue;
            }

            if (foundCurrent && hasVideoIcon) {
                log('找到下一个视频: ' + chapterId, 'success');
                return item;
            }

            if (!foundCurrent && hasVideoIcon && !isActive) {
                if (currentChapterId && !state.processedChapters.has(currentChapterId)) {
                    continue;
                }
                log('找到下一个视频: ' + chapterId, 'success');
                return item;
            }
        }

        if (currentChapterId && !state.processedChapters.has(currentChapterId)) {
            var currentActive = document.querySelector('.posCatalog_active');
            if (currentActive) {
                log('当前章节尚未完成: ' + currentChapterId, 'info');
                return currentActive;
            }
        }

        log('当前课程所有视频已处理完成', 'success');
        return null;
    }

    function switchToNextVideo() {
        log('准备切换到下一个视频...', 'info');
        var nextChapter = findNextUnfinishedChapter();

        if (nextChapter) {
            var link = nextChapter.querySelector('a');
            if (link) {
                var href = link.getAttribute('href');
                var chapterIdMatch = href.match(/chapterId=(\d+)/);
                var chapterId = chapterIdMatch ? chapterIdMatch[1] : '';

                state.processedChapters.add(chapterId);
                state.lastChapterId = chapterId;
                GM_setValue('lastChapterId', chapterId);

                var switchDelay = CONFIG.switchDelay;
                if (CONFIG.randomDelayEnabled) {
                    var extraDelay = randomInt(CONFIG.randomDelayMinSeconds * 1000, CONFIG.randomDelayMaxSeconds * 1000);
                    switchDelay += extraDelay;
                    log('拟人化: 随机延迟 ' + (extraDelay / 1000) + ' 秒后切换', 'info');
                }

                setTimeout(function() {
                    log('点击切换视频', 'info');
                    link.click();
                }, switchDelay);
                return true;
            }
        }
        return false;
    }

    function getCourseUrl(course) {
        var baseUrl = 'https://mooc1.chaoxing.com/mycourse/studentstudy';
        var params = 'chapterId=' + course.startChapterId + '&courseId=' + course.courseId + '&clazzid=' + course.clazzId + '&cpi=' + course.cpi + '&ut=' + course.ut;
        return baseUrl + '?' + params;
    }

    function switchToNextCourse() {
        if (!CONFIG.enableAutoCourseSwitch) {
            log('已关闭自动切换课程功能', 'warning');
            return false;
        }

        state.currentCourseIndex++;
        GM_setValue('currentCourseIndex', state.currentCourseIndex.toString());

        if (state.currentCourseIndex >= COURSES.length) {
            log('所有课程已全部完成！', 'success');
            state.isRunning = false;
            return false;
        }

        var nextCourse = COURSES[state.currentCourseIndex];
        log('准备切换到下一门课程: ' + nextCourse.name, 'info');

        state.processedChapters.clear();
        state.retryCount = 0;
        GM_setValue('lastChapterId', '');
        state.lastChapterId = '';

        setTimeout(function() {
            log('跳转到: ' + nextCourse.name, 'success');
            window.location.href = getCourseUrl(nextCourse);
        }, CONFIG.courseSwitchDelay);

        return true;
    }

    function handleRandomPause(video) {
        if (!CONFIG.randomPauseEnabled) return false;
        if (state.isPausedByScript) return false;
        if (Math.random() > CONFIG.randomPauseChance) return false;
        if (!video.duration || video.currentTime < 10) return false;
        if (video.currentTime > video.duration - 10) return false;

        var pauseSeconds = randomInt(CONFIG.randomPauseMinSeconds, CONFIG.randomPauseMaxSeconds);
        log('拟人化: 随机暂停 ' + pauseSeconds + ' 秒', 'info');

        state.isPausedByScript = true;
        video.pause();

        setTimeout(function() {
            if (state.isRunning) {
                video.play();
                log('拟人化: 暂停结束，继续播放', 'info');
            }
            state.isPausedByScript = false;
        }, pauseSeconds * 1000);

        return true;
    }

    function startMouseMoveSimulation() {
        if (!CONFIG.mouseMoveEnabled) return;
        stopMouseMoveSimulation();

        var intervalMs = CONFIG.mouseMoveIntervalSeconds * 1000;

        state.mouseMoveTimer = setInterval(function() {
            if (!state.isRunning) {
                stopMouseMoveSimulation();
                return;
            }

            var x = randomInt(100, window.innerWidth - 100);
            var y = randomInt(100, window.innerHeight - 100);

            log('拟人化: 模拟鼠标移动到 (' + x + ', ' + y + ')', 'info');

            var mouseEvent = new MouseEvent('mousemove', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                screenX: x,
                screenY: y
            });
            document.dispatchEvent(mouseEvent);

            var videoInfo = getVideoElement();
            if (videoInfo && videoInfo.video) {
                var rect = videoInfo.video.getBoundingClientRect();
                var videoEvent = new MouseEvent('mousemove', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                videoInfo.video.dispatchEvent(videoEvent);
            }
        }, intervalMs);

        log('拟人化: 鼠标移动模拟已启动 (每 ' + CONFIG.mouseMoveIntervalSeconds + ' 秒)', 'info');
    }

    function stopMouseMoveSimulation() {
        if (state.mouseMoveTimer) {
            clearInterval(state.mouseMoveTimer);
            state.mouseMoveTimer = null;
        }
    }

    function handleSeekBack(video) {
        if (!CONFIG.seekBackEnabled) return false;
        if (state.seekBackDone) return false;
        if (Math.random() > CONFIG.seekBackChance) return false;
        if (!video.duration || video.currentTime < 30) return false;
        if (video.currentTime > video.duration - 20) return false;

        var seekSeconds = randomInt(CONFIG.seekBackMinSeconds, CONFIG.seekBackMaxSeconds);
        var newPos = Math.max(5, video.currentTime - seekSeconds);

        log('拟人化: 进度条回退 ' + seekSeconds + ' 秒 (从 ' + video.currentTime.toFixed(1) + 's 到 ' + newPos.toFixed(1) + 's)', 'info');

        video.currentTime = newPos;
        state.seekBackDone = true;

        return true;
    }

    function checkWatchTime(video) {
        if (!CONFIG.watchTimeVerifyEnabled) return true;
        if (!video.duration) return true;

        var watchTime = (Date.now() - state.videoStartTime) / 1000;
        var requiredTime = video.duration * CONFIG.watchTimeMinPercent;

        if (watchTime >= requiredTime) {
            log('观看时长验证通过: 已观看 ' + watchTime.toFixed(1) + 's / 需要 ' + requiredTime.toFixed(1) + 's', 'success');
            return true;
        }

        var remaining = requiredTime - watchTime;
        log('观看时长不足: 已观看 ' + watchTime.toFixed(1) + 's / 需要 ' + requiredTime.toFixed(1) + 's, 还需 ' + remaining.toFixed(1) + 's', 'warning');
        return false;
    }

    function initVideoState(video) {
        state.currentVideo = video;
        state.videoStartTime = Date.now();
        state.videoStartPos = video.currentTime || 0;
        state.seekBackDone = false;
        state.isPausedByScript = false;
    }

    function isVideoChanged(video) {
        if (state.currentVideo !== video) return true;
        if (video.src && state.currentVideo && state.currentVideo.src !== video.src) return true;
        return false;
    }

    function mainLoop() {
        if (!state.isRunning) return;

        var videoInfo = getVideoElement();

        if (!videoInfo) {
            state.retryCount++;
            if (state.retryCount >= CONFIG.maxRetry) {
                log('重试次数过多，尝试切换下一节', 'warning');
                state.retryCount = 0;

                if (!switchToNextVideo()) {
                    log('当前课程视频已全部完成', 'success');
                    state.videoCount++;
                    GM_setValue('videoCount', state.videoCount.toString());

                    if (!switchToNextCourse()) {
                        log('所有课程已完成，任务结束', 'success');
                        state.isRunning = false;
                        stopMouseMoveSimulation();
                        updateStatus('全部完成');
                        return;
                    }
                }
            }
            setTimeout(mainLoop, CONFIG.checkInterval);
            return;
        }

        state.retryCount = 0;
        var video = videoInfo.video;

        if (isVideoChanged(video)) {
            log('检测到新视频，初始化状态', 'info');
            initVideoState(video);
        }

        setVideoRate(video);

        if (video.paused && !state.isPausedByScript) {
            playVideo(video);
        }

        handleRandomPause(video);
        handleSeekBack(video);

        if (!video.paused && !state.isPausedByScript) {
            var watchTimeOk = checkWatchTime(video);

            if (isVideoFinished(video) && watchTimeOk) {
                log('视频播放完成', 'success');
                state.videoCount++;
                GM_setValue('videoCount', state.videoCount.toString());

                if (!switchToNextVideo()) {
                    log('当前课程所有视频已完成', 'success');
                    if (!switchToNextCourse()) {
                        log('所有课程已完成，任务结束', 'success');
                        state.isRunning = false;
                        stopMouseMoveSimulation();
                        updateStatus('全部完成');
                        return;
                    }
                }
            }
        }

        setTimeout(mainLoop, CONFIG.checkInterval);
    }

    function startAutoPlay() {
        if (state.isRunning) { log('已在运行中', 'warning'); return; }
        state.isRunning = true;
        state.retryCount = 0;
        log('=== 开始自动刷视频 ===', 'success');
        log('当前课程: ' + COURSES[state.currentCourseIndex].name, 'info');
        log('拟人化功能已启用: 随机暂停/随机延迟/鼠标移动/进度条回退/时长验证', 'info');
        mainLoop();
        startMouseMoveSimulation();
    }

    function stopAutoPlay() {
        state.isRunning = false;
        stopMouseMoveSimulation();
        log('=== 已停止 ===', 'warning');
    }

    function resetState() {
        state.currentCourseIndex = 0;
        state.processedChapters.clear();
        state.retryCount = 0;
        state.lastChapterId = '';
        state.videoCount = 0;
        state.currentVideo = null;
        state.seekBackDone = false;
        state.isPausedByScript = false;
        GM_setValue('currentCourseIndex', '0');
        GM_setValue('lastChapterId', '');
        GM_setValue('videoCount', '0');
        log('状态已重置', 'success');
        updateStatus('已重置');
    }

    function createControlPanel() {
        if (document.getElementById('auto-play-panel')) return;

        var panel = document.createElement('div');
        panel.id = 'auto-play-panel';
        panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:linear-gradient(135deg,#667eea,#764ba2);padding:15px 20px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.3);color:white;font-family:sans-serif;min-width:280px;';

        var courseListHtml = '';
        for (var i = 0; i < COURSES.length; i++) {
            var isActive = i === state.currentCourseIndex;
            var color = isActive ? '#4CAF50' : 'rgba(255,255,255,0.3)';
            courseListHtml += '<div style="font-size:11px;padding:2px 0;color:' + color + ';">' + (isActive ? '▶ ' : '') + (i + 1) + '. ' + COURSES[i].name + '</div>';
        }

        panel.innerHTML = '<div style="font-size:14px;font-weight:bold;margin-bottom:10px;">自动刷视频 v3.2 (拟人版)</div>' +
            '<div style="font-size:10px;margin-bottom:10px;padding:6px;background:rgba(0,0,0,0.2);border-radius:4px;">' +
            '<div style="margin-bottom:2px;">拟人化: 随机暂停/延迟/鼠标移动/回退/时长验证</div>' +
            '<div style="margin-bottom:4px;">课程列表:</div>' + courseListHtml + '</div>' +
            '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
            '<button id="btn-start" style="flex:1;padding:8px 12px;border:none;border-radius:6px;background:#4CAF50;color:white;cursor:pointer;font-size:12px;">开始</button>' +
            '<button id="btn-stop" style="flex:1;padding:8px 12px;border:none;border-radius:6px;background:#f44336;color:white;cursor:pointer;font-size:12px;">停止</button></div>' +
            '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
            '<button id="btn-reset" style="flex:1;padding:6px 12px;border:none;border-radius:6px;background:#FF9800;color:white;cursor:pointer;font-size:11px;">重置</button>' +
            '<button id="btn-next-course" style="flex:1;padding:6px 12px;border:none;border-radius:6px;background:#2196F3;color:white;cursor:pointer;font-size:11px;">下一课程</button></div>' +
            '<div id="status-text" style="font-size:11px;padding:6px;background:rgba(255,255,255,0.1);border-radius:4px;">状态: 等待启动</div>';

        document.body.appendChild(panel);

        document.getElementById('btn-start').addEventListener('click', function() { startAutoPlay(); updateStatus('运行中'); });
        document.getElementById('btn-stop').addEventListener('click', function() { stopAutoPlay(); updateStatus('已停止'); });
        document.getElementById('btn-reset').addEventListener('click', function() { resetState(); });
        document.getElementById('btn-next-course').addEventListener('click', function() { switchToNextCourse(); });
    }

    function updateStatus(text) {
        var el = document.getElementById('status-text');
        if (el) el.textContent = '状态: ' + text;
    }

    setInterval(function() {
        var el = document.getElementById('status-text');
        if (el && state.isRunning) {
            el.textContent = '状态: 运行中 | ' + COURSES[state.currentCourseIndex].name + ' | 视频: ' + state.videoCount;
        }
    }, 1000);

    function init() {
        log('脚本已加载 - 拟人版 v3.2', 'info');
        createControlPanel();

        var urlParams = new URLSearchParams(window.location.search);
        var courseId = urlParams.get('courseId');

        log('检测到的 courseId: ' + courseId, 'info');
        log('COURSES 配置:', COURSES);

        if (courseId) {
            for (var i = 0; i < COURSES.length; i++) {
                if (COURSES[i].courseId === courseId) {
                    state.currentCourseIndex = i;
                    GM_setValue('currentCourseIndex', i.toString());
                    log('检测到当前课程: ' + COURSES[i].name, 'info');
                    break;
                }
            }

            log(CONFIG.autoStartDelay / 1000 + '秒后自动启动...', 'info');
            setTimeout(function() {
                log('自动启动刷视频...', 'success');
                startAutoPlay();
                updateStatus('自动运行中');
            }, CONFIG.autoStartDelay);
        } else {
            log('当前页面未检测到 courseId 参数', 'warning');
            log('当前 URL: ' + window.location.href, 'info');
            updateStatus('未检测到课程参数');
        }
    }

    window.autoPlayVideo = { start: startAutoPlay, stop: stopAutoPlay, reset: resetState, state: state };

    // URL 变化检测（单页应用支持）
    function checkAndInit() {
        var urlParams = new URLSearchParams(window.location.search);
        var courseId = urlParams.get('courseId');
        if (courseId && !document.getElementById('auto-play-panel')) {
            init();
        }
    }

    // 监听 URL 变化
    if (window.location.href.indexOf('chaoxing.com') !== -1) {
        console.log('%c[学习通脚本] 检测到 chaoxing.com，等待页面加载...', 'color: orange; font-size: 14px;');

        // 初始检查
        checkAndInit();

        // 定期检查 URL 变化
        setInterval(checkAndInit, 1000);

        // 监听 popstate 事件
        window.addEventListener('popstate', checkAndInit);

        // 监听 hashchange 事件
        window.addEventListener('hashchange', checkAndInit);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndInit);
    } else {
        checkAndInit();
    }

})();
