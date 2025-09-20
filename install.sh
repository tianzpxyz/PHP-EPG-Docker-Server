#!/bin/bash
#
# @file install.sh
# @brief IPTV工具箱管理脚本
#
# 该脚本提供IPTV工具箱的安装、管理、更新和信息查看功能，
# 包含菜单交互界面和常用操作的快捷执行。
#
# 作者: Tak
# GitHub: https://github.com/taksssss/iptv-tool
#

CONTAINER_NAME="php-epg"
IMAGE_NAME="taksss/php-epg:latest"
TENCENT_IMAGE="ccr.ccs.tencentyun.com/taksss/php-epg:latest"
DATA_DIR="$HOME/epg"
UPDATE_CONTAINER="php-epg-update"

# 颜色定义
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
CYAN="\033[36m"
BOLD="\033[1m"
RESET="\033[0m"

# 检测是否需要 sudo
SUDO_CMD=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO_CMD="sudo"
fi

# Docker 命令封装，自动加 sudo
docker_cmd() {
    if docker info >/dev/null 2>&1; then
        docker "$@"
    else
        $SUDO_CMD docker "$@"
    fi
}

install_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${YELLOW}未检测到 Docker，开始安装...${RESET}"

        # 使用 Docker 官方安装脚本 + 阿里云源
        curl -fsSL https://get.docker.com | $SUDO_CMD bash -s docker --mirror Aliyun

        $SUDO_CMD systemctl enable docker
        $SUDO_CMD systemctl start docker

        echo -e "${GREEN}Docker 安装完成${RESET}"
    fi
}

show_main_menu() {
    clear
    echo -e "${CYAN}================================================${RESET}"
    echo -e "                   ${BOLD}${GREEN}IPTV工具箱${RESET}"
    echo -e "${CYAN}================================================${RESET}"
    echo -e "${BOLD}${YELLOW}项目地址：${RESET}${GREEN}https://github.com/taksssss/iptv-tool${RESET}"
    echo -e "${CYAN}================================================${RESET}"
    echo -e " ${GREEN}1)${RESET} 安装部署"
    echo -e " ${GREEN}2)${RESET} 管理容器"
    echo -e " ${GREEN}3)${RESET} 更新容器"
    echo -e " ${GREEN}4)${RESET} 容器信息"
    echo ""
    echo -e " ${GREEN}0)${BOLD}${RED} 打赏项目${RESET}"
    echo -e " ${GREEN}q)${RESET} 退出"
    echo -e "${CYAN}================================================${RESET}"
    echo -ne "${BOLD}请选择: ${RESET}"
}

show_manage_menu() {
    clear
    echo -e "${CYAN}================ 管理容器 ===============${RESET}"
    echo -e " ${GREEN}1)${RESET} 停止容器"
    echo -e " ${GREEN}2)${RESET} 重启容器"
    echo -e " ${GREEN}3)${RESET} 卸载容器"
    echo -e " ${GREEN}0)${RESET} 返回上级"
    echo -e "${CYAN}=========================================${RESET}"
    echo -ne "${BOLD}请选择: ${RESET}"
}

show_update_menu() {
    clear
    echo -e "${CYAN}================ 更新容器 ===============${RESET}"
    echo -e " ${GREEN}1)${RESET} 手动更新"
    echo -e " ${GREEN}2)${RESET} 自动更新"
    echo -e " ${GREEN}0)${RESET} 返回上级"
    echo -e "${CYAN}=========================================${RESET}"
    echo -ne "${BOLD}请选择: ${RESET}"
}

show_info_menu() {
    clear
    echo -e "${CYAN}================ 容器信息 ===============${RESET}"
    echo -e " ${GREEN}1)${RESET} 查看状态"
    echo -e " ${GREEN}2)${RESET} 查看日志"
    echo -e " ${GREEN}0)${RESET} 返回上级"
    echo -e "${CYAN}=========================================${RESET}"
    echo -ne "${BOLD}请选择: ${RESET}"
}

