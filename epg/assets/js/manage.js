// 页面加载时预加载数据，减少等待时间
document.addEventListener('DOMContentLoaded', function() {
    showModal('live', popup = false);
    showModal('channel', popup = false);
    showModal('update', popup = false);
    showVersionLog(doCheckUpdate = true);
});

// 提交配置表单
document.getElementById('settingsForm').addEventListener('submit', function(event) {
    event.preventDefault();  // 阻止默认表单提交

    const fields = ['update_config', 'gen_xml', 'include_future_only', 'ret_default', 'cht_to_chs', 
        'db_type', 'mysql_host', 'mysql_dbname', 'mysql_username', 'mysql_password', 'cached_type', 'gen_list_enable', 
        'check_update', 'token_range', 'user_agent_range', 'debug_mode', 'ip_list_mode', 'live_source_config', 
        'live_template_enable', 'live_fuzzy_match', 'live_url_comment', 'live_tvg_logo_enable', 'live_tvg_id_enable', 
        'live_tvg_name_enable', 'live_source_auto_sync', 'live_channel_name_process', 'gen_live_update_time', 
        'm3u_icon_first', 'check_ipv6', 'min_resolution_width', 'min_resolution_height', 'urls_limit','sort_by_delay', 
        'check_speed_auto_sync', 'check_speed_interval_factor'];

    // 创建隐藏字段并将其添加到表单
    const form = this;
    fields.forEach(field => {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = field;
        hiddenInput.value = document.getElementById(field).value;
        form.appendChild(hiddenInput);
    });

    // 获取表单数据
    const formData = new FormData(form);

    // 执行 fetch 请求
    fetch('manage.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        const { db_type_set, interval_time, start_time, end_time } = data;
        
        let message = '配置已更新<br><br>';
        if (!db_type_set) {
            message += '<span style="color:red">MySQL 启用失败<br>数据库已设为 SQLite</span><br><br>';
            document.getElementById('db_type').value = 'sqlite';
        }
        message += interval_time === 0 
            ? "已取消定时任务" 
            : `已设置定时任务<br>开始时间：${start_time}<br>结束时间：${end_time}<br>间隔周期：${formatTime(interval_time)}`;
    
        showMessageModal(message);
    })
    .catch(() => showMessageModal('发生错误，请重试。'));
});

// 保存配置
function updateConfig(){
    document.getElementById('update_config').click();
}

// 检查数据库状况
function handleDbManagement() {
    if (document.getElementById('db_type').value === 'mysql') {
        var img = new Image();
        var timeout = setTimeout(function() {img.onerror();}, 1000); // 设置 1 秒超时
        img.onload = function() {
            clearTimeout(timeout); // 清除超时
            window.open('http://' + window.location.hostname + ':8080', '_blank');
        };
        img.onerror = function() {
            clearTimeout(timeout); // 清除超时
            showMessageModal('无法访问 phpMyAdmin 8080 端口，请自行使用 MySQL 管理工具进行管理。');
        };
        img.src = 'http://' + window.location.hostname + ':8080/favicon.ico'; // 测试 8080 端口
        return false;
    }
    return true; // 如果不是 MySQL，正常跳转
}

// 退出登录
function logout() {
    // 清除所有cookies
    document.cookie.split(";").forEach(function(cookie) {
        var name = cookie.split("=")[0].trim();
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    });
    // 清除本地存储
    sessionStorage.clear();
    // 重定向到登录页面
    window.location.href = 'manage.php';
}

// Ctrl+S 保存设置
document.addEventListener("keydown", function(event) {
    if (event.ctrlKey && event.key === "s") {
        event.preventDefault(); // 阻止默认行为，如保存页面
        setGenListAndUpdateConfig();
    }
});

