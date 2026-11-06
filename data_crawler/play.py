import json
import os
import re

import requests
import urllib3
from bs4 import BeautifulSoup


# ============================================================
# iTHome 鐵人賽 2026 參賽名單爬蟲
# ============================================================
#
# 主要特點：
# 1. 第一頁只請求一次
# 2. 不再依賴舊版 pagination HTML
# 3. 逐頁抓取，直到：
#       - 已抓取筆數 >= 網站顯示的總參賽人數
#       - 或遇到沒有參賽資料的頁面
# 4. 使用 requests.Session() 重複使用 HTTP connection
# 5. 保留原本 JSON 資料格式
# ============================================================


# ------------------------------------------------------------
# 基本設定
# ------------------------------------------------------------

TARGET_YEAR = 2026

BASE_URL = (
    "https://ithelp.ithome.com.tw/"
    "{year}ironman/signup/list?page={page}"
)

OUTPUT_FILENAME = (
    f"ironman_{TARGET_YEAR}_list_all_pages.json"
)

# 每頁最多抓取限制，避免網站結構異常時無限迴圈
MAX_PAGES = 200

# HTTP timeout
REQUEST_TIMEOUT = 15


# ------------------------------------------------------------
# HTTP Headers
# ------------------------------------------------------------

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,"
        "application/xml;q=0.9,image/webp,*/*;q=0.8"
    ),
    "Connection": "keep-alive",
}


# ------------------------------------------------------------
# SSL 警告
# ------------------------------------------------------------

# 原始程式使用 verify=False，
# 因此保留原本的 SSL 警告處理。
urllib3.disable_warnings(
    urllib3.exceptions.InsecureRequestWarning
)


# ============================================================
# 工具函式
# ============================================================

def build_page_url(year: int, page: int) -> str:
    """
    建立指定年度與頁碼的 iTHome 參賽名單 URL。
    """
    return BASE_URL.format(
        year=year,
        page=page
    )


# ============================================================
# 解析主題組別
# ============================================================

def get_dropdown_data(soup: BeautifulSoup) -> list:
    """
    抓取主題組別下拉選單。

    排除第一個通常代表「選擇組別」的 option。
    """

    theme_options = []

    select_tag = soup.find(
        "select",
        id="type"
    )

    if not select_tag:
        return theme_options

    options = select_tag.find_all("option")

    for option in options[1:]:
        theme_name = option.get_text(
            strip=True
        )

        theme_value = option.get(
            "value"
        )

        if theme_name and theme_value:
            theme_options.append({
                "主題名稱": theme_name,
                "連結值": theme_value
            })

    return theme_options


# ============================================================
# 解析總參賽人數
# ============================================================

def get_total_contestant_count(
    soup: BeautifulSoup
) -> int:
    """
    從第一頁取得網站顯示的總參賽人數。
    """

    # 優先使用 ppl-num
    count_element = soup.find(
        "div",
        class_="ppl-num"
    )

    if count_element:

        text = count_element.get_text(
            strip=True
        )

        match = re.search(
            r"(\d+)",
            text
        )

        if match:
            return int(match.group(1))

    # Fallback
    count_container = soup.find(
        "div",
        class_="contestants-list__header"
    )

    if count_container:

        text = count_container.get_text(
            strip=True
        )

        match = re.search(
            r"(\d+)",
            text
        )

        if match:
            return int(match.group(1))

    return 0


# ============================================================
# 解析單張參賽者 Card
# ============================================================