donate_info() {
    clear
    echo -e "${CYAN}=============================${RESET}"
    echo -e " ${BOLD}${YELLOW}感谢您的支持${RESET}"
    echo -e "${CYAN}=============================${RESET}"

    echo -e "\n${YELLOW}微信扫码：${RESET}\n"
    echo H4sIAAAAAAAAA71UQRKEMAi77yt4ag4ceME+0JfsaFsIWOt4WGc6jlYaAgndvra9uD5vJqv5ZPsqL2l7HqDSIux4YnnuMoOJJNyGhIDZf8NjSvQUkXJbj0baOBYSzuzclQo6W4Fg9VvO+OnkTff3drQPBFLvdmvHkMLlgKz4owdoZtylgqcHqzv6zuEL5tLYOgQKPpKRxm57UbmrQCkLt8nNNoxjEm2UkvJ6ytjAwSpkYPOo1zKyR+k3DgIxYUPARS3doxedNnKep7jWJBiCvYpUeiexwJ/POUrXmX2aCS7t0f0wamBpzClo6Lzmfr4neOTK01gWPvzwlrjerCrNRm3p2n+v1/P9AFfd7fZsBwAA | base64 -d | gzip -d

    echo -e "\n${YELLOW}支付宝扫码：${RESET}\n"
    echo H4sIAAAAAAAAA71U2w3DMAj87xQ3Kh98MEEHzCRV7QBHYjtKpUZCedjAAQdsb9selNeTYEc8bG9lQTuWfmN+3I/Un01rbDnBMADhU1y+/9JupDvQgfbMI2G734N7B4GHPrEb86Aj6ecCr4RRVYx9zqwnWMj8o5rhWED5YYc/h7BgGFmGjM/CCsQGcyystKhTtMeiZtlZ6ZxFDzFNOclg9fTiL61BCdGyzKiUqfUlGLvmEU1GT5qhZfcmxdGG0hnQWhGNCyPPV3lQxyUJBQUxwjuo5kzHZN7aG1mPmhxYI23lqkq5B6IvhT608qCchA/JjQ0Caq0k3fYBVCDT+GVr8A7Qkf7Qj63x/i6P430ACGdl934HAAA= | base64 -d | gzip -d

    echo ""
    echo -e "${CYAN}=============================${RESET}"
}

choose_image() {
    echo ""
    echo "请选择镜像源:"
    echo "1) Docker Hub (默认)"
    echo "2) 腾讯云镜像"
    echo -n "请输入 (1-2): "
    read img_choice
    if [ "$img_choice" = "2" ]; then
        IMAGE_NAME=$TENCENT_IMAGE
    fi
}

set_env() {
    echo ""
    echo -n "数据目录 [默认 $HOME/epg]: "
    read input_dir
    [ -n "$input_dir" ] && DATA_DIR=$input_dir

    echo -n "PHP 内存限制 [默认 512M]: "
    read PHP_MEMORY_LIMIT
    PHP_MEMORY_LIMIT=${PHP_MEMORY_LIMIT:-512M}

    echo -n "是否启用 ffmpeg? (y/n 默认 n): "
    read FFMPEG_CHOICE
    echo ""
    if [ "$FFMPEG_CHOICE" = "y" ] || [ "$FFMPEG_CHOICE" = "Y" ]; then
        ENABLE_FFMPEG=true
    else
        ENABLE_FFMPEG=false
    fi
}

start_container() {
    echo ""
    echo "请选择运行模式:"
    echo "1) Bridge 模式 (默认)"
    echo "2) Host 模式 (支持IPv6)"
    echo -n "请输入 (1-2): "
    read mode
    mode=${mode:-1}

    choose_image
    set_env

    docker_cmd rm -f $CONTAINER_NAME >/dev/null 2>&1
    mkdir -p $DATA_DIR

    echo -n "HTTP端口 [默认5678]: "
    read HTTP_PORT
    HTTP_PORT=${HTTP_PORT:-5678}

    if [ "$mode" = "1" ]; then
        echo -n "HTTPS端口 (可留空): "
        read HTTPS_PORT
        PORT_ARGS="-p $HTTP_PORT:80"
        [ -n "$HTTPS_PORT" ] && PORT_ARGS="$PORT_ARGS -p $HTTPS_PORT:443"
        docker_cmd run -d --name $CONTAINER_NAME \
            $PORT_ARGS \
            -v $DATA_DIR:/htdocs/data \
            -e PHP_MEMORY_LIMIT=$PHP_MEMORY_LIMIT \
            -e ENABLE_FFMPEG=$ENABLE_FFMPEG \
            --restart unless-stopped \
            $IMAGE_NAME
    elif [ "$mode" = "2" ]; then
        echo -n "HTTPS端口 [默认5679]: "
        read HTTPS_PORT
        HTTPS_PORT=${HTTPS_PORT:-5679}
        docker_cmd run -d --name $CONTAINER_NAME \
            --network host \
            -e HTTP_PORT=$HTTP_PORT \
            -e HTTPS_PORT=$HTTPS_PORT \
            -e PHP_MEMORY_LIMIT=$PHP_MEMORY_LIMIT \
            -e ENABLE_FFMPEG=$ENABLE_FFMPEG \
            -v $DATA_DIR:/htdocs/data \
            --restart unless-stopped \
            $IMAGE_NAME
    else
        echo -e "${RED}无效选择${RESET}"
        return
    fi

    echo ""
    echo -e "${GREEN}容器已部署 ✅${RESET}"
    echo "数据目录：$DATA_DIR"
    echo "HTTP端口：$HTTP_PORT"
    [ -n "$HTTPS_PORT" ] && echo "HTTPS端口：$HTTPS_PORT"
    echo "PHP 内存限制：$PHP_MEMORY_LIMIT"
    echo "ffmpeg 启用：$ENABLE_FFMPEG"
    echo ""
    echo "访问地址: http://{服务器IP地址}:$HTTP_PORT/manage.php"
    echo -e "${BOLD}${RED}请务必阅读页面底部「使用说明」！${RESET}"
    echo ""
}