// Ctrl+/ 设置（取消）注释
document.getElementById('xml_urls').addEventListener('keydown', handleKeydown);
document.getElementById('sourceUrlTextarea').addEventListener('keydown', handleKeydown);
function handleKeydown(event) {
    if (event.ctrlKey && event.key === '/') {
        event.preventDefault();
        const textarea = this;
        const { selectionStart, selectionEnd, value } = textarea;
        const lines = value.split('\n');
        // 计算当前选中的行
        const startLine = value.slice(0, selectionStart).split('\n').length - 1;
        const endLine = value.slice(0, selectionEnd).split('\n').length - 1;
        // 判断选中的行是否都已注释
        const allCommented = lines.slice(startLine, endLine + 1).every(line => line.trim().startsWith('#'));
        const newLines = lines.map((line, index) => {
            if (index >= startLine && index <= endLine) {
                return allCommented ? line.replace(/^#\s*/, '') : '# ' + line;
            }
            return line;
        });
        // 更新 textarea 的内容
        textarea.value = newLines.join('\n');
        // 检查光标开始位置是否在行首
        const startLineStartIndex = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const isStartInLineStart = (selectionStart - startLineStartIndex < 2);
        // 检查光标结束位置是否在行首
        const endLineStartIndex = value.lastIndexOf('\n', selectionEnd - 1) + 1;
        const isEndInLineStart = (selectionEnd - endLineStartIndex < 2);
        // 计算光标新的开始位置
        const newSelectionStart = isStartInLineStart 
            ? startLineStartIndex
            : selectionStart + newLines[startLine].length - lines[startLine].length;
        // 计算光标新的结束位置
        const lengthDiff = newLines.join('').length - lines.join('').length;
        const endLineDiff = newLines[endLine].length - lines[endLine].length;
        const newSelectionEnd = isEndInLineStart
            ? (endLineDiff > 0 ? endLineStartIndex + lengthDiff : endLineStartIndex + lengthDiff - endLineDiff)
            : selectionEnd + lengthDiff;
        // 恢复光标位置
        textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    }
}

// 格式化时间
function formatTime(seconds) {
    const formattedHours = String(Math.floor(seconds / 3600));
    const formattedMinutes = String(Math.floor((seconds % 3600) / 60));
    return `${formattedHours}小时${formattedMinutes}分钟`;
}

// 显示带消息的模态框
function showModalWithMessage(modalId, messageId = '', message = '') {
    const modal = document.getElementById(modalId);
    if (messageId) {
        const el = document.getElementById(messageId);
        el && (el.tagName === 'TEXTAREA' ? el.value = message : el.innerHTML = message);
    }

    modal.style.cssText = `display:block;z-index:${zIndex++}`;
    modal.querySelector('.close')?.addEventListener('mousedown', () => modal.style.display = 'none');
    const outsideClick = e => {
        if (e.target === modal) {
            modal.style.display = 'none';
            window.removeEventListener('mousedown', outsideClick);
        }
    };
    window.addEventListener('mousedown', outsideClick);
    modal.querySelector('.modal-content')?.addEventListener('mousedown', e => e.stopPropagation());
}

// 显示消息模态框
function showMessageModal(message) {
    showModalWithMessage("messageModal", "messageModalMessage", message);
}

let zIndex = 100;
// 显示模态框公共函数
function showModal(type, popup = true, data = '') {
    var modal, logSpan, logContent;
    switch (type) {
        case 'epg':
            modal = document.getElementById("epgModal");
            fetchData("manage.php?get_epg_by_channel=true&channel=" + encodeURIComponent(data.channel) + "&date=" + data.date, updateEpgContent);

            // 更新日期的点击事件
            const updateDate = function(offset) {
                const currentDate = new Date(document.getElementById("epgDate").innerText);
                currentDate.setDate(currentDate.getDate() + offset);
                const newDateString = currentDate.toISOString().split('T')[0];
                fetchData(`manage.php?get_epg_by_channel=true&channel=${encodeURIComponent(data.channel)}&date=${newDateString}`, updateEpgContent);
                document.getElementById("epgDate").innerText = newDateString;
            };

            // 前一天和后一天的点击事件
            document.getElementById('prevDate').onclick = () => updateDate(-1);
            document.getElementById('nextDate').onclick = () => updateDate(1);

            break;

        case 'update':
            modal = document.getElementById("updatelogModal");
            fetchData('manage.php?get_update_logs=true', updateLogTable);
            break;
        case 'cron':
            modal = document.getElementById("cronlogModal");
            fetchData('manage.php?get_cron_logs=true', updateCronLogContent);
            break;
        case 'channel':
            modal = document.getElementById("channelModal");
            fetchData('manage.php?get_channel=true', updateChannelList);
            break;
        case 'icon':
            modal = document.getElementById("iconModal");
            fetchData('manage.php?get_icon=true', updateIconList);
            break;
        case 'allicon':
            modal = document.getElementById("iconModal");
            fetchData('manage.php?get_icon=true&get_all_icon=true', updateIconList);
            break;
        case 'channelbindepg':
            modal = document.getElementById("channelBindEPGModal");
            fetchData('manage.php?get_channel_bind_epg=true', updateChannelBindEPGList);
            break;
        case 'channelmatch':
            modal = document.getElementById("channelMatchModal");
            fetchData('manage.php?get_channel_match=true', updateChannelMatchList);
            break;
        case 'live':
            modal = document.getElementById("liveSourceManageModal");
            fetchData('manage.php?get_live_data=true', updateLiveSourceModal);
            break;
        case 'chekspeed':
            modal = document.getElementById("checkSpeedModal");
            break;
        case 'morelivesetting':
            modal = document.getElementById("moreLiveSettingModal");
            break;
        case 'moresetting':
            modal = document.getElementById("moreSettingModal");
            fetchData('manage.php?get_gen_list=true', updateGenList);
            break;
        default:
            console.error('Unknown type:', type);
            break;
    }
    if (!popup) {
        return;
    }
    modal.style.cssText = `display:block;z-index:${zIndex++}`;
    modal.querySelector('.close')?.addEventListener('mousedown', () => modal.style.display = 'none');
    const outsideClick = e => {
        if (e.target === modal) {
            modal.style.display = 'none';
            window.removeEventListener('mousedown', outsideClick);
        }
    };
    window.addEventListener('mousedown', outsideClick);
    modal.querySelector('.modal-content')?.addEventListener('mousedown', e => e.stopPropagation());
}

function fetchData(endpoint, callback) {
    fetch(endpoint)
        .then(response => response.json())
        .then(data => callback(data))
        .catch(error => {
            console.error('Error fetching log:', error);
            callback([]);
        });
}

// 显示 update.php、check.php 执行结果
function showExecResult(fileName, callback, fullSize = true) {
    
    showMessageModal('');
    const messageContainer = document.getElementById('messageModalMessage');

    // 清空 messageContainer，避免内容重复
    messageContainer.innerHTML = '';

    const wrapper = document.createElement('div');
    if (fullSize) {
        wrapper.style.width = '930px';
        wrapper.style.height = '504px';
    } else {
        wrapper.style.maxWidth = '600px';
    }
    wrapper.style.overflow = 'auto';
    messageContainer.appendChild(wrapper);

    // 创建 XMLHttpRequest 对象
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${fileName}`, true);

    // 显式设置 X-Requested-With 请求头
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    // 处理接收到的数据
    xhr.onprogress = function () {
        wrapper.innerHTML = xhr.responseText;
        wrapper.scrollTop = wrapper.scrollHeight;
    };

    xhr.onload = function () {
        if (xhr.status === 200) {
            // 确保执行完成后调用回调
            if (typeof callback === 'function') {
                callback();
            }
        } else {
            wrapper.innerHTML += '<p>检测失败，请检查服务器。</p>';
        }
    };

    xhr.onerror = function () {
        wrapper.innerHTML += '<p>请求出错，请检查网络连接。</p>';
    };

    xhr.send();
}

// 显示版本更新日志
function showVersionLog(doCheckUpdate = false) {
    fetch(`manage.php?get_version_log=true&do_check_update=${doCheckUpdate}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (!doCheckUpdate || data.is_updated) {
                    showModalWithMessage("versionLogModal", "versionLogMessage", data.content);
                }
            } else {
                showMessageModal(data.message || '获取版本日志失败');
            }
        })
        .catch(() => {
            showMessageModal('无法获取版本日志，请稍后重试');
        });
}

// 显示使用说明
function showHelpModal() {
    fetch("manage.php?get_readme_content=true")
        .then(response => response.json())
        .then(data => {
            showModalWithMessage("helpModal", "helpMessage", data.content);
        });
}

// 显示捐赠图片
function showDonationImage() {
    const isDark = document.body.classList.contains('dark');
    const img = isDark ? 'assets/img/buymeacofee-dark.png' : 'assets/img/buymeacofee.png';

    showMessageModal('');
    messageModalMessage.innerHTML = `
        <img src="${img}" style="max-width:100%; display:block; margin: 0 auto; margin-top:55px;">
        <p style="margin-top:10px; text-align:center;">感谢鼓励！</p>
    `;

}

// 更新 EPG 内容
function updateEpgContent(epgData) {
    document.getElementById('epgTitle').innerHTML = epgData.channel;
    document.getElementById('epgSource').innerHTML = `来源：<a href="${epgData.source}" target="_blank" style="word-break: break-all;">${epgData.source}</a>`;
    document.getElementById('epgDate').innerHTML = epgData.date;
    var epgContent = document.getElementById("epgContent");
    epgContent.value = epgData.epg;
    epgContent.scrollTop = 0;
}

// 更新日志表格
function updateLogTable(logData) {
    var logTableBody = document.querySelector("#logTable tbody");
    logTableBody.innerHTML = '';

    logData.forEach(log => {
        var row = document.createElement("tr");
        row.innerHTML = `
            <td>${new Date(log.timestamp).toLocaleString('zh-CN').replace(' ', '<br>')}</td>
            <td>${log.log_message}</td>
        `;
        logTableBody.appendChild(row);
    });
    var logTableContainer = document.getElementById("log-table-container");
    logTableContainer.scrollTop = logTableContainer.scrollHeight;
}

// 更新 cron 日志内容
function updateCronLogContent(logData) {
    var logContent = document.getElementById("cronLogContent");
    logContent.value = logData.map(log => 
        `[${new Date(log.timestamp).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit', second: '2-digit', 
            hour12: false 
        })}] ${log.log_message}`)
    .join('\n');
    logContent.scrollTop = logContent.scrollHeight;
}

// 关闭繁體转简体时提示
function chtToChsChanged(selectElem) {
    if (selectElem.value === '0') {showMessageModal('将不支持繁简频道匹配');}
}

// 修改数据库相关信息
function changeDbType(selectElem) {
    if (selectElem.value === 'sqlite') return;
    showModalWithMessage('mysqlConfigModal');
}

// 修改数据缓存相关信息
function changeCachedType(selectElem) {
    if (selectElem.value === 'memcached') return;
    showModalWithMessage('redisConfigModal');
    setTimeout(() => {
        redisConfigModal.querySelector('.close')?.addEventListener('mousedown', () => selectElem.value = 'memcached');
        window.addEventListener('mousedown', function handler(e) {
            if (e.target === redisConfigModal) {
                selectElem.value = 'memcached';
                window.removeEventListener('mousedown', handler);
            }
        });
    });
}

// 更新并测试 Redis 账号信息
async function saveAndTestRedisConfig() {
    try {
      // 保存配置
      await fetch('manage.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          update_config_field: 'true',
          'redis[host]': document.getElementById('redis_host').value.trim(),
          'redis[port]': document.getElementById('redis_port').value.trim(),
          'redis[password]': document.getElementById('redis_password').value.trim()
        })
      });
  
      // 测试连接
      const res = await fetch('manage.php?test_redis=true');
      const data = await res.json();
  
      document.getElementById('cached_type').value = data.success ? 'redis' : 'memcached';
      showMessageModal(data.success ? '配置已保存，Redis 连接成功' : 'Redis 连接失败，已恢复为 Memcached');
    } catch {
      document.getElementById('cached_type').value = 'memcached';
      showMessageModal('请求失败，已恢复为 Memcached');
    }
}