def parse_contestant_card(
    card,
    year: int,
    page: int
) -> dict:
    """
    將單一 list-card 解析成 Python dict。
    """

    title_link_element = card.find(
        "a",
        class_="contestants-list__title"
    )

    person_link_element = card.find(
        "a",
        class_="contestants-list__person"
    )

    status_label = card.find(
        "label",
        class_="note"
    )

    img_element = card.find(
        "img",
        class_="w-100"
    )

    date_element = card.find(
        "div",
        class_="contestants-list__date"
    )

    # --------------------------------------------------------
    # 報名日期
    # --------------------------------------------------------

    raw_date_text = (
        date_element.get_text(strip=True)
        if date_element
        else "N/A"
    )

    cleaned_date = (
        raw_date_text
        .replace("報名日期：", "")
        .strip()
    )

    # --------------------------------------------------------
    # 主題
    # --------------------------------------------------------

    tag_element = card.find(
        "div",
        class_="tag"
    )

    theme = (
        tag_element.get_text(strip=True)
        if tag_element
        else "N/A"
    )

    # --------------------------------------------------------
    # 參賽者名稱
    # --------------------------------------------------------

    contestant_name = "N/A"

    if person_link_element:

        name_element = person_link_element.find(
            "div",
            class_="contestants-list__name"
        )

        if name_element:
            contestant_name = (
                name_element.get_text(strip=True)
            )

    # --------------------------------------------------------
    # 題目
    # --------------------------------------------------------

    title = (
        title_link_element.get_text(strip=True)
        if title_link_element
        else "N/A"
    )

    title_url = (
        title_link_element.get("href")
        if title_link_element
        else "N/A"
    )

    # --------------------------------------------------------
    # 圖片
    # --------------------------------------------------------

    image_url = (
        img_element.get("src")
        if img_element
        else "N/A"
    )

    # --------------------------------------------------------
    # 題目簡介
    # --------------------------------------------------------

    desc_element = card.find(
        "p",
        class_="contestants-list__desc"
    )

    description = (
        desc_element.get_text(strip=True)
        if desc_element
        else "N/A"
    )

    # --------------------------------------------------------
    # 進度
    # --------------------------------------------------------

    progress = (
        status_label.get_text(strip=True)
        if status_label
        else "N/A"
    )

    # --------------------------------------------------------
    # 最終資料
    # --------------------------------------------------------

    return {
        "年度": year,
        "頁碼": page,
        "報名日期": cleaned_date,
        "主題": theme,
        "參賽者名稱": contestant_name,
        "圖像URL": image_url,
        "題目": title,
        "題目URL": title_url,
        "題目簡介": description,
        "進度": progress
    }


# ============================================================
# 抓取單頁
# ============================================================

def scrape_page(
    session: requests.Session,
    year: int,
    page: int
):
    """
    抓取單一頁面。

    Returns:
        dict:
        {
            "data": [...],
            "theme_options": [...],
            "total_count": int,
            "has_data": bool,
            "has_next": bool,
            "next_url": str | None,
            "success": bool
        }

    注意：
    第一頁會同時取得 metadata，
    因此不需要另外 request 第一頁。

    2026 pagination：
    網站不直接顯示 1、2、3... 頁碼，
    而是使用 <a rel="next"> 指向下一頁。
    因此改用 rel="next" 判斷是否還有下一頁。
    """

    target_url = build_page_url(year, page)

    try:

        response = session.get(
            target_url,
            timeout=REQUEST_TIMEOUT,
            verify=False
        )

        response.raise_for_status()

        soup = BeautifulSoup(
            response.text,
            "html.parser"
        )

        # ----------------------------------------------------
        # 找參賽者卡片
        # ----------------------------------------------------

        list_cards = soup.find_all(
            "div",
            class_="list-card"
        )

        # ----------------------------------------------------
        # 找下一頁
        #
        # 2026 網站 pagination 使用：
        #
        # <a ... rel="next" href="...?page=2">
        #
        # 找不到 rel="next" 就代表沒有下一頁。
        # ----------------------------------------------------

        next_link = soup.find(
            "a",
            rel="next"
        )

        next_url = (
            next_link.get("href")
            if next_link
            else None
        )

        has_next = bool(next_url)

        # ----------------------------------------------------
        # 沒有資料
        # ----------------------------------------------------

        if not list_cards:

            print(
                f"\n⛔ 第 {page} 頁沒有參賽資料"
            )

            return {
                "data": [],
                "theme_options": [],
                "total_count": 0,
                "has_data": False,
                "has_next": has_next,
                "next_url": next_url,
                "success": True
            }

        # ----------------------------------------------------
        # 第一頁才取得 metadata
        # ----------------------------------------------------

        theme_options = []
        total_count = 0

        if page == 1:

            theme_options = get_dropdown_data(
                soup
            )

            total_count = (
                get_total_contestant_count(
                    soup
                )
            )

        # ----------------------------------------------------
        # 解析所有參賽者
        # ----------------------------------------------------

        contestants_data = []

        for card in list_cards:

            entry = parse_contestant_card(
                card,
                year,
                page
            )

            contestants_data.append(entry)

        return {
            "data": contestants_data,
            "theme_options": theme_options,
            "total_count": total_count,
            "has_data": True,
            "has_next": has_next,
            "next_url": next_url,
            "success": True
        }

    except requests.exceptions.HTTPError as e:

        status_code = (
            e.response.status_code
            if e.response
            else "Unknown"
        )

        print(
            f"\n❌ 第 {page} 頁 HTTP 錯誤："
            f"{status_code}"
        )

        return {
            "data": [],
            "theme_options": [],
            "total_count": 0,
            "has_data": False,
            "has_next": False,
            "next_url": None,
            "success": False
        }

    except requests.exceptions.RequestException as e:

        print(
            f"\n❌ 第 {page} 頁連線錯誤：{e}"
        )

        return {
            "data": [],
            "theme_options": [],
            "total_count": 0,
            "has_data": False,
            "has_next": False,
            "next_url": None,
            "success": False
        }

    except Exception as e:

        print(
            f"\n❌ 第 {page} 頁發生錯誤：{e}"
        )

        return {
            "data": [],
            "theme_options": [],
            "total_count": 0,
            "has_data": False,
            "has_next": False,
            "next_url": None,
            "success": False
        }