stop_container() {
    docker_cmd stop $CONTAINER_NAME 2>/dev/null && \
    echo -e "${GREEN}容器已停止${RESET}" || echo "${RED}容器未运行${RESET}"
}

restart_container() {
    docker_cmd restart $CONTAINER_NAME 2>/dev/null && \
    echo -e "${GREEN}容器已重启${RESET}" || echo "${RED}容器未运行${RESET}"
}

uninstall_container() {
    docker_cmd rm -f $CONTAINER_NAME 2>/dev/null && \
    echo -e "${GREEN}容器已卸载${RESET}" || echo "${RED}容器不存在${RESET}"
}

manual_update() {
    echo "触发一次更新..."
    docker_cmd rm -f $UPDATE_CONTAINER >/dev/null 2>&1
    docker_cmd run --rm --name $UPDATE_CONTAINER \
        -v /var/run/docker.sock:/var/run/docker.sock \
        containrrr/watchtower $CONTAINER_NAME --cleanup --run-once
    echo -e "${GREEN}更新完成 ✅${RESET}"
}

auto_update() {
    echo -n "请输入检查更新的时间间隔(小时, 输入0关闭自动更新, 默认1): "
    read HOURS
    HOURS=${HOURS:-1}
    docker_cmd rm -f $UPDATE_CONTAINER >/dev/null 2>&1
    if [ "$HOURS" -eq 0 ]; then
        echo -e "${YELLOW}已关闭自动更新${RESET}"
        return
    fi
    INTERVAL=$((HOURS * 3600))
    docker_cmd run -d --name $UPDATE_CONTAINER \
        -v /var/run/docker.sock:/var/run/docker.sock \
        --restart unless-stopped \
        containrrr/watchtower $CONTAINER_NAME --cleanup --interval $INTERVAL
    echo -e "${GREEN}已启动自动更新，每 $HOURS 小时检查一次 ✅${RESET}"
}

status_container() {
    if docker_cmd ps -a --format '{{.Names}}' | grep -w $CONTAINER_NAME >/dev/null; then
        docker_cmd ps -a --filter "name=$CONTAINER_NAME"
    else
        echo -e "${RED}容器不存在${RESET}"
    fi
}

show_logs() {
    docker_cmd logs -f $CONTAINER_NAME
}

install_docker

while true; do
    show_main_menu
    read choice
    case $choice in
        1) start_container ;;
        2)
            while true; do
                show_manage_menu
                read sub_choice
                case $sub_choice in
                    1) stop_container ;;
                    2) restart_container ;;
                    3) uninstall_container ;;
                    0) break ;;
                    *) echo -e "${RED}无效选择${RESET}" ;;
                esac
                [ "$sub_choice" = "0" ] || { echo "按回车键继续..."; read dummy; }
            done
            ;;
        3)
            while true; do
                show_update_menu
                read sub_choice
                case $sub_choice in
                    1) manual_update ;;
                    2) auto_update ;;
                    0) break ;;
                    *) echo -e "${RED}无效选择${RESET}" ;;
                esac
                [ "$sub_choice" = "0" ] || { echo "按回车键继续..."; read dummy; }
            done
            ;;
        4)
            while true; do
                show_info_menu
                read sub_choice
                case $sub_choice in
                    1) status_container ;;
                    2) show_logs ;;
                    0) break ;;
                    *) echo -e "${RED}无效选择${RESET}" ;;
                esac
                [ "$sub_choice" = "0" ] || { echo "按回车键继续..."; read dummy; }
            done
            ;;
        0) donate_info ;;
        q) echo "退出"; exit 0 ;;
        *) echo -e "${RED}无效选择${RESET}" ;;
    esac
    [ "$choice" = "2" ] || [ "$choice" = "3" ] || [ "$choice" = "4" ] || { echo "按回车键继续..."; read dummy; }
done