let lastOffset = 0, timer = null;

// 显示访问日志
function showAccessLogModal() {
    const box = document.getElementById("accessLogContent");
    const modal = document.getElementById("accesslogModal");

    const load = () => {
        fetch(`manage.php?get_access_log=true&offset=${lastOffset}`)
            .then(r => r.json())
            .then(d => {
                if (!d.success) return;

                const pre = box.querySelector("pre");
                if (!pre) {
                    box.innerHTML = `<pre>${d.content || ""}</pre><div>持续刷新中...</div>`;
                    box.scrollTop = box.scrollHeight;
                } else if (d.changed && d.content) {
                    const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
                    pre.innerText += d.content;
                    if (atBottom) box.scrollTop = box.scrollHeight;
                }

                lastOffset = d.offset;
                if (!timer) timer = setInterval(load, 1000);
            });
    };

    modal.style.zIndex = zIndex++;
    modal.style.display = "block";
    load();

    modal.onmousedown = e => {
        if (e.target === modal || e.target.classList.contains("close")) {
            modal.style.display = "none";
            clearInterval(timer);
            timer = null;
        }
    };
}

// 访问日志统计
function showAccessStats() {
    clearInterval(timer);
    timer = null;
    const modal = document.getElementById("accessStatsModal");
    modal.style.zIndex = zIndex++;
    modal.style.display = "block";
    loadAccessStats();

    modal.onmousedown = e => {
        if (e.target === modal || e.target.classList.contains("close")) {
            modal.style.display = "none";
            showAccessLogModal();
        }
    };
}

let currentSort = { column: 'total', order: 'desc' };
let cachedData = { ipData: [], dates: [], rawStats: {} };

function loadAccessStats() {
    const tbody = document.querySelector("#accessStatsTable tbody");
    tbody.innerHTML = `<tr><td colspan="99">加载中...</td></tr>`;

    fetch('manage.php?get_access_stats=true')
        .then(res => res.json())
        .then(d => {
            if (!d.success) return;
            cachedData = { ipData: d.ipData, dates: d.dates };
            renderAccessStatsTable();
        });
}

function renderAccessStatsTable() {
    const table = document.getElementById("accessStatsTable");
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");
    const { ipData, dates } = cachedData;

    if (ipData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="99">暂无数据</td></tr>`;
        return;
    }

    // 排序逻辑
    ipData.sort((a, b) => {
        const { column, order } = currentSort;
        let result;

        if (column === 'ip') {
            result = a.ip.localeCompare(b.ip);
        } else if (column === 'total') {
            result = a.total - b.total;
        } else if (column === 'deny') {
            result = a.deny - b.deny;
        } else {
            const i = dates.indexOf(column);
            result = a.counts[i] - b.counts[i];
        }

        return order === 'asc' ? result : -result;
    });

    // 渲染表头
    thead.innerHTML = renderTableHeader(dates);

    // 渲染表体
    tbody.innerHTML = ipData.map(row => renderTableRow(row)).join('');
}

function renderTableHeader(dates) {
    const arrow = col => currentSort.column === col ? (currentSort.order === 'asc' ? ' ▲' : ' ▼') : '';
    return `
        <tr>
            <th onclick="sortByColumn('ip')">IP地址${arrow('ip')}</th>
            ${dates.map(date => `<th onclick="sortByColumn('${date}')">${date.slice(5)}${arrow(date)}</th>`).join('')}
            <th onclick="sortByColumn('deny')">拒绝${arrow('deny')}</th>
            <th onclick="sortByColumn('total')">总计${arrow('total')}</th>
            <th>操作</th>
        </tr>
    `;
}

function renderTableRow({ ip, counts, total, deny }) {
    const countCells = counts.map(c => `<td>${c}</td>`).join('');
    return `
        <tr>
            <td><a href="#" onclick="filterLogByIp('${ip}'); return false;">${ip}</a></td>
            ${countCells}
            <td>${deny}</td>
            <td>${total}</td>
            <td>
                <button onclick="addIp('${ip}','black')" style="width: 30px; padding: 1px;">黑</button>
                <button onclick="addIp('${ip}','white')" style="width: 30px; padding: 1px;">白</button>
            </td>
        </tr>
    `;
}

function filterLogByIp(ip) {
    const logContent = document.getElementById("accessLogContent").innerText || '';
    const lines = logContent.split('\n').filter(line => line.includes(ip));
    const filtered = lines.length > 0 ? lines.map(line => line.trimEnd()).join('\n') : `无记录：${ip}`;
    showMessageModal(`
        <div id="filteredLog" style="width:930px; height:504px; overflow:auto; font-family:monospace; white-space:pre;">${filtered.replace(/\n/g, '<br>')}</div>
    `);
    const d = document.getElementById("filteredLog");
    if (d) d.scrollTop = d.scrollHeight;;
}

function addIp(ip, type) {
    const listName = type === 'white' ? '白名单' : '黑名单';
    if (!confirm(`确定将 ${ip} 加入${listName}？`)) return;

    const file = type === 'white' ? 'ipWhiteList.txt' : 'ipBlackList.txt';

    fetch(`manage.php?get_ip_list=true&file=${file}`)
        .then(res => res.json())
        .then(data => {
            const set = new Set(data.list || []);
            set.add(ip);

            return fetch('manage.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    save_content_to_file: 'true',
                    file_path: `/data/${file}`,
                    content: [...set].join('\n')
                })
            });
        })
        .then(res => res.json())
        .then(data => showMessageModal(data.success ? `已加入${listName}` : '保存失败'));
}

function sortByColumn(col) {
    if (currentSort.column === col) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = {
            column: col,
            order: col === 'ip' ? 'asc' : 'desc'
        };
    }
    renderAccessStatsTable();
}

// 清空访问日志
function clearAccessLog() {
    if (!confirm('确定清空访问日志？')) return;
    fetch('manage.php?clear_access_log=true')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert('日志已清空');
                document.getElementById('accessLogContent').innerHTML = '';
            } else alert('清空失败');
        }).catch(() => alert('请求失败'));
}

// 下载访问日志
function downloadAccessLog() {
    fetch('manage.php?get_access_log=true')
        .then(res => res.json())
        .then(data => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([data.content], {type:'text/plain'}));
            a.download = 'access.log';
            a.click();
            URL.revokeObjectURL(a.href);
        })
        .catch(() => alert('下载失败'));
}

// 显示 IP 列表模态框
function showIpModal() {
    const mode = document.getElementById('ip_list_mode').value;
    
    fetch('manage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            update_config_field: 'true',
            ip_list_mode: mode
        })
    });

    if (mode === '0') return;
    const file = (mode === '1' ? 'ipWhiteList.txt' : 'ipBlackList.txt');
    const modeName = (mode === '1' ? '白名单' : '黑名单');

    fetch(`manage.php?get_ip_list=true&file=${encodeURIComponent(file)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showModalWithMessage("ipModal", "ipListTextarea", data.list.join('\n'));
                const textarea = document.getElementById('ipListTextarea');
                textarea.dataset.file = file;
                textarea.focus();
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                const h2 = document.querySelector('#ipModal h2'); // 修改标题内容
                h2.textContent = `IP 列表：${modeName}`;
            } else {
                showMessageModal('读取 IP 列表失败');
            }
        });
}