# ============================================================
# 儲存 JSON
# ============================================================

def save_json(
    output_data: dict,
    filename: str
) -> bool:
    """
    將最終資料儲存為 JSON。
    """

    try:

        json_output = json.dumps(
            output_data,
            indent=4,
            ensure_ascii=False
        )

        with open(
            filename,
            "w",
            encoding="utf-8"
        ) as f:

            f.write(json_output)

        return True

    except PermissionError:

        print(
            "\n[檔案錯誤] "
            "寫入失敗：權限不足。"
        )

        return False

    except OSError as e:

        print(
            f"\n[檔案錯誤] "
            f"檔案寫入失敗：{e}"
        )

        return False


# ============================================================
# 主程式
# ============================================================

def main():

    print()
    print("=" * 60)
    print(
        f"iTHome 鐵人賽 {TARGET_YEAR} "
        "參賽名單爬蟲"
    )
    print("=" * 60)

    # --------------------------------------------------------
    # 建立 Session
    # --------------------------------------------------------

    session = requests.Session()

    session.headers.update(
        HEADERS
    )

    # --------------------------------------------------------
    # 初始化
    # --------------------------------------------------------

    all_contestants_data = []

    theme_options = []

    total_count = 0

    success_count = 0

    failure_count = 0

    failed_pages = []

    current_page = 1

    # --------------------------------------------------------
    # 逐頁抓取
    #
    # 重點：
    #
    # 每一頁只 request 一次。
    #
    # 第一頁同時取得：
    # - 資料
    # - 總人數
    # - 主題組別
    #
    # 不再另外呼叫 get_total_pages()
    # --------------------------------------------------------

    while current_page <= MAX_PAGES:

        result = scrape_page(
            session,
            TARGET_YEAR,
            current_page
        )

        # ----------------------------------------------------
        # Request 失敗
        # ----------------------------------------------------

        if not result["success"]:

            failure_count += 1

            failed_pages.append(
                current_page
            )

            print(
                f"\n❌ 第 {current_page} 頁抓取失敗，"
                "停止後續抓取。"
            )

            break

        # ----------------------------------------------------
        # 沒有資料
        # ----------------------------------------------------

        if not result["has_data"]:

            break

        # ----------------------------------------------------
        # 第一頁 metadata
        # ----------------------------------------------------

        if current_page == 1:

            theme_options = (
                result["theme_options"]
            )

            total_count = (
                result["total_count"]
            )

            print()
            print(
                f"iTHome 鐵人賽 "
                f"{TARGET_YEAR} 年"
            )

            print(
                f"報名總人數: {total_count}"
            )

            print(
                "【開始逐頁抓取】"
            )

            print("-" * 60)

        # ----------------------------------------------------
        # 加入資料
        # ----------------------------------------------------

        current_page_data = result["data"]

        all_contestants_data.extend(
            current_page_data
        )

        success_count += 1

        # ----------------------------------------------------
        # 顯示進度
        # ----------------------------------------------------

        collected_count = len(
            all_contestants_data
        )

        if total_count > 0:

            print(
                f"\r✅ 第 {current_page} 頁："
                f"{len(current_page_data)} 筆"
                f"｜目前累計："
                f"{collected_count}/{total_count}",
                end=""
            )

        else:

            print(
                f"\r✅ 第 {current_page} 頁："
                f"{len(current_page_data)} 筆"
                f"｜目前累計："
                f"{collected_count}",
                end=""
            )

        # ----------------------------------------------------
        # 2026 Pagination：
        #
        # 使用網站提供的 rel="next" 判斷是否還有下一頁。
        #
        # 如果沒有 rel="next"，代表目前已經是最後一頁。
        # ----------------------------------------------------

        if not result["has_next"]:

            print()
            print(
                "\n✅ 找不到下一頁，"
                "已到達最後一頁。"
            )

            break

        # ----------------------------------------------------
        # 下一頁
        # ----------------------------------------------------

        current_page += 1

    # --------------------------------------------------------
    # MAX_PAGES 安全限制
    # --------------------------------------------------------

    if current_page > MAX_PAGES:

        print()
        print(
            f"\n⚠️ 已達到 MAX_PAGES={MAX_PAGES} 的安全限制，"
            "停止抓取。"
        )

    # --------------------------------------------------------
    # 最終換行
    # --------------------------------------------------------

    print()

    # --------------------------------------------------------
    # 計算實際頁數
    # --------------------------------------------------------

    if success_count > 0:

        total_pages = success_count

    else:

        total_pages = 0

    # --------------------------------------------------------
    # 抓取摘要
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("【抓取摘要】")
    print("=" * 60)

    print(
        f"年度：{TARGET_YEAR}"
    )

    print(
        f"網站顯示總參賽人數："
        f"{total_count}"
    )

    print(
        f"實際抓取頁數："
        f"{total_pages}"
    )

    print(
        f"實際抓取筆數："
        f"{len(all_contestants_data)}"
    )

    print(
        f"成功頁面："
        f"{success_count}"
    )

    print(
        f"失敗頁面："
        f"{failure_count}"
    )

    if failed_pages:

        print(
            "失敗頁碼："
        )

        for page in failed_pages:

            print(
                f" - 第 {page} 頁"
            )

    else:

        print(
            "失敗頁碼：無"
        )

    print("=" * 60)

    # --------------------------------------------------------
    # 如果完全沒有資料
    # --------------------------------------------------------

    if not all_contestants_data:

        print(
            "\n程式結束："
            "沒有抓取到任何有效資料。"
        )

        return

    # --------------------------------------------------------
    # 組合最終 JSON
    # --------------------------------------------------------

    output_key = (
        f"it 鐵人賽 {TARGET_YEAR} 年 - 參賽名單"
    )

    final_output = {

        output_key: {

            "總參賽人數_所有組別":
                total_count,

            "總分頁數":
                total_pages,

            "實際抓取筆數":
                len(all_contestants_data),

            "主題組別_下拉選單":
                theme_options,

            "參賽者名單_完整列表":
                all_contestants_data
        }
    }

    # --------------------------------------------------------
    # 儲存 JSON
    # --------------------------------------------------------

    if save_json(
        final_output,
        OUTPUT_FILENAME
    ):

        file_path = os.path.abspath(
            OUTPUT_FILENAME
        )

        print()
        print("=" * 60)
        print(
            "【JSON 數據抓取與儲存完成】"
        )
        print("=" * 60)

        print(
            f"最終儲存筆數："
            f"{len(all_contestants_data)}"
        )

        print(
            f"實際頁數："
            f"{total_pages}"
        )

        print(
            f"檔案位置：\n"
            f"{file_path}"
        )

        print("=" * 60)


# ============================================================
# 程式入口
# ============================================================

if __name__ == "__main__":
    main()