// 保存 IP 列表
function saveIpList() {
    const textarea = document.getElementById('ipListTextarea');
    const file = textarea.dataset.file || 'ipBlackList.txt';

    const lines = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);

    // 支持单个 IPv4、IPv6、IPv4 CIDR、IPv4 通配符（可选）
    const patterns = [
        /^(\*|25[0-5]|2\d{1,2}|1\d{1,2}|\d{1,2})(\.(\*|25[0-5]|2\d{1,2}|1\d{1,2}|\d{1,2})){3}$/,  // IPv4 + 通配符
        /^(\d{1,3}\.){3}\d{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/,                                     // CIDR
        /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/                                              // IPv6（简化）
    ];
    
    const valid = [], invalid = [];
    
    for (const ip of [...new Set(lines)]) {
        (patterns.some(re => re.test(ip)) ? valid : invalid).push(ip);
    }    

    textarea.value = valid.join('\n');

    if (invalid.length) alert(`以下 IP 无效，已忽略：\n${invalid.join('\n')}`);

    fetch('manage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            save_content_to_file: 'true',
            file_path: `/data/${file}`,
            content: textarea.value
        })
    })
    .then(res => res.json())
    .then(data => showMessageModal(data.success ? '保存成功' : '保存失败'));
}

// 显示频道别名列表
function updateChannelList(channelsData) {
    const channelTitle = document.getElementById('channelModalTitle');
    channelTitle.innerHTML = `频道列表<span style="font-size: 18px;">（总数：${channelsData.count}）</span>`; // 更新频道总数
    document.getElementById('channelTable').dataset.allChannels = JSON.stringify(channelsData.channels); // 将原始频道和映射后的频道数据存储到 dataset 中
    filterChannels('channel'); // 生成数据
}

// 显示台标列表
function updateIconList(iconsData) {
    const channelTitle = document.getElementById('iconModalTitle');
    channelTitle.innerHTML = `频道列表<span style="font-size: 18px;">（总数：${iconsData.count}）</span>`; // 更新频道总数
    document.getElementById('iconTable').dataset.allIcons = JSON.stringify(iconsData.channels); // 将频道名和台标地址存储到 dataset 中
    filterChannels('icon'); // 生成数据
}

// 显示频道绑定 EPG 列表
function updateChannelBindEPGList(channelBindEPGData) {
    // 创建并添加隐藏字段
    const channelBindEPGInput = document.createElement('input');
    channelBindEPGInput.type = 'hidden';
    channelBindEPGInput.name = 'channel_bind_epg';
    document.getElementById('settingsForm').appendChild(channelBindEPGInput);

    document.getElementById('channelBindEPGTable').dataset.allChannelBindEPG = JSON.stringify(channelBindEPGData);
    var channelBindEPGTableBody = document.querySelector("#channelBindEPGTable tbody");
    var allChannelBindEPG = JSON.parse(document.getElementById('channelBindEPGTable').dataset.allChannelBindEPG);
    channelBindEPGInput.value = JSON.stringify(allChannelBindEPG);

    // 清空现有表格
    channelBindEPGTableBody.innerHTML = '';

    allChannelBindEPG.forEach(channelbindepg => {
        var row = document.createElement('tr');
        row.innerHTML = `
            <td>${String(channelbindepg.epg_src)}</td>
            <td contenteditable="true">${channelbindepg.channels}</td>
        `;

        row.querySelector('td[contenteditable]').addEventListener('input', function() {
            channelbindepg.channels = this.textContent;
            document.getElementById('channelBindEPGTable').dataset.allChannelBindEPG = JSON.stringify(allChannelBindEPG);
            channelBindEPGInput.value = JSON.stringify(allChannelBindEPG);
        });

        channelBindEPGTableBody.appendChild(row);
    });
}

// 显示频道匹配结果
function updateChannelMatchList(channelMatchdata) {
    const channelMatchTableBody = document.querySelector("#channelMatchTable tbody");
    channelMatchTableBody.innerHTML = '';

    const typeOrder = { '未匹配': 1, '反向模糊': 2, '正向模糊': 3, '别名/忽略': 4, '精确匹配': 5 };

    // 处理并排序匹配数据
    const sortedMatches = Object.values(channelMatchdata)
        .flat()
        .sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

    // 创建表格行
    sortedMatches.forEach(({ ori_channel, clean_channel, match, type }) => {
        const matchType = type === '精确匹配' ? '' : type;
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${ori_channel}</td>
            <td>${clean_channel}</td>
            <td>${match || ''}</td>
            <td>${matchType}</td>
        `;
        channelMatchTableBody.appendChild(row);
    });

    document.getElementById("channel-match-table-container").style.display = 'block';
}

// 显示限定频道列表
function updateGenList(genData) {
    const gen_list_text = document.getElementById('gen_list_text');
    if(!gen_list_text.value) {
        gen_list_text.value = genData.join('\n');
    }
}

// 显示指定页码的数据
function displayPage(data, page) {
    const tableBody = document.querySelector('#liveSourceTable tbody');
    tableBody.innerHTML = ''; // 清空表格内容

    const start = (page - 1) * rowsPerPage;
    const end = Math.min(start + rowsPerPage, data.length);

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11">暂无数据</td></tr>';
        return;
    }

    // 列索引和对应字段的映射
    const columns = ['groupTitle', 'channelName', 'streamUrl', 'iconUrl', 'tvgId', 
                    'tvgName', 'resolution', 'speed', 'disable', 'modified'];

    // 填充当前页的表格数据
    data.slice(start, end).forEach((item, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${start + index + 1}</td>
            ${columns.map((col, columnIndex) => {
                let cellContent = item[col] || '';
                let cellClass = '';
                
                // 处理 disable 和 modified 列
                if (col === 'disable' || col === 'modified') {
                    cellContent = item[col] == 1 ? '是' : '否';
                    cellClass = (col === 'disable' && item[col] == 1)
                        ? 'table-cell-disable'
                        : (col === 'modified' && item[col] == 1)
                        ? 'table-cell-modified'
                        : 'table-cell-clickable';
                }
        
                const editable = ['resolution', 'speed', 'disable', 'modified'].includes(col) ? '' : 'contenteditable="true"';
                const clickableClass = (col === 'disable' || col === 'modified') ? 'table-cell-clickable' : '';
        
                return `<td ${editable} class="${clickableClass} ${cellClass}">
                            <div class="limited-row">${cellContent}</div>
                        </td>`;
            }).join('')}
        `;

        // 为每个单元格添加事件监听器
        row.querySelectorAll('td[contenteditable="true"]').forEach((cell, columnIndex) => {
            cell.addEventListener('input', () => {
                const currentIndex = (currentPage - 1) * rowsPerPage + index;
                const item = filteredLiveData[currentIndex]; // 当前点击的数据
                const dataIndex = allLiveData.findIndex(d => d.tag === item.tag);
                if (dataIndex < allLiveData.length) {
                    allLiveData[dataIndex][columns[columnIndex]] = cell.textContent.trim();
                    allLiveData[dataIndex]['modified'] = 1; // 标记修改位
                    const lastCell = cell.closest('tr').lastElementChild;
                    lastCell.textContent = '是';
                    lastCell.classList.add('table-cell-modified');
                }
            });
        });

        // 为 disable 和 modified 列添加点击事件，切换 "是/否"
        row.querySelectorAll('td.table-cell-clickable').forEach((cell, columnIndex) => {
            cell.addEventListener('click', () => {
                const currentIndex = (currentPage - 1) * rowsPerPage + index;
                const item = filteredLiveData[currentIndex]; // 当前点击的数据
                const dataIndex = allLiveData.findIndex(d => d.tag === item.tag);
                if (dataIndex < allLiveData.length) {
                    const isDisable = columnIndex === 0;
                    const field = isDisable ? 'disable' : 'modified';
                    const newValue = allLiveData[dataIndex][field] == 1 ? 0 : 1;
                    allLiveData[dataIndex][field] = newValue;
                    cell.textContent = newValue == 1 ? '是' : '否';

                    if (isDisable) {
                        cell.classList.toggle('table-cell-disable', newValue == 1);
                        allLiveData[dataIndex]['modified'] = 1; // 标记修改位
                        const lastCell = cell.closest('tr').lastElementChild;
                        lastCell.textContent = '是';
                        lastCell.classList.add('table-cell-modified');
                    } else {
                        cell.classList.toggle('table-cell-modified', newValue == 1);
                    }
                }
            });
        });
    
        tableBody.appendChild(row);
    });

    // 为单元格添加鼠标点击事件
    tableBody.addEventListener('focusin', e => {
        const td = e.target.closest('td')
        if (!td) return
        const tr = td.closest('tr')
        tr.querySelectorAll('.limited-row').forEach(d => d.classList.add('expanded'))
    })
    tableBody.addEventListener('focusout', e => {
        const td = e.target.closest('td')
        if (!td) return
        const tr = td.closest('tr')
        tr.querySelectorAll('.limited-row').forEach(d => d.classList.remove('expanded'))
    })
}

// 创建分页控件
function setupPagination(data) {
    const paginationContainer = document.getElementById('paginationContainer');
    paginationContainer.innerHTML = ''; // 清空分页容器

    const totalPages = Math.ceil(data.length / rowsPerPage);
    if (totalPages <= 1) return;

    const maxButtons = 11; // 总显示按钮数，包括“<”和“>”
    const pageButtons = maxButtons - 2; // 除去 "<" 和 ">" 的按钮数

    // 创建按钮
    const createButton = (text, page, isActive = false, isDisabled = false) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = isActive ? 'active' : '';
        button.disabled = isDisabled;
        button.onclick = () => {
            if (!isDisabled) {
                currentPage = page;
                displayPage(data, currentPage); // 更新页面显示内容
                setupPagination(data); // 更新分页控件
            }
        };
        return button;
    };

    // 前部
    paginationContainer.appendChild(createButton('<', currentPage - 1, false, currentPage === 1));
    paginationContainer.appendChild(createButton(1, 1, currentPage === 1));
    if (currentPage > 5 && totalPages > pageButtons) paginationContainer.appendChild(createButton('...', null, false, true));

    // 中部
    let startPage = Math.max(2, currentPage - Math.floor(pageButtons / 2) + 2);
    let endPage = Math.min(totalPages - 1, currentPage + Math.floor(pageButtons / 2) - 2);
    if (currentPage <= 5) { startPage = 2; endPage = Math.min(pageButtons - 2, totalPages - 1); }
    else if (currentPage >= totalPages - 4) { startPage = Math.max(totalPages - pageButtons + 3, 2); endPage = totalPages - 1; }
    for (let i = startPage; i <= endPage; i++) {
        paginationContainer.appendChild(createButton(i, i, currentPage === i));
    }

    // 后部
    if (currentPage < totalPages - 4 && totalPages > pageButtons) paginationContainer.appendChild(createButton('...', null, false, true));
    paginationContainer.appendChild(createButton(totalPages, totalPages, currentPage === totalPages));
    paginationContainer.appendChild(createButton('>', currentPage + 1, false, currentPage === totalPages));
}

let currentPage = 1; // 当前页码
let allLiveData = []; // 用于存储直播源数据
let filteredLiveData = []; // 搜索后的结果

let rowsPerPage = parseInt(localStorage.getItem('rowsPerPage')) || 100; // 每页显示的行数
document.getElementById('rowsPerPageSelect').value = rowsPerPage;

// 更改每页显示条数
document.getElementById('rowsPerPageSelect').addEventListener('change', (e) => {
    rowsPerPage = parseInt(e.target.value);
    localStorage.setItem('rowsPerPage', rowsPerPage);
    currentPage = 1; // 重置到第一页
    displayPage(filteredLiveData, currentPage);
    setupPagination(filteredLiveData);
});

// 根据关键词过滤数据
function filterLiveSourceData() {
    const keyword = document.getElementById('liveSourceSearchInput').value.trim().toLowerCase();
    filteredLiveData = allLiveData.filter(item =>
        (item.channelName || '').toLowerCase().includes(keyword) ||
        (item.groupTitle || '').toLowerCase().includes(keyword) ||
        (item.streamUrl || '').toLowerCase().includes(keyword) ||
        (item.tvgId || '').toLowerCase().includes(keyword) ||
        (item.tvgName || '').toLowerCase().includes(keyword)
    );
    currentPage = 1;
    displayPage(filteredLiveData, currentPage);
    setupPagination(filteredLiveData);
}

// 更新模态框内容并初始化分页
function updateLiveSourceModal(data) {
    document.getElementById('sourceUrlTextarea').value = data.source_content || '';
    document.getElementById('liveTemplateTextarea').value = data.template_content || '';
    document.getElementById('live_source_config').innerHTML = data.config_options_html;
    const channels = Array.isArray(data.channels) ? data.channels : [];
    allLiveData = channels;  // 将所有数据保存在全局变量中
    filteredLiveData = allLiveData; // 初始化过滤结果
    currentPage = 1; // 重置为第一页
    displayPage(channels, currentPage); // 显示第一页数据
    setupPagination(channels); // 初始化分页控件
}

// 更新直播源配置
function onLiveSourceConfigChange() {
    const selectedConfig = document.getElementById('live_source_config').value;
    fetchData(`manage.php?get_live_data=true&live_source_config=${selectedConfig}`, updateLiveSourceModal);
}

// 上传直播源文件
document.getElementById('liveSourceFile').addEventListener('change', function() {
    const file = this.files[0];
    const allowedExtensions = ['m3u', 'txt'];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    // 检查文件类型
    if (!allowedExtensions.includes(fileExtension)) {
        showMessageModal('只接受 .m3u 和 .txt 文件');
        return;
    }

    // 创建 FormData 并发送 AJAX 请求
    const formData = new FormData();
    formData.append('liveSourceFile', file);

    fetch('manage.php', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showModal('live');
                showMessageModal('上传成功，请重新解析');
            } else {
                showMessageModal('上传失败: ' + data.message);
            }
        })
        .catch(error => showMessageModal('上传过程中发生错误：' + error));

    this.value = ''; // 重置文件输入框的值，确保可以连续上传相同文件
});

// 保存编辑后的直播源地址
function saveLiveSourceFile() {
    const source = document.getElementById('sourceUrlTextarea');
    const sourceContent = source.value.replace(/^\s*[\r\n]+/gm, '').replace(/\n$/, '');
    source.value = sourceContent;

    const liveSourceConfig = document.getElementById('live_source_config').value;
    const updateObj = {};
    updateObj[liveSourceConfig] = sourceContent.split('\n');

    // 内容写入 source.json 文件
    fetch('manage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            save_content_to_file: 'true',
            file_path: '/data/live/source.json',
            content: JSON.stringify(updateObj)
        })
    })
    .catch(error => {
        showMessageModal('保存失败: ' + error);
    });
}

document.getElementById('sourceUrlTextarea').addEventListener('blur', saveLiveSourceFile);

// 保存编辑后的直播源信息
function saveLiveSourceInfo() {
    // 获取配置
    const liveSourceConfig = document.getElementById('live_source_config').value;
    const liveTvgLogoEnable = document.getElementById('live_tvg_logo_enable').value;
    const liveTvgIdEnable = document.getElementById('live_tvg_id_enable').value;
    const liveTvgNameEnable = document.getElementById('live_tvg_name_enable').value;

    // 保存直播源信息
    fetch('manage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            save_source_info: 'true',
            live_source_config: liveSourceConfig,
            live_tvg_logo_enable: liveTvgLogoEnable,
            live_tvg_id_enable: liveTvgIdEnable,
            live_tvg_name_enable: liveTvgNameEnable,
            content: JSON.stringify(allLiveData)
        })
    })
    .then(response => response.json())
    .then(data => {
        showMessageModal(data.success ? '保存成功<br>已生成 M3U 及 TXT 文件' : '保存失败');
    })
    .catch(error => {
        showMessageModal('保存过程中出现错误: ' + error);
    });
}

// 新建或另存直播源配置
function openLiveSourceConfigDialog(isNew = false) {
    showMessageModal('');
    document.getElementById('messageModalMessage').innerHTML = `
        <div style="width: 180px;">
            <h3>${isNew ? '新建配置' : '另存为新配置'}</h3>
            <input type="text" value="" id="newConfigName" placeholder="请输入配置名"
                style="text-align: center; font-size: 15px; margin-bottom: 15px;" />
            <div class="button-container" style="text-align: center; margin-bottom: -10px;">
                <button id="confirmBtn">确认</button>
                <button onclick="document.getElementById('messageModal').style.display='none'">取消</button>
            </div>
        </div>
    `;

    document.getElementById('newConfigName').focus();
    document.getElementById('confirmBtn').onclick = () => {
        const liveSourceConfig = document.getElementById('newConfigName').value.trim();
        if (!liveSourceConfig) {
            showMessageModal('请输入配置名');
            return;
        }
        const select = document.getElementById('live_source_config');
        const oldConfig = select.value.trim();
        if (![...select.options].some(o => o.value === liveSourceConfig)) {
            select.add(new Option(liveSourceConfig, liveSourceConfig));
        }
        select.value = liveSourceConfig;

        fetch('manage.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                create_source_config: 'true',
                old_source_config: oldConfig,
                new_source_config: liveSourceConfig,
                is_new: isNew
            })
        })
        .then(() => {
            showModal('live', false);
        })
        .catch(error => {
            showMessageModal('保存过程中出现错误: ' + error);
        });

        document.getElementById('showLiveUrlBtn').click();
    };
}

// 删除直播源配置
function deleteSource() {
    const select = document.getElementById('live_source_config');
    const configName = select.value;
    if (!configName) return;

    if (configName === 'default') {
        showMessageModal('默认配置不能删除！');
        return;
    }

    showMessageModal('');
    document.getElementById('messageModalMessage').innerHTML = `
        <div style="width: 300px; text-align: center;">
            <h3>确认删除</h3>
            <p>确定删除配置 "${configName}"？此操作不可恢复。</p>
            <div class="button-container">
                <button id="confirmBtn">确认</button>
                <button id="cancelBtn">取消</button>
            </div>
        </div>
    `;

    document.getElementById('confirmBtn').onclick = () => {
        fetch(`manage.php?delete_source_config=true&live_source_config=${encodeURIComponent(configName)}`)
            .then(() => {
                const i = select.selectedIndex;
                select.remove(i);
                select.selectedIndex = i >= select.options.length ? i - 1 : i;
                onLiveSourceConfigChange();
            })
            .catch(err => showMessageModal('删除失败：' + err));
        document.getElementById('messageModal').style.display = 'none';
    };

    document.getElementById('cancelBtn').onclick = () => {
        document.getElementById('messageModal').style.display = 'none';
    };
}

// 清理未使用的直播源文件
function cleanUnusedSource() {
    fetch('manage.php?delete_unused_live_data=true')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessageModal(data.message);
        } else {
            showMessageModal('清理失败');
        }
    })
    .catch(error => {
        showMessageModal('Error: ' + error);
    });
}

// 显示直播源地址
function showLiveUrl(token, serverUrl, tokenRange) {
    const config = document.getElementById('live_source_config').value.trim();
    const tokenStr = (tokenRange == 1 || tokenRange == 3) ? `token=${token}&` : '';
    const m3uUrl = `${serverUrl}/tv.m3u?${tokenStr}url=${config}`;
    const txtUrl = `${serverUrl}/tv.txt?${tokenStr}url=${config}`;
    const message = 
        `M3U：<br><a href="${m3uUrl}" target="_blank">${m3uUrl}</a>&ensp;<a href="${m3uUrl}" download="tv.m3u">下载</a><br>` +
        `TXT：<br><a href="${txtUrl}" target="_blank">${txtUrl}</a>&ensp;<a href="${txtUrl}" download="tv.txt">下载</a><br>`;
    showMessageModal(message);
}

// 显示直播源模板
function showLiveTemplate() {
    showModalWithMessage("liveTemplateModal");
}

// 保存编辑后的直播源模板
function saveLiveTemplate() {
    // 保存配置
    liveTemplateEnable = document.getElementById('live_template_enable').value;
    liveFuzzyMatch = document.getElementById('live_fuzzy_match').value;
    liveUrlComment = document.getElementById('live_url_comment').value;
    fetch('manage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            update_config_field: 'true',
            live_template_enable: liveTemplateEnable,
            live_fuzzy_match: liveFuzzyMatch,
            live_url_comment: liveUrlComment
        })
    });

    // 内容写入 template.json 文件
    const liveSourceConfig = document.getElementById('live_source_config').value;
    const updateObj = {};
    updateObj[liveSourceConfig] = document.getElementById('liveTemplateTextarea').value.split('\n');
    fetch('manage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            save_content_to_file: 'true',
            file_path: '/data/live/template.json',
            content: JSON.stringify(updateObj)
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            parseSourceInfo("保存成功<br>正在重新解析...");
            document.getElementById('liveTemplateModal').style.display = 'none';
        } else {
            showMessageModal('保存失败');
        }
    })
    .catch(error => {
        showMessageModal('保存失败: ' + error);
    });
}

// 搜索频道
function filterChannels(type) {
    const tableId = type === 'channel' ? 'channelTable' : 'iconTable';
    const dataAttr = type === 'channel' ? 'allChannels' : 'allIcons';
    const input = document.getElementById(type === 'channel' ? 'channelSearchInput' : 'iconSearchInput').value.toUpperCase();
    const tableBody = document.querySelector(`#${tableId} tbody`);
    const allData = JSON.parse(document.getElementById(tableId).dataset[dataAttr]);

    tableBody.innerHTML = ''; // 清空表格

    // 创建行的通用函数
    function createEditableRow(item, itemIndex, insertAfterRow = null) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td name="channel" contenteditable="true" onclick="this.innerText='';"><span style="color: #aaa;">创建自定义频道</span>${item.channel || ''}</td>
            <td name="icon" contenteditable="true">${item.icon || ''}</td>
            <td></td>
            <td>
                <input type="file" accept="image/png" style="display:none;" id="icon_new_${itemIndex}">
                <button onclick="document.getElementById('icon_new_${itemIndex}').click()" style="font-size: 14px; width: 50px;">上传</button>
            </td>
        `;
        
        // 动态更新 allData
        row.querySelectorAll('td[contenteditable]').forEach(cell => {
            cell.addEventListener('input', () => {
                allData[itemIndex][cell.getAttribute('name')] = cell.textContent.trim();
                document.getElementById(tableId).dataset[dataAttr] = JSON.stringify(allData);
                if (cell.getAttribute('name') === 'channel' && item.channel && !allData.some(e => !e.channel)) {
                    allData.push({ channel: '', icon: '' });
                    createEditableRow(allData[allData.length - 1], allData.length - 1, row); // 插入新行到当前行后
                }
            });
        });

        // 上传文件
        row.querySelector(`#icon_new_${itemIndex}`).addEventListener('change', event => handleIconFileUpload(event, item, row, allData));

        // 如果指定了插入位置，则插入到该行之后，否则追加到表格末尾
        if (insertAfterRow) {
            insertAfterRow.insertAdjacentElement('afterend', row);
        } else {
            tableBody.appendChild(row);
        }
    }

    // 创建初始空行（仅用于 icon）
    if (!input && type === 'icon') {
        allData.push({ channel: '', icon: '' });
        createEditableRow(allData[allData.length - 1], allData.length - 1);
    }

    // 筛选并显示行的逻辑
    allData.forEach((item, index) => {
        const searchText = type === 'channel' ? item.original : item.channel;
        if (String(searchText).toUpperCase().includes(input)) {
            const row = document.createElement('tr');
            if (type === 'channel') {
                row.innerHTML = `<td class="blue-span" 
                                    onclick="showModal('epg', true, { channel: '${item.original}', date: '${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })}' })">
                                    ${item.original} </td>
                                <td contenteditable="true">${(item.mapped || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
                row.querySelector('td[contenteditable]').addEventListener('input', function() {
                    item.mapped = this.textContent.trim();
                    document.getElementById(tableId).dataset[dataAttr] = JSON.stringify(allData);
                });
            } else if (type === 'icon' && searchText) {
                row.innerHTML = `
                    <td contenteditable="true">${item.channel}</td>
                    <td contenteditable="true">${item.icon || ''}</td>
                    <td>${item.icon ? `<a href="${item.icon}" target="_blank"><img loading="lazy" src="${item.icon}" style="max-width: 80px; max-height: 50px; background-color: #ccc;"></a>` : ''}</td>
                    <td>
                        <input type="file" accept="image/png" style="display:none;" id="file_${index}">
                        <button onclick="document.getElementById('file_${index}').click()" style="font-size: 14px; width: 50px;">上传</button>
                    </td>
                `;
                row.querySelectorAll('td[contenteditable]').forEach((cell, idx) => {
                    cell.addEventListener('input', function() {
                        if (idx === 0) item.channel = this.textContent.trim();  // 第一个可编辑单元格更新 channel
                        else item.icon = this.textContent.trim();  // 第二个可编辑单元格更新 icon
                        document.getElementById(tableId).dataset[dataAttr] = JSON.stringify(allData);
                    });
                });
                row.querySelector(`#file_${index}`).addEventListener('change', event => handleIconFileUpload(event, item, row, allData));
            }
            tableBody.appendChild(row);
        }
    });
}

// 台标上传
function handleIconFileUpload(event, item, row, allData) {
    const file = event.target.files[0];
    if (file && file.type === 'image/png') {
        const formData = new FormData();
        formData.append('iconFile', file);

        fetch('manage.php', { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const iconUrl = data.iconUrl;
                    row.cells[1].innerText = iconUrl;
                    item.icon = iconUrl;
                    row.cells[2].innerHTML = `
                        <a href="${iconUrl}?${new Date().getTime()}" target="_blank">
                            <img loading="lazy" src="${iconUrl}?${new Date().getTime()}" style="max-width: 80px; max-height: 50px; background-color: #ccc;">
                        </a>
                    `;
                    document.getElementById('iconTable').dataset.allIcons = JSON.stringify(allData);
                    updateIconListJsonFile();
                } else {
                    showMessageModal('上传失败：' + data.message);
                }
            })
            .catch(error => showMessageModal('上传过程中发生错误：' + error));
    } else {
        showMessageModal('请选择PNG文件上传');
    }
    event.target.value = ''; // 重置文件输入框的值，确保可以连续上传相同文件
}

// 转存所有台标到服务器
function uploadAllIcons() {
    const iconTable = document.getElementById('iconTable');
    const allIcons = JSON.parse(iconTable.dataset.allIcons);
    const rows = Array.from(document.querySelectorAll('#iconTable tbody tr'));

    let totalIcons = 0;
    let uploadedIcons = 0;
    const rowsToUpload = rows.filter(row => {
        const iconUrl = row.cells[1]?.innerText.trim();
        if (iconUrl) {
            totalIcons++;
            if (!iconUrl.startsWith('/data/icon/')) {
                return true;
            } else {
                uploadedIcons++;
            }
        }
        return false;
    });

    const progressDisplay = document.getElementById('progressDisplay') || document.createElement('div');
    progressDisplay.id = 'progressDisplay';
    progressDisplay.style.cssText = 'margin: 10px 0; text-align: right;';
    progressDisplay.textContent = `已转存 ${uploadedIcons}/${totalIcons}`;
    iconTable.before(progressDisplay);

    const uploadPromises = rowsToUpload.map(row => {
        const [channelCell, iconCell, previewCell] = row.cells;
        const iconUrl = iconCell?.innerText.trim();
        const fileName = decodeURIComponent(iconUrl.split('/').pop().split('?')[0]);

        return fetch(iconUrl)
            .then(res => res.blob())
            .then(blob => {
                const formData = new FormData();
                formData.append('iconFile', new File([blob], fileName, { type: 'image/png' }));

                return fetch('manage.php', { method: 'POST', body: formData });
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const iconUrl = data.iconUrl;
                    const channelName = channelCell.innerText.trim();
                    iconCell.innerText = iconUrl;
                    previewCell.innerHTML = `
                        <a href="${iconUrl}?${Date.now()}" target="_blank">
                            <img loading="lazy" src="${iconUrl}?${Date.now()}" style="max-width: 80px; max-height: 50px; background-color: #ccc;">
                        </a>
                    `;

                    allIcons.forEach(item => {
                        if (item.channel === channelName) item.icon = iconUrl;
                    });
                    iconTable.dataset.allIcons = JSON.stringify(allIcons);
                    uploadedIcons++;
                    progressDisplay.textContent = `已转存 ${uploadedIcons}/${totalIcons}`;
                } else {
                    previewCell.innerHTML = `上传失败: ${data.message}`;
                }
            })
            .catch(() => {
                previewCell.innerHTML = '上传出错';
            });
    });

    Promise.all(uploadPromises).then(() => {
        if (uploadedIcons !== totalIcons) {
            uploadAllIcons(); // 继续上传
        }
        else {
            updateIconListJsonFile();
            showMessageModal("全部转存成功，已保存！");
        }
    });
}

// 清理未使用的台标文件
function deleteUnusedIcons() {
    fetch('manage.php?delete_unused_icons=true')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessageModal(data.message);
        } else {
            showMessageModal('清理失败');
        }
    })
    .catch(error => {
        showMessageModal('Error: ' + error);
    });
}

// 更新频道别名
function updateChannelMapping() {
    const allChannels = JSON.parse(document.getElementById('channelTable').dataset.allChannels);
    const channelMappings = document.getElementById('channel_mappings');
    const map = allChannels.filter(c => c.original !== '【频道忽略字符】' && c.mapped.trim())
                           .map(c => `${c.original} => ${c.mapped}`);
    const regex = channelMappings.value.split('\n').filter(l => l.includes('regex:'));
    const ignore = allChannels.find(c => c.original === '【频道忽略字符】');
    const done = () => { channelMappings.value = [...map, ...regex].join('\n'); updateConfig(); };
    ignore ? fetch('manage.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({update_config_field: 'true', channel_ignore_chars: ignore.mapped.trim()})
    }).then(done).catch(console.error) : done();
}

// 解析 txt、m3u 直播源，并生成频道列表（仅频道）
async function parseSource() {
    const textarea = document.getElementById('gen_list_text');
    let text = textarea.value.trim();
    const channels = new Set();

    // 拆分输入的内容，可能包含多个 URL 或文本
    if(!text.includes('#EXTM3U')) {
        let lines = text.split('\n').map(line => line.trim());
        let urls = lines.filter(line => line.startsWith('http'));

        // 如果存在 URL，则清空原本的 text 内容并逐个请求获取数据
        if (urls.length > 0) {
            text = '';
            for (let url of urls) {
                try {
                    const response = await fetch('manage.php?download_source_data=true&url=' + encodeURIComponent(url));
                    const result = await response.json(); // 解析 JSON 响应
                    
                    if (result.success && !/not found/i.test(result.data)) {
                        text += '\n' + result.data;
                    } else {
                        showMessageModal(/not found/i.test(result.data) ? `Error: ${result.data}` : `${result.message}：\n${url}`);
                    }
                } catch (error) {
                    showMessageModal(`无法获取URL内容: ${url}\n错误信息: ${error.message}`); // 显示网络错误信息
                }
            }
        }
    }

    // 处理 m3u 、 txt 文件内容
    text.split('\n').forEach(line => {
        if (line && !/^http/i.test(line) && !/#genre#/i.test(line) && !/#extm3u/i.test(line)) {
            if (/^#extinf:/i.test(line)) {
                const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
                const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i);

                channelName = (tvgIdMatch && /\D/.test(tvgIdMatch[1]) ? tvgIdMatch[1] : tvgNameMatch ? tvgNameMatch[1] : line.split(',').slice(-1)[0]).trim();
            } else {
                channelName = line.split(',')[0].trim();
            }
            if (channelName) channels.add(channelName.toUpperCase());
        }
    });

    // 将解析后的频道列表放回文本区域
    textarea.value = Array.from(channels).join('\n');
    
    // 保存限定频道列表到数据库
    setGenList();
}

// 解析 txt、m3u 直播源，并生成直播列表（包含分组、地址等信息）
function parseSourceInfo(message = '') {
    showMessageModal(message || "在线源解析较慢<br>请耐心等待...");

    fetch(`manage.php?parse_source_info=true`)
    .then(response => response.json())
    .then(data => {
        showModal('live');
        if (data.success == 'full') {
            showMessageModal('解析成功<br>已生成 M3U 及 TXT 文件');
        } else if (data.success == 'part') {
            showMessageModal('已生成 M3U 及 TXT 文件<br>部分源异常<br>' + data.message);
        }
    })
    .catch(error => showMessageModal('解析过程中发生错误：' + error));

    document.getElementById('liveSourceSearchInput').value = ''; // 清空搜索框内容
}

// 保存限定频道列表
async function setGenList() {
    const genListText = document.getElementById('gen_list_text').value;
    try {
        const response = await fetch('manage.php?set_gen_list=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: genListText })
        });

        const responseText = await response.text();

        if (responseText.trim() !== 'success') {
            console.error('服务器响应错误:', responseText);
        }
    } catch (error) {
        console.error(error);
    }
}

// 保存限定频道列表并更新配置
function setGenListAndUpdateConfig() {
    setGenList();
    updateConfig();
}

// 更新台标文件 iconList.json
function updateIconListJsonFile(notify = false) {
    var iconTableElement = document.getElementById('iconTable');
    var allIcons = iconTableElement && iconTableElement.dataset.allIcons ? JSON.parse(iconTableElement.dataset.allIcons) : null;
    if (allIcons) {
        fetch('manage.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                update_icon_list: true,
                updatedIcons: JSON.stringify(allIcons) // 传递更新后的图标数据
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && notify) {
                showModal('icon');
                showMessageModal('保存成功');
            } else if (data.success == false) {
                showMessageModal(data.message);
            }
        })
        .catch(error => showMessageModal('更新过程中发生错误：' + error));
    }
}

// 导入配置
document.getElementById('importFile').addEventListener('change', function() {
    const file = this.files[0];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    // 检查文件类型
    if (fileExtension != 'gz') {
        showMessageModal('只接受 .gz 文件');
        return;
    }

    // 发送 AJAX 请求
    const formData = new FormData(document.getElementById('importForm'));

    fetch('manage.php', { method: 'POST', body: formData })
    .then(response => response.json())
    .then(data => {
        showMessageModal(data.message);
        if (data.success) {
            // 延迟刷新页面
            setTimeout(() => {
                window.location.href = 'manage.php';
            }, 3000);
        }
    })
    .catch(error => showMessageModal('导入过程中发生错误：' + error));

    this.value = ''; // 重置文件输入框的值，确保可以连续上传相同文件
});

// 修改 token、user_agent 对话框
function changeTokenUA(type, currentTokenUA) {
    showMessageModal('');
    typeStr = (type === 'token' ? 'Token' : 'User-Agent') + '<br>支持多个，每行一个';
    document.getElementById('messageModalMessage').innerHTML = `
        <div style="width: 450px;">
            <h3>修改 ${typeStr}</h3>
            <textarea id="newTokenUA" style="min-height: 250px; margin-bottom: 15px;">${currentTokenUA}</textarea>
            <button onclick="updateTokenUA('${type}')" style="margin-bottom: -10px;">确认</button>
        </div>
    `;
}

// 更新 token、user_agent 到 config.json
function updateTokenUA(type) {
    var newTokenUA = document.getElementById('newTokenUA').value.trim().split('\n').filter(l=>l.trim()).join('\n');
    const type_range = document.getElementById(`${type}_range`).value;

    // 内容写入 config.json 文件
    fetch('manage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            update_config_field: 'true',
            [`${type}_range`]: type_range,
            [type]: newTokenUA
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (type == 'token' || newTokenUA == '') {
                alert('修改成功');
                window.location.href = 'manage.php';
            }
            else {
                showMessageModal('修改成功');
                document.getElementById('change_ua_span').setAttribute('onclick', `changeTokenUA('user_agent', '${newTokenUA.replace(/\n/g, "\\n")}')`);
            }
        } else {
            showMessageModal('修改失败');
        }
    })
    .catch(error => showMessageModal('保存过程中出现错误: ' + error));
}

// token_range 更变后进行提示
function showTokenRangeMessage(token, serverUrl) {
    var tokenRange = document.getElementById("token_range").value;
    var message = '';
    token = token.split('\n')[0];
    if (tokenRange == "1" || tokenRange == "3") {
        message += `直播源地址：<br><a href="${serverUrl}/tv.m3u?token=${token}" target="_blank">${serverUrl}/tv.m3u?token=${token}</a><br>
                    <a href="${serverUrl}/tv.txt?token=${token}" target="_blank">${serverUrl}/tv.txt?token=${token}</a>`;
    }
    if (tokenRange == "2" || tokenRange == "3") {
        if (message) message += '<br>';
        message += `EPG地址：<br><a href="${serverUrl}/index.php?token=${token}" target="_blank">${serverUrl}/index.php?token=${token}</a><br>
                    <a href="${serverUrl}/t.xml?token=${token}" target="_blank">${serverUrl}/t.xml?token=${token}</a><br>
                    <a href="${serverUrl}/t.xml.gz?token=${token}" target="_blank">${serverUrl}/t.xml.gz?token=${token}</a>`;
    }
    if (message) {
        showMessageModal(message);
    }
    document.getElementById('showLiveUrlBtn').setAttribute('onclick', `showLiveUrl('${token}', '${serverUrl}', '${tokenRange}')`);
}

// 监听 debug_mode 更变
function debugMode(selectElem) {
    document.getElementById("accessLogBtn").style.display = selectElem.value === "1" ? "inline-block" : "none";
}

// 切换主题
document.getElementById('themeSwitcher').addEventListener('click', function() {
    // 获取当前主题，并切换到下一个主题
    const currentTheme = localStorage.getItem('theme');
    const newTheme = currentTheme === 'light' ? 'dark' : (currentTheme === 'dark' ? '' : 'light');
    
    // 更新主题
    document.body.classList.add('theme-transition');
    document.body.classList.remove('dark', 'light');

    if (newTheme === '') {
        const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.body.classList.add(prefersDarkScheme ? 'dark' : 'light');
    } else {
        document.body.classList.add(newTheme);
    }

    // 更新图标和文字
    document.getElementById("themeIcon");
    const labelText = document.querySelector('.label-text');
    themeIcon.className = `fas ${newTheme === 'dark' ? 'fa-moon' : newTheme === 'light' ? 'fa-sun' : 'fa-adjust'}`;
    labelText.textContent = newTheme === 'dark' ? 'Dark' : newTheme === 'light' ? 'Light' : 'Auto';
    
    // 保存到本地存储
    localStorage.setItem('theme', newTheme);
});

// 监听系统主题变化
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if(!localStorage.getItem('theme')) {
        const theme = e.matches ? 'dark' : 'light';
        document.body.classList.remove('dark', 'light');
        document.body.classList.add(theme);
    }
});
